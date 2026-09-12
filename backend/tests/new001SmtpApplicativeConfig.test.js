// NEW-001 (rapport de correction du 11 sept. 2026) — Settings.jsx persiste
// réellement 4 paramètres SMTP applicatifs (notif_smtp_host/port/user/pwd,
// via POST /settings, Setting générique) mais utils/mail.js ne lisait
// jusqu'ici que des variables d'environnement serveur : la configuration
// saisie dans l'UI n'avait jamais d'effet réel sur l'envoi. Corrigé :
// utils/mail.js::getSmtpConfig() lit d'abord les 4 Setting applicatifs
// (utilisés uniquement si les 3 champs requis host/user/pass sont TOUS
// présents — jamais une configuration partielle), avec repli intégral sur
// les variables d'environnement historiques sinon. En parallèle,
// settings.controller.js masque désormais notif_smtp_pwd dans toute réponse
// API et dans le journal d'audit (jamais le vrai mot de passe en clair),
// et ignore une resoumission du masque lui-même (ne l'écrase jamais).
//
// Stubbe nodemailer.createTransport (jamais mail.sendEmail) — même
// technique que audit117EscapeHtmlEmails.test.js : capture la config RÉELLE
// avec laquelle le transporter serait construit pour un vrai envoi, sans
// jamais solliciter de réseau réel ni dépendre de vraies credentials SMTP
// (qui existent dans backend/.env sur cette machine, pour un usage sans
// rapport avec cette suite de tests — jamais lues ni modifiées ici).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

test('NEW-001 — configuration SMTP applicative (Settings) réellement utilisée, mot de passe jamais exposé', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Setting = require('../models/Setting');
  const AuditLog = require('../models/AuditLog');
  const User = require('../models/User');
  const mailUtil = require('../utils/mail');
  const env = require('../config/env');
  const settingsC = require('../controllers/settings.controller');

  const stamp = Date.now();
  const originalSmtp = { host: env.SMTP_HOST, port: env.SMTP_PORT, user: env.SMTP_USER, pass: env.SMTP_PASS };
  const originalCreateTransport = nodemailer.createTransport;

  const SMTP_KEYS = ['notif_smtp_host', 'notif_smtp_port', 'notif_smtp_user', 'notif_smtp_pwd'];
  const clearSettings = () => Setting.deleteMany({ cle: { $in: SMTP_KEYS } });

  let capturedCfg = null;
  let verifyShouldFail = false;
  nodemailer.createTransport = (cfg) => {
    capturedCfg = cfg;
    return {
      sendMail: async () => ({ messageId: 'stub-' + stamp }),
      verify: async () => {
        if (verifyShouldFail) throw new Error('Identifiants SMTP invalides (simulation)');
        return true;
      },
    };
  };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const admin = await User.create({ email: `_new001-admin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Admin', prenom: 'New001', role: 'superadmin', statut: 'actif' });

  try {
    await t.test('configuration SMTP applicative complète (host+port+user+pwd) réellement utilisée, prioritaire sur .env', async () => {
      await clearSettings();
      env.SMTP_HOST = 'env-fallback.invalid'; env.SMTP_PORT = '587'; env.SMTP_USER = 'env-user@invalid'; env.SMTP_PASS = 'env-pass';
      await call(settingsC.upsert, { user: admin, body: { cle: 'notif_smtp_host', valeur: 'settings-real.invalid', type: 'string', groupe: 'email' } });
      await call(settingsC.upsert, { user: admin, body: { cle: 'notif_smtp_port', valeur: '465', type: 'string', groupe: 'email' } });
      await call(settingsC.upsert, { user: admin, body: { cle: 'notif_smtp_user', valeur: 'settings-user@real.invalid', type: 'string', groupe: 'email' } });
      await call(settingsC.upsert, { user: admin, body: { cle: 'notif_smtp_pwd', valeur: 'VraiMotDePasse123!', type: 'string', groupe: 'email' } });

      capturedCfg = null;
      const result = await mailUtil.sendEmail({ to: 'dest@test.local', subject: 'Test', html: '<p>x</p>' });

      assert.ok(capturedCfg, 'un vrai transporter doit avoir été construit (jamais un mode simulé quand une config complète existe)');
      assert.equal(capturedCfg.host, 'settings-real.invalid', 'le host RÉELLEMENT utilisé doit venir de Settings, jamais de .env quand Settings est complet');
      assert.equal(capturedCfg.auth.user, 'settings-user@real.invalid', "l'utilisateur SMTP réellement utilisé doit venir de Settings");
      assert.equal(capturedCfg.auth.pass, 'VraiMotDePasse123!', 'le mot de passe réellement utilisé pour construire le transporter doit être celui de Settings (usage interne légitime, jamais exposé via API — voir test dédié)');
      assert.equal(capturedCfg.secure, true, 'port 465 doit activer TLS implicite (secure:true)');
      assert.notEqual(result.simulated, true, "un envoi avec configuration complète n'est jamais un mode simulé");
    });

    await t.test('configuration Settings absente → repli intégral et réel sur .env', async () => {
      await clearSettings();
      env.SMTP_HOST = 'env-fallback.invalid'; env.SMTP_PORT = '587'; env.SMTP_USER = 'env-user@invalid'; env.SMTP_PASS = 'env-pass';

      capturedCfg = null;
      await mailUtil.sendEmail({ to: 'dest@test.local', subject: 'Test', html: '<p>x</p>' });

      assert.ok(capturedCfg, 'un vrai transporter doit avoir été construit depuis .env');
      assert.equal(capturedCfg.host, 'env-fallback.invalid');
      assert.equal(capturedCfg.auth.user, 'env-user@invalid');
      assert.equal(capturedCfg.auth.pass, 'env-pass');
    });

    await t.test('configuration Settings PARTIELLE (mot de passe manquant) → jamais utilisée à moitié, repli intégral sur .env', async () => {
      await clearSettings();
      env.SMTP_HOST = 'env-fallback.invalid'; env.SMTP_PORT = '587'; env.SMTP_USER = 'env-user@invalid'; env.SMTP_PASS = 'env-pass';
      await call(settingsC.upsert, { user: admin, body: { cle: 'notif_smtp_host', valeur: 'settings-partial.invalid', type: 'string', groupe: 'email' } });
      await call(settingsC.upsert, { user: admin, body: { cle: 'notif_smtp_user', valeur: 'settings-partial-user@invalid', type: 'string', groupe: 'email' } });
      // notif_smtp_pwd volontairement absent.

      capturedCfg = null;
      await mailUtil.sendEmail({ to: 'dest@test.local', subject: 'Test', html: '<p>x</p>' });

      assert.ok(capturedCfg, 'le transporter doit être construit depuis .env (repli), pas rester bloqué');
      assert.equal(capturedCfg.host, 'env-fallback.invalid', 'jamais le host Settings partiel mélangé avec le reste de .env');
      assert.equal(capturedCfg.auth.user, 'env-user@invalid');
    });

    await t.test('ni Settings ni .env configurés → mode simulé honnête, jamais un faux succès', async () => {
      await clearSettings();
      env.SMTP_HOST = ''; env.SMTP_USER = ''; env.SMTP_PASS = '';

      capturedCfg = null;
      const result = await mailUtil.sendEmail({ to: 'dest@test.local', subject: 'Test', html: '<p>x</p>' });

      assert.equal(capturedCfg, null, 'aucun transporter ne doit être construit — aucune tentative réelle de connexion réseau');
      assert.deepEqual(result, { simulated: true }, 'doit renvoyer explicitement le mode simulé, jamais un contenu ni un succès inventé');
    });

    await t.test('le mot de passe SMTP est réellement masqué dans les réponses API et dans le journal d\'audit', async () => {
      await clearSettings();
      const before = await AuditLog.countDocuments({ module: 'settings', message: { $regex: 'MotDePasseTraceTest' } });
      await call(settingsC.upsert, { user: admin, body: { cle: 'notif_smtp_pwd', valeur: 'MotDePasseTraceTest99!', type: 'string', groupe: 'email' } });

      const { body: postBody } = await call(settingsC.upsert, { user: admin, body: { cle: 'notif_smtp_pwd', valeur: 'MotDePasseTraceTest99!', type: 'string', groupe: 'email' } });
      assert.notEqual(postBody.setting.valeur, 'MotDePasseTraceTest99!', 'la réponse de POST /settings ne doit jamais renvoyer le vrai mot de passe');
      assert.equal(postBody.setting.valeur, '••••••••', 'la réponse doit montrer le masque, pas une valeur vide (pour signaler qu\'un mot de passe est bien défini)');

      const { body: getBody } = await call(settingsC.getAll, {});
      const smtpPwdSetting = getBody.settings.find(s => s.cle === 'notif_smtp_pwd');
      assert.ok(smtpPwdSetting, 'le paramètre doit apparaître dans GET /settings');
      assert.notEqual(smtpPwdSetting.valeur, 'MotDePasseTraceTest99!', 'GET /settings ne doit jamais exposer le vrai mot de passe');
      assert.equal(smtpPwdSetting.valeur, '••••••••');

      // Vérifie la vraie valeur stockée en base (accès direct au modèle,
      // hors couche API) pour prouver que le masquage est bien une
      // protection de la seule réponse API, pas une perte de la vraie
      // configuration nécessaire à un envoi réel.
      const realStored = await Setting.findOne({ cle: 'notif_smtp_pwd' }).lean();
      assert.equal(realStored.valeur, 'MotDePasseTraceTest99!', 'la vraie valeur doit rester intacte en base pour un usage interne réel (getSmtpConfig)');

      const after = await AuditLog.countDocuments({ module: 'settings', message: { $regex: 'MotDePasseTraceTest' } });
      assert.equal(after, before, 'le vrai mot de passe ne doit jamais apparaître, même partiellement, dans le message du journal d\'audit');
    });

    await t.test('resoumettre le masque affiché ne remplace jamais le vrai mot de passe déjà stocké', async () => {
      await clearSettings();
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

    await t.test('POST /settings/test-smtp — un vrai succès de vérification renvoie un vrai succès, jamais un diagnostic fictif', async () => {
      await clearSettings();
      await call(settingsC.upsert, { user: admin, body: { cle: 'notif_smtp_host', valeur: 'verify-ok.invalid', type: 'string', groupe: 'email' } });
      await call(settingsC.upsert, { user: admin, body: { cle: 'notif_smtp_user', valeur: 'verify-ok-user@invalid', type: 'string', groupe: 'email' } });
      await call(settingsC.upsert, { user: admin, body: { cle: 'notif_smtp_pwd', valeur: 'VerifyOkPass1!', type: 'string', groupe: 'email' } });
      verifyShouldFail = false;

      const { status, body } = await call(settingsC.testSmtp, {});
      assert.equal(status, 200);
      assert.equal(body.success, true, 'un vrai succès de transporter.verify() doit renvoyer success:true');
      assert.match(body.message, /vérifiée avec succès/);
      assert.equal(body.source, 'settings');
    });

    await t.test('POST /settings/test-smtp — un vrai échec de vérification renvoie une vraie erreur, jamais masqué en succès', async () => {
      await clearSettings();
      await call(settingsC.upsert, { user: admin, body: { cle: 'notif_smtp_host', valeur: 'verify-fail.invalid', type: 'string', groupe: 'email' } });
      await call(settingsC.upsert, { user: admin, body: { cle: 'notif_smtp_user', valeur: 'verify-fail-user@invalid', type: 'string', groupe: 'email' } });
      await call(settingsC.upsert, { user: admin, body: { cle: 'notif_smtp_pwd', valeur: 'VerifyFailPass1!', type: 'string', groupe: 'email' } });
      verifyShouldFail = true;

      const { status, body } = await call(settingsC.testSmtp, {});
      assert.equal(status, 200, 'un échec de test SMTP reste une réponse HTTP 200 avec success:false, pas une exception non gérée');
      assert.equal(body.success, false, 'un vrai échec de transporter.verify() ne doit jamais être présenté comme un succès');
      assert.match(body.message, /Identifiants SMTP invalides/, "le message d'erreur réel doit être transmis, jamais masqué par un texte générique");
      verifyShouldFail = false;
    });

    await t.test('POST /settings/test-smtp — sans configuration disponible, aucune tentative réelle, message honnête', async () => {
      await clearSettings();
      env.SMTP_HOST = ''; env.SMTP_USER = ''; env.SMTP_PASS = '';
      capturedCfg = null;

      const { body } = await call(settingsC.testSmtp, {});
      assert.equal(body.success, false);
      assert.equal(capturedCfg, null, 'aucun transporter ne doit être construit quand aucune configuration SMTP (Settings ni .env) n\'est disponible');
      assert.match(body.message, /Aucune configuration SMTP/);
    });
  } finally {
    nodemailer.createTransport = originalCreateTransport;
    env.SMTP_HOST = originalSmtp.host; env.SMTP_PORT = originalSmtp.port; env.SMTP_USER = originalSmtp.user; env.SMTP_PASS = originalSmtp.pass;
    await clearSettings();
    await AuditLog.deleteMany({ module: 'settings', utilisateur: admin._id });
    await User.findByIdAndDelete(admin._id);
    await mongoose.disconnect();
  }
});
