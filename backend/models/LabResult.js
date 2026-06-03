const mongoose = require('mongoose');
const { Schema } = mongoose;

const LabResultSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  medecin_prescripteur: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  technicien: { type: Schema.Types.ObjectId, ref: 'User' },
  validateur: { type: Schema.Types.ObjectId, ref: 'User' },
  examen: { type: Schema.Types.ObjectId, ref: 'ExamCatalogue', required: true },
  priorite: { type: String, enum: ['normale','urgente','stat'], default: 'normale' },
  date_prescription: { type: Date, default: Date.now },
  date_realisation: Date,
  date_validation: Date,
  resultats: mongoose.Schema.Types.Mixed,
  est_critique: { type: Boolean, default: false },
  valeurs_critiques: String,
  acquitte_par: { type: Schema.Types.ObjectId, ref: 'User' },
  acquitte_at: Date,
  statut: { type: String, enum: ['prescrit','en_cours','valide','annule'], default: 'prescrit' },
  commentaires: String,
  ia_anomalie: { type: Boolean, default: false },
  ia_details: String,
}, { timestamps: true });

LabResultSchema.index({ patient: 1, date_prescription: -1 });
LabResultSchema.index({ est_critique: 1, acquitte_par: 1 });

module.exports = mongoose.model('LabResult', LabResultSchema);
