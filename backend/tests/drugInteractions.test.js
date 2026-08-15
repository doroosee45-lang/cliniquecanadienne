// Test de non-régression — base d'interactions médicamenteuses centralisée.
// Avant correction, ai.controller.js (15 règles), prescriptions.controller.js
// (2 règles) et pharmacy.controller.js (1 règle) maintenaient chacun leur
// propre liste divergente : une interaction connue de l'IA pouvait ne jamais
// être signalée à la prescription ou à la dispensation.
const test = require('node:test');
const assert = require('node:assert/strict');
const { detectInteractions, INTERACTIONS_DB } = require('../utils/drugInteractions');

test('détecte une interaction connue (warfarine + aspirine)', () => {
  const warnings = detectInteractions(['warfarine', 'aspirine']);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].risque, 'elevé');
});

test('ne signale rien pour des médicaments sans interaction connue', () => {
  const warnings = detectInteractions(['paracetamol']);
  assert.equal(warnings.length, 0);
});

test('la base contient au moins les 15 règles consolidées (contre 1 à 2 avant centralisation)', () => {
  assert.ok(INTERACTIONS_DB.length >= 15);
});

test('les 3 anciens points de duplication utilisent bien le module partagé', () => {
  const fs = require('fs');
  const path = require('path');
  for (const file of ['ai.controller.js', 'prescriptions.controller.js', 'pharmacy.controller.js']) {
    const content = fs.readFileSync(path.join(__dirname, '..', 'controllers', file), 'utf8');
    assert.match(content, /require\(['"]\.\.\/utils\/drugInteractions['"]\)/, `${file} doit importer utils/drugInteractions`);
  }
});
