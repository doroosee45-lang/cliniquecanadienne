const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Patient = require('../models/Patient');
const User    = require('../models/User');
const { logAction, paginate, createNotification } = require('../utils/helpers');
const { sendActivationEmail } = require('../utils/mail');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');

// Génère un mot de passe temporaire : 8 car. avec maj, min, chiffre
const generateTempPassword = () => {
  const upper  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower  = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const all    = upper + lower + digits;
  let pwd = upper[Math.floor(Math.random() * 26)]
          + lower[Math.floor(Math.random() * 26)]
          + digits[Math.floor(Math.random() * 10)];
  for (let i = 3; i < 8; i++) pwd += all[Math.floor(Math.random() * all.length)];
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
};

// ── GET ALL ──────────────────────────────────────────────────────────────────
exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, q, statut } = req.query;
    const filter = {};
    if (statut) filter.statut = statut;
    if (q) filter.$text = { $search: q };

    const total    = await Patient.countDocuments(filter);
    const patients = await paginate(
      Patient.find(filter).populate('medecin_referent', 'nom prenom').sort('-createdAt'),
      page, limit
    );
    res.json({ success: true, total, count: patients.length, patients });
  } catch (err) { next(err); }
};

// ── GET ONE ──────────────────────────────────────────────────────────────────
exports.getOne = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .populate('medecin_referent', 'nom prenom specialite')
      .populate('cree_par', 'nom prenom role');
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
      existing = await Patient.findOne({
        nom:            { $regex: new RegExp(`^${req.body.nom.trim()}$`, 'i') },
        prenom:         { $regex: new RegExp(`^${req.body.prenom.trim()}$`, 'i') },
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

    res.status(201).json({
      success:       true,
      patient,
      email_envoye:  emailEnvoye,
      message:       emailEnvoye
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
    const patient = await Patient.findByIdAndDelete(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'DELETE', module: 'patients', entite_id: req.params.id, ip: req.ip, message: `Suppression : ${patient.nom} ${patient.prenom}` });
    res.json({ success: true, message: 'Patient supprimé.' });
  } catch (err) { next(err); }
};

// ── SEARCH ───────────────────────────────────────────────────────────────────
exports.search = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ success: true, patients: [] });
    const patients = await Patient.find({
      $or: [
        { nom:            { $regex: q, $options: 'i' } },
        { prenom:         { $regex: q, $options: 'i' } },
        { numero_dossier: { $regex: q, $options: 'i' } },
        { telephone:      { $regex: q, $options: 'i' } },
      ],
    }).limit(10).select('nom prenom numero_dossier telephone date_naissance actif');
    res.json({ success: true, patients });
  } catch (err) { next(err); }
};
