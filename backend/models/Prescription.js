const mongoose = require('mongoose');
const { Schema } = mongoose;

const PrescriptionSchema = new Schema({
  numero_rx: { type: String, unique: true },
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  medecin: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  consultation: { type: Schema.Types.ObjectId, ref: 'Consultation' },
  date_prescription: { type: Date, default: Date.now },
  date_expiration: Date,
  // PRESC-01 (correction du 12 sept. 2026, audit indépendant) — le
  // formulaire "Nouvelle ordonnance" (Prescriptions.jsx) saisit réellement
  // ces valeurs mais aucune n'atteignait jamais MongoDB (aucun champ
  // n'existait ici) : poids/allergies vérifiées sont une photographie
  // clinique au moment de la prescription (même principe déjà établi par
  // LabResult/ImagingResult qui capturent patient_nom/dob au moment de
  // l'acte, jamais recalculés depuis Patient a posteriori) — utile même si
  // Patient.allergies change ensuite, car elle documente ce qui a été
  // effectivement vérifié par le prescripteur ce jour-là. chronique/
  // maladie_chronique alimentent réellement l'onglet "Traitements
  // chroniques" et kpis.chroniques (Prescriptions.jsx), qui affichaient déjà
  // ces concepts sans qu'aucune donnée réelle ne les nourrisse.
  poids_kg: Number,
  allergies_verifiees: [String],
  chronique: { type: Boolean, default: false },
  maladie_chronique: String,
  recommandations: String,
  lignes: [{
    medicament: { type: Schema.Types.ObjectId, ref: 'Medication' },
    medicament_nom: String,
    posologie: String,
    duree: String,
    quantite: Number,
    notes: String,
  }],
  statut: { type: String, enum: ['brouillon','active','publiee','dispensee','expiree','annulee'], default: 'brouillon' },
  dispensee_par: { type: Schema.Types.ObjectId, ref: 'User' },
  date_dispensation: Date,
  interactions_detectees: [{ medicaments: [String], risque: String, description: String }],
  // Champs publication (visible par le patient après publication)
  publie_at:        { type: Date },
  publie_par:       { type: Schema.Types.ObjectId, ref: 'User' },
  email_patient_envoye: { type: Boolean, default: false },
  notif_patient_envoyee: { type: Boolean, default: false },
  // Correction 2 (relecture du 6 sept. 2026, FE-BUG-004) — "Note de
  // renouvellement" et "Motif d'annulation" (Prescriptions.jsx) étaient
  // saisis puis jamais envoyés au serveur (renewOrd/cancelOrd postaient
  // sans body utile) : aucun champ n'existait même ici pour les recevoir.
  note_renouvellement: String,
  motif_annulation:    String,
}, { timestamps: true });

PrescriptionSchema.pre('save', async function(next) {
  if (this.isNew) {
    const { nextSequence } = require('../utils/counter');
    const year = new Date().getFullYear();
    const seq = await nextSequence(`prescription-${year}`);
    this.numero_rx = `RX-${year}-${String(seq).padStart(5, '0')}`;
    // Correction 2 (relecture du 6 sept. 2026) — écrasait inconditionnellement
    // date_expiration, y compris quand renouveler() la posait déjà depuis la
    // "Nouvelle date d'expiration" choisie par l'utilisateur (même bug déjà
    // corrigé sur Invoice.date_echeance, balayage T5.2) : +30 jours reste le
    // défaut légitime quand rien n'est fourni, mais seulement dans ce cas.
    if (!this.date_expiration) this.date_expiration = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  next();
});

// T9.8 — numero_rx (unique, auto) était le seul index avant ce correctif
// (constaté en T2.4) ; patient/statut/medecin sont très filtrés (pharmacie,
// dashboard) sans en bénéficier.
PrescriptionSchema.index({ patient: 1, date_prescription: -1 });
PrescriptionSchema.index({ statut: 1, date_prescription: -1 });
PrescriptionSchema.index({ medecin: 1 });

module.exports = mongoose.model('Prescription', PrescriptionSchema);
