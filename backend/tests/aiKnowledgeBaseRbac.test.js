// MODULE AI — "Base de connaissances" : preuve RBAC réelle (HTTP) pour
// GET /ai/knowledge-base. Un rôle non listé dans ai.routes.js ne doit
// jamais pouvoir appeler cet endpoint directement, même en connaissant
// l'URL — vérifié via une vraie requête HTTP contre un vrai serveur
// (mongod local isolé).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const PASSWORD = 'AiKbRbacTestPass1!';
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

test('AI/Base de connaissances — GET /ai/knowledge-base réellement protégé par rôle (serveur isolé, vraies requêtes HTTP)', { skip: !mongodExists() && 'mongod introuvable — infrastructure de serveur isolé indisponible' }, async (t) => {
  let server = null;
  let connected = false;
  const created = { users: [] };

  try {
    server = await startIsolatedServer();
    await mongoose.connect(server.mongoUri);
    connected = true;
    const User = require('../models/User');

    const stamp = Date.now();
    const medecin = await User.create({ email: `_aikb-medecin-${stamp}@_test.local`, password: PASSWORD, nom: 'T', prenom: 'Medecin', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);
    const pharmacien = await User.create({ email: `_aikb-pharma-${stamp}@_test.local`, password: PASSWORD, nom: 'T', prenom: 'Pharma', role: 'pharmacien', statut: 'actif' });
    created.users.push(pharmacien._id);

    await t.test('rôle autorisé (medecin) — requête acceptée (200)', async () => {
      const cookie = await login(server.baseUrl, medecin.email);
      const res = await fetch(`${server.baseUrl}/ai/knowledge-base`, withTimeout({ headers: { Cookie: cookie } }));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.total > 0, 'la base doit contenir de vraies références (interactions/symptômes au minimum)');
    });

    await t.test('rôle non autorisé (pharmacien) — appel direct de l\'API refusé (403)', async () => {
      const cookie = await login(server.baseUrl, pharmacien.email);
      const res = await fetch(`${server.baseUrl}/ai/knowledge-base`, withTimeout({ headers: { Cookie: cookie } }));
      assert.equal(res.status, 403, 'un rôle non listé dans ai.routes.js doit être rejeté par le backend lui-même');
    });

    await t.test('non authentifié — appel direct sans cookie refusé (401)', async () => {
      const res = await fetch(`${server.baseUrl}/ai/knowledge-base`, withTimeout({}));
      assert.equal(res.status, 401);
    });
  } finally {
    for (const id of created.users) { try { await require('../models/User').findByIdAndDelete(id); } catch { /* nettoyage best-effort — jamais bloquant pour le test */ } }
    if (connected) await mongoose.disconnect();
    if (server) await server.stop();
  }
});
