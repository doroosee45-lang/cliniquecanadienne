const mongoose = require('mongoose');
const { Schema } = mongoose;

const AppointmentSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  medecin: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  service: { type: Schema.Types.ObjectId, ref: 'Service' },
  date_heure: { type: Date, required: true },
  duree_minutes: { type: Number, default: 30 },
  type: { type: String, enum: ['consultation','suivi','urgence','bilan','examen'], default: 'consultation' },
  motif: { type: String, required: true },
  statut: {
    type: String,
    enum: ['planifie','en_attente','confirme','arrive','en_consultation','en_cours','termine','reporte','annule','absent'],
    default: 'planifie',
  },
  notes: String,
  // Suite du balayage T5.2 — Appointments.jsx envoie ce champ (affiché dans
  // la liste des RDV et le détail) depuis toujours, mais il n'était jamais
  // déclaré ici : silencieusement supprimé par Mongoose à chaque création.
  salle: String,
  // Corrections rendez-vous — le formulaire "Reporter" (Appointments.jsx)
  // envoie ce champ depuis toujours, jamais déclaré ici : même bug que
  // salle ci-dessus, silencieusement supprimé par Mongoose à chaque report.
  motif_report: String,
  rappels_envoyes: { type: Number, default: 0 },
  created_by: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

AppointmentSchema.index({ date_heure: 1, medecin: 1 });
AppointmentSchema.index({ patient: 1 });

// AUDIT-2.1 — utils/helpers.js::checkAppointmentConflict vérifie l'absence
// de conflit AVANT l'écriture, mais rien n'empêchait deux requêtes
// concurrentes de lire toutes deux "aucun conflit" avant que l'une n'ait
// écrit (double réservation silencieuse du même créneau). Cet index unique
// ferme la course pour le cas exact (même médecin, même date_heure à la
// milliseconde) : MongoDB rejette la seconde écriture concurrente en erreur
// E11000, remontée en 409 par les contrôleurs. Ne couvre pas un chevauchement
// partiel décalé (ex. 10h00-10h30 vs 10h15-10h45) — un index unique ne peut
// exprimer qu'une égalité exacte, pas un recouvrement de plage ; la
// vérification applicative existante reste la protection principale pour ce
// cas, cet index n'est qu'un filet de sécurité pour la course sur le créneau
// identique. partialFilterExpression n'accepte pas $nin/$ne (vérifié
// empiriquement contre MongoDB 8.0) : la liste ci-dessous est donc l'énumération
// positive et volontairement explicite du complément exact de ['annule','absent']
// dans Appointment.statut — à maintenir en synchronisation avec l'enum du schéma
// ci-dessus si celui-ci change.
AppointmentSchema.index(
  { medecin: 1, date_heure: 1 },
  {
    unique: true,
    partialFilterExpression: {
      statut: { $in: ['planifie','en_attente','confirme','arrive','en_consultation','en_cours','termine','reporte'] },
    },
  }
);

module.exports = mongoose.model('Appointment', AppointmentSchema);
