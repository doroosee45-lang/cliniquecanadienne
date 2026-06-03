const mongoose = require('mongoose');
const { Schema } = mongoose;

const NoteSchema = new Schema({
  date: { type: Date, default: Date.now },
  auteur: { type: Schema.Types.ObjectId, ref: 'User' },
  tension: String,
  pouls: Number,
  temperature: Number,
  spo2: Number,
  contenu: String,
}, { _id: false });

const HospitalizationSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  chambre: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
  lit_numero: { type: String, required: true },
  service: { type: Schema.Types.ObjectId, ref: 'Service' },
  medecin_responsable: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date_entree: { type: Date, default: Date.now },
  date_sortie_prevue: Date,
  date_sortie: Date,
  motif_entree: { type: String, required: true },
  diagnostic_entree: String,
  diagnostic_sortie: String,
  notes_cliniques: [NoteSchema],
  statut: { type: String, enum: ['en_cours','sorti','transfere','decede'], default: 'en_cours' },
  cout_total: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Hospitalization', HospitalizationSchema);
