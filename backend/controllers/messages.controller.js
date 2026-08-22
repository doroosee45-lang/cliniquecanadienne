const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { emitTo } = require('../utils/socket');
const { logAction } = require('../utils/helpers');

// AUDIT-MESSAGES-PhaseA — la modale "Nouveau message" appelait GET
// /admin/users (authorize(superadmin, adminclinique)) pour peupler la liste
// de destinataires, alors que POST /messages (getOrCreate) n'a lui-même
// aucune restriction de rôle. Résultat : un médecin/infirmier/pharmacien/
// laborantin/radiologue/sage_femme/réceptionniste ne pouvait démarrer aucune
// conversation (403, liste vide) — confirmé en direct. Annuaire minimal,
// protect seul, projection volontairement restreinte (identité + service,
// jamais statut/permissions/tokens), sans les patients (annuaire "collègues").
exports.getDirectory = async (req, res, next) => {
  try {
    const users = await User.find({ role: { $ne: 'patient' }, statut: 'actif', _id: { $ne: req.user._id } })
      .select('nom prenom role avatar service')
      .sort('role nom');
    res.json({ success: true, users });
  } catch (err) { next(err); }
};

exports.getConversations = async (req, res, next) => {
  try {
    const convs = await Conversation.find({ membres: req.user._id })
      .populate('membres', 'nom prenom role avatar')
      .sort('-dernier_message');
    res.json({ success: true, conversations: convs });
  } catch (err) { next(err); }
};

exports.getOrCreate = async (req, res, next) => {
  try {
    const { userId } = req.body;
    let conv = await Conversation.findOne({
      type: 'direct',
      membres: { $all: [req.user._id, userId], $size: 2 },
    }).populate('membres', 'nom prenom role avatar');

    if (!conv) {
      conv = await Conversation.create({ type: 'direct', membres: [req.user._id, userId], created_by: req.user._id });
      await conv.populate('membres', 'nom prenom role avatar');
      await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'messages', entite_id: conv._id, ip: req.ip, message: `Nouvelle conversation avec ${userId}` });
    }
    res.json({ success: true, conversation: conv });
  } catch (err) { next(err); }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { contenu } = req.body;
    const conv = await Conversation.findOne({ _id: req.params.id, membres: req.user._id });
    if (!conv) return res.status(403).json({ success: false, message: 'Accès refusé.' });

    const msg = { expediteur: req.user._id, contenu, lu_par: [req.user._id] };
    conv.messages.push(msg);
    conv.dernier_message = new Date();
    // AUDIT-MESSAGES-PhaseA — le frontend affichait un aperçu du dernier
    // message dans la liste des conversations en lisant `dernier_message`
    // (une Date), jamais le texte réel — champ dédié ajouté au schéma,
    // renseigné ici.
    conv.dernier_message_apercu = contenu;
    await conv.save();

    // Populer l'expéditeur pour l'affichage temps réel
    await conv.populate('messages.expediteur', 'nom prenom avatar role');
    const lastMsg = conv.messages[conv.messages.length - 1];

    // Émettre le message à la room de la conversation
    emitTo(`conversation:${conv._id}`, 'message:new', {
      conversationId: conv._id,
      message: lastMsg,
    });
    // Notifier aussi chaque membre via sa room privée (badge non-lus)
    conv.membres.forEach(memberId => {
      if (memberId.toString() !== req.user._id.toString()) {
        emitTo(`user:${memberId}`, 'message:new', {
          conversationId: conv._id,
          message: lastMsg,
        });
      }
    });

    res.json({ success: true, message: lastMsg });
  } catch (err) { next(err); }
};

exports.getMessages = async (req, res, next) => {
  try {
    const conv = await Conversation.findOne({ _id: req.params.id, membres: req.user._id })
      .populate('messages.expediteur', 'nom prenom avatar role');
    if (!conv) return res.status(403).json({ success: false, message: 'Accès refusé.' });
    // Mark as read
    conv.messages.forEach(m => {
      if (!m.lu_par.includes(req.user._id)) m.lu_par.push(req.user._id);
    });
    await conv.save();
    res.json({ success: true, messages: conv.messages });
  } catch (err) { next(err); }
};

// AUDIT-07 — POST /messages/groups. Réutilise Conversation (type:'groupe'),
// aucun nouveau modèle. Le créateur est toujours ajouté aux membres, même
// s'il ne s'est pas sélectionné lui-même côté formulaire.
exports.createGroup = async (req, res, next) => {
  try {
    const { nom, membres = [], description } = req.body;
    if (!nom || !nom.trim()) {
      return res.status(400).json({ success: false, message: 'Le nom du groupe est requis.' });
    }
    if (!Array.isArray(membres) || membres.length === 0) {
      return res.status(400).json({ success: false, message: 'Au moins un membre est requis.' });
    }

    const membresUniques = [...new Set([req.user._id.toString(), ...membres.map(String)])];
    const conv = await Conversation.create({
      type: 'groupe',
      nom: nom.trim(),
      description,
      membres: membresUniques,
      created_by: req.user._id,
    });
    await conv.populate('membres', 'nom prenom role avatar');
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'messages', entite_id: conv._id, ip: req.ip, message: `Groupe créé : ${conv.nom}` });

    res.status(201).json({ success: true, conversation: conv });
  } catch (err) { next(err); }
};

// AUDIT-07 — POST /messages/reactions/:msgId. Toggle : même emoji par le
// même utilisateur sur le même message → ajout la première fois, retrait la
// seconde. Le message est retrouvé par son propre _id (pas besoin de
// l'id de conversation dans l'URL, cohérent avec l'appel déjà existant côté
// frontend) ; la conversation qui le contient est recherchée d'abord sans
// filtre de membre pour distinguer "message inexistant" (404) de "existe
// mais accès refusé" (403).
exports.toggleReaction = async (req, res, next) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ success: false, message: 'emoji requis.' });

    const conv = await Conversation.findOne({ 'messages._id': req.params.msgId });
    if (!conv) return res.status(404).json({ success: false, message: 'Message introuvable.' });
    const msg = conv.messages.id(req.params.msgId);
    if (!msg) return res.status(404).json({ success: false, message: 'Message introuvable.' });

    const estMembre = conv.membres.some(m => m.toString() === req.user._id.toString());
    if (!estMembre) return res.status(403).json({ success: false, message: 'Accès refusé.' });

    const idx = msg.reactions.findIndex(r => r.emoji === emoji && r.utilisateur.toString() === req.user._id.toString());
    let action;
    if (idx === -1) { msg.reactions.push({ emoji, utilisateur: req.user._id }); action = 'ajoutee'; }
    else { msg.reactions.splice(idx, 1); action = 'retiree'; }
    await conv.save();

    // reactions complet (pas juste le delta) — évite de dupliquer la logique
    // de toggle côté client pour les autres membres qui reçoivent l'évènement.
    emitTo(`conversation:${conv._id}`, 'message:reaction', {
      conversationId: conv._id, msgId: msg._id, reactions: msg.reactions, action,
    });

    res.json({ success: true, reactions: msg.reactions, action });
  } catch (err) { next(err); }
};

// AUDIT-07 — DELETE /messages/:msgId. Suppression réservée à l'auteur du
// message (pas à tout membre de la conversation, décision explicite).
// Distingue 404 (message inexistant) de 403 (existe mais pas le droit —
// non-membre ou membre non-auteur), comme demandé.
exports.deleteMessage = async (req, res, next) => {
  try {
    const conv = await Conversation.findOne({ 'messages._id': req.params.msgId });
    if (!conv) return res.status(404).json({ success: false, message: 'Message introuvable.' });
    const msg = conv.messages.id(req.params.msgId);
    if (!msg) return res.status(404).json({ success: false, message: 'Message introuvable.' });

    const estMembre = conv.membres.some(m => m.toString() === req.user._id.toString());
    if (!estMembre) return res.status(403).json({ success: false, message: 'Accès refusé.' });

    if (msg.expediteur.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Seul l'auteur peut supprimer ce message." });
    }

    msg.deleteOne();
    await conv.save();
    await logAction({ utilisateur: req.user._id, action: 'DELETE', module: 'messages', entite_id: conv._id, ip: req.ip, message: 'Message supprimé' });

    emitTo(`conversation:${conv._id}`, 'message:deleted', { conversationId: conv._id, msgId: req.params.msgId });

    res.json({ success: true });
  } catch (err) { next(err); }
};
