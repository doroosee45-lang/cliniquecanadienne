// MIGRATION-RESEND (13 sept. 2026) — remplace new001SmtpApplicativeConfig.test.js
// (supprimé) : ce fichier ne testait pas seulement le masquage des Setting
// secrets, il exerçait surtout utils/mail.js::getSmtpConfig()/testSmtpConnection()
// et le routage SMTP applicatif via Settings — tout ce mécanisme a disparu
// avec le passage de l'envoi d'email de SMTP/nodemailer à l'API Resend (une
// seule clé API serveur, RESEND_API_KEY, aucune configuration via l'UI
// Settings). Ce qui reste réellement vivant de l'ancien fichier — et donc
// digne d'être conservé — est le mécanisme générique de masquage des
// Setting marqués secrets (settings.controller.js::SECRET_SETTING_KEYS/
// maskSecretSetting/upsert), qui n'est pas spécifique à SMTP : notif_smtp_pwd
// y reste listé par prudence (une installation antérieure peut encore avoir
// ce Setting en base) et sert ici de cas d'exemple pour prouver que le
// masquage fonctionne, pas que SMTP fonctionne.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('settings.controller.js — un Setting marqué secret (notif_smtp_pwd) est masqué en API et en audit', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Setting = require('../models/Setting');
  const AuditLog = require('../models/AuditLog');
  const User = require('../models/User');
  const settingsC = require('../controllers/settings.controller');

  const stamp = Date.now();
  const clearSetting = () => Setting.deleteMany({ cle: 'notif_smtp_pwd' });

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const admin = await User.create({ email: `_secmask-admin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Admin', prenom: 'SecMask', role: 'superadmin', statut: 'actif' });

  try {
    await t.test('le mot de passe est réellement masqué dans les réponses API et dans le journal d\'audit', async () => {
      await clearSetting();
      const before = await AuditLog.countDocuments({ module: 'settings', message: { $regex: 'MotDePasseTraceTest' } });
      const { body: postBody } = await call(settingsC.upsert, { user: admin, body: { cle: 'notif_smtp_pwd', valeur: 'MotDePasseTraceTest99!', type: 'string', groupe: 'email' } });
      assert.notEqual(postBody.setting.valeur, 'MotDePasseTraceTest99!', 'la réponse de POST /settings ne doit jamais renvoyer le vrai mot de passe');
      assert.equal(postBody.setting.valeur, '••••••••', 'la réponse doit montrer le masque, pas une valeur vide (pour signaler qu\'un mot de passe est bien défini)');

      const { body: getBody } = await call(settingsC.getAll, {});
      const smtpPwdSetting = getBody.settings.find(s => s.cle === 'notif_smtp_pwd');
      assert.ok(smtpPwdSetting, 'le paramètre doit apparaître dans GET /settings');
      assert.notEqual(smtpPwdSetting.valeur, 'MotDePasseTraceTest99!', 'GET /settings ne doit jamais exposer le vrai mot de passe');
      assert.equal(smtpPwdSetting.valeur, '••••••••');

      // Vérifie la vraie valeur stockée en base (accès direct au modèle, hors
      // couche API) pour prouver que le masquage est une protection de la
      // seule réponse API, pas une perte de la valeur réellement stockée.
      const realStored = await Setting.findOne({ cle: 'notif_smtp_pwd' }).lean();
      assert.equal(realStored.valeur, 'MotDePasseTraceTest99!', 'la vraie valeur doit rester intacte en base');

      const after = await AuditLog.countDocuments({ module: 'settings', message: { $regex: 'MotDePasseTraceTest' } });
      assert.equal(after, before, 'le vrai mot de passe ne doit jamais apparaître, même partiellement, dans le message du journal d\'audit');
    });

    await t.test('resoumettre le masque affiché ne remplace jamais le vrai mot de passe déjà stocké', async () => {
      await clearSetting();
      await call(settingsC.upsert, { user: admin, body: { cle: 'notif_smtp_pwd', valeur: 'MotDePasseOriginal1!', type: 'string', groupe: 'email' } });

      // Simule exactement ce que fait le frontend : il ne connaît que la
      // valeur masquée reçue par GET, et la resoumet telle quelle si
      // l'utilisateur n'a rien modifié.
      const { body: getBody } = await call(settingsC.getAll, {});
      const masked = getBody.settings.find(s => s.cle === 'notif_smtp_pwd').valeur;
      assert.equal(masked, '••••••••');

      await call(settingsC.upsert, { user: admin, body: { cle: 'notif_smtp_pwd', valeur: masked, type: 'string', groupe: 'email' } });

      const realStored = await Setting.findOne({ cle: 'notif_smtp_pwd' }).lean();
      assert.equal(realStored.valeur, 'MotDePasseOriginal1!', 'le vrai mot de passe stocké ne doit jamais être écrasé par le masque resoumis sans modification réelle');
    });
  } finally {
    await clearSetting();
    await AuditLog.deleteMany({ module: 'settings', utilisateur: admin._id });
    await User.findByIdAndDelete(admin._id);
    await mongoose.disconnect();
  }
});
