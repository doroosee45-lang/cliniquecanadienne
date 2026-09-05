const mongoose = require('mongoose');
const { Schema } = mongoose;

// T5.2 (R-04a) — le schéma ne déclarait qu'une douzaine de champs alors que
// le formulaire frontend (Consultations.jsx) en envoie ~28 à chaque
// sauvegarde. Consultation.create({ ...req.body, ... }) sans strict:false
// laissait Mongoose retirer silencieusement tout champ non déclaré : les
// prescriptions, examens complémentaires, décision de sortie et informations
// de facturation saisies par le médecin n'étaient jamais persistés, sans
// erreur ni signal. Champs ajoutés ici pour correspondre exactement à ce que
// le formulaire envoie réellement (frontend/src/pages/Consultations.jsx).
const ConsultationSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  medecin: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  appointment: { type: Schema.Types.ObjectId, ref: 'Appointment' },
  numero: String,
  date_consultation: { type: Date, default: Date.now },
  type_consultation: String,
  service: String,
  signes_vitaux: {
    tension_systolique: Number,
    tension_diastolique: Number,
    pouls: Number,
    temperature: Number,
    spo2: Number,
    glycemie: Number,
    poids: Number,
    taille: Number,
  },
  anamnese: String,
  examen_clinique: String,
  examen_cardiovasculaire: String,
  examen_pulmonaire: String,
  examen_abdominal: String,
  examen_neurologique: String,
  examen_orl: String,
  examen_dermatologie: String,
  diagnostic: String,
  diagnostic_code: String,
  gravite: { type: String, enum: ['leger', 'modere', 'grave', 'critique'], default: 'leger' },
  recommandations: String,
  // Lignes de prescription saisies pendant la consultation — texte libre, pas
  // rattachées au catalogue Medication. À la création d'une consultation
  // terminée avec au moins une ligne, un document Prescription formel est
  // généré automatiquement (voir consultations.controller.js::create) ;
  // conservées ici aussi comme trace de ce qui a été saisi dans ce contexte.
  prescriptions: [{
    medicament_nom: String,
    posologie: String,
    duree: String,
    notes: String,
  }],
  examens_complementaires: [{
    type: { type: String, enum: ['biologie', 'imagerie', 'scanner', 'autre'], default: 'autre' },
    libelle: String,
    priorite: { type: String, enum: ['normal', 'semi_urgent', 'urgent'], default: 'normal' },
    note: String,
  }],
  decision: { type: String, enum: ['domicile', 'hospitalisation', 'specialiste', 'urgences'] },
  rdv_date: Date,
  rdv_note: String,
  frais_consultation: Number,
  statut_paiement: { type: String, enum: ['non_paye', 'partiel', 'paye', 'assurance', 'exonere'], default: 'non_paye' },
  // Correction 1 (relecture du 6 sept. 2026, FE-BUG-003) — le <select> "Mode
  // de paiement" du formulaire (Consultations.jsx) n'avait ni value ni
  // onChange : la sélection de l'utilisateur n'était jamais transmise, et ce
  // champ n'existait même pas ici (Consultations.jsx:763-766 le lit déjà en
  // lecture seule, mais rien ne l'écrivait jamais).
  mode_paiement: { type: String, enum: ['especes', 'mobile', 'virement', 'assurance'] },
  statut: { type: String, enum: ['en_cours','terminee','suspendue'], default: 'en_cours' },
  ia_suggestions: [{ diagnostic: String, confidence: Number }],
}, { timestamps: true });

// T9.8 — aucun index avant ce correctif (constaté en T2.4). date_consultation
// seul couvre les requêtes de plage de dates du dashboard ; les trois
// composés couvrent la liste filtrée+triée par statut/patient/medecin
// (chacun étant filtré indépendamment dans consultations.controller.js).
ConsultationSchema.index({ date_consultation: -1 });
ConsultationSchema.index({ statut: 1, date_consultation: -1 });
ConsultationSchema.index({ patient: 1, date_consultation: -1 });
ConsultationSchema.index({ medecin: 1, date_consultation: -1 });

module.exports = mongoose.model('Consultation', ConsultationSchema);
