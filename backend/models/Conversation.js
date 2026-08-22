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

// AUDIT-MESSAGES-PhaseB — messages vocaux/image/document : duration ajoutée
// (nécessaire pour l'affichage de la durée d'un message vocal sans avoir à
// re-décoder le fichier côté client).
const PieceJointeSchema = new Schema({
  filename: String, path: String, type: String, duration: Number,
}, { _id: false });

const MessageSchema = new Schema({
  expediteur: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  // AUDIT-MESSAGES-PhaseB — un message peut désormais être une pièce jointe
  // seule (vocal/image/document), sans texte : contenu n'est requis que
  // lorsqu'il n'y a pas de pieceJointe.
  contenu: { type: String, required: function () { return !this.pieceJointe; } },
  lu_par: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  date_envoi: { type: Date, default: Date.now },
  pieceJointe: PieceJointeSchema,
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
  // AUDIT-MESSAGES-PhaseA — le frontend affichait un aperçu du dernier
  // message (liste des conversations) en lisant `dernier_message` comme si
  // c'était le texte, alors que ce champ n'a jamais été qu'une Date
  // (horodatage, utilisé pour le tri .sort('-dernier_message')). Ajouté
  // séparément pour ne pas casser le tri existant, comportement additif.
  dernier_message_apercu: String,
  // AUDIT-MESSAGES-PhaseB — favoris/archivage étaient purement locaux côté
  // frontend (état React jamais persisté, perdu au rafraîchissement) ; par
  // utilisateur (pas un simple booléen global), une conversation archivée
  // par un membre ne doit pas l'être pour les autres.
  favoris: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  archivee_par: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  created_by: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

ConversationSchema.index({ membres: 1 });

module.exports = mongoose.model('Conversation', ConversationSchema);
