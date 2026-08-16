const mongoose = require('mongoose');
const { Schema } = mongoose;

const AssuranceSchema = new Schema({
  compagnie: String,
  numero_police: String,
  taux: { type: Number, default: 0 },
}, { _id: false });

const PatientSchema = new Schema({
  numero_dossier: { type: String, unique: true },
  nom: { type: String, required: true, trim: true },
  prenom: { type: String, required: true, trim: true },
  // T3.1 — un dossier créé automatiquement à l'inscription Google n'a ni
  // date de naissance ni sexe (Google ne les fournit pas) : plutôt que
  // d'inventer une valeur clinique, ces deux champs deviennent optionnels
  // uniquement quand profil_a_completer est vrai. La création normale
  // (réceptionniste, admin) reste inchangée : les deux restent obligatoires.
  date_naissance: { type: Date, required: function () { return !this.profil_a_completer; } },
  sexe: { type: String, enum: ['M', 'F'], required: function () { return !this.profil_a_completer; } },
  profil_a_completer: { type: Boolean, default: false },
  telephone: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  photo: { type: String },
  adresse: {
    rue: String,
    ville: String,
    pays: { type: String, default: 'Congo' },
    code_postal: String,
  },
  groupe_sanguin: { type: String, enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-','?'] },
  allergies: [String],
  antecedents_medicaux: [String],
  antecedents_familiaux: [String],
  medecin_referent: { type: Schema.Types.ObjectId, ref: 'User' },
  // Max 2 assurances
  assurances: {
    type: [AssuranceSchema],
    validate: {
      validator: (v) => v.length <= 2,
      message: 'Maximum 2 assurances autorisées.',
    },
    default: [],
  },
  contact_urgence: {
    nom: String,
    relation: String,
    telephone: String,
  },
  statut: { type: String, enum: ['actif', 'inactif', 'decede'], default: 'actif' },
  // Compte patient : false = en attente d'activation via lien email
  actif: { type: Boolean, default: false },
  token_activation: String,
  token_activation_expire: Date,
  cree_par: { type: Schema.Types.ObjectId, ref: 'User' },
  ip_creation: String,
  notes: String,
}, { timestamps: true });

PatientSchema.pre('save', async function (next) {
  if (this.isNew) {
    const { nextSequence } = require('../utils/counter');
    const year = new Date().getFullYear();
    const seq = await nextSequence(`patient-${year}`);
    this.numero_dossier = `CLIN-${year}-${String(seq).padStart(5, '0')}`;
  }
  next();
});

// Ticket 0008 — trois comptes User réels sont restés orphelins après la
// suppression de leur dossier Patient lié (patient.email ne correspondant
// plus exactement à celui du User au moment de la suppression, donc le
// nettoyage du compte lié dans patients.controller.js::remove() a
// silencieusement matché zéro document). Contrainte structurelle plutôt
// qu'une simple vérification dans ce seul contrôleur : ce hook s'applique à
// tout appel de Patient.findByIdAndDelete (findOneAndDelete en interne),
// quel que soit l'appelant, pas seulement remove(). Ne couvre pas
// deleteMany volontairement — utils/seed.js s'en sert pour réinitialiser
// toute la base et doit rester libre de le faire.
PatientSchema.pre('findOneAndDelete', async function (next) {
  const target = await this.model.findOne(this.getFilter()).select('_id');
  if (!target) return next();

  const User = require('./User');
  const linkedActiveUser = await User.findOne({ patient_id: target._id, role: 'patient', statut: 'actif' }).select('email');
  if (linkedActiveUser) {
    const err = new Error(`Impossible de supprimer ce dossier : le compte portail actif ${linkedActiveUser.email} le référence encore par patient_id.`);
    err.statusCode = 409;
    return next(err);
  }
  next();
});

PatientSchema.index({ nom: 'text', prenom: 'text', numero_dossier: 'text', telephone: 'text' });

module.exports = mongoose.model('Patient', PatientSchema);
