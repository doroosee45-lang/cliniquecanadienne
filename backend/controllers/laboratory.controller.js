const LabResult = require('../models/LabResult');
const ExamCatalogue = require('../models/ExamCatalogue');
const { logAction, createNotification, paginate } = require('../utils/helpers');

exports.getCatalogue = async (req, res, next) => {
  try {
    const examens = await ExamCatalogue.find({ type: 'laboratoire', statut: 'actif' }).sort('nom');
    res.json({ success: true, examens });
  } catch (err) { next(err); }
};

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, patient, statut, critique } = req.query;
    const filter = {};
    if (patient) filter.patient = patient;
    if (statut) filter.statut = statut;
    if (critique !== undefined) filter.est_critique = critique === 'true';
    const total = await LabResult.countDocuments(filter);
    const results = await paginate(
      LabResult.find(filter)
        .populate('patient', 'nom prenom numero_dossier')
        .populate('medecin_prescripteur', 'nom prenom')
        .populate('examen', 'nom code')
        .sort('-date_prescription'),
      page, limit
    );
    res.json({ success: true, total, results });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const result = await LabResult.findById(req.params.id)
      .populate('patient')
      .populate('medecin_prescripteur', 'nom prenom')
      .populate('examen');
    if (!result) return res.status(404).json({ success: false, message: 'Résultat introuvable.' });
    res.json({ success: true, result });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const result = await LabResult.create({ ...req.body, medecin_prescripteur: req.user._id });
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'laboratory', entite_id: result._id, ip: req.ip });
    res.status(201).json({ success: true, result });
  } catch (err) { next(err); }
};

exports.validate = async (req, res, next) => {
  try {
    const { resultats, commentaires, est_critique, valeurs_critiques } = req.body;
    const result = await LabResult.findByIdAndUpdate(
      req.params.id,
      { resultats, commentaires, est_critique, valeurs_critiques, statut: 'valide', validateur: req.user._id, date_validation: new Date() },
      { new: true }
    ).populate('patient', 'nom prenom').populate('medecin_prescripteur', '_id');

    if (!result) return res.status(404).json({ success: false, message: 'Résultat introuvable.' });

    if (est_critique) {
      await createNotification({
        destinataire: result.medecin_prescripteur._id,
        type: 'critical',
        titre: `🚨 Résultat critique — ${result.patient.nom} ${result.patient.prenom}`,
        message: valeurs_critiques || 'Valeurs critiques détectées.',
        priorite: 'critique',
      });
    }
    await logAction({ utilisateur: req.user._id, action: 'VALIDATE', module: 'laboratory', entite_id: result._id, ip: req.ip, message: `Validation résultat${est_critique ? ' CRITIQUE' : ''}` });
    res.json({ success: true, result });
  } catch (err) { next(err); }
};

exports.acquit = async (req, res, next) => {
  try {
    const result = await LabResult.findByIdAndUpdate(
      req.params.id,
      { acquitte_par: req.user._id, acquitte_at: new Date() },
      { new: true }
    );
    if (!result) return res.status(404).json({ success: false, message: 'Résultat introuvable.' });
    res.json({ success: true, result });
  } catch (err) { next(err); }
};
