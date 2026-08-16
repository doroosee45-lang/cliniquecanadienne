const crypto = require('crypto');
const path   = require('path');
const fs     = require('fs');
const bcrypt = require('bcryptjs');
const Patient = require('../models/Patient');
const User    = require('../models/User');
const { logAction, paginate, createNotification } = require('../utils/helpers');
const mail = require('../utils/mail');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');

// R-08a — superadmin/adminclinique/medecin/infirmier/sage_femme voient le
// dossier complet ; les 5 autres rôles autorisés à lire /patients n'ont un
// besoin métier réel que des champs administratifs/démographiques liés à
// leur activité, jamais des champs cliniques (antecedents_medicaux,
// antecedents_familiaux, notes) — matrice validée avec l'utilisateur.
// null = aucune restriction (dossier complet).
const DEMO_FIELDS = 'nom prenom numero_dossier date_naissance sexe telephone email photo adresse statut createdAt';
const RESTRICTED_FIELDS = {
  // Risque clinique immédiat (prélèvement) → groupe sanguin + allergies.
  laborantin:     `${DEMO_FIELDS} groupe_sanguin allergies`,
  // Risque clinique immédiat (produit de contraste) → allergies.
  radiologue:     `${DEMO_FIELDS} allergies`,
  // Risque clinique immédiat (interactions) → allergies.
  pharmacien:     `${DEMO_FIELDS} allergies`,
  // Accueil/orientation → assurances, contact d'urgence, médecin référent.
  receptionniste: `${DEMO_FIELDS} assurances contact_urgence medecin_referent`,
  // Facturation → assurances uniquement.
  comptable:      `${DEMO_FIELDS} assurances`,
};
const fieldsFor = (role) => RESTRICTED_FIELDS[role] || null;

// ── GET ALL ──────────────────────────────────────────────────────────────────
exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, q, statut } = req.query;
    const filter = {};
    if (statut) filter.statut = statut;
    if (q) filter.$text = { $search: q };

    const fields = fieldsFor(req.user.role);
    let query = Patient.find(filter).sort('-createdAt');
    if (fields) query = query.select(fields);
    if (!fields || fields.includes('medecin_referent')) query = query.populate('medecin_referent', 'nom prenom');

    const total    = await Patient.countDocuments(filter);
    const patients = await paginate(query, page, limit);
    res.json({ success: true, total, count: patients.length, patients });
  } catch (err) { next(err); }
};

// ── GET ONE ──────────────────────────────────────────────────────────────────
exports.getOne = async (req, res, next) => {
  try {
    const fields = fieldsFor(req.user.role);
    let query = Patient.findById(req.params.id);
    if (fields) query = query.select(fields);
    if (!fields || fields.includes('medecin_referent')) query = query.populate('medecin_referent', 'nom prenom specialite');
    // cree_par (audit de création) : métadonnée administrative interne,
    // réservée aux rôles à accès complet — pas de besoin métier identifié
    // pour laborantin/radiologue/pharmacien/receptionniste/comptable.
    if (!fields) query = query.populate('cree_par', 'nom prenom role');

    const patient = await query;
    if (!patient) return res.status(404).json({ success: false, message: 'Patient introuvable.' });
    res.json({ success: true, patient });
  } catch (err) { next(err); }
};

// ── CREATE ───────────────────────────────────────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    // ① Vérification patient déjà existant
    let existing = null;
    if (req.body.email) {
      existing = await Patient.findOne({ email: req.body.email.toLowerCase().trim() });
    }
    if (!existing && req.body.nom && req.body.prenom && req.body.date_naissance) {
      const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      existing = await Patient.findOne({
        nom:            { $regex: new RegExp(`^${escRe(req.body.nom.trim())}$`, 'i') },
        prenom:         { $regex: new RegExp(`^${escRe(req.body.prenom.trim())}$`, 'i') },
        date_naissance: new Date(req.body.date_naissance),
      });
    }
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Un dossier patient existe déjà pour cette personne.',
        patient_id: existing._id,
        redirect: 'update',
      });
    }

    // ② Token d'activation — R-08b : plus de mot de passe généré ici, le
    // patient choisit le sien en suivant le lien (voir exports.activate /
    // exports.setPasswordAndActivate).
    const tokenActivation = crypto.randomBytes(32).toString('hex');
    const tokenExpire     = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

    const patientData = {
      ...req.body,
      actif:                   false,          // inactif jusqu'à activation
      token_activation:        tokenActivation,
      token_activation_expire: tokenExpire,
      cree_par:                req.user._id,
      ip_creation:             req.ip,
    };

    const patient = await Patient.create(patientData);

    // ② bis — Création du compte User (role=patient) lié au dossier, sans
    // mot de passe (schéma : optionnel depuis le support des comptes
    // Google) — inutilisable pour se connecter tant que le patient n'a pas
    // suivi le lien d'activation et défini le sien.
    if (patient.email && !(await User.findOne({ email: patient.email }))) {
      await User.create({
        email:                patient.email,
        nom:                  patient.nom,
        prenom:               patient.prenom,
        role:                 'patient',
        telephone:            patient.telephone || '',
        statut:               'inactif',       // activé lors du clic sur le lien
        patient_id:           patient._id,     // T2.2 — lien direct dossier ↔ compte
      });
    }

    // ③ Envoi email activation
    let emailEnvoye = false;
    if (patient.email) {
      try {
        await mail.sendActivationEmail({
          email:      patient.email,
          prenom:     patient.prenom,
          nom:        patient.nom,
          token:      tokenActivation,
        });
        emailEnvoye = true;
      } catch (mailErr) {
        console.error('[MAIL ERROR]', mailErr.message);
        // Log d'erreur + notification admin
        await logAction({
          utilisateur: req.user._id,
          action:      'EMAIL_FAILED',
          module:      'patients',
          entite_id:   patient._id,
          ip:          req.ip,
          message:     `Échec envoi email activation pour ${patient.nom} ${patient.prenom}: ${mailErr.message}`,
          statut:      'echec',
        });
        await createNotification({
          destinataire: req.user._id,
          type:         'alert',
          titre:        'Échec envoi email patient',
          message:      `L'email d'activation pour ${patient.prenom} ${patient.nom} (${patient.numero_dossier}) n'a pas pu être envoyé. Vérifiez la configuration SMTP.`,
          priorite:     'haute',
        });
      }
    }

    // ④ Audit log (IP + utilisateur créateur)
    await logAction({
      utilisateur: req.user._id,
      action:      'CREATE',
      module:      'patients',
      entite_id:   patient._id,
      ip:          req.ip,
      ua:          req.headers['user-agent'],
      message:     `Nouveau dossier patient créé : ${patient.nom} ${patient.prenom} (${patient.numero_dossier}) par ${req.user.prenom} ${req.user.nom}`,
    });

    emitActivity({ module: 'patients', action: 'Nouveau patient', detail: `${patient.prenom} ${patient.nom} (${patient.numero_dossier})`, icon: '👤', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();

    res.status(201).json({
      success:           true,
      patient,
      email_envoye:      emailEnvoye,
      message:           emailEnvoye
        ? `Dossier créé avec succès. Un email d'activation a été envoyé à ${patient.email}.`
        : `Dossier créé. Email d'activation non envoyé (SMTP non configuré).`,
    });
  } catch (err) { next(err); }
};

// ── ACTIVATE (public, via lien email) ────────────────────────────────────────
exports.activate = async (req, res, next) => {
  try {
    const { token } = req.params;
    const patient = await Patient.findOne({
      token_activation:        token,
      token_activation_expire: { $gt: new Date() },
    });

    if (!patient) {
      return res.status(400).json({
        success: false,
        message: 'Lien d\'activation invalide ou expiré.',
      });
    }

    // R-08b — ne fait plus qu'assurer la validité du lien : ne consomme
    // rien, n'active rien. L'activation réelle se fait par
    // exports.setPasswordAndActivate, une fois le mot de passe soumis —
    // sinon un simple rafraîchissement de cette page invaliderait le lien
    // avant même que le patient ait pu choisir son mot de passe.
    res.json({
      success: true,
      prenom:  patient.prenom,
      nom:     patient.nom,
    });
  } catch (err) { next(err); }
};

// ── DÉFINIR LE MOT DE PASSE + ACTIVER (public, via lien email) ───────────────
exports.setPasswordAndActivate = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const patient = await Patient.findOne({
      token_activation:        token,
      token_activation_expire: { $gt: new Date() },
    });
    if (!patient) {
      return res.status(400).json({ success: false, message: 'Lien d\'activation invalide ou expiré.' });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: 'Mot de passe requis.' });
    }

    const user = await User.findOne({ email: patient.email, role: 'patient' });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Compte utilisateur introuvable pour ce dossier.' });
    }

    // La complexité (majuscule + chiffre, 6 caractères min) est appliquée
    // par le validateur du modèle User.password (R-16) — ce save() la
    // déclenche automatiquement, aucune règle à dupliquer ici.
    user.password = password;
    user.statut   = 'actif';
    await user.save();

    patient.actif                   = true;
    patient.token_activation        = undefined;
    patient.token_activation_expire = undefined;
    await patient.save();

    await logAction({
      action:    'ACTIVATE',
      module:    'patients',
      entite_id: patient._id,
      ip:        req.ip,
      message:   `Compte patient activé (mot de passe défini par le patient) : ${patient.nom} ${patient.prenom} (${patient.numero_dossier})`,
    });

    res.json({
      success:    true,
      message:    'Compte activé avec succès. Vous pouvez maintenant vous connecter.',
      patient_id: patient._id,
      prenom:     patient.prenom,
      nom:        patient.nom,
    });
  } catch (err) {
    // Erreur de validation Mongoose (complexité du mot de passe) — message
    // clair plutôt que l'erreur brute du validateur.
    if (err.name === 'ValidationError' && err.errors?.password) {
      return res.status(400).json({ success: false, message: err.errors.password.message });
    }
    next(err);
  }
};

// ── ACTIVATE DIRECT (admin, sans email) ──────────────────────────────────────
exports.activateAdmin = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient introuvable.' });

    patient.actif  = true;
    patient.statut = 'actif';
    await patient.save();

    let lienRenvoye = false;
    if (patient.email) {
      const user = await User.findOne({ email: patient.email, role: 'patient' }).select('+password');
      if (user) {
        user.statut = 'actif';
        // R-08b — dossier activé tout de suite pour le staff, mais si ce
        // compte n'a encore aucun mot de passe utilisable, "actif" et
        // "peut se connecter au portail" restent deux états distincts :
        // on renvoie un nouveau lien plutôt que de régénérer un mot de
        // passe temporaire (ce que R-08b cherche justement à éliminer).
        if (!user.password) {
          const tokenActivation = crypto.randomBytes(32).toString('hex');
          patient.token_activation        = tokenActivation;
          patient.token_activation_expire = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await patient.save();
          try {
            await mail.sendActivationEmail({ email: patient.email, prenom: patient.prenom, nom: patient.nom, token: tokenActivation });
            lienRenvoye = true;
          } catch (mailErr) {
            console.error('[MAIL ERROR]', mailErr.message);
          }
        } else {
          patient.token_activation        = undefined;
          patient.token_activation_expire = undefined;
          await patient.save();
        }
        await user.save();
      }
    }

    await logAction({
      utilisateur: req.user._id,
      action:      'ACTIVATE_ADMIN',
      module:      'patients',
      entite_id:   patient._id,
      ip:          req.ip,
      message:     `Compte patient activé manuellement : ${patient.nom} ${patient.prenom} (${patient.numero_dossier}) par ${req.user.prenom} ${req.user.nom}${lienRenvoye ? ' — nouveau lien envoyé (pas encore de mot de passe)' : ''}`,
    });

    res.json({
      success: true,
      patient,
      lien_renvoye: lienRenvoye,
      message: lienRenvoye
        ? 'Dossier activé. Le patient n\'a pas encore de mot de passe — un nouveau lien d\'activation lui a été envoyé.'
        : 'Compte patient activé directement.',
    });
  } catch (err) { next(err); }
};

// ── UPDATE ───────────────────────────────────────────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const avant   = await Patient.findById(req.params.id);
    const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'patients', entite_id: patient._id, ip: req.ip, avant, apres: patient });
    res.json({ success: true, patient });
  } catch (err) { next(err); }
};

// Ticket 0010 — la cascade vers le compte User lié résolvait par email, une
// correspondance qui peut se désynchroniser silencieusement entre les deux
// documents (aucune contrainte les liant). Même principe que
// portal.controller.js::findPatient depuis R-07 : patient_id (référence
// ObjectId stable) en priorité, repli sur l'email seulement s'il n'y a pas
// de User dont le patient_id pointe vers ce dossier. Retourne un filtre
// Mongo (pas le document) pour rester utilisable aussi bien par
// findOneAndUpdate que par deleteOne aux deux points d'appel ci-dessous.
const resolveLinkedUserFilter = async (patient) => {
  const byPatientId = { patient_id: patient._id, role: 'patient' };
  if (await User.exists(byPatientId)) return byPatientId;
  return patient.email ? { email: patient.email, role: 'patient' } : null;
};

// ── DELETE ───────────────────────────────────────────────────────────────────
exports.remove = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient introuvable.' });

    // Un dossier patient possédant le moindre historique clinique/financier
    // ne doit jamais être supprimé physiquement : obligation de conservation
    // du dossier médical, et ça laisserait des références orphelines dans
    // rendez-vous/consultations/hospitalisations/factures/ordonnances. On
    // désactive le dossier à la place (statut='inactif', actif=false).
    const [Appointment, Consultation, Hospitalization, Invoice, Prescription] = [
      require('../models/Appointment'), require('../models/Consultation'),
      require('../models/Hospitalization'), require('../models/Invoice'), require('../models/Prescription'),
    ];
    const [nbRdv, nbConsult, nbHosp, nbFact, nbRx] = await Promise.all([
      Appointment.countDocuments({ patient: patient._id }),
      Consultation.countDocuments({ patient: patient._id }),
      Hospitalization.countDocuments({ patient: patient._id }),
      Invoice.countDocuments({ patient: patient._id }),
      Prescription.countDocuments({ patient: patient._id }),
    ]);
    const hasHistory = (nbRdv + nbConsult + nbHosp + nbFact + nbRx) > 0;

    if (hasHistory) {
      patient.actif  = false;
      patient.statut = 'inactif';
      await patient.save();
      // Le compte portail associé ne doit plus pouvoir se connecter.
      const deactivateFilter = await resolveLinkedUserFilter(patient);
      if (deactivateFilter) {
        await User.findOneAndUpdate(deactivateFilter, { statut: 'inactif' });
      }
      await logAction({ utilisateur: req.user._id, action: 'DEACTIVATE', module: 'patients', entite_id: patient._id, ip: req.ip, message: `Désactivation (historique existant) : ${patient.nom} ${patient.prenom}` });
      return res.json({
        success: true,
        deactivated: true,
        message: 'Ce patient a un historique clinique ou financier — le dossier a été désactivé plutôt que supprimé, pour préserver l\'intégrité des données.',
      });
    }

    // Aucun historique : suppression réelle possible. On nettoie aussi le
    // compte User "patient" lié pour ne pas laisser un compte orphelin.
    // Filtre résolu AVANT la suppression du Patient : la contrainte
    // structurelle du ticket 0008 (Patient.pre('findOneAndDelete')) refuse
    // déjà la suppression tant qu'un User actif référence patient_id, donc
    // arriver jusqu'ici avec un User actif signifie soit qu'il est inactif,
    // soit que patient_id n'était pas peuplé — dans les deux cas le repli
    // email reste la seule option, d'où la résolution avant l'appel.
    const deleteFilter = await resolveLinkedUserFilter(patient);
    await Patient.findByIdAndDelete(patient._id);
    if (deleteFilter) {
      await User.deleteOne(deleteFilter);
    }
    await logAction({ utilisateur: req.user._id, action: 'DELETE', module: 'patients', entite_id: req.params.id, ip: req.ip, message: `Suppression : ${patient.nom} ${patient.prenom}` });
    res.json({ success: true, message: 'Patient supprimé.' });
  } catch (err) { next(err); }
};

// ── SEARCH ───────────────────────────────────────────────────────────────────
exports.search = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ success: true, patients: [] });
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patients = await Patient.find({
      $or: [
        { nom:            { $regex: escaped, $options: 'i' } },
        { prenom:         { $regex: escaped, $options: 'i' } },
        { numero_dossier: { $regex: escaped, $options: 'i' } },
        { telephone:      { $regex: escaped, $options: 'i' } },
      ],
    }).limit(10).select('nom prenom numero_dossier telephone date_naissance actif');
    res.json({ success: true, patients });
  } catch (err) { next(err); }
};

// ── UPLOAD PHOTO ──────────────────────────────────────────────────────────────
exports.uploadPhoto = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier reçu.' });

    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient introuvable.' });

    // Supprimer l'ancienne photo du disque si elle est hébergée sur le serveur
    if (patient.photo?.startsWith('/uploads/')) {
      const old = path.join(__dirname, '..', patient.photo);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }

    patient.photo = `/uploads/patients/${req.file.filename}`;
    await patient.save();

    res.json({ success: true, photo: patient.photo, patient });
  } catch (err) { next(err); }
};
