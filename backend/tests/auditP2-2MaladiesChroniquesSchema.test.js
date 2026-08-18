// AUDIT-P2-2 — le schéma Patient ne déclarait pas `maladies_chroniques`
// alors que Patients.jsx le lit à 6 endroits (stats "chroniques", badges
// liste/détail) : envoyé au create()/update(), le champ était silencieusement
// rejeté par Mongoose (mode strict), rendant ces lectures inertes en
// permanence. Ce test prouve : (a) le champ persiste à la création, (b) il
// persiste à la mise à jour, (c) il reste exclu de la projection restreinte
// des rôles non-cliniques (comptable), au même titre que antecedents_medicaux.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('P2-2 — maladies_chroniques persiste sur Patient (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const patC = require('../controllers/patients.controller');

  const stamp = Date.now();
  const receptionniste = { _id: new mongoose.Types.ObjectId(), role: 'receptionniste' };
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    let patientId;
    await t.test('create() — maladies_chroniques envoyé dans le payload est bien persisté', async () => {
      const { status, body } = await call(patC.create, {
        body: {
          nom: `P22-${stamp}`, prenom: 'Chronique', date_naissance: '1985-05-05', sexe: 'F',
          telephone: '060000001', email: `_p22-${stamp}@_test.local`,
          maladies_chroniques: ['Diabète type 2', 'Hypertension'],
        },
        user: receptionniste, ip: '127.0.0.1', headers: {},
      });
      patientId = body?.patient?._id;
      if (patientId) cleanup.push(() => Patient.findByIdAndDelete(patientId));
      assert.equal(status, 201);

      const fresh = await Patient.findById(patientId).lean();
      assert.deepEqual(fresh.maladies_chroniques, ['Diabète type 2', 'Hypertension']);
    });

    await t.test('update() — maladies_chroniques modifiable après création', async () => {
      const { status } = await call(patC.update, {
        params: { id: patientId },
        body: { maladies_chroniques: ['Asthme'] },
        user: receptionniste, ip: '127.0.0.1',
      });
      assert.equal(status, 200);

      const fresh = await Patient.findById(patientId).lean();
      assert.deepEqual(fresh.maladies_chroniques, ['Asthme']);
    });

    await t.test('getOne() — comptable (rôle restreint) ne reçoit pas maladies_chroniques, au même titre que les autres champs cliniques', async () => {
      let status = 200, body = null;
      const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
      await patC.getOne({ params: { id: patientId }, user: { role: 'comptable' } }, res, () => {});
      assert.equal(status, 200);
      assert.equal(body.patient.maladies_chroniques, undefined, 'un rôle sans besoin clinique ne doit pas recevoir ce champ');
    });

    await t.test('getOne() — médecin (accès complet) reçoit bien maladies_chroniques', async () => {
      let status = 200, body = null;
      const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
      await patC.getOne({ params: { id: patientId }, user: { role: 'medecin' } }, res, () => {});
      assert.equal(status, 200);
      assert.deepEqual(body.patient.maladies_chroniques, ['Asthme']);
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
