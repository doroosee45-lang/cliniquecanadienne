const mongoose = require('mongoose');
const { Schema } = mongoose;

const StaffSchema = new Schema({
  utilisateur:    { type: Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true },
  // Champs employé directs (utilisés quand utilisateur n'est pas lié)
  prenom:         String,
  nom:            String,
  email:          { type: String, lowercase: true, trim: true },
  telephone:      String,
  sexe:           { type: String, enum: ['homme', 'femme', 'autre'] },
  date_naissance: Date,
  nationalite:    String,
  departement:    String,
  adresse:        String,
  note_eval:      { type: Number, default: 0 },
  absences_mois:  { type: Number, default: 0 },
  matricule:      { type: String, unique: true, sparse: true },
  poste:          { type: String, required: true },
  service:        String,
  date_embauche:  Date,
  type_contrat:   { type: String, enum: ['cdi','cdd','stage','vacataire'] },
  salaire_base:   Number,
  conges_restants:{ type: Number, default: 20 },
  // AUDIT-RH-PLANNING-NOTIF — statut brouillon/publie ajouté pour distinguer
  // un créneau juste créé (pas encore notifié) d'un créneau réellement
  // communiqué à l'employé. notifie_publication/rappel_2h_envoye sont des
  // garde-fous d'idempotence par créneau (jamais par employé — un employé
  // publié avec plusieurs créneaux reçoit une notification par créneau, pas
  // une notification consolidée), même principe que Appointment.rappels_envoyes.
  planning: [{
    date: Date,
    heure_debut: String,
    heure_fin: String,
    type: { type: String, enum: ['travail','garde','astreinte','repos','conge'] },
    statut: { type: String, enum: ['brouillon','publie'], default: 'brouillon' },
    notifie_publication: { type: Boolean, default: false },
    rappel_2h_envoye: { type: Boolean, default: false },
  }],
  conges: [{
    type: { type: String, enum: ['annuel','maladie','maternite','paternite','exceptionnel','sans_solde'] },
    date_debut: Date,
    date_fin: Date,
    nb_jours: Number,
    motif: String,
    statut: { type: String, enum: ['en_attente','approuve','refuse'], default: 'en_attente' },
    approuve_par: { type: Schema.Types.ObjectId, ref: 'User' },
  }],
  competences: [String],
  statut: { type: String, enum: ['actif','inactif','conge','absent'], default: 'actif' },
}, { timestamps: true });

StaffSchema.pre('save', async function(next) {
  if (this.isNew && !this.matricule) {
    const { nextSequence } = require('../utils/counter');
    const seq = await nextSequence('staff');
    this.matricule = `STAF-${String(seq).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Staff', StaffSchema);
