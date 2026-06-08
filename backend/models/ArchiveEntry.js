const mongoose = require('mongoose');
const { Schema } = mongoose;

const ArchiveEntrySchema = new Schema({
  titre:        { type: String, required: true },
  description:  String,
  categorie:    {
    type: String,
    enum: ['patient','consultation','laboratoire','imagerie','hospitalisation','chirurgie','financier','document'],
    required: true,
  },
  source_model: String,
  source_id:    { type: Schema.Types.ObjectId },
  patient:      { type: Schema.Types.ObjectId, ref: 'Patient' },
  patient_nom:  String,
  statut:       { type: String, enum: ['archive','restauré','purge_planifiee'], default: 'archive' },
  date_archivage:  { type: Date, default: Date.now },
  date_expiration: Date,
  taille:       { type: String, default: '—' },
  priorite:     { type: String, enum: ['basse','normale','haute'], default: 'normale' },
  tags:         [String],
  archive_par:  { type: Schema.Types.ObjectId, ref: 'User' },
  restaure_par: { type: Schema.Types.ObjectId, ref: 'User' },
  restaure_at:  Date,
  motif_restauration: String,
  contenu:      mongoose.Schema.Types.Mixed,
}, { timestamps: true });

ArchiveEntrySchema.index({ categorie: 1, statut: 1 });
ArchiveEntrySchema.index({ patient: 1 });
ArchiveEntrySchema.index({ source_id: 1, source_model: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('ArchiveEntry', ArchiveEntrySchema);
