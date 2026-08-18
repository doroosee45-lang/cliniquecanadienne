const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logAction } = require('../utils/helpers');
const env = require('../config/env');

exports.protect = async (req, res, next) => {
  let token;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Accès non autorisé. Veuillez vous connecter.' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user || req.user.statut !== 'actif') {
      return res.status(401).json({ success: false, message: 'Utilisateur inactif ou introuvable.' });
    }
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token invalide ou expiré.' });
  }
};

exports.authorize = (...roles) => async (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    // R-09 — jusqu'ici ce refus n'était jamais journalisé : la règle "Accès
    // refusé" de audit.controller.js::getSuspects cherchait une action
    // ACCESS_DENIED qu'aucun code n'écrivait réellement en base.
    const module = (req.baseUrl || req.originalUrl || '').replace(/^\/api\/?/, '').split('/')[0] || 'inconnu';
    await logAction({
      utilisateur: req.user._id,
      action: 'ACCESS_DENIED',
      module,
      ip: req.ip,
      message: `Accès refusé — rôle "${req.user.role}" sur ${req.method} ${req.originalUrl}`,
      statut: 'echec',
    });
    return res.status(403).json({
      success: false,
      message: `Le rôle "${req.user.role}" n'est pas autorisé à accéder à cette ressource.`,
    });
  }
  next();
};
