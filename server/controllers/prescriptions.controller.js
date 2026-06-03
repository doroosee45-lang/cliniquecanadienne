const Prescription = require('../models/Prescription');
const { logAction, paginate } = require('../utils/helpers');

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, patient, statut, medecin } = req.query;
    const filter = {};
    if (patient) filter.patient = patient;
    if (statut)  filter.statut  = statut;
    if (medecin) filter.medecin = medecin;

    const total = await Prescription.countDocuments(filter);
    const prescriptions = await paginate(
      Prescription.find(filter)
        .populate('patient',  'nom prenom numero_dossier telephone')
        .populate('medecin',  'nom prenom specialite')
        .populate('lignes.medicament', 'nom_commercial dci')
        .sort('-date_prescription'),
      page, limit
    );
    res.json({ success: true, total, prescriptions });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('patient')
      .populate('medecin', 'nom prenom specialite')
      .populate('lignes.medicament');
    if (!prescription) return res.status(404).json({ success: false, message: 'Ordonnance introuvable.' });
    res.json({ success: true, prescription });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    // Détection interactions médicamenteuses (règle simple)
    const meds = (req.body.lignes || []).map(l => (l.medicament_nom || '').toLowerCase());
    const interactions = [];
    if (meds.includes('warfarine') && meds.includes('aspirine'))
      interactions.push({ medicaments: ['Warfarine', 'Aspirine'], risque: 'Élevé', description: 'Risque hémorragique majeur — surveillance INR obligatoire' });
    if (meds.includes('metformine') && meds.includes('alcool'))
      interactions.push({ medicaments: ['Metformine', 'Alcool'], risque: 'Modéré', description: 'Risque d\'acidose lactique accru' });

    const prescription = await Prescription.create({
      ...req.body,
      medecin: req.user._id,
      interactions_detectees: interactions,
    });
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'prescriptions', entite_id: prescription._id, ip: req.ip, message: `Ordonnance ${prescription.numero_rx}` });
    res.status(201).json({ success: true, prescription });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const prescription = await Prescription.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!prescription) return res.status(404).json({ success: false, message: 'Ordonnance introuvable.' });
    res.json({ success: true, prescription });
  } catch (err) { next(err); }
};

exports.cancel = async (req, res, next) => {
  try {
    const prescription = await Prescription.findByIdAndUpdate(
      req.params.id,
      { statut: 'annulee' },
      { new: true }
    );
    if (!prescription) return res.status(404).json({ success: false, message: 'Ordonnance introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'CANCEL', module: 'prescriptions', entite_id: prescription._id, ip: req.ip });
    res.json({ success: true, prescription });
  } catch (err) { next(err); }
};
