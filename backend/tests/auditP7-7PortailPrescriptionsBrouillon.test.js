// AUDIT-P7-7 — portal.controller.js::getPrescriptions n'appliquait aucun
// filtre de statut : un brouillon (statut par défaut, avant publication par
// le médecin) était visible au patient comme n'importe quelle ordonnance
// réelle. Ce test prouve : brouillon et annulee sont exclus, tandis
// qu'active (état réellement atteint par de vraies ordonnances — seed.js,
// plusieurs autres tests — pas un résidu) reste bien visible au même titre
// que publiee/dispensee/expiree.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('P7-7 — le portail patient masque les ordonnances en brouillon/annulées (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const portalC = require('../controllers/portal.controller');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Prescription = require('../models/Prescription');
  require('../models/Medication'); // populate('lignes.medicament') exige le modèle enregistré

  const stamp = Date.now();
  const patient = await Patient.create({ nom: `P77-${stamp}`, prenom: 'Patient', date_naissance: '1990-01-01', sexe: 'F', email: `_p77-pat-${stamp}@_test.local` });
  const userPatient = await User.create({ email: `_p77-user-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: patient.nom, prenom: patient.prenom, role: 'patient', statut: 'actif', patient_id: patient._id });
  const medecin = await User.create({ email: `_p77-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'P77', prenom: 'Med', role: 'medecin', statut: 'actif' });
  const cleanup = [
    () => User.findByIdAndDelete(userPatient._id),
    () => User.findByIdAndDelete(medecin._id),
    () => Patient.findByIdAndDelete(patient._id),
  ];

  const call = async () => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await portalC.getPrescriptions({ user: userPatient }, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('brouillon et annulee sont masqués, active/publiee/dispensee/expiree restent visibles', async () => {
      const statutsAttendusVisibles = ['active', 'publiee', 'dispensee', 'expiree'];
      const statutsMasques = ['brouillon', 'annulee'];
      const tousLesRx = [];
      for (const statut of [...statutsAttendusVisibles, ...statutsMasques]) {
        const rx = await Prescription.create({
          patient: patient._id, medecin: medecin._id,
          lignes: [{ medicament_nom: `Test-${statut}`, quantite: 1 }],
          statut,
        });
        tousLesRx.push(rx);
        cleanup.push(() => Prescription.findByIdAndDelete(rx._id));
      }

      const { status, body } = await call();
      assert.equal(status, 200);
      const statutsRecus = body.prescriptions.map(p => p.statut).sort();
      assert.deepEqual(statutsRecus, [...statutsAttendusVisibles].sort(), 'seuls les 4 statuts réellement utilisables doivent être renvoyés');
      for (const s of statutsMasques) {
        assert.ok(!statutsRecus.includes(s), `${s} ne doit jamais apparaître dans les ordonnances du portail`);
      }
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
