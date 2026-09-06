// Sous-phase 5.5.a — Évaluations. Remplace le CRUD purement local
// (evaluations[], _id: Date.now().toString()) de HR.jsx par une vraie
// persistance.
//
// `evaluateur` est lié au compte réel de l'auteur de l'évaluation
// (req.user, posé par le contrôleur), pas un champ texte libre comme dans
// l'ancien formulaire local : un champ texte aurait permis à quiconque de
// se faire passer pour n'importe quel évaluateur — exactement le genre de
// donnée non vérifiable que ce chantier corrige ailleurs (aucune donnée
// inventée).
const mongoose = require('mongoose');
const { Schema } = mongoose;

const NOTE_FIELDS = ['ponctualite', 'qualite', 'productivite', 'discipline', 'relation_patient'];

const EvaluationSchema = new Schema({
  employe:          { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
  periode:          { type: String, required: true },
  ponctualite:      { type: Number, min: 1, max: 5, required: true },
  qualite:          { type: Number, min: 1, max: 5, required: true },
  productivite:     { type: Number, min: 1, max: 5, required: true },
  discipline:       { type: Number, min: 1, max: 5, required: true },
  relation_patient: { type: Number, min: 1, max: 5, required: true },
  note_globale:     { type: Number, min: 1, max: 5 },
  commentaire:      { type: String, default: '' },
  evaluateur:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// Calculée depuis les 5 notes réellement soumises — jamais saisie
// directement, pour qu'elle ne puisse jamais diverger de ses composantes.
EvaluationSchema.pre('validate', function computeNoteGlobale(next) {
  const sum = NOTE_FIELDS.reduce((s, f) => s + (this[f] || 0), 0);
  this.note_globale = Math.round((sum / NOTE_FIELDS.length) * 10) / 10;
  next();
});

module.exports = mongoose.model('Evaluation', EvaluationSchema);
