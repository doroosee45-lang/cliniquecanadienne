// AUDIT-RH-PLANNING-NOTIF — POST /hr/:id/planning crée désormais en
// statut:'brouillon' (aucune notification), et PUT /hr/:id/planning/publier
// publie chaque créneau brouillon d'un employé avec une notification
// email+SMS SÉPARÉE par créneau (jamais consolidée — décision explicite).
// mail.sendPlanningPublishedEmail est stubbée (même pattern que
// appointmentReminders.test.js) ; sms.sendSms tourne réellement en mode
// simulé (Twilio non configuré en test) pour vérifier que ce chemin
// s'active proprement sans jamais se faire passer pour un vrai succès.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('publication de planning — notification par créneau, idempotence (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Staff = require('../models/Staff');
  const AuditLog = require('../models/AuditLog');
  const hrC = require('../controllers/hr.controller');
  const mailModule = require('../utils/mail');

  const stamp = Date.now();
  const originalSendPlanningEmail = mailModule.sendPlanningPublishedEmail;
  const sentEmails = [];
  mailModule.sendPlanningPublishedEmail = async (opts) => { sentEmails.push(opts); return { simulated: true }; };

  const staff = await Staff.create({
    prenom: 'T-RH-Plan', nom: `Notif${stamp}`, poste: 'infirmier',
    email: `_t-rhplan-${stamp}@_test.local`, telephone: '+23200000000',
  });
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'Admin', nom: 'Test' };

  try {
    let body = null, status = 200;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };

    await t.test('addSchedule crée en statut brouillon (jamais publie directement)', async () => {
      await hrC.addSchedule({ params: { id: staff._id }, user: admin, body: { date: '2026-09-20', heure_debut: '08:00', heure_fin: '16:00', type: 'travail' } }, res, () => {});
      await hrC.addSchedule({ params: { id: staff._id }, user: admin, body: { date: '2026-09-21', heure_debut: '08:00', heure_fin: '16:00', type: 'garde' } }, res, () => {});
      const fresh = await Staff.findById(staff._id);
      assert.equal(fresh.planning.length, 2);
      assert.ok(fresh.planning.every(p => p.statut === 'brouillon'));
      assert.ok(fresh.planning.every(p => p.notifie_publication === false));
    });

    await t.test('publishSchedules publie chaque créneau et envoie une notification SÉPARÉE par créneau', async () => {
      body = null; status = 200;
      await hrC.publishSchedules({ params: { id: staff._id }, user: admin }, res, () => {});
      assert.equal(status, 200);
      assert.equal(body.publies, 2, 'les 2 créneaux brouillon doivent être publiés');

      // Pas de consolidation : un appel email PAR créneau, jamais un seul
      // message listant les deux.
      assert.equal(sentEmails.length, 2, 'un email par créneau publié, pas un email consolidé');
      const dates = sentEmails.map(e => e.date);
      assert.notEqual(dates[0], dates[1], 'chaque email correspond à un créneau distinct');

      const fresh = await Staff.findById(staff._id);
      assert.ok(fresh.planning.every(p => p.statut === 'publie'));
      assert.ok(fresh.planning.every(p => p.notifie_publication === true));
    });

    await t.test('AuditLog trace la publication (module hr, action PLANNING_PUBLISH)', async () => {
      const log = await AuditLog.findOne({ module: 'hr', action: 'PLANNING_PUBLISH', entite_id: staff._id.toString() }).sort('-createdAt');
      assert.ok(log, 'une entrée AuditLog doit exister pour cette publication');
      assert.match(log.message, /2 créneau/);
    });

    await t.test('un second appel est idempotent — rien à publier, aucun nouvel envoi', async () => {
      sentEmails.length = 0;
      body = null; status = 200;
      await hrC.publishSchedules({ params: { id: staff._id }, user: admin }, res, () => {});
      assert.equal(status, 200);
      assert.equal(body.publies, 0, 'aucun créneau brouillon restant');
      assert.equal(sentEmails.length, 0, 'aucun renvoi sur des créneaux déjà publiés');
    });

    await t.test('un nouveau créneau ajouté après publication reste indépendant (pas republié)', async () => {
      await hrC.addSchedule({ params: { id: staff._id }, user: admin, body: { date: '2026-09-22', heure_debut: '08:00', heure_fin: '16:00', type: 'travail' } }, res, () => {});
      sentEmails.length = 0;
      body = null; status = 200;
      await hrC.publishSchedules({ params: { id: staff._id }, user: admin }, res, () => {});
      assert.equal(body.publies, 1, 'seul le nouveau créneau brouillon est publié');
      assert.equal(sentEmails.length, 1);

      const fresh = await Staff.findById(staff._id);
      assert.equal(fresh.planning.filter(p => p.statut === 'publie').length, 3, 'les 2 anciens restent publiés + le nouveau');
    });

    await t.test('SMS réellement simulé (Twilio non configuré) — jamais un faux succès déguisé', async () => {
      // sms.sendSms n'est PAS stubbé ci-dessus : le chemin réel de
      // utils/sms.js s'exécute, retombant sur { simulated: true } tant que
      // TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER ne sont pas configurés.
      const sms = require('../utils/sms');
      assert.equal(sms.isConfigured(), false, "cet environnement de test n'a pas de creds Twilio réels");
      const result = await sms.sendSms({ to: staff.telephone, body: 'Test' });
      assert.deepEqual(result, { simulated: true });
    });
  } finally {
    mailModule.sendPlanningPublishedEmail = originalSendPlanningEmail;
    await AuditLog.deleteMany({ module: 'hr', entite_id: staff._id.toString() });
    await Staff.findByIdAndDelete(staff._id);
    await mongoose.disconnect();
  }
});
