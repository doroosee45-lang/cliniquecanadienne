const mongoose = require('mongoose');
const { Schema } = mongoose;

const RecurringProtocolSchema = new Schema({
  titre:       { type: String, required: true, trim: true },
  icon:        { type: String, default: '🔄' },
  couleur:     { type: String, default: '#1B4F9E' },
  medecin:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  frequence:   {
    type: String,
    enum: ['quotidien','hebdomadaire','bimensuel','mensuel','trimestriel','annuel','personnalise'],
    required: true,
  },
  // Valeur numérique pour "personnalise" (ex: 10 jours)
  frequence_jours: { type: Number },
  prochaine_date:  { type: Date, required: true },
  nb_patients:     { type: Number, default: 0 },
  notes:           { type: String },
  actif:           { type: Boolean, default: true },
  created_by:      { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('RecurringProtocol', RecurringProtocolSchema);
