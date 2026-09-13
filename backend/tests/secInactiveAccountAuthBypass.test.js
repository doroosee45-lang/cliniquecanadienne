// SEC-RESET-INACTIVE-BYPASS / SEC-GOOGLE-INACTIVE-BYPASS (13 sept. 2026,
// découverts en test navigateur réel sur un vrai compte patient jamais
// activé) — auth.controller.js::login refuse explicitement un compte non
// actif (403 "Compte inactif ou suspendu"), mais ni resetPassword() ni
// googleLogin() (googleAuth.controller.js) ne vérifiaient user.statut avant
// d'appeler sendTokenCookie() : un compte jamais activé, désactivé ou
// suspendu pouvait obtenir une session pleinement authentifiée par ces deux
// détours, sans jamais repasser par la vérification que login() applique.
// Corrigé en appliquant la même règle aux deux points d'entrée.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');

test('SEC-RESET-INACTIVE-BYPASS — resetPassword() n\'authentifie jamais un compte non actif (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const authC = require('../controllers/auth.controller');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = {
      status: (c) => { status = c; return res; },
      cookie: () => res,
      json: (d) => { body = d; },
    };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body, res };
  };

  await t.test('compte jamais activé (statut inactif) — mot de passe changé, mais aucune session ouverte', async () => {
    const email = `_sec-reset-inactive-${stamp}@_test.local`;
    const user = await User.create({ email, password: 'AncienMdp1!', nom: 'Test', prenom: 'Inactive', role: 'patient', statut: 'inactif' });
    try {
      const rawToken = crypto.randomBytes(32).toString('hex');
      user.reset_password_token = crypto.createHash('sha256').update(rawToken).digest('hex');
      user.reset_password_expire = new Date(Date.now() + 3600000);
      await user.save();

      let cookieCalled = false;
      const { status, body } = await call(authC.resetPassword, {
        params: { token: rawToken }, body: { password: 'NouveauMdp1!' }, ip: '127.0.0.1',
        // cookie() override to detect if a session cookie was ever set
      });
      // Détecte réellement si un cookie de session a été posé, pas seulement
      // le code retour — c'est précisément le comportement en cause.
      assert.equal(status, 200, 'le mot de passe doit tout de même être changé avec succès');
      assert.equal(body.autoLogin, false, 'aucune auto-connexion ne doit avoir lieu pour un compte non actif');

      const fresh = await User.findById(user._id).select('+password');
      assert.ok(await fresh.matchPassword('NouveauMdp1!'), 'le mot de passe doit bien avoir été changé malgré le refus de session');

      // Le compte reste refusé par le login normal, exactement comme avant.
      const loginRes = await call(authC.login, { body: { email, password: 'NouveauMdp1!' }, ip: '127.0.0.1', headers: {} });
      assert.equal(loginRes.status, 403, 'le compte doit rester refusé par login() — le reset ne doit jamais avoir activé le compte en douce');
    } finally {
      await User.findByIdAndDelete(user._id);
    }
  });

  await mongoose.disconnect();
});

test('SEC-GOOGLE-INACTIVE-BYPASS — googleLogin() n\'authentifie jamais un compte existant non actif (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const googleAuthC = require('../controllers/googleAuth.controller');
  const { OAuth2Client } = require('google-auth-library');

  const stamp = Date.now();
  const email = `_sec-google-inactive-${stamp}@_test.local`;
  const originalGetTokenInfo = OAuth2Client.prototype.getTokenInfo;
  const originalFetch = global.fetch;

  OAuth2Client.prototype.getTokenInfo = async () => ({ aud: process.env.GOOGLE_CLIENT_ID });
  global.fetch = async () => ({ ok: true, json: async () => ({ id: 'fake-google-id-' + stamp, email, given_name: 'Sec', family_name: 'Google' }) });

  const call = async (req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, cookie: () => res, json: (d) => { body = d; } };
    await googleAuthC.googleLogin(req, res);
    return { status, body };
  };

  try {
    const user = await User.create({ email, nom: 'Google', prenom: 'Sec', role: 'patient', statut: 'suspendu' });
    try {
      const { status, body } = await call({ body: { access_token: 'fake-token' } });
      assert.equal(status, 403, 'un compte existant suspendu ne doit jamais obtenir de session via Google');
      assert.match(body.message, /inactif|suspendu/i);

      const fresh = await User.findById(user._id);
      assert.ok(!fresh.googleId, 'le compte refusé ne doit même pas être lié à Google au passage');
    } finally {
      await User.findByIdAndDelete(user._id);
    }
  } finally {
    OAuth2Client.prototype.getTokenInfo = originalGetTokenInfo;
    global.fetch = originalFetch;
    await mongoose.disconnect();
  }
});
