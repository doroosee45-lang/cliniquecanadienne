// Sous-phase 5.5.a — Recrutement. Remplace le CRUD purement local
// (candidatures[], _id: Date.now().toString()) de HR.jsx par une vraie
// persistance : sans ce modèle, "Convoquer"/"Sélectionner" ne survivaient
// jamais à un rechargement de page.
const mongoose = require('mongoose');
const { Schema } = mongoose;

const CandidatureSchema = new Schema({
  nom:        { type: String, required: true, trim: true },
  poste:      {
    type: String,
    enum: ['medecin', 'infirmier', 'laborantin', 'radiologue', 'pharmacien', 'administratif', 'aide_soignant', 'maintenance'],
    default: 'infirmier',
  },
  experience: { type: String, default: '' },
  diplome:    { type: String, default: '' },
  email:      { type: String, lowercase: true, trim: true, default: '' },
  telephone:  { type: String, default: '' },
  statut:     { type: String, enum: ['recu', 'en_analyse', 'entretien', 'selectionne', 'refuse'], default: 'recu' },
  date_depot: { type: Date, default: Date.now },
  cree_par:   { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Candidature', CandidatureSchema);
