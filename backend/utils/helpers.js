const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { emitTo } = require('./socket');
const { logger } = require('./logger');

const logAction = async ({ utilisateur, action, module, entite_id, ip, ua, avant, apres, message, statut = 'succes' }) => {
  try {
    await AuditLog.create({
      utilisateur,
      action,
      module,
      entite_id: entite_id?.toString(),
      ip_address: ip,
      user_agent: ua,
      donnees_avant: avant,
      donnees_apres: apres,
      message,
      statut,
    });
  } catch (e) {
    logger.error('Audit log error', { error: e.message, action, module });
  }
};

const createNotification = async ({ destinataire, type = 'info', titre, message, lien, priorite = 'normale' }) => {
  try {
    const notif = await Notification.create({ destinataire, type, titre, message, lien, priorite });
    // Push en temps réel vers la room privée de l'utilisateur destinataire
    emitTo(`user:${destinataire}`, 'notification:new', notif);
  } catch (e) {
    logger.error('Notification error', { error: e.message, destinataire, type });
  }
};

const sendTokenCookie = (user, statusCode, res) => {
  const token = user.getSignedJWT();
  const options = {
    expires: new Date(Date.now() + parseInt(process.env.JWT_COOKIE_EXPIRE || '7') * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // 'lax' est requis en développement avec le proxy Vite (localhost:5173 → :5000)
    // 'strict' bloque les cookies dans ce contexte cross-port
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  };
  res.status(statusCode).cookie('token', token, options).json({
    success: true,
    user: {
      _id: user._id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
      specialite: user.specialite,
      couleur_theme: user.couleur_theme,
      avatar: user.avatar,
      must_change_password: user.must_change_password || false,
    },
  });
};

const paginate = (query, page = 1, limit = 20) => {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  return query.skip(skip).limit(parseInt(limit));
};

// AUDIT-11 (audit complet post-Phase 10) — extrait de patients.controller.js
// (seul endroit qui l'avait, avant cette généralisation) : un terme de
// recherche utilisateur passé tel quel dans un $regex Mongo permet une
// construction de motif arbitraire (ReDoS via des motifs pathologiques du
// type (a+)+, ou des correspondances non voulues via des métacaractères
// comme . ou |). Échapper les métacaractères regex avant de construire le
// filtre, jamais interpréter l'entrée comme un motif.
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { logAction, createNotification, sendTokenCookie, paginate, escapeRegex };
