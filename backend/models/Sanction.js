// Sous-phase 5.5.a — Discipline/Sanctions. Remplace le CRUD purement local
// (sanctions[], _id: Date.now().toString()) de HR.jsx par une vraie
// persistance.
//
// `decide_par` est l'auteur réel authentifié de la requête (req.user),
// pas un champ texte libre — même principe que `evaluateur` sur
// Evaluation. Pas de champ "notifié" : l'ancien formulaire local
// affichait un Badge "Notifié" entièrement fabriqué (aucun envoi réel
// n'existait) — ce chantier ne construit pas de mécanisme de notification
// ici (hors périmètre demandé), donc ce badge n'est pas reconstruit.
const mongoose = require('mongoose');
const { Schema } = mongoose;

const SanctionSchema = new Schema({
  employe:    { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
  type:       { type: String, enum: ['avertissement', 'blame', 'suspension', 'licenciement'], required: true },
  motif:      { type: String, required: true, trim: true },
  date:       { type: Date, default: Date.now },
  decide_par: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Sanction', SanctionSchema);
