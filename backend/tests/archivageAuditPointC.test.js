// AUDIT-ARCHIVAGE-C — chemin d'authentification Google OAuth, jusqu'ici
// entièrement non tracé (contraste avec auth.controller.js::login, qui
// logue succès ET échecs). Vérifié sur base réelle, mêmes stubs que les
// tests T3.1/T3.2 déjà en place (OAuth2Client.prototype.getTokenInfo +
// global.fetch — aucun jeton Google réel disponible en environnement de
// test). Point le plus critique explicitement demandé : un nouveau compte
// doit produire DEUX entrées AuditLog distinctes (CREATE_USER puis LOGIN),
// jamais une seule fusionnée.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');

test('Archivage/Audit — Point C : Google OAuth désormais tracé (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const Patient = require('../models/Patient');
  const AuditLog = require('../models/AuditLog');
  const { googleLogin } = require('../controllers/googleAuth.controller');

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
    OAuth2Client.prototype.getTokenInfo = async (accessToken) => ({ aud: process.env.GOOGLE_CLIENT_ID, email, sub: 'fake-sub' });
  };

  try {
    await t.test('nouveau compte via Google — DEUX entrées AuditLog distinctes (CREATE_USER puis LOGIN), jamais fusionnées', async () => {
      const email = `t-archc-new-${stamp}@test.local`;
      mockValidToken(email);
      global.fetch = async () => ({ ok: true, json: async () => ({ id: 'fake-id-1', email, given_name: 'Nouveau', family_name: 'Compte' }) });

      const { status } = await callGoogleLogin({ access_token: 'fake-token-1' });
      assert.equal(status, 200);

      const user = await User.findOne({ email });
      assert.ok(user, 'le compte doit avoir été réellement créé');
      created.users.push(user);
      if (user.patient_id) created.patients.push({ _id: user.patient_id });

      const logs = await AuditLog.find({ utilisateur: user._id.toString() }).sort('createdAt').lean();
      const createLogs = logs.filter(l => l.action === 'CREATE_USER');
      const loginLogs = logs.filter(l => l.action === 'LOGIN');
      assert.equal(createLogs.length, 1, 'exactement une entrée CREATE_USER, distincte du LOGIN');
      assert.equal(loginLogs.length, 1, 'exactement une entrée LOGIN, distincte du CREATE_USER');
      assert.notEqual(createLogs[0]._id.toString(), loginLogs[0]._id.toString(), 'ce sont deux entrées différentes, jamais une seule fusionnée');
      assert.ok(new Date(createLogs[0].createdAt) <= new Date(loginLogs[0].createdAt), 'CREATE_USER doit précéder (ou être simultané à la ms près avec) LOGIN, jamais l\'inverse');
      assert.match(createLogs[0].message, new RegExp(email));
      assert.match(loginLogs[0].message, /Google/);
    });

    await t.test('connexion avec un compte Google déjà existant — un seul LOGIN, aucun CREATE_USER', async () => {
      const email = `t-archc-existing-${stamp}@test.local`;
      const existing = await User.create({ email, nom: 'Existant', prenom: 'E', role: 'medecin', statut: 'actif' });
      created.users.push(existing);

      mockValidToken(email);
      global.fetch = async () => ({ ok: true, json: async () => ({ id: 'fake-id-2', email, given_name: 'E', family_name: 'Existant' }) });

      const { status } = await callGoogleLogin({ access_token: 'fake-token-2' });
      assert.equal(status, 200);

      const logs = await AuditLog.find({ utilisateur: existing._id.toString() }).sort('createdAt').lean();
      assert.equal(logs.filter(l => l.action === 'CREATE_USER').length, 0, 'un compte déjà existant ne doit jamais produire de CREATE_USER');
      assert.equal(logs.filter(l => l.action === 'LOGIN').length, 1, 'exactement un LOGIN pour une connexion à un compte existant');
    });

    await t.test('jeton invalide/expiré — LOGIN_ECHEC statut:echec, sans utilisateur identifié', async () => {
      OAuth2Client.prototype.getTokenInfo = async () => { throw new Error('Invalid token'); };
      const { status } = await callGoogleLogin({ access_token: 'fake-invalid-token' });
      assert.equal(status, 401);

      const log = await AuditLog.findOne({ action: 'LOGIN_ECHEC', module: 'auth', message: /jeton invalide ou expiré/ }).sort('-createdAt').lean();
      assert.ok(log, 'un jeton invalide doit produire une trace LOGIN_ECHEC');
      assert.equal(log.statut, 'echec');
      assert.equal(log.utilisateur, undefined, 'aucune identité connue à ce stade — jamais un utilisateur inventé');
    });

    await t.test('audience incorrecte — LOGIN_ECHEC distinct, avec l\'email extrait du jeton (signal confused deputy)', async () => {
      const email = `t-archc-audience-${stamp}@test.local`;
      OAuth2Client.prototype.getTokenInfo = async () => ({ aud: 'une-autre-application.apps.googleusercontent.com', email });

      const { status } = await callGoogleLogin({ access_token: 'fake-wrong-audience-token' });
      assert.equal(status, 401);

      const log = await AuditLog.findOne({ action: 'LOGIN_ECHEC', module: 'auth', message: /audience incorrecte/ }).sort('-createdAt').lean();
      assert.ok(log, 'une audience incorrecte doit produire une trace LOGIN_ECHEC dédiée, distincte du jeton invalide');
      assert.equal(log.statut, 'echec');
      assert.match(log.message, new RegExp(email), 'le message doit contenir l\'email réellement extrait du jeton, signal exploitable pour une tentative confused-deputy');
    });

    await t.test('profil Google sans email — LOGIN_ECHEC avec message dédié', async () => {
      mockValidToken(undefined);
      global.fetch = async () => ({ ok: true, json: async () => ({ id: 'fake-id-noemail', given_name: 'Sans', family_name: 'Email' }) });

      const { status } = await callGoogleLogin({ access_token: 'fake-token-noemail' });
      assert.equal(status, 400);

      const log = await AuditLog.findOne({ action: 'LOGIN_ECHEC', module: 'auth', message: /profil sans email/ }).sort('-createdAt').lean();
      assert.ok(log, 'un profil sans email doit produire une trace LOGIN_ECHEC dédiée, distincte des deux cas de jeton ci-dessus');
    });

    await t.test('erreur 500 générique (panne) — aucune trace AuditLog (déjà couverte par logger/Sentry, pas un évènement métier)', async () => {
      const email = `t-archc-panne-${stamp}@test.local`;
      mockValidToken(email);
      global.fetch = async () => { throw new Error('Panne réseau simulée'); };

      const before = await AuditLog.countDocuments({});
      const { status } = await callGoogleLogin({ access_token: 'fake-token-panne' });
      assert.equal(status, 500);
      const after = await AuditLog.countDocuments({});
      assert.equal(after, before, 'une panne système générique ne doit jamais produire de trace AuditLog — déjà couverte par logger.error/Sentry, décision explicite du plan');
    });
  } finally {
    global.fetch = originalFetch;
    OAuth2Client.prototype.getTokenInfo = originalGetTokenInfo;
    // AUDIT-ARCHIVAGE-C — ordre important : Patient.pre('findOneAndDelete')
    // (Point A) refuse de supprimer un dossier tant qu'un compte portail
    // actif le référence encore. Le compte Google créé au 1er sous-test a
    // patient_id renseigné et reste 'actif' — supprimer les patients avant
    // les users ferait échouer ce nettoyage (et, sans try/catch autour,
    // sauterait le mongoose.disconnect() qui suit : exactement la panne
    // observée avant ce correctif — un processus qui ne se termine jamais).
    for (const u of created.users) await User.findByIdAndDelete(u._id);
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id);
    await mongoose.disconnect();
  }
});
