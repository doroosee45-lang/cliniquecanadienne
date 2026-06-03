const Consultation = require('../models/Consultation');
const { logAction, paginate } = require('../utils/helpers');

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, patient, medecin, statut } = req.query;
    const filter = {};
    if (patient) filter.patient = patient;
    if (medecin) filter.medecin = medecin;
    if (statut) filter.statut = statut;
    const total = await Consultation.countDocuments(filter);
    const consultations = await paginate(
      Consultation.find(filter)
        .populate('patient', 'nom prenom numero_dossier')
        .populate('medecin', 'nom prenom specialite')
        .sort('-date_consultation'),
      page, limit
    );
    res.json({ success: true, total, consultations });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const c = await Consultation.findById(req.params.id)
      .populate('patient')
      .populate('medecin', 'nom prenom specialite');
    if (!c) return res.status(404).json({ success: false, message: 'Consultation introuvable.' });
    res.json({ success: true, consultation: c });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const iaSuggestions = [];
    const sv = req.body.signes_vitaux || {};
    if (sv.temperature > 38.5) iaSuggestions.push({ diagnostic: 'Syndrome fébrile probable', confidence: 85 });
    if (sv.spo2 < 95) iaSuggestions.push({ diagnostic: 'Hypoxémie — évaluer insuffisance respiratoire', confidence: 78 });
    if (sv.tension_systolique > 140) iaSuggestions.push({ diagnostic: 'HTA — surveiller', confidence: 72 });
    if (sv.glycemie > 7) iaSuggestions.push({ diagnostic: 'Hyperglycémie — évaluer diabète', confidence: 69 });

    const consultation = await Consultation.create({ ...req.body, medecin: req.user._id, ia_suggestions: iaSuggestions });
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'consultations', entite_id: consultation._id, ip: req.ip });
    res.status(201).json({ success: true, consultation });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const consultation = await Consultation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!consultation) return res.status(404).json({ success: false, message: 'Consultation introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'consultations', entite_id: consultation._id, ip: req.ip });
    res.json({ success: true, consultation });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const c = await Consultation.findByIdAndDelete(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Consultation introuvable.' });
    res.json({ success: true, message: 'Consultation supprimée.' });
  } catch (err) { next(err); }
};
