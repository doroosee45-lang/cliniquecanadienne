// backend/models/SuiviPostop.js
const mongoose = require('mongoose');

const suiviPostopSchema = new mongoose.Schema({
  dossier_chirurgical_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DossierChirurgical', required: true },
  date_suivi: { type: Date, default: Date.now },
  temperature: Number,
  tension_sys: Number,
  tension_dia: Number,
  pouls: Number,
  douleur_score: { type: Number, min: 0, max: 10 },
  etat_plaie: { type: String, enum: ['bonne_evolution', 'bonne', 'suintement', 'infection', 'necrose'], default: 'bonne_evolution' },
  pansement_fait: { type: Boolean, default: false },
  antibiotherapie: String,
  medicaments: String,
  observations: String
}, { timestamps: true });

module.exports = mongoose.model('SuiviPostop', suiviPostopSchema);