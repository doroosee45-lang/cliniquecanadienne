// controllers/googleAuth.controller.js
const User = require('../models/User');
const Patient = require('../models/Patient');
const { sendTokenCookie, logAction } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');
const { OAuth2Client } = require('google-auth-library');
const { logger, captureException } = require('../utils/logger');
const env = require('../config/env');

// T3.2 — google-auth-library était déclarée en dépendance mais jamais
// utilisée : le contrôleur appelait directement l'endpoint userinfo avec le
// access_token reçu du frontend, ce qui valide bien l'authenticité du jeton
// (Google renvoie 401 si invalide) mais jamais son AUDIENCE — un access_token
// Google valide émis pour n'importe quelle autre application tierce était
// donc accepté ici aussi (risque de confused deputy). getTokenInfo() utilise
// l'endpoint officiel de vérification de jeton et permet de vérifier `aud`.
const oauthClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

// T3.1 — Un compte Google auto-inscrit (role:'patient') n'avait jusqu'ici
// jamais de dossier Patient associé : le portail répondait 404 dès la
// première connexion. Crée immédiatement un dossier minimal, marqué
// profil_a_completer (Google ne fournit ni date de naissance ni sexe — pas
// de valeur clinique inventée), et le lie via patient_id (T2.2).
// numero_dossier est généré automatiquement par le hook pre('save') du
// modèle (compteur atomique) — ne pas le fixer ici.
//
// AUDIT-M-C6 — ne vérifiait que user.patient_id (le lien du COMPTE), jamais
// si un dossier Patient existait déjà pour cette adresse email — un patient
// enregistré au guichet par le personnel (patients.controller.js::create,
// qui crée un Patient sans compte User associé) et se connectant ensuite
// pour la première fois via Google se voyait donc créer un SECOND dossier
// (celui-ci lié à son compte, l'original abandonné orphelin) plutôt que
// d'être lié à son dossier réel — sans jamais aucune trace d'audit. Réutilise
// la même vérification par email que patients.controller.js::create (pas
// une nouvelle convention isolée) : lie le dossier existant s'il y en a un,
// n'en crée un nouveau que si vraiment aucun n'existe. Trace d'audit
// systématique dans les deux branches (absente jusqu'ici).
// Limite connue et acceptée, pas un oubli (même pratique que l'hypothèse
// d'horloge du chantier élevé Point 4) : le Patient.findOne ci-dessous et le
// Patient.create plus bas ne forment pas une opération atomique unique. Deux
// connexions Google strictement simultanées pour une adresse email
// ENTIÈREMENT NOUVELLE (jamais vue ni côté User ni côté Patient) pourraient
// en théorie encore créer deux dossiers, chacune ne voyant l'autre ni au
// moment de son User.findOne ni de son Patient.findOne. Délibérément non
// rendu atomique ici : ce cas exige qu'une même personne déclenche deux
// tentatives de toute première inscription à la milliseconde près — sans
// commune mesure avec le scénario réel et déterministe corrigé ci-dessous
// (une simple première connexion sur un dossier déjà enregistré au guichet,
// qui se produit à chaque patient pré-inscrit, sans aucune concurrence
// requise). À rendre atomique séparément si ce cas résiduel devait un jour
// se matérialiser en pratique.
async function ensurePatientDossier(user, { ip } = {}) {
  if (user.role !== 'patient' || user.patient_id) return;

  const existing = user.email ? await Patient.findOne({ email: user.email.toLowerCase().trim() }) : null;
  if (existing) {
    user.patient_id = existing._id;
    await user.save();
    await logAction({ utilisateur: user._id, action: 'LINK_PATIENT_DOSSIER', module: 'auth', entite_id: existing._id, ip, message: `Auto-inscription Google liée au dossier patient existant (${existing.numero_dossier || existing._id}) plutôt que d'en créer un second` });
    // AUDIT-M-C8 (Point 8) — même pattern que patients.controller.js::create :
    // rendre cette liaison visible en temps réel pour le personnel (flux
    // d'activité + rafraîchissement dashboard), jusqu'ici invisible.
    emitActivity({ module: 'auth', action: 'Dossier patient lié (Google)', detail: `${user.prenom} ${user.nom} (${existing.numero_dossier || existing._id})`, icon: '🔗', userId: user._id, userName: `${user.prenom} ${user.nom}` });
    emitDashboardUpdate();
    return;
  }

  const patient = await Patient.create({
    nom: user.nom,
    prenom: user.prenom,
    email: user.email,
    actif: true,
    statut: 'actif',
    profil_a_completer: true,
  });
  user.patient_id = patient._id;
  await user.save();
  await logAction({ utilisateur: user._id, action: 'CREATE', module: 'auth', entite_id: patient._id, ip, message: `Dossier patient créé automatiquement à l'auto-inscription Google (${patient.numero_dossier || patient._id})` });
  // AUDIT-M-C8 (Point 8) — même pattern que patients.controller.js::create :
  // rendre cette création visible en temps réel pour le personnel (flux
  // d'activité + rafraîchissement dashboard), jusqu'ici invisible.
  emitActivity({ module: 'auth', action: 'Nouveau patient (auto-inscription Google)', detail: `${user.prenom} ${user.nom} (${patient.numero_dossier || patient._id})`, icon: '👤', userId: user._id, userName: `${user.prenom} ${user.nom}` });
  emitDashboardUpdate();
}

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
      await logAction({ action: 'LOGIN_ECHEC', module: 'auth', ip: req.ip, statut: 'echec', message: 'Google — jeton invalide ou expiré' });
      return res.status(401).json({ success: false, message: 'Token Google invalide ou expiré.' });
    }
    if (env.GOOGLE_CLIENT_ID && tokenInfo.aud !== env.GOOGLE_CLIENT_ID) {
      // AUDIT-ARCHIVAGE-C — signal confused deputy réel : un jeton Google
      // valide mais émis pour une autre application. tokenInfo est déjà
      // vérifié à ce stade (signature/émetteur/expiration), donc son email
      // est fiable même si l'audience est incorrecte — inclus dans le
      // message car c'est le seul signal exploitable ici (aucun User
      // résolu, ce n'est pas un compte de ce projet).
      await logAction({ action: 'LOGIN_ECHEC', module: 'auth', ip: req.ip, statut: 'echec', message: `Google — audience incorrecte (jeton émis pour une autre application), email : ${tokenInfo.email || '—'}` });
      return res.status(401).json({ success: false, message: 'Token Google invalide (audience incorrecte).' });
    }

    // ── 2. Récupérer le profil Google (nom/prénom/photo — non fournis par
    //      la vérification du jeton) ────────────────────────────────────────
    const googleRes = await fetch(
      `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${access_token}`
    );

    if (!googleRes.ok) {
      await logAction({ action: 'LOGIN_ECHEC', module: 'auth', ip: req.ip, statut: 'echec', message: 'Google — jeton invalide ou expiré (échec récupération profil)' });
      return res.status(401).json({ success: false, message: 'Token Google invalide ou expiré.' });
    }

    const profile = await googleRes.json();

    if (!profile.email) {
      await logAction({ action: 'LOGIN_ECHEC', module: 'auth', ip: req.ip, statut: 'echec', message: 'Google — profil sans email exploitable' });
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
      // AUDIT-ARCHIVAGE-C — évènement distinct de la connexion qui suit :
      // un nouveau compte vient d'être créé silencieusement, jamais tracé
      // jusqu'ici. Même action/module que settings.controller.js::createUser
      // pour rester dans la même catégorie d'audit qu'une création de
      // compte classique.
      await logAction({ utilisateur: user._id, action: 'CREATE_USER', module: 'admin', ip: req.ip, message: `Auto-inscription via Google : ${user.email}` });
    } else {
      // Compte existant → lier Google si pas encore fait
      if (!user.googleId) {
        user.googleId = profile.id;
        if (!user.avatar) user.avatar = profile.picture || '';
        await user.save();
      }
    }

    // ── 4. Dossier Patient (nouveau compte OU compte patient existant
    //      jamais lié — ex. créé avant ce correctif) ─────────────────────────
    await ensurePatientDossier(user, { ip: req.ip });

    // ── 5. Mise à jour dernière connexion ──────────────────────────────────
    user.derniere_connexion = new Date();
    await user.save();

    // ── 6. Traçabilité — même action que le login classique
    //      (auth.controller.js::login), pour que ces connexions atterrissent
    //      dans la même catégorie d'audit qu'une connexion par mot de passe.
    await logAction({ utilisateur: user._id, action: 'LOGIN', module: 'auth', ip: req.ip, message: `Connexion via Google : ${user.email}` });

    // ── 7. Cookie httpOnly + réponse — même helper que le login classique,
    //      pour un comportement (sameSite/secure/forme du payload) identique
    //      quel que soit le mode de connexion. Le JWT n'est jamais renvoyé
    //      dans le corps de la réponse (cf. correction Socket.IO).
    return sendTokenCookie(user, 200, res);

  } catch (err) {
    logger.error('[googleLogin] Erreur', { error: err.message, stack: err.stack });
    captureException(err, { controller: 'googleAuth.controller', action: 'googleLogin' });
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la connexion Google.' });
  }
};

module.exports = { googleLogin };