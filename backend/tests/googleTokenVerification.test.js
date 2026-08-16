// T3.2 — un jeton falsifié/expiré doit être rejeté par la nouvelle
// vérification (google-auth-library). Contre l'API Google réelle (pas de
// mock) : un jeton bidon est un cas que Google rejette authentiquement,
// c'est le test le plus honnête possible sans compte Google réel de test.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('googleLogin rejette un jeton falsifié (T3.2)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const { googleLogin } = require('../controllers/googleAuth.controller');

  await t.test('jeton syntaxiquement invalide → 401 avant tout accès à la base', async () => {
    let statusCode = null, body = null;
    const res = { status: (c) => { statusCode = c; return res; }, cookie: () => res, json: (d) => { body = d; } };
    await googleLogin({ body: { access_token: 'ceci-nest-clairement-pas-un-jeton-google-valide' } }, res);
    assert.equal(statusCode, 401, `attendu 401, obtenu ${statusCode} — ${JSON.stringify(body)}`);
    assert.equal(body.success, false);
  });

  await t.test('access_token manquant → 400 (comportement déjà correct, non touché)', async () => {
    let statusCode = null;
    const res = { status: (c) => { statusCode = c; return res; }, cookie: () => res, json: () => {} };
    await googleLogin({ body: {} }, res);
    assert.equal(statusCode, 400);
  });

  t.after(async () => { await mongoose.disconnect(); });
});
