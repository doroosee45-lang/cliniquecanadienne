// AUDIT-ANALYTICS-P4 — boutons "Traiter"/alertes (aucune action réelle
// auparavant, juste un toast.success). Deux points vérifiés sur base réelle :
// 1. alertes_medicales/alertes_admin exposent désormais entite_type (et
//    entite_id pour les alertes labo, seule entité réellement acquittable
//    individuellement — les alertes agrégées type pharmacy_rupture,
//    finance_impayees, hospitalisation_occupation n'ont pas d'entite_id,
//    seulement une navigation possible, jamais un "traitement" fictif).
// 2. le vrai acquittement labo (laboratory.controller.js::acquit, mécanisme
//    déjà existant, pas réimplémenté ici) fait disparaître l'alerte de la
//    liste des résultats critiques non acquittés et fait progresser
//    "Résolues ce mois" d'exactement 1 (vérifié par delta, jamais une valeur
//    absolue — d'autres acquittements réels peuvent déjà exister ce mois).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Analytics Phase 4 — alertes avec entité réelle + acquittement réel (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const LabResult = require('../models/LabResult');
  const Medication = require('../models/Medication');
  const Invoice = require('../models/Invoice');
  const analyticsC = require('../controllers/analytics.controller');
  const laboC = require('../controllers/laboratory.controller');

  const stamp = Date.now();
  const created = { patients: [], labresults: [], meds: [], invoices: [] };
  const fakeUserId = new mongoose.Types.ObjectId();

  const call = async (fn, req = {}) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('alertes_medicales — un résultat critique réel porte entite_type=labresult et le vrai entite_id', async () => {
      const patient = await Patient.create({ nom: `T-ANLP4-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      created.patients.push(patient);
      const lab = await LabResult.create({ patient: patient._id, patient_nom: `T-ANLP4-${stamp}`, est_critique: true, acquitte_par: null });
      created.labresults.push(lab);

      const { status, body } = await call(analyticsC.getReport);
      assert.equal(status, 200);
      const alerte = body.charts.alertes_medicales.find(a => a.entite_id === lab._id.toString());
      assert.ok(alerte, 'le résultat critique réellement créé doit apparaître avec son vrai entite_id');
      assert.equal(alerte.entite_type, 'labresult');
    });

    await t.test('acquittement réel (mécanisme laboratory.controller.js::acquit) fait disparaître l\'alerte et incrémente "Résolues ce mois" de 1', async () => {
      const patient = await Patient.create({ nom: `T-ANLP4b-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      created.patients.push(patient);
      const lab = await LabResult.create({ patient: patient._id, patient_nom: `T-ANLP4b-${stamp}`, est_critique: true, acquitte_par: null });
      created.labresults.push(lab);

      const { body: before } = await call(analyticsC.getReport);
      assert.ok(before.charts.alertes_medicales.some(a => a.entite_id === lab._id.toString()), 'sanity — présent avant acquittement');
      const resoluesAvant = before.charts.alertes_resolues_mois;

      const { status: acqStatus } = await call(laboC.acquit, { params: { id: lab._id.toString() }, user: { _id: fakeUserId }, ip: '127.0.0.1' });
      assert.equal(acqStatus, 200);

      const { body: after } = await call(analyticsC.getReport);
      assert.ok(!after.charts.alertes_medicales.some(a => a.entite_id === lab._id.toString()), 'un résultat acquitté ne doit plus apparaître comme alerte non traitée');
      assert.equal(after.charts.alertes_resolues_mois, resoluesAvant + 1, 'le compte réel doit progresser exactement de 1, jamais un chiffre fixe comme l\'ancien 12 codé en dur');

      const refetched = await LabResult.findById(lab._id).lean();
      assert.ok(refetched.acquitte_par, 'acquitte_par doit être réellement renseigné en base');
      assert.ok(refetched.acquitte_at, 'acquitte_at doit être réellement renseigné en base');
    });

    await t.test('alertes_medicales — rupture pharmacie agrégée porte entite_type=pharmacy_rupture, jamais d\'entite_id (pas d\'entité unique)', async () => {
      const med = await Medication.create({ nom_commercial: `T-ANLP4-${stamp}`, dci: 'Test', forme: 'comprime', categorie: 'Autre', stock_actuel: 0, stock_minimum: 10, prix_vente: 100, statut: 'rupture' });
      created.meds.push(med);

      const { body } = await call(analyticsC.getReport);
      const alerte = body.charts.alertes_medicales.find(a => a.entite_type === 'pharmacy_rupture');
      assert.ok(alerte, 'une vraie rupture de stock doit produire une alerte agrégée réelle');
      assert.equal(alerte.entite_id, undefined, 'pas d\'entite_id sur une alerte agrégée — pas d\'action "acquitter" possible dessus');
    });

    await t.test('alertes_admin — factures impayées agrégées portent entite_type=finance_impayees, jamais d\'entite_id', async () => {
      const inv = await Invoice.create({ patient_nom: `T-ANLP4-${stamp}`, service_label: 'Test', montant_ht: 1000, montant_ttc: 1000, montant_paye: 0, statut: 'emise', date_facture: new Date(), created_by: new mongoose.Types.ObjectId() });
      created.invoices.push(inv);

      const { body } = await call(analyticsC.getReport);
      const alerte = body.charts.alertes_admin.find(a => a.entite_type === 'finance_impayees');
      assert.ok(alerte, 'une vraie facture impayée doit produire une alerte agrégée réelle');
      assert.equal(alerte.entite_id, undefined);
    });
  } finally {
    for (const lab of created.labresults) await LabResult.findByIdAndDelete(lab._id);
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id);
    for (const m of created.meds) await Medication.findByIdAndDelete(m._id);
    for (const inv of created.invoices) await Invoice.findByIdAndDelete(inv._id);
    await mongoose.disconnect();
  }
});
