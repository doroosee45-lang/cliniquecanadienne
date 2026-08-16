const crypto = require('crypto');
const path   = require('path');
const fs     = require('fs');
const bcrypt = require('bcryptjs');
const Patient = require('../models/Patient');
const User    = require('../models/User');
const { logAction, paginate, createNotification } = require('../utils/helpers');
const { sendActivationEmail } = require('../utils/mail');
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

const generateTempPassword = () => {
  const upper  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower  = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const all    = upper + lower + digits;
  const ri     = (max) => crypto.randomInt(max);
  let pwd = upper[ri(26)] + lower[ri(26)] + digits[ri(10)];
  for (let i = 3; i < 8; i++) pwd += all[ri(all.length)];
  // Fisher-Yates shuffle avec CSPRNG
  const arr = pwd.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
};

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

    // ② Génération mot de passe temporaire (crypté) + token d'activation
    const motDePasseClair = generateTempPassword();
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

    // ② bis — Création du compte User (role=patient) lié au dossier
    // Vérifie qu'un User avec ce mail n'existe pas déjà
    if (patient.email && !(await User.findOne({ email: patient.email }))) {
      await User.create({
        email:                patient.email,
        password:             motDePasseClair, // haché par le pre-save hook User
        nom:                  patient.nom,
        prenom:               patient.prenom,
        role:                 'patient',
        telephone:            patient.telephone || '',
        statut:               'inactif',       // activé lors du clic sur le lien
        must_change_password: true,
        patient_id:           patient._id,     // T2.2 — lien direct dossier ↔ compte
      });
    }

    // ③ Envoi email activation
    let emailEnvoye = false;
    if (patient.email) {
      try {
        await sendActivationEmail({
          email:      patient.email,
          prenom:     patient.prenom,
          nom:        patient.nom,
          token:      tokenActivation,
          motDePasse: motDePasseClair,
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

    // Le mot de passe temporaire en clair n'est renvoyé au front que si
    // l'email d'activation n'a pas pu être envoyé — sinon il transiterait
    // inutilement dans la réponse HTTP (logs, outils réseau) alors que le
    // canal de distribution prévu (email) a déjà fait son travail.
    res.status(201).json({
      success:           true,
      patient,
      email_envoye:      emailEnvoye,
      mot_de_passe_temp: emailEnvoye ? undefined : motDePasseClair,
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

    patient.actif                   = true;
    patient.token_activation        = undefined;
    patient.token_activation_expire = undefined;
    await patient.save();

    // Activer le compte User correspondant
    if (patient.email) {
      await User.findOneAndUpdate(
        { email: patient.email, role: 'patient' },
        { statut: 'actif' }
      );
    }

    await logAction({
      action:    'ACTIVATE',
      module:    'patients',
      entite_id: patient._id,
      ip:        req.ip,
      message:   `Compte patient activé : ${patient.nom} ${patient.prenom} (${patient.numero_dossier})`,
    });

    res.json({
      success:    true,
      message:    'Compte activé avec succès. Vous pouvez maintenant vous connecter.',
      patient_id: patient._id,
      prenom:     patient.prenom,
      nom:        patient.nom,
    });
  } catch (err) { next(err); }
};

// ── ACTIVATE DIRECT (admin, sans email) ──────────────────────────────────────
exports.activateAdmin = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient introuvable.' });

    patient.actif                   = true;
    patient.statut                  = 'actif';
    patient.token_activation        = undefined;
    patient.token_activation_expire = undefined;
    await patient.save();

    if (patient.email) {
      await User.findOneAndUpdate(
        { email: patient.email, role: 'patient' },
        { statut: 'actif' }
      );
    }

    await logAction({
      utilisateur: req.user._id,
      action:      'ACTIVATE_ADMIN',
      module:      'patients',
      entite_id:   patient._id,
      ip:          req.ip,
      message:     `Compte patient activé manuellement : ${patient.nom} ${patient.prenom} (${patient.numero_dossier}) par ${req.user.prenom} ${req.user.nom}`,
    });

    res.json({ success: true, patient, message: 'Compte patient activé directement.' });
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
      if (patient.email) {
        await User.findOneAndUpdate({ email: patient.email, role: 'patient' }, { statut: 'inactif' });
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
    await Patient.findByIdAndDelete(patient._id);
    if (patient.email) {
      await User.deleteOne({ email: patient.email, role: 'patient' });
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
