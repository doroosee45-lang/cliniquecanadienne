// AUDIT-B2 — DossierChirurgical.patient n'avait aucun index malgré un
// filtrage fréquent par ce champ (chirurgieController.js::getDossiers).
// Ce test prouve que l'index composé {patient:1, created_at:-1} est
// réellement construit sur la collection réelle (pas seulement déclaré
// dans le schéma) — mêmes réserves que le correctif P2-3/Staff.utilisateur
// de cette même session : un index déclaré dans un fichier de modèle ne
// garantit pas qu'il existe réellement sur une base déjà peuplée avant ce
// changement de schéma.
// ADR-0006 — champ renommé patient_id → patient, index recréé sous le
// nouveau nom.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('B2 — index composé patient/created_at construit sur DossierChirurgical (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const DossierChirurgical = require('../models/DossierChirurgical');

  try {
    await t.test('l\'index {patient:1, created_at:-1} existe réellement sur la collection', async () => {
      await DossierChirurgical.syncIndexes();
      const indexes = await DossierChirurgical.collection.indexes();
      const found = indexes.find(i => i.key && i.key.patient === 1 && i.key.created_at === -1);
      assert.ok(found, `index composé attendu introuvable — index présents : ${JSON.stringify(indexes.map(i => i.key))}`);
    });
  } finally {
    await mongoose.disconnect();
  }
});
