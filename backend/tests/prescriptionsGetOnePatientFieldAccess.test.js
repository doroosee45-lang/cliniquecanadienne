// Mission harmonisation sélection patient (17 sept. 2026) — prescriptions.
// controller.js::getOne faisait `.populate('patient')` SANS restriction,
// renvoyant le dossier Patient complet (antecedents_medicaux, notes...) à
// n'importe quel rôle autorisé à lire une ordonnance — y compris
// pharmacien, un rôle restreint qui ne doit recevoir, selon la matrice
// RESTRICTED_FIELDS (patients.controller.js), que les champs
// démographiques + allergies. getAll() appliquait déjà correctement un
// jeu de champs minimal ; seul getOne() était concerné. Aligné sur la même
// source unique fieldsFor().
//
// Données synthétiques de démonstration — aucune donnée patient réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Prescriptions/getOne — respecte RESTRICTED_FIELDS sur le patient peuplé, jamais le dossier complet à un rôle restreint (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Prescription = require('../models/Prescription');
  require('../models/Medication'); // populate('lignes.medicament') exige le schéma enregistré, même en serveur isolé (cf. POST5-019)
  const rxC = require('../controllers/prescriptions.controller');

  const stamp = Date.now();
  const cleanup = [];

  try {
    const patient = await Patient.create({
      nom: `RxGetOne-${stamp}`, prenom: 'Synthetique', sexe: 'M', date_naissance: '1980-01-01', telephone: '060000001',
      antecedents_medicaux: ['Diabète type 2 (synthétique)'], notes: 'Notes cliniques confidentielles synthétiques', allergies: ['Pénicilline'],
    });
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));
    const medecin = await User.create({ email: `_rxgetone-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Test', prenom: 'Dr', role: 'medecin', statut: 'actif' });
    cleanup.push(() => User.findByIdAndDelete(medecin._id));
    const rx = await Prescription.create({
      patient: patient._id, medecin: medecin._id, diagnostic: 'Diagnostic synthétique',
      lignes: [{ medicament_nom: 'Paracétamol', posologie: '1cp x3/j', duree: '5 jours' }],
    });
    cleanup.push(() => Prescription.findByIdAndDelete(rx._id));

    const callGetOne = async (role) => {
      let status = 200, body = null;
      const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
      await rxC.getOne({ params: { id: rx._id }, user: { role } }, res, (err) => { if (err) throw err; });
      assert.equal(status, 200, JSON.stringify(body));
      return body.prescription;
    };

    await t.test('pharmacien (rôle restreint) : patient peuplé limité à démographique + allergies, jamais antecedents_medicaux/notes', async () => {
      const p = await callGetOne('pharmacien');
      assert.equal(p.patient.nom, `RxGetOne-${stamp}`);
      assert.deepEqual(p.patient.allergies, ['Pénicilline'], 'pharmacien a droit aux allergies (risque interaction)');
      assert.equal(p.patient.antecedents_medicaux, undefined, 'jamais un champ clinique non autorisé pour pharmacien');
      assert.equal(p.patient.notes, undefined, 'jamais les notes cliniques pour pharmacien');
    });

    await t.test('medecin (dossier complet) : aucune régression, tous les champs cliniques toujours présents', async () => {
      const p = await callGetOne('medecin');
      assert.deepEqual(p.patient.antecedents_medicaux, ['Diabète type 2 (synthétique)']);
      assert.equal(p.patient.notes, 'Notes cliniques confidentielles synthétiques');
      assert.deepEqual(p.patient.allergies, ['Pénicilline']);
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
