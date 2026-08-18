// AUDIT-A-4 — settings.controller.js::updateUser modifiait le rôle ou le
// statut d'un compte sans jamais en informer l'intéressé : une élévation
// ou rétrogradation de privilèges, ou une suspension, restait invisible
// tant que l'utilisateur ne la remarquait pas par lui-même. Ce test prouve :
// (a) aucune notification si ni role ni statut ne changent, (b) une
// notification 'info' est créée sur changement de rôle seul, (c) une
// notification 'warning' + un email de suspension sont envoyés quand le
// statut passe à 'suspendu', (d) un changement simultané role+statut
// produit un message combiné en une seule notification.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('A-4 — notification (et email si suspension) sur changement de rôle/statut (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const settingsC = require('../controllers/settings.controller');
  const User = require('../models/User');
  const Notification = require('../models/Notification');
  const mailModule = require('../utils/mail');

  const stamp = Date.now();
  const superadmin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin' };

  // SMTP est réellement configuré dans cet environnement (.env pointe vers
  // un vrai compte) — sans ce stub, l'email de suspension déclenche un
  // envoi réel qui rebondit sur les adresses factices *_@_test.local (rejet
  // RFC 5321 par le relais Gmail), faisant échouer next(err) avant même le
  // res.json(). Même pattern que patientSelfActivation.test.js.
  const sentSuspensionEmails = [];
  const originalSendAccountSuspendedEmail = mailModule.sendAccountSuspendedEmail;
  mailModule.sendAccountSuspendedEmail = async (opts) => { sentSuspensionEmails.push(opts); return { simulated: true }; };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const cleanup = [];

  try {
    let userId;
    await t.test('aucune notification si ni role ni statut ne changent', async () => {
      const user = await User.create({ email: `_a4-nochange-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Stable', prenom: 'Compte', role: 'infirmier', statut: 'actif' });
      userId = user._id;
      cleanup.push(() => User.findByIdAndDelete(userId));
      cleanup.push(() => Notification.deleteMany({ destinataire: userId }));

      const { status } = await call(settingsC.updateUser, {
        params: { id: userId },
        body: { prenom: 'Compte', nom: 'Stable', email: user.email, telephone: '+242060000001', role: 'infirmier', service: 'Urgences', statut: 'actif' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);

      const notif = await Notification.findOne({ destinataire: userId });
      assert.equal(notif, null, 'aucun changement de role/statut ne doit produire aucune notification');
    });

    await t.test('changement de rôle seul — notification de type info', async () => {
      const { status } = await call(settingsC.updateUser, {
        params: { id: userId },
        body: { prenom: 'Compte', nom: 'Stable', email: `_a4-nochange-${stamp}@_test.local`, telephone: '+242060000001', role: 'medecin', service: 'Urgences', statut: 'actif' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);

      const notif = await Notification.findOne({ destinataire: userId }).sort('-createdAt').lean();
      assert.ok(notif, 'une notification doit être créée sur changement de rôle');
      assert.equal(notif.type, 'info');
      assert.equal(notif.priorite, 'normale');
      assert.match(notif.message, /rôle : infirmier → medecin/);
      assert.doesNotMatch(notif.message, /statut/, 'seul le rôle a changé, le statut ne doit pas apparaître dans le message');
      assert.equal(sentSuspensionEmails.length, 0, 'un changement de rôle seul ne doit jamais envoyer un email de suspension');
    });

    let suspenduId;
    await t.test('changement de statut vers suspendu — notification warning + email de suspension', async () => {
      const user = await User.create({ email: `_a4-suspend-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Suspendu', prenom: 'Futur', role: 'receptionniste', statut: 'actif' });
      suspenduId = user._id;
      cleanup.push(() => User.findByIdAndDelete(suspenduId));
      cleanup.push(() => Notification.deleteMany({ destinataire: suspenduId }));

      const { status } = await call(settingsC.updateUser, {
        params: { id: suspenduId },
        body: { prenom: 'Futur', nom: 'Suspendu', email: user.email, telephone: '', role: 'receptionniste', service: '', statut: 'suspendu' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);

      const notif = await Notification.findOne({ destinataire: suspenduId }).lean();
      assert.ok(notif, 'une notification doit être créée sur suspension');
      assert.equal(notif.type, 'warning');
      assert.equal(notif.priorite, 'haute');
      assert.match(notif.message, /statut : actif → suspendu/);

      assert.equal(sentSuspensionEmails.length, 1, 'un email de suspension doit être envoyé');
      assert.equal(sentSuspensionEmails[0].email, user.email);
      assert.equal(sentSuspensionEmails[0].prenom, 'Futur');
    });

    await t.test('changement simultané rôle + statut — message combiné en une seule notification', async () => {
      const before = await Notification.countDocuments({ destinataire: suspenduId });
      const { status } = await call(settingsC.updateUser, {
        params: { id: suspenduId },
        body: { prenom: 'Futur', nom: 'Suspendu', email: `_a4-suspend-${stamp}@_test.local`, telephone: '', role: 'comptable', service: '', statut: 'actif' },
        user: superadmin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);

      const after = await Notification.countDocuments({ destinataire: suspenduId });
      assert.equal(after, before + 1, 'un seul document de notification pour un changement combiné role+statut');

      const notif = await Notification.findOne({ destinataire: suspenduId }).sort('-createdAt').lean();
      assert.match(notif.message, /rôle : receptionniste → comptable/);
      assert.match(notif.message, /statut : suspendu → actif/);
      assert.equal(notif.type, 'info', 'la levée de suspension ne doit pas être un warning');
      assert.equal(sentSuspensionEmails.length, 1, 'lever une suspension (statut ≠ suspendu) ne doit pas déclencher un nouvel email de suspension');
    });
  } finally {
    mailModule.sendAccountSuspendedEmail = originalSendAccountSuspendedEmail;
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
