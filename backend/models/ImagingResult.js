const mongoose = require('mongoose');
const { Schema } = mongoose;

const ImagingResultSchema = new Schema({
  patient:                { type: Schema.Types.ObjectId, ref: 'Patient' },
  // Correction 12 (relecture du 6 sept. 2026, FLOW-003) — même correctif
  // que LabResult.js : traçabilité optionnelle vers la consultation réelle
  // à l'origine de la demande d'imagerie, validée avant persistance.
  consultation:           { type: Schema.Types.ObjectId, ref: 'Consultation' },
  medecin_prescripteur:   { type: Schema.Types.ObjectId, ref: 'User' },
  radiologue:             { type: Schema.Types.ObjectId, ref: 'User' },
  examen:                 { type: Schema.Types.ObjectId, ref: 'ExamCatalogue' },

  // champs d'affichage (texte libre — évitent les populate côté frontend)
  patient_nom:            String,
  patient_dob:            String,
  patient_dossier:        String,
  sexe:                   String,
  telephone:              String,
  adresse:                String,
  medecin_prescripteur_nom: String,
  radiologue_nom:         String,

  // données métier
  type_categorie:         String,          // echographie, radiologie, scanner, irm…
  type_examen:            String,          // texte libre (ex: "Échographie abdominale")
  region_anatomique:      String,
  priorite:               { type: String, enum: ['normale','urgente','tres_urgente','stat'], default: 'normale' },
  motif:                  String,
  service_demandeur:      String,
  salle:                  String,
  operateur:              String,
  date_rdv:               String,
  heure_rdv:              String,
  numero:                 String,

  date_prescription:      { type: Date, default: Date.now },
  date_realisation:       Date,
  date_rapport:           Date,
  date_validation:        Date,
  // AUDIT-02 — Radiology.jsx envoie ce champ depuis toujours (code de
  // signature du radiologue à la validation) ; jamais déclaré ici, donc
  // silencieusement supprimé par Mongoose malgré l'interface qui l'affiche
  // comme acquis (currentExamen.signature).
  signature:              String,

  compte_rendu:           String,
  conclusion:             String,
  recommandations:        String,
  observations:           String,
  incidents:              String,
  anomalie_detectee:      { type: Boolean, default: false },
  ia_anomalie:            { type: Boolean, default: false },
  ia_confidence:          Number,
  ia_details:             String,

  images: [{
    filename: String,
    path:     String,
    type_mime:String,
    taille:   Number,
  }],

  statut: { type: String, enum: ['programme','en_attente','realise','rapporte','valide','annule'], default: 'programme' },
}, { timestamps: true });

// T9.8 — aucun index avant ce correctif (constaté en T2.4) : patient/statut/
// date_prescription/priorite sont filtrés en continu par le dashboard
// radiologue.
ImagingResultSchema.index({ statut: 1, date_prescription: -1 });
ImagingResultSchema.index({ date_prescription: -1 });
ImagingResultSchema.index({ patient: 1 });
ImagingResultSchema.index({ priorite: 1 });

module.exports = mongoose.model('ImagingResult', ImagingResultSchema);
