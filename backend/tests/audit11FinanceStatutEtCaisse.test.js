// AUDIT-11 (audit complet post-Phase 10) — deux actions de Finance.jsx
// n'avaient jamais de vrai backend :
// - PUT /finance/:id (changement de statut de facture) n'avait aucune route
//   du tout ; l'appel échouait en 404, l'erreur était avalée (catch vide
//   côté frontend), et l'interface affichait quand même un succès.
// - POST /finance/caisse était un stub inline qui renvoyait
//   { success:true } sans jamais toucher la base.
// Ce test prouve que les deux persistent réellement, pas seulement qu'ils
// répondent 200/201.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-11 — finance.controller.js::updateStatut et ::caisse persistent réellement (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const finC = require('../controllers/finance.controller');
  const Invoice = require('../models/Invoice');
  const Depense = require('../models/Depense');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Comptable', nom: 'Test' };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const cleanup = [];

  try {
    await t.test('updateStatut — payee sans paiement existant enregistre le solde restant comme un vrai paiement (pas juste le champ statut)', async () => {
      const inv = await Invoice.create({ patient_nom: `T11-${stamp}`, service_label: 'Consultation', montant_ttc: 15000, lignes: [{ libelle: 'Consultation', categorie: 'consultation', prix_unitaire: 15000, quantite: 1, montant: 15000 }] });
      cleanup.push(() => Invoice.findByIdAndDelete(inv._id));
      assert.equal(inv.statut, 'emise');
      assert.equal(inv.montant_restant, 15000);

      const { status, body } = await call(finC.updateStatut, { params: { id: inv._id }, body: { statut: 'payee' }, user, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.invoice.statut, 'paye');

      const fresh = await Invoice.findById(inv._id).lean();
      assert.equal(fresh.statut, 'payee');
      assert.equal(fresh.montant_restant, 0, 'montant_restant doit refléter le paiement réellement enregistré, pas juste afficher payee');
      assert.equal(fresh.montant_paye, 15000);
      assert.equal(fresh.paiements.length, 1, 'un vrai mouvement de paiement doit avoir été créé');
    });

    await t.test('updateStatut — annulee (aucune ambiguïté de montant) s\'applique directement', async () => {
      const inv = await Invoice.create({ patient_nom: `T11b-${stamp}`, service_label: 'Consultation', montant_ttc: 5000, lignes: [{ libelle: 'Consultation', categorie: 'consultation', prix_unitaire: 5000, quantite: 1, montant: 5000 }] });
      cleanup.push(() => Invoice.findByIdAndDelete(inv._id));

      const { status } = await call(finC.updateStatut, { params: { id: inv._id }, body: { statut: 'annulee' }, user, ip: '127.0.0.1' });
      assert.equal(status, 200);
      const fresh = await Invoice.findById(inv._id).lean();
      assert.equal(fresh.statut, 'annulee');
    });

    await t.test('updateStatut — partiellement_payee refusé (400) sans paiement réel enregistré, aucun état inventé', async () => {
      const inv = await Invoice.create({ patient_nom: `T11c-${stamp}`, service_label: 'Consultation', montant_ttc: 8000, lignes: [{ libelle: 'Consultation', categorie: 'consultation', prix_unitaire: 8000, quantite: 1, montant: 8000 }] });
      cleanup.push(() => Invoice.findByIdAndDelete(inv._id));

      const { status } = await call(finC.updateStatut, { params: { id: inv._id }, body: { statut: 'partiellement_payee' }, user, ip: '127.0.0.1' });
      assert.equal(status, 400, 'sans montant réel connu, ce endpoint générique ne doit pas inventer un statut partiellement payé');
      const fresh = await Invoice.findById(inv._id).lean();
      assert.equal(fresh.statut, 'emise', 'le statut ne doit pas avoir changé après un refus');
    });

    await t.test('updateStatut — statut hors énumération refusé (400)', async () => {
      const inv = await Invoice.create({ patient_nom: `T11d-${stamp}`, service_label: 'Consultation', montant_ttc: 1000, lignes: [{ libelle: 'Consultation', categorie: 'consultation', prix_unitaire: 1000, quantite: 1, montant: 1000 }] });
      cleanup.push(() => Invoice.findByIdAndDelete(inv._id));
      const { status } = await call(finC.updateStatut, { params: { id: inv._id }, body: { statut: 'statut-qui-n-existe-pas' }, user, ip: '127.0.0.1' });
      assert.equal(status, 400);
    });

    await t.test('updateStatut — facture introuvable renvoie 404', async () => {
      const { status } = await call(finC.updateStatut, { params: { id: new mongoose.Types.ObjectId() }, body: { statut: 'payee' }, user, ip: '127.0.0.1' });
      assert.equal(status, 404);
    });

    await t.test('caisse — entree crée réellement une facture payée (pas un stub qui répond succès sans rien écrire)', async () => {
      const avant = await Invoice.countDocuments({ service_label: `T11-entree-${stamp}` });
      assert.equal(avant, 0);

      const { status, body } = await call(finC.caisse, { body: { type: 'entree', montant: 12000, libelle: `T11-entree-${stamp}`, mode: 'especes' }, user, ip: '127.0.0.1' });
      assert.equal(status, 201);
      assert.equal(body.type, 'entree');
      cleanup.push(() => Invoice.findByIdAndDelete(body.invoice._id));

      const fresh = await Invoice.findById(body.invoice._id).lean();
      assert.ok(fresh, 'la facture doit réellement exister en base');
      assert.equal(fresh.statut, 'payee');
      assert.equal(fresh.montant_ttc, 12000);
      assert.equal(fresh.montant_paye, 12000);
    });

    await t.test('caisse — sortie crée réellement une dépense (pas un stub)', async () => {
      const { status, body } = await call(finC.caisse, { body: { type: 'sortie', montant: 3000, libelle: `T11-sortie-${stamp}`, mode: 'especes' }, user, ip: '127.0.0.1' });
      assert.equal(status, 201);
      assert.equal(body.type, 'sortie');
      cleanup.push(() => Depense.findByIdAndDelete(body.depense._id));

      const fresh = await Depense.findById(body.depense._id).lean();
      assert.ok(fresh, 'la dépense doit réellement exister en base');
      assert.equal(fresh.montant, 3000);
      assert.equal(fresh.description, `T11-sortie-${stamp}`);
    });

    await t.test('caisse — montant invalide refusé (400), aucun document créé', async () => {
      const avantInv = await Invoice.countDocuments({});
      const avantDep = await Depense.countDocuments({});
      const { status } = await call(finC.caisse, { body: { type: 'entree', montant: 0, libelle: 'invalide' }, user, ip: '127.0.0.1' });
      assert.equal(status, 400);
      assert.equal(await Invoice.countDocuments({}), avantInv);
      assert.equal(await Depense.countDocuments({}), avantDep);
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
