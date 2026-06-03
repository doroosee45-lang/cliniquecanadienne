// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');

// const UserSchema = new mongoose.Schema({
//   email: { type: String, required: [true, 'Email requis'], unique: true, lowercase: true, trim: true, match: [/\S+@\S+\.\S+/, 'Email invalide'] },
//   password: { type: String, required: [true, 'Mot de passe requis'], minlength: [6, 'Min 6 caractères'], select: false },
//   nom: { type: String, required: [true, 'Nom requis'], trim: true },
//   prenom: { type: String, required: [true, 'Prénom requis'], trim: true },
//   role: {
//     type: String,
//     enum: ['superadmin','adminclinique','medecin','infirmier','laborantin','radiologue','pharmacien','comptable','receptionniste','patient'],
//     required: true,
//   },
//   specialite: String,
//   telephone: String,
//   statut: { type: String, enum: ['actif','inactif','suspendu'], default: 'actif' },
//   avatar: String,
//   couleur_theme: { type: String, default: '#2563eb' },
//   derniere_connexion: Date,
//   must_change_password:   { type: Boolean, default: false },
//   reset_password_token:   { type: String },
//   reset_password_expire:  { type: Date },
//   preferences: mongoose.Schema.Types.Mixed,
// }, { timestamps: true });

// UserSchema.pre('save', async function(next) {
//   if (!this.isModified('password')) return next();
//   this.password = await bcrypt.hash(this.password, 12);
//   next();
// });

// UserSchema.methods.matchPassword = async function(entered) {
//   return bcrypt.compare(entered, this.password);
// };

// UserSchema.methods.getSignedJWT = function() {
//   return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
//     expiresIn: process.env.JWT_EXPIRE || '7d',
//   });
// };

// module.exports = mongoose.model('User', UserSchema);





const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  email: {
    type:     String,
    required: [true, 'Email requis'],
    unique:   true,
    lowercase: true,
    trim:     true,
    match:    [/\S+@\S+\.\S+/, 'Email invalide'],
  },
  // ✅ password optionnel pour les comptes Google (required retiré)
  password: {
    type:      String,
    minlength: [6, 'Min 6 caractères'],
    select:    false,
    // required retiré — null autorisé pour connexion Google
  },
  nom:    { type: String, required: [true, 'Nom requis'],    trim: true },
  prenom: { type: String, required: [true, 'Prénom requis'], trim: true },
  role: {
    type: String,
    enum: ['superadmin','adminclinique','medecin','infirmier','laborantin',
           'radiologue','pharmacien','comptable','receptionniste','patient'],
    required: true,
  },
  specialite:  String,
  telephone:   String,
  statut:      { type: String, enum: ['actif','inactif','suspendu'], default: 'actif' },
  avatar:      { type: String, default: '' },        // déjà présent ✅
  couleur_theme: { type: String, default: '#2563eb' },
  derniere_connexion: Date,
  must_change_password:  { type: Boolean, default: false },
  reset_password_token:  { type: String },
  reset_password_expire: { type: Date },
  preferences: mongoose.Schema.Types.Mixed,

  // ✅ Nouveau champ Google OAuth
  googleId: { type: String, default: null, sparse: true },

}, { timestamps: true });

// ── Hash password ─────────────────────────────────────────────────────────
// ✅ Guard : ignore si password absent (compte Google)
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Méthodes existantes conservées ───────────────────────────────────────
UserSchema.methods.matchPassword = async function(entered) {
  if (!this.password) return false; // compte Google sans mot de passe
  return bcrypt.compare(entered, this.password);
};

UserSchema.methods.getSignedJWT = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

module.exports = mongoose.model('User', UserSchema);