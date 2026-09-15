// backend/models/MaterielMedical.js
// Correction Sous-phase "Bloc Opératoire" (audit du 15 sept. 2026) —
// catalogue dédié aux consommables de bloc opératoire (gants, compresses,
// fils, seringues...), distinct de Medication.js (pharmacie/médicaments).
// Même structure de mouvements de stock que Medication.js, sans prix
// (aucun catalogue tarifaire réel n'existe pour le bloc opératoire — voir
// blocoperatoireController.js::getFacture, LIMITE DOCUMENTÉE existante :
// ne pas en inventer un ici serait incohérent avec cette décision déjà prise).
const mongoose = require('mongoose');

const MaterielMedicalSchema = new mongoose.Schema({
  designation:    { type: String, required: true, trim: true },
  categorie:      { type: String, enum: ['gants', 'seringues', 'compresses', 'fils_chirurgicaux', 'blouses', 'autre'], default: 'autre' },
  unite:          { type: String, default: 'unités' },
  stock_actuel:   { type: Number, default: 0, min: 0 },
  stock_minimum:  { type: Number, default: 10 },
  seuil_alerte:   { type: Number, default: 20 },
  statut:         { type: String, enum: ['disponible', 'rupture', 'suspendu'], default: 'disponible' },
}, { timestamps: true });

MaterielMedicalSchema.index({ designation: 'text' });

module.exports = mongoose.model('MaterielMedical', MaterielMedicalSchema);
