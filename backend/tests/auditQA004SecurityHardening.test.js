// QA-004 (audit indépendant du 6 sept. 2026) — trois axes de sécurité déjà
// implémentés dans server.js/utils/helpers.js mais jamais réellement
// couverts par un test : le rate-limiter anti brute-force sur /auth/login
// (loadTestT102.test.js calibre volontairement son volume pour rester SOUS
// le seuil), la whitelist CORS (aucun test existant), et les attributs de
// sécurité du cookie de session (httpOnly/secure/sameSite — aucun test
// existant). Ce fichier teste le comportement RÉEL, pas seulement la
// présence de code : chaque assertion déclenche réellement le mécanisme
// concerné contre un vrai serveur isolé (tests/helpers/isolatedServer.js).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const PASSWORD = 'QA004TestPass1!';

test('QA-004 — rate-limiter, CORS et attributs du cookie de session (serveur isolé, vraies requêtes HTTP)', { skip: !mongodExists() && 'mongod introuvable — infrastructure de serveur isolé indisponible' }, async (t) => {
  const server = await startIsolatedServer();
  const created = { users: [] };

  try {
    await mongoose.connect(server.mongoUri);
    const User = require('../models/User');
    const stamp = Date.now();
    const user = await User.create({
      email: `_qa004-${stamp}@_test.local`, password: PASSWORD,
      nom: 'QA004', prenom: 'Test', role: 'medecin', statut: 'actif',
    });
    created.users.push(user._id);
    await mongoose.disconnect();

    await t.test('cookie de session — httpOnly + sameSite réellement présents sur une vraie réponse de login', async () => {
      const res = await fetch(`${server.baseUrl}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: PASSWORD }),
      });
      assert.equal(res.status, 200, 'la connexion doit réussir avant de pouvoir inspecter le cookie');
      const setCookie = res.headers.get('set-cookie') || '';
      assert.ok(setCookie.length > 0, 'un Set-Cookie réel doit être présent');
      assert.match(setCookie, /HttpOnly/i, 'le cookie de session doit être HttpOnly (inaccessible en JS)');
      // Serveur isolé tourne en NODE_ENV=development (isolatedServer.js) :
      // Secure doit donc être ABSENT (HTTP local, pas HTTPS) et SameSite=Lax
      // — c'est la branche réelle exercée par ce test. La branche production
      // (Secure présent, SameSite=Strict) est vérifiée statiquement plus bas
      // faute de pouvoir démarrer ce serveur isolé en HTTPS réel.
      assert.doesNotMatch(setCookie, /Secure/i, 'en développement (HTTP), Secure ne doit pas être posé');
      assert.match(setCookie, /SameSite=Lax/i, 'en développement, SameSite doit être Lax (compatible proxy Vite)');
    });

    await t.test('CORS — origine autorisée (CLIENT_URL du serveur isolé) reçoit réellement Access-Control-Allow-Origin', async () => {
      const res = await fetch(`${server.baseUrl}/health`, {
        headers: { Origin: 'http://127.0.0.1:0' }, // CLIENT_URL exact posé par isolatedServer.js
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('access-control-allow-origin'), 'http://127.0.0.1:0', 'une origine réellement autorisée doit recevoir le header CORS correspondant');
    });

    await t.test('CORS — origine non autorisée est réellement rejetée (pas de header CORS, erreur serveur)', async () => {
      const res = await fetch(`${server.baseUrl}/health`, {
        headers: { Origin: 'http://attaquant-evil.example.com' },
      });
      assert.equal(res.headers.get('access-control-allow-origin'), null, 'une origine non autorisée ne doit jamais recevoir de header CORS — c\'est le seul mécanisme qu\'un navigateur respecte réellement');
      assert.equal(res.status, 500, 'la whitelist CORS rejette réellement la requête (cb(new Error) → gestionnaire d\'erreur global)');
    });

    await t.test('rate-limiter — /auth/login bloque réellement après le seuil configuré (dev: 50), jamais un nombre illimité de tentatives', async () => {
      const MAX_DEV = 50; // server.js: env.NODE_ENV==='production' ? 10 : 50
      let last = null;
      let sawBlocked = false;
      for (let i = 0; i < MAX_DEV + 3; i++) {
        const res = await fetch(`${server.baseUrl}/auth/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, password: 'mot-de-passe-delibrement-faux' }),
        });
        last = res;
        if (res.status === 429) { sawBlocked = true; break; }
      }
      assert.ok(sawBlocked, `le rate-limiter doit réellement renvoyer 429 après ${MAX_DEV} tentatives (dernier statut observé : ${last?.status})`);
      const body = await last.json();
      assert.equal(body.success, false);
      assert.match(body.message, /Trop de tentatives/i, 'le vrai message configuré dans server.js doit être renvoyé, pas un message générique');
    });
  } finally {
    if (created.users.length) {
      await mongoose.connect(server.mongoUri);
      const User = require('../models/User');
      await User.deleteMany({ _id: { $in: created.users } });
      await mongoose.disconnect();
    }
    await server.stop();
  }
});

// Vérification statique complémentaire — la branche production de
// sendTokenCookie() (Secure=true, SameSite=Strict) ne peut pas être exercée
// dynamiquement sans un serveur isolé en HTTPS réel ; vérifiée ici sur le
// code source lui-même plutôt que supposée.
test('QA-004 — sendTokenCookie() : la branche production (Secure+SameSite=Strict) existe réellement dans le code', () => {
  const src = require('node:fs').readFileSync(require.resolve('../utils/helpers.js'), 'utf8');
  assert.match(src, /secure:\s*env\.NODE_ENV\s*===\s*['"]production['"]/, 'Secure doit être conditionné à NODE_ENV===production');
  assert.match(src, /sameSite:\s*env\.NODE_ENV\s*===\s*['"]production['"]\s*\?\s*['"]strict['"]/, 'SameSite doit être "strict" en production');
});
