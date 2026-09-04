// SEC-006 (audit indépendant du 4 sept. 2026) — auth.controller.js stockait
// user.reset_password_token en clair (pas de hash). En cas d'accès non
// autorisé à la base (fuite de backup, accès DB compromis), le token
// exploitable était directement lisible sans même intercepter l'e-mail. Le
// token était déjà à usage unique et expirait après 1h — seul le stockage
// en clair était en cause.
//
// Stub de mail.sendPasswordResetEmail (même pattern que
// auditC4ForgotPasswordEchecEnvoi.test.js) pour capturer le token en clair
// réellement destiné à l'e-mail, sans dépendre d'un vrai envoi SMTP — ce qui
// est vérifié ici (le hash stocké en base) est indépendant du canal d'envoi
// lui-même.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');

test('SEC-006 — le token de reset est stocké hashé (SHA-256), jamais en clair, et le flux complet reste fonctionnel (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const authC = require('../controllers/auth.controller');
  const mail = require('../utils/mail');

  const stamp = Date.now();
  const created = { users: [] };
  const originalSend = mail.sendPasswordResetEmail;

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; }, cookie: () => res };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const user = await User.create({
      email: `t-sec006-${stamp}@_test.local`, password: 'AncienMdp1!',
      nom: 'Test', prenom: 'SEC006', role: 'infirmier', statut: 'actif',
    });
    created.users.push(user._id);

    let tokenEnvoye = null;
    mail.sendPasswordResetEmail = async ({ token }) => { tokenEnvoye = token; return { simulated: false }; };

    await t.test('génération — la valeur stockée en base ne correspond jamais au token en clair envoyé par e-mail', async () => {
      const { status } = await call(authC.forgotPassword, { body: { email: user.email }, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.ok(tokenEnvoye, 'un vrai token en clair doit avoir été transmis au canal d\'envoi (e-mail)');

      const fresh = await User.findById(user._id).select('+reset_password_token');
      assert.ok(fresh.reset_password_token, 'un token (hashé) doit être stocké en base');
      assert.notEqual(fresh.reset_password_token, tokenEnvoye, 'la base ne doit jamais contenir le token en clair');

      const hashAttendu = crypto.createHash('sha256').update(tokenEnvoye).digest('hex');
      assert.equal(fresh.reset_password_token, hashAttendu, 'la valeur stockée doit être exactement le hash SHA-256 du token en clair, pas une autre transformation ou une valeur arbitraire');
    });

    await t.test('flux complet — reset avec le bon token (en clair) fonctionne toujours de bout en bout', async () => {
      const { status, body } = await call(authC.resetPassword, {
        params: { token: tokenEnvoye }, body: { password: 'NouveauMdp1!' }, ip: '127.0.0.1',
      });
      assert.equal(status, 200, JSON.stringify(body));

      const fresh = await User.findById(user._id).select('+password +reset_password_token +reset_password_expire');
      assert.ok(await fresh.matchPassword('NouveauMdp1!'), 'le nouveau mot de passe doit être actif malgré le stockage hashé du token');
      assert.equal(fresh.reset_password_token, undefined, 'le token doit être invalidé après usage (usage unique inchangé)');
      assert.equal(fresh.reset_password_expire, undefined);
    });

    await t.test('un token en clair qui ne correspond à aucun hash stocké est rejeté (400)', async () => {
      const { status } = await call(authC.resetPassword, {
        params: { token: 'un-token-invente-qui-ne-hash-vers-rien' }, body: { password: 'AutreMdp1!' }, ip: '127.0.0.1',
      });
      assert.equal(status, 400);
    });
  } finally {
    mail.sendPasswordResetEmail = originalSend;
    for (const id of created.users) await User.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
