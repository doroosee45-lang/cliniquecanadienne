const mongoose = require('mongoose');
const { Schema } = mongoose;

// AUDIT-FINANCE-BUDGET — cible de budget annuel, saisie manuellement (aucun
// système ne peut deviner un budget planifié). Une cible par (année,
// catégorie) plutôt qu'un département : Depense n'a jamais tracké de
// département, seulement une catégorie de type de dépense (même enum que
// Depense.categorie ci-dessous) — audit préalable confirmé, décision
// explicite de l'utilisateur suite à cet audit.
const CATEGORIES = ['Salaires', 'Médicaments', 'Fournitures médicales', 'Électricité', 'Eau', 'Internet', 'Maintenance', 'Transport', 'Autre'];

const BudgetCibleSchema = new Schema({
  annee: { type: Number, required: true },
  categorie: { type: String, enum: CATEGORIES, required: true },
  montant_annuel: { type: Number, required: true, min: 0 },
  modifie_par: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

BudgetCibleSchema.index({ annee: 1, categorie: 1 }, { unique: true });

module.exports = mongoose.model('BudgetCible', BudgetCibleSchema);
module.exports.CATEGORIES = CATEGORIES;
