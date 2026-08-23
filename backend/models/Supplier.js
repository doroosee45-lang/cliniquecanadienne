const mongoose = require('mongoose');

// AUDIT-11-8 — Administration.jsx (saveSupplier) n'avait aucune route
// backend : POST /admin/suppliers fabriquait systématiquement un
// enregistrement local (faux succès), jamais persisté. Plan validé avec
// l'utilisateur avant code. montant_total/derniere_commande sont de simples
// champs (0/null à la création) : Commande.fournisseur est aujourd'hui une
// chaîne libre, sans relation réelle vers ce modèle — les dériver par
// correspondance de texte serait fragile et n'a pas été demandé ; une vraie
// relation Commande↔Supplier reste un chantier séparé si besoin plus tard.
const SupplierSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  contact: String,
  telephone: String,
  email: String,
  adresse: String,
  produits: { type: String, required: true },
  montant_total: { type: Number, default: 0 },
  derniere_commande: Date,
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Supplier', SupplierSchema);
