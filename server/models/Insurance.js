const mongoose = require('mongoose');

const InsuranceSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  code: { type: String, unique: true },
  type: { type: String, enum: ['publique','privee','mutuelle','autre'] },
  taux_prise_en_charge: { type: Number, default: 80, min: 0, max: 100 },
  plafond_mensuel: Number,
  contact: {
    nom: String,
    telephone: String,
    email: String,
    adresse: String,
  },
  statut: { type: String, enum: ['actif','inactif'], default: 'actif' },
}, { timestamps: true });

module.exports = mongoose.model('Insurance', InsuranceSchema);
