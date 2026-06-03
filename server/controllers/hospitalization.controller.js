const Hospitalization = require('../models/Hospitalization');
const Room = require('../models/Room');
const { logAction, paginate } = require('../utils/helpers');

exports.getRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find().populate('service', 'nom').populate('lits.patient_actuel', 'nom prenom');
    res.json({ success: true, rooms });
  } catch (err) { next(err); }
};

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, statut, patient } = req.query;
    const filter = {};
    if (statut) filter.statut = statut;
    if (patient) filter.patient = patient;
    const total = await Hospitalization.countDocuments(filter);
    const hospitalizations = await paginate(
      Hospitalization.find(filter)
        .populate('patient', 'nom prenom numero_dossier')
        .populate('medecin_responsable', 'nom prenom')
        .populate('chambre', 'numero type')
        .sort('-date_entree'),
      page, limit
    );
    res.json({ success: true, total, hospitalizations });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { chambre: roomId, lit_numero } = req.body;
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Chambre introuvable.' });
    const bed = room.lits.find(l => l.numero === lit_numero);
    if (!bed || bed.statut !== 'libre') return res.status(400).json({ success: false, message: 'Ce lit n\'est pas disponible.' });

    bed.statut = 'occupe';
    bed.patient_actuel = req.body.patient;
    await room.save();

    const hosp = await Hospitalization.create(req.body);
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'hospitalization', entite_id: hosp._id, ip: req.ip, message: `Admission lit ${lit_numero}` });
    res.status(201).json({ success: true, hospitalization: hosp });
  } catch (err) { next(err); }
};

exports.addNote = async (req, res, next) => {
  try {
    const hosp = await Hospitalization.findById(req.params.id);
    if (!hosp) return res.status(404).json({ success: false, message: 'Hospitalisation introuvable.' });
    hosp.notes_cliniques.push({ ...req.body, auteur: req.user._id });
    await hosp.save();
    res.json({ success: true, hospitalization: hosp });
  } catch (err) { next(err); }
};

exports.discharge = async (req, res, next) => {
  try {
    const hosp = await Hospitalization.findByIdAndUpdate(
      req.params.id,
      { ...req.body, statut: 'sorti', date_sortie: new Date() },
      { new: true }
    ).populate('chambre');
    if (!hosp) return res.status(404).json({ success: false, message: 'Hospitalisation introuvable.' });

    // Free the bed
    const room = await Room.findById(hosp.chambre._id);
    if (room) {
      const bed = room.lits.find(l => l.numero === hosp.lit_numero);
      if (bed) { bed.statut = 'libre'; bed.patient_actuel = undefined; }
      await room.save();
    }
    await logAction({ utilisateur: req.user._id, action: 'DISCHARGE', module: 'hospitalization', entite_id: hosp._id, ip: req.ip });
    res.json({ success: true, hospitalization: hosp });
  } catch (err) { next(err); }
};
