const mongoose = require('mongoose');
const { Schema } = mongoose;

const DepenseSchema = new Schema({
  date:         { type: Date, default: Date.now },
  categorie:    { type: String, enum: ['Salaires','Médicaments','Fournitures médicales','Électricité','Eau','Internet','Maintenance','Transport','Autre'], default: 'Autre' },
  description:  { type: String, required: true },
  fournisseur:  String,
  montant:      { type: Number, required: true, min: 0 },
  statut:       { type: String, enum: ['paye','en_attente'], default: 'paye' },
  notes:        String,
  enregistre_par: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Depense', DepenseSchema);
