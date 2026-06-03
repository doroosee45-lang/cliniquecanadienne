const mongoose = require('mongoose');
const { Schema } = mongoose;

const AIPredictionSchema = new Schema({
  type: { type: String, enum: ['diagnostic','anomalie_labo','anomalie_imagerie','risque_finance','interaction_medicament','absenteisme','conflit_rdv'] },
  patient: { type: Schema.Types.ObjectId, ref: 'Patient' },
  entite_id: String,
  resultat: mongoose.Schema.Types.Mixed,
  score_confiance: { type: Number, min: 0, max: 100 },
  statut: { type: String, enum: ['en_attente','traite','ignore'], default: 'en_attente' },
  traite_par: { type: Schema.Types.ObjectId, ref: 'User' },
  traite_at: Date,
  commentaire: String,
}, { timestamps: true });

module.exports = mongoose.model('AIPrediction', AIPredictionSchema);
