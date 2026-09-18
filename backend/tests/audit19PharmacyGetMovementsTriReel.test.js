// AUDIT-19-3 (18 sept. 2026, audit indépendant) —
// pharmacy.controller.js::getMovements limitait d'abord à 50 médicaments
// SANS tri (ordre naturel MongoDB, non déterministe) avant même de trier
// leurs mouvements : un médicament avec un mouvement très récent mais exclu
// de ce premier lot arbitraire ne pouvait jamais apparaître dans le flux
// d'activité, même si le tri final semblait correct. Remplacé par une
// agrégation qui déplie et trie TOUS les mouvements concernés avant de
// limiter — ce test prouve qu'un mouvement réellement récent n'est plus
// jamais perdu, quel que soit le nombre de médicaments candidats.
//
// Données synthétiques de démonstration, datées dans le futur pour être
// trivialement les plus récentes de toute la collection (réelle ou non) —
// aucune donnée réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req = {}) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) throw err; });
  return { status, body };
};

test('AUDIT-19-3 — getMovements() ne perd plus de mouvements récents sous un grand nombre de candidats (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Medication = require('../models/Medication');
  const pharmaC = require('../controllers/pharmacy.controller');

  const stamp = Date.now();
  const created = [];
  // Plus que la limite de 50 médicaments de l'ancien code bogué — si le
  // filtre reste appliqué au niveau des médicaments plutôt qu'au niveau des
  // mouvements agrégés, une partie de ce lot ne pourrait structurellement
  // jamais être vue.
  const N = 55;

  try {
    // Dates dans le futur, strictement croissantes — chacune est donc
    // garantie plus récente que TOUT mouvement réel déjà en base.
    const meds = await Promise.all(Array.from({ length: N }, (_, i) =>
      Medication.create({
        nom_commercial: `Audit19-3-Med-${stamp}-${i}`,
        stock_actuel: 10,
        prix_vente: 100,
        mouvements: [{ type: 'entree', quantite: 1, reference: `AUDIT19-3-${stamp}-${i}`, date: new Date(Date.now() + (i + 1) * 3600000) }],
      })
    ));
    created.push(...meds);

    await t.test('les 30 mouvements les plus récents sont exactement les 30 dates les plus hautes du lot synthétique, jamais un sous-ensemble arbitraire', async () => {
      const { status, body } = await call(pharmaC.getMovements);
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.mouvements.length, 30, 'exactement 30 mouvements attendus (limite du endpoint)');

      // Les dates les plus hautes du lot synthétique correspondent aux
      // indices 25..54 (les 30 derniers, les plus dans le futur).
      const referencesAttendues = new Set(Array.from({ length: 30 }, (_, k) => `AUDIT19-3-${stamp}-${25 + k}`));
      const referencesObtenues = body.mouvements.map(m => m.reference);
      for (const ref of referencesObtenues) {
        assert.ok(referencesAttendues.has(ref) || !ref.startsWith(`AUDIT19-3-${stamp}-`), `référence inattendue dans le top 30 : ${ref}`);
      }
      const synthetiquesObtenues = referencesObtenues.filter(r => r && r.startsWith(`AUDIT19-3-${stamp}-`));
      assert.equal(synthetiquesObtenues.length, 30, 'les 30 résultats doivent tous provenir du lot synthétique (dates dans le futur, forcément les plus récentes de toute la collection)');
      for (const ref of synthetiquesObtenues) {
        assert.ok(referencesAttendues.has(ref), `${ref} ne fait pas partie des 30 dates les plus récentes attendues — un mouvement plus ancien a été retourné à sa place`);
      }

      // Ordre strictement décroissant par date.
      const dates = body.mouvements.map(m => new Date(m.date).getTime());
      for (let i = 1; i < dates.length; i++) {
        assert.ok(dates[i - 1] >= dates[i], `ordre non décroissant à l'index ${i}`);
      }
    });
  } finally {
    for (const m of created) await Medication.findByIdAndDelete(m._id);
    await mongoose.disconnect();
  }
});
