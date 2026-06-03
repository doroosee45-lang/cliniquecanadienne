const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');

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
    console.error('Audit log error:', e.message);
  }
};

const createNotification = async ({ destinataire, type = 'info', titre, message, lien, priorite = 'normale' }) => {
  try {
    await Notification.create({ destinataire, type, titre, message, lien, priorite });
  } catch (e) {
    console.error('Notification error:', e.message);
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
    token,
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

module.exports = { logAction, createNotification, sendTokenCookie, paginate };
