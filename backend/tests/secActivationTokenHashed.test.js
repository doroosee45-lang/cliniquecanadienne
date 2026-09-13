// SEC-ACTIVATION-TOKEN-HASH (13 sept. 2026) — patients.controller.js
// stockait token_activation en clair, exactement la faille que SEC-006 avait
// déjà corrigée pour User.reset_password_token (auth.controller.js) : en cas
// d'accès non autorisé à la base (fuite de backup, accès DB compromis), le
// token d'activation était directement lisible et exploitable sans même
// intercepter l'email. Le token était déjà à usage unique (consommé par
// setPasswordAndActivate) et expirait après 24h — seul le stockage en clair
// était en cause, même diagnostic que SEC-006. Corrigé de la même façon :
// seul le hash SHA-256 est persisté désormais.
//
// Même technique que auditSEC006ResetTokenHashed.test.js : stub de
// mail.sendActivationEmail pour capturer le token en clair réellement
// destiné à l'email, indépendamment du canal d'envoi (Resend) lui-même.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');

test('SEC-ACTIVATION-TOKEN-HASH — le token d\'activation patient est stocké hashé (SHA-256), jamais en clair, et le flux complet reste fonctionnel (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const patientsC = require('../controllers/patients.controller');
  const mail = require('../utils/mail');

  const stamp = Date.now();
  const staff = { _id: new mongoose.Types.ObjectId(), prenom: 'SecAct', nom: 'Staff', role: 'receptionniste' };
  const created = { patients: [], users: [] };
  const originalSend = mail.sendActivationEmail;

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    let tokenEnvoye = null;
    mail.sendActivationEmail = async ({ token }) => { tokenEnvoye = token; return { simulated: false }; };

    const email = `_sec-act-${stamp}@_test.local`;

    await t.test('génération (create()) — la valeur stockée en base ne correspond jamais au token en clair envoyé par e-mail', async () => {
      const { status, body } = await call(patientsC.create, {
        user: staff, ip: '127.0.0.1', headers: {},
        body: { nom: `SecAct${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M', email },
      });
      assert.equal(status, 201);
      created.patients.push(body.patient._id);
      created.users.push((await User.findOne({ email }))._id);
      assert.ok(tokenEnvoye, 'un vrai token en clair doit avoir été transmis au canal d\'envoi (email)');

      const fresh = await Patient.findById(body.patient._id).select('+token_activation');
      assert.ok(fresh.token_activation, 'un token (hashé) doit être stocké en base');
      assert.notEqual(fresh.token_activation, tokenEnvoye, 'la base ne doit jamais contenir le token en clair');

      const hashAttendu = crypto.createHash('sha256').update(tokenEnvoye).digest('hex');
      assert.equal(fresh.token_activation, hashAttendu, 'la valeur stockée doit être exactement le hash SHA-256 du token en clair, pas une autre transformation ou une valeur arbitraire');
    });

    await t.test('flux complet — activation avec le bon token (en clair) fonctionne toujours de bout en bout', async () => {
      const { status, body } = await call(patientsC.setPasswordAndActivate, {
        params: { token: tokenEnvoye }, body: { password: 'NouveauMdp1!' }, ip: '127.0.0.1',
      });
      assert.equal(status, 200, JSON.stringify(body));

      const fresh = await Patient.findById(created.patients[0]);
      assert.equal(fresh.actif, true, 'le dossier doit être actif malgré le stockage hashé du token');
      assert.equal(fresh.token_activation, undefined, 'le token doit être invalidé après usage (usage unique inchangé)');
      assert.equal(fresh.token_activation_expire, undefined);

      const user = await User.findById(created.users[0]).select('+password');
      assert.ok(await user.matchPassword('NouveauMdp1!'), 'le mot de passe choisi doit être utilisable pour se connecter');
    });

    await t.test('un token en clair qui ne correspond à aucun hash stocké est rejeté (400)', async () => {
      const { status } = await call(patientsC.setPasswordAndActivate, {
        params: { token: 'un-token-invente-qui-ne-hash-vers-rien' }, body: { password: 'AutreMdp1!' }, ip: '127.0.0.1',
      });
      assert.equal(status, 400);
    });
  } finally {
    mail.sendActivationEmail = originalSend;
    // Ordre important (ticket 0008, models/Patient.js) : le User actif
    // référence encore le Patient via patient_id jusqu'à sa propre
    // suppression — il doit donc être supprimé en premier.
    for (const id of created.users) await User.findByIdAndDelete(id);
    for (const id of created.patients) await Patient.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
