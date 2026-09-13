const crypto = require('crypto');
const User = require('../models/User');
const { logAction, sendTokenCookie } = require('../utils/helpers');
// AUDIT-C4 (ticket 0004) — namespace plutôt que destructuré (même convention
// que hr.controller.js/messages.controller.js/patients.controller.js) :
// nécessaire pour que les tests puissent stuber mail.sendPasswordResetEmail
// et reproduire un vrai échec d'envoi sans dépendre d'un réseau indisponible.
const mail = require('../utils/mail');
const { logger } = require('../utils/logger');

// T3.4 — verrouillage de compte après échecs répétés.
const MAX_TENTATIVES   = 5;
const VERROUILLAGE_MS  = 15 * 60 * 1000; // 15 min — aligné sur la fenêtre du rate-limiter réseau existant

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email et mot de passe requis.' });

    const user = await User.findOne({ email }).select('+password');

    // Verrou actif : refuse même avec le bon mot de passe, sans le vérifier.
    if (user?.verrouille_jusqu_a && user.verrouille_jusqu_a > new Date()) {
      await logAction({ utilisateur: user._id, action: 'LOGIN_ECHEC', module: 'auth', ip: req.ip, message: `Tentative sur compte verrouillé: ${email}`, statut: 'echec' });
      return res.status(423).json({
        success: false,
        message: `Compte temporairement verrouillé après ${MAX_TENTATIVES} échecs. Réessayez après ${user.verrouille_jusqu_a.toLocaleTimeString('fr-FR')}.`,
      });
    }

    if (!user || !(await user.matchPassword(password))) {
      if (user) {
        user.tentatives_echouees = (user.tentatives_echouees || 0) + 1;
        if (user.tentatives_echouees >= MAX_TENTATIVES) {
          user.verrouille_jusqu_a = new Date(Date.now() + VERROUILLAGE_MS);
        }
        await user.save({ validateBeforeSave: false });
      }
      await logAction({ action: 'LOGIN_ECHEC', module: 'auth', ip: req.ip, message: `Tentative échouée: ${email}`, statut: 'echec' });
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect.' });
    }
    if (user.statut !== 'actif')
      return res.status(403).json({ success: false, message: 'Compte inactif ou suspendu. Contactez l\'administrateur.' });

    // Connexion réussie : remet le compteur d'échecs à zéro.
    user.tentatives_echouees = 0;
    user.verrouille_jusqu_a  = null;
    user.derniere_connexion  = new Date();
    await user.save({ validateBeforeSave: false });

    await logAction({ utilisateur: user._id, action: 'LOGIN', module: 'auth', ip: req.ip, ua: req.headers['user-agent'], message: `Connexion de ${user.email}` });
    sendTokenCookie(user, 200, res);
  } catch (err) { next(err); }
};

// SEC-008 — logAction() (écriture AuditLog) n'était pas protégée : un rejet
// devenait une unhandledRejection non interceptée, que le gestionnaire
// global (server.js) traite en journalisant puis process.exit(1) — un
// simple échec de journalisation sur une déconnexion aurait ainsi fait
// crasher le process entier pour tous les utilisateurs connectés. Le cookie
// est effacé et la réponse envoyée normalement quand logAction réussit,
// comme avant.
exports.logout = async (req, res, next) => {
  try {
    await logAction({ utilisateur: req.user._id, action: 'LOGOUT', module: 'auth', ip: req.ip, message: `Déconnexion de ${req.user.email}` });
    res.cookie('token', 'none', { expires: new Date(Date.now() + 10 * 1000), httpOnly: true })
       .json({ success: true, message: 'Déconnecté avec succès.' });
  } catch (err) { next(err); }
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

    // SEC-006 — le token en clair était stocké tel quel en base
    // (reset_password_token) : une fuite de backup ou un accès DB compromis
    // exposait directement un token exploitable, sans même intercepter
    // l'e-mail. Seul le hash SHA-256 est persisté désormais ; le token en
    // clair (variable `token` ci-dessous) part toujours dans l'e-mail réel
    // envoyé à l'utilisateur, seul canal légitime pour le communiquer.
    // Expiration à 1h et usage unique (effacement après usage, plus bas)
    // inchangés.
    const token     = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    user.reset_password_token  = tokenHash;
    user.reset_password_expire = new Date(Date.now() + 60 * 60 * 1000); // 1 h
    await user.save({ validateBeforeSave: false });

    let mailSent = true;
    try {
      await mail.sendPasswordResetEmail({ email: user.email, prenom: user.prenom, nom: user.nom, token });
    } catch (mailErr) {
      mailSent = false;
      user.reset_password_token  = undefined;
      user.reset_password_expire = undefined;
      await user.save({ validateBeforeSave: false });
      logger.error('[MAIL] Erreur envoi reset password', { error: mailErr.message, email: user.email });
    }

    // AUDIT-C4 (ticket 0004) — l'échec d'envoi n'était visible que dans les
    // logs applicatifs (logger.error ci-dessus), jamais dans le journal
    // d'audit métier (AuditLog) que les administrateurs consultent
    // réellement — un token révoqué silencieusement passait donc inaperçu.
    // La réponse HTTP reste volontairement identique dans les deux cas
    // (anti-énumération de comptes, comportement correct à conserver) : seule
    // l'observabilité côté exploitant change ici.
    await logAction({
      utilisateur: user._id, action: 'FORGOT_PASSWORD', module: 'auth', ip: req.ip,
      message: mailSent
        ? `Demande reset mdp: ${user.email}`
        : `Demande reset mdp: ${user.email} — échec envoi email, token révoqué`,
      statut: mailSent ? 'succes' : 'echec',
    });
    res.json({ success: true, message: MSG });
  } catch (err) { next(err); }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6)
      return res.status(400).json({ success: false, message: 'Le mot de passe doit avoir au moins 6 caractères.' });

    // SEC-006 — le token reçu (en clair, depuis le lien de l'e-mail) est
    // hashé de la même façon qu'à la génération avant comparaison : jamais
    // de comparaison en clair contre la base, qui ne stocke que le hash.
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      reset_password_token:  tokenHash,
      reset_password_expire: { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ success: false, message: 'Lien de réinitialisation invalide ou expiré.' });

    user.password              = password;
    user.must_change_password  = false;
    user.reset_password_token  = undefined;
    user.reset_password_expire = undefined;
    // Une réinitialisation par lien e-mail prouve l'identité du titulaire —
    // lève un éventuel verrou T3.4 en cours.
    user.tentatives_echouees   = 0;
    user.verrouille_jusqu_a    = null;
    await user.save();

    await logAction({ utilisateur: user._id, action: 'RESET_PASSWORD', module: 'auth', ip: req.ip, message: `Mot de passe réinitialisé: ${user.email}` });
    // SEC-RESET-INACTIVE-BYPASS (13 sept. 2026, découvert en test navigateur
    // réel) — sendTokenCookie() était appelé sans jamais vérifier
    // user.statut, contrairement à exports.login ci-dessus (403 explicite si
    // statut !== 'actif') : un compte jamais activé, désactivé ou suspendu
    // pouvait obtenir une session pleinement authentifiée par ce seul
    // détour, sans jamais repasser par la vérification de statut du login
    // normal. Le mot de passe est bien changé dans tous les cas (ci-dessus,
    // inchangé) — seule l'auto-connexion est désormais soumise à la même
    // règle que login().
    if (user.statut !== 'actif') {
      return res.status(200).json({ success: true, message: 'Mot de passe réinitialisé. Ce compte n\'est pas actif — contactez l\'administrateur pour vous connecter.', autoLogin: false });
    }
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
    // AUDIT-C3 (ticket 0003, piste 3) — must_change_password était déjà
    // positionné à la création d'un compte staff (hr.controller.js) et
    // renvoyé par /auth/login et /auth/me, mais rien ne le remettait jamais
    // à false : cette route (seul point d'entrée générique de changement de
    // mot de passe, utilisé par le nouveau blocage frontend côté personnel)
    // ne le faisait pas, contrairement à portal.controller.js::changePassword
    // qui le fait déjà côté portail patient.
    user.must_change_password = false;
    await user.save();
    await logAction({ utilisateur: user._id, action: 'UPDATE_PASSWORD', module: 'auth', ip: req.ip, message: 'Changement de mot de passe' });
    sendTokenCookie(user, 200, res);
  } catch (err) { next(err); }
};
