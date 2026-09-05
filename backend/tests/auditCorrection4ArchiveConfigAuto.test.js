// Correction 4 (relecture du 6 sept. 2026, FE-BUG-006) — les toggles
// "Archivage automatique" (Archive.jsx) appelaient setConfigAuto, l'action
// Redux importée mais jamais dispatch()ée (aucun effet réel) au lieu du
// thunk updateAutoConfig qui, lui, persiste réellement via
// PUT /archives/config. Découverte en creusant : même le thunk réel
// n'était jamais relu au chargement de la page — aucune route GET
// n'existait, la page repartait donc toujours des valeurs par défaut
// codées en dur, masquant que l'écriture fonctionnait déjà. Les deux
// bouts (écriture réellement appelée, lecture réellement câblée) sont
// couverts ici.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Correction 4 — la config d\'archivage auto est réellement persistée et relue au rechargement', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const Setting = require('../models/Setting');
  const archiveC = require('../controllers/archive.controller');

  const stamp = Date.now();
  const created = { users: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  // Ce test s'exécute contre la vraie base Atlas partagée (comme tous les
  // tests de ce fichier de suite) : le réglage réel éventuellement déjà
  // configuré par un administrateur est sauvegardé ici et restauré tel
  // quel en `finally`, jamais supprimé définitivement.
  const settingAvant = await Setting.findOne({ cle: 'archive_auto_config' }).lean();

  try {
    const admin = await User.create({ email: `_correction4-arc-admin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Admin', prenom: 'Correction4', role: 'superadmin', statut: 'actif' });
    created.users.push(admin._id);

    await t.test('updateConfig() persiste réellement le toggle désactivé, jamais un effet purement local', async () => {
      const { status } = await call(archiveC.updateConfig, {
        body: { actif: false, duree: '3ans', consultations: true, hospitalisations: false, factures: true, examens: true },
        user: admin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);

      const fresh = await Setting.findOne({ cle: 'archive_auto_config' }).lean();
      assert.ok(fresh, 'un vrai document Setting doit exister en base');
      assert.equal(fresh.valeur.actif, false);
      assert.equal(fresh.valeur.duree, '3ans');
      assert.equal(fresh.valeur.hospitalisations, false);
    });

    await t.test('getConfig() relit exactement la config persistée — simule un rechargement de page', async () => {
      const { status, body } = await call(archiveC.getConfig, {});
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.config.actif, false, 'un rechargement de page doit voir le toggle réellement désactivé, jamais retomber sur le défaut actif:true');
      assert.equal(body.config.duree, '3ans');
      assert.equal(body.config.hospitalisations, false);
      assert.equal(body.config.consultations, true);
    });

    await t.test('LIMITE — getConfig() sans aucun réglage préexistant → défauts honnêtes, jamais une lecture qui plante', async () => {
      await Setting.deleteOne({ cle: 'archive_auto_config' });
      const { status, body } = await call(archiveC.getConfig, {});
      assert.equal(status, 200);
      assert.equal(body.config.actif, true);
    });
  } finally {
    if (settingAvant) {
      await Setting.findOneAndUpdate({ cle: 'archive_auto_config' }, { valeur: settingAvant.valeur, updated_by: settingAvant.updated_by }, { upsert: true });
    } else {
      await Setting.deleteOne({ cle: 'archive_auto_config' });
    }
    await User.deleteMany({ _id: { $in: created.users } });
    await mongoose.disconnect();
  }
});
