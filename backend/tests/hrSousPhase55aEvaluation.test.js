// Sous-phase 5.5.a (Évaluations) — l'onglet "Évaluations" de HR.jsx a été
// honnêtement désactivé en 5.7 : "Nouvelle évaluation" ne faisait que muter
// un état React local (evaluations[], _id: Date.now().toString()), perdu au
// rechargement. Ce test prouve la persistance réelle du nouveau modèle
// Evaluation (création → relecture après un getEvaluations() frais), que
// note_globale est bien recalculée serveur (jamais acceptée telle quelle
// depuis le body), et que authorize(...ADMIN) — la vraie fonction montée
// sur ces routes — bloque un rôle non-admin (403).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Sous-phase 5.5.a (Évaluations) — CRUD Evaluation réel + 403 non-admin', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Staff = require('../models/Staff');
  const Evaluation = require('../models/Evaluation');
  const User = require('../models/User');
  const hrC = require('../controllers/hr.controller');
  const { authorize } = require('../middleware/auth');

  const stamp = Date.now();
  const created = { staff: [], evaluations: [], users: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const staff = await Staff.create({ prenom: 'T55a', nom: `Eval${stamp}`, poste: 'infirmier' });
    created.staff.push(staff._id);
    const evaluateur = await User.create({ email: `_55aeval-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Chef', prenom: 'Service', role: 'adminclinique', statut: 'actif' });
    created.users.push(evaluateur._id);

    let evalId;

    await t.test('createEvaluation persiste réellement, note_globale recalculée côté serveur (jamais celle envoyée)', async () => {
      const { status, body } = await call(hrC.createEvaluation, {
        user: evaluateur, ip: '127.0.0.1',
        body: { employe_id: staff._id, periode: '2026-S1', ponctualite: 5, qualite: 4, productivite: 3, discipline: 5, relation_patient: 3, commentaire: 'RAS', note_globale: 1 /* doit être ignorée */ },
      });
      assert.equal(status, 201, JSON.stringify(body));
      evalId = body.evaluation._id;
      created.evaluations.push(evalId);
      // (5+4+3+5+3)/5 = 4.0 — jamais 1 (valeur envoyée dans le body, ignorée).
      assert.equal(body.evaluation.note_globale, 4);

      const fresh = await Evaluation.findById(evalId).lean();
      assert.ok(fresh, 'doit exister réellement en base');
      assert.equal(fresh.note_globale, 4);
      assert.equal(String(fresh.evaluateur), String(evaluateur._id), "l'évaluateur doit être l'auteur réel de la requête, pas un champ texte arbitraire");
    });

    await t.test('createEvaluation sur un employé inexistant est rejeté (404)', async () => {
      const before = await Evaluation.countDocuments();
      const { status } = await call(hrC.createEvaluation, {
        user: evaluateur, ip: '127.0.0.1',
        body: { employe_id: new mongoose.Types.ObjectId(), periode: '2026-S1', ponctualite: 3, qualite: 3, productivite: 3, discipline: 3, relation_patient: 3 },
      });
      assert.equal(status, 404);
      assert.equal(await Evaluation.countDocuments(), before);
    });

    await t.test('createEvaluation avec une note hors 1-5 est rejetée (400), rien n\'est persisté', async () => {
      const before = await Evaluation.countDocuments();
      const { status } = await call(hrC.createEvaluation, {
        user: evaluateur, ip: '127.0.0.1',
        body: { employe_id: staff._id, periode: '2026-S1', ponctualite: 9, qualite: 3, productivite: 3, discipline: 3, relation_patient: 3 },
      });
      assert.equal(status, 400);
      assert.equal(await Evaluation.countDocuments(), before);
    });

    await t.test('getEvaluations() retrouve l\'évaluation après un rechargement, avec employe_nom/evaluateur réels', async () => {
      const { status, body } = await call(hrC.getEvaluations, {});
      assert.equal(status, 200);
      const mine = body.evaluations.find(e => String(e._id) === String(evalId));
      assert.ok(mine, 'doit réapparaître dans un getEvaluations() frais');
      assert.equal(mine.employe_nom, `T55a Eval${stamp}`);
      assert.equal(mine.evaluateur, 'Service Chef');
    });

    await t.test('authorize(...ADMIN) refuse un rôle non-admin (403) sur ces routes', async () => {
      let status = 200, body = null, nextCalled = false;
      const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
      const req = { user: { _id: new mongoose.Types.ObjectId(), role: 'infirmier' }, baseUrl: '/hr', originalUrl: '/hr/evaluations', method: 'POST', ip: '127.0.0.1' };
      await authorize('superadmin', 'adminclinique')(req, res, () => { nextCalled = true; });
      assert.equal(status, 403);
      assert.equal(nextCalled, false);
      assert.equal(body.success, false);
    });
  } finally {
    await Evaluation.deleteMany({ _id: { $in: created.evaluations } });
    await Staff.deleteMany({ _id: { $in: created.staff } });
    await User.deleteMany({ _id: { $in: created.users } });
    await mongoose.disconnect();
  }
});
