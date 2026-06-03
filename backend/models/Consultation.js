const mongoose = require('mongoose');
const { Schema } = mongoose;

const ConsultationSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  medecin: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  appointment: { type: Schema.Types.ObjectId, ref: 'Appointment' },
  date_consultation: { type: Date, default: Date.now },
  signes_vitaux: {
    tension_systolique: Number,
    tension_diastolique: Number,
    pouls: Number,
    temperature: Number,
    spo2: Number,
    glycemie: Number,
    poids: Number,
    taille: Number,
  },
  anamnese: String,
  examen_clinique: String,
  diagnostic: String,
  diagnostic_code: String,
  recommandations: String,
  prescriptions: [{
    medicament_nom: String,
    posologie: String,
    duree: String,
    quantite: Number,
    notes: String,
  }],
  statut: { type: String, enum: ['en_cours','terminee','suspendue'], default: 'en_cours' },
  ia_suggestions: [{ diagnostic: String, confidence: Number }],
}, { timestamps: true });

module.exports = mongoose.model('Consultation', ConsultationSchema);
