// AUDIT-04 — dashboard.controller.js avait 4 (en réalité 6, cf. rapport)
// occurrences de Promise.resolve([]/0) commentées "non modélisé", alors que
// Depense, Commande et le journal LOGIN_ECHEC (AuditLog) existent et sont
// réellement alimentés ailleurs dans l'application. Ce test prouve, avec des
// données contrôlées, que les statistiques concernées reflètent maintenant
// ces sources réelles plutôt que d'être figées à zéro/vide.
//
// Méthode "avant / après" plutôt qu'une valeur absolue attendue : ces
// handlers tournent contre la base de dev partagée (MONGO_URI), qui peut
// déjà contenir d'autres Depense/Commande/échecs de connexion du jour ou du
// mois — mesurer le delta après insertion d'un enregistrement connu est la
// seule façon fiable de prouver l'agrégation sans dépendre d'un état vide.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('dashboard.controller — statistiques dépenses/commandes/connexions échouées (AUDIT-04)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  require('../routes'); // enregistre tous les modèles, comme dashboard.fields.test.js
  const dashC = require('../controllers/dashboard.controller');
  const Depense = require('../models/Depense');
  const Commande = require('../models/Commande');
  const AuditLog = require('../models/AuditLog');
  const User = require('../models/User');

  const call = async (handlerName, user) => {
    let captured = null;
    await dashC[handlerName]({ user }, { json: (d) => { captured = d; } }, (err) => { if (err) throw err; });
    return captured.stats;
  };

  const cleanup = [];
  const stamp = Date.now();

  try {
    await t.test('superAdminStats.kpis.depenses (ce mois-ci) reflète Depense', async () => {
      const admin = (await User.findOne({ role: 'superadmin' }).lean()) || { _id: new mongoose.Types.ObjectId(), role: 'superadmin' };
      const before = (await call('superAdminStats', admin)).kpis.depenses;

      const dep = await Depense.create({ description: `T-AUDIT04-${stamp}`, montant: 12345, date: new Date() });
      cleanup.push(() => Depense.findByIdAndDelete(dep._id));

      const after = (await call('superAdminStats', admin)).kpis.depenses;
      assert.equal(after - before, 12345, 'le total dépenses du mois doit augmenter exactement du montant inséré');
    });

    await t.test('superAdminStats.chart_mois.dep (12 mois) reflète Depense du mois courant', async () => {
      const admin = (await User.findOne({ role: 'superadmin' }).lean()) || { _id: new mongoose.Types.ObjectId(), role: 'superadmin' };
      const moisCourant = new Date().getMonth(); // index 0-11 dans le tableau retourné
      const before = (await call('superAdminStats', admin)).chart_mois.dep[moisCourant];

      const dep = await Depense.create({ description: `T-AUDIT04-chart-${stamp}`, montant: 5000, date: new Date() });
      cleanup.push(() => Depense.findByIdAndDelete(dep._id));

      const after = (await call('superAdminStats', admin)).chart_mois.dep[moisCourant];
      assert.equal(after - before, 5000, 'le point du mois courant dans le graphique 12 mois doit augmenter exactement du montant inséré');
    });

    await t.test('superAdminStats.connexions_echouees reflète le journal LOGIN_ECHEC (aujourd\'hui)', async () => {
      const admin = (await User.findOne({ role: 'superadmin' }).lean()) || { _id: new mongoose.Types.ObjectId(), role: 'superadmin' };
      const before = (await call('superAdminStats', admin)).connexions_echouees;

      const log = await AuditLog.create({ action: 'LOGIN_ECHEC', module: 'auth', message: `T-AUDIT04-${stamp}`, statut: 'echec' });
      cleanup.push(() => AuditLog.findByIdAndDelete(log._id));

      const after = (await call('superAdminStats', admin)).connexions_echouees;
      assert.equal(after - before, 1, 'connexions_echouees doit augmenter de 1 après un nouvel échec de connexion journalisé aujourd\'hui');
    });

    await t.test('adminCliniqueStats.kpis.depenses_auj reflète Depense (aujourd\'hui)', async () => {
      const admin = (await User.findOne({ role: 'adminclinique' }).lean()) || { _id: new mongoose.Types.ObjectId(), role: 'adminclinique' };
      const before = (await call('adminCliniqueStats', admin)).kpis.depenses_auj;

      const dep = await Depense.create({ description: `T-AUDIT04-auj-${stamp}`, montant: 777, date: new Date() });
      cleanup.push(() => Depense.findByIdAndDelete(dep._id));

      const after = (await call('adminCliniqueStats', admin)).kpis.depenses_auj;
      assert.equal(after - before, 777, 'les dépenses du jour doivent augmenter exactement du montant inséré');
    });

    await t.test('adminCliniqueStats.pharmacie.commandes_attente reflète Commande', async () => {
      const admin = (await User.findOne({ role: 'adminclinique' }).lean()) || { _id: new mongoose.Types.ObjectId(), role: 'adminclinique' };
      const before = (await call('adminCliniqueStats', admin)).pharmacie.commandes_attente;

      const cmd = await Commande.create({
        fournisseur: `T-AUDIT04-${stamp}`,
        lignes: [{ nom: 'Test', quantite: 1, prix_unitaire: 100 }],
        statut: 'brouillon',
      });
      cleanup.push(() => Commande.findByIdAndDelete(cmd._id));

      const after = (await call('adminCliniqueStats', admin)).pharmacie.commandes_attente;
      assert.equal(after - before, 1, 'une commande en brouillon (ni reçue ni annulée) doit compter comme "en attente"');

      // Une commande reçue ou annulée ne doit PAS être comptée "en attente".
      await Commande.findByIdAndUpdate(cmd._id, { statut: 'recu' });
      const afterRecu = (await call('adminCliniqueStats', admin)).pharmacie.commandes_attente;
      assert.equal(afterRecu, before, 'une commande passée à "recu" ne doit plus compter comme en attente');
    });

    await t.test('comptableStats.kpis.depenses_auj reflète Depense (aujourd\'hui)', async () => {
      const compt = (await User.findOne({ role: 'comptable' }).lean()) || { _id: new mongoose.Types.ObjectId(), role: 'comptable' };
      const before = (await call('comptableStats', compt)).kpis.depenses_auj;

      const dep = await Depense.create({ description: `T-AUDIT04-compt-${stamp}`, montant: 333, date: new Date() });
      cleanup.push(() => Depense.findByIdAndDelete(dep._id));

      const after = (await call('comptableStats', compt)).kpis.depenses_auj;
      assert.equal(after - before, 333, 'les dépenses du jour (vue comptable) doivent augmenter exactement du montant inséré');
    });

    await t.test('pharmacienStats.kpis.ventes_auj reste un zéro explicite (aucune Vente persistée — non traité, hors périmètre AUDIT-04)', async () => {
      const pharm = (await User.findOne({ role: 'pharmacien' }).lean()) || { _id: new mongoose.Types.ObjectId(), role: 'pharmacien' };
      const stats = await call('pharmacienStats', pharm);
      assert.equal(stats.kpis.ventes_auj, 0, 'confirme que ce stub reste inchangé — createVente ne persiste aucun enregistrement de vente interrogeable');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
