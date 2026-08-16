// R-14 (HR) — /hr/leaves et /hr/schedules étaient des stubs figés
// ({leaves:[]}/{schedules:[]}) alors que Staff.conges[]/planning[] existent
// et sont déjà écrits (hrC.leave). Ce test vérifie l'agrégation réelle,
// l'approbation/refus d'une demande (avec décompte de conges_restants), et
// l'assignation d'un créneau — contre la vraie base, pas de mock.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('agrégation congés/planning RH (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Staff = require('../models/Staff');
  const hrC = require('../controllers/hr.controller');

  const stamp = Date.now();
  const staff = await Staff.create({ prenom: 'T14', nom: `HR${stamp}`, poste: 'infirmier', conges_restants: 20 });
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Admin', nom: 'Test' };

  try {
    let body = null, status = 200;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };

    await t.test('soumission de deux demandes de congé', async () => {
      await hrC.leave({ params: { id: staff._id }, user: admin, body: { type: 'annuel', date_debut: '2026-09-01', date_fin: '2026-09-05', motif: 'Vacances' } }, res, () => {});
      assert.equal(status, 200);
      await hrC.leave({ params: { id: staff._id }, user: admin, body: { type: 'maladie', date_debut: '2026-09-10', date_fin: '2026-09-10', motif: 'Grippe' } }, res, () => {});
      const fresh = await Staff.findById(staff._id);
      assert.equal(fresh.conges.length, 2);
      assert.equal(fresh.conges[0].nb_jours, 5, 'nb_jours doit être calculé (5 sept au 1er = 5 jours inclusifs)');
      assert.equal(fresh.conges[0].statut, 'en_attente');
    });

    await t.test('getLeaves agrège avec employe_nom/employe_id', async () => {
      body = null;
      await hrC.getLeaves({}, res, () => {});
      const mine = body.leaves.filter(l => String(l.employe_id) === String(staff._id));
      assert.equal(mine.length, 2);
      assert.equal(mine.every(l => l.employe_nom === `T14 HR${stamp}`), true);
    });

    await t.test('approuver une demande décrémente conges_restants', async () => {
      const fresh = await Staff.findById(staff._id);
      const congeId = fresh.conges[0]._id;
      body = null; status = 200;
      await hrC.updateLeaveStatus({ params: { id: staff._id, congeId }, user: admin, body: { statut: 'approuve' } }, res, () => {});
      assert.equal(status, 200);
      const after = await Staff.findById(staff._id);
      assert.equal(after.conges.id(congeId).statut, 'approuve');
      assert.equal(after.conges_restants, 15, '20 - 5 jours approuvés');
    });

    await t.test('re-traiter une demande déjà tranchée est refusé (400)', async () => {
      const fresh = await Staff.findById(staff._id);
      const congeId = fresh.conges[0]._id;
      body = null; status = 200;
      await hrC.updateLeaveStatus({ params: { id: staff._id, congeId }, user: admin, body: { statut: 'refuse' } }, res, () => {});
      assert.equal(status, 400);
    });

    await t.test('refuser une demande ne touche pas conges_restants', async () => {
      const fresh = await Staff.findById(staff._id);
      const congeId = fresh.conges[1]._id;
      body = null; status = 200;
      await hrC.updateLeaveStatus({ params: { id: staff._id, congeId }, user: admin, body: { statut: 'refuse' } }, res, () => {});
      assert.equal(status, 200);
      const after = await Staff.findById(staff._id);
      assert.equal(after.conges_restants, 15, 'inchangé — seule une approbation décompte');
    });

    await t.test('assigner un créneau puis le retrouver via getSchedules avec filtre de date', async () => {
      body = null; status = 200;
      await hrC.addSchedule({ params: { id: staff._id }, user: admin, body: { date: '2026-09-15', heure_debut: '08:00', heure_fin: '16:00', type: 'travail' } }, res, () => {});
      assert.equal(status, 200);

      body = null;
      await hrC.getSchedules({ query: { date_debut: '2026-09-14', date_fin: '2026-09-16' } }, res, () => {});
      const mine = body.schedules.filter(s => String(s.employe_id) === String(staff._id));
      assert.equal(mine.length, 1);
      assert.equal(mine[0].type, 'travail');
      assert.equal(mine[0].employe_nom, `T14 HR${stamp}`);

      body = null;
      await hrC.getSchedules({ query: { date_debut: '2026-10-01', date_fin: '2026-10-31' } }, res, () => {});
      assert.equal(body.schedules.filter(s => String(s.employe_id) === String(staff._id)).length, 0, 'hors plage → absent');
    });
  } finally {
    await Staff.findByIdAndDelete(staff._id);
    await mongoose.disconnect();
  }
});
