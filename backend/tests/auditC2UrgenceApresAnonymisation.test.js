// Ticket 0017 (C2) — un .save() réel sur un dossier Urgence déjà anonymisé
// échouait en ValidationError ("Path `patient_nom` is required") car
// patientAnonymization.js retirait ce champ requis via $unset (updateMany,
// qui ne déclenche pas les validateurs). Corrigé dans utils/
// patientAnonymization.js (CASCADE_TARGETS.requiredFields) : patient_nom est
// désormais remplacé par le libellé neutre "Patient anonymisé", jamais
// retiré. Reproduit ici le scénario concret du ticket : anonymiser un
// patient, puis appeler urgencesController.addSoin (non modifié) sur son
// dossier Urgence — doit réussir, pas échouer en 400.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Ticket 0017 (C2) — .save() sur Urgence après anonymisation patient (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Urgence = require('../models/Urgence');
  const { anonymizePatient } = require('../utils/patientAnonymization');
  const urgencesC = require('../controllers/urgencesController');

  const stamp = Date.now();
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'C2', nom: 'Test' };
  const created = { patients: [], urgences: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const patient = await Patient.create({ nom: `T-C2-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
    created.patients.push(patient._id);

    const urgence = await Urgence.create({
      patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`,
      patient_tel: '+242061234567', motif: `Motif T-C2-${stamp}`,
    });
    created.urgences.push(urgence._id);

    await anonymizePatient(patient._id, { utilisateur: admin._id, ip: '127.0.0.1' });

    await t.test('patient_nom remplacé par le libellé neutre, pas retiré', async () => {
      const fresh = await Urgence.findById(urgence._id).lean();
      assert.equal(fresh.patient_nom, 'Patient anonymisé');
    });

    await t.test('addSoin réussit toujours (vrai .save() sur le document anonymisé)', async () => {
      const { status, body } = await call(urgencesC.addSoin, {
        params: { id: urgence._id },
        body: { acte: 'Pansement', personnel: 'Infirmier Test' },
        user: admin, ip: '127.0.0.1',
      });
      assert.equal(status, 201, body && JSON.stringify(body));
      assert.ok(body.success);

      const fresh = await Urgence.findById(urgence._id).lean();
      assert.equal(fresh.soins.length, 1, 'le soin doit avoir été réellement persisté');
      assert.equal(fresh.patient_nom, 'Patient anonymisé', 'toujours présent après le save');
    });

    await t.test('addPrescription et addExamen réussissent aussi', async () => {
      const rx = await call(urgencesC.addPrescription, {
        params: { id: urgence._id }, body: { designation: 'Paracétamol', medecin: 'Dr Test' }, user: admin, ip: '127.0.0.1',
      });
      assert.equal(rx.status, 201);

      const ex = await call(urgencesC.addExamen, {
        params: { id: urgence._id }, body: { designation: 'NFS' }, user: admin, ip: '127.0.0.1',
      });
      assert.equal(ex.status, 201);
    });
  } finally {
    for (const id of created.urgences) await Urgence.findByIdAndDelete(id);
    for (const id of created.patients) await Patient.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
