const mongoose = require('mongoose');

const PediatricConsultationSchema = new mongoose.Schema({
  numero:      String,
  child_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Child', required: true },
  patient_nom: String,

  date:   { type: Date, default: Date.now },
  motif:  { type: String, required: true },
  type:   {
    type: String,
    enum: ['consultation', 'vaccination', 'urgence', 'chronique', 'controle', 'nutrition'],
    default: 'consultation',
  },

  // Signes vitaux
  temperature: Number,
  fc:          Number,  // fréquence cardiaque bpm
  fr:          Number,  // fréquence respiratoire /min
  spo2:        Number,  // %
  tension_sys: Number,
  tension_dia: Number,
  poids:       Number,  // kg au moment de la consultation

  etat_general: { type: String, enum: ['bon', 'altere', 'critique'], default: 'bon' },

  diagnostic: { type: String, required: true },
  gravite: {
    type: String,
    enum: ['normal', 'modere', 'grave', 'critique', 'chronique'],
    default: 'normal',
  },

  medicaments: String,
  posologie:   String,
  conseils:    String,
  examens_complementaires: String,

  medecin:     String,
  notes:       String,
  created_by:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

PediatricConsultationSchema.pre('save', async function (next) {
  if (!this.numero) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('PediatricConsultation').countDocuments({ numero: new RegExp(`^CPED-${year}-`) });
    this.numero = `CPED-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('PediatricConsultation', PediatricConsultationSchema);
