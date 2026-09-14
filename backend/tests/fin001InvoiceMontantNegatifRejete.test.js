// FIN-001 (audit métier du 13 sept. 2026, Phase 4) — POST /finance/factures
// (finance.controller.js::create, formulaire générique "Nouvelle facture")
// ne validait jamais le signe de `montant` ni de `lignes[].prix_unitaire`/
// `quantite` — contrairement à createRevenu/createDepense (même fichier),
// qui exigent déjà `montant > 0`. La condition `montantDirect > 0`
// n'empêchait que la génération de la ligne synthétique automatique ; elle
// ne rejetait jamais la requête, et montant_ht retombait quand même sur un
// montantDirect négatif faute de lignes. Une facture ne peut pas
// représenter une dette négative sans mécanisme d'avoir dédié.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('FIN-001 — POST /finance/factures rejette réellement un montant ou des lignes négatifs (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Invoice = require('../models/Invoice');
  const financeC = require('../controllers/finance.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Comptable' };
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('montant direct négatif est refusé (400), aucune facture créée', async () => {
      const r = await call(financeC.create, { user, ip: '127.0.0.1', body: { patient_nom: `FIN001-${stamp}`, montant: -500, service: 'Consultation' } });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      const count = await Invoice.countDocuments({ patient_nom: `FIN001-${stamp}` });
      assert.equal(count, 0);
    });

    await t.test('une ligne explicite avec prix_unitaire négatif est refusée (400), aucune facture créée', async () => {
      const r = await call(financeC.create, {
        user, ip: '127.0.0.1',
        body: { patient_nom: `FIN001-${stamp}`, lignes: [{ libelle: 'Test', prix_unitaire: -1000, quantite: 1 }] },
      });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      const count = await Invoice.countDocuments({ patient_nom: `FIN001-${stamp}` });
      assert.equal(count, 0);
    });

    await t.test('une ligne explicite avec quantite négative est refusée (400), aucune facture créée', async () => {
      const r = await call(financeC.create, {
        user, ip: '127.0.0.1',
        body: { patient_nom: `FIN001-${stamp}`, lignes: [{ libelle: 'Test', prix_unitaire: 1000, quantite: -2 }] },
      });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      const count = await Invoice.countDocuments({ patient_nom: `FIN001-${stamp}` });
      assert.equal(count, 0);
    });

    await t.test('scénario nominal — montant direct positif reste accepté (non-régression)', async () => {
      const r = await call(financeC.create, { user, ip: '127.0.0.1', body: { patient_nom: `FIN001-${stamp}`, montant: 15000, service: 'Consultation' } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => Invoice.findByIdAndDelete(r.body.invoice._id));
      assert.equal(r.body.invoice.montant_ht, 15000);
      assert.ok(r.body.invoice.montant_ttc >= 15000);
    });

    await t.test('non-régression — lignes explicites positives restent acceptées', async () => {
      const r = await call(financeC.create, {
        user, ip: '127.0.0.1',
        body: { patient_nom: `FIN001-${stamp}`, lignes: [{ libelle: 'Consultation', prix_unitaire: 5000, quantite: 2 }] },
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => Invoice.findByIdAndDelete(r.body.invoice._id));
      assert.equal(r.body.invoice.montant_ht, 10000);
    });

    await t.test('non-régression — aucun montant ni lignes fournis : toujours accepté (facture vide/brouillon, comportement préexistant inchangé)', async () => {
      const r = await call(financeC.create, { user, ip: '127.0.0.1', body: { patient_nom: `FIN001-${stamp}` } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => Invoice.findByIdAndDelete(r.body.invoice._id));
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
