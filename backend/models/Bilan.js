// backend/models/Bilan.js
const mongoose = require('mongoose');

const bilanSchema = new mongoose.Schema({
  dossier_chirurgical_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DossierChirurgical', required: true },
  type: { type: String, enum: ['biologie', 'imagerie', 'anesthesie'], required: true },
  examen: { type: String, required: true },
  valeur: String,
  resultat: String,
  date_examen: Date,
  statut: { type: String, enum: ['prescrit', 'en_cours', 'recu', 'normal', 'anormal'], default: 'prescrit' },
  urgence: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Bilan', bilanSchema);