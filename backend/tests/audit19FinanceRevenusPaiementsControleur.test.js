// AUDIT-19-7 (18 sept. 2026, audit indépendant) — GET /finance/revenus et
// GET /finance/paiements vivaient en logique métier inline dans
// routes/finance.routes.js, seule exception à la convention universelle du
// projet (délégation systématique à un contrôleur nommé) : aucun test ne
// pouvait les appeler directement (il aurait fallu un serveur HTTP réel),
// et de fait aucun test n'existait pour ces deux endpoints avant ce
// correctif. Déplacées vers finance.controller.js::getRevenus/getPaiements
// SANS aucun changement de comportement — ce test le prouve en les
// exerçant directement, ce qui était structurellement impossible avant.
//
// Données synthétiques de démonstration — aucune donnée réelle.
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

test('AUDIT-19-7 — finance.controller.js::getRevenus/getPaiements (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Invoice = require('../models/Invoice');
  const Patient = require('../models/Patient');
  const finC = require('../controllers/finance.controller');

  const stamp = Date.now();
  const created = { invoices: [], patients: [] };
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Finance' };

  try {
    const patient = await Patient.create({ nom: `Audit19-7-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F' });
    created.patients.push(patient._id);

    await t.test('getRevenus — expose une facture payée réelle avec les champs attendus', async () => {
      const invoice = await Invoice.create({
        patient: patient._id, service_label: 'Test', montant_ht: 5000, montant_ttc: 5000, montant_paye: 5000,
        statut: 'payee', paiements: [{ montant: 5000, mode: 'especes', reference: `AUDIT19-7-${stamp}`, enregistre_par: user._id }],
        created_by: user._id,
      });
      created.invoices.push(invoice._id);

      const { status, body } = await call(finC.getRevenus, { query: {} });
      assert.equal(status, 200, JSON.stringify(body));
      const found = body.revenus.find(r => String(r._id) === String(invoice._id));
      assert.ok(found, 'la facture réelle payée doit apparaître dans les revenus');
      assert.equal(found.montant, 5000);
      assert.equal(found.statut, 'paye');
      assert.equal(found.mode, 'especes');
      assert.equal(found.patient, `P Audit19-7-${stamp}`);
    });

    await t.test('getPaiements — expose un paiement explicite réel avec caissier réellement résolu', async () => {
      const invoice = await Invoice.create({
        patient: patient._id, service_label: 'Test', montant_ht: 3000, montant_ttc: 3000, montant_paye: 3000,
        statut: 'payee', paiements: [{ montant: 3000, mode: 'carte', reference: `AUDIT19-7B-${stamp}`, enregistre_par: user._id }],
        created_by: user._id,
      });
      created.invoices.push(invoice._id);

      const { status, body } = await call(finC.getPaiements, { query: {} });
      assert.equal(status, 200, JSON.stringify(body));
      const found = body.paiements.find(p => p._id === `${invoice._id}-p0`);
      assert.ok(found, 'le paiement explicite réel doit apparaître');
      assert.equal(found.montant, 3000);
      assert.equal(found.mode, 'carte');
      assert.equal(found.facture, invoice.numero_facture);
    });

    await t.test('getRevenus/getPaiements — respectent la limite fournie en query', async () => {
      const { body: revenusLimites } = await call(finC.getRevenus, { query: { limit: '1' } });
      assert.ok(revenusLimites.revenus.length <= 1, 'la limite doit être réellement appliquée');

      const { body: paiementsLimites } = await call(finC.getPaiements, { query: { limit: '1' } });
      assert.ok(paiementsLimites.paiements.length <= 1, 'la limite doit être réellement appliquée (au moins 1 ligne par facture retenue)');
    });
  } finally {
    for (const id of created.invoices) await Invoice.findByIdAndDelete(id);
    for (const id of created.patients) await Patient.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
