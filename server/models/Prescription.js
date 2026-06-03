const mongoose = require('mongoose');
const { Schema } = mongoose;

const PrescriptionSchema = new Schema({
  numero_rx: { type: String, unique: true },
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  medecin: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  consultation: { type: Schema.Types.ObjectId, ref: 'Consultation' },
  date_prescription: { type: Date, default: Date.now },
  date_expiration: Date,
  lignes: [{
    medicament: { type: Schema.Types.ObjectId, ref: 'Medication' },
    medicament_nom: String,
    posologie: String,
    duree: String,
    quantite: Number,
    notes: String,
  }],
  statut: { type: String, enum: ['active','dispensee','expiree','annulee'], default: 'active' },
  dispensee_par: { type: Schema.Types.ObjectId, ref: 'User' },
  date_dispensation: Date,
  interactions_detectees: [{ medicaments: [String], risque: String, description: String }],
}, { timestamps: true });

PrescriptionSchema.pre('save', async function(next) {
  if (this.isNew) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Prescription').countDocuments();
    this.numero_rx = `RX-${year}-${String(count + 1).padStart(5, '0')}`;
    this.date_expiration = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  next();
});

module.exports = mongoose.model('Prescription', PrescriptionSchema);
