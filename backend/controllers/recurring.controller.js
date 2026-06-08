const RecurringProtocol = require('../models/RecurringProtocol');
const Appointment        = require('../models/Appointment');
const { logAction }      = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');

// ── GET ALL ──────────────────────────────────────────────────────────────────
exports.getAll = async (req, res, next) => {
  try {
    const filter = { actif: true };
    // Médecin ne voit que ses propres protocoles, admin voit tout
    if (!['superadmin','adminclinique'].includes(req.user.role)) {
      filter.medecin = req.user._id;
    }
    const protocols = await RecurringProtocol.find(filter)
      .populate('medecin', 'nom prenom specialite')
      .sort('prochaine_date');
    res.json({ success: true, protocols });
  } catch (err) { next(err); }
};

// ── CREATE ───────────────────────────────────────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const protocol = await RecurringProtocol.create({
      ...req.body,
      created_by: req.user._id,
    });
    await protocol.populate('medecin', 'nom prenom specialite');
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'recurring', entite_id: protocol._id, ip: req.ip, message: `Protocole récurrent: ${protocol.titre}` });
    emitActivity({ module: 'appointments', action: 'Nouveau protocole récurrent', detail: protocol.titre, icon: '🔄', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    res.status(201).json({ success: true, protocol });
  } catch (err) { next(err); }
};

// ── UPDATE ───────────────────────────────────────────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const protocol = await RecurringProtocol.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('medecin', 'nom prenom specialite');
    if (!protocol) return res.status(404).json({ success: false, message: 'Protocole introuvable.' });
    res.json({ success: true, protocol });
  } catch (err) { next(err); }
};

// ── DELETE (soft) ────────────────────────────────────────────────────────────
exports.remove = async (req, res, next) => {
  try {
    await RecurringProtocol.findByIdAndUpdate(req.params.id, { actif: false });
    res.json({ success: true, message: 'Protocole archivé.' });
  } catch (err) { next(err); }
};

// ── PLANIFIER (crée le prochain RDV + met à jour prochaine_date) ─────────────
exports.planifier = async (req, res, next) => {
  try {
    const protocol = await RecurringProtocol.findById(req.params.id);
    if (!protocol) return res.status(404).json({ success: false, message: 'Protocole introuvable.' });

    const { patient, date_heure, notes } = req.body;
    if (!patient || !date_heure)
      return res.status(400).json({ success: false, message: 'patient et date_heure sont requis.' });

    // Crée le rendez-vous
    const appt = await Appointment.create({
      patient,
      medecin:       protocol.medecin,
      date_heure:    new Date(date_heure),
      duree_minutes: 30,
      motif:         protocol.titre,
      type:          'suivi',
      statut:        'planifie',
      notes:         notes || protocol.notes,
      created_by:    req.user._id,
    });

    // Calcule la prochaine occurrence
    const DELTAS = {
      quotidien:    1, hebdomadaire: 7, bimensuel: 14,
      mensuel:      30, trimestriel: 90, annuel:    365,
    };
    const delta = protocol.frequence_jours || DELTAS[protocol.frequence] || 30;
    const newDate = new Date(date_heure);
    newDate.setDate(newDate.getDate() + delta);
    await RecurringProtocol.findByIdAndUpdate(req.params.id, { prochaine_date: newDate });

    await logAction({ utilisateur: req.user._id, action: 'PLANIFIER', module: 'recurring', entite_id: protocol._id, ip: req.ip, message: `RDV planifié pour ${protocol.titre}` });
    emitActivity({ module: 'appointments', action: 'RDV récurrent planifié', detail: protocol.titre, icon: '📅', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();

    res.status(201).json({ success: true, appointment: appt, next_date: newDate });
  } catch (err) { next(err); }
};
