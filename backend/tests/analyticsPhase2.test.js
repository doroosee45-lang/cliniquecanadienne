// AUDIT-ANALYTICS-P2 — trends réels "vs période précédente", jamais une
// évolution inventée. Deux mécanismes distincts vérifiés séparément :
// 1. getStats().trends — période précédente de même durée, immédiatement
//    avant celle choisie. Entièrement paramétrable (date_debut/date_fin),
//    donc testé de façon déterministe sur une année dédiée (2033), aucune
//    vraie donnée de production ne peut s'y trouver.
// 2. getReport().charts.revenus_par_service.trends — mois civil réel actuel
//    vs mois civil réel précédent (l'horloge n'est pas paramétrable dans le
//    contrôleur), donc testé par DELTA : mesure avant/après l'ajout d'une
//    facture réelle connue, pas une valeur absolue attendue à l'avance.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Analytics Phase 2 — trends réels vs période précédente (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Invoice = require('../models/Invoice');
  const Depense = require('../models/Depense');
  const analyticsC = require('../controllers/analytics.controller');

  const stamp = Date.now();
  const created = { patients: [], invoices: [], depenses: [] };

  const call = async (fn, req = {}) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('getStats().trends — période précédente réellement calculée (année dédiée 2033)', async () => {
      // Fenêtre courante : 1er avril - 30 juin 2033 (91 jours). La fenêtre
      // précédente attendue est donc les 91 jours immédiatement avant le
      // 1er avril, soit ~1er janvier - 31 mars 2033.
      const curDebut = '2033-04-01', curFin = '2033-06-30';

      // 2 patients dans la fenêtre courante, 1 dans la fenêtre précédente.
      const p1 = await Patient.create({ nom: `T-ANLP2-c1-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      const p2 = await Patient.create({ nom: `T-ANLP2-c2-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      const p3 = await Patient.create({ nom: `T-ANLP2-prev-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      created.patients.push(p1, p2, p3);
      await Patient.collection.updateOne({ _id: p1._id }, { $set: { createdAt: new Date('2033-05-01T10:00:00Z') } });
      await Patient.collection.updateOne({ _id: p2._id }, { $set: { createdAt: new Date('2033-06-01T10:00:00Z') } });
      await Patient.collection.updateOne({ _id: p3._id }, { $set: { createdAt: new Date('2033-02-01T10:00:00Z') } });

      // CA : 20000 dans la fenêtre courante, 10000 dans la précédente —
      // trend attendu = +100%.
      const invCur = await Invoice.create({ patient_nom: `T-ANLP2-${stamp}`, service_label: 'Test', montant_ht: 20000, montant_ttc: 20000, montant_paye: 20000, statut: 'payee', date_facture: new Date('2033-05-15'), created_by: new mongoose.Types.ObjectId() });
      const invPrev = await Invoice.create({ patient_nom: `T-ANLP2-${stamp}`, service_label: 'Test', montant_ht: 10000, montant_ttc: 10000, montant_paye: 10000, statut: 'payee', date_facture: new Date('2033-02-15'), created_by: new mongoose.Types.ObjectId() });
      created.invoices.push(invCur, invPrev);
      await Invoice.collection.updateOne({ _id: invCur._id },  { $set: { createdAt: new Date('2033-05-15T10:00:00Z') } });
      await Invoice.collection.updateOne({ _id: invPrev._id }, { $set: { createdAt: new Date('2033-02-15T10:00:00Z') } });

      // Dépenses réelles : 5000 courant, 5000 précédent → trend 0%/null
      // (realTrend renvoie un pct de 0 pour une valeur inchangée, pas null
      // — null est réservé au cas previous<=0).
      const depCur = await Depense.create({ date: new Date('2033-05-10'), categorie: 'Autre', description: 'T', montant: 5000, statut: 'paye' });
      const depPrev = await Depense.create({ date: new Date('2033-02-10'), categorie: 'Autre', description: 'T', montant: 5000, statut: 'paye' });
      created.depenses.push(depCur, depPrev);

      const { status, body } = await call(analyticsC.getStats, { query: { periode: 'custom', date_debut: curDebut, date_fin: curFin } });
      assert.equal(status, 200);
      assert.ok(body.trends, 'la réponse doit inclure un objet trends');

      assert.equal(body.kpi.patients_nouveaux, 2, 'sanity — 2 patients dans la fenêtre courante');
      assert.ok(body.trends.patients_nouveaux, 'trend patients_nouveaux doit exister (précédent=1, non nul)');
      assert.equal(body.trends.patients_nouveaux.pct, 100, '2 vs 1 précédent = +100%');
      assert.equal(body.trends.patients_nouveaux.sens, 'up');

      assert.equal(body.kpi.ca_total, 20000);
      assert.ok(body.trends.ca_total);
      assert.equal(body.trends.ca_total.pct, 100, '20000 vs 10000 précédent = +100%');

      assert.equal(body.kpi.depenses, 5000, 'depenses doit maintenant venir du vrai modèle Depense, plus de ca_total*0.28');
      assert.ok(body.trends.depenses);
      assert.equal(body.trends.depenses.pct, 0, '5000 vs 5000 précédent = 0%, pas null (previous > 0)');
      assert.equal(body.trends.depenses.sens, 'neutral');
    });

    await t.test('getStats().trends — jamais de trend inventé quand la période précédente est à 0', async () => {
      // Fenêtre sans aucune activité précédente connue (année 2034 entière,
      // dédiée, jamais peuplée) : le trend doit être null, pas un chiffre.
      const { status, body } = await call(analyticsC.getStats, { query: { periode: 'custom', date_debut: '2034-01-01', date_fin: '2034-01-31' } });
      assert.equal(status, 200);
      assert.equal(body.trends.patients_nouveaux, null);
      assert.equal(body.trends.ca_total, null);
    });

    await t.test('getReport().charts.revenus_par_service.trends — vérifié par delta réel (mois civil réel)', async () => {
      const { body: before } = await call(analyticsC.getReport);
      // "Autre" peut être totalement absente (aucune vraie facture n'a
      // encore cette catégorie sur cette base) — une catégorie sans aucune
      // donnée n'apparaît pas du tout dans l'agrégation, ce qui équivaut à
      // un total de 0, pas une erreur.
      const idxAvant = before.charts.revenus_par_service.labels.indexOf('Autre');
      const totalAvant = idxAvant !== -1 ? before.charts.revenus_par_service.data[idxAvant] : 0;

      // Facture réelle datée du mois civil courant, catégorie "autre".
      const now = new Date();
      const dansCeMois = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0);
      const inv = await Invoice.create({
        patient_nom: `T-ANLP2-mois-${stamp}`, service_label: 'Test', montant_ht: 7777, montant_ttc: 7777, montant_paye: 7777,
        statut: 'payee', date_facture: dansCeMois,
        lignes: [{ libelle: 'Test P2', categorie: 'autre', prix_unitaire: 7777, quantite: 1, montant: 7777 }],
        created_by: new mongoose.Types.ObjectId(),
      });
      created.invoices.push(inv);

      const { body: after } = await call(analyticsC.getReport);
      const idxApres = after.charts.revenus_par_service.labels.indexOf('Autre');
      assert.ok(idxApres !== -1, '"Autre" doit exister maintenant, la facture qu\'on vient d\'ajouter en porte une ligne');
      const totalApres = after.charts.revenus_par_service.data[idxApres];
      assert.equal(totalApres, totalAvant + 7777, 'le total (toutes dates confondues) doit augmenter exactement du montant ajouté');

      // Le trend de "Autre" doit refléter un mois actuel (au moins 7777)
      // par rapport au mois précédent, réellement recalculé — pas un
      // littéral de tableau fixe comme avant (l'ancien code utilisait
      // [12,8,-2,15,6,22][i], indépendant de toute vraie donnée).
      const trendAutre = after.charts.revenus_par_service.trends[idxApres];
      // Ne peut pas prédire le pct exact (d'autres factures réelles de ce
      // mois existent peut-être déjà), seulement que la structure et le
      // signe sont cohérents avec un vrai calcul quand le mois précédent
      // est non nul.
      if (trendAutre !== null) {
        assert.equal(typeof trendAutre.pct, 'number');
        assert.ok(['up','down','neutral'].includes(trendAutre.sens));
      }
    });
  } finally {
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id);
    for (const inv of created.invoices) await Invoice.findByIdAndDelete(inv._id);
    for (const dep of created.depenses) await Depense.findByIdAndDelete(dep._id);
    await mongoose.disconnect();
  }
});
