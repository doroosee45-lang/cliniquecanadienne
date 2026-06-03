const crypto = require('crypto');
const User = require('../models/User');
const { logAction, sendTokenCookie } = require('../utils/helpers');
const { sendPasswordResetEmail } = require('../utils/mail');

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email et mot de passe requis.' });

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      await logAction({ action: 'LOGIN_ECHEC', module: 'auth', ip: req.ip, message: `Tentative échouée: ${email}`, statut: 'echec' });
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect.' });
    }
    if (user.statut !== 'actif')
      return res.status(403).json({ success: false, message: 'Compte inactif ou suspendu. Contactez l\'administrateur.' });

    user.derniere_connexion = new Date();
    await user.save({ validateBeforeSave: false });

    await logAction({ utilisateur: user._id, action: 'LOGIN', module: 'auth', ip: req.ip, ua: req.headers['user-agent'], message: `Connexion de ${user.email}` });
    sendTokenCookie(user, 200, res);
  } catch (err) { next(err); }
};

exports.logout = async (req, res) => {
  await logAction({ utilisateur: req.user._id, action: 'LOGOUT', module: 'auth', ip: req.ip, message: `Déconnexion de ${req.user.email}` });
  res.cookie('token', 'none', { expires: new Date(Date.now() + 10 * 1000), httpOnly: true })
     .json({ success: true, message: 'Déconnecté avec succès.' });
};

exports.me = async (req, res) => {
  res.json({ success: true, user: req.user });
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email requis.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    // Réponse identique que l'utilisateur existe ou non (sécurité)
    const MSG = 'Si cet email existe, un lien de réinitialisation a été envoyé.';

    if (!user) return res.json({ success: true, message: MSG });

    const token  = crypto.randomBytes(32).toString('hex');
    user.reset_password_token  = token;
    user.reset_password_expire = new Date(Date.now() + 60 * 60 * 1000); // 1 h
    await user.save({ validateBeforeSave: false });

    try {
      await sendPasswordResetEmail({ email: user.email, prenom: user.prenom, nom: user.nom, token });
    } catch (mailErr) {
      user.reset_password_token  = undefined;
      user.reset_password_expire = undefined;
      await user.save({ validateBeforeSave: false });
      console.error('[MAIL] Erreur envoi reset password:', mailErr.message);
    }

    await logAction({ utilisateur: user._id, action: 'FORGOT_PASSWORD', module: 'auth', ip: req.ip, message: `Demande reset mdp: ${user.email}` });
    res.json({ success: true, message: MSG });
  } catch (err) { next(err); }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6)
      return res.status(400).json({ success: false, message: 'Le mot de passe doit avoir au moins 6 caractères.' });

    const user = await User.findOne({
      reset_password_token:  token,
      reset_password_expire: { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ success: false, message: 'Lien de réinitialisation invalide ou expiré.' });

    user.password              = password;
    user.must_change_password  = false;
    user.reset_password_token  = undefined;
    user.reset_password_expire = undefined;
    await user.save();

    await logAction({ utilisateur: user._id, action: 'RESET_PASSWORD', module: 'auth', ip: req.ip, message: `Mot de passe réinitialisé: ${user.email}` });
    sendTokenCookie(user, 200, res);
  } catch (err) { next(err); }
};

exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword)))
      return res.status(401).json({ success: false, message: 'Mot de passe actuel incorrect.' });
    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit avoir au moins 6 caractères.' });
    user.password = newPassword;
    await user.save();
    await logAction({ utilisateur: user._id, action: 'UPDATE_PASSWORD', module: 'auth', ip: req.ip, message: 'Changement de mot de passe' });
    sendTokenCookie(user, 200, res);
  } catch (err) { next(err); }
};
