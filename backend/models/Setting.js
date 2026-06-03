const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
  cle: { type: String, required: true, unique: true },
  valeur: { type: mongoose.Schema.Types.Mixed },
  type: { type: String, enum: ['string','number','boolean','json','color'], default: 'string' },
  groupe: { type: String, enum: ['clinique','rappels','archivage','email','sms','ia','tarification','general'] },
  description: String,
  modifiable: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Setting', SettingSchema);
