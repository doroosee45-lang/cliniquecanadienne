const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  url:         { type: String },
  description: { type: String },
  date:        { type: Date, default: Date.now },
  // POST5-004 (audit indépendant post-Phase 5, 14 sept. 2026) — même
  // traitement que Patient.photo_public_id/resource_type/format/version :
  // permet de régénérer une URL Cloudinary signée à courte durée de vie à
  // chaque lecture autorisée, au lieu de resservir indéfiniment l'URL
  // signée sans expiration stockée dans `url`.
  cloudinary_public_id:     { type: String, default: null },
  cloudinary_resource_type: { type: String, default: null },
  cloudinary_format:        { type: String, default: null },
  cloudinary_version:       { type: Number, default: null },
}, { _id: true });

const EchographieSchema = new mongoose.Schema({
  numero:           { type: String, unique: true, sparse: true },

  // Correction 13 (relecture du 6 sept. 2026, DATA-001) — `patient` était une
  // String libre (aucun populate() possible), et la vraie référence
  // (patient_ref) était optionnelle : deux champs pour une seule notion,
  // seul patient_ref réellement exploité ailleurs (saveRapport() lie déjà
  // l'Invoice à demande.patient_ref, jamais à la String). Fusionnés en un
  // seul champ de référence réelle, migration utils/migrate-echographie-
  // patient-ref.js — le libellé texte (autrefois `patient`) est conservé
  // sous `patient_nom`, jamais perdu.
  patient:          { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  patient_nom:      { type: String },
  dossier:          { type: String },
  age:              { type: Number },
  sexe:             { type: String, enum: ['F', 'M', ''] },

  source:           { type: String },
  medecin_presc:    { type: String },
  date_prescription:{ type: Date },

  type:             { type: String },
  sous_type:        { type: String },
  motif:            { type: String },
  // Correction 2 (module 3/6, relecture du 6 sept. 2026) — même pattern
  // que ImagingResult.examen (radiology) : référence réelle et optionnelle
  // vers ExamCatalogue, jamais fabriquée si absente. Permet de facturer
  // réellement au moment de la validation du rapport (saveRapport) au lieu
  // du calcul agrégé côté client fondé sur des tarifs codés en dur.
  examen:           { type: mongoose.Schema.Types.ObjectId, ref: 'ExamCatalogue' },
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
    const { nextSequence } = require('../utils/counter');
    const year = new Date().getFullYear();
    const seq = await nextSequence(`echographie-${year}`);
    this.numero = `ECH-${year}-${String(seq).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Echographie', EchographieSchema);
