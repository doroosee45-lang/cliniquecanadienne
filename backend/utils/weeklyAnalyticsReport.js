// AUDIT-ANALYTICS-P8 — rapport hebdomadaire au Super Admin, même structure
// que planningReminders.js/appointmentReminders.js (job node-cron + fonction
// exportée séparément pour les tests). Contenu réellement généré par OpenAI
// à partir des vraies données Analytics (Phases 1-7) — jamais un texte
// statique republié comme "IA" (même écueil déjà corrigé Phase 3 sur les
// recommandations). Coexiste avec le bouton manuel par rôle
// (analytics.controller.js::sendReportEmail, Phase 1) : deux fonctionnalités
// distinctes, ni l'une ni l'autre ne remplace l'autre.
//
// AUDIT-ANALYTICS-P8-PRIVACY — décision validée avant code : jamais un nom
// de patient transmis au prompt (tiers externe, OpenAI). Les alertes ne sont
// résumées qu'en comptes agrégés (ex. "3 critiques"), jamais par titre
// individuel (qui contient un nom de patient dans getReport()).
const cron = require('node-cron');
const User = require('../models/User');
const analyticsC = require('../controllers/analytics.controller');
const openai = require('./openai');
const mail = require('./mail');
const { logAction } = require('./helpers');
const { logger, captureException } = require('./logger');

const SYSTEM_PROMPT = `Tu rédiges un rapport hebdomadaire de synthèse pour le super administrateur d'une clinique médicale (Clinique Canadienne de Souanké). Utilise UNIQUEMENT les données fournies dans le message utilisateur, n'invente jamais de chiffre ni de fait. Structure ta réponse en Markdown avec exactement ces sections, dans cet ordre : "## Résumé", "## Points d'attention", "## Recommandations", "## Chiffres clés". Reste factuel et concis (300 à 500 mots), en français. Ne mentionne aucun nom de patient ni information individuelle — tu ne reçois de toute façon que des données agrégées.`;

// Appelle les contrôleurs Analytics directement (même pattern que les
// fichiers de test de ce chantier) — pas de réimplémentation des
// agrégations, la même fonction que celle exposée par l'API.
async function callController(fn, req) {
  let body = null;
  const res = { status: () => res, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) throw err; });
  return body;
}

async function buildPromptData() {
  const stats = await callController(analyticsC.getStats, { query: { periode: 'semaine' } });
  const report = await callController(analyticsC.getReport, { query: {} });
  return { kpi: stats.kpi, trends: stats.trends, recommandations: stats.recommandations, charts: report.charts };
}

function fmtTrend(t) {
  if (!t) return 'non disponible (pas de référence sur la période précédente)';
  return `${t.pct > 0 ? '+' : ''}${t.pct}% (${t.sens})`;
}

// AUDIT-ANALYTICS-P8-PRIVACY — comptes agrégés uniquement, jamais les
// titres d'alertes (qui contiennent un nom de patient dans getReport()).
function buildUserPrompt({ kpi, trends, recommandations, charts }) {
  const alertesMed = charts.alertes_medicales || [];
  const alertesAdm = charts.alertes_admin || [];
  const critiques = alertesMed.filter(a => a.type === 'danger').length + alertesAdm.filter(a => a.type === 'danger').length;
  const avertissements = alertesMed.filter(a => a.type === 'warn').length + alertesAdm.filter(a => a.type === 'warn').length;

  const lignes = [
    'Période analysée : 7 derniers jours (fenêtre glissante).',
    '',
    'KPI clés (réels, jamais estimés) :',
    `- Nouveaux patients : ${kpi.patients_nouveaux} (tendance vs semaine précédente : ${fmtTrend(trends.patients_nouveaux)})`,
    `- Consultations : ${kpi.consultations_total} dont ${kpi.consultations_terminees} terminées et ${kpi.consultations_annulees} annulées (tendance : ${fmtTrend(trends.consultations_total)})`,
    `- Chiffre d'affaires : ${kpi.ca_total} CFA (tendance : ${fmtTrend(trends.ca_total)})`,
    `- Dépenses : ${kpi.depenses} CFA (tendance : ${fmtTrend(trends.depenses)})`,
    `- Bénéfice net : ${kpi.benefice} CFA (tendance : ${fmtTrend(trends.benefice)})`,
    `- Factures impayées (solde en cours) : ${kpi.factures_impayees} CFA`,
    `- Taux d'occupation hospitalisation : ${kpi.taux_occupation}%`,
    `- Taux d'occupation bloc opératoire : ${kpi.bloc_taux_occupation_salle}%`,
    `- Ruptures de stock pharmacie (en cours) : ${kpi.pharma_ruptures}`,
    `- Urgences sur la période : ${kpi.urgences_periode}, dont critiques : ${kpi.urgences_critiques}`,
    `- Missions ambulance sur la période : ${kpi.ambulances_missions_periode}`,
    `- Volume de messages sur la période : ${kpi.messages_volume_periode}${kpi.messages_temps_reponse_moyen_min != null ? `, temps de réponse moyen : ${kpi.messages_temps_reponse_moyen_min} min` : ''}`,
    '',
    `Alertes actives (comptes agrégés uniquement, aucune identité patient transmise) : ${critiques} critique(s), ${avertissements} avertissement(s).`,
    '',
    'Recommandations déjà calculées par le système (règles seuil réelles, pas générées par toi — tu peux les reformuler ou les prioriser dans ta section "Recommandations", ne pas en inventer de nouvelles) :',
    ...(recommandations.length
      ? recommandations.map(r => `- [${r.niveau}] ${r.titre} : ${r.description}`)
      : ['- Aucune recommandation déclenchée cette semaine, les indicateurs sont dans les normes.']),
  ];
  return lignes.join('\n');
}

// Convertisseur Markdown -> HTML volontairement minimal, limité au
// sous-ensemble demandé au modèle par SYSTEM_PROMPT (## titres, listes
// "- ", paragraphes) — jamais un parseur Markdown général, inutile ici
// puisque le format de sortie est entièrement contrôlé par notre prompt.
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function markdownToHtml(md) {
  const lines = String(md || '').split('\n');
  let html = '';
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { if (inList) { html += '</ul>'; inList = false; } continue; }
    if (line.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h3 style="color:#0B1E3B;margin:20px 0 8px;">${escapeHtml(line.slice(3))}</h3>`;
    } else if (line.startsWith('- ')) {
      if (!inList) { html += '<ul style="margin:0 0 12px;padding-left:20px;">'; inList = true; }
      html += `<li style="margin-bottom:4px;">${escapeHtml(line.slice(2))}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p style="margin:0 0 12px;line-height:1.5;">${escapeHtml(line)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

async function sendWeeklyAnalyticsReport() {
  const superadmins = await User.find({ role: 'superadmin', statut: 'actif', email: { $exists: true, $ne: '' } });
  if (superadmins.length === 0) {
    logger.warn('[weekly-analytics-report] Aucun superadmin actif avec email — rien à envoyer');
    return { sent: 0, simulated: 0, failed: 0 };
  }

  const data = await buildPromptData();
  const userPrompt = buildUserPrompt(data);

  let aiResult;
  try {
    aiResult = await openai.generateReport({ systemPrompt: SYSTEM_PROMPT, userPrompt });
  } catch (err) {
    // Échec de génération : chaque destinataire prévu reçoit une trace
    // d'échec (traçabilité complète même quand l'envoi n'a jamais pu
    // commencer) — jamais un envoi avec un contenu de repli inventé.
    for (const admin of superadmins) {
      await logAction({ action: 'WEEKLY_ANALYTICS_REPORT', module: 'analytics', statut: 'echec', message: `Échec génération IA pour ${admin.email} — ${err.message}` });
    }
    logger.error('[weekly-analytics-report] Échec génération IA', { error: err.message });
    captureException(err, { job: 'weeklyAnalyticsReport' });
    return { sent: 0, simulated: 0, failed: superadmins.length };
  }

  const htmlContenu = aiResult.simulated
    ? '<p><em>Mode simulé — OPENAI_API_KEY non configurée, aucune synthèse IA réelle générée cette semaine.</em></p>'
    : markdownToHtml(aiResult.content);

  let sent = 0, simulated = 0, failed = 0;
  for (const admin of superadmins) {
    try {
      await mail.sendWeeklyAnalyticsReportEmail({ email: admin.email, prenom: admin.prenom, nom: admin.nom, htmlContenu, simulated: !!aiResult.simulated });
      await logAction({
        action: 'WEEKLY_ANALYTICS_REPORT', module: 'analytics',
        message: aiResult.simulated
          ? `Rapport hebdomadaire simulé (OPENAI_API_KEY absente) — ${admin.email}`
          : `Rapport hebdomadaire envoyé (IA réelle) — ${admin.email}`,
      });
      if (aiResult.simulated) simulated++; else sent++;
    } catch (err) {
      failed++;
      await logAction({ action: 'WEEKLY_ANALYTICS_REPORT', module: 'analytics', statut: 'echec', message: `Échec envoi email — ${admin.email} — ${err.message}` });
      logger.error('[weekly-analytics-report] Échec envoi email', { adminId: admin._id.toString(), error: err.message });
    }
  }
  return { sent, simulated, failed };
}

// Dimanche 18h00 — fin de semaine, avant le début de la semaine suivante.
function startWeeklyAnalyticsReportJob() {
  cron.schedule('0 18 * * 0', () => {
    sendWeeklyAnalyticsReport().catch(err => {
      logger.error('[weekly-analytics-report] Erreur job rapport hebdomadaire', { error: err.message, stack: err.stack });
      captureException(err, { job: 'weeklyAnalyticsReport' });
    });
  });
}

// CODE-002 (audit indépendant du 6 sept. 2026) — SYSTEM_PROMPT n'était
// consommée nulle part hors de ce fichier (analyticsPhase8.test.js
// n'utilise que buildPromptData/buildUserPrompt/sendWeeklyAnalyticsReport/
// markdownToHtml, jamais SYSTEM_PROMPT directement) : export retiré, la
// constante reste utilisée en interne (ligne ~121).
module.exports = {
  sendWeeklyAnalyticsReport, startWeeklyAnalyticsReportJob,
  buildPromptData, buildUserPrompt, markdownToHtml,
};
