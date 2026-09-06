// QA-001 — models/Counter.js (via utils/counter.js::nextSequence) génère les
// numéros séquentiels (numero_dossier et équivalents, tous sous contrainte
// unique) mais n'était couvert par aucun test dédié. Ce test prouve
// l'atomicité RÉELLE : N appels réellement concurrents (Promise.all — le
// driver MongoDB envoie N requêtes findOneAndUpdate en parallèle sur le vrai
// réseau, pas une boucle séquentielle qui simulerait la concurrence) ne
// produisent jamais deux fois la même valeur.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('QA-001 — nextSequence() reste atomique sous appels réellement concurrents', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Counter = require('../models/Counter');
  const { nextSequence } = require('../utils/counter');

  const stamp = Date.now();
  const key = `qa001-test-${stamp}`;
  const N = 50;

  try {
    await t.test(`${N} appels concurrents (Promise.all, pas une boucle séquentielle) ne produisent jamais de doublon`, async () => {
      // Promise.all déclenche les N appels avant qu'aucun n'ait eu le temps
      // de recevoir sa réponse réseau — c'est le driver MongoDB, pas ce test,
      // qui envoie réellement N requêtes findOneAndUpdate en parallèle sur
      // le même document. Une implémentation non atomique (ex. un
      // read-then-write en 2 étapes non-atomique) produirait ici des
      // doublons de façon quasi certaine à cette échelle.
      const results = await Promise.all(Array.from({ length: N }, () => nextSequence(key)));

      assert.equal(results.length, N);
      const uniques = new Set(results);
      assert.equal(uniques.size, N, `${N} appels concurrents doivent produire ${N} valeurs distinctes — obtenu ${uniques.size} valeurs distinctes (doublons détectés : atomicité cassée)`);

      // Preuve plus forte que "juste distinctes" : exactement la plage
      // 1..N, sans trou ni saut — confirme un $inc atomique réel, pas
      // seulement une déduplication accidentelle côté client.
      const sorted = [...uniques].sort((a, b) => a - b);
      assert.deepEqual(sorted, Array.from({ length: N }, (_, i) => i + 1));
    });

    await t.test('la séquence continue réellement après les appels concurrents (pas de régression du compteur)', async () => {
      const next = await nextSequence(key);
      assert.equal(next, N + 1);
    });

    await t.test('deux clés différentes ont des séquences indépendantes', async () => {
      const keyB = `qa001-test-b-${stamp}`;
      const a1 = await nextSequence(key);
      const b1 = await nextSequence(keyB);
      assert.equal(a1, N + 2);
      assert.equal(b1, 1, 'une clé jamais utilisée doit démarrer à 1, indépendamment de la première');
      await Counter.deleteOne({ _id: keyB });
    });
  } finally {
    await Counter.deleteOne({ _id: key });
    await mongoose.disconnect();
  }
});
