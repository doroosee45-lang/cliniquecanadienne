// Module « Dossiers Médicaux » — echographieController.js::getAll ne
// supportait aucun filtre ?patient=, contrairement à toutes ses collections
// sœurs (laboratory/radiology/hospitalization/urgences/consultations/
// chirurgie/prescriptions y répondent toutes déjà). Nécessaire pour que
// l'onglet "Imagerie" de PatientDetail.jsx puisse réellement filtrer les
// échographies d'UN patient (voir PatientDetail.jsx) plutôt que de recevoir
// les échographies de tous les patients.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('echographieController.getAll — filtre ?patient= (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Echographie = require('../models/Echographie');
  const echoC = require('../controllers/echographieController');

  const stamp = Date.now();
  const call = async (req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await echoC.getAll(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const patientA = await Patient.create({ nom: `EchoFiltreA${stamp}`, prenom: 'A', date_naissance: '1990-01-01', sexe: 'F' });
  const patientB = await Patient.create({ nom: `EchoFiltreB${stamp}`, prenom: 'B', date_naissance: '1990-01-01', sexe: 'M' });
  const echoA = await Echographie.create({ patient: patientA._id, patient_nom: patientA.nom, motif: 'Suivi A' });
  const echoB = await Echographie.create({ patient: patientB._id, patient_nom: patientB.nom, motif: 'Suivi B' });

  try {
    await t.test('?patient=<A> ne retourne que les échographies de A', async () => {
      const { status, body } = await call({ query: { patient: patientA._id.toString(), limit: 50 } });
      assert.equal(status, 200);
      const ids = body.demandes.map(d => String(d._id));
      assert.ok(ids.includes(String(echoA._id)), 'échographie du patient A doit apparaître');
      assert.ok(!ids.includes(String(echoB._id)), 'échographie du patient B ne doit jamais apparaître');
    });
  } finally {
    await Echographie.findByIdAndDelete(echoA._id);
    await Echographie.findByIdAndDelete(echoB._id);
    await Patient.findByIdAndDelete(patientA._id);
    await Patient.findByIdAndDelete(patientB._id);
    await mongoose.disconnect();
  }
});
