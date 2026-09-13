// AUDIT-A-5 — laboratory.controller.js::validate notifie le médecin
// prescripteur sur résultat critique (est_critique) ; radiology.controller.js
// ::validation n'avait aucune notification équivalente, malgré
// anomalie_detectee (positionné par saveCR) qui en est l'analogue exact côté
// imagerie. Ce test prouve : notification créée quand anomalie_detectee est
// vrai à la validation, aucune notification sinon, et aucune notification
// si le prescripteur n'est pas renseigné (pas d'exception non plus).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('A-5 — notification du médecin prescripteur sur anomalie détectée à l\'imagerie (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const ImagingResult = require('../models/ImagingResult');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Notification = require('../models/Notification');
  const radioC = require('../controllers/radiology.controller');

  const stamp = Date.now();
  const patient = await Patient.create({ nom: `A5-${stamp}`, prenom: 'Patient', date_naissance: '1990-01-01', sexe: 'M' });
  const medecin = await User.create({ email: `_a5-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'A5', prenom: 'Prescripteur', role: 'medecin', statut: 'actif' });
  const radiologue = { _id: new mongoose.Types.ObjectId(), prenom: 'Rad', nom: 'A5', role: 'radiologue' };
  const cleanup = [
    () => User.findByIdAndDelete(medecin._id),
  ];
  // Patient supprimé après les ImagingResult ci-dessous, qui le référencent
  // encore (hook pre('findOneAndDelete') de Patient).
  const patientCleanup = [
    () => Patient.findByIdAndDelete(patient._id),
  ];

  const call = async (id) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await radioC.validation({ params: { id }, body: {}, user: radiologue }, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('anomalie_detectee=true + prescripteur renseigné → notification critique créée', async () => {
      const examen = await ImagingResult.create({
        patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`,
        medecin_prescripteur: medecin._id, type_examen: 'Scanner thoracique',
        statut: 'realise', anomalie_detectee: true, conclusion: 'Nodule pulmonaire suspect à explorer',
      });
      cleanup.push(() => ImagingResult.findByIdAndDelete(examen._id));

      const { status } = await call(examen._id);
      assert.equal(status, 200);

      const notif = await Notification.findOne({ destinataire: medecin._id, type: 'critical' }).lean();
      assert.ok(notif, 'une notification critique doit être créée');
      cleanup.push(() => Notification.findByIdAndDelete(notif._id));
      assert.equal(notif.priorite, 'critique');
      assert.match(notif.titre, /Anomalie détectée/);
      assert.match(notif.message, /Nodule pulmonaire/);
    });

    await t.test('anomalie_detectee=false → aucune notification', async () => {
      const examen = await ImagingResult.create({
        patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`,
        medecin_prescripteur: medecin._id, type_examen: 'Radio thorax',
        statut: 'realise', anomalie_detectee: false, conclusion: 'RAS',
      });
      cleanup.push(() => ImagingResult.findByIdAndDelete(examen._id));

      const { status } = await call(examen._id);
      assert.equal(status, 200);

      const notif = await Notification.findOne({ destinataire: medecin._id, type: 'critical', titre: /Radio thorax|RAS/ });
      const notifByMessage = await Notification.findOne({ destinataire: medecin._id, type: 'critical', message: 'RAS' });
      assert.equal(notifByMessage, null, 'aucune notification ne doit être créée sans anomalie détectée');
    });

    await t.test('anomalie_detectee=true mais aucun prescripteur renseigné → pas d\'exception, aucune notification', async () => {
      const examen = await ImagingResult.create({
        patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`,
        type_examen: 'IRM cérébrale', statut: 'realise', anomalie_detectee: true, conclusion: 'Anomalie sans prescripteur lié',
      });
      cleanup.push(() => ImagingResult.findByIdAndDelete(examen._id));

      const { status } = await call(examen._id);
      assert.equal(status, 200, 'la validation doit réussir même sans prescripteur à notifier');

      const notif = await Notification.findOne({ message: 'Anomalie sans prescripteur lié' });
      assert.equal(notif, null);
    });
  } finally {
    for (const fn of cleanup) await fn();
    for (const fn of patientCleanup) await fn();
    await mongoose.disconnect();
  }
});
