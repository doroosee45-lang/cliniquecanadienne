const mongoose = require('mongoose');
const { Schema } = mongoose;

// Un bulletin par employé et par mois (mois au format 'YYYY-MM').
const SalaireSchema = new Schema({
  staff:          { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
  mois:           { type: String, required: true }, // 'YYYY-MM'
  base:           { type: Number, default: 0 },
  primes:         { type: Number, default: 0 },
  deductions:     { type: Number, default: 0 },
  net:            { type: Number, default: 0 },
  statut:         { type: String, enum: ['en_attente','paye'], default: 'en_attente' },
  date_paiement:  Date,
  paye_par:       { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

SalaireSchema.index({ staff: 1, mois: 1 }, { unique: true });

SalaireSchema.pre('save', function (next) {
  this.net = (this.base || 0) + (this.primes || 0) - (this.deductions || 0);
  next();
});

module.exports = mongoose.model('Salaire', SalaireSchema);
