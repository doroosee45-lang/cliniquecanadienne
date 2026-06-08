const mongoose = require('mongoose');
const { Schema } = mongoose;

const LabResultSchema = new Schema({
  patient:              { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  medecin_prescripteur: { type: Schema.Types.ObjectId, ref: 'User' },
  medecin_prescripteur_nom: String,        // texte libre
  technicien:           { type: Schema.Types.ObjectId, ref: 'User' },
  validateur:           { type: Schema.Types.ObjectId, ref: 'User' },

  examen:               { type: Schema.Types.ObjectId, ref: 'ExamCatalogue' },  // optionnel
  examens_demandes:     { type: [Schema.Types.Mixed], default: [] },             // IDs locaux ou ObjectIds

  priorite:             { type: String, enum: ['normale','urgente','stat'], default: 'normale' },
  niveau_urgence:       String,

  date_prescription:    { type: Date, default: Date.now },
  date_demande:         Date,
  date_realisation:     Date,
  date_validation:      Date,

  resultats:            mongoose.Schema.Types.Mixed,
  est_critique:         { type: Boolean, default: false },
  valeurs_critiques:    String,
  acquitte_par:         { type: Schema.Types.ObjectId, ref: 'User' },
  acquitte_at:          Date,

  statut:               { type: String, enum: ['prescrit','en_attente','en_cours','preleve','termine','valide','annule'], default: 'prescrit' },
  commentaires:         String,
  ia_anomalie:          { type: Boolean, default: false },
  ia_details:           String,

  // champs d'affichage du formulaire
  patient_nom:          String,
  patient_dossier:      String,
  patient_gs:           String,
  service_demandeur:    String,
  type_echantillon:     String,
  preleveur:            String,
  observations_prelevement: String,
  autres_examens:       String,
  sexe:                 String,
  date_naissance:       String,
  telephone:            String,
  numero:               String,
}, { timestamps: true });

LabResultSchema.index({ patient: 1, date_prescription: -1 });
LabResultSchema.index({ est_critique: 1, acquitte_par: 1 });

module.exports = mongoose.model('LabResult', LabResultSchema);
