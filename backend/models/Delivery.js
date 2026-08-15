const mongoose = require('mongoose');

const DeliverySchema = new mongoose.Schema({
  numero:            { type: String, unique: true, sparse: true },
  grossesse_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Pregnancy' },
  patient_id:        { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  patient_nom:       String,
  date_heure:        { type: Date, default: Date.now },
  type_accouchement: {
    type: String,
    enum: ['voie_basse', 'cesarienne', 'forceps', 'ventouse'],
    default: 'voie_basse',
  },
  terme:          Number,
  obstetricien:   String,
  sage_femme:     String,
  infirmier:      String,
  anesthesiste:   String,
  complications:  [String],
  duree_travail:  Number,  // minutes
  notes:          String,
  created_by:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

DeliverySchema.pre('save', async function (next) {
  if (!this.numero) {
    const { nextSequence } = require('../utils/counter');
    const year = new Date().getFullYear();
    const seq = await nextSequence(`delivery-${year}`);
    this.numero = `ACC-${year}-${String(seq).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Delivery', DeliverySchema);
