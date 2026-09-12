const mongoose = require('mongoose');
const { Schema } = mongoose;

const PaiementSchema = new Schema({
  date: { type: Date, default: Date.now },
  montant: { type: Number, required: true, min: [0.01, 'Le montant d\'un paiement doit être positif.'] },
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
  // FLOW-002 (audit du 4 sept. 2026) — aucun contrôleur clinique ne créait
  // ni ne mettait à jour de Invoice : les onglets "Facturation" du frontend
  // calculaient un montant côté client, sans aucun lien traçable vers l'acte
  // à l'origine de la facture. Ces deux références (optionnelles — une
  // facture peut toujours être créée manuellement sans acte source, comme
  // aujourd'hui) permettent de retrouver la vraie facture liée à une
  // consultation/un séjour, et réciproquement.
  consultation:    { type: Schema.Types.ObjectId, ref: 'Consultation' },
  hospitalisation: { type: Schema.Types.ObjectId, ref: 'Hospitalization' },
  // Correction 5 (relecture du 5 sept. 2026) — même principe que
  // consultation/hospitalisation ci-dessus, généralisé plutôt que d'ajouter
  // un champ ObjectId dédié par module (laboratoire, imagerie, échographie,
  // urgences, chirurgie, bloc opératoire) : ce pattern scale correctement
  // au nombre de modules réellement concernés par ce chantier.
  source_module:   { type: String, enum: ['laboratoire','imagerie','echographie','urgences','chirurgie','blocoperatoire'] },
  source_id:       { type: Schema.Types.ObjectId },
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
    const { nextSequence } = require('../utils/counter');
    const year = new Date().getFullYear();
    const seq = await nextSequence(`invoice-${year}`);
    this.numero_facture = `INV-${year}-${String(seq).padStart(5, '0')}`;
    // Suite du balayage T5.2 — cette ligne écrasait inconditionnellement
    // date_echeance par "+30 jours" pour toute nouvelle facture, y compris
    // quand finance.controller.js::create l'avait déjà correctement posé
    // depuis le `echeance` envoyé par le formulaire (mapping en place,
    // vérifié) : l'échéance choisie par le personnel était donc toujours
    // silencieusement remplacée par le défaut à 30 jours. +30 jours reste le
    // défaut légitime quand rien n'est fourni, mais seulement dans ce cas.
    if (!this.date_echeance) this.date_echeance = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  this.montant_paye = this.paiements.reduce((sum, p) => sum + p.montant, 0);
  this.montant_restant = this.montant_ttc - this.montant_paye;
  if (this.montant_restant <= 0) this.statut = 'payee';
  else if (this.montant_paye > 0) this.statut = 'partiellement_payee';
  next();
});

InvoiceSchema.index({ patient: 1, date_facture: -1 });
InvoiceSchema.index({ statut: 1 });
InvoiceSchema.index({ source_module: 1, source_id: 1 });
// FACTURATION-CONSULTATION-001 (rapport de clôture du 11 sept. 2026) — une
// consultation ne doit jamais avoir plus d'une facture (consultations.
// controller.js::create ne devrait déjà en créer qu'une par conception,
// mais la garantie réelle contre un doublon — requête répétée, appel
// concurrent — doit vivre côté base, pas seulement dans la logique
// applicative). `sparse` : la plupart des factures (laboratoire, imagerie,
// création manuelle...) n'ont pas ce champ du tout, jamais en conflit entre
// elles.
InvoiceSchema.index({ consultation: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);
