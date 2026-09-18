const mongoose = require('mongoose');

const ExamCatalogueSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  // AUDIT-20-2 (18 sept. 2026) — même défaut que Insurance.code (AUDIT-19-1) :
  // unique sans sparse sur un champ optionnel (aucun controller ne crée
  // d'ExamCatalogue — 100% des 15 documents réels viennent de utils/seed.js,
  // qui fournit toujours un code). Dormant aujourd'hui, mais un futur
  // endpoint de création (aucun n'existe actuellement) créant une 2e entrée
  // sans code échouerait immédiatement sur E11000 dup key { code: null },
  // exactement comme Insurance avant correction. Corrigé par précaution.
  code: { type: String, unique: true, sparse: true },
  type: { type: String, enum: ['laboratoire','imagerie'], required: true },
  description: String,
  prix: { type: Number, default: 0 },
  delai_rendu_h: { type: Number, default: 24 },
  parametres_normaux: mongoose.Schema.Types.Mixed,
  statut: { type: String, enum: ['actif','inactif'], default: 'actif' },
}, { timestamps: true });

module.exports = mongoose.model('ExamCatalogue', ExamCatalogueSchema);
