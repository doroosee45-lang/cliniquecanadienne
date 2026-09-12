// SPEC-03 (correction du 12 sept. 2026, audit indépendant) — patient_id
// n'était pas requis côté schéma Pregnancy, et maternityController.js::
// create ne le validait que s'il était fourni : un appel API direct sans
// patient_id du tout créait un dossier de grossesse totalement anonyme,
// alors que Maternite.jsx::ModalDossier exige déjà réellement un patient
// existant avant tout envoi (aucun workflow "grossesse anonyme" réel ici,
// contrairement à l'accueil urgences). Ce test prouve que patient_id est
// désormais réellement obligatoire, au même titre qu'un patient_id
// fabriqué (déjà rejeté par AUDIT-3.4).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('SPEC-03 — patient_id est réellement obligatoire à la création d\'un dossier de grossesse', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Pregnancy = require('../models/Pregnancy');
  const maternityC = require('../controllers/maternityController');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const user = { _id: new mongoose.Types.ObjectId() };
  const created = { patients: [], pregnancies: [] };

  try {
    await t.test('patient_id absent est refusé (400), aucun dossier anonyme créé', async () => {
      const avant = await Pregnancy.countDocuments({});
      const { status } = await call(maternityC.create, { user, ip: '127.0.0.1', body: { ddr: new Date().toISOString() } });
      assert.equal(status, 400);
      assert.equal(await Pregnancy.countDocuments({}), avant, 'aucun dossier ne doit être créé sans patient_id');
    });

    await t.test('patient_id réel et existant est accepté et persisté', async () => {
      const patient = await Patient.create({ nom: `Spec03-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1992-01-01' });
      created.patients.push(patient._id);
      const { status, body } = await call(maternityC.create, {
        user, ip: '127.0.0.1',
        body: { patient_id: patient._id.toString(), ddr: new Date().toISOString() },
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.pregnancies.push(body.grossesse._id);
      const fresh = await Pregnancy.findById(body.grossesse._id).lean();
      assert.equal(String(fresh.patient_id), String(patient._id));
    });
  } finally {
    await Pregnancy.deleteMany({ _id: { $in: created.pregnancies } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
