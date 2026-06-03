const Patient      = require('../models/Patient');
const Appointment  = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const LabResult    = require('../models/LabResult');
const ImagingResult= require('../models/ImagingResult');
const Invoice      = require('../models/Invoice');
const Notification = require('../models/Notification');
const User         = require('../models/User');
const { logAction } = require('../utils/helpers');

// Trouve le dossier patient lié au User connecté (par email)
const findPatient = (email) =>
  Patient.findOne({ email: email.toLowerCase().trim() });

// ── ME : profil + statistiques ────────────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user.email);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const [nbRdv, nbOrd, nbLabo, nbImag, nbFact, nbFactImpayees] = await Promise.all([
      Appointment.countDocuments({ patient: patient._id, statut: { $in: ['planifie','confirme'] } }),
      Prescription.countDocuments({ patient: patient._id, statut: 'active' }),
      LabResult.countDocuments({ patient: patient._id, statut: 'valide' }),
      ImagingResult.countDocuments({ patient: patient._id, statut: { $in: ['rapporte','valide'] } }),
      Invoice.countDocuments({ patient: patient._id }),
      Invoice.countDocuments({ patient: patient._id, statut: { $in: ['emise','partiellement_payee'] } }),
    ]);

    res.json({
      success: true,
      patient,
      must_change_password: req.user.must_change_password || false,
      stats: { nbRdv, nbOrd, nbLabo, nbImag, nbFact, nbFactImpayees },
    });
  } catch (err) { next(err); }
};

// ── RENDEZ-VOUS ───────────────────────────────────────────────────────────────
exports.getAppointments = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user.email);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const appointments = await Appointment.find({ patient: patient._id })
      .populate('medecin', 'nom prenom specialite')
      .populate('service', 'nom')
      .sort('-date_heure')
      .lean();
    res.json({ success: true, appointments });
  } catch (err) { next(err); }
};

// ── ORDONNANCES ───────────────────────────────────────────────────────────────
exports.getPrescriptions = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user.email);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const prescriptions = await Prescription.find({ patient: patient._id })
      .populate('medecin', 'nom prenom specialite')
      .populate('lignes.medicament', 'nom forme')
      .sort('-date_prescription')
      .lean();
    res.json({ success: true, prescriptions });
  } catch (err) { next(err); }
};

// ── RÉSULTATS LABORATOIRE ────────────────────────────────────────────────────
exports.getLabResults = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user.email);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const labResults = await LabResult.find({ patient: patient._id, statut: 'valide' })
      .populate('medecin_prescripteur', 'nom prenom specialite')
      .populate('examen', 'nom code categorie')
      .sort('-date_validation')
      .lean();
    res.json({ success: true, labResults });
  } catch (err) { next(err); }
};

// ── IMAGERIES ─────────────────────────────────────────────────────────────────
exports.getImaging = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user.email);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const imaging = await ImagingResult.find({ patient: patient._id, statut: { $in: ['rapporte','valide'] } })
      .populate('medecin_prescripteur', 'nom prenom')
      .populate('radiologue', 'nom prenom')
      .sort('-date_rapport')
      .lean();
    res.json({ success: true, imaging });
  } catch (err) { next(err); }
};

// ── FACTURES ──────────────────────────────────────────────────────────────────
exports.getInvoices = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user.email);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const invoices = await Invoice.find({ patient: patient._id })
      .sort('-date_facture')
      .lean();
    res.json({ success: true, invoices });
  } catch (err) { next(err); }
};

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ destinataire: req.user._id })
      .sort('-createdAt')
      .limit(50)
      .lean();
    res.json({ success: true, notifications });
  } catch (err) { next(err); }
};

// ── MARQUER NOTIFICATIONS LUES ────────────────────────────────────────────────
exports.markNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { destinataire: req.user._id, lu: false },
      { lu: true }
    );
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ── MODIFIER PROFIL ───────────────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user.email);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    // Champs modifiables par le patient lui-même
    const allowed = ['telephone', 'adresse', 'contact_urgence'];
    const update  = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    const updated = await Patient.findByIdAndUpdate(patient._id, update, { new: true, runValidators: true });

    // Sync téléphone dans User si modifié
    if (update.telephone) {
      await User.findOneAndUpdate({ email: req.user.email }, { telephone: update.telephone });
    }

    await logAction({
      utilisateur: req.user._id, action: 'UPDATE', module: 'portal',
      entite_id: patient._id, ip: req.ip,
      message: `Patient ${patient.nom} ${patient.prenom} a mis à jour son profil`,
    });

    res.json({ success: true, patient: updated });
  } catch (err) { next(err); }
};

// ── CHANGER MOT DE PASSE ──────────────────────────────────────────────────────
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });

    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword)))
      return res.status(401).json({ success: false, message: 'Mot de passe actuel incorrect.' });

    user.password             = newPassword;
    user.must_change_password = false;
    await user.save();

    await logAction({
      utilisateur: req.user._id, action: 'UPDATE_PASSWORD', module: 'portal',
      ip: req.ip, message: `Patient ${user.email} a changé son mot de passe`,
    });

    res.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
  } catch (err) { next(err); }
};
