const mongoose = require('mongoose');
const { Schema } = mongoose;

// Correction 9 (relecture du 6 sept. 2026, FE-BUG-011) — le formulaire de
// contact public (home.jsx) capturait déjà nom/tel/email/sujet/message dans
// un state contrôlé, mais le bouton "Envoyer le message" n'avait aucun
// onSubmit/onClick : rien n'était jamais transmis. Stockage minimal choisi
// plutôt qu'un envoi email — aucune adresse de contact clinique réelle
// n'est configurée dans ce système (seuls SMTP_USER/SMTP_FROM existent,
// destinés à l'expéditeur des emails automatiques, pas à une boîte de
// réception du personnel) : inventer un destinataire aurait été une
// donnée fabriquée, explicitement exclu par ce chantier.
const ContactMessageSchema = new Schema({
  nom:     { type: String, required: true, trim: true, maxlength: 200 },
  tel:     { type: String, trim: true, maxlength: 40 },
  email:   { type: String, required: true, trim: true, maxlength: 200 },
  sujet:   { type: String, trim: true, maxlength: 200 },
  message: { type: String, required: true, trim: true, maxlength: 4000 },
  traite:  { type: Boolean, default: false },
}, { timestamps: true });

ContactMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ContactMessage', ContactMessageSchema);
