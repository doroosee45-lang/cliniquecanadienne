// AUDIT-ELEVE-5 — Message extrait de Conversation.messages (tableau
// embarqué en croissance illimitée, migration validée avec l'utilisateur
// avant tout code — voir plan de migration). Schémas ReactionSchema/
// PieceJointeSchema repris à l'identique de models/Conversation.js.
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ReactionSchema = new Schema({
  emoji: { type: String, required: true },
  utilisateur: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { _id: false });

const PieceJointeSchema = new Schema({
  filename: String, path: String, type: String, duration: Number,
  // POST5-004 (audit indépendant post-Phase 5, 14 sept. 2026) — même
  // traitement que Patient.photo_public_id/resource_type/format/version :
  // permet de régénérer une URL Cloudinary signée à courte durée de vie à
  // chaque lecture autorisée, au lieu de resservir indéfiniment l'URL
  // signée sans expiration stockée dans `path`.
  cloudinary_public_id:     { type: String, default: null },
  cloudinary_resource_type: { type: String, default: null },
  cloudinary_format:        { type: String, default: null },
  cloudinary_version:       { type: Number, default: null },
}, { _id: false });

const MessageSchema = new Schema({
  conversation_id: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
  expediteur:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  // Un message peut être une pièce jointe seule (vocal/image/document), sans
  // texte : contenu n'est requis que lorsqu'il n'y a pas de pieceJointe.
  contenu:         { type: String, required: function () { return !this.pieceJointe; } },
  pieceJointe:     PieceJointeSchema,
  reactions:       [ReactionSchema],
  lu_par:          [{ type: Schema.Types.ObjectId, ref: 'User' }],
  date_envoi:      { type: Date, default: Date.now },
}, { timestamps: true });

// Index de pagination par curseur — le seul nécessaire : le compteur de
// messages non lus (lu_par: {$ne: userId}) ne peut de toute façon pas être
// accéléré par un index sur lu_par (multikey + $ne = pas de seek possible,
// juste un filtre résiduel) ; le préfixe conversation_id de CET index suffit
// déjà à borner le scan pour cette requête.
MessageSchema.index({ conversation_id: 1, date_envoi: -1 });

module.exports = mongoose.model('Message', MessageSchema);
