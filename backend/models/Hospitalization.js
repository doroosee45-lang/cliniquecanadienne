const mongoose = require('mongoose');
const { Schema } = mongoose;

const NoteSchema = new Schema({
  date: { type: Date, default: Date.now },
  auteur: { type: Schema.Types.ObjectId, ref: 'User' },
  tension: String,
  pouls: Number,
  temperature: Number,
  spo2: Number,
  contenu: String,
}, { _id: false });

const HospitalizationSchema = new Schema({
  patient:              { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  chambre:              { type: Schema.Types.ObjectId, ref: 'Room' },
  chambre_num:          { type: String },          // texte libre quand pas de Room en BD
  lit_numero:           { type: String },
  service:              { type: Schema.Types.ObjectId, ref: 'Service' },
  service_nom:          { type: String },          // texte libre quand pas de Service en BD
  medecin_responsable:  { type: Schema.Types.ObjectId, ref: 'User' },
  medecin_nom:          { type: String },          // texte libre quand pas d'User en BD
  date_entree:          { type: Date, default: Date.now },
  date_sortie_prevue:   Date,
  date_sortie:          Date,
  motif_entree:         { type: String, required: true },
  diagnostic_entree:    String,
  diagnostic_sortie:    String,
  notes_cliniques:      [NoteSchema],
  statut:               { type: String, enum: ['en_cours','sorti','transfere','decede'], default: 'en_cours' },
  cout_total:           { type: Number, default: 0 },
  // champs supplémentaires du formulaire
  provenance:           String,
  type_chambre:         String,
  batiment:             String,
  contact_urgence:      String,
  tel_urgence:          String,
}, { timestamps: true });

// T9.8 — aucun index avant ce correctif (constaté en T2.4) : toute requête
// filtrait sur COLLSCAN. statut/date_entree couvrent le dashboard (compteurs
// par statut, occupation du jour) et la liste triée par défaut ; patient et
// medecin_responsable+statut couvrent respectivement l'historique patient et
// la vue "mon service".
HospitalizationSchema.index({ statut: 1, date_entree: -1 });
HospitalizationSchema.index({ date_entree: -1 });
HospitalizationSchema.index({ patient: 1, date_entree: -1 });
HospitalizationSchema.index({ medecin_responsable: 1, statut: 1 });

module.exports = mongoose.model('Hospitalization', HospitalizationSchema);
