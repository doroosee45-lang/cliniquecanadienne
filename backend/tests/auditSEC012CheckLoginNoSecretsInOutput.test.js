// SEC-012 (audit indépendant du 6 sept. 2026) — utils/check-login.js
// (script de diagnostic CLI manuel, jamais invoqué par le serveur HTTP)
// affichait en clair dans le terminal : le mot de passe SEED_PASSWORD
// configuré (deux fois), un extrait du hash bcrypt réel, et un extrait du
// JWT réellement généré — un risque de scrollback/historique terminal,
// même pour un secret de développement.
//
// Corrigé : le script reste tout aussi utile pour le diagnostic (succès/
// échec de chaque étape affiché), mais n'affiche plus aucune de ces
// valeurs en clair ni même partiellement.
//
// Ce test lance le VRAI script en process enfant réel (pas une
// réimplémentation de sa logique) et vérifie sur sa sortie réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('SEC-012 — check-login.js n\'affiche plus aucun secret en clair dans sa sortie', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, () => {
  const scriptPath = path.join(__dirname, '..', 'utils', 'check-login.js');
  const result = spawnSync('node', [scriptPath], { encoding: 'utf8', timeout: 20000 });
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.status, 0, `le script doit toujours s'exécuter avec succès (sortie : ${output})`);

  // Preuve non négociable : le vrai mot de passe configuré ne doit plus
  // jamais apparaître dans la sortie, sous aucune forme.
  if (process.env.SEED_PASSWORD) {
    assert.ok(!output.includes(process.env.SEED_PASSWORD), 'SEED_PASSWORD ne doit plus jamais apparaître en clair dans la sortie du script');
  }
  // Aucun extrait de hash bcrypt ($2a$/$2b$...) ni de JWT (segment base64url
  // suivi d'un point, motif caractéristique d'un jeton réel) ne doit fuiter.
  assert.ok(!/\$2[aby]\$\d+\$[./A-Za-z0-9]{10,}/.test(output), 'aucun extrait de hash bcrypt réel ne doit apparaître dans la sortie');
  assert.ok(!/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(output), 'aucun extrait de JWT réel ne doit apparaître dans la sortie');

  // Le diagnostic doit rester réellement utile : succès affiché.
  assert.ok(output.includes('TOUT EST OK') || output.includes('MOT DE PASSE CORRECT') || output.includes('JWT généré avec succès'), 'le script doit toujours produire un diagnostic réel exploitable');
});
