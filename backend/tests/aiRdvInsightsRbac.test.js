// MODULE AI — sous-module Rendez-vous : preuve RBAC réelle (HTTP) pour
// GET /ai/rdv-insights. Un rôle non listé dans ai.routes.js ne doit
// jamais pouvoir appeler cet endpoint directement, même en connaissant
// l'URL — vérifié via une vraie requête HTTP contre un vrai serveur
// (mongod local isolé).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const PASSWORD = 'AiRdvRbacTestPass1!';
const FETCH_TIMEOUT_MS = 10000;
const withTimeout = (opts) => ({ ...opts, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

async function login(baseUrl, email) {
  const res = await fetch(`${baseUrl}/auth/login`, withTimeout({
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  }));
  if (res.status !== 200) throw new Error(`login ${email} a échoué (${res.status})`);
  return (res.headers.get('set-cookie') || '').split(';')[0];
}

test('AI/Rendez-vous — GET /ai/rdv-insights réellement protégé par rôle (serveur isolé, vraies requêtes HTTP)', { skip: !mongodExists() && 'mongod introuvable — infrastructure de serveur isolé indisponible' }, async (t) => {
  let server = null;
  let connected = false;
  const created = { users: [] };

  try {
    server = await startIsolatedServer();
    await mongoose.connect(server.mongoUri);
    connected = true;
    const User = require('../models/User');

    const stamp = Date.now();
    const adminclinique = await User.create({ email: `_airdv-admin-${stamp}@_test.local`, password: PASSWORD, nom: 'T', prenom: 'Admin', role: 'adminclinique', statut: 'actif' });
    created.users.push(adminclinique._id);
    const infirmier = await User.create({ email: `_airdv-inf-${stamp}@_test.local`, password: PASSWORD, nom: 'T', prenom: 'Inf', role: 'infirmier', statut: 'actif' });
    created.users.push(infirmier._id);

    await t.test('rôle autorisé (adminclinique) — requête acceptée (200)', async () => {
      const cookie = await login(server.baseUrl, adminclinique.email);
      const res = await fetch(`${server.baseUrl}/ai/rdv-insights`, withTimeout({ headers: { Cookie: cookie } }));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
    });

    await t.test('rôle non autorisé (infirmier) — appel direct de l\'API refusé (403)', async () => {
      const cookie = await login(server.baseUrl, infirmier.email);
      const res = await fetch(`${server.baseUrl}/ai/rdv-insights`, withTimeout({ headers: { Cookie: cookie } }));
      assert.equal(res.status, 403, 'un rôle non listé dans ai.routes.js doit être rejeté par le backend lui-même');
    });

    await t.test('non authentifié — appel direct sans cookie refusé (401)', async () => {
      const res = await fetch(`${server.baseUrl}/ai/rdv-insights`, withTimeout({}));
      assert.equal(res.status, 401);
    });
  } finally {
    for (const id of created.users) { try { await require('../models/User').findByIdAndDelete(id); } catch { /* nettoyage best-effort — jamais bloquant pour le test */ } }
    if (connected) await mongoose.disconnect();
    if (server) await server.stop();
  }
});
