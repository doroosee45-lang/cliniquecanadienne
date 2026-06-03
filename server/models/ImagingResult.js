const mongoose = require('mongoose');
const { Schema } = mongoose;

const ImagingResultSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  medecin_prescripteur: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  radiologue: { type: Schema.Types.ObjectId, ref: 'User' },
  examen: { type: Schema.Types.ObjectId, ref: 'ExamCatalogue' },
  type_examen: { type: String, enum: ['radiographie','echographie','scanner','irm','echo_coeur','autre'] },
  region_anatomique: String,
  priorite: { type: String, enum: ['normale','urgente','stat'], default: 'normale' },
  date_prescription: { type: Date, default: Date.now },
  date_realisation: Date,
  date_rapport: Date,
  compte_rendu: String,
  conclusion: String,
  anomalie_detectee: { type: Boolean, default: false },
  ia_anomalie: { type: Boolean, default: false },
  ia_confidence: Number,
  ia_details: String,
  images: [{
    filename: String,
    path: String,
    type_mime: String,
    taille: Number,
  }],
  statut: { type: String, enum: ['prescrit','realise','rapporte','valide','annule'], default: 'prescrit' },
}, { timestamps: true });

module.exports = mongoose.model('ImagingResult', ImagingResultSchema);
