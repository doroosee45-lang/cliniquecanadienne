const mongoose = require('mongoose');

// Compteur atomique partagé pour la génération de numéros séquentiels
// (dossiers patients, factures, ordonnances, etc.). Remplace le pattern
// countDocuments()/findOne().sort() utilisé historiquement dans les hooks
// pre('save'), qui est sujet à une condition de course : deux créations
// concurrentes peuvent lire le même compte avant qu'aucune n'ait sauvegardé
// et se voir attribuer le même numéro (rejeté ensuite par l'index unique,
// donc pas de corruption silencieuse, mais une erreur 500 évitable).
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // ex: "patient-2026", "invoice-2026"
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', CounterSchema);
