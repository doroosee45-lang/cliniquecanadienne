const mongoose = require('mongoose');
const { Schema } = mongoose;

const AssuranceSchema = new Schema({
  compagnie: String,
  numero_police: String,
  taux: { type: Number, default: 0 },
}, { _id: false });

const PatientSchema = new Schema({
  numero_dossier: { type: String, unique: true },
  nom: { type: String, required: true, trim: true },
  prenom: { type: String, required: true, trim: true },
  date_naissance: { type: Date, required: true },
  sexe: { type: String, enum: ['M', 'F'], required: true },
  telephone: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  photo: { type: String },
  adresse: {
    rue: String,
    ville: String,
    pays: { type: String, default: 'Congo' },
    code_postal: String,
  },
  groupe_sanguin: { type: String, enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-','?'] },
  allergies: [String],
  antecedents_medicaux: [String],
  antecedents_familiaux: [String],
  medecin_referent: { type: Schema.Types.ObjectId, ref: 'User' },
  // Max 2 assurances
  assurances: {
    type: [AssuranceSchema],
    validate: {
      validator: (v) => v.length <= 2,
      message: 'Maximum 2 assurances autorisées.',
    },
    default: [],
  },
  contact_urgence: {
    nom: String,
    relation: String,
    telephone: String,
  },
  statut: { type: String, enum: ['actif', 'inactif', 'decede'], default: 'actif' },
  // Compte patient : false = en attente d'activation via lien email
  actif: { type: Boolean, default: false },
  token_activation: String,
  token_activation_expire: Date,
  cree_par: { type: Schema.Types.ObjectId, ref: 'User' },
  ip_creation: String,
  notes: String,
}, { timestamps: true });

PatientSchema.pre('save', async function (next) {
  if (this.isNew) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Patient').countDocuments();
    this.numero_dossier = `CLIN-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

PatientSchema.index({ nom: 'text', prenom: 'text', numero_dossier: 'text', telephone: 'text' });

module.exports = mongoose.model('Patient', PatientSchema);
