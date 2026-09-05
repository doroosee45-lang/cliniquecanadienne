// Correction 14 (relecture du 6 sept. 2026, DATA-002) — PediatricConsultation
// duplique une identité (patient_nom), mais était absent de CASCADE_TARGETS
// (utils/patientAnonymization.js) : restait en clair après anonymizePatient(),
// alors que Child.nom/prenom du même patient est bien scrubé.
//
// PediatricConsultation n'a aucune référence directe vers Patient._id
// (seulement child_id -> Child, Child.patient_id -> Patient) : le mécanisme
// générique CASCADE_TARGETS (correspondance directe {[refField]: patientId})
// ne peut pas s'appliquer tel quel. Résolu par une résolution en deux temps
// dédiée (Child.patient_id -> ids -> PediatricConsultation.child_id).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Correction 14 (DATA-002) — anonymizePatient() scrube PediatricConsultation.patient_nom', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Child = require('../models/Child');
  const PediatricConsultation = require('../models/PediatricConsultation');
  const { anonymizePatient } = require('../utils/patientAnonymization');

  const stamp = Date.now();
  const superadmin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Correction14', nom: 'Test' };
  const created = { patients: [], children: [], consultations: [] };

  try {
    await t.test('patient avec des PediatricConsultation liées -> patient_nom réellement scrubé, contenu clinique conservé', async () => {
      const p = await Patient.create({ nom: `T-CORRECTION14-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      created.patients.push(p._id);
      const child = await Child.create({ patient_id: p._id, nom: 'EnfantC14', prenom: 'X', date_naissance: '2018-01-01', sexe: 'M' });
      created.children.push(child._id);

      const consult1 = await PediatricConsultation.create({ child_id: child._id, patient_nom: 'FuiteIdentiteC14', motif: 'Test Correction14', diagnostic: 'RAS' });
      const consult2 = await PediatricConsultation.create({ child_id: child._id, patient_nom: 'FuiteIdentiteC14', motif: 'Test Correction14 bis', diagnostic: 'Otite' });
      created.consultations.push(consult1._id, consult2._id);

      await anonymizePatient(p._id, { utilisateur: superadmin._id, ip: '127.0.0.1' });

      const fresh1 = await PediatricConsultation.findById(consult1._id).lean();
      const fresh2 = await PediatricConsultation.findById(consult2._id).lean();
      assert.equal(fresh1.patient_nom, undefined, 'patient_nom doit être scrubé (consultation 1)');
      assert.equal(fresh2.patient_nom, undefined, 'patient_nom doit être scrubé (consultation 2)');
      // Contenu clinique jamais touché — seule l'identité affichée est scrubée.
      assert.equal(fresh1.motif, 'Test Correction14');
      assert.equal(fresh1.diagnostic, 'RAS');
      assert.equal(fresh2.diagnostic, 'Otite');
      assert.equal(String(fresh1.child_id), String(child._id), 'la référence ObjectId ne doit jamais être retirée');

      // Non-régression — Child.nom/prenom restent bien scrubés en parallèle.
      const freshChild = await Child.findById(child._id).lean();
      assert.equal(freshChild.nom, 'Patient anonymisé');
      assert.equal(freshChild.prenom, undefined);
      assert.equal(freshChild.patient_id.toString(), p._id.toString());
    });

    await t.test('non-régression — patient sans aucun Child/PediatricConsultation lié -> anonymisation réussit sans erreur', async () => {
      const p = await Patient.create({ nom: `T-CORRECTION14-VIDE-${stamp}`, prenom: 'P', date_naissance: '1985-05-05', sexe: 'F' });
      created.patients.push(p._id);

      await assert.doesNotReject(async () => {
        await anonymizePatient(p._id, { utilisateur: superadmin._id, ip: '127.0.0.1' });
      });

      const fresh = await Patient.findById(p._id).lean();
      assert.equal(fresh.anonymise, true);
    });
  } finally {
    await PediatricConsultation.deleteMany({ _id: { $in: created.consultations } });
    await Child.deleteMany({ _id: { $in: created.children } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
