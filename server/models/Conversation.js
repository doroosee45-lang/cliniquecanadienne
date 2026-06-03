const mongoose = require('mongoose');
const { Schema } = mongoose;

const MessageSchema = new Schema({
  expediteur: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  contenu: { type: String, required: true },
  lu_par: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  date_envoi: { type: Date, default: Date.now },
  pieceJointe: { filename: String, path: String, type: String },
}, { _id: true });

const ConversationSchema = new Schema({
  type: { type: String, enum: ['direct','groupe'], default: 'direct' },
  nom: String,
  membres: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  messages: [MessageSchema],
  dernier_message: Date,
  created_by: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

ConversationSchema.index({ membres: 1 });

module.exports = mongoose.model('Conversation', ConversationSchema);
