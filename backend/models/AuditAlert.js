// Sous-phase 5.7 — les actions "Enquêter"/"Clôturer"/"Créer alerte" de
// Audit.jsx ne persistaient jamais rien : getSuspects() (audit.controller.js)
// recalcule à chaque appel un tableau de suspects entièrement SYNTHÉTIQUE
// depuis AuditLog (_id: `brute_${ip}` / `denied_${userId}`, jamais un
// document réel) — muter le statut d'un de ces objets côté client n'avait
// donc aucun effet réel, et "Créer alerte" poussait un objet local qui
// n'existait plus au rechargement. Ce modèle stocke réellement :
// - un overlay de statut pour un suspect calculé (alert_id renseigné,
//   correspond à l'_id synthétique de getSuspects()) ;
// - une alerte créée manuellement par un membre du personnel
//   (alert_id absent, source:'manuel').
const mongoose = require('mongoose');
const { Schema } = mongoose;

const AuditAlertSchema = new Schema({
  alert_id: { type: String, unique: true, sparse: true },
  type: String,
  utilisateur: String,
  description: String,
  severite: { type: String, enum: ['eleve', 'critique'], default: 'eleve' },
  statut: { type: String, enum: ['ouvert', 'en_enquete', 'cloture'], default: 'ouvert' },
  source: { type: String, enum: ['auto', 'manuel'], default: 'manuel' },
  cree_par: { type: Schema.Types.ObjectId, ref: 'User' },
  date_evenement: Date,
}, { timestamps: true });

module.exports = mongoose.model('AuditAlert', AuditAlertSchema);
