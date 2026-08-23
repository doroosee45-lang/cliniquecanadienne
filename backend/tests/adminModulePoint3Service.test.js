// AUDIT-ADMIN-P3 — Staff.service passe de String (texte libre, jamais
// relié à aucune collection réelle) à une vraie référence ObjectId vers
// Service (même collection réelle déjà utilisée par Analytics.jsx —
// GET/POST /settings/services). Staff.departement est supprimé du schéma
// (jamais relié à rien de réel non plus).
// Vérifié : (a) service accepte une vraie référence Service et se
// populate correctement via hr.controller.js (create/getOne/update,
// déjà écrit en anticipation de ce changement) ; (b) une chaîne vide
// efface la référence au lieu de lever une CastError ; (c) departement
// n'existe plus sur le schéma (silencieusement ignoré, jamais persisté).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Administration Point 3 — Staff.service référence réelle Service (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Staff = require('../models/Staff');
  const Service = require('../models/Service');
  const hrC = require('../controllers/hr.controller');
  const settingsC = require('../controllers/settings.controller');

  const stamp = Date.now();
  const superadmin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'P3', nom: 'Test' };
  const created = { services: [], staff: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('createService (déjà réel côté backend) — crée un vrai Service', async () => {
      const { status, body } = await call(settingsC.createService, {
        body: { nom: `_p3-svc-${stamp}`, code: `P3-${stamp}` },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      assert.ok(body.service._id);
      created.services.push(body.service._id);
    });

    let serviceId;
    await t.test('hr.create — accepte une vraie référence Service et la populate en retour', async () => {
      serviceId = created.services[0];
      const { status, body } = await call(hrC.create, {
        body: { prenom: 'P3', nom: 'Staff', poste: 'infirmier', service: serviceId.toString() },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      created.staff.push(body.staff._id);
      assert.equal(body.staff.service.nom, `_p3-svc-${stamp}`, 'service doit être populé (nom réel), pas juste un id brut');

      const fresh = await Staff.findById(body.staff._id).lean();
      assert.ok(fresh.service instanceof mongoose.Types.ObjectId, 'stocké en vrai ObjectId, pas en String');
      assert.equal(fresh.service.toString(), serviceId.toString());
      assert.equal(fresh.departement, undefined, 'departement ne doit plus exister sur le schéma');
    });

    await t.test('hr.update — une chaîne vide efface la référence service (pas de CastError)', async () => {
      const staffId = created.staff[0];
      const { status, body } = await call(hrC.update, {
        params: { id: staffId },
        body: { service: '' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.equal(body.staff.service, null);

      const fresh = await Staff.findById(staffId).lean();
      assert.equal(fresh.service, null);
    });

    await t.test('hr.update — departement envoyé dans le body est silencieusement ignoré (hors liste blanche, hors schéma)', async () => {
      const staffId = created.staff[0];
      const { status } = await call(hrC.update, {
        params: { id: staffId },
        body: { statut: 'actif', departement: 'Urgences' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      const fresh = await Staff.findById(staffId).lean();
      assert.equal(fresh.departement, undefined, 'departement ne doit jamais être persisté — le champ n\'existe plus');
    });

    await t.test('hr.getAll — service réel toujours populé (nom) dans la liste', async () => {
      const { status } = await call(hrC.update, {
        params: { id: created.staff[0] },
        body: { service: serviceId.toString() },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);

      const { body } = await call(hrC.getAll, { query: {}, user: superadmin, ip: '127.0.0.1' });
      const s = body.staff.find(x => x._id.toString() === created.staff[0].toString());
      assert.equal(s.service.nom, `_p3-svc-${stamp}`);
    });
  } finally {
    for (const id of created.staff) await Staff.findByIdAndDelete(id);
    for (const id of created.services) await Service.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
