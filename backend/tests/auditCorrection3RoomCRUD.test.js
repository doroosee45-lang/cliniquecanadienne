// Correction 3 (relecture du 5 sept. 2026, découverte pendant la Correction A
// / cout_total) — Room n'était peuplé que par utils/seed.js : aucune route
// POST/PUT n'existait pour créer ou modifier une chambre/un lit en
// production, alors que Room.lits[].prix_par_jour est la vraie source de
// tarif branchée sur la facturation réelle à la sortie d'hospitalisation.
//
// Ce test tourne EXCLUSIVEMENT contre le serveur isolé (vrai server.js,
// vrai routeur, vrai middleware authorize()), via de vraies requêtes HTTP
// avec un vrai cookie de session.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const PASSWORD = 'Correction3TestPass1!';
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

test('Correction 3 — POST/PUT /admin/rooms créent et modifient réellement une chambre en base, 403 pour un rôle non autorisé', { skip: !mongodExists() && 'mongod introuvable — infrastructure de serveur isolé indisponible' }, async (t) => {
  let server = null;
  let connected = false;
  const created = { users: [], rooms: [] };

  try {
    server = await startIsolatedServer();
    await mongoose.connect(server.mongoUri);
    connected = true;
    const User = require('../models/User');
    const Room = require('../models/Room');

    const stamp = Date.now();
    const admin = await User.create({ email: `_correction3-admin-${stamp}@_test.local`, password: PASSWORD, nom: 'Test', prenom: 'Admin', role: 'superadmin', statut: 'actif' });
    created.users.push(admin._id);
    const medecin = await User.create({ email: `_correction3-medecin-${stamp}@_test.local`, password: PASSWORD, nom: 'Test', prenom: 'Medecin', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);

    const cookieAdmin = await login(server.baseUrl, admin.email);
    const cookieMedecin = await login(server.baseUrl, medecin.email);

    let roomId;
    await t.test('rôle admin → création réelle d\'une chambre avec un vrai tarif par lit', async () => {
      const res = await fetch(`${server.baseUrl}/admin/rooms`, withTimeout({
        method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieAdmin },
        body: JSON.stringify({
          numero: `RM-CORR3-${stamp}`, type: 'privee', etage: 2, capacite: 1, statut: 'actif',
          lits: [{ numero: `L-CORR3-A-${stamp}`, type: 'standard', prix_par_jour: 18000 }],
        }),
      }));
      const body = await res.json();
      assert.equal(res.status, 201, JSON.stringify(body));
      roomId = body.room._id;
      created.rooms.push(roomId);

      const fresh = await Room.findById(roomId);
      assert.ok(fresh, 'la chambre doit exister réellement en base');
      assert.equal(fresh.lits[0].prix_par_jour, 18000, 'le tarif réel saisi doit être persisté tel quel');
    });

    await t.test('validation — un tarif négatif est rejeté (400), aucune chambre créée', async () => {
      const res = await fetch(`${server.baseUrl}/admin/rooms`, withTimeout({
        method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieAdmin },
        body: JSON.stringify({ numero: `RM-CORR3-BAD-${stamp}`, lits: [{ numero: 'L-BAD', prix_par_jour: -500 }] }),
      }));
      assert.equal(res.status, 400);
      const Room2 = require('../models/Room');
      const exists = await Room2.findOne({ numero: `RM-CORR3-BAD-${stamp}` });
      assert.equal(exists, null, 'aucune chambre ne doit être créée avec un tarif invalide');
    });

    await t.test('rôle admin → modification réelle du tarif, persistée en base', async () => {
      const res = await fetch(`${server.baseUrl}/admin/rooms/${roomId}`, withTimeout({
        method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookieAdmin },
        body: JSON.stringify({ numero: `RM-CORR3-${stamp}`, capacite: 1, lits: [{ numero: `L-CORR3-A-${stamp}`, type: 'standard', prix_par_jour: 22000 }] }),
      }));
      const body = await res.json();
      assert.equal(res.status, 200, JSON.stringify(body));

      const fresh = await Room.findById(roomId);
      assert.equal(fresh.lits[0].prix_par_jour, 22000, 'le nouveau tarif doit être réellement persisté');
    });

    await t.test('rôle medecin (non-admin) → 403 réel sur POST /admin/rooms et PUT /admin/rooms/:id', async () => {
      const resPost = await fetch(`${server.baseUrl}/admin/rooms`, withTimeout({
        method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieMedecin },
        body: JSON.stringify({ numero: `RM-CORR3-INTERDIT-${stamp}`, lits: [] }),
      }));
      assert.equal(resPost.status, 403);
      const existsPost = await Room.findOne({ numero: `RM-CORR3-INTERDIT-${stamp}` });
      assert.equal(existsPost, null);

      const resPut = await fetch(`${server.baseUrl}/admin/rooms/${roomId}`, withTimeout({
        method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookieMedecin },
        body: JSON.stringify({ lits: [{ numero: `L-CORR3-A-${stamp}`, prix_par_jour: 999999 }] }),
      }));
      assert.equal(resPut.status, 403);
      const freshUnchanged = await Room.findById(roomId);
      assert.equal(freshUnchanged.lits[0].prix_par_jour, 22000, 'le tarif ne doit pas avoir changé suite à la tentative refusée');
    });
  } finally {
    if (connected) {
      const User = require('../models/User');
      const Room = require('../models/Room');
      await Room.deleteMany({ _id: { $in: created.rooms } });
      await User.deleteMany({ _id: { $in: created.users } });
      await mongoose.disconnect();
    }
    if (server) await server.stop();
  }
});
