const mongoose = require('mongoose');
const { Schema } = mongoose;

const AuditLogSchema = new Schema({
  utilisateur: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true }, // LOGIN, CREATE, UPDATE, DELETE, VALIDATE, DISPENSE, PAYMENT...
  module: { type: String, required: true },
  entite_id: String,
  ip_address: String,
  user_agent: String,
  donnees_avant: mongoose.Schema.Types.Mixed,
  donnees_apres: mongoose.Schema.Types.Mixed,
  message: String,
  statut: { type: String, enum: ['succes','echec'], default: 'succes' },
}, { timestamps: true });

AuditLogSchema.index({ utilisateur: 1, createdAt: -1 });
AuditLogSchema.index({ module: 1, action: 1 });
// T9.8 — les graphiques d'activité 7j/30j (audit.controller.js) filtrent sur
// createdAt seul ; le préfixe des deux index composés ci-dessus ne sert pas
// cette forme de requête (constaté en T2.4).
AuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
