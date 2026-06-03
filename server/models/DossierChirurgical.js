// backend/models/DossierChirurgical.js
const mongoose = require('mongoose');

const dossierChirurgicalSchema = new mongoose.Schema({
  numero: { type: String, unique: true, required: true },
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  patient_nom: { type: String, required: true },
  date_naissance: { type: Date, required: true },
  sexe: { type: String, enum: ['homme', 'femme', 'autre'] },
  groupe_sanguin: String,
  allergies: String,
  antecedents_medicaux: String,
  antecedents_chirurgicaux: String,
  telephone: String,

  chirurgien_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  chirurgien_nom: String,

  statut: { type: String, enum: ['consultation', 'preoperatoire', 'opere', 'suivi_postop', 'cloture'], default: 'consultation' },
  niveau_urgence: { type: String, enum: ['electif', 'urgent', 'urgence_absolue'], default: 'electif' },

  motif_consultation: String,
  symptomes: String,
  examen_clinique: String,
  diagnostic_chirurgical: String,
  decision: { type: String, enum: ['intervention', 'traitement_medical', 'examens_complementaires', 'hospitalisation'], default: 'intervention' },
  type_intervention: String,

  date_intervention_prev: Date,
  date_intervention_reelle: Date,
  salle_prevue: String,
  duree_intervention_min: Number,
  cr_operatoire: String,
  evolution_immediate: String,

  date_sortie: Date,
  etat_sortie: { type: String, enum: ['guerison', 'amelioration', 'stationnaire', 'aggravation', 'deces'] },
  diagnostic_final: String,
  recommandations: String,
  rdv_controle: Date,

  ia_risque_score: { type: Number, default: 0, min: 0, max: 100 },
  ia_risque_niveau: { type: String, enum: ['faible', 'modere', 'eleve', 'critique'], default: 'faible' },

  nb_complications: { type: Number, default: 0 },
  nb_suivis: { type: Number, default: 0 },

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

dossierChirurgicalSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('DossierChirurgical', dossierChirurgicalSchema);