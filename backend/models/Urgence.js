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
}, { _id: true });

const ExamenUrgSchema = new mongoose.Schema({
  type:        { type: String, enum: ['labo','imagerie'], default: 'labo' },
  designation: { type: String, required: true },
  urgent:      { type: Boolean, default: false },
  statut:      { type: String, enum: ['attente','en_cours','resultat'], default: 'attente' },
  resultat:    { type: String },
  date:        { type: Date, default: Date.now },
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
    const year = new Date().getFullYear();
    const count = await mongoose.model('Urgence').countDocuments({
      createdAt: { $gte: new Date(`${year}-01-01`), $lt: new Date(`${year + 1}-01-01`) },
    });
    this.numero = `URG-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Urgence', UrgenceSchema);
