// MIGRATION-RESEND (13 sept. 2026) — remplace le transport SMTP/nodemailer
// de utils/mail.js par l'API Resend (SDK officiel 'resend'). Ce fichier
// prouve le pattern d'honnêteté déjà établi pour les autres services
// externes optionnels (utils/openai.js, utils/sms.js) est bien respecté ici :
// (a) RESEND_API_KEY absente → {simulated:true} explicite, jamais un faux
// succès ; (b) une vraie erreur renvoyée par l'API Resend (via le champ
// `error` du SDK, qui ne rejette pas lui-même la promesse) est bien relancée
// comme une exception, jamais avalée silencieusement ; (c) un vrai succès
// renvoie les données Resend telles quelles.
//
// Stubbe resendSdk.Resend (propriété du module 'resend', lue par
// mail.js::getClient() à chaque construction, jamais une liaison
// destructurée figée au require — voir mail.js) : aucune vraie clé API ni
// aucun réseau réel n'est jamais sollicité par ce test.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const resendSdk = require('resend');

test('utils/mail.js::sendEmail — honnêteté du transport Resend', async (t) => {
  const mailUtil = require('../utils/mail');
  const env = require('../config/env');

  const originalApiKey = env.RESEND_API_KEY;
  const OriginalResend = resendSdk.Resend;

  try {
    await t.test('RESEND_API_KEY absente — mode simulé explicite, jamais un faux succès', async () => {
      env.RESEND_API_KEY = '';
      const result = await mailUtil.sendEmail({ to: 'dest@test.local', subject: 'Test', html: '<p>x</p>' });
      assert.deepEqual(result, { simulated: true }, 'doit renvoyer explicitement le mode simulé, jamais un contenu ou un succès inventé');
    });

    await t.test('RESEND_API_KEY configurée + succès réel de l\'API — renvoie les données Resend telles quelles', async () => {
      env.RESEND_API_KEY = 'stub-key-valid';
      resendSdk.Resend = class FakeResendOk {
        constructor() {
          this.emails = { send: async () => ({ data: { id: 'stub-id-123' }, error: null }) };
        }
      };
      const result = await mailUtil.sendEmail({ to: 'dest@test.local', subject: 'Test', html: '<p>x</p>' });
      assert.equal(result.id, 'stub-id-123');
      assert.notEqual(result.simulated, true, 'un envoi réussi ne doit jamais porter simulated:true');
    });

    await t.test('RESEND_API_KEY configurée + échec réel de l\'API (champ error du SDK) — relancé, jamais avalé en succès silencieux', async () => {
      env.RESEND_API_KEY = 'stub-key-valid';
      resendSdk.Resend = class FakeResendFail {
        constructor() {
          this.emails = { send: async () => ({ data: null, error: { message: 'Domaine expéditeur non vérifié (simulation)' } }) };
        }
      };
      await assert.rejects(
        () => mailUtil.sendEmail({ to: 'dest@test.local', subject: 'Test', html: '<p>x</p>' }),
        /Domaine expéditeur non vérifié/,
        'une vraie erreur Resend doit être relancée avec son message réel, jamais transformée en succès'
      );
    });
  } finally {
    env.RESEND_API_KEY = originalApiKey;
    resendSdk.Resend = OriginalResend;
  }
});
