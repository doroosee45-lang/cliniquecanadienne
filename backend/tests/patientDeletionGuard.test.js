// Ticket 0008 — trois comptes User réels sont restés orphelins après la
// suppression de leur dossier Patient lié (patient.email ne correspondant
// plus exactement à celui du User au moment de la suppression, donc le
// nettoyage du compte lié dans patients.controller.js::remove() a
// silencieusement matché zéro document). Contrainte structurelle ajoutée à
// models/Patient.js : findOneAndDelete (donc findByIdAndDelete) refuse de
// supprimer un Patient tant qu'un User actif le référence par patient_id —
// vérifié ici directement contre le modèle, pas seulement via remove().
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Patient.findByIdAndDelete refuse un dossier référencé par un compte actif (ticket 0008)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');

  const stamp = Date.now();
  const cleanup = [];

  try {
    await t.test('bloque la suppression tant que patient_id pointe vers un User actif', async () => {
      const patient = await Patient.create({ nom: `T0008A${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      const user = await User.create({ email: `_t0008-active-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'T0008A', prenom: 'U', role: 'patient', statut: 'actif', patient_id: patient._id });
      cleanup.push(() => User.findByIdAndDelete(user._id));
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));

      await assert.rejects(
        Patient.findByIdAndDelete(patient._id),
        /compte portail actif/,
        'la suppression doit être refusée tant que le User actif référence ce patient'
      );
      assert.ok(await Patient.findById(patient._id), 'le dossier ne doit pas avoir été supprimé');
    });

    await t.test('autorise la suppression une fois le User lié désactivé', async () => {
      const patient = await Patient.create({ nom: `T0008B${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      const user = await User.create({ email: `_t0008-inactive-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'T0008B', prenom: 'U', role: 'patient', statut: 'inactif', patient_id: patient._id });
      cleanup.push(() => User.findByIdAndDelete(user._id));

      await Patient.findByIdAndDelete(patient._id);
      assert.equal(await Patient.findById(patient._id), null, 'un User inactif ne doit pas bloquer la suppression');
    });

    await t.test('autorise la suppression quand aucun User ne référence patient_id', async () => {
      const patient = await Patient.create({ nom: `T0008C${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });

      await Patient.findByIdAndDelete(patient._id);
      assert.equal(await Patient.findById(patient._id), null);
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
