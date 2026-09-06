// SEC-010 (audit indépendant du 6 sept. 2026) — POST /messages/groups
// (createGroup) n'avait aucune restriction de rôle, contrairement à
// POST /messages (getOrCreate) déjà corrigé par SEC-005 : createGroup()
// accepte un tableau `membres` d'IDs arbitraires venus du client sans
// aucune vérification de relation, donc n'importe quel compte authentifié
// — y compris role:'patient' — pouvait créer un groupe avec n'importe quel
// autre utilisateur en devinant/énumérant un userId.
//
// Ce test tourne EXCLUSIVEMENT contre le serveur isolé (tests/helpers/
// isolatedServer.js — vrai server.js, vrai routeur, vrai middleware
// authorize()), via de vraies requêtes HTTP avec un vrai cookie de session
// obtenu par un vrai POST /auth/login. Même méthode que
// auditSEC004-005MessagesDirectoryGetOrCreate.test.js.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const PASSWORD = 'SEC010TestPass1!';
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

test('SEC-010 — POST /messages/groups refuse réellement le rôle patient, laisse passer le personnel (serveur isolé, vraie requête HTTP)', { skip: !mongodExists() && 'mongod introuvable — infrastructure de serveur isolé indisponible' }, async (t) => {
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
      email: `_sec010-patient-${stamp}@_test.local`, password: PASSWORD,
      nom: 'Attaquant', prenom: 'Patient', role: 'patient', statut: 'actif',
    });
    created.users.push(userPatient._id);
    const userMedecin = await User.create({
      email: `_sec010-medecin-${stamp}@_test.local`, password: PASSWORD,
      nom: 'Test', prenom: 'Medecin', role: 'medecin', statut: 'actif',
    });
    created.users.push(userMedecin._id);
    const userCible = await User.create({
      email: `_sec010-cible-${stamp}@_test.local`, password: PASSWORD,
      nom: 'Cible', prenom: 'Personnel', role: 'infirmier', statut: 'actif',
    });
    created.users.push(userCible._id);

    const cookiePatient = await login(server.baseUrl, userPatient.email);
    const cookieMedecin = await login(server.baseUrl, userMedecin.email);

    await t.test('rôle patient → 403 réel sur POST /messages/groups — ne peut pas créer de groupe arbitraire', async () => {
      const res = await fetch(`${server.baseUrl}/messages/groups`, withTimeout({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookiePatient },
        body: JSON.stringify({ nom: `Groupe attaque ${stamp}`, membres: [userCible._id.toString()] }),
      }));
      assert.equal(res.status, 403, 'un compte role:patient ne doit plus pouvoir créer un groupe avec un userId arbitraire');

      const Conversation = require('../models/Conversation');
      const conv = await Conversation.findOne({ type: 'groupe', nom: `Groupe attaque ${stamp}` });
      assert.equal(conv, null, 'aucun groupe ne doit avoir été créé en base suite à la tentative refusée');
    });

    await t.test('rôle medecin (STAFF) → POST /messages/groups passe toujours (201, vrai groupe créé)', async () => {
      const res = await fetch(`${server.baseUrl}/messages/groups`, withTimeout({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieMedecin },
        body: JSON.stringify({ nom: `Groupe légitime ${stamp}`, membres: [userCible._id.toString()] }),
      }));
      assert.equal(res.status, 201, 'un rôle professionnel ne doit jamais être bloqué par cette restriction');
      const body = await res.json();
      assert.ok(body.conversation?._id);

      const Conversation = require('../models/Conversation');
      const conv = await Conversation.findById(body.conversation._id);
      assert.ok(conv, 'le groupe doit avoir été réellement persisté en base');
      assert.ok(conv.membres.map(String).includes(String(userCible._id)), 'le membre réel doit être présent dans le groupe persisté');
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
