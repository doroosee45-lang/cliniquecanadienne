const Appointment = require('../models/Appointment');
const Patient     = require('../models/Patient');
const User        = require('../models/User');
const Service     = require('../models/Service');
const { logAction, paginate, checkAppointmentConflict } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');
const { sendAppointmentEmail, sendAppointmentConfirmedEmail, sendAppointmentRescheduledEmail } = require('../utils/mail');
const { logger } = require('../utils/logger');

// Résout patient/médecin/service en une fois pour les notifications RDV —
// partagé entre create() et update() plutôt que dupliqué.
const resolveApptContacts = async (appt) => {
  const [patient, medecinDoc, serviceDoc] = await Promise.all([
    Patient.findById(appt.patient).select('nom prenom email').lean(),
    User.findById(appt.medecin).select('nom prenom specialite').lean(),
    appt.service ? Service.findById(appt.service).select('nom').lean() : null,
  ]);
  const medecinNom = medecinDoc
    ? `Dr ${medecinDoc.prenom} ${medecinDoc.nom}${medecinDoc.specialite ? ` (${medecinDoc.specialite})` : ''}`
    : '—';
  return { patient, medecinNom, serviceNom: serviceDoc?.nom || '' };
};

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 500, statut, medecin, patient, date, from, to } = req.query;
    const filter = {};
    if (statut)  filter.statut  = statut;
    if (medecin) filter.medecin = medecin;
    if (patient) filter.patient = patient;

    if (date) {
      // Filtre jour précis
      const d = new Date(date);
      filter.date_heure = { $gte: new Date(d.setHours(0,0,0,0)), $lt: new Date(d.setHours(23,59,59,999)) };
    } else if (from || to) {
      // Plage de dates explicite
      filter.date_heure = {};
      if (from) filter.date_heure.$gte = new Date(from);
      if (to)   filter.date_heure.$lte = new Date(to);
    } else {
      // Par défaut : 60 jours passés → 12 mois à venir
      const debut = new Date(); debut.setDate(debut.getDate() - 60);
      const fin   = new Date(); fin.setFullYear(fin.getFullYear() + 1);
      filter.date_heure = { $gte: debut, $lte: fin };
    }

    const total = await Appointment.countDocuments(filter);
    const appointments = await paginate(
      Appointment.find(filter)
        .populate('patient', 'nom prenom numero_dossier telephone')
        .populate('medecin', 'nom prenom specialite')
        .sort('date_heure'),
      page, limit
    );
    res.json({ success: true, total, count: appointments.length, appointments });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const appt = await Appointment.findById(req.params.id)
      .populate('patient', 'nom prenom numero_dossier telephone')
      .populate('medecin', 'nom prenom specialite');
    if (!appt) return res.status(404).json({ success: false, message: 'Rendez-vous introuvable.' });
    res.json({ success: true, appointment: appt });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    // Conflict detection
    const { medecin, date_heure, duree_minutes = 30 } = req.body;
    const conflict = await checkAppointmentConflict({ medecin, date_heure, duree_minutes });
    if (conflict) {
      await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'appointments', ip: req.ip, statut: 'echec', message: `Création refusée — conflit de créneau (médecin ${medecin})` });
      return res.status(400).json({ success: false, message: 'Conflit: le médecin a déjà un rendez-vous à cette heure.' });
    }

    // AUDIT-2.1 — la vérification ci-dessus n'est pas atomique avec l'écriture
    // qui suit : l'index unique partiel du modèle (medecin+date_heure) ferme
    // la course pour une requête concurrente sur le créneau exact, remontée
    // ici en 409 plutôt qu'en erreur serveur brute.
    let appt;
    try {
      appt = await Appointment.create({ ...req.body, created_by: req.user._id });
    } catch (err) {
      if (err.code === 11000) {
        await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'appointments', ip: req.ip, statut: 'echec', message: `Création refusée — conflit de créneau détecté à l'écriture (médecin ${medecin})` });
        return res.status(409).json({ success: false, message: 'Conflit: ce créneau vient d\'être réservé par une autre requête. Veuillez réessayer.' });
      }
      throw err;
    }
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'appointments', entite_id: appt._id, ip: req.ip, message: `Nouveau RDV: ${appt.type}` });
    emitActivity({ module: 'appointments', action: 'Nouveau rendez-vous', detail: appt.type, icon: '📅', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();

    // Envoi email de confirmation au patient (non bloquant)
    let emailEnvoye = false;
    try {
      const { patient, medecinNom, serviceNom } = await resolveApptContacts(appt);
      if (patient?.email) {
        await sendAppointmentEmail({
          email:         patient.email,
          prenom:        patient.prenom,
          nom:           patient.nom,
          date_heure:    appt.date_heure,
          medecin:       medecinNom,
          type:          appt.type,
          service:       serviceNom,
          motif:         appt.motif,
          duree_minutes: appt.duree_minutes,
        });
        emailEnvoye = true;
      }
    } catch (mailErr) {
      logger.error('[MAIL RDV] Échec envoi email confirmation', { error: mailErr.message });
    }

    res.status(201).json({ success: true, appointment: appt, email_envoye: emailEnvoye });
  } catch (err) { next(err); }
};

// AUDIT-P2-1 (groupe 2) — patient/created_by identifient le RDV et son
// auteur ; les reporter/réassigner via cette mise à jour générique n'a
// aucun cas d'usage légitime (contrairement à medecin/statut, qui changent
// réellement via "reporter"/confirmer/annuler dans Appointments.jsx).
const APPT_BLOCKED_FIELDS = ['patient', 'created_by'];

exports.update = async (req, res, next) => {
  try {
    const avant = await Appointment.findById(req.params.id).lean();
    if (!avant) return res.status(404).json({ success: false, message: 'Rendez-vous introuvable.' });
    const data = {};
    for (const [k, v] of Object.entries(req.body)) { if (!APPT_BLOCKED_FIELDS.includes(k)) data[k] = v; }

    // AUDIT-P7-6 — create() vérifiait un conflit de créneau, update() non :
    // reporter un RDV (date_heure) ou le réassigner à un autre médecin
    // pouvait silencieusement produire un double-booking. Re-vérifié
    // uniquement quand le créneau réel change (medecin/date_heure/durée),
    // pas sur les autres modifications (statut, notes...) — et seulement
    // si un médecin est déterminé, sinon 'medecin: undefined' matcherait
    // n'importe quel autre rendez-vous sans médecin assigné.
    const medecinCible  = data.medecin !== undefined ? data.medecin : avant.medecin;
    const dateCible      = data.date_heure !== undefined ? data.date_heure : avant.date_heure;
    const dureeCible     = data.duree_minutes !== undefined ? data.duree_minutes : avant.duree_minutes;
    const creneauChange  = data.medecin !== undefined || data.date_heure !== undefined || data.duree_minutes !== undefined;
    if (creneauChange && medecinCible) {
      const conflict = await checkAppointmentConflict({ medecin: medecinCible, date_heure: dateCible, duree_minutes: dureeCible, excludeId: avant._id });
      if (conflict) {
        await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'appointments', entite_id: avant._id, ip: req.ip, statut: 'echec', message: `Modification refusée — conflit de créneau (médecin ${medecinCible})` });
        return res.status(400).json({ success: false, message: 'Conflit: le médecin a déjà un rendez-vous à cette heure.' });
      }
    }

    // AUDIT-2.1 — même filet de sécurité que create() : la vérification
    // ci-dessus n'est pas atomique avec l'écriture, l'index unique partiel
    // ferme la course sur le créneau exact.
    let appt;
    try {
      appt = await Appointment.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    } catch (err) {
      if (err.code === 11000) {
        await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'appointments', entite_id: avant._id, ip: req.ip, statut: 'echec', message: `Modification refusée — conflit de créneau détecté à l'écriture (médecin ${medecinCible})` });
        return res.status(409).json({ success: false, message: 'Conflit: ce créneau vient d\'être réservé par une autre requête. Veuillez réessayer.' });
      }
      throw err;
    }
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'appointments', entite_id: appt._id, ip: req.ip, avant, apres: appt });

    // Rendez-vous reporté (date/heure modifiée) ou nouvellement confirmé :
    // notification email au patient + synchronisation temps réel de tous
    // les clients connectés (dashboard.jsx, calendrier, etc. — déjà
    // câblés sur dashboard:refresh via useRealtimeRefresh, aucun nouveau
    // canal nécessaire).
    const estReporte  = avant.date_heure.getTime() !== new Date(appt.date_heure).getTime();
    const estConfirme = !estReporte && avant.statut !== 'confirme' && appt.statut === 'confirme';
    let notificationEnvoyee = null;

    if (estReporte || estConfirme) {
      emitActivity({
        module: 'appointments',
        action: estReporte ? 'Rendez-vous reporté' : 'Rendez-vous confirmé',
        detail: appt.type,
        icon: estReporte ? '🔄' : '✅',
        userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}`,
      });
      emitDashboardUpdate();

      try {
        const { patient, medecinNom, serviceNom } = await resolveApptContacts(appt);
        if (patient?.email) {
          // Décidé ici, avant la tentative d'envoi : reflète la logique
          // métier (fallait-il notifier ?), pas la remise SMTP effective
          // (non bloquante, hors du contrôle de l'app — cf. sendEmail).
          notificationEnvoyee = estReporte ? 'reporte' : 'confirme';
          const payload = {
            email: patient.email, prenom: patient.prenom, nom: patient.nom,
            date_heure: appt.date_heure, medecin: medecinNom, type: appt.type,
            service: serviceNom, motif: appt.motif, duree_minutes: appt.duree_minutes,
          };
          if (estReporte) await sendAppointmentRescheduledEmail(payload);
          else             await sendAppointmentConfirmedEmail(payload);
        }
      } catch (mailErr) {
        logger.error('[MAIL RDV update] Échec envoi email de mise à jour', { error: mailErr.message });
      }
    }

    res.json({ success: true, appointment: appt, notification_envoyee: notificationEnvoyee });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const appt = await Appointment.findByIdAndDelete(req.params.id);
    if (!appt) return res.status(404).json({ success: false, message: 'Rendez-vous introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'DELETE', module: 'appointments', entite_id: req.params.id, ip: req.ip, avant: appt });
    res.json({ success: true, message: 'Rendez-vous supprimé.' });
  } catch (err) { next(err); }
};
