const AuditLog = require('../models/AuditLog');
const { paginate } = require('../utils/helpers');

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, module, action, utilisateur } = req.query;
    const filter = {};
    if (module) filter.module = module;
    if (action) filter.action = action;
    if (utilisateur) filter.utilisateur = utilisateur;
    const total = await AuditLog.countDocuments(filter);
    const logs = await paginate(
      AuditLog.find(filter)
        .populate('utilisateur', 'nom prenom role')
        .sort('-createdAt'),
      page, limit
    );
    res.json({ success: true, total, logs });
  } catch (err) { next(err); }
};
