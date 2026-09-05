// Sous-phase 5.1 (relecture du 6 sept. 2026) — Pharmacy.jsx affichait
// "Ventes aujourd'hui"/"Ventes ce mois" toujours à 0 CFA (kpis.ventes_jour/
// ventes_mois codés en dur côté frontend ET côté backend getStats), avec un
// badge de tendance fabriqué ("↑ 12% vs hier") au-dessus d'une valeur figée
// à zéro, un graphique "Mouvements de stock — 30 jours" et "Évolution des
// ventes — 12 mois" tous deux fixes, un "Top 5 médicaments vendus" fixe, et
// un "Journal d'audit" (opérations totales/entrées/dispensations/...) fixe.
//
// Cause racine plus profonde que le simple affichage : createVente()
// décrémentait bien le stock (atomique, AUDIT-2.1) mais ne posait JAMAIS de
// mouvement pour la vente réussie — aucune trace persistée du montant réel
// vendu nulle part, rendant tout calcul honnête de "ventes" impossible sans
// corriger d'abord cette lacune.
//
// Ce test vérifie, base réelle : 1) createVente() persiste désormais un
// mouvement réel type:'vente' avec le montant exact ; 2) getStats() calcule
// réellement ventes_jour/ventes_mois depuis ces mouvements réels ; 3) une
// vente ratée en cours de boucle (stock insuffisant sur un article) ne
// laisse aucun mouvement 'vente' fantôme pour les articles déjà décrémentés
// puis recrédités.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Sous-phase 5.1 (Pharmacy) — ventes réellement persistées et agrégées', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Medication = require('../models/Medication');
  const pharmaC = require('../controllers/pharmacy.controller');

  const stamp = Date.now();
  const created = { meds: [] };
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'T51', nom: 'Pharma', role: 'pharmacien' };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('createVente() — persiste un vrai mouvement type:vente avec le montant exact', async () => {
      const med = await Medication.create({ nom_commercial: `T51-Med-${stamp}`, forme: 'comprime', stock_actuel: 100, statut: 'disponible' });
      created.meds.push(med._id);

      const { status, body } = await call(pharmaC.createVente, {
        body: { client: 'Client Test', mode_paiement: 'especes', items: [{ medicament_id: med._id.toString(), quantite: 3, prix_unitaire: 500 }] },
        user, ip: '127.0.0.1',
      });
      assert.equal(status, 201, JSON.stringify(body));
      assert.equal(body.vente.total, 1500);

      const fresh = await Medication.findById(med._id).lean();
      assert.equal(fresh.stock_actuel, 97, 'stock doit être réellement décrémenté (100 - 3)');
      const mvtVente = fresh.mouvements.find(m => m.type === 'vente');
      assert.ok(mvtVente, 'un mouvement réel type:vente doit être persisté — c\'était totalement absent avant cette correction');
      assert.equal(mvtVente.montant, 1500, 'le montant du mouvement doit être exact (3 x 500)');
      assert.equal(mvtVente.quantite, 3);
    });

    await t.test('createVente() — vente partiellement ratée : aucun mouvement vente fantôme sur les articles recrédités', async () => {
      const medA = await Medication.create({ nom_commercial: `T51-MedA-${stamp}`, forme: 'comprime', stock_actuel: 10, statut: 'disponible' });
      const medB = await Medication.create({ nom_commercial: `T51-MedB-${stamp}`, forme: 'comprime', stock_actuel: 1, statut: 'disponible' });
      created.meds.push(medA._id, medB._id);

      const { status } = await call(pharmaC.createVente, {
        body: { client: 'Client Test 2', mode_paiement: 'especes', items: [
          { medicament_id: medA._id.toString(), quantite: 5, prix_unitaire: 200 },
          { medicament_id: medB._id.toString(), quantite: 5, prix_unitaire: 200 }, // stock insuffisant (1 < 5)
        ] },
        user, ip: '127.0.0.1',
      });
      assert.equal(status, 400, 'la vente entière doit échouer si un article a un stock insuffisant');

      const freshA = await Medication.findById(medA._id).lean();
      assert.equal(freshA.stock_actuel, 10, 'stock de medA doit être recrédité intégralement');
      assert.equal(freshA.mouvements.some(m => m.type === 'vente'), false, 'aucun mouvement vente fantôme ne doit rester pour une vente globalement ratée');
      assert.ok(freshA.mouvements.some(m => m.type === 'retour'), 'le rollback réel (retour) doit être tracé');
    });

    await t.test('getStats() — ventes_jour/ventes_mois calculés réellement depuis les vrais mouvements vente, jamais figés à 0', async () => {
      const med = await Medication.create({ nom_commercial: `T51-Stats-${stamp}`, forme: 'comprime', stock_actuel: 50, statut: 'disponible' });
      created.meds.push(med._id);

      await call(pharmaC.createVente, {
        body: { client: 'Client Stats', mode_paiement: 'especes', items: [{ medicament_id: med._id.toString(), quantite: 2, prix_unitaire: 1000 }] },
        user, ip: '127.0.0.1',
      });

      const { status, body } = await call(pharmaC.getStats, {});
      assert.equal(status, 200, JSON.stringify(body));
      assert.ok(body.kpis.ventes_jour >= 2000, `ventes_jour doit refléter la vraie vente réalisée à l'instant (>= 2000), obtenu ${body.kpis.ventes_jour}`);
      assert.ok(body.kpis.ventes_mois >= 2000, `ventes_mois doit refléter la vraie vente réalisée ce mois-ci (>= 2000), obtenu ${body.kpis.ventes_mois}`);
    });
  } finally {
    await Medication.deleteMany({ _id: { $in: created.meds } });
    await mongoose.disconnect();
  }
});
