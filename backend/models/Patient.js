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
  // MIGRATION-CLOUDINARY (13 sept. 2026) — public_id Cloudinary de `photo`
  // quand elle y est hébergée (null en repli disque local, ou pour une
  // photo antérieure à cette migration jamais re-uploadée) : nécessaire
  // pour supprimer réellement l'ancien asset Cloudinary lors d'un
  // remplacement (patients.controller.js::uploadPhoto), même comportement
  // que la suppression disque déjà existante avant cette migration.
  photo_public_id: { type: String, default: null },
  // POST5-004 (audit indépendant post-Phase 5, 14 sept. 2026) — SEC-DOC-01
  // (re-signature à courte durée de vie à chaque lecture autorisée) n'avait
  // été appliqué qu'à Document ; `photo` stockait l'URL Cloudinary signée
  // SANS expires_at (utils/cloudinary.js::uploadBuffer), valide et
  // partageable indéfiniment une fois obtenue. Ces 3 champs permettent de
  // régénérer une URL signée éphémère à chaque lecture autorisée
  // (getSignedDeliveryUrl), exactement comme document.controller.js —
  // jamais une nouvelle info persistée à des fins de duplication.
  photo_resource_type: { type: String, default: null },
  photo_format:        { type: String, default: null },
  photo_version:       { type: Number, default: null },
  // Suite du balayage T5.2 — Patients.jsx collecte ces deux champs depuis
  // toujours et les affiche sur la fiche patient, mais ni l'un ni l'autre
  // n'était déclaré ici : silencieusement supprimés par Mongoose à chaque
  // création (la fiche affichait "—" quoi que le personnel ait saisi).
  nationalite: { type: String, trim: true },
  situation_mat: { type: String, trim: true },
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
  // AUDIT-P2-2 — jamais déclaré ici alors que Patients.jsx le lit à 6
  // endroits (stats "chroniques", badges liste/détail) : le champ était
  // systématiquement absent des documents (silencieusement rejeté par
  // Mongoose en mode strict), rendant ces lectures inertes.
  maladies_chroniques: [String],
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
  // T9.13 — anonymisation (alternative à la suppression physique, voir
  // utils/patientAnonymization.js). anonymise_par n'est pas required : le
  // champ n'est renseigné que par le seul chemin qui pose anonymise:true.
  anonymise: { type: Boolean, default: false },
  anonymise_at: Date,
  anonymise_par: { type: Schema.Types.ObjectId, ref: 'User' },
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

  // DB-001 (audit métier du 13 sept. 2026, Phase 4) — ce hook ne bloquait
  // jusqu'ici que sur un compte User actif encore lié ; patients.
  // controller.js::remove() vérifie séparément, lui, un historique clinique/
  // financier réel (CASCADE_TARGETS) avant d'autoriser une suppression
  // physique — mais cette vérification vivait UNIQUEMENT dans ce contrôleur.
  // Tout autre appelant de Patient.findByIdAndDelete()/findOneAndDelete()
  // (script, migration, nettoyage de test, futur contrôleur) contournait
  // donc entièrement cette protection, laissant des Appointment/
  // Consultation/Prescription/LabResult/ImagingResult/Invoice orphelins —
  // constaté réellement en base sur des résidus de tests automatisés.
  // Déplacée ici (source unique, CASCADE_TARGETS déjà l'inventaire le plus
  // complet du projet), la garde s'applique désormais quel que soit
  // l'appelant. Require paresseux (comme User ci-dessus) : patientAnonymization.js
  // require('../models/Patient') à son propre chargement — un require en
  // tête de ce fichier créerait un cycle.
  const { CASCADE_TARGETS } = require('../utils/patientAnonymization');
  const counts = await Promise.all(
    CASCADE_TARGETS.map(({ model, refField }) => model.countDocuments({ [refField]: target._id }))
  );
  if (counts.some(n => n > 0)) {
    const err = new Error('Impossible de supprimer ce dossier : un historique clinique ou financier réel y fait encore référence. Utilisez la désactivation ou l\'anonymisation plutôt que la suppression physique.');
    err.statusCode = 409;
    return next(err);
  }
  next();
});

PatientSchema.index({ nom: 'text', prenom: 'text', numero_dossier: 'text', telephone: 'text' });
// T9.8 — email très sollicité (recherche portail, migration T2.2) sans index
// dédié (constaté en T2.4). Non unique (partagé possible entre membres d'une
// famille) et sparse (non requis, cf. T3.1 comptes auto-inscrits).
PatientSchema.index({ email: 1 }, { sparse: true });

module.exports = mongoose.model('Patient', PatientSchema);
