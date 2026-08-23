// AUDIT-11-6 — finance.controller.js::addPayment vérifiait montant_restant
// en mémoire (findById) puis sauvegardait (invoice.save(), dont le hook
// pre('save') dérive montant_paye/montant_restant/statut depuis paiements[])
// : deux paiements concurrents sur la même facture pouvaient tous deux
// passer la vérification avant que l'un des deux n'ait écrit, laissant
// montant_restant devenir négatif. Même famille de bug lire-puis-écrire déjà
// corrigée dans pharmacy.controller.js (stock_actuel) et
// hospitalization.controller.js (lits.statut) — corrigé ici avec le même
// principe : findOneAndUpdate atomique filtré sur montant_restant.
//
// En creusant les autres opérations lire-puis-écrire sur Invoice (au-delà
// d'addPayment, comme demandé), updateStatut('payee') avait exactement la
// même faille : lire montant_restant en mémoire puis pousser un paiement de
// ce montant exact avant save() — deux appels concurrents (double-clic, ou
// en même temps qu'un vrai paiement) pouvaient enregistrer deux fois le
// solde. Corrigé avec le même principe (filtre sur le solde exact lu, pas un
// $gte : payer "le solde restant" n'a de sens que contre l'état réellement
// présent à l'écriture).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-11-6 — paiement de facture atomique sous concurrence réelle (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Invoice = require('../models/Invoice');
  const User = require('../models/User');
  const finC = require('../controllers/finance.controller');

  const stamp = Date.now();
  const user = await User.create({ email: `_fin116-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Caissier', prenom: 'T116', role: 'comptable', statut: 'actif' });
  const created = { invoices: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message }; } });
    return { status, body };
  };

  const makeInvoice = async (montant_ttc) => {
    const inv = await Invoice.create({
      created_by: user._id, service_label: `T116-${stamp}`,
      lignes: [{ libelle: 'Test', categorie: 'autre', prix_unitaire: montant_ttc, quantite: 1, montant: montant_ttc }],
      montant_ttc, statut: 'emise',
    });
    created.invoices.push(inv);
    return inv;
  };

  try {
    await t.test('addPayment — deux paiements concurrents avec solde insuffisant pour les deux : un seul passe, l\'autre est rejeté proprement (pas un crash)', async () => {
      const inv = await makeInvoice(1000);
      // 700 + 700 = 1400 > 1000 : les deux ne peuvent jamais passer ensemble,
      // mais chacun, pris isolément, passerait l'ancienne vérification en
      // mémoire si elle s'exécutait avant l'écriture de l'autre.
      const req = () => ({ params: { id: inv._id.toString() }, body: { montant: 700, mode: 'especes' }, user, ip: '127.0.0.1' });
      const [r1, r2] = await Promise.all([call(finC.addPayment, req()), call(finC.addPayment, req())]);

      const statuses = [r1.status, r2.status].sort();
      assert.deepEqual(statuses, [200, 400], 'exactement un des deux appels concurrents doit réussir (200), l\'autre doit être refusé proprement (400), jamais les deux réussis ni un crash');
      const echec = r1.status === 400 ? r1 : r2;
      assert.equal(echec.body.success, false);
      assert.match(echec.body.message, /solde restant/i, 'le rejet doit être une vraie réponse d\'erreur explicite, pas un plantage silencieux');

      // Preuve en base : un seul paiement de 700 a été réellement persisté,
      // jamais deux, jamais un montant_restant négatif.
      const relu = await Invoice.findById(inv._id).lean();
      assert.equal(relu.paiements.length, 1, 'un seul des deux paiements concurrents doit avoir été réellement écrit en base');
      assert.equal(relu.montant_paye, 700);
      assert.equal(relu.montant_restant, 300);
      assert.ok(relu.montant_restant >= 0, 'montant_restant ne doit jamais devenir négatif');
      assert.equal(relu.statut, 'partiellement_payee');
    });

    await t.test('addPayment — non-régression : un paiement normal, seul, fonctionne toujours (partiel puis solde complet)', async () => {
      const inv = await makeInvoice(1000);

      const { status: s1, body: b1 } = await call(finC.addPayment, { params: { id: inv._id.toString() }, body: { montant: 400, mode: 'mobile_money', reference: 'REF-116' }, user, ip: '127.0.0.1' });
      assert.equal(s1, 200);
      assert.equal(b1.invoice.montant_paye, 400);
      assert.equal(b1.invoice.montant_restant, 600);
      assert.equal(b1.invoice.statut, 'partiellement_payee');

      const { status: s2, body: b2 } = await call(finC.addPayment, { params: { id: inv._id.toString() }, body: { montant: 600, mode: 'especes' }, user, ip: '127.0.0.1' });
      assert.equal(s2, 200);
      assert.equal(b2.invoice.montant_paye, 1000);
      assert.equal(b2.invoice.montant_restant, 0);
      assert.equal(b2.invoice.statut, 'payee', 'le statut doit être dérivé correctement à payee une fois le solde entièrement réglé');

      const relu = await Invoice.findById(inv._id).lean();
      assert.equal(relu.paiements.length, 2, 'les deux paiements successifs (non concurrents) doivent tous les deux être réellement persistés');
    });

    await t.test('addPayment — montant supérieur au solde restant refusé (400), aucune écriture', async () => {
      const inv = await makeInvoice(500);
      const { status, body } = await call(finC.addPayment, { params: { id: inv._id.toString() }, body: { montant: 600, mode: 'especes' }, user, ip: '127.0.0.1' });
      assert.equal(status, 400);
      assert.equal(body.success, false);
      const relu = await Invoice.findById(inv._id).lean();
      assert.equal(relu.paiements.length, 0, 'aucun paiement ne doit être écrit quand le montant dépasse le solde restant');
    });

    await t.test('updateStatut(payee) — deux appels concurrents (double-clic) sur le même solde restant : un seul enregistre le solde comme paiement, l\'autre est rejeté (409), jamais un double paiement', async () => {
      const inv = await makeInvoice(500);
      const req = () => ({ params: { id: inv._id.toString() }, body: { statut: 'payee' }, user, ip: '127.0.0.1' });
      const [r1, r2] = await Promise.all([call(finC.updateStatut, req()), call(finC.updateStatut, req())]);

      const statuses = [r1.status, r2.status].sort();
      assert.deepEqual(statuses, [200, 409], 'exactement un des deux appels concurrents doit réussir (200), l\'autre doit recevoir un conflit explicite (409), jamais les deux réussis');

      const relu = await Invoice.findById(inv._id).lean();
      assert.equal(relu.paiements.length, 1, 'un seul paiement synthétique du solde restant doit avoir été réellement écrit, jamais deux');
      assert.equal(relu.montant_paye, 500);
      assert.equal(relu.montant_restant, 0);
      assert.equal(relu.statut, 'payee');
    });
  } finally {
    for (const inv of created.invoices) await Invoice.findByIdAndDelete(inv._id);
    await User.findByIdAndDelete(user._id);
    await mongoose.disconnect();
  }
});
