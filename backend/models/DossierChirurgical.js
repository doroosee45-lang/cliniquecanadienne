// backend/models/DossierChirurgical.js
const mongoose = require('mongoose');

const dossierChirurgicalSchema = new mongoose.Schema({
  numero: { type: String, unique: true, required: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  patient_nom: { type: String, required: true },
  date_naissance: { type: Date },
  sexe: { type: String, enum: ['homme', 'femme', 'autre'] },
  groupe_sanguin: String,
  allergies: String,
  antecedents_medicaux: String,
  antecedents_chirurgicaux: String,
  telephone: String,

  chirurgien_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  chirurgien_nom: String,
  assistant: String,
  anesthesiste: String,
  infirmier_instru: String,
  infirmier_circu: String,

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
  // AUDIT-ANALYTICS-P5 — horodatages réels d'occupation physique de la
  // salle, distincts de date_intervention_prev (planification) et
  // date_intervention_reelle (marqueur de réalisation) : permettent de
  // savoir si une salle est occupée EN CE MOMENT, pas seulement si une
  // intervention y est programmée aujourd'hui. Capturés via les boutons
  // "Entrée en salle"/"Sortie de salle" (Blocoperatoire.jsx).
  salle_entree_at: Date,
  salle_sortie_at: Date,
  duree_intervention_min: Number,
  cr_operatoire: String,
  evolution_immediate: String,
  materiel_implante: String,
  saignement_ml: Number,
  transfusion_ml: Number,

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

// AUDIT-B2 — patient n'avait aucun index malgré un filtrage fréquent par
// ce champ (chirurgieController.js::getDossiers) ; composé avec created_at
// (l'ordre de tri utilisé par la même requête), même pattern déjà en place
// sur les modèles comparables (Consultation, Hospitalization, Invoice,
// LabResult, Prescription : { patient: 1, <date>: -1 }).
// ADR-0006 — champ renommé patient_id → patient (convention majoritaire).
dossierChirurgicalSchema.index({ patient: 1, created_at: -1 });

// AUDIT-2.1 — blocoperatoireController.js n'avait aucune détection de conflit
// de salle/créneau ; la vérification applicative ajoutée
// (checkBlocConflict, blocoperatoireController.js) n'est pas atomique avec
// l'écriture qui suit. Cet index unique partiel ferme la course pour le cas
// exact (même salle, même date_intervention_prev à la milliseconde) :
// MongoDB rejette la seconde écriture concurrente en erreur E11000, remontée
// en 409/400 par le contrôleur. Restreint aux dossiers réellement
// programmés au bloc (salle_prevue/date_intervention_prev renseignés) pour
// ne jamais entrer en collision avec un dossier chirurgical "consultation"
// classique qui atteindrait statut preoperatoire/opere sans être programmé
// dans une salle — vérifié empiriquement contre MongoDB (partialFilterExpression
// n'accepte que $exists/$in/$gt(e)/$lt(e)/$type et l'égalité, pas $ne/$nin).
dossierChirurgicalSchema.index(
  { salle_prevue: 1, date_intervention_prev: 1 },
  {
    unique: true,
    partialFilterExpression: {
      statut: { $in: ['preoperatoire', 'opere'] },
      salle_prevue: { $exists: true },
      date_intervention_prev: { $exists: true },
    },
  }
);

module.exports = mongoose.model('DossierChirurgical', dossierChirurgicalSchema);