// Sous-phase 5.5.a (Discipline/Sanctions) — l'onglet "Discipline" de HR.jsx
// (et sa sous-section "discipline_emp" dans le dossier employé) avait été
// honnêtement désactivé en 5.7 : "Enregistrer sanction" mutait un état
// React local (sanctions[], _id: Date.now().toString()), jamais persisté,
// avec un Badge "Notifié" entièrement fabriqué (aucune notification réelle
// n'était jamais envoyée). Ce test prouve la persistance réelle du nouveau
// modèle Sanction, que `decide_par` est l'auteur réel de la requête, et que
// authorize(...ADMIN) bloque un rôle non-admin (403).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Sous-phase 5.5.a (Discipline) — CRUD Sanction réel + 403 non-admin', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Staff = require('../models/Staff');
  const Sanction = require('../models/Sanction');
  const User = require('../models/User');
  const hrC = require('../controllers/hr.controller');
  const { authorize } = require('../middleware/auth');

  const stamp = Date.now();
  const created = { staff: [], sanctions: [], users: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const staff = await Staff.create({ prenom: 'T55a', nom: `Sanc${stamp}`, poste: 'aide_soignant' });
    created.staff.push(staff._id);
    const responsable = await User.create({ email: `_55asanc-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'RH', prenom: 'Chef', role: 'superadmin', statut: 'actif' });
    created.users.push(responsable._id);

    let sanctionId;

    await t.test('createSanction persiste réellement, decide_par = l\'auteur réel de la requête', async () => {
      const { status, body } = await call(hrC.createSanction, {
        user: responsable, ip: '127.0.0.1',
        body: { employe_id: staff._id, type: 'avertissement', motif: 'Retard répété non justifié' },
      });
      assert.equal(status, 201, JSON.stringify(body));
      sanctionId = body.sanction._id;
      created.sanctions.push(sanctionId);
      assert.equal(body.sanction.employe_nom, `T55a Sanc${stamp}`);

      const fresh = await Sanction.findById(sanctionId).lean();
      assert.ok(fresh, 'doit exister réellement en base');
      assert.equal(String(fresh.decide_par), String(responsable._id));
      assert.equal(fresh.type, 'avertissement');
    });

    await t.test('createSanction sans motif est rejetée (400), rien n\'est persisté', async () => {
      const before = await Sanction.countDocuments();
      const { status } = await call(hrC.createSanction, { user: responsable, ip: '127.0.0.1', body: { employe_id: staff._id, type: 'blame' } });
      assert.equal(status, 400);
      assert.equal(await Sanction.countDocuments(), before);
    });

    await t.test('createSanction avec un type invalide est rejetée (400)', async () => {
      const before = await Sanction.countDocuments();
      const { status } = await call(hrC.createSanction, { user: responsable, ip: '127.0.0.1', body: { employe_id: staff._id, type: 'renvoi_immediat', motif: 'Faute grave' } });
      assert.equal(status, 400);
      assert.equal(await Sanction.countDocuments(), before);
    });

    await t.test('createSanction sur un employé inexistant est rejetée (404)', async () => {
      const { status } = await call(hrC.createSanction, {
        user: responsable, ip: '127.0.0.1',
        body: { employe_id: new mongoose.Types.ObjectId(), type: 'blame', motif: 'Test' },
      });
      assert.equal(status, 404);
    });

    await t.test('getSanctions() retrouve la sanction après un rechargement', async () => {
      const { status, body } = await call(hrC.getSanctions, {});
      assert.equal(status, 200);
      const mine = body.sanctions.find(s => String(s._id) === String(sanctionId));
      assert.ok(mine, 'doit réapparaître dans un getSanctions() frais');
      assert.equal(mine.motif, 'Retard répété non justifié');
    });

    await t.test('authorize(...ADMIN) refuse un rôle non-admin (403) sur ces routes', async () => {
      let status = 200, body = null, nextCalled = false;
      const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
      const req = { user: { _id: new mongoose.Types.ObjectId(), role: 'medecin' }, baseUrl: '/hr', originalUrl: '/hr/sanctions', method: 'POST', ip: '127.0.0.1' };
      await authorize('superadmin', 'adminclinique')(req, res, () => { nextCalled = true; });
      assert.equal(status, 403);
      assert.equal(nextCalled, false);
      assert.equal(body.success, false);
    });
  } finally {
    await Sanction.deleteMany({ _id: { $in: created.sanctions } });
    await Staff.deleteMany({ _id: { $in: created.staff } });
    await User.deleteMany({ _id: { $in: created.users } });
    await mongoose.disconnect();
  }
});
