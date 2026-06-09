const mongoose = require('mongoose');

const MissionSchema = new mongoose.Schema({
  destination:    { type: String },
  motif_mission:  { type: String },
  heure_depart:   { type: String },
  heure_retour:   { type: String },
  eta:            { type: String },
  date:           { type: Date, default: Date.now },
}, { _id: true });

const AmbulanceSchema = new mongoose.Schema({
  numero:      { type: String, required: true, unique: true },
  conducteur:  { type: String },
  statut: {
    type: String,
    enum: ['disponible','en_route','occupe','maintenance'],
    default: 'disponible',
  },
  destination: { type: String },
  position:    { type: String },
  heure_depart:{ type: String },
  eta:         { type: String },
  missions:    [MissionSchema],
}, { timestamps: true });

module.exports = mongoose.model('Ambulance', AmbulanceSchema);
