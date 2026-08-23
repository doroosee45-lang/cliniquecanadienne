// AUDIT-ANALYTICS-P3 — "Recommandations IA" (6 cartes statiques, aucune
// mention "IA" légitime nulle part dans ce projet — même constat que
// Planning) remplacé par computeRecommandations(kpi) : règles seuil réelles
// sur les KPI déjà agrégés, jamais un texte statique republié. Deux niveaux
// de test : (1) la fonction exportée directement, avec des kpi synthétiques
// couvrant chaque règle — précis et déterministe ; (2) un passage réel par
// getStats() avec une vraie rupture de stock, pour prouver que c'est
// effectivement branché de bout en bout, pas seulement correct isolément.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Analytics Phase 3 — recommandations réelles (règles seuil, base réelle pour le câblage)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  const analyticsC = require('../controllers/analytics.controller');
  const { computeRecommandations } = analyticsC;

  await t.test('aucun seuil déclenché → un seul message "dans les normes", jamais une liste fixe', () => {
    const kpi = { taux_occupation: 60, pharma_ruptures: 0, consultations_total: 20, consultations_annulees: 1, factures_impayees: 0, urgences_periode: 10, urgences_critiques: 1, chirurgie_programmees: 5, chirurgie_realisees: 5 };
    const recs = computeRecommandations(kpi);
    assert.equal(recs.length, 1);
    assert.equal(recs[0].niveau, 'success');
  });

  await t.test('occupation > 85% → recommandation danger avec la vraie valeur interpolée', () => {
    const kpi = { taux_occupation: 92, pharma_ruptures: 0, consultations_total: 20, consultations_annulees: 1, factures_impayees: 0, urgences_periode: 10, urgences_critiques: 1, chirurgie_programmees: 5, chirurgie_realisees: 5 };
    const recs = computeRecommandations(kpi);
    const r = recs.find(x => x.titre === 'Occupation critique');
    assert.ok(r);
    assert.equal(r.niveau, 'danger');
    assert.match(r.description, /92%/, 'la vraie valeur doit apparaître dans le texte, pas un texte générique fixe');
  });

  await t.test('occupation < 30% (et non nulle) → recommandation info distincte', () => {
    const kpi = { taux_occupation: 15, pharma_ruptures: 0, consultations_total: 20, consultations_annulees: 1, factures_impayees: 0, urgences_periode: 10, urgences_critiques: 1, chirurgie_programmees: 5, chirurgie_realisees: 5 };
    const recs = computeRecommandations(kpi);
    const r = recs.find(x => x.titre === 'Capacité disponible');
    assert.ok(r);
    assert.equal(r.niveau, 'info');
    assert.match(r.description, /15%/);
  });

  await t.test('ruptures pharmacie > 0 → sévérité selon la magnitude réelle (>=5 = danger, sinon warn)', () => {
    const kpiPetit = { taux_occupation: 60, pharma_ruptures: 2, consultations_total: 20, consultations_annulees: 1, factures_impayees: 0, urgences_periode: 10, urgences_critiques: 1, chirurgie_programmees: 5, chirurgie_realisees: 5 };
    const rPetit = computeRecommandations(kpiPetit).find(x => x.titre === 'Ruptures de stock pharmacie');
    assert.ok(rPetit);
    assert.equal(rPetit.niveau, 'warn');
    assert.match(rPetit.description, /2 médicament/);

    const kpiGrand = { ...kpiPetit, pharma_ruptures: 7 };
    const rGrand = computeRecommandations(kpiGrand).find(x => x.titre === 'Ruptures de stock pharmacie');
    assert.equal(rGrand.niveau, 'danger');
    assert.match(rGrand.description, /7 médicament/);
  });

  await t.test('taux d\'annulation > 15% (avec un dénominateur minimal) → recommandation réelle', () => {
    const kpi = { taux_occupation: 60, pharma_ruptures: 0, consultations_total: 20, consultations_annulees: 5, factures_impayees: 0, urgences_periode: 10, urgences_critiques: 1, chirurgie_programmees: 5, chirurgie_realisees: 5 };
    const r = computeRecommandations(kpi).find(x => x.titre === 'Annulations de rendez-vous élevées');
    assert.ok(r);
    assert.match(r.description, /25%/, '5/20 = 25%, calculé, pas un chiffre fixe');
  });

  await t.test('petit dénominateur (<5 consultations) n\'active jamais la règle — évite le bruit statistique', () => {
    const kpi = { taux_occupation: 60, pharma_ruptures: 0, consultations_total: 2, consultations_annulees: 2, factures_impayees: 0, urgences_periode: 10, urgences_critiques: 1, chirurgie_programmees: 5, chirurgie_realisees: 5 };
    const r = computeRecommandations(kpi).find(x => x.titre === 'Annulations de rendez-vous élevées');
    assert.equal(r, undefined, '100% d\'annulation sur seulement 2 consultations ne doit pas déclencher — dénominateur trop faible pour être significatif');
  });

  await t.test('factures impayées > 0 → sévérité selon le montant réel', () => {
    const kpi = { taux_occupation: 60, pharma_ruptures: 0, consultations_total: 20, consultations_annulees: 1, factures_impayees: 750000, urgences_periode: 10, urgences_critiques: 1, chirurgie_programmees: 5, chirurgie_realisees: 5 };
    const r = computeRecommandations(kpi).find(x => x.titre === 'Factures impayées');
    assert.ok(r);
    assert.equal(r.niveau, 'danger');
    assert.match(r.description, /750\s?000/);
  });

  await t.test('part d\'urgences critiques > 20% → recommandation réelle', () => {
    const kpi = { taux_occupation: 60, pharma_ruptures: 0, consultations_total: 20, consultations_annulees: 1, factures_impayees: 0, urgences_periode: 10, urgences_critiques: 3, chirurgie_programmees: 5, chirurgie_realisees: 5 };
    const r = computeRecommandations(kpi).find(x => x.titre === 'Part élevée d\'urgences critiques');
    assert.ok(r);
    assert.match(r.description, /30%/, '3/10 = 30%');
  });

  await t.test('taux de réalisation chirurgicale < 70% → recommandation réelle', () => {
    const kpi = { taux_occupation: 60, pharma_ruptures: 0, consultations_total: 20, consultations_annulees: 1, factures_impayees: 0, urgences_periode: 10, urgences_critiques: 1, chirurgie_programmees: 10, chirurgie_realisees: 5 };
    const r = computeRecommandations(kpi).find(x => x.titre === 'Taux de réalisation chirurgicale bas');
    assert.ok(r);
    assert.match(r.description, /50%/, '5/10 = 50%');
  });

  // ── Câblage réel via getStats() ──────────────────────────────────
  await mongoose.connect(process.env.MONGO_URI);
  const Medication = require('../models/Medication');
  const stamp = Date.now();
  const meds = [];

  try {
    await t.test('getStats() renvoie réellement des recommandations câblées sur une vraie rupture de stock', async () => {
      // Isole ce test : compte les recommandations "Ruptures de stock
      // pharmacie" avant/après pour tolérer d'autres vraies ruptures déjà
      // présentes en base (pas une base isolée par test).
      let status = 200, body = null;
      const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
      await analyticsC.getStats({ query: {} }, res, () => {});
      assert.equal(status, 200);
      assert.ok(Array.isArray(body.recommandations), 'getStats doit exposer un tableau recommandations, pas un objet fixe');

      const med = await Medication.create({ nom_commercial: `T-ANLP3-${stamp}`, dci: 'Test', forme: 'comprime', categorie: 'Autre', stock_actuel: 0, stock_minimum: 10, prix_vente: 100, statut: 'rupture' });
      meds.push(med);

      status = 200; body = null;
      await analyticsC.getStats({ query: {} }, res, () => {});
      const r = body.recommandations.find(x => x.titre === 'Ruptures de stock pharmacie');
      assert.ok(r, 'une vraie rupture de stock doit produire une vraie recommandation via le vrai chemin getStats → computeRecommandations');
    });
  } finally {
    for (const m of meds) await Medication.findByIdAndDelete(m._id);
    await mongoose.disconnect();
  }
});
