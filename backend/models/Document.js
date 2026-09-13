const mongoose = require('mongoose');
const { Schema } = mongoose;

const DocumentSchema = new Schema({
  nom: { type: String, required: true },
  type: { type: String, enum: ['dossier_medical','ordonnance','resultat_labo','imagerie','facture','rapport','certificat','autre'] },
  fichier_path: String,
  // SEC-DOC-01 (audit métier du 13 sept. 2026, Phase 4) — fichier_path
  // stockait l'URL Cloudinary signée telle quelle, valide indéfiniment
  // (sign_url:true sans expires_at, cf. utils/cloudinary.js) : une fois
  // obtenue, l'URL reste utilisable pour toujours, même après révocation
  // d'un accès. cloudinary_public_id (+ le format/resource_type/version
  // nécessaires pour recalculer la même signature) permet désormais de
  // régénérer une URL signée à COURTE durée de vie à chaque lecture
  // autorisée, plutôt que de resservir indéfiniment celle figée à l'upload.
  // Absent (undefined) pour un document en repli disque local (public_id
  // n'existe pas hors Cloudinary) ou déposé avant ce correctif — ces cas
  // continuent d'utiliser fichier_path tel quel, comportement inchangé.
  cloudinary_public_id: String,
  cloudinary_resource_type: String,
  cloudinary_format: String,
  cloudinary_version: Number,
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
