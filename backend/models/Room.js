const mongoose = require('mongoose');
const { Schema } = mongoose;

const BedSchema = new Schema({
  numero: { type: String, required: true },
  type: { type: String, enum: ['standard','vip','reanimation','pediatrique','maternite'], default: 'standard' },
  statut: { type: String, enum: ['libre','occupe','maintenance','reserve'], default: 'libre' },
  prix_par_jour: { type: Number, default: 0 },
  equipements: [String],
  patient_actuel: { type: Schema.Types.ObjectId, ref: 'Patient' },
});

const RoomSchema = new Schema({
  numero: { type: String, required: true },
  service: { type: Schema.Types.ObjectId, ref: 'Service' },
  type: { type: String, enum: ['commune','privee','vip','reanimation','pediatrie','maternite'] },
  etage: { type: Number, default: 1 },
  capacite: { type: Number, default: 2 },
  lits: [BedSchema],
  statut: { type: String, enum: ['actif','maintenance','ferme'], default: 'actif' },
}, { timestamps: true });

module.exports = mongoose.model('Room', RoomSchema);
