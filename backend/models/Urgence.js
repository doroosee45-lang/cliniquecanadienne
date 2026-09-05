const mongoose = require('mongoose');

const SoinSchema = new mongoose.Schema({
  acte:      { type: String, required: true },
  personnel: { type: String },
  heure:     { type: String },
  note:      { type: String },
  date:      { type: Date, default: Date.now },
}, { _id: true });

const PrescriptionUrgSchema = new mongoose.Schema({
  type:        { type: String, enum: ['medicament','perfusion','soin'], default: 'medicament' },
  designation: { type: String, required: true },
  posologie:   { type: String },
  medecin:     { type: String },
  date:        { type: Date, default: Date.now },
  // Correction 2 (module 4/6, relecture du 6 sept. 2026) — référence réelle
  // et optionnelle vers le catalogue Medication (prix_vente réel), jamais
  // fabriquée si absente. Uniquement pertinente pour type:'medicament' —
  // perfusion/soin n'ont aujourd'hui aucun catalogue tarifaire réel
  // équivalent dans ce codebase (documenté, pas simulé).
  medicament:  { type: mongoose.Schema.Types.ObjectId, ref: 'Medication' },
}, { _id: true });

const ExamenUrgSchema = new mongoose.Schema({
  type:        { type: String, enum: ['labo','imagerie'], default: 'labo' },
  designation: { type: String, required: true },
  urgent:      { type: Boolean, default: false },
  statut:      { type: String, enum: ['attente','en_cours','resultat'], default: 'attente' },
  resultat:    { type: String },
  date:        { type: Date, default: Date.now },
  // Correction 2 (module 4/6) — référence réelle et optionnelle vers
  // ExamCatalogue (labo → type:'laboratoire', imagerie → type:'imagerie'),
  // même pattern que Laboratory/Radiology/Echographie.
  examen:      { type: mongoose.Schema.Types.ObjectId, ref: 'ExamCatalogue' },
}, { _id: true });

const TimelineSchema = new mongoose.Schema({
  action:    { type: String, required: true },
  heure:     { type: String },
  personnel: { type: String },
  auteur:    { type: String },
  date:      { type: Date, default: Date.now },
}, { _id: true });

const UrgenceSchema = new mongoose.Schema({
  numero:           { type: String, unique: true, sparse: true },
  patient:          { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  patient_nom:      { type: String, required: true },
  patient_dob:      { type: Date },
  patient_sexe:     { type: String, enum: ['homme','femme',''] },
  patient_tel:      { type: String },
  contact_urgence:  { type: String },
  tel_urgence:      { type: String },

  motif:            { type: String },
  niveau_triage:    { type: String, enum: ['rouge','orange','jaune','vert','bleu'], default: 'orange' },
  statut: {
    type: String,
    enum: ['attente','triage','consultation','observation','soins','hospitalise','sorti','transfere','decede'],
    default: 'attente',
  },

  temperature:  { type: Number },
  tension_sys:  { type: Number },
  tension_dia:  { type: Number },
  pouls:        { type: Number },
  spo2:         { type: Number },
  glycemie:     { type: Number },

  medecin:              { type: String },
  medecin_responsable:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  infirmier:            { type: String },
  service:              { type: String },

  antecedents:           { type: String },
  allergies:             { type: String },
  traitements_cours:     { type: String },
  observations:          { type: String },
  diagnostic_provisoire: { type: String },
  diagnostic_final:      { type: String },
  recommandations:       { type: String },

  decision: {
    type: String,
    enum: ['retour_domicile','hospitalisation','transfert','deces',''],
    default: '',
  },

  // ADR-0005 — suit le workflow Urgences → Hospitalisation (remplace
  // l'option 2, purement passive, du ticket 0018). 'non_requise' tant que
  // decision !== 'hospitalisation' ; 'preparation' dès que la décision est
  // posée (le personnel peut alors "Préparer l'admission") ; 'terminee' une
  // fois l'hospitalisation réellement créée (hospitalization.controller.js
  // ::create) ; 'annulee' si la décision est finalement retirée avant
  // création. Jamais modifié automatiquement une fois 'terminee' — une
  // hospitalisation réelle existe, ce n'est plus une simple intention.
  admission_status: {
    type: String,
    enum: ['non_requise','preparation','terminee','annulee'],
    default: 'non_requise',
  },

  date_arrivee: { type: Date, default: Date.now },
  date_sortie:  { type: Date },
  heure_sortie: { type: String },

  soins:         [SoinSchema],
  prescriptions: [PrescriptionUrgSchema],
  examens:       [ExamenUrgSchema],
  timeline:      [TimelineSchema],
}, { timestamps: true });

// Auto-numérotation URG-YYYY-XXXX
UrgenceSchema.pre('save', async function (next) {
  if (this.isNew && !this.numero) {
    const { nextSequence } = require('../utils/counter');
    const year = new Date().getFullYear();
    const seq = await nextSequence(`urgence-${year}`);
    this.numero = `URG-${year}-${String(seq).padStart(4, '0')}`;
  }
  next();
});

// T9.8 — aucun index avant ce correctif (constaté en T2.4) : statut et
// niveau_triage sont filtrés en continu par le module urgences (criticité
// temporelle élevée). Modèle uniquement — urgencesController.js reste hors
// périmètre, cf. T9.3.
UrgenceSchema.index({ statut: 1, date_arrivee: -1 });
UrgenceSchema.index({ niveau_triage: 1 });

module.exports = mongoose.model('Urgence', UrgenceSchema);
