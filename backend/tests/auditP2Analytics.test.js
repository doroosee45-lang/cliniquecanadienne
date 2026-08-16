// AUDIT-07 — analytics.controller.js est réellement utilisé (les 4
// endpoints sont appelés par analyticsSlice.js et dispatchés depuis
// Analytics.jsx) mais n'avait aucune couverture de test. Pas de scoping par
// utilisateur ici par conception : c'est un rapport global (superadmin/
// adminclinique uniquement, cf. analytics.routes.js), pas une ressource
// personnelle — vérifié en lisant le contrôleur avant d'écrire ce test,
// aucun filtre req.user n'existe dans aucune des 4 fonctions.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('analytics.controller — les 4 endpoints réellement utilisés (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const analyticsC = require('../controllers/analytics.controller');
  const Patient = require('../models/Patient');

  const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin' };
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const cleanup = [];
  const stamp = Date.now();

  try {
    await t.test('getStats — répond avec la forme attendue et reflète un patient nouveau', async () => {
      const { body: before } = await call(analyticsC.getStats, { user: admin, query: {} });
      assert.equal(before.success, true);
      assert.ok(before.kpi && typeof before.kpi === 'object', 'la réponse doit contenir kpi{}');
      const avantNouveaux = before.kpi.patients_nouveaux;

      const patient = await Patient.create({ nom: `T-Analytics-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));

      const { body: after } = await call(analyticsC.getStats, { user: admin, query: {} });
      assert.equal(after.kpi.patients_nouveaux - avantNouveaux, 1, 'patients_nouveaux doit augmenter de 1 après création (période "mois" par défaut couvre aujourd\'hui)');
    });

    await t.test('getReport — répond avec la forme attendue (charts + analytics)', async () => {
      const { status, body } = await call(analyticsC.getReport, { user: admin, query: {} });
      assert.equal(status, 200);
      assert.equal(body.success, true);
      assert.ok(body.charts && typeof body.charts === 'object', 'la réponse doit contenir charts{}');
      assert.ok(Array.isArray(body.charts.consultations_par_mois.labels));
      assert.equal(body.charts.consultations_par_mois.labels.length, 12);
      assert.ok(body.analytics && typeof body.analytics === 'object', 'la réponse doit contenir analytics{}');
    });

    await t.test('getFinancial — répond avec 12 points par mois', async () => {
      const { status, body } = await call(analyticsC.getFinancial, { user: admin, query: {} });
      assert.equal(status, 200);
      assert.equal(body.success, true);
      assert.equal(body.financial.ca.length, 12);
      assert.equal(body.financial.depenses.length, 12);
      assert.equal(body.financial.benefice.length, 12);
    });

    await t.test('getPatientStats — reflète un patient réellement créé (genre + statut)', async () => {
      const { body: before } = await call(analyticsC.getPatientStats, { user: admin, query: {} });
      const avantHommes = before.stats.par_genre.hommes;
      const avantActifs = before.stats.par_statut.actifs;

      const patient = await Patient.create({ nom: `T-Analytics2-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M', statut: 'actif' });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));

      const { status, body: after } = await call(analyticsC.getPatientStats, { user: admin, query: {} });
      assert.equal(status, 200);
      assert.equal(after.stats.par_genre.hommes - avantHommes, 1, 'un patient de sexe M supplémentaire doit incrémenter par_genre.hommes');
      assert.equal(after.stats.par_statut.actifs - avantActifs, 1, 'un patient actif supplémentaire doit incrémenter par_statut.actifs');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
