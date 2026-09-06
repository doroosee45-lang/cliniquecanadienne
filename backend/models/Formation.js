// Sous-phase 5.5.a — Formations. Remplace le CRUD purement local
// (formations[], _id: Date.now().toString()) de HR.jsx par une vraie
// persistance.
//
// `participants` référence de vrais employés (Staff), pas du texte libre
// comme dans l'ancien formulaire ("Martin Leblanc, Sophie Pierre...") : un
// champ texte libre aurait permis de citer des personnes qui n'existent
// pas dans ce système — aucune donnée inventée.
const mongoose = require('mongoose');
const { Schema } = mongoose;

const FormationSchema = new Schema({
  titre:        { type: String, required: true, trim: true },
  type:         { type: String, enum: ['interne', 'externe', 'seminaire', 'atelier'], default: 'interne' },
  date:         { type: Date, required: true },
  duree_h:      { type: Number, default: 0, min: 0 },
  participants: [{ type: Schema.Types.ObjectId, ref: 'Staff' }],
  certificat:   { type: Boolean, default: false },
  cree_par:     { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Formation', FormationSchema);
