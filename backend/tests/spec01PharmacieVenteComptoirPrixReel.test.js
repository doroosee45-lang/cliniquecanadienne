// SPEC-01 (correction du 12 sept. 2026, audit indépendant) —
// createVente() calculait le montant vendu depuis item.prix_unitaire, fourni
// tel quel par le client — jamais recontrôlé contre Medication.prix_vente.
// L'interface livrée (Pharmacy.jsx) n'expose elle-même aucun champ prix
// éditable pour cette action (elle envoie déjà med.prix_vente), mais l'API
// elle-même ne protégeait rien : un appel direct pouvait vendre un
// médicament à n'importe quel prix fabriqué.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('SPEC-01 — le prix réellement facturé vient toujours de Medication.prix_vente, jamais du client', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Medication = require('../models/Medication');
  const pharmC = require('../controllers/pharmacy.controller');

  const stamp = Date.now();
  const call = async (req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await pharmC.createVente(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const med = await Medication.create({ nom_commercial: `SPEC01-Med-${stamp}`, stock_actuel: 20, prix_vente: 1500, prix_achat: 800 });
  const user = { _id: new mongoose.Types.ObjectId(), ip: '127.0.0.1' };

  try {
    await t.test('un prix_unitaire fabriqué (1 CFA) envoyé par le client est totalement ignoré — le vrai prix catalogue (1500) est facturé', async () => {
      const { status, body } = await call({ user, ip: '127.0.0.1', body: { client: 'Test', mode_paiement: 'especes', items: [{ medicament_id: med._id.toString(), quantite: 2, prix_unitaire: 1 }] } });
      assert.equal(status, 201);
      assert.equal(body.vente.total, 3000, 'le total doit être 2 x 1500 (prix catalogue réel), jamais 2 x 1 (prix fabriqué par le client)');
      assert.equal(body.vente.items[0].prix_unitaire, 1500);

      const fresh = await Medication.findById(med._id).lean();
      assert.equal(fresh.stock_actuel, 18);
      const mvt = fresh.mouvements.find(m => m.type === 'vente');
      assert.equal(mvt.montant, 3000, 'le mouvement de stock (ledger réel) doit refléter le vrai montant, jamais celui fabriqué par le client');
    });

    await t.test('un prix_unitaire exagéré (999999) envoyé par le client est également ignoré', async () => {
      const { body } = await call({ user, ip: '127.0.0.1', body: { client: 'Test', mode_paiement: 'especes', items: [{ medicament_id: med._id.toString(), quantite: 1, prix_unitaire: 999999 }] } });
      assert.equal(body.vente.total, 1500);
    });

    await t.test('un prix_unitaire absent du tout fonctionne également (le serveur ne dépend jamais du client pour le prix)', async () => {
      const { status, body } = await call({ user, ip: '127.0.0.1', body: { client: 'Test', mode_paiement: 'especes', items: [{ medicament_id: med._id.toString(), quantite: 1 }] } });
      assert.equal(status, 201);
      assert.equal(body.vente.total, 1500);
    });
  } finally {
    await Medication.findByIdAndDelete(med._id);
    await mongoose.disconnect();
  }
});
