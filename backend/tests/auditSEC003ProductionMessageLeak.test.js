// SEC-003 (audit indépendant du 4 sept. 2026) — middleware/errorHandler.js
// n'importait pas env et ne vérifiait jamais NODE_ENV. La branche générique
// (tout ce qui n'est ni CastError, ni code 11000, ni ValidationError, ni les
// 2 branches SEC-002) renvoyait error.message brut au client, y compris en
// production, pour toute exception réellement imprévue. La stack trace
// elle-même était déjà correctement protégée (jamais renvoyée, seulement
// loguée) — seul le message était en cause.
//
// Chaque scénario tourne dans un VRAI processus Node séparé (voir
// helpers/sec003ErrorHandlerChild.js) avec NODE_ENV réellement positionné
// avant le premier require de errorHandler.js — pas une bascule de
// process.env après coup dans ce même process, qui n'aurait aucun effet sur
// config/env.js déjà mis en cache.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CHILD_SCRIPT = path.join(__dirname, 'helpers', 'sec003ErrorHandlerChild.js');

function runChild(nodeEnv) {
  const out = execFileSync('node', [CHILD_SCRIPT], {
    env: { ...process.env, NODE_ENV: nodeEnv },
    cwd: path.join(__dirname, '..'),
    timeout: 10000,
  });
  const marker = '###SEC003-RESULT###';
  const idx = out.toString('utf8').indexOf(marker);
  if (idx === -1) throw new Error('Marqueur de résultat introuvable dans la sortie du processus enfant');
  return JSON.parse(out.toString('utf8').slice(idx + marker.length));
}

test('SEC-003 — message d\'erreur brut jamais exposé en production (vrai processus séparé par NODE_ENV)', async (t) => {
  await t.test('NODE_ENV=production → message générique fixe, jamais le message réel de l\'exception', () => {
    const { status, body } = runChild('production');
    assert.equal(status, 500);
    assert.equal(body.success, false);
    assert.equal(body.message, 'Erreur interne du serveur.');
    assert.doesNotMatch(body.message, /Cannot read properties|foo|détail interne réel/, 'le message réel de l\'exception ne doit jamais fuiter en production');
  });

  await t.test('NODE_ENV=development → message réel conservé (débogage)', () => {
    const { status, body } = runChild('development');
    assert.equal(status, 500);
    assert.equal(body.success, false);
    assert.match(body.message, /Cannot read properties.*foo.*détail interne réel/, 'en développement, le message réel doit rester visible pour déboguer');
  });

});
