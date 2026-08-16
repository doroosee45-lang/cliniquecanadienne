const mongoose = require('mongoose');

const NewbornSchema = new mongoose.Schema({
  numero:          { type: String, unique: true, sparse: true },
  accouchement_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery' },
  grossesse_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Pregnancy' },
  patient_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  mere_nom:        String,
  prenom:          String,
  nom:             String,
  sexe:            { type: String, enum: ['M', 'F'] },
  date_naissance:  { type: Date, default: Date.now },
  poids:           Number,   // grammes
  taille:          Number,   // cm
  perimetre_cranien: Number, // cm
  apgar_1:         Number,
  apgar_5:         Number,
  respiration:     String,
  coloration:      String,
  reflexes:        String,
  tonus:           String,
  etat:            { type: String, enum: ['bon', 'surveillance', 'critique'], default: 'bon' },
  vaccinations: [{
    vaccin: String,
    date:   { type: Date, default: Date.now },
    lot:    String,
    dose:   String,
    administre_par: String,
  }],
  observations:    String,
  created_by:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // R-10d — pas de création automatique d'un dossier Child : ce champ trace
  // le dossier créé quand le personnel choisit explicitement de le faire
  // (POST /maternite/nouveau-nes/:id/dossier-enfant), et empêche d'en créer
  // un second par erreur pour le même nouveau-né.
  child_id:        { type: mongoose.Schema.Types.ObjectId, ref: 'Child', default: null },
}, { timestamps: true });

NewbornSchema.pre('save', async function (next) {
  if (!this.numero) {
    const { nextSequence } = require('../utils/counter');
    const year = new Date().getFullYear();
    const seq = await nextSequence(`newborn-${year}`);
    this.numero = `NB-${year}-${String(seq).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Newborn', NewbornSchema);
