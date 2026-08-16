const Ambulance = require('../models/Ambulance');
const { logAction } = require('../utils/helpers');

// GET /ambulances
exports.getAmbulances = async (req, res) => {
  try {
    const ambulances = await Ambulance.find().sort({ numero: 1 });
    res.json({ ambulances });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /ambulances/missions
exports.assignMission = async (req, res) => {
  try {
    const { numero, conducteur, destination, motif_mission } = req.body;
    const heure_depart = new Date().toTimeString().substring(0, 5);
    let amb = await Ambulance.findOne({ numero });
    // avant seulement si l'ambulance existait déjà — une nouvelle fiche
    // (branche else) n'a pas d'état antérieur à journaliser.
    const avant = amb ? amb.toObject() : undefined;
    if (!amb) {
      amb = new Ambulance({ numero, conducteur, statut: 'en_route', destination, heure_depart });
    } else {
      amb.statut = 'en_route';
      amb.conducteur = conducteur || amb.conducteur;
      amb.destination = destination;
      amb.heure_depart = heure_depart;
    }
    amb.missions.push({ destination, motif_mission, heure_depart });
    await amb.save();
    await logAction({ utilisateur: req.user?._id, action: 'CREATE', module: 'ambulances', entite_id: amb._id, ip: req.ip, message: `Mission assignée — ambulance ${numero} vers ${destination}`, avant, apres: amb });
    res.status(201).json({ ambulance: amb, message: `Mission ambulance ${numero} assignée` });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// PUT /ambulances/:numero/retour
exports.retourAmbulance = async (req, res) => {
  try {
    const amb = await Ambulance.findOne({ numero: req.params.numero });
    if (!amb) return res.status(404).json({ message: 'Ambulance introuvable' });
    const avant = amb.toObject();
    amb.statut = 'disponible';
    amb.destination = '';
    const dernier = amb.missions[amb.missions.length - 1];
    if (dernier) dernier.heure_retour = new Date().toTimeString().substring(0, 5);
    await amb.save();
    await logAction({ utilisateur: req.user?._id, action: 'UPDATE', module: 'ambulances', entite_id: amb._id, ip: req.ip, message: `Retour ambulance ${amb.numero} — disponible`, avant, apres: amb });
    res.json({ ambulance: amb });
  } catch (err) { res.status(400).json({ message: err.message }); }
};
