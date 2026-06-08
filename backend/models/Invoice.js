const mongoose = require('mongoose');
const { Schema } = mongoose;

const PaiementSchema = new Schema({
  date: { type: Date, default: Date.now },
  montant: { type: Number, required: true },
  mode: { type: String, enum: ['especes','carte','mobile_money','virement','cheque'] },
  reference: String,
  enregistre_par: { type: Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const InvoiceSchema = new Schema({
  numero_facture: { type: String, unique: true },
  patient:        { type: Schema.Types.ObjectId, ref: 'Patient' },
  patient_nom:    String,
  service_label:  String,
  montant_direct: Number,
  created_by:     { type: Schema.Types.ObjectId, ref: 'User' },
  date_facture: { type: Date, default: Date.now },
  date_echeance: Date,
  lignes: [{
    libelle: String,
    categorie: { type: String, enum: ['consultation','hospitalisation','laboratoire','imagerie','pharmacie','autre'] },
    prix_unitaire: Number,
    quantite: { type: Number, default: 1 },
    montant: Number,
  }],
  montant_ht: { type: Number, default: 0 },
  tva: { type: Number, default: 0 },
  montant_ttc: { type: Number, default: 0 },
  montant_paye: { type: Number, default: 0 },
  montant_restant: { type: Number, default: 0 },
  assurance_taux: { type: Number, default: 0 },
  montant_assurance: { type: Number, default: 0 },
  statut: { type: String, enum: ['brouillon','emise','partiellement_payee','payee','annulee','contentieux'], default: 'emise' },
  paiements: [PaiementSchema],
  score_risque: { type: Number, default: 0, min: 0, max: 100 },
  notes: String,
}, { timestamps: true });

InvoiceSchema.pre('save', async function(next) {
  if (this.isNew) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Invoice').countDocuments();
    this.numero_facture = `INV-${year}-${String(count + 1).padStart(5, '0')}`;
    this.date_echeance = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  this.montant_paye = this.paiements.reduce((sum, p) => sum + p.montant, 0);
  this.montant_restant = this.montant_ttc - this.montant_paye;
  if (this.montant_restant <= 0) this.statut = 'payee';
  else if (this.montant_paye > 0) this.statut = 'partiellement_payee';
  next();
});

InvoiceSchema.index({ patient: 1, date_facture: -1 });
InvoiceSchema.index({ statut: 1 });

module.exports = mongoose.model('Invoice', InvoiceSchema);
