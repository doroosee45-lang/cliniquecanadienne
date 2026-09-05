// Correction 12 (relecture du 6 sept. 2026, FLOW-003) — LabResult et
// ImagingResult n'avaient aucun champ `consultation` : aucune traçabilité
// entre un examen demandé et la consultation qui l'a motivé.
//
// Correctif : champ optionnel `consultation` (ref Consultation) sur les deux
// modèles, renseigné uniquement quand laboratory.controller.js::create /
// radiology.controller.js::create reçoivent réellement un ObjectId valide
// référant une consultation du MÊME patient — vérifié avant persistance,
// jamais accepté à l'aveugle ni inventé.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Correction 12 (FLOW-003) — lien réel Laboratoire/Imagerie <-> Consultation', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Consultation = require('../models/Consultation');
  const LabResult = require('../models/LabResult');
  const ImagingResult = require('../models/ImagingResult');
  const labC = require('../controllers/laboratory.controller');
  const radioC = require('../controllers/radiology.controller');

  const stamp = Date.now();
  const created = { patients: [], users: [], consultations: [], labs: [], imgs: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const medecin = await User.create({ email: `_correction12-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'Correction12', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);

    await t.test('Laboratoire — consultation réelle du même patient -> lien persisté', async () => {
      const patient = await Patient.create({ nom: `T-CORRECTION12-1-${stamp}`, prenom: 'P', date_naissance: '1975-03-03', sexe: 'M' });
      created.patients.push(patient._id);
      const consultation = await Consultation.create({ patient: patient._id, medecin: medecin._id, diagnostic: 'Test Correction12' });
      created.consultations.push(consultation._id);

      const { status, body } = await call(labC.create, {
        body: { patient: patient._id.toString(), examens_demandes: [], consultation: consultation._id.toString() },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.labs.push(body.result._id);

      const fresh = await LabResult.findById(body.result._id).lean();
      assert.ok(fresh.consultation, 'le lien doit être réellement persisté en base');
      assert.equal(String(fresh.consultation), String(consultation._id));
    });

    await t.test('Laboratoire — aucune consultation fournie -> champ absent, jamais une valeur inventée', async () => {
      const patient = await Patient.create({ nom: `T-CORRECTION12-2-${stamp}`, prenom: 'P', date_naissance: '1980-04-04', sexe: 'F' });
      created.patients.push(patient._id);

      const { status, body } = await call(labC.create, {
        body: { patient: patient._id.toString(), examens_demandes: [] },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.labs.push(body.result._id);

      const fresh = await LabResult.findById(body.result._id).lean();
      assert.equal(fresh.consultation, null, 'même convention que examen: null dans ce contrôleur — jamais une valeur inventée');
    });

    await t.test('LIMITE — Laboratoire : consultation référant un AUTRE patient -> rejeté (400)', async () => {
      const patientA = await Patient.create({ nom: `T-CORRECTION12-3A-${stamp}`, prenom: 'P', date_naissance: '1970-05-05', sexe: 'M' });
      const patientB = await Patient.create({ nom: `T-CORRECTION12-3B-${stamp}`, prenom: 'P', date_naissance: '1970-06-06', sexe: 'F' });
      created.patients.push(patientA._id, patientB._id);
      const consultationA = await Consultation.create({ patient: patientA._id, medecin: medecin._id, diagnostic: 'Test Correction12 A' });
      created.consultations.push(consultationA._id);

      const { status, body } = await call(labC.create, {
        body: { patient: patientB._id.toString(), examens_demandes: [], consultation: consultationA._id.toString() },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 400, JSON.stringify(body));
      const count = await LabResult.countDocuments({ patient: patientB._id });
      assert.equal(count, 0, 'aucun résultat ne doit être créé si le lien fourni est invalide');
    });

    await t.test('Imagerie — consultation réelle du même patient -> lien persisté', async () => {
      const patient = await Patient.create({ nom: `T-CORRECTION12-4-${stamp}`, prenom: 'P', date_naissance: '1985-07-07', sexe: 'M' });
      created.patients.push(patient._id);
      const consultation = await Consultation.create({ patient: patient._id, medecin: medecin._id, diagnostic: 'Test Correction12 imagerie' });
      created.consultations.push(consultation._id);

      const { status, body } = await call(radioC.create, {
        body: { patient: patient._id.toString(), type_categorie: 'echographie', type_examen: 'Test', consultation: consultation._id.toString() },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.imgs.push(body.examen._id);

      const fresh = await ImagingResult.findById(body.examen._id).lean();
      assert.ok(fresh.consultation, 'le lien doit être réellement persisté en base');
      assert.equal(String(fresh.consultation), String(consultation._id));
    });

    await t.test('LIMITE — Imagerie : consultation référant un AUTRE patient -> rejeté (400)', async () => {
      const patientA = await Patient.create({ nom: `T-CORRECTION12-5A-${stamp}`, prenom: 'P', date_naissance: '1970-08-08', sexe: 'M' });
      const patientB = await Patient.create({ nom: `T-CORRECTION12-5B-${stamp}`, prenom: 'P', date_naissance: '1970-09-09', sexe: 'F' });
      created.patients.push(patientA._id, patientB._id);
      const consultationA = await Consultation.create({ patient: patientA._id, medecin: medecin._id, diagnostic: 'Test Correction12 imagerie A' });
      created.consultations.push(consultationA._id);

      const { status, body } = await call(radioC.create, {
        body: { patient: patientB._id.toString(), type_categorie: 'echographie', type_examen: 'Test', consultation: consultationA._id.toString() },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 400, JSON.stringify(body));
      const count = await ImagingResult.countDocuments({ patient: patientB._id });
      assert.equal(count, 0, 'aucun examen ne doit être créé si le lien fourni est invalide');
    });
  } finally {
    await LabResult.deleteMany({ _id: { $in: created.labs } });
    await ImagingResult.deleteMany({ _id: { $in: created.imgs } });
    await Consultation.deleteMany({ _id: { $in: created.consultations } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
