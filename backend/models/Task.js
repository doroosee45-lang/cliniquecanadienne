const mongoose = require('mongoose');

// AUDIT-11-8 — Administration.jsx (saveTask) n'avait aucune route backend :
// POST /admin/tasks fabriquait systématiquement un enregistrement local
// (faux succès), jamais persisté. Plan validé avec l'utilisateur avant code.
// assignee est une vraie référence ObjectId (populée à la lecture), jamais
// une chaîne de nom affiché — même principe que Prescription.medecin/
// Appointment.medecin, pour ne pas reproduire le problème texte-libre-vs-
// référence déjà signalé ailleurs (User.service/Staff.service).
const TaskSchema = new mongoose.Schema({
  titre: { type: String, required: true },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  priorite: { type: String, enum: ['haute', 'normale', 'basse'], default: 'normale' },
  categorie: { type: String, enum: ['administratif', 'maintenance', 'formation', 'financier', 'rh', 'medical'], default: 'administratif' },
  statut: { type: String, enum: ['en_attente', 'en_cours', 'termine', 'annule'], default: 'en_attente' },
  echeance: Date,
  description: String,
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Task', TaskSchema);
