const mongoose = require('mongoose');
const { Schema } = mongoose;

const LabResultSchema = new Schema({
  patient:              { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  // Correction 12 (relecture du 6 sept. 2026, FLOW-003) — aucune
  // traçabilité entre un examen demandé et la consultation qui l'a motivé.
  // Optionnel : renseigné uniquement quand une vraie consultation du même
  // patient est réellement sélectionnée à la création (laboratory.controller.js::create).
  consultation:         { type: Schema.Types.ObjectId, ref: 'Consultation' },
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
  date_prelevement:     Date,
  date_resultat:        Date,
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

  // SPEC-11 (correction du 12 sept. 2026, audit indépendant) — champs
  // d'affichage du formulaire, un SNAPSHOT figé au moment de la création
  // (jamais recalculé si le Patient réel change ensuite : nom, dossier).
  // `patient` (ObjectId ci-dessus) reste la SEULE source de vérité
  // référentielle — ces 3 champs ne doivent jamais être lus comme une
  // donnée patient à jour ni utilisés à la place d'un .populate('patient')
  // réel ; ils existent uniquement pour un affichage rapide de listes et
  // pour l'historique (scrubés à l'anonymisation, voir
  // utils/patientAnonymization.js::CASCADE_TARGETS).
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
  // CLIN-04 (correction du 12 sept. 2026) — voir ImagingResult.js pour le
  // détail : numero généré par countDocuments()+1, sans garantie d'unicité
  // sous concurrence. Compteur atomique désormais utilisé (utils/counter.js)
  // ; index unique en filet de sécurité final.
  numero:               { type: String, unique: true, sparse: true },
}, { timestamps: true });

LabResultSchema.index({ patient: 1, date_prescription: -1 });
LabResultSchema.index({ est_critique: 1, acquitte_par: 1 });

module.exports = mongoose.model('LabResult', LabResultSchema);
