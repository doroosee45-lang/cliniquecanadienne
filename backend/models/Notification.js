const mongoose = require('mongoose');
const { Schema } = mongoose;

const NotificationSchema = new Schema({
  destinataire: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['info','warning','critical','success','ai_alert','rappel'], default: 'info' },
  titre: { type: String, required: true },
  message: { type: String, required: true },
  lien: String,
  lu: { type: Boolean, default: false },
  lu_at: Date,
  priorite: { type: String, enum: ['basse','normale','haute','critique'], default: 'normale' },
}, { timestamps: true });

NotificationSchema.index({ destinataire: 1, lu: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);
