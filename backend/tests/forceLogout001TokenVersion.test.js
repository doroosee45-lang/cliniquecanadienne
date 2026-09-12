// FORCE-LOGOUT-001 (rapport de clôture du 11 sept. 2026) — Audit.jsx
// ("Forcer" sur une session active) ne révoquait jusqu'ici jamais réellement
// le JWT déjà émis : middleware/auth.js ne vérifiait que la signature/
// expiration et User.statut, jamais une notion de session individuelle. Un
// administrateur ne pouvait donc pas couper immédiatement l'accès d'un
// utilisateur précis sans suspendre tout le compte (deactivateUser/
// updateUser, action bien plus large et déjà réservée au superadmin).
//
// tokenVersion (User.js) est désormais embarqué dans chaque JWT à
// l'émission (getSignedJWT) et revérifié à CHAQUE requête protégée
// (middleware/auth.js::protect) et à CHAQUE connexion Socket.IO
// (server.js::io.use) — POST /settings/users/:id/force-logout
// l'incrémente, invalidant instantanément tous les JWT déjà émis pour ce
// compte, et coupe en plus toute connexion Socket.IO déjà ouverte
// (utils/socket.js::forceDisconnectUser, réutilise la room privée
// existante `user:<id>`, aucune architecture parallèle créée).
//
// Ce test exerce le VRAI server.js (processus séparé isolé) avec de vrais
// login/HTTP/Socket.IO — la seule façon de prouver qu'un JWT déjà émis est
// réellement refusé par la vraie chaîne, pas seulement par une relecture de
// la fonction protect() en isolation.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { io: ioClient } = require('socket.io-client');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

test('FORCE-LOGOUT-001 — tokenVersion révoque réellement une session déjà authentifiée (serveur isolé réel)', { skip: !mongodExists() && 'mongod introuvable — infrastructure isolée indisponible' }, async (t) => {
  const server = await startIsolatedServer();
  await mongoose.connect(server.mongoUri);
  const User = require('../models/User');

  const stamp = Date.now();
  const PASSWORD = 'ForceLogout001Pass!';
  const staff = await User.create({ email: `_fl001-staff-${stamp}@_test.local`, password: PASSWORD, nom: 'FL001', prenom: 'Staff', role: 'medecin', statut: 'actif' });
  const superadmin = await User.create({ email: `_fl001-admin-${stamp}@_test.local`, password: PASSWORD, nom: 'FL001', prenom: 'Admin', role: 'superadmin', statut: 'actif' });
  const nonAdmin = await User.create({ email: `_fl001-nonadmin-${stamp}@_test.local`, password: PASSWORD, nom: 'FL001', prenom: 'NonAdmin', role: 'medecin', statut: 'actif' });

  const login = async (email) => {
    const res = await fetch(`${server.baseUrl}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    assert.equal(res.status, 200, `login doit réussir pour ${email}`);
    return (res.headers.get('set-cookie') || '').split(';')[0];
  };

  try {
    const staffCookie1 = await login(staff.email);
    const adminCookie = await login(superadmin.email);
    const nonAdminCookie = await login(nonAdmin.email);

    await t.test('Test 1 — tokenVersion=0 (défaut), première session → requête protégée acceptée (200)', async () => {
      const res = await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: staffCookie1 } });
      assert.equal(res.status, 200);
    });

    await t.test('Test 5 — un utilisateur non-superadmin ne peut pas appeler force-logout (403)', async () => {
      const res = await fetch(`${server.baseUrl}/settings/users/${staff._id}/force-logout`, {
        method: 'POST', headers: { Cookie: nonAdminCookie },
      });
      assert.equal(res.status, 403);
      const fresh = await User.findById(staff._id).lean();
      assert.equal(fresh.tokenVersion || 0, 0, 'tokenVersion ne doit pas avoir changé après un appel refusé');
    });

    await t.test('Test 6 — utilisateur inexistant → erreur propre (404), jamais un faux succès', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await fetch(`${server.baseUrl}/settings/users/${fakeId}/force-logout`, {
        method: 'POST', headers: { Cookie: adminCookie },
      });
      assert.equal(res.status, 404);
      const body = await res.json();
      assert.equal(body.success, false);
    });

    let staffCookie2;
    await t.test('Test 2 — superadmin force la déconnexion → tokenVersion incrémenté, l\'ANCIEN JWT est immédiatement refusé (401)', async () => {
      const res = await fetch(`${server.baseUrl}/settings/users/${staff._id}/force-logout`, {
        method: 'POST', headers: { Cookie: adminCookie },
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.tokenVersion, 1);

      const fresh = await User.findById(staff._id).lean();
      assert.equal(fresh.tokenVersion, 1);
      assert.equal(fresh.statut, 'actif', 'force-logout ne doit JAMAIS suspendre le compte — distinct d\'une suspension');

      const meRes = await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: staffCookie1 } });
      assert.equal(meRes.status, 401, 'le JWT émis avant la révocation doit être immédiatement refusé, sans attendre son expiration naturelle');
    });

    await t.test('Test 3 — une nouvelle connexion (nouveau JWT, tokenVersion=1) est acceptée normalement', async () => {
      staffCookie2 = await login(staff.email);
      const res = await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: staffCookie2 } });
      assert.equal(res.status, 200);
    });

    await t.test('Test 4 — comportement de suspension existant toujours fonctionnel après ce correctif (non-régression)', async () => {
      await User.findByIdAndUpdate(staff._id, { statut: 'suspendu' });
      const res = await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: staffCookie2 } });
      assert.equal(res.status, 401);
      await User.findByIdAndUpdate(staff._id, { statut: 'actif' });
    });

    await t.test('Socket.IO — une connexion déjà établie est immédiatement coupée par force-logout (pas seulement les nouvelles connexions)', async () => {
      const staffCookie3 = await login(staff.email);
      const token = staffCookie3.slice(staffCookie3.indexOf('=') + 1);
      const socket = ioClient(server.baseUrl.replace('/api', ''), { auth: { token }, reconnection: false, timeout: 5000, transports: ['websocket'] });
      await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });

      const disconnected = new Promise((resolve) => socket.once('disconnect', resolve));
      const res = await fetch(`${server.baseUrl}/settings/users/${staff._id}/force-logout`, {
        method: 'POST', headers: { Cookie: adminCookie },
      });
      assert.equal(res.status, 200);
      await Promise.race([
        disconnected,
        new Promise((_, reject) => setTimeout(() => reject(new Error('la socket déjà connectée n\'a jamais été coupée')), 5000)),
      ]);
      socket.close();
    });

    await t.test('Socket.IO — une NOUVELLE connexion avec un token révoqué est refusée dès la poignée de main', async () => {
      const staffCookie4 = await login(staff.email); // nouveau token, tokenVersion=2 désormais réel sur ce compte
      // Force-logout une fois de plus pour révoquer CE token fraîchement émis.
      await fetch(`${server.baseUrl}/settings/users/${staff._id}/force-logout`, { method: 'POST', headers: { Cookie: adminCookie } });
      const token = staffCookie4.slice(staffCookie4.indexOf('=') + 1);
      const socket = ioClient(server.baseUrl.replace('/api', ''), { auth: { token }, reconnection: false, timeout: 5000, transports: ['websocket'] });
      const result = await new Promise((resolve) => {
        socket.once('connect', () => resolve({ connected: true }));
        socket.once('connect_error', (err) => resolve({ connected: false, message: err.message }));
      });
      assert.equal(result.connected, false);
      socket.close();
    });
  } finally {
    await User.deleteMany({ _id: { $in: [staff._id, superadmin._id, nonAdmin._id] } });
    await mongoose.disconnect();
    await server.stop();
  }
});
