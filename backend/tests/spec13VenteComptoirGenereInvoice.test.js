// SPEC-13 (correction du 12 sept. 2026, audit indépendant) —
// pharmacy.controller.js::createVente ne traçait une vente comptoir que
// dans Medication.mouvements (ledger de stock), jamais dans Invoice :
// invisible du module Finance/Analytics (analytics.controller.js::
// getFinancial n'agrège que Invoice). Corrigé : une vraie Invoice réglée
// (statut 'payee') est désormais créée à chaque vente réussie, avec les
// mêmes lignes/montants que le ledger — jamais un double montant inventé.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('SPEC-13 — createVente() génère une vraie Invoice réglée, visible dans Finance, jamais un doublon de montant', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Medication = require('../models/Medication');
  const Invoice = require('../models/Invoice');
  const pharmC = require('../controllers/pharmacy.controller');
  const analyticsC = require('../controllers/analytics.controller');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const med = await Medication.create({ nom_commercial: `Spec13-Med-${stamp}`, stock_actuel: 20, prix_vente: 2500, prix_achat: 1200 });
  const user = { _id: new mongoose.Types.ObjectId() };
  const created = { invoices: [] };

  try {
    await t.test('vente comptoir réussie crée une Invoice réglée, montant identique au ledger, mode de paiement non-standard mappé sans planter', async () => {
      const { status, body } = await call(pharmC.createVente, {
        user, ip: '127.0.0.1',
        body: { client: `Client-Spec13-${stamp}`, mode_paiement: 'carte_bancaire', items: [{ medicament_id: med._id.toString(), quantite: 3 }] },
      });
      assert.equal(status, 201, JSON.stringify(body));
      assert.ok(body.invoice, 'la réponse doit exposer la vraie facture créée');
      created.invoices.push(body.invoice._id);

      const fresh = await Invoice.findById(body.invoice._id).lean();
      assert.equal(fresh.montant_ttc, 7500, 'montant identique au ledger (3 x 2500), jamais recalculé séparément');
      assert.equal(fresh.montant_paye, 7500, 'une vente comptoir est réglée immédiatement');
      assert.equal(fresh.statut, 'payee');
      assert.equal(fresh.patient_nom, `Client-Spec13-${stamp}`);
      assert.equal(fresh.paiements[0].mode, 'carte', 'carte_bancaire (Pharmacy.jsx) doit être mappé vers l\'enum réel du schéma, jamais planter');
      assert.equal(fresh.lignes[0].categorie, 'pharmacie');
      assert.equal(fresh.lignes[0].montant, 7500);
    });

    await t.test('un mode de paiement non reconnu par le schéma (assurance) ne fait jamais échouer la vente', async () => {
      const { status, body } = await call(pharmC.createVente, {
        user, ip: '127.0.0.1',
        body: { client: 'Assure-Test', mode_paiement: 'assurance', items: [{ medicament_id: med._id.toString(), quantite: 1 }] },
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.invoices.push(body.invoice._id);
      const fresh = await Invoice.findById(body.invoice._id).lean();
      assert.equal(fresh.paiements[0].mode, undefined, 'un mode non reconnu est omis, jamais une valeur inventée qui violerait l\'enum');
    });

    await t.test('la vente comptoir est réellement visible dans getFinancial (Finance/Analytics), jamais invisible', async () => {
      const { body } = await call(analyticsC.getFinancial, {});
      const currentMonth = new Date().getMonth();
      assert.ok(body.financial.ca[currentMonth] >= 7500 + 2500, 'le CA du mois courant doit inclure les ventes comptoir réellement créées ci-dessus');
    });
  } finally {
    await Invoice.deleteMany({ _id: { $in: created.invoices } });
    await Medication.findByIdAndDelete(med._id);
    await mongoose.disconnect();
  }
});
