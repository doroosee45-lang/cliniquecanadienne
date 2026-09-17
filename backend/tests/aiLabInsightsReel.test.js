// MODULE AI — sous-module Laboratoire (implémentation réelle demandée
// explicitement pour remplacer le placeholder "🚧 Fonctionnalité en cours
// de développement" posé en Sous-phase 5.6 à la place d'interprétations
// biologiques et d'une tendance entièrement fabriquées).
//
// ai.controller.js::getLabInsights n'invente RIEN : il consolide les vrais
// LabResult.resultats[] déjà saisis et classifiés (statut_res) par le
// laborantin (même source que frontend/src/utils/labResultats.js::
// deriveCriticalPayload), et calcule une tendance réelle uniquement quand
// un même analyte a été mesuré à plusieurs reprises pour ce patient.
//
// Données synthétiques de démonstration — aucune donnée patient réelle.
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

test('AI/Laboratoire — getLabInsights consolide les vrais résultats et calcule une vraie tendance (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const LabResult = require('../models/LabResult');
  const aiC = require('../controllers/ai.controller');

  const stamp = Date.now();
  const cleanup = [];

  try {
    const patient = await Patient.create({ nom: `AILab-${stamp}`, prenom: 'Synthetique', sexe: 'F', date_naissance: '1985-03-10' });
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));

    // 3 résultats complétés, dates croissantes — glycémie mesurée 3 fois
    // (tendance réelle attendue), une valeur critique isolée (cholestérol),
    // une valeur qualitative non numérique (test paludisme — jamais tracée
    // sur un graphique).
    const dates = [
      new Date(Date.now() - 60 * 86400000),
      new Date(Date.now() - 30 * 86400000),
      new Date(),
    ];
    const glycemies = ['0.95', '1.15', '1.42'];
    for (let i = 0; i < 3; i++) {
      const lr = await LabResult.create({
        patient: patient._id, statut: 'termine', date_resultat: dates[i],
        resultats: [
          { exam_id: 'glycemie', exam_nom: 'Glycémie', valeur: glycemies[i], ref: '0.70 – 1.10', statut_res: i === 2 ? 'anormal' : 'normal' },
          ...(i === 2 ? [{ exam_id: 'cholesterol', exam_nom: 'Cholestérol', valeur: '3.1', ref: '< 2.0', statut_res: 'critique' }] : []),
          { exam_id: 'test_palu', exam_nom: 'Test paludisme', valeur: 'Négatif', ref: 'Négatif', statut_res: 'normal' },
        ],
      });
      cleanup.push(() => LabResult.findByIdAndDelete(lr._id));
    }

    await t.test('interprétation dérivée du dernier résultat réel, jamais un diagnostic inventé', async () => {
      const r = await call(aiC.getLabInsights, { params: { patientId: String(patient._id) } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.historique_count, 3);
      assert.ok(r.body.derniere_analyse, 'la dernière analyse doit être présente');
      const glycemieRow = r.body.derniere_analyse.interpretation.find(x => x.exam === 'Glycémie');
      assert.equal(glycemieRow.valeur, '1.42', 'la valeur du dernier résultat réel, jamais recalculée');
      assert.equal(glycemieRow.statut, 'anormal');
      const cholRow = r.body.derniere_analyse.interpretation.find(x => x.exam === 'Cholestérol');
      assert.equal(cholRow.statut, 'critique');
    });

    await t.test('tendance réelle sur l\'analyte mesuré à plusieurs reprises, chronologiquement triée', async () => {
      const r = await call(aiC.getLabInsights, { params: { patientId: String(patient._id) } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.ok(r.body.trend, 'une tendance doit être calculée (glycémie mesurée 3 fois)');
      assert.equal(r.body.trend.analyte, 'Glycémie');
      assert.deepEqual(r.body.trend.data, [0.95, 1.15, 1.42], 'valeurs réelles, triées chronologiquement, jamais inventées');
      assert.equal(r.body.trend.labels.length, 3);
    });

    await t.test('non-régression — patient sans aucun résultat labo : état vide honnête, jamais une valeur inventée', async () => {
      const patientVide = await Patient.create({ nom: `AILabVide-${stamp}`, prenom: 'Synthetique', sexe: 'M', date_naissance: '1990-01-01' });
      cleanup.push(() => Patient.findByIdAndDelete(patientVide._id));
      const r = await call(aiC.getLabInsights, { params: { patientId: String(patientVide._id) } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.historique_count, 0);
      assert.equal(r.body.derniere_analyse, null);
      assert.equal(r.body.trend, null);
    });

    await t.test('patient inexistant — 404', async () => {
      const r = await call(aiC.getLabInsights, { params: { patientId: String(new mongoose.Types.ObjectId()) } });
      assert.equal(r.status, 404);
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
