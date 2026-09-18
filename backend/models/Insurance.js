const mongoose = require('mongoose');

const InsuranceSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  // AUDIT-19-1 (18 sept. 2026) — unique sans sparse sur un champ optionnel :
  // MongoDB traite toutes les valeurs absentes comme le même `null`, donc
  // la 2e assurance créée sans code (reproduit : E11000 dup key { code:
  // null }) faisait échouer sa création. sparse exclut les documents sans
  // `code` de l'index unique — l'unicité reste garantie entre les codes
  // réellement renseignés.
  code: { type: String, unique: true, sparse: true },
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
