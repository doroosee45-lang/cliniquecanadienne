// T3.1 — Une inscription Google avec un e-mail inconnu doit produire un
// dossier Patient valide immédiatement, pas un compte orphelin qui fait
// 404 au premier accès au portail. Simule l'appel à googleAuth.controller.js
// avec un req.body réaliste et un fetch() vers l'API Google mocké (aucun
// jeton Google réel n'est disponible en environnement de test automatisé),
// puis exécute le vrai contrôleur portal.controller.js::getMe derrière —
// c'est exactement le critère de vérification demandé.
//
// T3.1 et T3.2 ont été développées en parallèle sur la même base, sans se
// voir : depuis leur fusion, googleLogin vérifie d'abord le jeton via
// OAuth2Client.getTokenInfo() (T3.2) avant d'atteindre le code que ce test
// cible. getTokenInfo() appelle Google via son propre client HTTP (gaxios),
// pas global.fetch — le mock ci-dessous ne l'intercepte pas, d'où le besoin
// de le stubber séparément pour retrouver le comportement testé à l'origine.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');

test('inscription Google (e-mail inconnu) → portail accessible immédiatement (T3.1)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const Patient = require('../models/Patient');
  const { googleLogin } = require('../controllers/googleAuth.controller');
  const portalController = require('../controllers/portal.controller');

  const email = `_t31-google-${Date.now()}@_test.local`;
  const originalFetch = global.fetch;
  const originalGetTokenInfo = OAuth2Client.prototype.getTokenInfo;

  // Stub de la vérification d'audience (T3.2) — hors périmètre de ce test,
  // qui porte sur la création du dossier Patient une fois le jeton accepté.
  OAuth2Client.prototype.getTokenInfo = async function (accessToken) {
    assert.equal(accessToken, 'fake-token');
    return { aud: process.env.GOOGLE_CLIENT_ID };
  };

  // Mock minimal de l'API userinfo Google — la vérification officielle du
  // jeton (T3.2) est une tâche séparée, ce test se concentre sur la
  // création du dossier une fois le profil obtenu.
  global.fetch = async (url) => {
    assert.match(String(url), /googleapis\.com\/oauth2\/v2\/userinfo/);
    return { ok: true, json: async () => ({ id: 'fake-google-id-t31', email, given_name: 'T31', family_name: 'GoogleTest' }) };
  };

  let createdUserId, createdPatientId;
  try {
    let responseBody = null, statusCode = 200;
    const res = {
      status: (c) => { statusCode = c; return res; },
      cookie: () => res,
      json: (d) => { responseBody = d; },
    };
    await googleLogin({ body: { access_token: 'fake-token' } }, res);
    assert.equal(statusCode, 200, `googleLogin doit réussir : ${JSON.stringify(responseBody)}`);

    const user = await User.findOne({ email });
    createdUserId = user?._id;
    assert.ok(user, 'le compte User doit avoir été créé');
    assert.equal(user.role, 'patient');
    assert.ok(user.patient_id, 'patient_id doit être renseigné dès la création');

    const patient = await Patient.findById(user.patient_id);
    createdPatientId = patient?._id;
    assert.ok(patient, 'le dossier Patient doit exister');
    assert.equal(patient.profil_a_completer, true, 'doit être marqué comme profil à compléter (pas de date_naissance/sexe inventés)');
    assert.equal(patient.date_naissance, undefined);
    assert.equal(patient.sexe, undefined);

    // ── Le vrai critère de vérification demandé : GET /portal/me → 200 ──
    // req.user doit être le VRAI document Mongoose (comme le pose
    // middleware/auth.js::protect via User.findById en production, jamais un
    // objet littéral) — findPatient() (portal.controller.js) peut persister
    // patient_id dessus via .save() lors du repli par email (DASHBOARD-VIDE-001).
    let portalStatus = 200, portalBody = null;
    const portalRes = { status: (c) => { portalStatus = c; return portalRes; }, json: (d) => { portalBody = d; } };
    await portalController.getMe({ user }, portalRes, () => {});
    assert.equal(portalStatus, 200, `portal/me doit renvoyer 200, pas 404 : ${JSON.stringify(portalBody)}`);
    assert.ok(portalBody.patient, 'la réponse doit contenir le dossier patient');
  } finally {
    global.fetch = originalFetch;
    OAuth2Client.prototype.getTokenInfo = originalGetTokenInfo;
    if (createdUserId) await User.findByIdAndDelete(createdUserId);
    if (createdPatientId) await Patient.findByIdAndDelete(createdPatientId);
  }

  await mongoose.disconnect();
});
