const Appointment = require('../models/Appointment');
const { logAction, paginate } = require('../utils/helpers');

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, statut, medecin, patient, date } = req.query;
    const filter = {};
    if (statut) filter.statut = statut;
    if (medecin) filter.medecin = medecin;
    if (patient) filter.patient = patient;
    if (date) {
      const d = new Date(date);
      filter.date_heure = { $gte: new Date(d.setHours(0,0,0,0)), $lt: new Date(d.setHours(23,59,59,999)) };
    }
    const total = await Appointment.countDocuments(filter);
    const appointments = await paginate(
      Appointment.find(filter)
        .populate('patient', 'nom prenom numero_dossier')
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
    res.status(201).json({ success: true, appointment: appt });
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
