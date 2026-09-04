// SEC-004 / SEC-005 (audit indépendant du 4 sept. 2026) — GET
// /messages/directory (fuite d'annuaire interne : un patient authentifié
// pouvait lister noms/rôles/service de tout le personnel actif) et POST
// /messages / getOrCreate (un patient pouvait ouvrir une conversation avec
// n'importe quel userId, sans vérification de rôle ni de relation de soin)
// n'avaient aucune restriction de rôle. SEC-001 (Phase 0) avait déjà modifié
// messages.routes.js mais uniquement pour /patient-sms et /patient-email —
// vérifié par relecture avant d'agir : ces deux routes n'étaient pas
// concernées, restaient réellement ouvertes.
//
// Ce test tourne EXCLUSIVEMENT contre le serveur isolé (tests/helpers/
// isolatedServer.js — vrai server.js, vrai routeur, vrai middleware
// authorize()), via de vraies requêtes HTTP avec un vrai cookie de session
// obtenu par un vrai POST /auth/login.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const PASSWORD = 'SEC004005TestPass1!';
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

test('SEC-004/SEC-005 — /messages/directory et POST /messages refusent réellement le rôle patient (serveur isolé, vraie requête HTTP)', { skip: !mongodExists() && 'mongod introuvable — infrastructure de serveur isolé indisponible' }, async (t) => {
  let server = null;
  let connected = false;
  const created = { users: [] };

  try {
    server = await startIsolatedServer();
    await mongoose.connect(server.mongoUri);
    connected = true;
    const User = require('../models/User');

    const stamp = Date.now();
    const userPatient = await User.create({
      email: `_sec004-patient-${stamp}@_test.local`, password: PASSWORD,
      nom: 'Attaquant', prenom: 'Patient', role: 'patient', statut: 'actif',
    });
    created.users.push(userPatient._id);
    const userMedecin = await User.create({
      email: `_sec004-medecin-${stamp}@_test.local`, password: PASSWORD,
      nom: 'Test', prenom: 'Medecin', role: 'medecin', statut: 'actif',
    });
    created.users.push(userMedecin._id);
    const userCible = await User.create({
      email: `_sec004-cible-${stamp}@_test.local`, password: PASSWORD,
      nom: 'Cible', prenom: 'Personnel', role: 'infirmier', statut: 'actif',
    });
    created.users.push(userCible._id);

    const cookiePatient = await login(server.baseUrl, userPatient.email);
    const cookieMedecin = await login(server.baseUrl, userMedecin.email);

    await t.test('rôle patient → 403 réel sur GET /messages/directory (pas de fuite d\'annuaire)', async () => {
      const res = await fetch(`${server.baseUrl}/messages/directory`, withTimeout({
        headers: { Cookie: cookiePatient },
      }));
      assert.equal(res.status, 403, 'un compte role:patient ne doit plus recevoir la liste du personnel');
    });

    await t.test('rôle medecin (STAFF) → GET /messages/directory passe toujours (200, vraie liste)', async () => {
      const res = await fetch(`${server.baseUrl}/messages/directory`, withTimeout({
        headers: { Cookie: cookieMedecin },
      }));
      assert.equal(res.status, 200, 'un rôle professionnel ne doit jamais être bloqué par cette restriction');
      const body = await res.json();
      assert.ok(Array.isArray(body.users));
      assert.ok(body.users.some(u => u._id === String(userCible._id)), 'la vraie liste du personnel doit toujours être renvoyée à un rôle autorisé');
    });

    await t.test('rôle patient → 403 réel sur POST /messages (getOrCreate) — ne peut pas ouvrir de conversation arbitraire', async () => {
      const res = await fetch(`${server.baseUrl}/messages`, withTimeout({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookiePatient },
        body: JSON.stringify({ userId: userCible._id.toString() }),
      }));
      assert.equal(res.status, 403, 'un compte role:patient ne doit plus pouvoir ouvrir une conversation avec un userId arbitraire');

      const Conversation = require('../models/Conversation');
      const conv = await Conversation.findOne({ type: 'direct', membres: { $all: [userPatient._id, userCible._id] } });
      assert.equal(conv, null, 'aucune conversation ne doit avoir été créée en base suite à la tentative refusée');
    });

    await t.test('rôle medecin (STAFF) → POST /messages passe toujours (200, vraie conversation créée)', async () => {
      const res = await fetch(`${server.baseUrl}/messages`, withTimeout({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieMedecin },
        body: JSON.stringify({ userId: userCible._id.toString() }),
      }));
      assert.equal(res.status, 200, 'un rôle professionnel ne doit jamais être bloqué par cette restriction');
      const body = await res.json();
      assert.ok(body.conversation?._id);

      const Conversation = require('../models/Conversation');
      const conv = await Conversation.findById(body.conversation._id);
      assert.ok(conv, 'la conversation doit avoir été réellement persistée en base');
    });
  } finally {
    if (connected) {
      const User = require('../models/User');
      const Conversation = require('../models/Conversation');
      await Conversation.deleteMany({ membres: { $in: created.users } });
      await User.deleteMany({ _id: { $in: created.users } });
      await mongoose.disconnect();
    }
    if (server) await server.stop();
  }
});
