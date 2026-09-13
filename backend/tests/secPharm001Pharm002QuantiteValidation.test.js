// PHARM-001 / PHARM-002 (audit métier du 13 sept. 2026, Phase 4) —
// pharmacy.controller.js::mouvement() et ::receptionCommande() n'ont jamais
// validé le signe de la quantité reçue du client :
//   - mouvement() : pour un type "sortant" (sortie/dispensation/perte/
//     peremption), le delta appliqué était -quantite ; avec une quantite
//     négative, le stock AUGMENTAIT alors que l'opération était journalisée
//     comme une sortie. Pour un type "entrant", le delta était +quantite
//     directement, sans jamais passer par le garde stock_actuel>=quantite
//     (appliqué uniquement si sortant) : une quantite négative décrémentait
//     le stock sans limite plancher.
//   - receptionCommande() : $inc:{stock_actuel: r.quantite_recue} appliqué
//     tel quel, sans aucune garde de signe — une quantite_recue négative
//     décrémentait le stock tout en étant journalisée comme une "entrée".
// Corrigé en rejetant (400) toute quantité non strictement positive AVANT
// toute lecture/écriture, jamais une normalisation silencieuse (Math.abs
// aurait accepté une saisie erronée sans le signaler à l'appelant).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('PHARM-001 — mouvement() rejette toute quantité non strictement positive (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Medication = require('../models/Medication');
  const pharmaC = require('../controllers/pharmacy.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Pharm' };
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('sortie + quantité positive → acceptée, stock décrémenté, mouvement journalisé', async () => {
      const med = await Medication.create({ nom_commercial: `T-PHARM001-A-${stamp}`, stock_actuel: 50, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      const { status } = await call(pharmaC.mouvement, { params: { id: med._id }, body: { type: 'sortie', quantite: 10, reference: 'ref', notes: '' }, user });
      assert.equal(status, 200);
      const fresh = await Medication.findById(med._id).lean();
      assert.equal(fresh.stock_actuel, 40);
      assert.equal(fresh.mouvements.length, 1);
    });

    await t.test('entrée + quantité positive → acceptée, stock incrémenté', async () => {
      const med = await Medication.create({ nom_commercial: `T-PHARM001-B-${stamp}`, stock_actuel: 50, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      const { status } = await call(pharmaC.mouvement, { params: { id: med._id }, body: { type: 'entree', quantite: 10, reference: 'ref', notes: '' }, user });
      assert.equal(status, 200);
      const fresh = await Medication.findById(med._id).lean();
      assert.equal(fresh.stock_actuel, 60);
    });

    await t.test('sortie + quantité négative → refusée (400), stock inchangé, aucun mouvement fantôme', async () => {
      const med = await Medication.create({ nom_commercial: `T-PHARM001-C-${stamp}`, stock_actuel: 50, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      const { status, body } = await call(pharmaC.mouvement, { params: { id: med._id }, body: { type: 'sortie', quantite: -500, reference: 'ref', notes: '' }, user });
      assert.equal(status, 400);
      assert.match(body.message, /positif/i);
      const fresh = await Medication.findById(med._id).lean();
      assert.equal(fresh.stock_actuel, 50, 'le stock ne doit jamais avoir bougé (ni augmenté, ni diminué)');
      assert.equal(fresh.mouvements.length, 0, 'aucun mouvement ne doit être journalisé pour une tentative rejetée');
    });

    await t.test('entrée + quantité négative → refusée (400), stock inchangé', async () => {
      const med = await Medication.create({ nom_commercial: `T-PHARM001-D-${stamp}`, stock_actuel: 50, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      const { status } = await call(pharmaC.mouvement, { params: { id: med._id }, body: { type: 'entree', quantite: -30, reference: 'ref', notes: '' }, user });
      assert.equal(status, 400);
      const fresh = await Medication.findById(med._id).lean();
      assert.equal(fresh.stock_actuel, 50);
      assert.equal(fresh.mouvements.length, 0);
    });

    await t.test('sortie + quantité 0 → refusée (400)', async () => {
      const med = await Medication.create({ nom_commercial: `T-PHARM001-E-${stamp}`, stock_actuel: 50, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      const { status } = await call(pharmaC.mouvement, { params: { id: med._id }, body: { type: 'sortie', quantite: 0, reference: 'ref', notes: '' }, user });
      assert.equal(status, 400);
      const fresh = await Medication.findById(med._id).lean();
      assert.equal(fresh.stock_actuel, 50);
    });

    await t.test('entrée + quantité 0 → refusée (400)', async () => {
      const med = await Medication.create({ nom_commercial: `T-PHARM001-F-${stamp}`, stock_actuel: 50, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      const { status } = await call(pharmaC.mouvement, { params: { id: med._id }, body: { type: 'entree', quantite: 0, reference: 'ref', notes: '' }, user });
      assert.equal(status, 400);
      const fresh = await Medication.findById(med._id).lean();
      assert.equal(fresh.stock_actuel, 50);
    });

    await t.test('quantité non numérique → refusée (400), stock inchangé', async () => {
      const med = await Medication.create({ nom_commercial: `T-PHARM001-G-${stamp}`, stock_actuel: 50, forme: 'comprime' });
      cleanup.push(() => Medication.findByIdAndDelete(med._id));
      const { status } = await call(pharmaC.mouvement, { params: { id: med._id }, body: { type: 'sortie', quantite: 'abc', reference: 'ref', notes: '' }, user });
      assert.equal(status, 400);
      const fresh = await Medication.findById(med._id).lean();
      assert.equal(fresh.stock_actuel, 50);
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});

test('PHARM-002 — receptionCommande() rejette toute quantite_recue non strictement positive (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Medication = require('../models/Medication');
  const Commande = require('../models/Commande');
  const pharmaC = require('../controllers/pharmacy.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Pharm' };
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const newCommande = async (med) => Commande.create({
    fournisseur: 'Fournisseur Test', montant: 1000, cree_par: user._id,
    lignes: [{ medicament: med._id, nom: med.nom_commercial, quantite: 100, prix_unitaire: 10 }],
  });

  try {
    await t.test('quantite_recue > 0 → acceptée, stock incrémenté normalement', async () => {
      const med = await Medication.create({ nom_commercial: `T-PHARM002-A-${stamp}`, stock_actuel: 5, forme: 'comprime' });
      const commande = await newCommande(med);
      cleanup.push(() => Medication.findByIdAndDelete(med._id), () => Commande.findByIdAndDelete(commande._id));
      const { status } = await call(pharmaC.receptionCommande, { params: { id: commande._id }, user, body: { receptions: [{ index: 0, quantite_recue: 20 }] } });
      assert.equal(status, 200);
      const fresh = await Medication.findById(med._id).lean();
      assert.equal(fresh.stock_actuel, 25);
    });

    await t.test('quantite_recue = 0 → refusée (400), stock et commande inchangés', async () => {
      const med = await Medication.create({ nom_commercial: `T-PHARM002-B-${stamp}`, stock_actuel: 5, forme: 'comprime' });
      const commande = await newCommande(med);
      cleanup.push(() => Medication.findByIdAndDelete(med._id), () => Commande.findByIdAndDelete(commande._id));
      const { status, body } = await call(pharmaC.receptionCommande, { params: { id: commande._id }, user, body: { receptions: [{ index: 0, quantite_recue: 0 }] } });
      assert.equal(status, 400);
      assert.match(body.message, /positif/i);
      const freshMed = await Medication.findById(med._id).lean();
      const freshCmd = await Commande.findById(commande._id).lean();
      assert.equal(freshMed.stock_actuel, 5, 'stock inchangé');
      assert.equal(freshCmd.statut, 'brouillon', 'statut de la commande inchangé');
      assert.equal(freshCmd.lignes[0].quantite_recue, 0, 'aucune réception partielle appliquée');
    });

    await t.test('quantite_recue < 0 → refusée (400), stock inchangé', async () => {
      const med = await Medication.create({ nom_commercial: `T-PHARM002-C-${stamp}`, stock_actuel: 5, forme: 'comprime' });
      const commande = await newCommande(med);
      cleanup.push(() => Medication.findByIdAndDelete(med._id), () => Commande.findByIdAndDelete(commande._id));
      const { status } = await call(pharmaC.receptionCommande, { params: { id: commande._id }, user, body: { receptions: [{ index: 0, quantite_recue: -200 }] } });
      assert.equal(status, 400);
      const fresh = await Medication.findById(med._id).lean();
      assert.equal(fresh.stock_actuel, 5, 'le stock ne doit jamais avoir été décrémenté par une quantité négative');
    });

    await t.test('quantite_recue non numérique → refusée (400), stock inchangé', async () => {
      const med = await Medication.create({ nom_commercial: `T-PHARM002-D-${stamp}`, stock_actuel: 5, forme: 'comprime' });
      const commande = await newCommande(med);
      cleanup.push(() => Medication.findByIdAndDelete(med._id), () => Commande.findByIdAndDelete(commande._id));
      const { status } = await call(pharmaC.receptionCommande, { params: { id: commande._id }, user, body: { receptions: [{ index: 0, quantite_recue: 'beaucoup' }] } });
      assert.equal(status, 400);
      const fresh = await Medication.findById(med._id).lean();
      assert.equal(fresh.stock_actuel, 5);
    });

    await t.test('une entrée invalide au sein d\'une réception multi-lignes bloque tout le lot (aucune écriture partielle incohérente)', async () => {
      const med1 = await Medication.create({ nom_commercial: `T-PHARM002-E1-${stamp}`, stock_actuel: 5, forme: 'comprime' });
      const med2 = await Medication.create({ nom_commercial: `T-PHARM002-E2-${stamp}`, stock_actuel: 5, forme: 'comprime' });
      const commande = await Commande.create({
        fournisseur: 'Fournisseur Test', montant: 1000, cree_par: user._id,
        lignes: [
          { medicament: med1._id, nom: med1.nom_commercial, quantite: 100, prix_unitaire: 10 },
          { medicament: med2._id, nom: med2.nom_commercial, quantite: 100, prix_unitaire: 10 },
        ],
      });
      cleanup.push(() => Medication.findByIdAndDelete(med1._id), () => Medication.findByIdAndDelete(med2._id), () => Commande.findByIdAndDelete(commande._id));
      const { status } = await call(pharmaC.receptionCommande, {
        params: { id: commande._id }, user,
        body: { receptions: [{ index: 0, quantite_recue: 10 }, { index: 1, quantite_recue: -5 }] },
      });
      assert.equal(status, 400);
      const fresh1 = await Medication.findById(med1._id).lean();
      const fresh2 = await Medication.findById(med2._id).lean();
      assert.equal(fresh1.stock_actuel, 5, 'la ligne valide ne doit pas non plus être appliquée si une autre ligne du même lot est invalide');
      assert.equal(fresh2.stock_actuel, 5);
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
