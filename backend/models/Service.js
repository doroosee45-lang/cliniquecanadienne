const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  code: { type: String, unique: true, sparse: true },
  description: String,
  etage: Number,
  couleur: { type: String, default: '#2563eb' },
  chef_service: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  statut: { type: String, enum: ['actif','ferme'], default: 'actif' },
}, { timestamps: true });

module.exports = mongoose.model('Service', ServiceSchema);
