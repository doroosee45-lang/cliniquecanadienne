// AUDIT-RH-PLANNING-RAPPEL — même structure que appointmentReminders.js
// (job node-cron + fonction exportée séparément pour les tests). Fréquence
// */15 * * * * (contre une fois/jour pour les RDV) : un rappel "2h avant"
// pour des horaires de prise de poste variables dans la journée a besoin
// d'une fenêtre de détection étroite et d'une exécution fréquente, pas d'un
// balayage quotidien sur toute une journée.
//
// AUDIT-RH-PLANNING-RAPPEL-RESILIENCE — une première version utilisait une
// fenêtre pile large de 15 min ([1h45,2h00)), exactement calée sur la grille
// du cron : chaque créneau n'avait alors qu'UNE seule exécution capable de
// le détecter. Si le serveur est arrêté/indisponible pendant précisément
// cette exécution (redémarrage, déploiement, panne — un évènement courant
// et récurrent, contrairement au rappel RDV ci-dessous qui n'a qu'un seul
// tir/jour), le rappel de ce créneau est perdu définitivement : aux
// exécutions suivantes, l'écart réel (début du créneau - maintenant)
// continue de décroître et ne revient jamais dans la fenêtre. Risque bien
// plus élevé ici que pour appointmentReminders.js (fenêtre "toute la
// journée de demain", ~24h, contre un seul tir quotidien) : 96 occasions/jour
// de 15 min chacune sont statistiquement bien plus exposées à un
// redémarrage ordinaire qu'un unique tir journalier à heure fixe.
//
// Fenêtre élargie à [1h30, 2h00) — 30 min, soit 2 crans consécutifs de la
// grille au lieu d'un seul : si le premier cran est manqué (serveur down),
// le second (15 min plus tard) rattrape encore le même créneau. Aucun
// risque de doublon : rappel_2h_envoye est déjà l'idempotence — si le
// premier cran a réussi, le second le voit à true et l'ignore simplement.
const cron = require('node-cron');
const Staff = require('../models/Staff');
const mail = require('./mail');
const sms = require('./sms');
const { logAction } = require('./helpers');
const { logger, captureException } = require('./logger');

const ELIGIBLE_TYPES = ['travail', 'garde', 'astreinte'];
const TYPE_LABELS = { travail: 'Travail', garde: 'Garde', astreinte: 'Astreinte' };

const WINDOW_MIN_MS = 90 * 60 * 1000;  // 1h30 — marge de rattrapage d'un cycle de cron (15 min)
const WINDOW_MAX_MS = 120 * 60 * 1000; // 2h00

// Combine date (Date, seul le jour calendaire local importe) + heure_debut
// ("HH:mm") en un instant réel — impossible à exprimer directement dans un
// filtre Mongo sur un sous-document, donc calculé ici après un pré-filtre
// large côté base.
function slotStart(dateVal, heureDebut) {
  if (!dateVal || !heureDebut) return null;
  const [h, m] = String(heureDebut).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date(dateVal);
  d.setHours(h, m, 0, 0);
  return d;
}

async function sendPlanningReminders() {
  const now = new Date();
  const windowStart = new Date(now.getTime() + WINDOW_MIN_MS);
  const windowEnd = new Date(now.getTime() + WINDOW_MAX_MS);
  // Pré-filtre large (3 prochains jours) pour limiter le jeu de données
  // avant le calcul exact en JS ci-dessous.
  const rangeEnd = new Date(now.getTime() + 3 * 24 * 3600000);

  const staffList = await Staff.find({
    planning: {
      $elemMatch: {
        statut: 'publie',
        rappel_2h_envoye: false,
        type: { $in: ELIGIBLE_TYPES },
        date: { $gte: now, $lte: rangeEnd },
      },
    },
  }).populate('utilisateur', 'email telephone');

  let sent = 0, failed = 0, skipped = 0;
  for (const staff of staffList) {
    const email = staff.email || staff.utilisateur?.email || '';
    const telephone = staff.telephone || staff.utilisateur?.telephone || '';
    let dirty = false;

    for (const slot of staff.planning) {
      if (slot.statut !== 'publie' || slot.rappel_2h_envoye) continue;
      if (!ELIGIBLE_TYPES.includes(slot.type)) continue;
      const start = slotStart(slot.date, slot.heure_debut);
      if (!start || start < windowStart || start >= windowEnd) continue;

      if (!email && !telephone) { skipped++; continue; }

      const dateStr = start.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
      const typeLabel = TYPE_LABELS[slot.type] || slot.type;
      let anyOk = false;

      if (email) {
        try {
          await mail.sendPlanningReminderEmail({
            email, prenom: staff.prenom || '', nom: staff.nom || '', poste: staff.poste,
            date: dateStr, heure_debut: slot.heure_debut, heure_fin: slot.heure_fin, type: typeLabel,
          });
          anyOk = true;
        } catch (err) {
          logger.error('[planning-reminders] Échec email rappel', { staffId: staff._id.toString(), error: err.message });
        }
      }

      if (telephone) {
        const body = `Rappel : votre créneau (${typeLabel}) commence dans 2h, à ${slot.heure_debut || '—'}. Clinique Canadienne.`;
        try {
          await sms.sendSms({ to: telephone, body });
          anyOk = true;
        } catch (err) {
          logger.error('[planning-reminders] Échec SMS rappel', { staffId: staff._id.toString(), error: err.message });
        }
      }

      // Marqué envoyé une fois tenté, succès ou non (comme
      // hr.controller.js::publishSchedules) — le job tourne toutes les 15
      // min, retenter indéfiniment un contact durablement invalide ne
      // servirait à rien ; l'échec reste tracé dans les logs ci-dessus.
      slot.rappel_2h_envoye = true;
      dirty = true;
      if (anyOk) sent++; else failed++;
    }

    if (dirty) await staff.save();
  }

  if (sent || failed) {
    await logAction({
      action: 'PLANNING_REMINDER_BATCH', module: 'hr',
      message: `Rappels planning 2h — envoyés : ${sent}, échecs : ${failed}, sans contact : ${skipped}`,
    });
  }
  return { sent, failed, skipped };
}

// Toutes les 15 minutes — voir commentaire de fenêtre en tête de fichier.
// Démarré depuis server.js à côté de startReminderJob() ; désactivable en
// test/CI en ne l'appelant simplement pas.
function startPlanningReminderJob() {
  cron.schedule('*/15 * * * *', () => {
    sendPlanningReminders().catch(err => {
      logger.error('[planning-reminders] Erreur job rappels planning', { error: err.message, stack: err.stack });
      captureException(err, { job: 'planningReminders' });
    });
  });
}

module.exports = { sendPlanningReminders, startPlanningReminderJob };
