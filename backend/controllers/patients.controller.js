const crypto = require('crypto');
const path   = require('path');
const fs     = require('fs');
const bcrypt = require('bcryptjs');
const Patient = require('../models/Patient');
const User    = require('../models/User');
const { logAction, paginate, createNotification } = require('../utils/helpers');
const { CASCADE_TARGETS } = require('../utils/patientAnonymization');
const mail = require('../utils/mail');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');
const { logger } = require('../utils/logger');
const { storeUploadedFile } = require('../utils/fileStorage');
const cloudinaryUtil = require('../utils/cloudinary');
const { isObjectId } = require('../middleware/upload');

// R-08a — superadmin/adminclinique/medecin/infirmier/sage_femme voient le
// dossier complet ; les 5 autres rôles autorisés à lire /patients n'ont un
// besoin métier réel que des champs administratifs/démographiques liés à
// leur activité, jamais des champs cliniques (antecedents_medicaux,
// antecedents_familiaux, notes) — matrice validée avec l'utilisateur.
// null = aucune restriction (dossier complet).
// AUDIT-D2 (ticket 0002) — profil_a_completer ajouté : champ administratif
// (pas clinique), nécessaire pour que le badge "Profil à compléter" côté
// Patients.jsx/PatientDetail.jsx s'affiche aussi pour les rôles restreints
// (réceptionniste en particulier — c'est elle qui doit relancer le patient).
const DEMO_FIELDS = 'nom prenom numero_dossier date_naissance sexe telephone email photo adresse statut createdAt profil_a_completer';
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
    // AUDIT-FAIBLE-F1 — .lean() : aucun virtual/toJSON transform sur Patient
    // ni sur User (medecin_referent), vérifié exhaustivement (grep sur tout
    // backend/models/) — la réponse JSON envoyée reste strictement
    // identique, seul le coût d'hydratation Mongoose disparaît.
    let query = Patient.find(filter).sort('-createdAt').lean();
    if (fields) query = query.select(fields);
    if (!fields || fields.includes('medecin_referent')) query = query.populate('medecin_referent', 'nom prenom');

    // PERF-001 (audit de performance du 12 sept. 2026) — countDocuments et
    // find étaient attendus l'un après l'autre alors qu'ils sont
    // indépendants (aucun ne dépend du résultat de l'autre) : un aller-
    // retour réseau complet vers MongoDB gagné en les exécutant en
    // parallèle, mesuré réellement sur GET /appointments (même correctif,
    // appointments.controller.js::getAll) avant de le généraliser ici.
    const [total, patients] = await Promise.all([
      Patient.countDocuments(filter),
      paginate(query, page, limit),
    ]);
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

    // AUDIT-FAIBLE-H5 — l'étalement de req.body ci-dessous laissait passer
    // tout champ non prévu du schéma (ex. statut:'decede' sur un patient
    // fraîchement créé) : incohérent avec update() (même fichier, plus
    // bas), qui filtre déjà req.body via PATIENT_BLOCKED_FIELDS. Réutilisé
    // ici tel quel — alignement de create() sur update(), pas un
    // durcissement nouveau de PATIENT_BLOCKED_FIELDS lui-même.
    // medecin_referent/anonymise* restent volontairement non filtrés, pour
    // rester cohérent avec update() qui ne les bloque pas non plus —
    // candidat pour un point distinct si on choisit un jour de les ajouter
    // aux deux fonctions.
    const bodyData = {};
    for (const [k, v] of Object.entries(req.body)) { if (!PATIENT_BLOCKED_FIELDS.includes(k)) bodyData[k] = v; }

    const patientData = {
      ...bodyData,
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
    //
    // DASHBOARD-VIDE-001 (13 sept. 2026) — si un User existait déjà pour cet
    // email (ex. auto-inscription Google antérieure jamais liée, ou tout
    // autre compte préexistant), ce bloc se contentait jusqu'ici de ne rien
    // faire silencieusement : le compte restait sans patient_id, dépendant
    // indéfiniment du repli par correspondance d'email de portal.controller.
    // js::findPatient (fragile — un email différent, un espace parasite ou
    // une casse différente entre les deux documents suffit à le casser).
    // Lie désormais ce compte existant au dossier qui vient d'être créé
    // lorsqu'il n'a pas déjà de patient_id — jamais n'écrase un patient_id
    // déjà présent (pourrait légitimement pointer ailleurs).
    if (patient.email) {
      const existingUser = await User.findOne({ email: patient.email });
      if (!existingUser) {
        await User.create({
          email:                patient.email,
          nom:                  patient.nom,
          prenom:               patient.prenom,
          role:                 'patient',
          telephone:            patient.telephone || '',
          statut:               'inactif',       // activé lors du clic sur le lien
          patient_id:           patient._id,     // T2.2 — lien direct dossier ↔ compte
        });
      } else if (!existingUser.patient_id) {
        existingUser.patient_id = patient._id;
        await existingUser.save();
        await logAction({
          utilisateur: req.user._id, action: 'LINK_PATIENT_DOSSIER', module: 'patients',
          entite_id: patient._id,
          message: `Compte existant ${existingUser.email} sans patient_id lié au nouveau dossier patient (${patient.numero_dossier}) plutôt que laissé sans lien`,
        });
      }
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
        logger.error('[MAIL ERROR] Échec envoi email patient', { error: mailErr.message });
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
    // AUDIT-PHASE4-G2 — route publique (pas de req.user, le patient agit
    // pour lui-même) : acteur = le compte User qui vient de s'activer, même
    // pattern que googleAuth.controller.js::ensurePatientDossier (Point 8).
    emitActivity({ module: 'patients', action: 'Compte patient activé', detail: `${patient.prenom} ${patient.nom} (${patient.numero_dossier})`, icon: '🔓', userId: user._id, userName: `${user.prenom} ${user.nom}` });
    emitDashboardUpdate();

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
// PATIENT-ACTIVATION-002 (audit du 12 sept. 2026) — un patient sans
// smartphone/accès email ne peut suivre aucun lien d'activation (le seul
// mécanisme réel jusqu'ici, R-08b) : il n'avait donc, en pratique, jamais
// moyen de se connecter au portail. Ajout d'un second mode explicite,
// déclenché uniquement à la demande du personnel (jamais automatique) :
// `numero_dossier` définit directement le mot de passe du compte lié sur le
// numero_dossier réel du patient (déjà unique, déjà conforme au validateur
// de complexité de User.password — majuscule+chiffre, ex. "CLIN-2026-00001")
// et force must_change_password, réutilisant exactement le mécanisme déjà
// existant (Login.jsx / Portal.jsx affichent déjà la modale de changement
// obligatoire — AuthContext le lit sur /auth/me, aucune nouvelle UI requise
// pour cette partie). Le mode par lien email (défaut, sans body.methode)
// reste strictement inchangé.
exports.activateAdmin = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient introuvable.' });

    const viaNumeroDossier = req.body?.methode === 'numero_dossier';
    // Le mode numero_dossier définit un mot de passe sur un compte User lié —
    // il exige donc un email (seul moyen d'avoir un compte lié, cf. create()).
    // Le mode par défaut (lien email / dossier sans email du tout) reste lui
    // inchangé : un patient sans email n'a jamais eu de compte portail à
    // activer, mais son DOSSIER (patient.actif/statut) doit toujours pouvoir
    // être marqué actif administrativement (comportement préexistant).
    if (viaNumeroDossier && !patient.email) {
      return res.status(400).json({ success: false, message: "Ce patient n'a pas d'adresse email — aucun compte portail n'est associé à ce dossier." });
    }

    patient.actif  = true;
    patient.statut = 'actif';

    let lienRenvoye = false;
    let motDePasseDefini = false;
    const user = patient.email
      ? await User.findOne({ email: patient.email, role: 'patient' }).select('+password')
      : null;
    if (!user && viaNumeroDossier) {
      return res.status(404).json({ success: false, message: 'Compte utilisateur introuvable pour ce dossier — impossible de définir un mot de passe.' });
    }
    if (user) {
      user.statut = 'actif';
      if (viaNumeroDossier) {
        // Numéro de dossier réel du patient, jamais un mot de passe
        // fabriqué ou générique — identique à ce que la réception peut lire
        // et transmettre de vive voix/sur papier à un patient sans moyen
        // de suivre un lien.
        user.password             = patient.numero_dossier;
        user.must_change_password = true;
        patient.token_activation        = undefined;
        patient.token_activation_expire = undefined;
        motDePasseDefini = true;
      } else if (!user.password) {
        // R-08b — dossier activé tout de suite pour le staff, mais si ce
        // compte n'a encore aucun mot de passe utilisable, "actif" et
        // "peut se connecter au portail" restent deux états distincts :
        // on renvoie un nouveau lien plutôt que de régénérer un mot de
        // passe temporaire (ce que R-08b cherche justement à éliminer).
        const tokenActivation = crypto.randomBytes(32).toString('hex');
        patient.token_activation        = tokenActivation;
        patient.token_activation_expire = new Date(Date.now() + 24 * 60 * 60 * 1000);
        try {
          await mail.sendActivationEmail({ email: patient.email, prenom: patient.prenom, nom: patient.nom, token: tokenActivation });
          lienRenvoye = true;
        } catch (mailErr) {
          logger.error('[MAIL ERROR] Échec envoi email patient', { error: mailErr.message });
        }
      } else {
        patient.token_activation        = undefined;
        patient.token_activation_expire = undefined;
      }
      await user.save();
    }
    await patient.save();

    await logAction({
      utilisateur: req.user._id,
      action:      'ACTIVATE_ADMIN',
      module:      'patients',
      entite_id:   patient._id,
      ip:          req.ip,
      message:     `Compte patient activé manuellement : ${patient.nom} ${patient.prenom} (${patient.numero_dossier}) par ${req.user.prenom} ${req.user.nom}${motDePasseDefini ? ' — mot de passe initial défini sur le numéro de dossier (sans smartphone)' : (lienRenvoye ? ' — nouveau lien envoyé (pas encore de mot de passe)' : '')}`,
    });
    emitActivity({ module: 'patients', action: 'Compte patient activé (admin)', detail: `${patient.prenom} ${patient.nom} (${patient.numero_dossier})`, icon: '✅', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();

    res.json({
      success: true,
      patient,
      lien_renvoye: lienRenvoye,
      mot_de_passe_defini: motDePasseDefini,
      message: motDePasseDefini
        ? `Compte activé — mot de passe initial défini sur le numéro de dossier (${patient.numero_dossier}). Le patient devra le changer à sa première connexion.`
        : (lienRenvoye
          ? 'Dossier activé. Le patient n\'a pas encore de mot de passe — un nouveau lien d\'activation lui a été envoyé.'
          : 'Compte patient activé directement.'),
    });
  } catch (err) {
    if (err.name === 'ValidationError' && err.errors?.password) {
      return res.status(400).json({ success: false, message: err.errors.password.message });
    }
    next(err);
  }
};

// AUDIT-P2-1 (constat original) — actif/token_activation* sont gérés par
// le circuit d'activation dédié (activate/setPasswordAndActivate/
// activateAdmin) ; les laisser passer par cette édition générique
// permettrait à médecin/infirmier/réceptionniste (CAN_WRITE) de forcer
// l'activation d'un compte portail en contournant ce circuit. statut et
// cree_par ne doivent pas non plus être réassignables ici.
const PATIENT_BLOCKED_FIELDS = ['numero_dossier', 'actif', 'token_activation', 'token_activation_expire', 'statut', 'cree_par', 'ip_creation'];

// ── UPDATE ───────────────────────────────────────────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const avant   = await Patient.findById(req.params.id);
    const data = {};
    for (const [k, v] of Object.entries(req.body)) { if (!PATIENT_BLOCKED_FIELDS.includes(k)) data[k] = v; }
    const patient = await Patient.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'patients', entite_id: patient._id, ip: req.ip, avant, apres: patient });
    // AUDIT-PHASE4-G2 — dashboard:refresh seul (pas emitActivity, comme
    // consultations.controller.js::update/appointments.controller.js::update
    // hors changement de statut) : une modification de champs administratifs
    // routinière n'a pas sa place dans le flux d'activité clinique, mais la
    // liste des patients doit rester à jour pour les autres utilisateurs
    // connectés.
    emitDashboardUpdate();
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

    // AUDIT-CRIT-3 — un patient occupant ACTUELLEMENT un lit (Room.lits.
    // patient_actuel) n'est pas un cas d'« historique » comme les autres
    // ci-dessous : c'est un état live. hospitalization.controller.js::
    // discharge() libère déjà correctement le lit ($unset patient_actuel) —
    // arriver ici avec un lit encore occupé signifie qu'aucune sortie
    // d'hospitalisation n'a été faite. On refuse donc toute action (ni
    // suppression, ni désactivation silencieuse) tant que ce n'est pas
    // résolu par le workflow clinique normal, plutôt que de risquer de
    // désactiver un compte pendant qu'un patient est physiquement
    // hospitalisé. Vérifié séparément et en premier, avant le bucket
    // générique ci-dessous (Room figure bien dans CASCADE_TARGETS pour
    // l'anonymisation, mais ce cas précis a besoin d'un refus dédié, pas
    // d'une simple désactivation silencieuse).
    const Room = require('../models/Room');
    const occupieUnLit = await Room.countDocuments({ 'lits.patient_actuel': patient._id });
    if (occupieUnLit > 0) {
      await logAction({ utilisateur: req.user._id, action: 'DELETE', module: 'patients', entite_id: patient._id, ip: req.ip, statut: 'echec', message: `Suppression/désactivation refusée : ${patient.nom} ${patient.prenom} occupe actuellement un lit.` });
      return res.status(409).json({ success: false, message: 'Ce patient occupe actuellement un lit — une sortie d\'hospitalisation est requise avant toute suppression ou désactivation du dossier.' });
    }

    // Un dossier patient possédant le moindre historique clinique/financier
    // ne doit jamais être supprimé physiquement : obligation de conservation
    // du dossier médical, et ça laisserait des références orphelines. On
    // désactive le dossier à la place (statut='inactif', actif=false).
    // AUDIT-2.2 — cette liste ne couvrait jusqu'ici que 5 modèles
    // (Appointment, Consultation, Hospitalization, Invoice, Prescription),
    // oubliant chirurgie/urgences/maternité/laboratoire/imagerie/archive : un
    // patient ayant uniquement l'un de ces dossiers pouvait être supprimé
    // physiquement, laissant une référence orpheline. Alignée sur
    // CASCADE_TARGETS (utils/patientAnonymization.js) — inventaire déjà le
    // plus complet du projet pour ce besoin — complétée des 4 modèles qui n'y
    // figurent pas (Invoice y figure déjà, non dupliqué ici).
    // CLIN-09 (correction du 12 sept. 2026, audit indépendant) — cette
    // liste dupliquait manuellement 9 des modèles déjà présents dans
    // CASCADE_TARGETS (utils/patientAnonymization.js, inventaire déjà le
    // plus complet du projet des modèles référençant réellement Patient),
    // PUIS re-listait CASCADE_TARGETS en entier via spread : ces 9 modèles
    // étaient donc comptés deux fois (sans changer le résultat booléen
    // `hasHistory`, mais doublant inutilement les requêtes, et exactement
    // le genre de dérive qu'une liste maintenue à la main à deux endroits
    // finit par produire). Dérivée désormais directement de CASCADE_TARGETS
    // — source unique — en excluant seulement Room (refus dédié ci-dessus,
    // plus strict qu'une simple désactivation, cf. commentaire).
    const HISTORY_CHECKS = CASCADE_TARGETS.filter(({ model }) => model !== require('../models/Room'));
    const counts = await Promise.all(
      HISTORY_CHECKS.map(({ model, refField }) => model.countDocuments({ [refField]: patient._id }))
    );
    const hasHistory = counts.some(n => n > 0);

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
      emitActivity({ module: 'patients', action: 'Dossier patient désactivé', detail: `${patient.prenom} ${patient.nom} (${patient.numero_dossier})`, icon: '🚫', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
      emitDashboardUpdate();
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
    // AUDIT-ARCHIVAGE-A1 — Patient.pre('findOneAndDelete') (models/Patient.js)
    // peut refuser cette suppression (409, compte portail actif référençant
    // encore ce patient) : le hook n'a pas accès à req.user/req.ip pour
    // tracer lui-même le refus, donc il est capturé ici, seul endroit du
    // chemin HTTP à disposer du contexte complet.
    try {
      await Patient.findByIdAndDelete(patient._id);
    } catch (err) {
      await logAction({ utilisateur: req.user._id, action: 'DELETE', module: 'patients', entite_id: req.params.id, ip: req.ip, statut: 'echec', message: `Suppression refusée : ${patient.nom} ${patient.prenom} — ${err.message}` });
      throw err;
    }
    if (deleteFilter) {
      await User.deleteOne(deleteFilter);
    }
    await logAction({ utilisateur: req.user._id, action: 'DELETE', module: 'patients', entite_id: req.params.id, ip: req.ip, message: `Suppression : ${patient.nom} ${patient.prenom}` });
    emitActivity({ module: 'patients', action: 'Dossier patient supprimé', detail: `${patient.prenom} ${patient.nom} (${patient.numero_dossier})`, icon: '🗑️', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();
    res.json({ success: true, message: 'Patient supprimé.' });
  } catch (err) { next(err); }
};

// T9.13 — anonymisation, alternative à la suppression physique. Contrairement
// à la désactivation ci-dessus (remove(), qui ne touche que le Patient et le
// compte User), anonymize() scrube aussi les copies d'identité dupliquées
// dans les 14 collections liées (voir utils/patientAnonymization.js pour le
// détail complet de la procédure et son raisonnement).
exports.anonymize = async (req, res, next) => {
  try {
    const { anonymizePatient } = require('../utils/patientAnonymization');
    const result = await anonymizePatient(req.params.id, { utilisateur: req.user._id, ip: req.ip });
    res.json({ success: true, ...result });
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
    }).limit(10).select('nom prenom numero_dossier telephone email date_naissance actif');
    res.json({ success: true, patients });
  } catch (err) { next(err); }
};

// ── UPLOAD PHOTO ──────────────────────────────────────────────────────────────
exports.uploadPhoto = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier reçu.' });
    // AUDIT-3.5 (SEC-02) — validé avant toute construction de nom de fichier
    // (repli disque local de storeUploadedFile inclus), voir middleware/upload.js.
    if (!isObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Identifiant patient invalide.' });

    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient introuvable.' });
    const ancienPhoto = patient.photo;
    const ancienPublicId = patient.photo_public_id;

    // MIGRATION-CLOUDINARY — supprime l'ancienne photo (Cloudinary via son
    // public_id, ou disque local pour une photo antérieure à cette
    // migration) avant d'enregistrer la nouvelle, même comportement de
    // nettoyage qu'avant cette migration.
    if (ancienPublicId) {
      await cloudinaryUtil.destroy(ancienPublicId).catch((err) => {
        logger.error('[UPLOAD] Échec de suppression de l\'ancienne photo Cloudinary (nouvel upload déjà réussi)', { public_id: ancienPublicId, error: err.message });
      });
    } else if (patient.photo?.startsWith('/uploads/')) {
      const old = path.join(__dirname, '..', patient.photo);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }

    const { url, public_id } = await storeUploadedFile(req.file, { folder: 'patients', filenameBase: `patient-${req.params.id}-${Date.now()}` });
    patient.photo = url;
    patient.photo_public_id = public_id;
    await patient.save();
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'patients', entite_id: patient._id, ip: req.ip, avant: { photo: ancienPhoto }, apres: { photo: patient.photo }, message: 'Photo mise à jour' });
    // AUDIT-PHASE4-G2 — dashboard:refresh seul : une photo mise à jour doit
    // rester visible pour les autres utilisateurs connectés, mais ce n'est
    // pas un événement digne du flux d'activité clinique (pas d'emitActivity).
    emitDashboardUpdate();

    res.json({ success: true, photo: patient.photo, patient });
  } catch (err) { next(err); }
};
