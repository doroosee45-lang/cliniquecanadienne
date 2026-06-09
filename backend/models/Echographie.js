const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  url:         { type: String },
  description: { type: String },
  date:        { type: Date, default: Date.now },
}, { _id: true });

const EchographieSchema = new mongoose.Schema({
  numero:           { type: String, unique: true, sparse: true },

  patient:          { type: String, required: true },
  patient_ref:      { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  dossier:          { type: String },
  age:              { type: Number },
  sexe:             { type: String, enum: ['F', 'M', ''] },

  source:           { type: String },
  medecin_presc:    { type: String },
  date_prescription:{ type: Date },

  type:             { type: String },
  sous_type:        { type: String },
  motif:            { type: String },
  priorite: {
    type: String,
    enum: ['normale', 'semi_urgent', 'urgente'],
    default: 'normale',
  },
  statut: {
    type: String,
    enum: ['en_attente', 'planifiee', 'realisee', 'validee', 'annulee'],
    default: 'en_attente',
  },

  date_planif:        { type: Date },
  echographiste:      { type: String },
  salle:              { type: String },

  rapport_statut: {
    type: String,
    enum: ['brouillon', 'en_validation', 'valide', 'rejete'],
  },
  rapport_radiologue: { type: String },
  rapport_texte:      { type: String },
  conclusion:         { type: String },
  recommandations:    { type: String },

  images: [ImageSchema],
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// Auto-numérotation ECH-YYYY-XXXX
EchographieSchema.pre('save', async function (next) {
  if (this.isNew && !this.numero) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Echographie').countDocuments({
      createdAt: { $gte: new Date(`${year}-01-01`), $lt: new Date(`${year + 1}-01-01`) },
    });
    this.numero = `ECH-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Echographie', EchographieSchema);
