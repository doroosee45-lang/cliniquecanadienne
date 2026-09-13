// AUDIT-A-8 — archive.controller.js n'avait aucun test fonctionnel dédié
// malgré 9 endpoints réels (getStats, getAll, create, restore, remove,
// bulkRestore, bulkDelete, exportAll, updateConfig). Couverture fonctionnelle
// directe, base réelle, vérification systématique par relecture fraîche.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('archive.controller — couverture fonctionnelle des 9 endpoints (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const archiveC = require('../controllers/archive.controller');
  const ArchiveEntry = require('../models/ArchiveEntry');
  const Patient = require('../models/Patient');
  const Setting = require('../models/Setting');

  const stamp = Date.now();
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Admin', nom: 'Test' };
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = {
      status: (c) => { status = c; return res; },
      json: (d) => { body = d; return res; },
      setHeader: () => {},
      send: (d) => { body = d; return res; },
    };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('create() — archivage manuel persiste avec les défauts attendus', async () => {
      const { status, body } = await call(archiveC.create, {
        body: { titre: `A8-Manuel-${stamp}`, categorie: 'document' },
        user: admin, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      cleanup.push(() => ArchiveEntry.findByIdAndDelete(body.archive._id));
      assert.equal(body.archive.statut, 'archive');
      assert.equal(body.archive.priorite, 'normale');
      assert.equal(String(body.archive.archive_par), String(admin._id));
    });

    let entryHosp, entryLabo;
    await t.test('getStats() — compte les entrées par catégorie', async () => {
      entryHosp = await ArchiveEntry.create({ titre: `A8-Hosp-${stamp}`, categorie: 'hospitalisation', patient_nom: 'Test' });
      entryLabo = await ArchiveEntry.create({ titre: `A8-Labo-${stamp}`, categorie: 'laboratoire', patient_nom: 'Test' });
      cleanup.push(() => ArchiveEntry.findByIdAndDelete(entryHosp._id));
      cleanup.push(() => ArchiveEntry.findByIdAndDelete(entryLabo._id));

      const { status, body } = await call(archiveC.getStats, { user: admin });
      assert.equal(status, 200);
      assert.ok(body.kpis.total >= 2);
      assert.ok(body.kpis.hospitalisations >= 1);
      assert.ok(body.kpis.labo >= 1);
    });

    await t.test('getAll() — filtre par catégorie et par recherche texte', async () => {
      const { body: byCategorie } = await call(archiveC.getAll, { query: { categorie: 'laboratoire' }, user: admin });
      assert.ok(byCategorie.archives.every(a => a.categorie === 'laboratoire'));
      assert.ok(byCategorie.archives.some(a => String(a._id) === String(entryLabo._id)));

      const { body: byQ } = await call(archiveC.getAll, { query: { q: `A8-Hosp-${stamp}` }, user: admin });
      assert.equal(byQ.archives.length, 1);
      assert.equal(String(byQ.archives[0]._id), String(entryHosp._id));
    });

    await t.test('restore() — réactive aussi le patient source si source_model=Patient', async () => {
      const patient = await Patient.create({ nom: `A8-${stamp}`, prenom: 'Restaure', date_naissance: '1990-01-01', sexe: 'M', statut: 'inactif' });
      const entry = await ArchiveEntry.create({
        titre: `A8-PatientArchive-${stamp}`, categorie: 'patient',
        source_model: 'Patient', source_id: patient._id, patient: patient._id,
      });
      cleanup.push(() => ArchiveEntry.findByIdAndDelete(entry._id));
      // Patient supprimé après l'ArchiveEntry ci-dessus, qui le référence
      // encore (hook pre('findOneAndDelete') de Patient).
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));

      const { status, body } = await call(archiveC.restore, { params: { id: entry._id }, body: { motif: 'Test A-8' }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.archive.statut, 'restauré');
      assert.equal(body.archive.motif_restauration, 'Test A-8');

      const freshPatient = await Patient.findById(patient._id);
      assert.equal(freshPatient.statut, 'actif', 'le patient source doit être réactivé');
    });

    await t.test('restore() — 404 explicite sur une archive inexistante', async () => {
      const { status, body } = await call(archiveC.restore, { params: { id: new mongoose.Types.ObjectId() }, body: {}, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 404);
      assert.match(body.message, /introuvable/);
    });

    await t.test('remove() — supprime définitivement', async () => {
      const entry = await ArchiveEntry.create({ titre: `A8-Remove-${stamp}`, categorie: 'document' });
      const { status } = await call(archiveC.remove, { params: { id: entry._id }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(await ArchiveEntry.findById(entry._id), null);
    });

    await t.test('bulkRestore() — restaure plusieurs entrées en une fois', async () => {
      const e1 = await ArchiveEntry.create({ titre: `A8-Bulk1-${stamp}`, categorie: 'document' });
      const e2 = await ArchiveEntry.create({ titre: `A8-Bulk2-${stamp}`, categorie: 'document' });
      cleanup.push(() => ArchiveEntry.findByIdAndDelete(e1._id));
      cleanup.push(() => ArchiveEntry.findByIdAndDelete(e2._id));

      const { status, body } = await call(archiveC.bulkRestore, { body: { ids: [e1._id, e2._id] }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.count, 2);
      const fresh1 = await ArchiveEntry.findById(e1._id);
      const fresh2 = await ArchiveEntry.findById(e2._id);
      assert.equal(fresh1.statut, 'restauré');
      assert.equal(fresh2.statut, 'restauré');
    });

    await t.test('bulkDelete() — supprime plusieurs entrées en une fois', async () => {
      const e1 = await ArchiveEntry.create({ titre: `A8-BulkDel1-${stamp}`, categorie: 'document' });
      const e2 = await ArchiveEntry.create({ titre: `A8-BulkDel2-${stamp}`, categorie: 'document' });

      const { status, body } = await call(archiveC.bulkDelete, { body: { ids: [e1._id, e2._id] }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.count, 2);
      assert.equal(await ArchiveEntry.findById(e1._id), null);
      assert.equal(await ArchiveEntry.findById(e2._id), null);
    });

    await t.test('exportAll() — JSON par défaut, CSV avec BOM sur format=csv', async () => {
      const { status, body } = await call(archiveC.exportAll, { query: {}, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.ok(Array.isArray(body.archives));

      const { body: csvBody } = await call(archiveC.exportAll, { query: { format: 'csv' }, user: admin, ip: '127.0.0.1' });
      assert.ok(typeof csvBody === 'string');
      assert.match(csvBody, /^\uFEFFTitre,Categorie,Patient,Statut,Date archivage,Priorite/);
    });

    await t.test('updateConfig() — upsert la configuration dans Setting', async () => {
      const config = { seuil_jours: 45, actif: true };
      const { status, body } = await call(archiveC.updateConfig, { body: config, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.deepEqual(body.config, config);

      const setting = await Setting.findOne({ cle: 'archive_auto_config' }).lean();
      assert.ok(setting);
      assert.deepEqual(setting.valeur, config);
      cleanup.push(() => Setting.findOneAndDelete({ cle: 'archive_auto_config' }));
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
