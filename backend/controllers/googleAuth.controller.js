// controllers/googleAuth.controller.js
const User = require('../models/User');
const { sendTokenCookie } = require('../utils/helpers');

/**
 * POST /api/auth/google
 * Body : { access_token: string }
 */
const googleLogin = async (req, res) => {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({ success: false, message: 'access_token manquant.' });
    }

    // ── 1. Récupérer le profil Google ─────────────────────────────────────
    const googleRes = await fetch(
      `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${access_token}`
    );

    if (!googleRes.ok) {
      return res.status(401).json({ success: false, message: 'Token Google invalide ou expiré.' });
    }

    const profile = await googleRes.json();

    if (!profile.email) {
      return res.status(400).json({ success: false, message: 'Email Google non disponible.' });
    }

    // ── 2. Upsert ─────────────────────────────────────────────────────────
    let user = await User.findOne({ email: profile.email });

    if (!user) {
      // Nouveau compte via Google
      user = await User.create({
        nom:      profile.family_name || profile.name || 'Utilisateur',
        prenom:   profile.given_name  || '',
        email:    profile.email,
        googleId: profile.id,
        avatar:   profile.picture || '',
        role:     'patient',       // rôle par défaut
        statut:   'actif',
        // password non fourni → champ optionnel, pas de hash
      });
    } else {
      // Compte existant → lier Google si pas encore fait
      if (!user.googleId) {
        user.googleId = profile.id;
        if (!user.avatar) user.avatar = profile.picture || '';
        await user.save();
      }
    }

    // ── 3. Mise à jour dernière connexion ──────────────────────────────────
    user.derniere_connexion = new Date();
    await user.save();

    // ── 4. Cookie httpOnly + réponse — même helper que le login classique,
    //      pour un comportement (sameSite/secure/forme du payload) identique
    //      quel que soit le mode de connexion. Le JWT n'est jamais renvoyé
    //      dans le corps de la réponse (cf. correction Socket.IO).
    return sendTokenCookie(user, 200, res);

  } catch (err) {
    console.error('[googleLogin] Erreur :', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la connexion Google.' });
  }
};

module.exports = { googleLogin };