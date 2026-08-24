// AUDIT-M-C8 (Point 8) — ensurePatientDossier journalisait déjà (logAction,
// AUDIT-M-C6) mais n'appelait jamais emitActivity/emitDashboardUpdate,
// contrairement à toute création de patient équivalente faite au guichet
// (patients.controller.js::create). Corrigé en réutilisant exactement le
// même pattern déjà exporté par utils/socket.js — aucun nouvel événement,
// aucune nouvelle route. Ce test capture les émissions socket réelles (via
// setIO d'un faux `io`) pour prouver que les deux branches (CREATE et LINK)
// appellent bien emitActivity('activity:new') puis emitDashboardUpdate()
// ('dashboard:refresh'), après logAction — pas juste "ne plante pas".
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-M-C8 — ensurePatientDossier émet activity:new et dashboard:refresh (CREATE et LINK, base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const Patient = require('../models/Patient');
  const AuditLog = require('../models/AuditLog');
  const { setIO } = require('../utils/socket');
  const { googleLogin } = require('../controllers/googleAuth.controller');
  const { OAuth2Client } = require('google-auth-library');

  const stamp = Date.now();
  const originalFetch = global.fetch;
  const originalGetTokenInfo = OAuth2Client.prototype.getTokenInfo;
  const created = { users: [], patients: [] };

  const callGoogleLogin = async (body) => {
    let status = 200, jsonBody = null;
    const res = { status: (c) => { status = c; return res; }, cookie: () => res, json: (d) => { jsonBody = d; } };
    await googleLogin({ body, ip: '127.0.0.1' }, res);
    return { status, body: jsonBody };
  };
  const mockValidToken = (email) => {
    OAuth2Client.prototype.getTokenInfo = async () => ({ aud: process.env.GOOGLE_CLIENT_ID, email, sub: 'fake-sub' });
  };

  // Faux `io` — capture chaque .emit(event, payload) sans jamais toucher un
  // vrai serveur Socket.IO (aucun serveur démarré dans ce process de test).
  const emitted = [];
  const fakeIo = { emit: (event, payload) => emitted.push({ event, payload }) };

  try {
    setIO(fakeIo);

    await t.test('CREATE — nouveau dossier patient → logAction puis activity:new puis dashboard:refresh', async () => {
      emitted.length = 0;
      const email = `_c8-create-${stamp}@_test.local`;
      mockValidToken(email);
      global.fetch = async () => ({ ok: true, json: async () => ({ id: 'fake-c8-1', email, given_name: 'Créé', family_name: 'C8' }) });

      const { status } = await callGoogleLogin({ access_token: 'fake-token-c8-1' });
      assert.equal(status, 200);

      const user = await User.findOne({ email });
      created.users.push(user);
      const patients = await Patient.find({ email }).lean();
      created.patients.push(...patients);
      assert.equal(patients.length, 1);

      const log = await AuditLog.findOne({ module: 'auth', action: 'CREATE', entite_id: patients[0]._id.toString() }).lean();
      assert.ok(log, 'logAction toujours présent (non-régression)');

      assert.equal(emitted.filter(e => e.event === 'activity:new').length, 1, 'emitActivity doit être appelé exactement une fois');
      assert.equal(emitted.filter(e => e.event === 'dashboard:refresh').length, 1, 'emitDashboardUpdate doit être appelé exactement une fois');
      const activityIdx = emitted.findIndex(e => e.event === 'activity:new');
      const dashboardIdx = emitted.findIndex(e => e.event === 'dashboard:refresh');
      assert.ok(activityIdx < dashboardIdx, 'activity:new doit être émis avant dashboard:refresh (ordre du code)');
      const activityPayload = emitted[activityIdx].payload;
      assert.equal(activityPayload.module, 'auth');
      assert.match(activityPayload.detail, /Créé C8/);
      assert.equal(activityPayload.userId.toString(), user._id.toString());
      assert.equal(activityPayload.userName, `${user.prenom} ${user.nom}`);
    });

    await t.test('LINK — dossier patient déjà existant (créé au guichet) → logAction puis activity:new puis dashboard:refresh', async () => {
      emitted.length = 0;
      const email = `_c8-link-${stamp}@_test.local`;
      const dossierExistant = await Patient.create({ nom: 'Guichet', prenom: 'C8', email, date_naissance: '1985-03-15', sexe: 'F', actif: true, statut: 'actif' });
      created.patients.push(dossierExistant);

      mockValidToken(email);
      global.fetch = async () => ({ ok: true, json: async () => ({ id: 'fake-c8-2', email, given_name: 'C8', family_name: 'Guichet' }) });

      const { status } = await callGoogleLogin({ access_token: 'fake-token-c8-2' });
      assert.equal(status, 200);

      const user = await User.findOne({ email });
      created.users.push(user);
      assert.equal(user.patient_id.toString(), dossierExistant._id.toString());

      const log = await AuditLog.findOne({ module: 'auth', action: 'LINK_PATIENT_DOSSIER', entite_id: dossierExistant._id.toString() }).lean();
      assert.ok(log, 'logAction toujours présent (non-régression)');

      assert.equal(emitted.filter(e => e.event === 'activity:new').length, 1, 'emitActivity doit être appelé exactement une fois');
      assert.equal(emitted.filter(e => e.event === 'dashboard:refresh').length, 1, 'emitDashboardUpdate doit être appelé exactement une fois');
      const activityIdx = emitted.findIndex(e => e.event === 'activity:new');
      const dashboardIdx = emitted.findIndex(e => e.event === 'dashboard:refresh');
      assert.ok(activityIdx < dashboardIdx, 'activity:new doit être émis avant dashboard:refresh (ordre du code)');
      const activityPayload = emitted[activityIdx].payload;
      assert.equal(activityPayload.module, 'auth');
      assert.match(activityPayload.detail, /Guichet/);
      assert.equal(activityPayload.userId.toString(), user._id.toString());
    });

    await t.test('seconde connexion (compte déjà lié) — ne réémet rien (branche de sortie précoce inchangée)', async () => {
      emitted.length = 0;
      const email = `_c8-second-${stamp}@_test.local`;
      mockValidToken(email);
      global.fetch = async () => ({ ok: true, json: async () => ({ id: 'fake-c8-3', email, given_name: 'C8', family_name: 'Second' }) });

      await callGoogleLogin({ access_token: 'fake-token-c8-3a' });
      const user1 = await User.findOne({ email });
      created.users.push(user1);
      const patients1 = await Patient.find({ email }).lean();
      created.patients.push(...patients1);
      emitted.length = 0; // ne garder que les émissions de la 2e connexion

      await callGoogleLogin({ access_token: 'fake-token-c8-3b' });
      assert.equal(emitted.filter(e => e.event === 'activity:new').length, 0, 'une 2e connexion (déjà liée) ne doit jamais réémettre activity:new');
      assert.equal(emitted.filter(e => e.event === 'dashboard:refresh').length, 0, 'une 2e connexion (déjà liée) ne doit jamais réémettre dashboard:refresh');
    });
  } finally {
    global.fetch = originalFetch;
    OAuth2Client.prototype.getTokenInfo = originalGetTokenInfo;
    setIO(null);
    const patientIds = created.patients.map(p => p._id.toString());
    if (patientIds.length) await AuditLog.deleteMany({ module: 'auth', entite_id: { $in: patientIds } });
    for (const u of created.users) await User.findByIdAndDelete(u._id);
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id);
    await mongoose.disconnect();
  }
});
