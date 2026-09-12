// AUDIT-RH-PLANNING-RAPPEL — même structure de vérification que
// appointmentReminders.test.js : sélection réelle (fenêtre "2h avant",
// statut/type éligibles, rappel_2h_envoye=false), idempotence sur un
// second passage, contre une vraie base. mail.sendPlanningReminderEmail est
// stubbée (même convention) ; sms.sendSms tourne réellement en mode simulé
// (Twilio non configuré en test).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('rappels de planning 2h avant — sélection par fenêtre et idempotence (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Staff = require('../models/Staff');
  const AuditLog = require('../models/AuditLog');
  const mailModule = require('../utils/mail');
  const { sendPlanningReminders } = require('../utils/planningReminders');
  const env = require('../config/env');

  const stamp = Date.now();
  const originalSendPlanningReminderEmail = mailModule.sendPlanningReminderEmail;
  let sentEmails = [];
  mailModule.sendPlanningReminderEmail = async (opts) => { sentEmails.push(opts); return { simulated: true }; };

  // Correction (relecture du 11 sept. 2026) — même correctif que
  // planningPublish.test.js : ce test exerce le VRAI chemin utils/sms.js
  // (jamais stubbé, volontairement) ; si backend/.env contient de vraies
  // credentials Twilio, sendPlanningReminders() aurait réellement tenté un
  // envoi SMS via l'API Twilio pendant ce test. Neutralisé pour la seule
  // durée de ce test, jamais touché dans .env.
  const originalTwilio = {
    TWILIO_ACCOUNT_SID: env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: env.TWILIO_PHONE_NUMBER,
  };
  env.TWILIO_ACCOUNT_SID = ''; env.TWILIO_AUTH_TOKEN = ''; env.TWILIO_PHONE_NUMBER = '';

  // Construit un créneau dont le début réel (date + heure_debut combinés,
  // comme le fait slotStart() dans planningReminders.js) tombe exactement
  // `offsetMin` minutes dans le futur par rapport à maintenant.
  const buildSlot = (offsetMin, overrides = {}) => {
    const target = new Date(Date.now() + offsetMin * 60000);
    const pad = (n) => String(n).padStart(2, '0');
    return {
      date: target,
      heure_debut: `${pad(target.getHours())}:${pad(target.getMinutes())}`,
      heure_fin: '23:59',
      type: 'travail',
      statut: 'publie',
      rappel_2h_envoye: false,
      ...overrides,
    };
  };

  const staff = await Staff.create({
    prenom: 'T-RH-Rappel', nom: `2h${stamp}`, poste: 'medecin',
    email: `_t-rhrappel-${stamp}@_test.local`, telephone: '+23200000001',
    planning: [
      buildSlot(110),                                   // éligible — dans [1h30,2h00)
      buildSlot(95),                                     // éligible — dans la marge de rattrapage (hors de l'ancienne fenêtre pile 15 min [1h45,2h00), dedans depuis l'élargissement à 1h30)
      buildSlot(60),                                     // trop tôt — hors fenêtre
      buildSlot(180),                                    // trop tard — hors fenêtre
      buildSlot(110, { type: 'repos' }),                 // type non éligible
      buildSlot(110, { statut: 'brouillon' }),            // pas publié
      buildSlot(110, { rappel_2h_envoye: true }),          // déjà notifié
    ],
  });

  try {
    await t.test('les créneaux dans la fenêtre élargie [1h30,2h00) déclenchent un rappel, dont la marge de rattrapage', async () => {
      const { sent, failed, skipped } = await sendPlanningReminders();
      assert.ok(sent >= 2, 'les 2 créneaux éligibles doivent être comptés');
      assert.equal(failed, 0);
      assert.equal(skipped, 0, 'contact email/téléphone connu pour ce staff');
      assert.equal(sentEmails.length, 2, 'un email par créneau éligible — les 4 autres ne doivent pas déclencher de rappel');

      const fresh = await Staff.findById(staff._id);
      const [eligible, margeRattrapage, tropTot, tropTard, mauvaisType, brouillon, dejaEnvoye] = fresh.planning;
      assert.equal(eligible.rappel_2h_envoye, true, 'le créneau éligible doit être marqué notifié');
      assert.equal(margeRattrapage.rappel_2h_envoye, true, 'la marge de rattrapage (1h30-1h45) doit aussi déclencher — c\'est exactement le point de la résilience');
      assert.equal(tropTot.rappel_2h_envoye, false, 'hors fenêtre (trop tôt) — jamais touché');
      assert.equal(tropTard.rappel_2h_envoye, false, 'hors fenêtre (trop tard) — jamais touché');
      assert.equal(mauvaisType.rappel_2h_envoye, false, 'type repos — jamais éligible à un rappel');
      assert.equal(brouillon.rappel_2h_envoye, false, 'brouillon — jamais notifié tant que non publié');
      assert.equal(dejaEnvoye.rappel_2h_envoye, true, 'déjà marqué avant le passage — inchangé, pas re-décompté dans "sent"');
    });

    await t.test('AuditLog trace le batch (module hr, action PLANNING_REMINDER_BATCH)', async () => {
      const log = await AuditLog.findOne({ module: 'hr', action: 'PLANNING_REMINDER_BATCH' }).sort('-createdAt');
      assert.ok(log);
      assert.match(log.message, /envoyés/);
    });

    await t.test('un second passage ne rappelle pas deux fois le même créneau', async () => {
      sentEmails = [];
      const { sent } = await sendPlanningReminders();
      assert.equal(sentEmails.length, 0, 'le créneau éligible a déjà rappel_2h_envoye=true, exclu du second passage');
      assert.equal(sent, 0);
    });

    await t.test('SMS réellement simulé (Twilio non configuré) pour ce rappel — jamais un faux succès', async () => {
      const sms = require('../utils/sms');
      assert.equal(sms.isConfigured(), false);
      const result = await sms.sendSms({ to: staff.telephone, body: 'Test rappel' });
      assert.deepEqual(result, { simulated: true });
    });
  } finally {
    Object.assign(env, originalTwilio);
    mailModule.sendPlanningReminderEmail = originalSendPlanningReminderEmail;
    await AuditLog.deleteMany({ module: 'hr', action: 'PLANNING_REMINDER_BATCH', createdAt: { $gte: new Date(stamp) } });
    await Staff.findByIdAndDelete(staff._id);
    await mongoose.disconnect();
  }
});
