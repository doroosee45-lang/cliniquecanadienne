const Staff = require('../models/Staff');
const User = require('../models/User');
const { logAction, paginate } = require('../utils/helpers');

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, statut } = req.query;
    const filter = statut ? { statut } : {};
    const total = await Staff.countDocuments(filter);
    const staff = await paginate(
      Staff.find(filter)
        .populate('utilisateur', 'nom prenom role email telephone specialite')
        .populate('service', 'nom')
        .sort('statut'),
      page, limit
    );
    res.json({ success: true, total, staff });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const s = await Staff.findById(req.params.id)
      .populate('utilisateur', '-password')
      .populate('service', 'nom');
    if (!s) return res.status(404).json({ success: false, message: 'Personnel introuvable.' });
    res.json({ success: true, staff: s });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const staff = await Staff.create(req.body);
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'hr', entite_id: staff._id, ip: req.ip });
    res.status(201).json({ success: true, staff });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const staff = await Staff.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!staff) return res.status(404).json({ success: false, message: 'Personnel introuvable.' });
    res.json({ success: true, staff });
  } catch (err) { next(err); }
};

exports.leave = async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ success: false, message: 'Personnel introuvable.' });
    staff.conges.push({ ...req.body, statut: 'demande' });
    await staff.save();
    await logAction({ utilisateur: req.user._id, action: 'LEAVE_REQUEST', module: 'hr', entite_id: staff._id, ip: req.ip });
    res.json({ success: true, staff });
  } catch (err) { next(err); }
};
