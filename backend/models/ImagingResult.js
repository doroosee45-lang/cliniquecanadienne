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

  // SPEC-11 (correction du 12 sept. 2026, audit indépendant) — champs
  // d'affichage (texte libre — évitent les populate côté frontend), un
  // SNAPSHOT figé au moment de la création, jamais recalculé si le Patient
  // réel change ensuite. `patient` (ObjectId ci-dessus) reste la SEULE
  // source de vérité référentielle — ces champs ne doivent jamais être lus
  // comme une donnée patient à jour ni remplacer un .populate('patient')
  // réel ; scrubés à l'anonymisation (utils/patientAnonymization.js::
  // CASCADE_TARGETS).
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
  // CLIN-04 (correction du 12 sept. 2026) — numero était généré par
  // countDocuments()+1 (radiology.controller.js/consultations.controller.js),
  // sans aucune garantie d'unicité : deux créations concurrentes pouvaient
  // lire le même compte avant que l'une ou l'autre ne persiste, produisant
  // un doublon. Généré désormais via le compteur atomique (utils/counter.js,
  // même mécanisme déjà utilisé par chirurgie/bloc/pregnancy/etc.) ; l'index
  // unique ci-dessous est le filet de sécurité final si jamais une valeur
  // fabriquée (ou une donnée historique) entrait en conflit.
  numero:                 { type: String, unique: true, sparse: true },

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
    // POST5-004 (audit indépendant post-Phase 5, 14 sept. 2026) — même
    // traitement que Patient.photo_public_id/resource_type/format/version :
    // permet de régénérer une URL Cloudinary signée à courte durée de vie
    // à chaque lecture autorisée, au lieu de resservir indéfiniment l'URL
    // signée sans expiration stockée dans `path`.
    cloudinary_public_id:     { type: String, default: null },
    cloudinary_resource_type: { type: String, default: null },
    cloudinary_format:        { type: String, default: null },
    cloudinary_version:       { type: Number, default: null },
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
