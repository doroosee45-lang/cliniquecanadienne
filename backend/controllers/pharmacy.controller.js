const Medication = require('../models/Medication');
const Prescription = require('../models/Prescription');
const { logAction, paginate } = require('../utils/helpers');

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, q, statut, alerte } = req.query;
    const filter = {};
    if (statut) filter.statut = statut;
    if (q) filter.$or = [
      { nom_commercial: { $regex: q, $options: 'i' } },
      { dci: { $regex: q, $options: 'i' } },
    ];
    if (alerte === 'stock') filter.$expr = { $lte: ['$stock_actuel', '$seuil_alerte'] };
    if (alerte === 'peremption') {
      const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      filter.date_peremption = { $lte: in30days };
    }
    const total = await Medication.countDocuments(filter);
    const medications = await paginate(Medication.find(filter).sort('nom_commercial'), page, limit);
    res.json({ success: true, total, medications });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const med = await Medication.findById(req.params.id);
    if (!med) return res.status(404).json({ success: false, message: 'Médicament introuvable.' });
    res.json({ success: true, medication: med });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const med = await Medication.create(req.body);
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'pharmacy', entite_id: med._id, ip: req.ip, message: `Nouveau médicament: ${med.nom_commercial}` });
    res.status(201).json({ success: true, medication: med });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const med = await Medication.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!med) return res.status(404).json({ success: false, message: 'Médicament introuvable.' });
    res.json({ success: true, medication: med });
  } catch (err) { next(err); }
};

exports.mouvement = async (req, res, next) => {
  try {
    const { type, quantite, reference, notes } = req.body;
    const med = await Medication.findById(req.params.id);
    if (!med) return res.status(404).json({ success: false, message: 'Médicament introuvable.' });

    if (['sortie','dispensation','perte','peremption'].includes(type) && med.stock_actuel < quantite)
      return res.status(400).json({ success: false, message: 'Stock insuffisant.' });

    const delta = ['entree','retour'].includes(type) ? quantite : -quantite;
    med.stock_actuel += delta;
    med.mouvements.push({ type, quantite, reference, notes, utilisateur: req.user._id });

    if (med.stock_actuel <= 0) med.statut = 'rupture';
    else if (med.statut === 'rupture') med.statut = 'disponible';

    await med.save();
    await logAction({ utilisateur: req.user._id, action: 'STOCK_MOUVEMENT', module: 'pharmacy', entite_id: med._id, ip: req.ip, message: `${type} x${quantite} — ${med.nom_commercial}` });
    res.json({ success: true, medication: med });
  } catch (err) { next(err); }
};

exports.getPrescriptions = async (req, res, next) => {
  try {
    const { statut = 'active' } = req.query;
    const prescriptions = await Prescription.find({ statut })
      .populate('patient', 'nom prenom numero_dossier')
      .populate('medecin', 'nom prenom')
      .sort('-date_prescription');
    res.json({ success: true, prescriptions });
  } catch (err) { next(err); }
};

exports.dispenser = async (req, res, next) => {
  try {
    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) return res.status(404).json({ success: false, message: 'Ordonnance introuvable.' });
    if (prescription.statut !== 'active')
      return res.status(400).json({ success: false, message: 'Ordonnance déjà dispensée ou expirée.' });

    prescription.statut = 'dispensee';
    prescription.dispensee_par = req.user._id;
    prescription.date_dispensation = new Date();

    // Detect drug interactions (simple rule-based)
    const meds = prescription.lignes.map(l => l.medicament_nom?.toLowerCase() || '');
    const interactions = [];
    if (meds.includes('warfarine') && meds.includes('aspirine'))
      interactions.push({ medicaments: ['Warfarine','Aspirine'], risque: 'Élevé', description: 'Risque hémorragique majeur' });
    prescription.interactions_detectees = interactions;

    await prescription.save();
    await logAction({ utilisateur: req.user._id, action: 'DISPENSE', module: 'pharmacy', entite_id: prescription._id, ip: req.ip });
    res.json({ success: true, prescription });
  } catch (err) { next(err); }
};
