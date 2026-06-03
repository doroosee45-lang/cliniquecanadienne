const ImagingResult = require('../models/ImagingResult');
const ExamCatalogue = require('../models/ExamCatalogue');
const { logAction, paginate } = require('../utils/helpers');

exports.getCatalogue = async (req, res, next) => {
  try {
    const examens = await ExamCatalogue.find({ type: 'imagerie', statut: 'actif' }).sort('nom');
    res.json({ success: true, examens });
  } catch (err) { next(err); }
};

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, patient, statut, type_examen } = req.query;
    const filter = {};
    if (patient) filter.patient = patient;
    if (statut) filter.statut = statut;
    if (type_examen) filter.type_examen = type_examen;
    const total = await ImagingResult.countDocuments(filter);
    const results = await paginate(
      ImagingResult.find(filter)
        .populate('patient', 'nom prenom numero_dossier')
        .populate('medecin_prescripteur', 'nom prenom')
        .populate('radiologue', 'nom prenom')
        .sort('-date_prescription'),
      page, limit
    );
    res.json({ success: true, total, results });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const result = await ImagingResult.create({ ...req.body, medecin_prescripteur: req.user._id });
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'radiology', entite_id: result._id, ip: req.ip });
    res.status(201).json({ success: true, result });
  } catch (err) { next(err); }
};

exports.rapport = async (req, res, next) => {
  try {
    const { compte_rendu, conclusion, anomalie_detectee, ia_anomalie, ia_confidence, ia_details } = req.body;
    const result = await ImagingResult.findByIdAndUpdate(
      req.params.id,
      { compte_rendu, conclusion, anomalie_detectee, ia_anomalie, ia_confidence, ia_details,
        radiologue: req.user._id, date_rapport: new Date(), statut: 'rapporte' },
      { new: true }
    );
    if (!result) return res.status(404).json({ success: false, message: 'Résultat introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'RAPPORT', module: 'radiology', entite_id: result._id, ip: req.ip });
    res.json({ success: true, result });
  } catch (err) { next(err); }
};
