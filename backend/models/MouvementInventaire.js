const mongoose = require('mongoose');
const { Schema } = mongoose;

// Historique des mouvements de stock d'un Equipment — chaque entrée/sortie/
// ajustement est tracée séparément (jamais un simple écrasement du champ
// quantite), pour permettre un vrai historique consultable, pas seulement
// un solde courant.
const MouvementInventaireSchema = new Schema({
  equipement:   { type: Schema.Types.ObjectId, ref: 'Equipment', required: true },
  type:         { type: String, enum: ['entree','sortie','ajustement'], required: true },
  quantite:     { type: Number, required: true },
  motif:        String,
  enregistre_par: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

MouvementInventaireSchema.index({ equipement: 1, createdAt: -1 });

module.exports = mongoose.model('MouvementInventaire', MouvementInventaireSchema);
