const mongoose = require('mongoose');

const ExamCatalogueSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  code: { type: String, unique: true },
  type: { type: String, enum: ['laboratoire','imagerie'], required: true },
  description: String,
  prix: { type: Number, default: 0 },
  delai_rendu_h: { type: Number, default: 24 },
  parametres_normaux: mongoose.Schema.Types.Mixed,
  statut: { type: String, enum: ['actif','inactif'], default: 'actif' },
}, { timestamps: true });

module.exports = mongoose.model('ExamCatalogue', ExamCatalogueSchema);
