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
// Prérequis : serveur démarré (npm run dev).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5000/api';

async function serverReachable() {
  try { const r = await fetch(`${BASE}/health`); return r.ok; } catch { return false; }
}

test('un compte auto-inscrit via Google (rôle patient) n\'atteint aucune route professionnelle', async (t) => {
  if (!(await serverReachable())) {
    t.skip('serveur non démarré sur ' + BASE);
    return;
  }

  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');

  const email = '_google-autosignup-test@_test.local';
  await User.deleteOne({ email });
  // Reproduit exactement controllers/googleAuth.controller.js::googleLogin
  // pour un nouvel utilisateur : pas de mot de passe, role par défaut
  // 'patient', statut 'actif', aucune validation admin.
  const user = await User.create({
    email, googleId: 'fake-google-id-for-test', nom: 'Test', prenom: 'GoogleAuto',
    role: 'patient', statut: 'actif',
  });
  const cookie = `token=${user.getSignedJWT()}`;

  try {
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
    await User.findByIdAndDelete(user._id);
    await mongoose.disconnect();
  }
});
