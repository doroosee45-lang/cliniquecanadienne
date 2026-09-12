// CLIN-07 (correction du 12 sept. 2026, audit indépendant) —
// hospitalization.controller.js::create, appointments.controller.js::create
// et consultations.controller.js::create vérifiaient uniquement la
// PRÉSENCE du champ `patient` (truthy), jamais son existence réelle : un
// ObjectId fabriqué ou orphelin passait tel quel jusqu'à Model.create(),
// produisant un dossier durablement rattaché à aucun Patient réel.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('CLIN-07 — patient fabriqué/orphelin refusé à la création (hospitalisation, rendez-vous, consultation)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Hospitalization = require('../models/Hospitalization');
  const Appointment = require('../models/Appointment');
  const Consultation = require('../models/Consultation');
  const hospC = require('../controllers/hospitalization.controller');
  const apptC = require('../controllers/appointments.controller');
  const consultC = require('../controllers/consultations.controller');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message }; } });
    return { status, body };
  };

  const patient = await Patient.create({ nom: `Clin07-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1990-01-01' });
  const medecin = await User.create({ email: `_clin07-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'Test7', role: 'medecin', statut: 'actif' });
  const user = { _id: medecin._id, prenom: 'Test', nom: 'Medecin' };
  const fakePatientId = new mongoose.Types.ObjectId();
  const created = { hosp: [], appts: [], consults: [] };

  try {
    await t.test('hospitalization.controller.js::create — patient fabriqué refusé (404), patient réel accepté', async () => {
      const bad = await call(hospC.create, { user, ip: '127.0.0.1', body: { patient: fakePatientId.toString(), motif_entree: 'Test' } });
      assert.equal(bad.status, 404, JSON.stringify(bad.body));
      const orphan = await Hospitalization.findOne({ patient: fakePatientId });
      assert.equal(orphan, null, 'aucune hospitalisation ne doit exister pour un patient fabriqué');

      const good = await call(hospC.create, { user, ip: '127.0.0.1', body: { patient: patient._id.toString(), motif_entree: 'Test réel' } });
      assert.equal(good.status, 201, JSON.stringify(good.body));
      created.hosp.push(good.body.hospitalization._id);
    });

    await t.test('appointments.controller.js::create — patient fabriqué refusé (404), patient réel accepté', async () => {
      const bad = await call(apptC.create, { user, ip: '127.0.0.1', body: { patient: fakePatientId.toString(), medecin: medecin._id.toString(), date_heure: new Date(Date.now() + 3600_000).toISOString(), duree_minutes: 30, type: 'consultation', motif: 'Test' } });
      assert.equal(bad.status, 404, JSON.stringify(bad.body));
      const orphan = await Appointment.findOne({ patient: fakePatientId });
      assert.equal(orphan, null, 'aucun rendez-vous ne doit exister pour un patient fabriqué');

      const good = await call(apptC.create, { user, ip: '127.0.0.1', body: { patient: patient._id.toString(), medecin: medecin._id.toString(), date_heure: new Date(Date.now() + 7200_000).toISOString(), duree_minutes: 30, type: 'consultation', motif: 'Test réel' } });
      assert.equal(good.status, 201, JSON.stringify(good.body));
      created.appts.push(good.body.appointment._id);
    });

    await t.test('consultations.controller.js::create — patient fabriqué refusé (404), patient réel accepté', async () => {
      const bad = await call(consultC.create, { user, ip: '127.0.0.1', body: { patient: fakePatientId.toString(), medecin: medecin._id.toString(), service: 'Médecine générale' } });
      assert.equal(bad.status, 404, JSON.stringify(bad.body));
      const orphan = await Consultation.findOne({ patient: fakePatientId });
      assert.equal(orphan, null, 'aucune consultation ne doit exister pour un patient fabriqué');

      const good = await call(consultC.create, { user, ip: '127.0.0.1', body: { patient: patient._id.toString(), medecin: medecin._id.toString(), service: 'Médecine générale' } });
      assert.equal(good.status, 201, JSON.stringify(good.body));
      created.consults.push(good.body.consultation._id);
    });
  } finally {
    await Hospitalization.deleteMany({ _id: { $in: created.hosp } });
    await Appointment.deleteMany({ _id: { $in: created.appts } });
    await Consultation.deleteMany({ _id: { $in: created.consults } });
    await Patient.findByIdAndDelete(patient._id);
    await User.findByIdAndDelete(medecin._id);
    await mongoose.disconnect();
  }
});
