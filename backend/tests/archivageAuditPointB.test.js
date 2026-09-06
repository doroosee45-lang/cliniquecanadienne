// AUDIT-ARCHIVAGE-B — 2 endpoints qui contournaient entièrement leur
// contrôleur (aucun logAction possible depuis un handler inline de fichier
// de routes) sont désormais de vraies fonctions de contrôleur, tracées.
// mail.sendAccountDeactivatedEmail est stubbée pour la durée du test (même
// garde-fou que Phase 8 — SMTP est réellement configuré dans cet
// environnement partagé, un envoi non stubbé enverrait un vrai email).
// CODE-004 (audit indépendant du 6 sept. 2026) — deactivateUser() appelait
// à tort sendAccountSuspendedEmail() (texte "suspendu", alors que cette
// fonction fixe statut:'inactif', une notion distincte) ; corrigé pour
// utiliser sendAccountDeactivatedEmail(), le stub ci-dessous suit ce
// changement réel, pas l'inverse.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Archivage/Audit — Point B : endpoints hors contrôleur désormais tracés (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const Invoice = require('../models/Invoice');
  const Notification = require('../models/Notification');
  const AuditLog = require('../models/AuditLog');
  const mailModule = require('../utils/mail');
  const settingsC = require('../controllers/settings.controller');
  const financeC = require('../controllers/finance.controller');

  const stamp = Date.now();
  const created = { users: [], invoices: [] };

  const originalSendAccountDeactivatedEmail = mailModule.sendAccountDeactivatedEmail;
  const sentEmails = [];
  mailModule.sendAccountDeactivatedEmail = async ({ email }) => { sentEmails.push(email); return { simulated: true }; };

  const call = async (fn, req = {}) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message }; } });
    return { status, body };
  };

  try {
    await t.test('settingsC.deactivateUser — bug latent corrigé : un id inexistant renvoie réellement 404, plus un faux succès silencieux', async () => {
      const admin = await User.create({ email: `t-archb-admin-${stamp}@test.local`, nom: 'Admin', prenom: 'A', role: 'superadmin', statut: 'actif' });
      created.users.push(admin);
      const fakeId = new mongoose.Types.ObjectId().toString();

      const { status, body } = await call(settingsC.deactivateUser, { params: { id: fakeId }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 404, 'un id inexistant doit désormais échouer explicitement (avant : success:true silencieux)');
      assert.equal(body.success, false);
    });

    await t.test('settingsC.deactivateUser — désactivation réelle : statut réel, AuditLog réel, notification réelle, email réel (stubbé)', async () => {
      const admin = await User.create({ email: `t-archb-admin2-${stamp}@test.local`, nom: 'Admin', prenom: 'A', role: 'superadmin', statut: 'actif' });
      const target = await User.create({ email: `t-archb-target-${stamp}@test.local`, nom: 'Cible', prenom: 'T', role: 'medecin', statut: 'actif' });
      created.users.push(admin, target);

      const { status, body } = await call(settingsC.deactivateUser, { params: { id: target._id.toString() }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.success, true);

      const fresh = await User.findById(target._id).lean();
      assert.equal(fresh.statut, 'inactif', 'le statut doit être réellement mis à jour en base');

      const log = await AuditLog.findOne({ action: 'DEACTIVATE_USER', module: 'admin', entite_id: target._id.toString() }).sort('-createdAt').lean();
      assert.ok(log, 'une vraie entrée AuditLog doit être persistée (avant : aucune, handler inline)');
      assert.match(log.message, new RegExp(target.email));

      const notif = await Notification.findOne({ destinataire: target._id }).sort('-createdAt').lean();
      assert.ok(notif, 'une vraie notification doit être créée pour le compte désactivé (cohérence avec updateUser)');
      assert.match(notif.titre, /désactivé/i);

      assert.ok(sentEmails.includes(target.email), 'un email doit être réellement tenté (stubbé) vers le compte désactivé');
    });

    await t.test('financeC.createRevenu — revenu direct réellement créé (vraie Invoice payée) ET tracé', async () => {
      const admin = await User.create({ email: `t-archb-fin-${stamp}@test.local`, nom: 'Admin', prenom: 'A', role: 'comptable', statut: 'actif' });
      created.users.push(admin);

      const { status, body } = await call(financeC.createRevenu, {
        body: { date: new Date().toISOString(), service: 'Consultation', patient: `T-ARCHB-Patient-${stamp}`, reference: `REF-${stamp}`, montant: 15000, mode: 'especes', notes: 'Test' },
        user: admin, ip: '127.0.0.1',
      });
      assert.equal(status, 201);
      assert.equal(body.success, true);
      created.invoices.push({ _id: body.revenu._id });

      const invoice = await Invoice.findById(body.revenu._id).lean();
      assert.ok(invoice, 'une vraie Invoice doit être persistée en base');
      assert.equal(invoice.statut, 'payee');
      assert.equal(invoice.montant_ttc, 15000);

      const log = await AuditLog.findOne({ action: 'CREATE', module: 'finance', entite_id: invoice._id.toString() }).sort('-createdAt').lean();
      assert.ok(log, 'une vraie entrée AuditLog doit être persistée (avant : aucune, handler inline)');
      assert.match(log.message, /Revenu direct/);
    });

    await t.test('financeC.createRevenu — montant invalide toujours refusé (comportement métier inchangé)', async () => {
      const admin = await User.create({ email: `t-archb-fin2-${stamp}@test.local`, nom: 'Admin', prenom: 'A', role: 'comptable', statut: 'actif' });
      created.users.push(admin);
      const { status, body } = await call(financeC.createRevenu, { body: { montant: 0 }, user: admin, ip: '127.0.0.1' });
      assert.equal(status, 400);
      assert.equal(body.success, false);
    });
  } finally {
    mailModule.sendAccountDeactivatedEmail = originalSendAccountDeactivatedEmail;
    for (const inv of created.invoices) await Invoice.findByIdAndDelete(inv._id);
    for (const u of created.users) await User.findByIdAndDelete(u._id);
    await mongoose.disconnect();
  }
});
