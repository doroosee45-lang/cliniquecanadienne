// AUDIT-11-7 — messages.controller.js::sendPatientEmail construisait le corps
// de l'email par interpolation directe du texte saisi par le personnel
// (`<p>${contenu}</p>`), sans échappement : un compte compromis ou malveillant
// pouvait envoyer un email contenant du HTML/liens arbitraires, avec l'adresse
// d'expédition officielle de la clinique comme origine (phishing crédible).
// En cherchant d'autres sites de la même classe de bug (contenu utilisateur
// interpolé directement dans du HTML d'email), sendPrescriptionEmail
// (diagnostic, medicament_nom/posologie/duree) et les 4 templates de
// rendez-vous (motif) présentaient exactement la même faille — tous corrigés
// avec la même fonction utils/helpers.js::escapeHtml.
//
// MIGRATION-RESEND (13 sept. 2026) — remplace le stub nodemailer.createTransport
// par un stub de resendSdk.Resend : les fonctions de utils/mail.js
// (sendPrescriptionEmail, sendAppointmentEmail...) appellent la const locale
// sendEmail directement, jamais module.exports.sendEmail — monkey-patcher
// l'export ne les intercepterait pas. mail.js lit resendSdk.Resend (propriété
// du module 'resend', jamais une liaison destructurée figée au require) à
// chaque construction de client — la stubber ici capture le HTML final
// réellement construit, pour les 3 fonctions concernées, sans dépendre d'un
// vrai réseau ni d'une vraie clé API.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const resendSdk = require('resend');

test('AUDIT-11-7 — contenu HTML échappé dans les emails patients (base réelle, Resend stubbé)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const msgC = require('../controllers/messages.controller');
  const mailUtil = require('../utils/mail');
  const env = require('../config/env');
  const Patient = require('../models/Patient');
  const User = require('../models/User');

  const stamp = Date.now();
  const originalResendApiKey = env.RESEND_API_KEY;
  const OriginalResend = resendSdk.Resend;

  // Force le chemin "Resend configuré" (sendEmail() renvoie tôt
  // {simulated:true} sinon, sans jamais construire ni transmettre le HTML) —
  // resendSdk.Resend étant stubbé ci-dessous, aucun réseau réel n'est jamais
  // sollicité.
  env.RESEND_API_KEY = 'stub-key-invalid';

  let capturedHtml = null;
  resendSdk.Resend = class FakeResend {
    constructor() {
      this.emails = { send: async (opts) => { capturedHtml = opts.html; return { data: { id: 'stub-' + stamp }, error: null }; } };
    }
  };

  const agent = await User.create({ email: `_h117-agent-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Agent', prenom: 'H117', role: 'medecin', statut: 'actif' });
  const patient = await Patient.create({ nom: `H117-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F', email: `_h117-patient-${stamp}@_test.local` });

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('sendPatientEmail — <script> et <a href> malveillants dans contenu ne restent plus des balises actives', async () => {
      const payload = 'Bonjour <script>alert(document.cookie)</script> cliquez ici : <a href="http://phishing.evil/steal">Cliquez ici</a>';
      capturedHtml = null;
      const { status } = await call(msgC.sendPatientEmail, { user: agent, body: { patient: patient._id.toString(), sujet: 'Test', contenu: payload }, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.ok(capturedHtml, 'le HTML final doit avoir été capturé par le stub nodemailer');
      assert.ok(!capturedHtml.includes('<script>'), 'aucune balise <script> active ne doit subsister dans le corps de l\'email');
      assert.ok(!capturedHtml.includes('<a href="http://phishing.evil/steal">'), 'aucun lien actif arbitraire ne doit subsister (attribut href non échappé)');
      assert.ok(capturedHtml.includes('&lt;script&gt;'), 'le texte du script doit apparaître littéralement échappé, affiché comme texte, pas exécuté');
      assert.ok(capturedHtml.includes('&lt;a href=&quot;http://phishing.evil/steal&quot;&gt;'), 'le lien doit apparaître littéralement échappé, jamais comme une vraie ancre cliquable');
    });

    await t.test('sendPatientEmail — non-régression : un message texte normal s\'affiche correctement', async () => {
      const payload = `Bonjour, votre resultat d analyse est disponible. Merci de votre confiance. Reference ${stamp}.`;
      capturedHtml = null;
      const { status } = await call(msgC.sendPatientEmail, { user: agent, body: { patient: patient._id.toString(), sujet: 'Résultat', contenu: payload }, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.ok(capturedHtml.includes(payload), 'un texte normal sans caractère HTML spécial doit apparaître intact (rien à échapper ne doit rien changer)');
      assert.ok(capturedHtml.includes(`<p>${payload}</p>`), 'le template légitime (<p>...</p>) doit rester intact autour du contenu');
    });

    await t.test('sendPrescriptionEmail — diagnostic et lignes de prescription échappés, le template légitime (table/tr/td) reste actif', async () => {
      capturedHtml = null;
      await mailUtil.sendPrescriptionEmail({
        email: patient.email, prenom: 'P', nom: `H117-${stamp}`,
        numero_rx: `RX-H117-${stamp}`, date: new Date(), medecin: 'Dr. Test',
        diagnostic: '<img src=x onerror=alert(1)>',
        lignes: [{ medicament_nom: '<script>evil()</script>', posologie: '<b>2x/jour</b>', duree: '7 jours', quantite: 14 }],
      });
      assert.ok(capturedHtml, 'le HTML final doit avoir été capturé');
      assert.ok(!capturedHtml.includes('<img src=x onerror=alert(1)>'), 'le diagnostic ne doit plus contenir de balise <img> active avec gestionnaire onerror');
      assert.ok(!capturedHtml.includes('<script>evil()</script>'), 'le nom de médicament ne doit plus contenir de balise <script> active');
      assert.ok(capturedHtml.includes('&lt;img src=x onerror=alert(1)&gt;'), 'le diagnostic doit apparaître littéralement échappé');
      // Le template légitime (tableau HTML réel) doit rester pleinement actif.
      assert.ok(capturedHtml.includes('<table'), 'le tableau HTML légitime du template ne doit jamais être échappé');
      assert.ok(capturedHtml.includes(`RX-H117-${stamp}`), 'le numéro de prescription (donnée de confiance, pas texte libre) reste affiché normalement');
    });

    await t.test('sendAppointmentEmail — motif échappé, le reste du template légitime reste intact', async () => {
      capturedHtml = null;
      await mailUtil.sendAppointmentEmail({
        email: patient.email, prenom: 'P', nom: `H117-${stamp}`,
        date_heure: new Date(Date.now() + 86400000), medecin: 'Dr. Test', type: 'consultation',
        motif: '<a href="http://phishing.evil/rdv">Confirmez ici</a>',
      });
      assert.ok(capturedHtml, 'le HTML final doit avoir été capturé');
      assert.ok(!capturedHtml.includes('<a href="http://phishing.evil/rdv">'), 'le motif ne doit plus contenir de lien actif arbitraire');
      assert.ok(capturedHtml.includes('&lt;a href=&quot;http://phishing.evil/rdv&quot;&gt;'), 'le motif doit apparaître littéralement échappé, jamais comme une vraie ancre');
      assert.ok(capturedHtml.includes('<table'), 'le tableau HTML légitime du template ne doit jamais être échappé');
    });
  } finally {
    resendSdk.Resend = OriginalResend;
    env.RESEND_API_KEY = originalResendApiKey;
    await Patient.findByIdAndDelete(patient._id);
    await User.findByIdAndDelete(agent._id);
    await mongoose.disconnect();
  }
});
