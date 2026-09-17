// MODULE AI — sous-module Finance (implémentation réelle demandée
// explicitement pour remplacer le placeholder "🚧 Fonctionnalité en cours
// de développement" posé en Sous-phase 5.6 à la place de "prévisions
// financières" (30 jours, chiffres fixes) et d'une "détection
// d'anomalies" entièrement fabriquées).
//
// ai.controller.js::getFinanceInsights ne prédit rien : évolution réelle
// du CA (Invoice.montant_paye, même source que finance.controller.js::
// stats), factures impayées > 30j réelles, dépenses par catégorie
// réellement en hausse vs le mois précédent — aucun seuil arbitraire
// inventé.
//
// Données synthétiques de démonstration — aucune donnée patient/
// financière réelle. Comparaison AVANT/APRÈS (delta) car ce test tourne
// contre la base Atlas partagée, qui peut déjà contenir de vraies
// factures/dépenses indépendantes de ce test.
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

test('AI/Finance — getFinanceInsights calcule une vraie évolution du CA et de vraies anomalies, jamais une prévision inventée (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Invoice = require('../models/Invoice');
  const Depense = require('../models/Depense');
  const aiC = require('../controllers/ai.controller');

  const stamp = Date.now();
  const cleanup = [];

  try {
    const avant = await call(aiC.getFinanceInsights, {});
    assert.equal(avant.status, 200, JSON.stringify(avant.body));
    const baseCaMoisActuel = avant.body.evolution_ca.data[5];
    const baseImpayeesCount = avant.body.factures_impayees_30j.count;
    const baseImpayeesTotal = avant.body.factures_impayees_30j.total;

    // Facture réellement payée ce mois — doit compter dans le CA du mois en
    // cours. Invoice.pre('save') recalcule montant_paye depuis paiements[]
    // (voir models/Invoice.js) : un vrai paiement doit y figurer, jamais
    // juste le champ montant_paye assigné directement (écrasé sinon).
    const invPayee = await Invoice.create({
      numero_facture: `AIFIN-PAYEE-${stamp}`, patient_nom: 'Synthetique', montant_ttc: 15000,
      paiements: [{ montant: 15000, mode: 'especes' }],
      statut: 'payee', date_facture: new Date(),
    });
    cleanup.push(() => Invoice.findByIdAndDelete(invPayee._id));

    // Facture réellement impayée depuis 40 jours — doit compter dans les anomalies.
    const invImpayee = await Invoice.create({
      numero_facture: `AIFIN-IMPAYEE-${stamp}`, patient_nom: 'Synthetique', montant_ttc: 8000,
      montant_paye: 0, montant_restant: 8000, statut: 'emise', date_facture: new Date(Date.now() - 40 * 86400000),
    });
    cleanup.push(() => Invoice.findByIdAndDelete(invImpayee._id));

    await t.test('évolution du CA reflète le vrai paiement encaissé ce mois-ci', async () => {
      const r = await call(aiC.getFinanceInsights, {});
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.evolution_ca.data[5] - baseCaMoisActuel, 15000, 'le CA du mois en cours doit augmenter exactement du vrai paiement encaissé');
      assert.equal(r.body.evolution_ca.labels.length, 6);
    });

    await t.test('facture impayée > 30j réellement détectée, montant réel — jamais un chiffre inventé', async () => {
      const r = await call(aiC.getFinanceInsights, {});
      assert.equal(r.body.factures_impayees_30j.count - baseImpayeesCount, 1);
      assert.equal(r.body.factures_impayees_30j.total - baseImpayeesTotal, 8000, 'le montant restant réel de la facture impayée');
    });

    // Dépenses catégorie "Maintenance" : plus ce mois-ci que le mois
    // précédent — doit apparaître dans depenses_en_hausse.
    const now = new Date();
    const moisPrecedent = new Date(now.getFullYear(), now.getMonth() - 1, 10);
    const depPrecedente = await Depense.create({ categorie: 'Maintenance', description: `Test synthétique ${stamp}`, montant: 5000, date: moisPrecedent, statut: 'paye' });
    cleanup.push(() => Depense.findByIdAndDelete(depPrecedente._id));
    const depActuelle = await Depense.create({ categorie: 'Maintenance', description: `Test synthétique ${stamp}`, montant: 12000, date: now, statut: 'paye' });
    cleanup.push(() => Depense.findByIdAndDelete(depActuelle._id));

    await t.test('dépense en hausse réellement détectée (mois actuel > mois précédent), jamais un seuil inventé', async () => {
      const r = await call(aiC.getFinanceInsights, {});
      const maintenance = r.body.depenses_en_hausse.find(d => d.categorie === 'Maintenance');
      assert.ok(maintenance, 'la catégorie Maintenance doit apparaître comme en hausse');
      assert.ok(maintenance.montant_mois >= 12000, 'le montant réel du mois en cours (peut inclure d\'autres dépenses réelles préexistantes)');
      assert.ok(maintenance.montant_mois_precedent >= 5000, 'le montant réel du mois précédent');
      assert.ok(maintenance.montant_mois > maintenance.montant_mois_precedent, 'seules les catégories réellement en hausse doivent apparaître');
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
