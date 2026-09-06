// Sous-phase 5.5.a (Formations) — l'onglet "Formations" de HR.jsx a été
// honnêtement désactivé en 5.7 : "Planifier formation" mutait un état
// React local (formations[], _id: Date.now().toString(), participants en
// texte libre séparé par virgules), perdu au rechargement. Ce test prouve
// la persistance réelle du nouveau modèle Formation (création → relecture
// après un getFormations() frais), que les participants doivent référencer
// de vrais employés Staff (rejet sinon), que le statut planifie/termine
// est dérivé de la date réelle (jamais un champ stocké pouvant devenir
// obsolète), et que authorize(...ADMIN) bloque un rôle non-admin (403).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Sous-phase 5.5.a (Formations) — CRUD Formation réel + 403 non-admin', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Staff = require('../models/Staff');
  const Formation = require('../models/Formation');
  const hrC = require('../controllers/hr.controller');
  const { authorize } = require('../middleware/auth');

  const stamp = Date.now();
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Admin', nom: 'Test' };
  const created = { staff: [], formations: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const staff1 = await Staff.create({ prenom: 'T55a', nom: `Form1-${stamp}`, poste: 'infirmier' });
    const staff2 = await Staff.create({ prenom: 'T55a', nom: `Form2-${stamp}`, poste: 'medecin' });
    created.staff.push(staff1._id, staff2._id);

    let formationId;
    const dateFuture = new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10);

    await t.test('createFormation persiste réellement, avec de vrais participants Staff', async () => {
      const { status, body } = await call(hrC.createFormation, {
        user: admin, ip: '127.0.0.1',
        body: { titre: `Formation Test55a ${stamp}`, type: 'interne', date: dateFuture, duree_h: 8, participants: [String(staff1._id), String(staff2._id)], certificat: true },
      });
      assert.equal(status, 201, JSON.stringify(body));
      formationId = body.formation._id;
      created.formations.push(formationId);
      assert.equal(body.formation.participants.length, 2);
      assert.ok(body.formation.participants.some(p => p.nom === `T55a Form1-${stamp}`));

      const fresh = await Formation.findById(formationId).lean();
      assert.ok(fresh, 'doit exister réellement en base');
      assert.equal(fresh.participants.length, 2);
      assert.equal(fresh.certificat, true);
    });

    await t.test('createFormation avec un participant inexistant est rejetée (400), rien n\'est persisté', async () => {
      const before = await Formation.countDocuments();
      const { status } = await call(hrC.createFormation, {
        user: admin, ip: '127.0.0.1',
        body: { titre: 'Formation fantôme', type: 'interne', date: dateFuture, participants: [String(new mongoose.Types.ObjectId())] },
      });
      assert.equal(status, 400);
      assert.equal(await Formation.countDocuments(), before, 'aucune formation créée avec un participant qui n\'existe pas');
    });

    await t.test('createFormation sans titre ni date est rejetée (400)', async () => {
      const { status: s1 } = await call(hrC.createFormation, { user: admin, ip: '127.0.0.1', body: { date: dateFuture } });
      assert.equal(s1, 400);
      const { status: s2 } = await call(hrC.createFormation, { user: admin, ip: '127.0.0.1', body: { titre: 'Sans date' } });
      assert.equal(s2, 400);
    });

    await t.test('getFormations() retrouve la formation après un rechargement, statut "planifie" (date future)', async () => {
      const { status, body } = await call(hrC.getFormations, {});
      assert.equal(status, 200);
      const mine = body.formations.find(f => String(f._id) === String(formationId));
      assert.ok(mine, 'doit réapparaître dans un getFormations() frais');
      assert.equal(mine.statut, 'planifie');
    });

    await t.test('une formation à date passée est dérivée "termine" (jamais un champ stocké — recalculé à chaque lecture)', async () => {
      const datePassee = new Date(Date.now() - 5 * 86400000);
      const { status, body } = await call(hrC.createFormation, {
        user: admin, ip: '127.0.0.1',
        body: { titre: `Formation passée ${stamp}`, type: 'externe', date: datePassee.toISOString() },
      });
      assert.equal(status, 201);
      created.formations.push(body.formation._id);
      assert.equal(body.formation.statut, 'termine');

      const { body: reloaded } = await call(hrC.getFormations, {});
      const mine = reloaded.formations.find(f => String(f._id) === String(body.formation._id));
      assert.equal(mine.statut, 'termine', 'doit rester "termine" après un rechargement complet, dérivé de la vraie date');
    });

    await t.test('authorize(...ADMIN) refuse un rôle non-admin (403) sur ces routes', async () => {
      let status = 200, body = null, nextCalled = false;
      const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
      const req = { user: { _id: new mongoose.Types.ObjectId(), role: 'receptionniste' }, baseUrl: '/hr', originalUrl: '/hr/formations', method: 'POST', ip: '127.0.0.1' };
      await authorize('superadmin', 'adminclinique')(req, res, () => { nextCalled = true; });
      assert.equal(status, 403);
      assert.equal(nextCalled, false);
      assert.equal(body.success, false);
    });
  } finally {
    await Formation.deleteMany({ _id: { $in: created.formations } });
    await Staff.deleteMany({ _id: { $in: created.staff } });
    await mongoose.disconnect();
  }
});
