// POST5-007 (audit indépendant post-Phase 5, 14 sept. 2026) — MOYENNE.
// laboratory.controller.js::create et radiology.controller.js::create ne
// vérifiaient `patient` que pour sa présence (truthiness), jamais son
// format ObjectId ni son existence réelle en base — les seuls contrôleurs
// cliniques de ce projet à ne pas le faire (consultations/prescriptions/
// echographie/hospitalization/maternity/chirurgie/pediatrie valident tous
// ce même garde-fou). Un ObjectId fabriqué/orphelin, ou même une chaîne
// arbitraire, était accepté tel quel.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) throw err; });
  return { status, body };
};

test('POST5-007 — laboratory.controller.js::create valide réellement l\'existence du patient (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const LabResult = require('../models/LabResult');
  const laboC = require('../controllers/laboratory.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Medecin' };
  const cleanup = [];

  try {
    await t.test('patient absent — refusé (400), rien créé', async () => {
      const r = await call(laboC.create, { user, ip: '127.0.0.1', body: { patient_nom: 'X' } });
      assert.equal(r.status, 400, JSON.stringify(r.body));
    });

    await t.test('patient au format invalide (pas un ObjectId) — refusé (400), rien créé', async () => {
      const r = await call(laboC.create, { user, ip: '127.0.0.1', body: { patient: 'pas-un-objectid', patient_nom: 'X' } });
      assert.equal(r.status, 400, JSON.stringify(r.body));
    });

    await t.test('patient fabriqué (format valide, mais aucun Patient réel) — refusé (400), aucun LabResult créé', async () => {
      const fauxId = new mongoose.Types.ObjectId();
      const r = await call(laboC.create, { user, ip: '127.0.0.1', body: { patient: String(fauxId), patient_nom: 'X' } });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      const count = await LabResult.countDocuments({ patient: fauxId });
      assert.equal(count, 0, 'aucun LabResult orphelin ne doit être créé');
    });

    await t.test('scénario nominal — patient réel et existant est accepté et persisté', async () => {
      const patient = await Patient.create({ nom: `P5007-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1990-01-01' });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
      const r = await call(laboC.create, { user, ip: '127.0.0.1', body: { patient: String(patient._id), patient_nom: 'Test P5007' } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => LabResult.findByIdAndDelete(r.body.result._id));
      assert.equal(String(r.body.result.patient), String(patient._id));
    });

    await t.test('non-régression — le champ alternatif patient_id (même sémantique) est lui aussi réellement validé', async () => {
      const fauxId = new mongoose.Types.ObjectId();
      const r = await call(laboC.create, { user, ip: '127.0.0.1', body: { patient_id: String(fauxId), patient_nom: 'X' } });
      assert.equal(r.status, 400, JSON.stringify(r.body));
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});

test('POST5-007 — radiology.controller.js::create valide réellement l\'existence du patient (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const ImagingResult = require('../models/ImagingResult');
  const radioC = require('../controllers/radiology.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Medecin' };
  const cleanup = [];

  try {
    await t.test('patient absent — refusé (400), rien créé', async () => {
      const r = await call(radioC.create, { user, ip: '127.0.0.1', body: { patient_nom: 'X' } });
      assert.equal(r.status, 400, JSON.stringify(r.body));
    });

    await t.test('patient au format invalide (pas un ObjectId) — refusé (400)', async () => {
      const r = await call(radioC.create, { user, ip: '127.0.0.1', body: { patient: 'pas-un-objectid', patient_nom: 'X' } });
      assert.equal(r.status, 400, JSON.stringify(r.body));
    });

    await t.test('patient fabriqué (format valide, mais aucun Patient réel) — refusé (400), aucun ImagingResult créé', async () => {
      const fauxId = new mongoose.Types.ObjectId();
      const r = await call(radioC.create, { user, ip: '127.0.0.1', body: { patient: String(fauxId), patient_nom: 'X' } });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      const count = await ImagingResult.countDocuments({ patient: fauxId });
      assert.equal(count, 0);
    });

    await t.test('scénario nominal — patient réel et existant est accepté et persisté', async () => {
      const patient = await Patient.create({ nom: `P5007B-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1990-01-01' });
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));
      const r = await call(radioC.create, { user, ip: '127.0.0.1', body: { patient: String(patient._id), patient_nom: 'Test P5007B' } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      cleanup.push(() => ImagingResult.findByIdAndDelete(r.body.examen._id));
      assert.equal(String(r.body.examen.patient), String(patient._id));
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
