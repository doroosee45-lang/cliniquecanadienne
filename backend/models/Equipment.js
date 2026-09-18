const mongoose = require('mongoose');
const { Schema } = mongoose;

// Cas #1 (audit métier) — remplace le placeholder honnête "🚧 Fonctionnalité
// en cours de développement" de Administration.jsx (section === "ressources")
// qui existait précisément parce qu'aucun modèle Equipment/Inventaire
// n'existait dans le système. Reproduit le pattern déjà établi par Depense
// (catégorie en enum, montant/quantite numérique, enregistre_par).
const EquipmentSchema = new Schema({
  nom:          { type: String, required: true, trim: true },
  categorie:    { type: String, enum: ['Informatique','Mobilier médical','Imagerie','Laboratoire','Bloc opératoire','Consommable','Autre'], default: 'Autre' },
  service:      { type: Schema.Types.ObjectId, ref: 'Service' },
  quantite:     { type: Number, required: true, min: 0, default: 0 },
  unite:        { type: String, default: 'unité' },
  seuil_alerte: { type: Number, min: 0, default: 0 },
  etat:         { type: String, enum: ['bon','moyen','hors_service'], default: 'bon' },
  notes:        String,
  enregistre_par: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

EquipmentSchema.index({ categorie: 1 });
EquipmentSchema.index({ service: 1 });

module.exports = mongoose.model('Equipment', EquipmentSchema);
