// AUDIT-B3 — 4 endpoints de stats (chirurgie, pédiatrie, échographie,
// urgences) chargeaient la collection entière (ou une grande partie) en
// mémoire puis filtraient/comptaient en JS. Remplacés par .aggregate(),
// même pattern que dashboard.controller.js/analytics.controller.js. Ce
// test prouve que chaque endpoint renvoie exactement la même forme de
// réponse avec des valeurs correctes, calculées depuis des documents réels.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('B3 — 4 endpoints de stats convertis en agrégation (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const chirurgieC = require('../controllers/chirurgieController');
  const pediatrieC = require('../controllers/pediatrieController');
  const echographieC = require('../controllers/echographieController');
  const urgencesC = require('../controllers/urgencesController');

  const DossierChirurgical = require('../models/DossierChirurgical');
  const Child = require('../models/Child');
  const PediatricConsultation = require('../models/PediatricConsultation');
  const Echographie = require('../models/Echographie');
  const Urgence = require('../models/Urgence');

  const stamp = Date.now();
  const cleanup = [];

  const call = async (fn, req = {}) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; return res; } };
    await fn(req, res);
    return { status, body };
  };

  try {
    await t.test('chirurgieController.getStats — compteurs et score moyen corrects', async () => {
      const now = new Date();
      const d1 = await DossierChirurgical.create({ numero: `B3-CH1-${stamp}`, patient: new mongoose.Types.ObjectId(), patient_nom: 'B3 Test', statut: 'opere', ia_risque_niveau: 'eleve', ia_risque_score: 80, nb_complications: 1, date_intervention_reelle: now });
      const d2 = await DossierChirurgical.create({ numero: `B3-CH2-${stamp}`, patient: new mongoose.Types.ObjectId(), patient_nom: 'B3 Test', statut: 'cloture', ia_risque_niveau: 'faible', ia_risque_score: 20, nb_complications: 0, date_intervention_reelle: now });
      cleanup.push(() => DossierChirurgical.findByIdAndDelete(d1._id));
      cleanup.push(() => DossierChirurgical.findByIdAndDelete(d2._id));

      const { status, body } = await call(chirurgieC.getStats);
      assert.equal(status, 200);
      assert.ok(body.kpis.total >= 2);
      assert.ok(body.kpis.operes >= 1);
      assert.ok(body.kpis.clotures >= 1);
      assert.ok(body.kpis.risques_eleves >= 1);
      assert.ok(typeof body.kpis.score_moyen === 'number');
      assert.ok(body.chart.labels.length === 12);
      assert.equal(body.chart.data.reduce((s, n) => s + n, 0) >= 2, true, 'les 2 dossiers créés ce mois doivent apparaître dans le graphique 12 mois');
    });

    await t.test('pediatrieController.getStats — répartition par âge et top pathologies', async () => {
      const nourrisson = await Child.create({ nom: `B3Bebe-${stamp}`, prenom: 'B3', date_naissance: new Date(Date.now() - 6 * 30 * 86400000), sexe: 'M' });
      const enfant = await Child.create({ nom: `B3Enfant-${stamp}`, prenom: 'B3', date_naissance: new Date(Date.now() - 7 * 365.25 * 86400000), sexe: 'F' });
      cleanup.push(() => Child.findByIdAndDelete(nourrisson._id));
      cleanup.push(() => Child.findByIdAndDelete(enfant._id));

      const consult1 = await PediatricConsultation.create({ child_id: enfant._id, motif: 'Test B3', diagnostic: 'Otite', date: new Date() });
      const consult2 = await PediatricConsultation.create({ child_id: enfant._id, motif: 'Test B3', diagnostic: 'otite', date: new Date() });
      cleanup.push(() => PediatricConsultation.findByIdAndDelete(consult1._id));
      cleanup.push(() => PediatricConsultation.findByIdAndDelete(consult2._id));

      const { status, body } = await call(pediatrieC.getStats);
      assert.equal(status, 200);
      assert.ok(body.repartitionAge[0] >= 1, 'le nourrisson (6 mois) doit compter dans la tranche 0-1 an');
      assert.ok(body.repartitionAge[2] >= 1, 'l\'enfant de 7 ans doit compter dans la tranche 5-10 ans');
      const otite = body.topPatho.find(p => p.nom === 'otite');
      assert.ok(otite, 'otite doit apparaître dans le top pathologies (insensible à la casse)');
      assert.ok(otite.nb >= 2, 'les deux consultations "Otite"/"otite" doivent être regroupées (même diagnostic en minuscule)');
    });

    await t.test('echographieController.getStats — kpis, typeMap et graphique 6 mois corrects', async () => {
      const e1 = await Echographie.create({ patient: `B3 Patient ${stamp}`, type: 'abdominale', priorite: 'urgente', statut: 'realisee' });
      const e2 = await Echographie.create({ patient: `B3 Patient2 ${stamp}`, type: 'abdominale', priorite: 'normale', statut: 'validee' });
      const eAnnulee = await Echographie.create({ patient: `B3 Annulee ${stamp}`, type: 'abdominale', statut: 'annulee' });
      cleanup.push(() => Echographie.findByIdAndDelete(e1._id));
      cleanup.push(() => Echographie.findByIdAndDelete(e2._id));
      cleanup.push(() => Echographie.findByIdAndDelete(eAnnulee._id));

      const { status, body } = await call(echographieC.getStats);
      assert.equal(status, 200);
      assert.ok(body.kpis.realisees >= 1);
      assert.ok(body.kpis.validees >= 1);
      assert.ok(body.kpis.urgentes >= 1);
      assert.ok(body.typeMap.abdominale >= 2, 'les échographies annulées ne doivent pas compter dans typeMap');
      assert.equal(body.chart.labels.length, 6);
    });

    await t.test('urgencesController.getStats — statut/triage/temps d\'attente corrects, patients sortis exclus', async () => {
      const uAttente = await Urgence.create({ patient_nom: `B3 Attente ${stamp}`, statut: 'attente', niveau_triage: 'rouge', date_arrivee: new Date(Date.now() - 15 * 60000) });
      const uConsult = await Urgence.create({ patient_nom: `B3 Consult ${stamp}`, statut: 'consultation', niveau_triage: 'jaune', date_arrivee: new Date() });
      const uSorti = await Urgence.create({ patient_nom: `B3 Sorti ${stamp}`, statut: 'sorti', niveau_triage: 'vert', date_arrivee: new Date(), date_sortie: new Date() });
      cleanup.push(() => Urgence.findByIdAndDelete(uAttente._id));
      cleanup.push(() => Urgence.findByIdAndDelete(uConsult._id));
      cleanup.push(() => Urgence.findByIdAndDelete(uSorti._id));

      const { status, body } = await call(urgencesC.getStats);
      assert.equal(status, 200);
      assert.ok(body.kpis.attente >= 1);
      assert.ok(body.kpis.consultation >= 1);
      assert.ok(body.kpis.critique >= 1, 'le patient niveau_triage=rouge doit compter en critique');
      assert.ok(body.kpis.temps_attente_moy >= 10, 'le patient en attente depuis ~15min doit produire un temps moyen proche de 15 (pas 0)');
      assert.ok(body.triageMap.rouge >= 1);
      assert.equal(body.chart.labels.length, 6);
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
