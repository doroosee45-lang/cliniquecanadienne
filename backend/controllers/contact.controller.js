const ContactMessage = require('../models/ContactMessage');
const { logAction } = require('../utils/helpers');

// POST /contact — public, non authentifié (formulaire de la page d'accueil).
exports.create = async (req, res, next) => {
  try {
    const { nom, tel, email, sujet, message } = req.body || {};
    if (!nom || !String(nom).trim() || !email || !String(email).trim() || !message || !String(message).trim()) {
      return res.status(400).json({ success: false, message: 'Nom, email et message sont obligatoires.' });
    }
    const contact = await ContactMessage.create({ nom, tel, email, sujet, message });
    await logAction({ module: 'contact', action: 'CREATE', entite_id: contact._id, ip: req.ip, message: `Nouveau message de contact public — ${contact.nom} (${contact.email})` });
    res.status(201).json({ success: true, id: contact._id });
  } catch (err) { next(err); }
};

// Correction 5 — le formulaire de contact public fonctionne et persiste
// réellement (Correction 9/FE-BUG-011) depuis Sous-phase 4, mais aucune
// interface n'existait pour qu'un membre du personnel consulte les
// messages reçus : fonctionnel techniquement, inutile en pratique.

// GET /contact — admin/réception uniquement (personnel, pas le public).
exports.getAll = async (req, res, next) => {
  try {
    const { traite } = req.query;
    const filter = {};
    if (traite === 'true') filter.traite = true;
    if (traite === 'false') filter.traite = false;
    const messages = await ContactMessage.find(filter).sort('-createdAt').lean();
    res.json({ success: true, messages, total: messages.length });
  } catch (err) { next(err); }
};

// PUT /contact/:id — marquer/démarquer un message comme traité.
exports.markTraite = async (req, res, next) => {
  try {
    const { traite } = req.body;
    if (typeof traite !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Le champ "traite" (booléen) est obligatoire.' });
    }
    const avant = await ContactMessage.findById(req.params.id).lean();
    if (!avant) return res.status(404).json({ success: false, message: 'Message introuvable.' });
    const contact = await ContactMessage.findByIdAndUpdate(req.params.id, { traite }, { new: true });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'contact', entite_id: contact._id, ip: req.ip, message: `Message de contact (${contact.nom}) marqué ${traite ? 'traité' : 'non traité'}`, avant, apres: contact });
    res.json({ success: true, message: contact });
  } catch (err) { next(err); }
};
