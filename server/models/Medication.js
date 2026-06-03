const mongoose = require('mongoose');

const MouvementSchema = new mongoose.Schema({
  type: { type: String, enum: ['entree','sortie','dispensation','retour','perte','peremption'] },
  quantite: Number,
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
}, { timestamps: true });

MedicationSchema.index({ nom_commercial: 'text', dci: 'text' });

module.exports = mongoose.model('Medication', MedicationSchema);
