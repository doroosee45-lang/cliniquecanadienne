// MODULE AI — sous-module Laboratoire : preuve RBAC réelle (HTTP, pas
// seulement un contrôle frontend) pour GET /ai/lab-insights/:patientId.
// Un rôle non listé dans ai.routes.js (ex. 'receptionniste') ne doit
// jamais pouvoir appeler cet endpoint directement, même en connaissant
// l'URL — vérifié via une vraie requête HTTP contre un vrai serveur
// (mongod local isolé), pas un test interne au contrôleur qui
// contournerait le middleware réel.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const PASSWORD = 'AiLabRbacTestPass1!';
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

test('AI/Laboratoire — GET /ai/lab-insights/:patientId réellement protégé par rôle (serveur isolé, vraies requêtes HTTP)', { skip: !mongodExists() && 'mongod introuvable — infrastructure de serveur isolé indisponible' }, async (t) => {
  let server = null;
  let connected = false;
  const created = { users: [], patients: [] };

  try {
    server = await startIsolatedServer();
    await mongoose.connect(server.mongoUri);
    connected = true;
    const User = require('../models/User');
    const Patient = require('../models/Patient');

    const stamp = Date.now();
    const medecin = await User.create({ email: `_ailab-medecin-${stamp}@_test.local`, password: PASSWORD, nom: 'T', prenom: 'Medecin', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);
    const receptionniste = await User.create({ email: `_ailab-recep-${stamp}@_test.local`, password: PASSWORD, nom: 'T', prenom: 'Recep', role: 'receptionniste', statut: 'actif' });
    created.users.push(receptionniste._id);
    const patient = await Patient.create({ nom: `AILabRbac-${stamp}`, prenom: 'Synthetique', sexe: 'M', date_naissance: '1990-01-01' });
    created.patients.push(patient._id);

    await t.test('rôle autorisé (medecin) — requête acceptée (200)', async () => {
      const cookie = await login(server.baseUrl, medecin.email);
      const res = await fetch(`${server.baseUrl}/ai/lab-insights/${patient._id}`, withTimeout({ headers: { Cookie: cookie } }));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
    });

    await t.test('rôle non autorisé (receptionniste) — appel direct de l\'API refusé (403), jamais un 200 masqué côté frontend seulement', async () => {
      const cookie = await login(server.baseUrl, receptionniste.email);
      const res = await fetch(`${server.baseUrl}/ai/lab-insights/${patient._id}`, withTimeout({ headers: { Cookie: cookie } }));
      assert.equal(res.status, 403, 'un rôle non listé dans ai.routes.js doit être rejeté par le backend lui-même');
    });

    await t.test('non authentifié — appel direct sans cookie refusé (401)', async () => {
      const res = await fetch(`${server.baseUrl}/ai/lab-insights/${patient._id}`, withTimeout({}));
      assert.equal(res.status, 401);
    });
  } finally {
    for (const id of created.patients) { try { await require('../models/Patient').findByIdAndDelete(id); } catch { /* nettoyage best-effort — jamais bloquant pour le test */ } }
    for (const id of created.users) { try { await require('../models/User').findByIdAndDelete(id); } catch { /* nettoyage best-effort — jamais bloquant pour le test */ } }
    if (connected) await mongoose.disconnect();
    if (server) await server.stop();
  }
});
