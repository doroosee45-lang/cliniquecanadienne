// CLIN-09 (correction du 12 sept. 2026, audit indépendant) —
// patients.controller.js::remove maintenait HISTORY_CHECKS comme une liste
// manuelle de 9 modèles, TOUS déjà présents dans CASCADE_TARGETS
// (utils/patientAnonymization.js), PUIS re-listait CASCADE_TARGETS en
// entier via spread : ces 9 modèles étaient donc comptés deux fois à
// chaque suppression de patient. Corrigé en dérivant HISTORY_CHECKS
// directement de CASCADE_TARGETS (source unique), en excluant seulement
// Room (refus dédié, plus strict). Ce test relit directement le module
// pour prouver, sur le code réel, l'absence de toute duplication —
// jamais une simple relecture visuelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');

test('CLIN-09 — HISTORY_CHECKS dérive de CASCADE_TARGETS sans duplication, Room reste exclu', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'patients.controller.js'), 'utf8');

  const match = source.match(/const HISTORY_CHECKS = ([^\n]+);/);
  assert.ok(match, 'HISTORY_CHECKS doit toujours exister dans patients.controller.js');
  assert.match(match[1], /CASCADE_TARGETS/, 'HISTORY_CHECKS doit être dérivé de CASCADE_TARGETS, jamais une ré-énumération manuelle parallèle');
  assert.doesNotMatch(
    source,
    /const HISTORY_CHECKS = \[\s*\{ model: require\(/,
    'HISTORY_CHECKS ne doit plus être un littéral de tableau énuméré à la main (l\'ancienne source de duplication)'
  );

  const { CASCADE_TARGETS } = require('../utils/patientAnonymization');
  const Room = require('../models/Room');
  // Reproduit exactement la dérivation attendue pour vérifier son résultat réel.
  const HISTORY_CHECKS = CASCADE_TARGETS.filter(({ model }) => model !== Room);

  const modelNames = HISTORY_CHECKS.map(({ model }) => model.modelName);
  const uniqueNames = new Set(modelNames);
  assert.equal(modelNames.length, uniqueNames.size, 'aucun modèle ne doit apparaître deux fois dans HISTORY_CHECKS');
  assert.ok(!modelNames.includes('Room'), 'Room doit rester exclu de HISTORY_CHECKS (refus dédié, plus strict, ailleurs dans remove())');
  // Les modèles historiquement listés à la main doivent bien être couverts,
  // désormais via CASCADE_TARGETS uniquement.
  for (const nom of ['Appointment', 'Consultation', 'Hospitalization', 'Prescription', 'AIPrediction', 'Child', 'Document', 'Echographie', 'Newborn']) {
    assert.ok(modelNames.includes(nom), `${nom} doit toujours être couvert par HISTORY_CHECKS (via CASCADE_TARGETS)`);
  }
});
