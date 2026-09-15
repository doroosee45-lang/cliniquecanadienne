/**
 * EcritureBilan — valeurs comptables du bilan qu'AUCUN calcul ne peut
 * dériver des données de l'application (contrairement à la trésorerie, aux
 * stocks ou aux créances, qui sont calculables depuis Invoice/Depense/
 * Medication). Ces 6 montants proviennent de la comptabilité externe de la
 * clinique (déclarations fiscales, statuts de société, etc.) et doivent
 * être saisis et mis à jour périodiquement par le comptable.
 *
 * Un seul document par année, sur le même principe que BudgetCible.
 */
const mongoose = require('mongoose');

const EcritureBilanSchema = new mongoose.Schema({
  annee: { type: Number, required: true, unique: true, index: true },

  fournisseurs:     { type: Number, default: 0, min: 0 },
  charges_sociales: { type: Number, default: 0, min: 0 },
  impots_a_payer:   { type: Number, default: 0, min: 0 },

  capital_social:   { type: Number, default: 0, min: 0 },
  reserves:         { type: Number, default: 0, min: 0 },
  report_a_nouveau: { type: Number, default: 0 },

  modifie_par: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('EcritureBilan', EcritureBilanSchema);
