// SEC-011 (audit indépendant du 6 sept. 2026) — googleAuth.controller.js
// désactivait silencieusement TOUTE vérification d'audience du jeton Google
// quand GOOGLE_CLIENT_ID est absent (`if (env.GOOGLE_CLIENT_ID && ...)`) :
// un jeton Google authentique mais émis pour une AUTRE application tierce
// était alors accepté sans aucun avertissement (confused deputy). Corrigé :
// en production, l'absence de GOOGLE_CLIENT_ID fait désormais échouer la
// connexion explicitement (503) plutôt que de désactiver silencieusement le
// contrôle ; en développement/test, le comportement historique (accepter
// sans vérifier l'audience) est conservé, mais désormais accompagné d'un
// avertissement explicite dans les logs.
//
// Impossible d'obtenir un vrai jeton Google dans cet environnement de test
// (aucun compte Google de test réel, cf. googleTokenVerification.test.js) —
// seules 2 frontières réseau externes sont simulées : getTokenInfo (Google)
// pour représenter un jeton authentique dont l'audience ne correspond à
// aucune configuration connue, et l'endpoint userinfo (appelé seulement si
// getTokenInfo réussit) pour permettre au scénario "développement" d'aller
// jusqu'au bout réellement (création de compte réelle en base), pas
// seulement jusqu'au premier obstacle réseau non pertinent pour ce test.
// config/env.js et le contrôleur sont rechargés à chaud avec de VRAIES
// valeurs process.env différentes par scénario (pas une variable injectée
// artificiellement) — c'est le même mécanisme réel qui tournerait avec un
// vrai déploiement mal configuré.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('SEC-011 — GOOGLE_CLIENT_ID absent : échec fermé et explicite en production, comportement dev conservé', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);

  const { OAuth2Client } = require('google-auth-library');
  const originalGetTokenInfo = OAuth2Client.prototype.getTokenInfo;
  const fakeEmail = `_sec011-${Date.now()}@_test.local`;
  // Simule un jeton Google authentique (Google le validerait) mais dont
  // l'audience ne correspond à aucune configuration connue — le scénario
  // confused deputy exact que SEC-011 corrige.
  OAuth2Client.prototype.getTokenInfo = async () => ({ aud: 'une-autre-application.apps.googleusercontent.com', email: fakeEmail });

  const originalFetch = global.fetch;
  global.fetch = async (url, ...rest) => {
    if (String(url).includes('googleapis.com/oauth2/v2/userinfo')) {
      return { ok: true, json: async () => ({ email: fakeEmail, given_name: 'Test', family_name: 'Sec011', id: 'fake-google-id', picture: '' }) };
    }
    return originalFetch(url, ...rest);
  };

  const ENV_KEYS = ['NODE_ENV', 'GOOGLE_CLIENT_ID'];
  const saveEnv = () => Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
  const restoreEnv = (saved) => ENV_KEYS.forEach(k => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });

  // Recharge config/env.js + le contrôleur avec de vraies valeurs process.env
  // pour ce scénario, puis restaure l'environnement ambiant pour ne pas
  // affecter le reste du processus de test.
  function loadControllerWith(overrides) {
    const saved = saveEnv();
    restoreEnv(overrides);
    delete require.cache[require.resolve('../config/env')];
    delete require.cache[require.resolve('../controllers/googleAuth.controller')];
    const { googleLogin } = require('../controllers/googleAuth.controller');
    restoreEnv(saved);
    return googleLogin;
  }

  const call = async (googleLogin, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, cookie: () => res, json: (d) => { body = d; } };
    await googleLogin(req, res);
    return { status, body };
  };

  try {
    await t.test('production + GOOGLE_CLIENT_ID absent → 503 explicite, aucun compte créé', async () => {
      const googleLogin = loadControllerWith({ NODE_ENV: 'production', GOOGLE_CLIENT_ID: '' });
      const { status, body } = await call(googleLogin, { body: { access_token: 'fake-valid-token' }, ip: '127.0.0.1' });
      assert.equal(status, 503, JSON.stringify(body));
      assert.equal(body.success, false);

      const User = require('../models/User');
      const created = await User.findOne({ email: fakeEmail });
      assert.equal(created, null, 'aucun compte ne doit avoir été créé quand la connexion est refusée par sécurité');
    });

    await t.test('développement + GOOGLE_CLIENT_ID absent → comportement historique conservé (pas de blocage)', async () => {
      const googleLogin = loadControllerWith({ NODE_ENV: 'development', GOOGLE_CLIENT_ID: '' });
      const { status, body } = await call(googleLogin, { body: { access_token: 'fake-valid-token' }, ip: '127.0.0.1' });
      assert.notEqual(status, 503, JSON.stringify(body));

      const User = require('../models/User');
      const created = await User.findOne({ email: fakeEmail });
      assert.ok(created, 'en développement, la connexion doit toujours aboutir (comportement non régressé)');
      await User.deleteOne({ _id: created._id });
    });

    await t.test('production + GOOGLE_CLIENT_ID présent, audience différente → 401 (comportement SEC déjà en place, non régressé)', async () => {
      const googleLogin = loadControllerWith({ NODE_ENV: 'production', GOOGLE_CLIENT_ID: 'la-vraie-app.apps.googleusercontent.com' });
      const { status, body } = await call(googleLogin, { body: { access_token: 'fake-valid-token' }, ip: '127.0.0.1' });
      assert.equal(status, 401, JSON.stringify(body));

      const User = require('../models/User');
      const created = await User.findOne({ email: fakeEmail });
      assert.equal(created, null, 'aucun compte ne doit avoir été créé pour une audience incorrecte');
    });
  } finally {
    OAuth2Client.prototype.getTokenInfo = originalGetTokenInfo;
    global.fetch = originalFetch;
    delete require.cache[require.resolve('../config/env')];
    delete require.cache[require.resolve('../controllers/googleAuth.controller')];
    await mongoose.disconnect();
  }
});
