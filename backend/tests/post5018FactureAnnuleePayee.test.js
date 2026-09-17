// POST5-018 (audit indépendant post-Phase 5, 14 sept. 2026) — DETTE
// TECHNIQUE. finance.controller.js::updateStatut acceptait
// statut:'annulee' sur une facture ayant déjà de vrais paiements
// enregistrés, sans la moindre réversion ni signalement : la facture
// passait "annulée" tout en conservant son historique de paiements réels,
// incohérence comptable silencieuse. Aucune politique de remboursement
// n'existe dans ce système — plutôt que d'inventer une règle (supprimer
// les paiements détruirait la traçabilité), l'annulation d'une facture
// payée est désormais bloquée (409), même principe que POST5-006.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req = {}) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message }; } });
  return { status, body };
};

test('POST5-018 — annulation d\'une facture déjà payée bloquée, jamais une incohérence comptable silencieuse (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Invoice = require('../models/Invoice');
  const financeC = require('../controllers/finance.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Comptable' };
  const cleanup = [];

  try {
    await t.test('facture partiellement payée — annulation refusée (409), statut et paiements intacts', async () => {
      const inv = await Invoice.create({
        numero_facture: `P5018-${stamp}-A`, patient_nom: 'Test Patient',
        montant_ttc: 10000, montant_paye: 4000, montant_restant: 6000, statut: 'partiellement_payee',
        paiements: [{ montant: 4000, mode: 'especes', enregistre_par: user._id }],
      });
      cleanup.push(() => Invoice.findByIdAndDelete(inv._id));

      const r = await call(financeC.updateStatut, { params: { id: inv._id.toString() }, user, ip: '127.0.0.1', body: { statut: 'annulee' } });
      assert.equal(r.status, 409, JSON.stringify(r.body));
      assert.equal(r.body.success, false);

      const relu = await Invoice.findById(inv._id).lean();
      assert.equal(relu.statut, 'partiellement_payee', 'le statut ne doit jamais basculer vers annulee sur une facture payée');
      assert.equal(relu.montant_paye, 4000, 'les paiements réels ne doivent jamais être touchés par une tentative d\'annulation refusée');
      assert.equal(relu.paiements.length, 1);
    });

    await t.test('facture intégralement payée — annulation refusée (409)', async () => {
      const inv = await Invoice.create({
        numero_facture: `P5018-${stamp}-B`, patient_nom: 'Test Patient',
        montant_ttc: 5000, montant_paye: 5000, montant_restant: 0, statut: 'payee',
        paiements: [{ montant: 5000, mode: 'carte', enregistre_par: user._id }],
      });
      cleanup.push(() => Invoice.findByIdAndDelete(inv._id));

      const r = await call(financeC.updateStatut, { params: { id: inv._id.toString() }, user, ip: '127.0.0.1', body: { statut: 'annulee' } });
      assert.equal(r.status, 409, JSON.stringify(r.body));

      const relu = await Invoice.findById(inv._id).lean();
      assert.equal(relu.statut, 'payee');
    });

    await t.test('non-régression — facture jamais payée (montant_paye=0) reste annulable normalement', async () => {
      const inv = await Invoice.create({
        numero_facture: `P5018-${stamp}-C`, patient_nom: 'Test Patient',
        montant_ttc: 8000, montant_paye: 0, montant_restant: 8000, statut: 'emise',
      });
      cleanup.push(() => Invoice.findByIdAndDelete(inv._id));

      const r = await call(financeC.updateStatut, { params: { id: inv._id.toString() }, user, ip: '127.0.0.1', body: { statut: 'annulee' } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      // normalizeInvoice() simplifie 'annulee' -> 'annule' pour l'affichage
      // (mapping pré-existant, sans rapport avec ce correctif) — vérifié
      // aussi directement en base pour la valeur brute réelle.
      assert.equal(r.body.invoice.statut, 'annule', 'une facture jamais payée doit rester librement annulable — pas de sur-blocage');
      const relu = await Invoice.findById(inv._id).lean();
      assert.equal(relu.statut, 'annulee');
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
