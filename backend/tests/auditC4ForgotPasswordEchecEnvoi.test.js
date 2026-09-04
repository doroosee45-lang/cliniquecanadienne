// Ticket 0004 (C4) — l'échec d'envoi de l'email de reset n'était visible que
// dans les logs applicatifs (logger.error), jamais dans le journal d'audit
// métier (AuditLog) que les administrateurs consultent réellement. La
// réponse HTTP reste volontairement identique (anti-énumération de comptes,
// comportement correct conservé tel quel) — seule l'observabilité change.
//
// Reproduit un vrai échec d'envoi en stubant utils/mail.js::sendPasswordResetEmail
// pour qu'elle rejette (même pattern que auditP2MessagingActions.test.js pour
// sms.sendSms) plutôt que de dépendre d'un réseau réellement indisponible —
// voir passwordReset.test.js pour pourquoi une simple absence de config SMTP
// ne suffit pas à provoquer un échec réel (mode simulé, jamais d'erreur).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Ticket 0004 (C4) — échec d\'envoi de l\'email de reset tracé dans AuditLog (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const AuditLog = require('../models/AuditLog');
  const authC = require('../controllers/auth.controller');
  const mail = require('../utils/mail');

  const stamp = Date.now();
  const created = { users: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const originalSend = mail.sendPasswordResetEmail;

  try {
    const user = await User.create({
      email: `t-c4-${stamp}@medisync.test`, password: 'AncienMdp1!',
      nom: 'Test', prenom: 'C4', role: 'infirmier', statut: 'actif',
    });
    created.users.push(user._id);

    await t.test('envoi échoue (SMTP réel indisponible, simulé ici) — réponse HTTP inchangée, token révoqué, échec tracé dans AuditLog', async () => {
      mail.sendPasswordResetEmail = async () => { throw new Error('Connexion SMTP refusée (simulation)'); };

      const { status, body } = await call(authC.forgotPassword, { body: { email: user.email }, ip: '127.0.0.1' });
      assert.equal(status, 200, 'la réponse HTTP doit rester "succès" — anti-énumération de comptes, comportement volontaire à conserver');
      assert.match(body.message, /Si cet email existe/);

      const fresh = await User.findById(user._id);
      assert.equal(fresh.reset_password_token, undefined, 'le token doit être révoqué après échec d\'envoi');
      assert.equal(fresh.reset_password_expire, undefined);

      const entry = await AuditLog.findOne({ utilisateur: user._id, action: 'FORGOT_PASSWORD' }).sort({ createdAt: -1 });
      assert.ok(entry, 'la tentative doit être journalisée dans AuditLog, pas seulement dans les logs applicatifs');
      assert.equal(entry.statut, 'echec');
      assert.match(entry.message, /échec envoi email/);
    });

    await t.test('envoi réussi — token conservé, succès tracé dans AuditLog', async () => {
      mail.sendPasswordResetEmail = async () => ({ simulated: false });

      const { status } = await call(authC.forgotPassword, { body: { email: user.email }, ip: '127.0.0.1' });
      assert.equal(status, 200);

      const fresh = await User.findById(user._id);
      assert.ok(fresh.reset_password_token, 'le token doit être conservé après un envoi réussi');

      const entry = await AuditLog.findOne({ utilisateur: user._id, action: 'FORGOT_PASSWORD' }).sort({ createdAt: -1 });
      assert.equal(entry.statut, 'succes');
    });
  } finally {
    mail.sendPasswordResetEmail = originalSend;
    for (const id of created.users) await User.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
