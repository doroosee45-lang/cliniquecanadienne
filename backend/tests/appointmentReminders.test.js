// R-10a — Appointment.rappels_envoyes existait dans le schéma mais rien ne
// l'incrémentait jamais, faute de job. Vérifie la sélection réelle (fenêtre
// "demain", statuts éligibles, rappels_envoyes=0) et l'incrément après envoi.
// sendReminderEmail est stubbée pour la durée du test (même pattern que
// googlePatientCreation.test.js) : ce test porte sur la logique de sélection
// et d'incrément, pas sur la livraison SMTP réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('rappels de rendez-vous — sélection et incrément (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Appointment = require('../models/Appointment');
  const mailModule = require('../utils/mail');
  const { sendTomorrowReminders } = require('../utils/appointmentReminders');

  const stamp = Date.now();
  const originalSendReminderEmail = mailModule.sendReminderEmail;
  let sentTo = [];
  mailModule.sendReminderEmail = async ({ email }) => { sentTo.push(email); return { simulated: true }; };

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(10, 0, 0, 0);
  const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2); dayAfter.setHours(10, 0, 0, 0);
  const medecin = await User.create({ email: `_t10a-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Med', prenom: 'T10a', role: 'medecin', statut: 'actif' });
  const patient = await Patient.create({ nom: `T10a${stamp}`, prenom: 'Patient', date_naissance: '1990-01-01', sexe: 'M', email: `_t10a-pat-${stamp}@_test.local` });

  const apptEligible = await Appointment.create({ patient: patient._id, medecin: medecin._id, date_heure: tomorrow, motif: 'Test', statut: 'confirme' });
  const apptAnnule   = await Appointment.create({ patient: patient._id, medecin: medecin._id, date_heure: tomorrow, motif: 'Test annulé', statut: 'annule' });
  const apptHorsFenetre = await Appointment.create({ patient: patient._id, medecin: medecin._id, date_heure: dayAfter, motif: 'Test après-demain', statut: 'confirme' });

  try {
    await t.test('rappelle uniquement demain + statut éligible + pas déjà rappelé', async () => {
      const { sent } = await sendTomorrowReminders();
      assert.ok(sent >= 1);
      assert.ok(sentTo.includes(patient.email));

      const fresh = await Appointment.findById(apptEligible._id);
      assert.equal(fresh.rappels_envoyes, 1);

      const annuleFresh = await Appointment.findById(apptAnnule._id);
      assert.equal(annuleFresh.rappels_envoyes, 0, 'annulé — ne doit pas être rappelé');

      const horsFenetreFresh = await Appointment.findById(apptHorsFenetre._id);
      assert.equal(horsFenetreFresh.rappels_envoyes, 0, 'après-demain — hors fenêtre');
    });

    await t.test('un second passage ne rappelle pas deux fois le même RDV', async () => {
      sentTo = [];
      await sendTomorrowReminders();
      assert.equal(sentTo.includes(patient.email), false, 'rappels_envoyes déjà à 1 — doit être exclu');
    });
  } finally {
    mailModule.sendReminderEmail = originalSendReminderEmail;
    await Appointment.deleteMany({ _id: { $in: [apptEligible._id, apptAnnule._id, apptHorsFenetre._id] } });
    await Patient.findByIdAndDelete(patient._id);
    await User.findByIdAndDelete(medecin._id);
    await mongoose.disconnect();
  }
});
