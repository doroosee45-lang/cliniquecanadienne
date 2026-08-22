const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Patient = require('../models/Patient');
const AuditLog = require('../models/AuditLog');
const { emitTo } = require('../utils/socket');
const { logAction } = require('../utils/helpers');
const mail = require('../utils/mail');

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
      .sort('-dernier_message')
      .lean();
    // AUDIT-MESSAGES-PhaseB — favoris/archivee_par sont stockés par
    // utilisateur ; le frontend n'a besoin que d'un booléen scopé à
    // l'utilisateur courant (favori/archivee), jamais de la liste complète.
    const withFlags = convs.map(c => ({
      ...c,
      favori: (c.favoris || []).some(id => id.toString() === req.user._id.toString()),
      archivee: (c.archivee_par || []).some(id => id.toString() === req.user._id.toString()),
    }));
    res.json({ success: true, conversations: withFlags });
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
    const { contenu, pieceJointe } = req.body;
    const conv = await Conversation.findOne({ _id: req.params.id, membres: req.user._id });
    if (!conv) return res.status(403).json({ success: false, message: 'Accès refusé.' });

    const msg = { expediteur: req.user._id, contenu: contenu || '', lu_par: [req.user._id] };
    let apercu = contenu;
    if (pieceJointe) {
      // AUDIT-MESSAGES-PhaseB — "Transférer" ne re-upload jamais un fichier
      // (référence uniquement) : le chemin fourni doit obligatoirement
      // pointer vers un fichier déjà stocké par cette messagerie, jamais un
      // chemin arbitraire (path traversal).
      if (typeof pieceJointe.path !== 'string' || !pieceJointe.path.startsWith('/uploads/messages/')) {
        return res.status(400).json({ success: false, message: 'Pièce jointe invalide.' });
      }
      msg.pieceJointe = {
        filename: pieceJointe.filename,
        path: pieceJointe.path,
        type: pieceJointe.type,
        duration: pieceJointe.duration,
      };
      apercu = { audio: '🎙️ Message vocal', image: '🖼️ Image', document: '📄 Document' }[pieceJointe.type] || '📎 Pièce jointe';
    }
    conv.messages.push(msg);
    conv.dernier_message = new Date();
    // AUDIT-MESSAGES-PhaseA — le frontend affichait un aperçu du dernier
    // message dans la liste des conversations en lisant `dernier_message`
    // (une Date), jamais le texte réel — champ dédié ajouté au schéma,
    // renseigné ici.
    conv.dernier_message_apercu = apercu;
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

// AUDIT-MESSAGES-PhaseB — favoris/archiver étaient purement locaux (état
// React, jamais persisté). Toggle par utilisateur (favoris/archivee_par sont
// des tableaux de membres, pas un simple booléen global sur la conversation).
exports.toggleFavori = async (req, res, next) => {
  try {
    const conv = await Conversation.findOne({ _id: req.params.id, membres: req.user._id });
    if (!conv) return res.status(403).json({ success: false, message: 'Accès refusé.' });
    const idx = conv.favoris.findIndex(id => id.toString() === req.user._id.toString());
    let favori;
    if (idx === -1) { conv.favoris.push(req.user._id); favori = true; }
    else { conv.favoris.splice(idx, 1); favori = false; }
    await conv.save();
    res.json({ success: true, favori });
  } catch (err) { next(err); }
};

exports.toggleArchive = async (req, res, next) => {
  try {
    const conv = await Conversation.findOne({ _id: req.params.id, membres: req.user._id });
    if (!conv) return res.status(403).json({ success: false, message: 'Accès refusé.' });
    const idx = conv.archivee_par.findIndex(id => id.toString() === req.user._id.toString());
    let archivee;
    if (idx === -1) { conv.archivee_par.push(req.user._id); archivee = true; }
    else { conv.archivee_par.splice(idx, 1); archivee = false; }
    await conv.save();
    res.json({ success: true, archivee });
  } catch (err) { next(err); }
};

// AUDIT-MESSAGES-PhaseB — messages vocaux/image/document affichaient un faux
// succès (blob local jamais envoyé au serveur). Le fichier est déjà validé et
// stocké par le middleware uploadMessageAttachment (routes/messages.routes.js) ;
// ce contrôleur ne fait que créer le message référençant ce fichier, même
// flux temps réel (Socket.IO) que sendMessage.
exports.sendAttachment = async (req, res, next) => {
  try {
    const conv = await Conversation.findOne({ _id: req.params.id, membres: req.user._id });
    if (!conv) return res.status(403).json({ success: false, message: 'Accès refusé.' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier reçu.' });

    const { type, duration } = req.body;
    const pieceJointe = {
      filename: req.file.originalname,
      path: `/uploads/messages/${req.file.filename}`,
      type: type || 'document',
      duration: duration ? Number(duration) : undefined,
    };
    const apercu = { audio: '🎙️ Message vocal', image: '🖼️ Image', document: '📄 Document' }[pieceJointe.type] || '📎 Pièce jointe';

    const msg = { expediteur: req.user._id, contenu: '', pieceJointe, lu_par: [req.user._id] };
    conv.messages.push(msg);
    conv.dernier_message = new Date();
    conv.dernier_message_apercu = apercu;
    await conv.save();

    await conv.populate('messages.expediteur', 'nom prenom avatar role');
    const lastMsg = conv.messages[conv.messages.length - 1];

    emitTo(`conversation:${conv._id}`, 'message:new', { conversationId: conv._id, message: lastMsg });
    conv.membres.forEach(memberId => {
      if (memberId.toString() !== req.user._id.toString()) {
        emitTo(`user:${memberId}`, 'message:new', { conversationId: conv._id, message: lastMsg });
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
    // AUDIT-MESSAGES-PhaseC — dernier_message_apercu n'était jamais recalculé
    // après une suppression : la liste des conversations continuait
    // d'afficher l'aperçu du message supprimé jusqu'au prochain message.
    const last = conv.messages[conv.messages.length - 1];
    conv.dernier_message_apercu = last ? (last.contenu || (last.pieceJointe
      ? ({ audio: '🎙️ Message vocal', image: '🖼️ Image', document: '📄 Document' }[last.pieceJointe.type] || '📎 Pièce jointe')
      : '')) : '';
    if (last) conv.dernier_message = last.date_envoi;
    await conv.save();
    await logAction({ utilisateur: req.user._id, action: 'DELETE', module: 'messages', entite_id: conv._id, ip: req.ip, message: 'Message supprimé' });

    emitTo(`conversation:${conv._id}`, 'message:deleted', { conversationId: conv._id, msgId: req.params.msgId });

    res.json({ success: true });
  } catch (err) { next(err); }
};

// AUDIT-MESSAGES-PhaseD — l'onglet "Communication patients" affichait un
// faux succès (toast seul) pour l'envoi d'email à un patient. Réutilise
// utils/mail.js::sendEmail (déjà utilisé ailleurs — activation, rappels,
// ordonnances) ; tracé dans AuditLog comme les autres canaux (succès/échec).
exports.sendPatientEmail = async (req, res, next) => {
  try {
    const { patient: patientId, sujet, contenu } = req.body;
    if (!sujet || !sujet.trim() || !contenu || !contenu.trim()) {
      return res.status(400).json({ success: false, message: 'Sujet et message requis.' });
    }
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient introuvable.' });
    if (!patient.email) return res.status(400).json({ success: false, message: "Ce patient n'a pas d'adresse email enregistrée." });

    try {
      const result = await mail.sendEmail({ to: patient.email, subject: sujet, html: `<p>${contenu}</p>` });
      await logAction({ utilisateur: req.user._id, action: 'SEND_EMAIL', module: 'messages', entite_id: patient._id, ip: req.ip, message: sujet, statut: 'succes' });
      res.json({ success: true, simulated: !!result?.simulated });
    } catch (err) {
      await logAction({ utilisateur: req.user._id, action: 'SEND_EMAIL', module: 'messages', entite_id: patient._id, ip: req.ip, message: sujet, statut: 'echec' });
      res.status(502).json({ success: false, message: err.message || "Échec de l'envoi de l'email." });
    }
  } catch (err) { next(err); }
};

// AUDIT-MESSAGES-PhaseD — l'onglet "Historique & Audit" affichait des KPIs,
// une répartition par service et un journal entièrement fabriqués. Scopé
// aux conversations dont l'utilisateur est membre (jamais org-wide, même
// principe RBAC que getDirectory en Phase A) ; les envois SEND_SMS/
// SEND_EMAIL vers un patient ne sont visibles que par leur propre expéditeur
// (jamais par un autre membre du personnel), car ils ne sont rattachés à
// aucune conversation.
exports.getHistorique = async (req, res, next) => {
  try {
    const convs = await Conversation.find({ membres: req.user._id })
      .populate('messages.expediteur', 'service')
      .lean();
    const convIds = convs.map(c => c._id.toString());

    let messages_envoyes = 0, messages_recus = 0;
    const parServiceMap = {};
    convs.forEach(c => {
      (c.messages || []).forEach(m => {
        const expId = (m.expediteur?._id || m.expediteur)?.toString();
        if (expId === req.user._id.toString()) {
          messages_envoyes += 1;
        } else {
          messages_recus += 1;
          const service = m.expediteur?.service || 'Autre';
          parServiceMap[service] = (parServiceMap[service] || 0) + 1;
        }
      });
    });
    const par_service = Object.entries(parServiceMap)
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count);

    const ICONS  = { CREATE: '👥', DELETE: '🗑️', SEND_SMS: '📱', SEND_EMAIL: '📧' };
    const LABELS = { CREATE: 'Conversation créée', DELETE: 'Message supprimé', SEND_SMS: 'SMS envoyé', SEND_EMAIL: 'Email envoyé' };
    const entries = await AuditLog.find({
      module: 'messages',
      $or: [
        { action: { $in: ['CREATE', 'DELETE'] }, entite_id: { $in: convIds } },
        { action: { $in: ['SEND_SMS', 'SEND_EMAIL'] }, utilisateur: req.user._id },
      ],
    }).sort('-createdAt').limit(50).populate('utilisateur', 'nom prenom').lean();

    const journal = entries.map(e => ({
      icone: ICONS[e.action] || '📋',
      action: LABELS[e.action] || e.action,
      utilisateur: e.utilisateur ? `${e.utilisateur.prenom || ''} ${e.utilisateur.nom || ''}`.trim() : 'Utilisateur',
      detail: e.message,
      date: e.createdAt,
      statut: e.statut,
    }));

    res.json({
      success: true,
      kpis: { messages_envoyes, messages_recus, conversations_actives: convs.length },
      par_service,
      journal,
    });
  } catch (err) { next(err); }
};
