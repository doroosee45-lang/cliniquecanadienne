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
  planning: [{
    date: Date,
    heure_debut: String,
    heure_fin: String,
    type: { type: String, enum: ['travail','garde','astreinte','repos','conge'] },
  }],
  conges: [{
    type_conge: { type: String, enum: ['annuel','maladie','maternite','sans_solde'] },
    date_debut: Date,
    date_fin: Date,
    statut: { type: String, enum: ['demande','approuve','refuse'] },
    approuve_par: { type: Schema.Types.ObjectId, ref: 'User' },
  }],
  competences: [String],
  statut: { type: String, enum: ['actif','inactif','conge','absent'], default: 'actif' },
}, { timestamps: true });

StaffSchema.pre('save', async function(next) {
  if (this.isNew && !this.matricule) {
    const count = await mongoose.model('Staff').countDocuments();
    this.matricule = `STAF-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Staff', StaffSchema);
