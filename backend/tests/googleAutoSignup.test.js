// Phase 2 §2 — Un compte créé automatiquement par googleAuth.controller.js
// (role:'patient', statut:'actif', pas de mot de passe, sans validation
// admin) peut-il atteindre une seule route professionnelle une fois le
// contrôle d'accès durci (Phase 1, commit d7a3d58) ? Vérifié en conditions
// réelles (HTTP), pas seulement en lecture de code.
//
// Un compte Google n'a pas de mot de passe, donc POST /auth/login ne
// fonctionne pas pour lui — le test reproduit exactement ce que fait le
// serveur après une authentification Google réussie (émission du JWT via
// User.getSignedJWT(), même méthode que googleAuth.controller.js) plutôt
// que de rejouer le handshake OAuth réel (nécessite un token Google
// authentique, impossible à obtenir dans un test automatisé).
//
// AUDIT-0 (gap "base de test indépendante") — dépendait jusqu'ici d'un
// serveur de développement ambiant (localhost:5000) déjà lancé et branché
// sur la MÊME base que ce test — coïncidence qui ne tient plus une fois les
// tests basculés sur un mongod local isolé (utils/run-tests-local-db.js).
// Démarre désormais sa propre instance dédiée (serveur + mongod isolé),
// comme accessMatrix.test.js.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

test('un compte auto-inscrit via Google (rôle patient) n\'atteint aucune route professionnelle', { skip: !mongodExists() && 'mongod introuvable — impossible de démarrer un serveur isolé pour ce test' }, async (t) => {
  const server = await startIsolatedServer();
  const BASE = server.baseUrl;
  let user;

  try {
    await mongoose.connect(server.mongoUri);
    const User = require('../models/User');

    const email = '_google-autosignup-test@_test.local';
    await User.deleteOne({ email });
    // Reproduit exactement controllers/googleAuth.controller.js::googleLogin
    // pour un nouvel utilisateur : pas de mot de passe, role par défaut
    // 'patient', statut 'actif', aucune validation admin.
    user = await User.create({
      email, googleId: 'fake-google-id-for-test', nom: 'Test', prenom: 'GoogleAuto',
      role: 'patient', statut: 'actif',
    });
    // AUDIT-0 (gap "base de test indépendante") — user.getSignedJWT() signe
    // avec le JWT_SECRET du process courant (chargé depuis le vrai .env),
    // pas celui du serveur isolé ci-dessus (délibérément différent, propre
    // à chaque instance) : le token serait rejeté (401 "Token invalide"),
    // jamais atteint le contrôle de rôle (403) que ce test veut vérifier.
    // Signé ici avec server.jwtSecret, exactement comme le ferait ce
    // serveur isolé.
    const token = jwt.sign({ id: user._id, role: user.role }, server.jwtSecret, { expiresIn: '1h' });
    const cookie = `token=${token}`;

    const PROFESSIONAL_ROUTES = [
      ['GET', '/chirurgie'],
      ['GET', '/prescriptions'],
      ['GET', '/laboratory'],
      ['GET', '/radiology'],
      ['GET', '/pharmacy'],
      ['GET', '/finance'],
      ['GET', '/patients'],       // dossiers de TOUS les patients — le risque le plus grave
      ['GET', '/hr/staff'],
      ['GET', '/settings/users'],
      ['GET', '/dashboard'],
    ];

    const leaks = [];
    for (const [method, path] of PROFESSIONAL_ROUTES) {
      const res = await fetch(`${BASE}${path}`, { method, headers: { Cookie: cookie } });
      if (res.status !== 403) leaks.push(`${method} ${path} → HTTP ${res.status} (attendu 403)`);
    }
    assert.deepEqual(leaks, [], `Un compte Google auto-inscrit (rôle patient) a atteint des routes professionnelles :\n${leaks.join('\n')}`);

    // Vérifie en parallèle qu'il garde bien son accès légitime au portail.
    const portalRes = await fetch(`${BASE}/portal/notifications`, { headers: { Cookie: cookie } });
    assert.notEqual(portalRes.status, 403, 'le compte doit conserver son accès normal au portail patient');
  } finally {
    if (user) await mongoose.model('User').findByIdAndDelete(user._id);
    await mongoose.disconnect();
    await server.stop();
  }
});
