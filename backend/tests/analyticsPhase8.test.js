// AUDIT-ANALYTICS-P8 — rapport hebdomadaire IA au Super Admin. Points
// vérifiés sur base réelle (jamais une réimplémentation) :
// 1. Mode simulé réel — OPENAI_API_KEY absente dans cet environnement (pas
//    de clé disponible, conception validée) : utils/openai.js doit renvoyer
//    {simulated:true}, jamais un faux succès ni un contenu inventé présenté
//    comme réellement généré par IA.
// 2. Structure du prompt — construite à partir de vraies données Analytics
//    (getStats/getReport, mêmes fonctions que l'API), et NE CONTIENT JAMAIS
//    le nom d'un patient réel, même quand une vraie alerte critique
//    nominative existe en base (vérifié par un cas positif construit exprès,
//    pas juste une absence par défaut).
// 3. sendWeeklyAnalyticsReport() de bout en bout — un vrai superadmin actif
//    reçoit une trace AuditLog réelle (persistée, relue depuis la base),
//    jamais seulement une valeur de retour non vérifiée indépendamment.
// 4. markdownToHtml — conversion réelle du sous-ensemble Markdown attendu du
//    modèle (titres/listes/paragraphes), pas un simulacre.
//
// AUDIT-ANALYTICS-P8-GARDE-FOU — sendWeeklyAnalyticsReportEmail est stubbée
// pour la durée du test (même pattern que appointmentReminders.test.js pour
// mail.sendReminderEmail) : sendWeeklyAnalyticsReport() interroge réellement
// TOUS les superadmins actifs de cette base partagée — un premier passage
// sans stub a réellement envoyé plusieurs emails SMTP à un vrai compte
// (constaté et signalé). Le stub porte uniquement sur la livraison email ;
// la génération du prompt (réelle, anonymisation vérifiée), la trace
// AuditLog (réelle, relue depuis la base) et le statut simulé/réel restent
// exercés tels quels, jamais réimplémentés.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Analytics Phase 8 — rapport hebdomadaire IA (mode simulé, base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const LabResult = require('../models/LabResult');
  const User = require('../models/User');
  const AuditLog = require('../models/AuditLog');
  const openai = require('../utils/openai');
  const mailModule = require('../utils/mail');
  const weekly = require('../utils/weeklyAnalyticsReport');
  const env = require('../config/env');

  const stamp = Date.now();
  const created = { patients: [], labresults: [], users: [] };

  const originalSendWeeklyAnalyticsReportEmail = mailModule.sendWeeklyAnalyticsReportEmail;
  const sentTo = [];
  mailModule.sendWeeklyAnalyticsReportEmail = async ({ email, simulated }) => { sentTo.push({ email, simulated }); return { simulated: true }; };

  // Ce test vérifie le comportement en MODE SIMULÉ (aucune clé OpenAI
  // configurée) — un vrai comportement métier, pas une caractéristique de
  // machine. Lire process.env ambiant faisait dépendre le résultat de la
  // machine d'exécution : si backend/.env contient une vraie clé (utilisée
  // ailleurs, ex. tests manuels), ce test échouait sur sa propre assertion
  // de sanity sans que le code testé soit en cause. env.OPENAI_API_KEY
  // (config/env.js, objet mutable) est donc neutralisé pour la SEULE durée
  // de ce test, jamais lu ni modifié dans .env — jamais une vraie clé
  // ajoutée ni supprimée du dépôt ou de l'environnement réel.
  const originalOpenaiKey = env.OPENAI_API_KEY;
  env.OPENAI_API_KEY = '';

  try {
    await t.test('utils/openai.js — mode simulé réel quand OPENAI_API_KEY est absente (jamais un faux succès)', async () => {
      assert.equal(openai.isConfigured(), false, 'sanity — aucune clé OpenAI dans cet environnement de test');
      const result = await openai.generateReport({ systemPrompt: 'test', userPrompt: 'test' });
      assert.deepEqual(result, { simulated: true }, 'doit renvoyer explicitement {simulated:true}, jamais un contenu inventé ni une erreur masquée');
    });

    await t.test('buildUserPrompt — ne transmet JAMAIS un nom de patient réel, même avec une vraie alerte critique nominative', async () => {
      const patient = await Patient.create({ nom: `T-ANLP8-NomSecret-${stamp}`, prenom: 'Prenomsecret', date_naissance: '1990-01-01', sexe: 'M' });
      created.patients.push(patient);
      const lab = await LabResult.create({ patient: patient._id, patient_nom: `T-ANLP8-NomSecret-${stamp} Prenomsecret`, est_critique: true, acquitte_par: null });
      created.labresults.push(lab);

      const data = await weekly.buildPromptData();
      const prompt = weekly.buildUserPrompt(data);

      assert.ok(!prompt.includes(`T-ANLP8-NomSecret-${stamp}`), 'le nom du patient ne doit jamais apparaître dans le prompt envoyé à OpenAI (tiers externe)');
      assert.ok(!prompt.includes('Prenomsecret'), 'le prénom du patient ne doit jamais apparaître dans le prompt');
      assert.match(prompt, /KPI clés/, 'le prompt doit contenir la structure de données réelles attendue');
      assert.match(prompt, /critique\(s\)/, 'le prompt doit exposer un compte agrégé d\'alertes critiques, jamais le détail nominatif');
    });

    await t.test('sendWeeklyAnalyticsReport() — un vrai superadmin actif reçoit une trace AuditLog réelle, mode simulé jamais présenté comme un succès réel', async () => {
      const admin = await User.create({ email: `t-anlp8-admin-${stamp}@test.local`, nom: `AdminP8-${stamp}`, prenom: 'Test', role: 'superadmin', statut: 'actif' });
      created.users.push(admin);

      const before = await AuditLog.countDocuments({ action: 'WEEKLY_ANALYTICS_REPORT', message: { $regex: admin.email } });
      const result = await weekly.sendWeeklyAnalyticsReport();

      assert.ok(result.simulated >= 1, 'au moins ce superadmin réel doit être compté en mode simulé (pas de clé OpenAI)');
      assert.equal(result.failed, 0, 'aucun échec attendu dans ce scénario');

      const after = await AuditLog.countDocuments({ action: 'WEEKLY_ANALYTICS_REPORT', message: { $regex: admin.email } });
      assert.equal(after, before + 1, 'une vraie trace AuditLog mentionnant ce destinataire doit être persistée, relue indépendamment du retour de fonction');

      const logEntry = await AuditLog.findOne({ action: 'WEEKLY_ANALYTICS_REPORT', message: { $regex: admin.email } }).sort('-createdAt').lean();
      assert.equal(logEntry.statut, 'succes', 'un envoi simulé réussi (email envoyé, contenu marqué simulé) n\'est pas un échec d\'audit');
      assert.match(logEntry.message, /simulé/, 'la trace doit indiquer explicitement que c\'était un envoi simulé, jamais masqué en succès réel silencieux');

      assert.ok(sentTo.some(s => s.email === admin.email && s.simulated === true), 'l\'envoi (stubbé) doit réellement avoir été tenté pour ce destinataire, marqué simulé — jamais un email SMTP réel envoyé pendant ce test');
    });

    await t.test('markdownToHtml — conversion réelle du sous-ensemble Markdown attendu (titres, listes, paragraphes)', () => {
      const md = '## Résumé\nTout va bien.\n\n## Points d\'attention\n- Item un\n- Item deux\n';
      const html = weekly.markdownToHtml(md);
      assert.match(html, /<h3[^>]*>Résumé<\/h3>/);
      assert.match(html, /<p[^>]*>Tout va bien\.<\/p>/);
      assert.match(html, /<h3[^>]*>Points d'attention<\/h3>/);
      assert.match(html, /<ul[^>]*><li[^>]*>Item un<\/li><li[^>]*>Item deux<\/li><\/ul>/);
    });
  } finally {
    env.OPENAI_API_KEY = originalOpenaiKey;
    mailModule.sendWeeklyAnalyticsReportEmail = originalSendWeeklyAnalyticsReportEmail;
    for (const l of created.labresults) await LabResult.findByIdAndDelete(l._id);
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id);
    for (const u of created.users) await User.findByIdAndDelete(u._id);
    await mongoose.disconnect();
  }
});
