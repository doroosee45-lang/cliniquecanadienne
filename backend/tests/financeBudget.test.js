// AUDIT-FINANCE-BUDGET — l'onglet Budget de Finance.jsx était intégralement
// fabriqué (DEMO_BUDGET = [], taux d'exécution rendait "NaN%"). Vérifie le
// calcul réel : réalisé = somme des vraies Depense (statut 'paye' seulement
// — 'en_attente' n'est pas "réalisé"), scopé à l'année civile ; écart et
// taux dérivés de ce réalisé + de la cible BudgetCible (jamais calculée,
// toujours saisie) ; upsert de la cible avec traçabilité AuditLog.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('budget par catégorie — calcul réel et upsert de cible (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Depense = require('../models/Depense');
  const BudgetCible = require('../models/BudgetCible');
  const AuditLog = require('../models/AuditLog');
  const finC = require('../controllers/finance.controller');

  const annee = 2031; // année dédiée au test, loin de toute vraie donnée
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Admin', nom: 'Test' };
  const createdDepenses = [];
  const createdCibles = [];

  try {
    let body = null, status = 200;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };

    // Médicaments : cible fixée + 2 dépenses payées + 1 en_attente (ne doit
    // PAS compter dans le réalisé) + 1 hors année (ne doit pas compter).
    createdCibles.push(await BudgetCible.create({ annee, categorie: 'Médicaments', montant_annuel: 10000 }));
    createdDepenses.push(await Depense.create({ date: new Date(annee, 3, 10), categorie: 'Médicaments', description: 'T', montant: 3000, statut: 'paye' }));
    createdDepenses.push(await Depense.create({ date: new Date(annee, 6, 5), categorie: 'Médicaments', description: 'T', montant: 2000, statut: 'paye' }));
    createdDepenses.push(await Depense.create({ date: new Date(annee, 6, 6), categorie: 'Médicaments', description: 'T (en attente)', montant: 5000, statut: 'en_attente' }));
    createdDepenses.push(await Depense.create({ date: new Date(annee - 1, 6, 6), categorie: 'Médicaments', description: 'T (année précédente)', montant: 9999, statut: 'paye' }));

    // Électricité : dépenses réelles mais AUCUNE cible fixée.
    createdDepenses.push(await Depense.create({ date: new Date(annee, 1, 1), categorie: 'Électricité', montant: 1500, description: 'T', statut: 'paye' }));

    await t.test('getBudget calcule réalisé/écart/taux par catégorie depuis les vraies Depense', async () => {
      body = null; status = 200;
      await finC.getBudget({ query: { annee: String(annee) } }, res, () => {});
      assert.equal(status, 200);

      const medoc = body.categories.find(c => c.categorie === 'Médicaments');
      assert.equal(medoc.budget_annuel, 10000);
      assert.equal(medoc.realise, 5000, 'seules les 2 dépenses payées de cette année (3000+2000), pas la en_attente ni celle de l\'année précédente');
      assert.equal(medoc.ecart, 5000);
      assert.equal(medoc.taux_execution, 50);

      const elec = body.categories.find(c => c.categorie === 'Électricité');
      assert.equal(elec.budget_annuel, 0, 'aucune cible fixée pour cette catégorie');
      assert.equal(elec.realise, 1500, 'le réalisé reste calculable même sans cible');
      assert.equal(elec.taux_execution, null, 'taux non calculable sans cible (division par zéro évitée)');

      const autre = body.categories.find(c => c.categorie === 'Salaires');
      assert.equal(autre.budget_annuel, 0);
      assert.equal(autre.realise, 0);
      assert.equal(autre.taux_execution, null);

      assert.equal(body.budget_total_annuel, 10000, 'somme des cibles fixées (seule Médicaments en a une)');
      assert.equal(body.realise_total, 6500, '5000 (Médicaments) + 1500 (Électricité)');
    });

    await t.test('updateBudget crée la cible si absente, puis la met à jour (upsert)', async () => {
      body = null; status = 200;
      await finC.updateBudget({ query: { annee: String(annee) }, params: { categorie: 'Électricité' }, user: admin, body: { montant_annuel: 2000 } }, res, () => {});
      assert.equal(status, 200);
      assert.equal(body.cible.montant_annuel, 2000);
      createdCibles.push(body.cible);

      const logCreate = await AuditLog.findOne({ module: 'finance', action: 'CREATE', entite_id: body.cible._id.toString() });
      assert.ok(logCreate, 'la création de la cible doit être tracée');

      body = null; status = 200;
      await finC.updateBudget({ query: { annee: String(annee) }, params: { categorie: 'Électricité' }, user: admin, body: { montant_annuel: 3500 } }, res, () => {});
      assert.equal(status, 200);
      assert.equal(body.cible.montant_annuel, 3500, 'même document mis à jour, pas un doublon');

      const count = await BudgetCible.countDocuments({ annee, categorie: 'Électricité' });
      assert.equal(count, 1, 'un seul document par (année, catégorie) — upsert, pas de doublon');

      const logUpdate = await AuditLog.findOne({ module: 'finance', action: 'UPDATE', entite_id: body.cible._id.toString() });
      assert.ok(logUpdate, 'la mise à jour doit être tracée séparément de la création');
    });

    await t.test('catégorie invalide rejetée (400)', async () => {
      body = null; status = 200;
      await finC.updateBudget({ query: { annee: String(annee) }, params: { categorie: 'Inexistante' }, user: admin, body: { montant_annuel: 100 } }, res, () => {});
      assert.equal(status, 400);
    });
  } finally {
    await Depense.deleteMany({ _id: { $in: createdDepenses.map(d => d._id) } });
    await BudgetCible.deleteMany({ annee });
    await AuditLog.deleteMany({ module: 'finance', entite_id: { $in: createdCibles.map(c => c._id.toString()) } });
    await mongoose.disconnect();
  }
});
