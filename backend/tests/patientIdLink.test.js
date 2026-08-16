// T2.2 — User ↔ Patient link. Two things verified against the real database
// (own test data, cleaned up after):
//  1) patients.controller.js::create sets User.patient_id at creation time
//     for the newly-linked account (not just relying on the migration).
//  2) The migration script (utils/migrate-link-patient-id.js) is idempotent
//     and doesn't touch already-linked accounts — safe to re-run.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('lien User.patient_id (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const Patient = require('../models/Patient');
  const patientsController = require('../controllers/patients.controller');

  await t.test('la création d\'un dossier patient renseigne patient_id sur le compte User lié', async () => {
    const stamp = Date.now();
    const email = `_t22-link-${stamp}@_test.local`;
    const req = {
      body: { nom: `Test${stamp}`, prenom: 'T22', date_naissance: '1990-01-01', sexe: 'M', email },
      user: { _id: new mongoose.Types.ObjectId(), prenom: 'Admin', nom: 'Test' },
      ip: '127.0.0.1',
      headers: {},
    };
    let response = null, thrown = null;
    const res = { status: () => res, json: (d) => { response = d; } };
    await patientsController.create(req, res, (err) => { thrown = err; });
    if (thrown) throw thrown;

    try {
      assert.ok(response?.patient, 'la création doit réussir');
      const user = await User.findOne({ email, role: 'patient' });
      assert.ok(user, 'le compte User lié doit exister');
      assert.equal(String(user.patient_id), String(response.patient._id), 'patient_id doit pointer vers le dossier créé');
    } finally {
      await Patient.findByIdAndDelete(response?.patient?._id);
      await User.deleteOne({ email });
    }
  });

  await t.test('le script de migration est idempotent (ré-exécution sans effet sur un compte déjà lié)', async () => {
    const email = `_t22-idempotent-${Date.now()}@_test.local`;
    const patient = await Patient.create({ nom: 'Test', prenom: 'Idem', date_naissance: new Date('1990-01-01'), sexe: 'F', email });
    const user = await User.create({ email, password: 'Test1234!', nom: 'Test', prenom: 'Idem', role: 'patient', patient_id: patient._id });
    try {
      execFileSync('node', [path.join(__dirname, '..', 'utils', 'migrate-link-patient-id.js')], { encoding: 'utf8' });
      const reloaded = await User.findById(user._id);
      assert.equal(String(reloaded.patient_id), String(patient._id), 'un compte déjà lié ne doit pas être modifié par une ré-exécution');
    } finally {
      // Le User (statut par défaut 'actif') référence patient._id : depuis
      // la contrainte structurelle du ticket 0008, il doit être supprimé
      // avant le Patient.
      await User.findByIdAndDelete(user._id);
      await Patient.findByIdAndDelete(patient._id);
    }
  });

  t.after(async () => { await mongoose.disconnect(); });
});
