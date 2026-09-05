// Sous-phase 5.1 (relecture du 6 sept. 2026) — Archive.jsx :
// - Le badge "Restaurations" (kpis.restaurations) n'était jamais renvoyé par
//   getStats() (toujours undefined||0 = 0, invisible pour toujours), et
//   l'onglet "Historique des restaurations" affichait DEMO_RESTAURATIONS
//   (toujours vide) au lieu des vraies archives statut:'restauré', déjà
//   réellement persistées par restore()/bulkRestore() (restaure_par/
//   restaure_at/motif_restauration) mais jamais chargées ni affichées.
// - GET /archives ne peuplait jamais restaure_par (ObjectId brut) : la
//   colonne "Utilisateur" de l'historique des restaurations n'aurait jamais
//   pu afficher un nom réel.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Sous-phase 5.1 (Archive) — restaurations réellement comptées, chargées et peuplées', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const ArchiveEntry = require('../models/ArchiveEntry');
  const User = require('../models/User');
  const archiveC = require('../controllers/archive.controller');

  const stamp = Date.now();
  const created = { archives: [], users: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const utilisateur = await User.create({ email: `_51arc-user-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Restaurateur', prenom: '51', role: 'adminclinique', statut: 'actif' });
    created.users.push(utilisateur._id);

    const archive = await ArchiveEntry.create({
      titre: `T51-Archive-${stamp}`, categorie: 'document', patient_nom: `Patient-T51-${stamp}`,
      statut: 'archive', archive_par: utilisateur._id,
    });
    created.archives.push(archive._id);

    await t.test("restore() persiste réellement, puis GET /archives?statut=restauré peuple restaure_par (nom réel, pas un ObjectId brut)", async () => {
      const { status: sRestore, body: bRestore } = await call(archiveC.restore, {
        params: { id: archive._id.toString() }, body: { motif: 'Test51 restauration' }, user: utilisateur, ip: '127.0.0.1',
      });
      assert.equal(sRestore, 200, JSON.stringify(bRestore));
      assert.equal(bRestore.archive.statut, 'restauré');

      const { status, body } = await call(archiveC.getAll, { query: { statut: 'restauré', limit: 200 } });
      assert.equal(status, 200, JSON.stringify(body));
      const notre = body.archives.find(a => String(a._id) === String(archive._id));
      assert.ok(notre, "l'archive restaurée doit apparaître dans le filtre statut=restauré");
      assert.ok(notre.restaure_par, 'restaure_par doit être peuplé (populate), jamais laissé en ObjectId brut inexploitable côté UI');
      assert.equal(notre.restaure_par.nom, 'Restaurateur', "le vrai nom de l'utilisateur ayant restauré doit être exposé");
      assert.ok(notre.restaure_at, 'restaure_at doit être renseigné');
      assert.equal(notre.motif_restauration, 'Test51 restauration');
    });

    await t.test('getStats().kpis.restaurations compte réellement les archives statut:restauré (jamais figé à 0/undefined)', async () => {
      const { status, body } = await call(archiveC.getStats, {});
      assert.equal(status, 200, JSON.stringify(body));
      assert.ok(typeof body.kpis.restaurations === 'number', `AVANT la correction, ce champ n'existait pas du tout (undefined). Obtenu : ${JSON.stringify(body.kpis.restaurations)}`);
      assert.ok(body.kpis.restaurations >= 1, `doit compter au moins notre archive réellement restaurée, obtenu ${body.kpis.restaurations}`);
    });
  } finally {
    await ArchiveEntry.deleteMany({ _id: { $in: created.archives } });
    await User.deleteMany({ _id: { $in: created.users } });
    await mongoose.disconnect();
  }
});
