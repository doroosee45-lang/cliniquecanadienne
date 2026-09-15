const mongoose = require('mongoose');

const MouvementSchema = new mongoose.Schema({
  type: { type: String, enum: ['entree','sortie','dispensation','retour','perte','peremption','vente'] },
  quantite: Number,
  // Sous-phase 5.1 (relecture du 6 sept. 2026) — pharmacy.controller.js::
  // createVente décrémentait le stock mais ne posait jusqu'ici aucun
  // mouvement pour la vente réussie (seul le rollback en cas d'échec partiel
  // en posait un, type:'retour') : aucune trace persistée du montant réel
  // vendu, rendant "ventes_jour"/"ventes_mois" impossibles à calculer
  // honnêtement. `montant` capture le CFA réel de la ligne vendue.
  montant: Number,
  date: { type: Date, default: Date.now },
  reference: String,
  utilisateur: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: String,
}, { _id: false });

const MedicationSchema = new mongoose.Schema({
  nom_commercial: { type: String, required: true },
  dci: String,
  forme: { type: String, enum: ['comprime','gelule','sirop','injectable','pommade','autre'] },
  dosage: String,
  presentation: String,
  categorie: String,
  fabricant: String,
  numero_lot: String,
  stock_actuel: { type: Number, default: 0, min: 0 },
  stock_minimum: { type: Number, default: 10 },
  seuil_alerte: { type: Number, default: 20 },
  prix_achat: { type: Number, default: 0 },
  prix_vente: { type: Number, default: 0 },
  date_peremption: Date,
  statut: { type: String, enum: ['disponible','rupture','suspendu','perime'], default: 'disponible' },
  mouvements: [MouvementSchema],
  interactions: [String],
  ordonnance_requise: { type: Boolean, default: false },
  photo:              { type: String,  default: null },
  // POST5-004 (audit indépendant post-Phase 5, 14 sept. 2026) — même
  // traitement que Patient.photo_public_id/resource_type/format/version :
  // permet de régénérer une URL Cloudinary signée à courte durée de vie à
  // chaque lecture autorisée, au lieu de resservir indéfiniment l'URL
  // signée sans expiration stockée dans `photo`.
  photo_public_id:    { type: String, default: null },
  photo_resource_type:{ type: String, default: null },
  photo_format:       { type: String, default: null },
  photo_version:      { type: Number, default: null },
}, { timestamps: true });

MedicationSchema.index({ nom_commercial: 'text', dci: 'text' });

module.exports = mongoose.model('Medication', MedicationSchema);
