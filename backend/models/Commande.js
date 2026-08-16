const mongoose = require('mongoose');
const { Schema } = mongoose;

const LigneCommandeSchema = new Schema({
  // Facultatif — une ligne saisie en texte libre (nom sans medicament) ne
  // peut pas être rapprochée automatiquement d'une fiche stock à la
  // réception, même principe que Prescription.lignes (pharmacy.controller.js).
  medicament:     { type: Schema.Types.ObjectId, ref: 'Medication' },
  nom:            String,
  forme:          String,
  dosage:         String,
  quantite:       { type: Number, required: true, min: 1 },
  quantite_recue: { type: Number, default: 0 },
  prix_unitaire:  { type: Number, default: 0 },
}, { _id: false });

const CommandeSchema = new Schema({
  numero:                      { type: String, unique: true },
  fournisseur:                 { type: String, required: true },
  lignes:                      { type: [LigneCommandeSchema], validate: v => v.length > 0 },
  montant:                     { type: Number, default: 0 },
  date_livraison_souhaitee:    Date,
  date_reception:              Date,
  notes:                       String,
  statut: { type: String, enum: ['brouillon','envoye','confirme','recu_partiel','recu','annule'], default: 'brouillon' },
  cree_par:                    { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

CommandeSchema.pre('save', async function (next) {
  if (this.isNew && !this.numero) {
    const { nextSequence } = require('../utils/counter');
    const year = new Date().getFullYear();
    const seq = await nextSequence(`commande-${year}`);
    this.numero = `BC-${year}-${String(seq).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Commande', CommandeSchema);
