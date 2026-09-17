// Mission harmonisation sélection patient (17 sept. 2026) — laboratory.
// controller.js::getOne faisait `.populate('patient')` SANS restriction,
// renvoyant le dossier Patient complet (antecedents_medicaux, notes...) à
// n'importe quel rôle autorisé à lire un résultat de labo, y compris
// laborantin — un rôle restreint qui ne doit recevoir, selon la matrice
// RESTRICTED_FIELDS (patients.controller.js), que démographique +
// groupe_sanguin + allergies. getAll() appliquait déjà un jeu de champs
// minimal statique (sûr) ; seul getOne() exposait le dossier complet.
// Même défaut, même correctif que prescriptionsGetOnePatientFieldAccess.
//
// Données synthétiques de démonstration — aucune donnée patient réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Laboratoire/getOne — respecte RESTRICTED_FIELDS sur le patient peuplé, jamais le dossier complet à un rôle restreint (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const LabResult = require('../models/LabResult');
  const labC = require('../controllers/laboratory.controller');

  const stamp = Date.now();
  const cleanup = [];

  try {
    const patient = await Patient.create({
      nom: `LabGetOne-${stamp}`, prenom: 'Synthetique', sexe: 'F', date_naissance: '1975-03-10', telephone: '060000002',
      groupe_sanguin: 'A+', antecedents_medicaux: ['Hypertension (synthétique)'], notes: 'Notes cliniques confidentielles synthétiques', allergies: ['Iode'],
    });
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));
    const medecin = await User.create({ email: `_labgetone-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Test', prenom: 'Dr', role: 'medecin', statut: 'actif' });
    cleanup.push(() => User.findByIdAndDelete(medecin._id));
    const lab = await LabResult.create({ patient: patient._id, medecin_prescripteur: medecin._id, statut: 'prescrit' });
    cleanup.push(() => LabResult.findByIdAndDelete(lab._id));

    const callGetOne = async (role) => {
      let status = 200, body = null;
      const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
      await labC.getOne({ params: { id: lab._id }, user: { _id: medecin._id, role } }, res, (err) => { if (err) throw err; });
      assert.equal(status, 200, JSON.stringify(body));
      return body.result;
    };

    await t.test('laborantin (rôle restreint) : patient peuplé limité à démographique + groupe_sanguin + allergies, jamais antecedents_medicaux/notes', async () => {
      const r = await callGetOne('laborantin');
      assert.equal(r.patient.nom, `LabGetOne-${stamp}`);
      assert.equal(r.patient.groupe_sanguin, 'A+', 'laborantin a droit au groupe sanguin (risque prélèvement)');
      assert.deepEqual(r.patient.allergies, ['Iode']);
      assert.equal(r.patient.antecedents_medicaux, undefined, 'jamais un champ clinique non autorisé pour laborantin');
      assert.equal(r.patient.notes, undefined, 'jamais les notes cliniques pour laborantin');
    });

    await t.test('medecin (dossier complet) : aucune régression, tous les champs cliniques toujours présents', async () => {
      const r = await callGetOne('medecin');
      assert.deepEqual(r.patient.antecedents_medicaux, ['Hypertension (synthétique)']);
      assert.equal(r.patient.notes, 'Notes cliniques confidentielles synthétiques');
      assert.equal(r.patient.groupe_sanguin, 'A+');
    });

    await t.test('preferLiveTelephone continue de fonctionner (telephone toujours présent, quel que soit le rôle)', async () => {
      const r = await callGetOne('laborantin');
      assert.equal(r.telephone, '060000002');
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
