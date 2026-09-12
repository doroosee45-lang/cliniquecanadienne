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
//
// Correction (relecture du 11 sept. 2026) — ce test échouait de façon
// intermittente (visible uniquement en suite complète, jamais en isolation)
// sur sa dernière assertion ("diagnostic réel exploitable") : quand lancé
// via `npm test`, run-tests-local-db.js substitue MONGO_URI par un mongod
// local éphémère et vide (isolation Phase 10, voulue). spawnSync hérite de
// cette variable, donc check-login.js (qui cherche en dur
// "oseedoro@gmail.com", le compte réel de développement) ne le trouve
// jamais dans cette base vide — le script s'arrête proprement à l'étape 3
// ("Utilisateur introuvable"), sans jamais atteindre la bannière de succès.
// Ce n'était pas un défaut du script ni de sa correction SEC-012 elle-même
// (vérifié séparément à l'identique quand exécuté directement, hors suite),
// mais un couplage implicite avec un compte réel que l'infrastructure de
// test isolée ne peut pas garantir. Corrigé en créant un utilisateur
// jetable dans CETTE base isolée et en pointant le script dessus via
// CHECK_EMAIL/SEED_PASSWORD (déjà prévus par check-login.js pour cet usage)
// — jamais vers le compte réel ni vers une base partagée.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const mongoose = require('mongoose');

test('SEC-012 — check-login.js n\'affiche plus aucun secret en clair dans sa sortie', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async () => {
  const User = require('../models/User');
  await mongoose.connect(process.env.MONGO_URI);

  const email = `_sec012-check-login-${Date.now()}@_test.local`;
  const password = 'Sec012CheckLogin1!';
  const user = await User.create({
    email, password, nom: 'Test', prenom: 'CheckLogin',
    role: 'medecin', statut: 'actif',
  });

  let output;
  try {
    const scriptPath = path.join(__dirname, '..', 'utils', 'check-login.js');
    const result = spawnSync('node', [scriptPath], {
      encoding: 'utf8', timeout: 20000,
      env: { ...process.env, CHECK_EMAIL: email, SEED_PASSWORD: password },
    });
    output = `${result.stdout}\n${result.stderr}`;

    assert.equal(result.status, 0, `le script doit toujours s'exécuter avec succès (sortie : ${output})`);

    // Preuve non négociable : le vrai mot de passe configuré ne doit plus
    // jamais apparaître dans la sortie, sous aucune forme.
    assert.ok(!output.includes(password), 'SEED_PASSWORD ne doit plus jamais apparaître en clair dans la sortie du script');
    // Aucun extrait de hash bcrypt ($2a$/$2b$...) ni de JWT (segment
    // base64url suivi d'un point, motif caractéristique d'un jeton réel) ne
    // doit fuiter.
    assert.ok(!/\$2[aby]\$\d+\$[./A-Za-z0-9]{10,}/.test(output), 'aucun extrait de hash bcrypt réel ne doit apparaître dans la sortie');
    assert.ok(!/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(output), 'aucun extrait de JWT réel ne doit apparaître dans la sortie');

    // Le diagnostic doit rester réellement utile : succès affiché, pour le
    // vrai utilisateur jetable de ce test (jamais un texte de repli).
    assert.ok(output.includes('TOUT EST OK'), `le script doit produire un diagnostic de succès réel pour l'utilisateur jetable de ce test (sortie : ${output})`);
    assert.ok(output.includes('MOT DE PASSE CORRECT'), 'le script doit confirmer réellement la correspondance du mot de passe');
    assert.ok(output.includes('JWT généré avec succès'), 'le script doit confirmer la génération réelle du JWT');
  } finally {
    await User.findByIdAndDelete(user._id);
    await mongoose.disconnect();
  }
});
