const mongoose = require('mongoose');
const { Schema } = mongoose;

const AppointmentSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  medecin: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  service: { type: Schema.Types.ObjectId, ref: 'Service' },
  date_heure: { type: Date, required: true },
  duree_minutes: { type: Number, default: 30 },
  type: { type: String, enum: ['consultation','suivi','urgence','bilan','examen'], default: 'consultation' },
  motif: { type: String, required: true },
  statut: {
    type: String,
    enum: ['planifie','en_attente','confirme','arrive','en_consultation','en_cours','termine','reporte','annule','absent'],
    default: 'planifie',
  },
  notes: String,
  rappels_envoyes: { type: Number, default: 0 },
  created_by: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

AppointmentSchema.index({ date_heure: 1, medecin: 1 });
AppointmentSchema.index({ patient: 1 });

module.exports = mongoose.model('Appointment', AppointmentSchema);
