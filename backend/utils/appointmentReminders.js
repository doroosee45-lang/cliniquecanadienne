// R-10a — Appointment.rappels_envoyes existait déjà dans le schéma mais
// n'était jamais incrémenté : aucun job n'envoyait de rappel. Ce module
// rappelle une fois par jour les rendez-vous du lendemain qui n'ont pas
// encore reçu de rappel.
const cron = require('node-cron');
const Appointment = require('../models/Appointment');
const mail = require('./mail');
const { logAction } = require('./helpers');

// Statuts pour lesquels un rappel a encore du sens — un RDV déjà arrivé,
// en cours, terminé, reporté ou annulé n'en a plus besoin.
const PENDING_STATUTS = ['planifie', 'en_attente', 'confirme'];

async function sendTomorrowReminders() {
  const tomorrowStart = new Date();
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const appointments = await Appointment.find({
    date_heure: { $gte: tomorrowStart, $lte: tomorrowEnd },
    statut: { $in: PENDING_STATUTS },
    rappels_envoyes: 0,
  }).populate('patient', 'nom prenom email').populate('medecin', 'nom prenom');

  let sent = 0, failed = 0, skipped = 0;
  for (const appt of appointments) {
    if (!appt.patient?.email) { skipped++; continue; }
    try {
      await mail.sendReminderEmail({
        email: appt.patient.email,
        prenom: appt.patient.prenom,
        nom: appt.patient.nom,
        date_heure: appt.date_heure,
        medecin: appt.medecin ? `Dr. ${appt.medecin.prenom} ${appt.medecin.nom}` : '',
        type: appt.type,
        motif: appt.motif,
      });
      appt.rappels_envoyes += 1;
      await appt.save();
      sent++;
    } catch (err) {
      failed++;
      console.error(`[reminders] Échec envoi rappel RDV ${appt._id} :`, err.message);
    }
  }

  if (sent || failed) {
    await logAction({
      action: 'REMINDER_BATCH', module: 'appointments',
      message: `Rappels de rendez-vous — envoyés : ${sent}, échecs : ${failed}, sans email : ${skipped}`,
    });
  }
  return { sent, failed, skipped };
}

// Tous les jours à 8h — rappelle les RDV du lendemain. Le job est démarré
// depuis server.js ; désactivable en test/CI en ne l'appelant simplement pas.
function startReminderJob() {
  cron.schedule('0 8 * * *', () => {
    sendTomorrowReminders().catch(err => console.error('[reminders] Erreur job rappels RDV :', err.message));
  });
}

module.exports = { sendTomorrowReminders, startReminderJob };
