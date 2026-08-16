// R-14 (Pharmacie) — getCommandes/createCommande étaient des stubs : la
// liste retournait toujours [], la création ne persistait jamais rien
// (echo de req.body avec un numéro généré côté client, aucun modèle
// Commande n'existait). Ce test vérifie la persistance réelle, la
// génération atomique de numéro, et que la réception incrémente le stock
// uniquement pour les lignes rattachées à une fiche Medication — même
// limite que la dispensation (pharmacy.controller.js::dispenser).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('bons de commande pharmacie (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Commande = require('../models/Commande');
  const Medication = require('../models/Medication');
  const pharmaC = require('../controllers/pharmacy.controller');

  const stamp = Date.now();
  const med = await Medication.create({ nom_commercial: `T14-Med-${stamp}`, stock_actuel: 5, forme: 'comprime' });
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Admin', nom: 'Test' };
  let createdId;

  try {
    let body = null, status = 200;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };

    await t.test('createCommande persiste réellement et génère un numéro atomique', async () => {
      await pharmaC.createCommande({
        user,
        body: {
          fournisseur: 'Fournisseur Test',
          lignes: [
            { medicament: med._id, nom: med.nom_commercial, quantite: 10, prix_unitaire: 500 },
            { nom: 'Ligne texte libre sans stock', quantite: 3, prix_unitaire: 200 },
          ],
        },
      }, res, () => {});
      assert.equal(status, 201);
      assert.ok(body.commande.numero?.startsWith('BC-'));
      createdId = body.commande._id;
      assert.equal(body.commande.montant, 10 * 500 + 3 * 200);
      assert.equal(body.commande.nb_lignes, 2);

      const inDb = await Commande.findById(createdId);
      assert.ok(inDb, 'doit exister réellement en base');
      assert.equal(inDb.statut, 'brouillon');
    });

    await t.test('getCommandes retourne la commande créée', async () => {
      body = null;
      await pharmaC.getCommandes({ query: {} }, res, () => {});
      const found = body.commandes.find(c => String(c._id) === String(createdId));
      assert.ok(found);
      assert.equal(found.fournisseur, 'Fournisseur Test');
    });

    await t.test('réception partielle incrémente le stock seulement pour la ligne liée à une fiche Medication', async () => {
      body = null; status = 200;
      await pharmaC.receptionCommande({
        params: { id: createdId }, user,
        body: { receptions: [{ index: 0, quantite_recue: 4 }, { index: 1, quantite_recue: 3 }] },
      }, res, () => {});
      assert.equal(status, 200);
      assert.equal(body.commande.statut, 'recu_partiel', 'ligne 0 pas totalement reçue (4/10)');

      const medAfter = await Medication.findById(med._id);
      assert.equal(medAfter.stock_actuel, 9, '5 initial + 4 reçus sur la ligne liée');
      assert.equal(medAfter.mouvements.some(m => m.type === 'entree' && m.reference === body.commande.numero), true);
    });

    await t.test('compléter la réception passe le statut à recu', async () => {
      body = null; status = 200;
      await pharmaC.receptionCommande({
        params: { id: createdId }, user,
        body: { receptions: [{ index: 0, quantite_recue: 6 }] },
      }, res, () => {});
      assert.equal(status, 200);
      assert.equal(body.commande.statut, 'recu');
      assert.ok(body.commande.date_reception);

      const medAfter = await Medication.findById(med._id);
      assert.equal(medAfter.stock_actuel, 15, '9 + 6 derniers reçus');
    });

    await t.test('réceptionner une commande déjà reçue est refusé', async () => {
      body = null; status = 200;
      await pharmaC.receptionCommande({ params: { id: createdId }, user, body: { receptions: [{ index: 0, quantite_recue: 1 }] } }, res, () => {});
      assert.equal(status, 400);
    });

    await t.test('createCommande refuse une commande sans ligne', async () => {
      body = null; status = 200;
      await pharmaC.createCommande({ user, body: { fournisseur: 'X', lignes: [] } }, res, () => {});
      assert.equal(status, 400);
    });
  } finally {
    if (createdId) await Commande.findByIdAndDelete(createdId);
    await Medication.findByIdAndDelete(med._id);
    await mongoose.disconnect();
  }
});
