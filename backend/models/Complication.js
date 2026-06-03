// backend/models/Complication.js
const mongoose = require('mongoose');

const complicationSchema = new mongoose.Schema({
  dossier_chirurgical_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DossierChirurgical', required: true },
  type_complication: { type: String, enum: ['infection', 'hemorragie', 'retard_cicatrisation', 'reintervention', 'thromboemboli', 'autre'], required: true },
  date_survenue: Date,
  description: String,
  traitement: String,
  grade_clavien: { type: Number, min: 1, max: 5 },
  resolu: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Complication', complicationSchema);