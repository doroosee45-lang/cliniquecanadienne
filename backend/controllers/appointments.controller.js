const Appointment = require('../models/Appointment');
const Patient     = require('../models/Patient');
const User        = require('../models/User');
const { logAction, paginate } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');
const { sendAppointmentEmail } = require('../utils/mail');

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
    const start = new Date(date_heure);
    const end = new Date(start.getTime() + duree_minutes * 60000);
    const conflict = await Appointment.findOne({
      medecin,
      statut: { $nin: ['annule','absent'] },
      date_heure: { $lt: end },
      $expr: { $gt: [{ $add: ['$date_heure', { $multiply: ['$duree_minutes', 60000] }] }, start] },
    });
    if (conflict) return res.status(400).json({ success: false, message: 'Conflit: le médecin a déjà un rendez-vous à cette heure.' });

    const appt = await Appointment.create({ ...req.body, created_by: req.user._id });
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'appointments', entite_id: appt._id, ip: req.ip, message: `Nouveau RDV: ${appt.type}` });
    emitActivity({ module: 'appointments', action: 'Nouveau rendez-vous', detail: appt.type, icon: '📅', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();

    // Envoi email de confirmation au patient (non bloquant)
    let emailEnvoye = false;
    try {
      const [patient, medecinDoc] = await Promise.all([
        Patient.findById(appt.patient).select('nom prenom email').lean(),
        User.findById(appt.medecin).select('nom prenom specialite').lean(),
      ]);
      if (patient?.email) {
        const medecinNom = medecinDoc
          ? `Dr ${medecinDoc.prenom} ${medecinDoc.nom}${medecinDoc.specialite ? ` (${medecinDoc.specialite})` : ''}`
          : '—';
        await sendAppointmentEmail({
          email:         patient.email,
          prenom:        patient.prenom,
          nom:           patient.nom,
          date_heure:    appt.date_heure,
          medecin:       medecinNom,
          type:          appt.type,
          motif:         appt.motif,
          duree_minutes: appt.duree_minutes,
        });
        emailEnvoye = true;
      }
    } catch (mailErr) {
      console.error('[MAIL RDV]', mailErr.message);
    }

    res.status(201).json({ success: true, appointment: appt, email_envoye: emailEnvoye });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!appt) return res.status(404).json({ success: false, message: 'Rendez-vous introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'appointments', entite_id: appt._id, ip: req.ip });
    res.json({ success: true, appointment: appt });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const appt = await Appointment.findByIdAndDelete(req.params.id);
    if (!appt) return res.status(404).json({ success: false, message: 'Rendez-vous introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'DELETE', module: 'appointments', entite_id: req.params.id, ip: req.ip });
    res.json({ success: true, message: 'Rendez-vous supprimé.' });
  } catch (err) { next(err); }
};
