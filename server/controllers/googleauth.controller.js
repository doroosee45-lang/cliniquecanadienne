// controllers/googleAuth.controller.js
const User = require('../models/User');

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

    // ── 3. JWT via la méthode du modèle (getSignedJWT) ────────────────────
    const token = user.getSignedJWT();

    // ── 4. Cookie httpOnly (même comportement que login classique) ─────────
    res.cookie('token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   7 * 24 * 60 * 60 * 1000,
    });

    // ── 5. Mise à jour dernière connexion ─────────────────────────────────
    user.derniere_connexion = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      token,
      user: {
        id:     user._id,
        nom:    user.nom,
        prenom: user.prenom,
        email:  user.email,
        role:   user.role,
        avatar: user.avatar,
        statut: user.statut,
      },
    });

  } catch (err) {
    console.error('[googleLogin] Erreur :', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la connexion Google.' });
  }
};

module.exports = { googleLogin };