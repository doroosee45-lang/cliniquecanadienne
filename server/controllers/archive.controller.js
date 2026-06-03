const Document = require('../models/Document');
const { logAction, paginate } = require('../utils/helpers');

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, lifecycle_statut, type, patient } = req.query;
    const filter = {};
    if (lifecycle_statut) filter.lifecycle_statut = lifecycle_statut;
    if (type) filter.type = type;
    if (patient) filter.patient = patient;
    const total = await Document.countDocuments(filter);
    const docs = await paginate(
      Document.find(filter)
        .populate('patient', 'nom prenom')
        .populate('created_by', 'nom prenom')
        .sort('-createdAt'),
      page, limit
    );
    res.json({ success: true, total, documents: docs });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const doc = await Document.create({ ...req.body, created_by: req.user._id });
    await logAction({ utilisateur: req.user._id, action: 'ARCHIVE', module: 'archive', entite_id: doc._id, ip: req.ip, message: `Document archivé: ${doc.nom}` });
    res.status(201).json({ success: true, document: doc });
  } catch (err) { next(err); }
};

exports.updateLifecycle = async (req, res, next) => {
  try {
    const { lifecycle_statut } = req.body;
    const doc = await Document.findByIdAndUpdate(
      req.params.id,
      { lifecycle_statut, date_archivage: lifecycle_statut !== 'actif' ? new Date() : undefined },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Document introuvable.' });
    res.json({ success: true, document: doc });
  } catch (err) { next(err); }
};
