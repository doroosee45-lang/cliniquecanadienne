// CLIN-02 + CLIN-03 + URG-03 (correction du 12 sept. 2026, audit indépendant)
// — create() passait `...req.body` tel quel : un client pouvait fabriquer
// numero/statut/admission_status/patient à la création (CLIN-02), et
// update() laissait encore patient/numero réassignables après coup
// (CLIN-03). Un `patient` fourni n'était jamais vérifié comme existant
// (URG-03) — un ObjectId fabriqué pouvait créer un dossier durablement
// orphelin, incohérent avec Patient comme référentiel central.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('CLIN-02/CLIN-03/URG-03 — liste blanche stricte, patient réel vérifié, identité protégée après création', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Urgence = require('../models/Urgence');
  const Patient = require('../models/Patient');
  const urgC = require('../controllers/urgencesController');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const patientReel = await Patient.create({ nom: `Clin02-${stamp}`, prenom: 'Test', date_naissance: '1990-01-01', sexe: 'M' });
  const cleanup = { urgences: [] };

  try {
    await t.test('un client ne peut pas fabriquer numero/statut/admission_status à la création (aucun patient impliqué ici)', async () => {
      const { status, body } = await call(urgC.create, {
        user: { _id: new mongoose.Types.ObjectId() },
        body: {
          patient_nom: `Test-Clin02-${stamp}`, niveau_triage: 'orange', motif: 'Test',
          numero: 'URG-FORGE-0000', statut: 'sorti', admission_status: 'terminee',
        },
      });
      assert.equal(status, 201);
      cleanup.urgences.push(body.urgence._id);

      const fresh = await Urgence.findById(body.urgence._id).lean();
      assert.notEqual(fresh.numero, 'URG-FORGE-0000', 'le numero doit toujours être généré par le serveur');
      assert.equal(fresh.statut, 'attente', 'le statut fabriqué ne doit jamais être honoré à la création');
      assert.equal(fresh.admission_status, 'non_requise', 'admission_status ne doit jamais être fabriqué à la création');
    });

    await t.test('un ObjectId patient fabriqué/orphelin fourni à la création est refusé, jamais accepté silencieusement', async () => {
      const fakePatientId = new mongoose.Types.ObjectId();
      const { status } = await call(urgC.create, {
        user: { _id: new mongoose.Types.ObjectId() },
        body: { patient_nom: `Test-Clin02b-${stamp}`, niveau_triage: 'orange', motif: 'Test', patient: fakePatientId.toString() },
      });
      assert.equal(status, 404, 'un ObjectId patient qui ne résout vers aucun vrai Patient doit être refusé, pas créer un dossier orphelin');
    });

    await t.test('URG-03 — un patient réellement fourni et existant est accepté et persisté', async () => {
      const { status, body } = await call(urgC.create, {
        user: { _id: new mongoose.Types.ObjectId() },
        body: { patient_nom: `${patientReel.prenom} ${patientReel.nom}`, patient: patientReel._id.toString(), niveau_triage: 'jaune', motif: 'Test' },
      });
      assert.equal(status, 201);
      cleanup.urgences.push(body.urgence._id);
      const fresh = await Urgence.findById(body.urgence._id).lean();
      assert.equal(String(fresh.patient), String(patientReel._id));
    });

    await t.test('URG-03 — un ObjectId patient qui ne correspond à aucun vrai Patient est refusé (404), jamais accepté silencieusement', async () => {
      const { status, body } = await call(urgC.create, {
        user: { _id: new mongoose.Types.ObjectId() },
        body: { patient_nom: 'Fantome Test', patient: new mongoose.Types.ObjectId().toString(), niveau_triage: 'vert', motif: 'Test' },
      });
      assert.equal(status, 404);
      assert.equal(body.success, false);
    });

    await t.test('CLIN-03 — patient/numero restent protégés après création (update générique)', async () => {
      const { body: created } = await call(urgC.create, {
        user: { _id: new mongoose.Types.ObjectId() },
        body: { patient_nom: `Test-Clin03-${stamp}`, patient: patientReel._id.toString(), niveau_triage: 'vert', motif: 'Test' },
      });
      cleanup.urgences.push(created.urgence._id);
      const autrePatient = new mongoose.Types.ObjectId();

      await call(urgC.update, {
        params: { id: created.urgence._id }, user: { _id: new mongoose.Types.ObjectId() },
        body: { patient: autrePatient.toString(), numero: 'URG-USURPE-0000', motif: 'Motif mis à jour — légitime' },
      });
      const fresh = await Urgence.findById(created.urgence._id).lean();
      assert.equal(String(fresh.patient), String(patientReel._id), 'patient ne doit jamais être réassignable via update()');
      assert.notEqual(fresh.numero, 'URG-USURPE-0000');
      assert.equal(fresh.motif, 'Motif mis à jour — légitime', 'un champ légitime hors liste protégée doit toujours fonctionner (non-régression)');
    });
  } finally {
    await Urgence.deleteMany({ _id: { $in: cleanup.urgences } });
    await Patient.findByIdAndDelete(patientReel._id);
    await mongoose.disconnect();
  }
});
