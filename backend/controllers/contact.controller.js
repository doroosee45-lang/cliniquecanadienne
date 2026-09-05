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
