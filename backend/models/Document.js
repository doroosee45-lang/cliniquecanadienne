const mongoose = require('mongoose');
const { Schema } = mongoose;

const DocumentSchema = new Schema({
  nom: { type: String, required: true },
  type: { type: String, enum: ['dossier_medical','ordonnance','resultat_labo','imagerie','facture','rapport','certificat','autre'] },
  fichier_path: String,
  taille: Number,
  mime_type: String,
  patient: { type: Schema.Types.ObjectId, ref: 'Patient' },
  created_by: { type: Schema.Types.ObjectId, ref: 'User' },
  lifecycle_statut: {
    type: String,
    enum: ['actif','archive_chaud','archive_froid','purge_planifiee'],
    default: 'actif',
  },
  date_archivage: Date,
  date_purge_planifiee: Date,
  hash_integrite: String,
  version: { type: Number, default: 1 },
  commentaire: String,
  tags: [String],
}, { timestamps: true });

DocumentSchema.index({ lifecycle_statut: 1 });
DocumentSchema.index({ patient: 1 });

module.exports = mongoose.model('Document', DocumentSchema);
