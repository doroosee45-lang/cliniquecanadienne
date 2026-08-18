// AUDIT-A-8 — ai.controller.js n'avait aucun test fonctionnel dédié malgré
// 6 endpoints réels (getStats, getPredictions, runDiagnosis,
// checkInteractions, getAlerts, updatePrediction).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('ai.controller — couverture fonctionnelle des 6 endpoints (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const aiC = require('../controllers/ai.controller');
  const AIPrediction = require('../models/AIPrediction');
  const Patient = require('../models/Patient');
  const LabResult = require('../models/LabResult');
  const ImagingResult = require('../models/ImagingResult');

  const stamp = Date.now();
  const medecin = { _id: new mongoose.Types.ObjectId(), role: 'medecin', prenom: 'A8', nom: 'Med' };
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; return res; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    let patient;
    await t.test('runDiagnosis() — suggestions calculées depuis les symptômes, prédiction persistée', async () => {
      patient = await Patient.create({
        nom: `A8-Diag-${stamp}`, prenom: 'Patient', date_naissance: '1970-01-01', sexe: 'M',
        antecedents_medicaux: ['Hypertension'],
      });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));

      const { status, body } = await call(aiC.runDiagnosis, {
        body: { patientId: patient._id, symptoms: ['fievre', 'frissons', 'cephalees'], vitals: { temperature: 39.2, frequence_cardiaque: 110 } },
        user: medecin, ip: '127.0.0.1', headers: {},
      });
      assert.equal(status, 201);
      cleanup.push(() => AIPrediction.findByIdAndDelete(body.prediction_id));

      assert.ok(body.suggestions.length > 0, 'des suggestions diagnostiques doivent être calculées');
      assert.ok(body.suggestions.some(s => s.condition === 'Paludisme'), 'Paludisme doit apparaître (fièvre+frissons+céphalées le pointent tous)');
      assert.ok(body.vitalAlerts.some(a => a.champ === 'Température' && a.niveau === 'alerte'), 'fièvre à 39.2°C doit déclencher une alerte température');
      assert.equal(body.patient_context.nom, `${patient.prenom} ${patient.nom}`);

      const saved = await AIPrediction.findById(body.prediction_id).lean();
      assert.equal(saved.type, 'diagnostic');
      assert.equal(String(saved.patient), String(patient._id));
    });

    await t.test('runDiagnosis() — un résultat labo critique du patient est reflété dans ia_anomalie', async () => {
      const lab = await LabResult.create({ patient: patient._id, statut: 'valide', est_critique: true, ia_anomalie: false });
      cleanup.push(() => LabResult.findByIdAndDelete(lab._id));

      const { status, body } = await call(aiC.runDiagnosis, {
        body: { patientId: patient._id, symptoms: ['fatigue'], vitals: {} },
        user: medecin, ip: '127.0.0.1', headers: {},
      });
      assert.equal(status, 201);
      cleanup.push(() => AIPrediction.findByIdAndDelete(body.prediction_id));
      assert.ok(body.suggestions.some(s => s.condition.includes('Anomalie biologique')));

      const freshLab = await LabResult.findById(lab._id).lean();
      assert.equal(freshLab.ia_anomalie, true, 'le résultat critique doit être marqué ia_anomalie après le diagnostic IA');
    });

    await t.test('checkInteractions() — détecte une interaction connue et une allergie patient', async () => {
      const patientAllergique = await Patient.create({
        nom: `A8-Allergie-${stamp}`, prenom: 'Patient', date_naissance: '1980-01-01', sexe: 'F',
        allergies: ['Pénicilline'],
      });
      cleanup.push(() => Patient.findByIdAndDelete(patientAllergique._id));

      const { status, body } = await call(aiC.checkInteractions, {
        body: { medications: ['Quinine', 'Digoxine', 'Pénicilline'], patientId: patientAllergique._id },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.ok(body.warnings.some(w => w.description.includes('digoxine')), 'interaction quinine/digoxine connue doit être détectée');
      assert.ok(body.warnings.some(w => w.description.includes('ALLERGIE PATIENT')), 'allergie patient à la pénicilline doit être détectée');
      assert.equal(body.total_verifiees, 3);

      const saved = await AIPrediction.findOne({ type: 'interaction_medicament', patient: patientAllergique._id }).lean();
      assert.ok(saved, 'une prédiction doit être persistée quand des interactions sont détectées');
      cleanup.push(() => AIPrediction.findByIdAndDelete(saved._id));
    });

    await t.test('checkInteractions() — aucune interaction connue → aucune prédiction persistée', async () => {
      const before = await AIPrediction.countDocuments({ type: 'interaction_medicament' });
      const { status, body } = await call(aiC.checkInteractions, {
        body: { medications: ['Paracétamol'] }, user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.equal(body.warnings.length, 0);
      const after = await AIPrediction.countDocuments({ type: 'interaction_medicament' });
      assert.equal(after, before, 'un seul médicament sans interaction connue ne doit rien persister');
    });

    await t.test('getPredictions() — filtre par type et par patient', async () => {
      const { body } = await call(aiC.getPredictions, { query: { type: 'diagnostic', patient: patient._id } });
      assert.ok(body.predictions.every(p => p.patient?._id ? String(p.patient._id) === String(patient._id) : true));
      assert.ok(body.predictions.length >= 1);
    });

    await t.test('updatePrediction() — marque une prédiction traitée, persiste traite_par', async () => {
      const pred = await AIPrediction.create({ type: 'diagnostic', patient: patient._id, statut: 'en_attente', resultat: {} });
      cleanup.push(() => AIPrediction.findByIdAndDelete(pred._id));

      const { status, body } = await call(aiC.updatePrediction, {
        params: { id: pred._id }, body: { statut: 'traite', commentaire: 'Vérifié par le médecin' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.equal(body.prediction.statut, 'traite');

      const fresh = await AIPrediction.findById(pred._id).lean();
      assert.equal(String(fresh.traite_par), String(medecin._id));
      assert.equal(fresh.commentaire, 'Vérifié par le médecin');
    });

    await t.test('updatePrediction() — 404 explicite sur une prédiction inexistante', async () => {
      const { status, body } = await call(aiC.updatePrediction, { params: { id: new mongoose.Types.ObjectId() }, body: { statut: 'ignore' }, user: medecin, ip: '127.0.0.1' });
      assert.equal(status, 404);
      assert.match(body.message, /introuvable/);
    });

    await t.test('getAlerts() — agrège labo critiques, imagerie urgente et prédictions en attente (7 derniers jours)', async () => {
      const labUrgent = await LabResult.create({ patient: patient._id, statut: 'valide', est_critique: true, acquitte_par: null });
      const imgUrgente = await ImagingResult.create({ patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`, priorite: 'stat', statut: 'realise' });
      cleanup.push(() => LabResult.findByIdAndDelete(labUrgent._id));
      cleanup.push(() => ImagingResult.findByIdAndDelete(imgUrgente._id));

      const { status, body } = await call(aiC.getAlerts, {});
      assert.equal(status, 200);
      assert.ok(body.alerts.labo_critiques.some(l => String(l._id) === String(labUrgent._id)));
      assert.ok(body.alerts.imagerie_urgentes.some(i => String(i._id) === String(imgUrgente._id)));
    });

    await t.test('getStats() — répond sans erreur avec les compteurs attendus', async () => {
      const { status, body } = await call(aiC.getStats, {});
      assert.equal(status, 200);
      assert.ok(typeof body.stats.analyses_mois === 'number');
      assert.ok(typeof body.stats.precision === 'number');
      assert.ok(body.stats.precision >= 0 && body.stats.precision <= 100);
      assert.ok(typeof body.stats.alertes_risque === 'number');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
