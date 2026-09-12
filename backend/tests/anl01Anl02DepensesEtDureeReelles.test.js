// ANL-01 (correction du 12 sept. 2026, audit indépendant) —
// analytics.controller.js::getFinancial calculait depenses_par_mois comme
// Math.round(ca*0.28), une estimation arbitraire jamais liée aux vraies
// dépenses (déjà corrigé pour getStats/getGlobalStats, mais pas ici). Ce
// test prouve que les dépenses mensuelles reflètent désormais réellement
// le modèle Depense, jamais un pourcentage du chiffre d'affaires.
//
// ANL-02 — kpi.temps_moyen_consult était codé en dur à 22, jamais calculé
// (Consultation ne modélise aucune durée réelle de l'acte). Ce test prouve
// que la valeur est désormais honnêtement absente (null), jamais un
// chiffre inventé.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('ANL-01/ANL-02 — dépenses mensuelles réelles (jamais 28% du CA), durée moyenne de consultation honnêtement absente (jamais 22 inventé)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Invoice = require('../models/Invoice');
  const Depense = require('../models/Depense');
  const Patient = require('../models/Patient');
  const analyticsC = require('../controllers/analytics.controller');

  const stamp = Date.now();
  const call = async (fn, req = {}) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const patient = await Patient.create({ nom: `Anl01-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1990-01-01' });
  const created = { invoices: [], depenses: [] };
  const now = new Date();
  const currentMonth = now.getMonth();

  try {
    await t.test('getFinancial() — depenses_par_mois reflète la vraie somme Depense du mois, jamais 28% du CA', async () => {
      const invoice = await Invoice.create({ patient: patient._id, patient_nom: patient.nom, service_label: 'Test', montant_ht: 100000, montant_ttc: 100000, montant_paye: 0, statut: 'emise', date_facture: now });
      created.invoices.push(invoice._id);
      const depense = await Depense.create({ description: `Depense reelle Anl01 ${stamp}`, montant: 7777, categorie: 'Autre', date: now });
      created.depenses.push(depense._id);

      const { body } = await call(analyticsC.getFinancial);
      const attenduFake = Math.round(body.financial.ca[currentMonth] * 0.28);
      assert.notEqual(body.financial.depenses[currentMonth], attenduFake, 'les dépenses ne doivent jamais correspondre exactement à 28% du CA (preuve que ce n\'est plus une estimation)');
      assert.ok(body.financial.depenses[currentMonth] >= 7777, 'les dépenses doivent réellement inclure la vraie Depense créée pour ce mois');
    });

    await t.test('getStats() — temps_moyen_consult est honnêtement null, jamais 22 inventé', async () => {
      const { body } = await call(analyticsC.getStats, { query: {} });
      assert.equal(body.kpi.temps_moyen_consult, null, 'aucune durée réelle de consultation n\'est modélisée — jamais un chiffre fabriqué (22)');
    });
  } finally {
    await Invoice.deleteMany({ _id: { $in: created.invoices } });
    await Depense.deleteMany({ _id: { $in: created.depenses } });
    await Patient.findByIdAndDelete(patient._id);
    await mongoose.disconnect();
  }
});
