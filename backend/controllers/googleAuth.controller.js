// controllers/googleAuth.controller.js
const User = require('../models/User');
const { sendTokenCookie } = require('../utils/helpers');
const { OAuth2Client } = require('google-auth-library');

// T3.2 — google-auth-library était déclarée en dépendance mais jamais
// utilisée : le contrôleur appelait directement l'endpoint userinfo avec le
// access_token reçu du frontend, ce qui valide bien l'authenticité du jeton
// (Google renvoie 401 si invalide) mais jamais son AUDIENCE — un access_token
// Google valide émis pour n'importe quelle autre application tierce était
// donc accepté ici aussi (risque de confused deputy). getTokenInfo() utilise
// l'endpoint officiel de vérification de jeton et permet de vérifier `aud`.
const oauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

    // ── 1. Vérification officielle du jeton (signature/émetteur/expiration,
    //      via l'endpoint Google dédié) puis contrôle de l'audience ─────────
    let tokenInfo;
    try {
      tokenInfo = await oauthClient.getTokenInfo(access_token);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Token Google invalide ou expiré.' });
    }
    if (process.env.GOOGLE_CLIENT_ID && tokenInfo.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(401).json({ success: false, message: 'Token Google invalide (audience incorrecte).' });
    }

    // ── 2. Récupérer le profil Google (nom/prénom/photo — non fournis par
    //      la vérification du jeton) ────────────────────────────────────────
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

    // ── 3. Upsert ─────────────────────────────────────────────────────────
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

    // ── 4. Mise à jour dernière connexion ──────────────────────────────────
    user.derniere_connexion = new Date();
    await user.save();

    // ── 5. Cookie httpOnly + réponse — même helper que le login classique,
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