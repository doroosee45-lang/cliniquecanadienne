const mongoose = require('mongoose');
const { Schema } = mongoose;

// AUDIT-07 — réactions emoji sur un message, décision explicite : Conversation
// / MessageSchema réutilisés tels quels, aucun nouveau modèle. Convention de
// nommage alignée sur le reste du schéma (expediteur, lu_par : "utilisateur"
// plutôt qu'un anglicisme "user").
const ReactionSchema = new Schema({
  emoji: { type: String, required: true },
  utilisateur: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { _id: false });

const MessageSchema = new Schema({
  expediteur: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  contenu: { type: String, required: true },
  lu_par: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  date_envoi: { type: Date, default: Date.now },
  pieceJointe: { filename: String, path: String, type: String },
  reactions: [ReactionSchema],
}, { _id: true });

const ConversationSchema = new Schema({
  type: { type: String, enum: ['direct','groupe'], default: 'direct' },
  nom: String,
  // AUDIT-07 — le formulaire "Créer un groupe" (Messages.jsx) collecte ce
  // champ depuis toujours ; ajouté ici pour ne pas reproduire le même bug de
  // perte silencieuse déjà corrigé ailleurs dans ce projet (champ envoyé par
  // un formulaire réel, jamais déclaré sur le schéma).
  description: String,
  membres: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  messages: [MessageSchema],
  dernier_message: Date,
  created_by: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

ConversationSchema.index({ membres: 1 });

module.exports = mongoose.model('Conversation', ConversationSchema);
