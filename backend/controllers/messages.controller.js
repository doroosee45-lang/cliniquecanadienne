const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Patient = require('../models/Patient');
const AuditLog = require('../models/AuditLog');
const { emitTo } = require('../utils/socket');
const { logAction, escapeHtml } = require('../utils/helpers');
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

// AUDIT-ELEVE-5 — Conversation.messages (tableau embarqué en croissance
// illimitée) migré vers une collection Message dédiée (voir plan de
// migration validé). Un message est désormais un insert ciblé + une mise à
// jour légère de la conversation (aperçu/date), plus jamais une réécriture
// du document Conversation entier à chaque envoi.
exports.sendMessage = async (req, res, next) => {
  try {
    const { contenu, pieceJointe } = req.body;
    const conv = await Conversation.findOne({ _id: req.params.id, membres: req.user._id });
    if (!conv) return res.status(403).json({ success: false, message: 'Accès refusé.' });

    const msgData = { conversation_id: conv._id, expediteur: req.user._id, contenu: contenu || '', lu_par: [req.user._id] };
    let apercu = contenu;
    if (pieceJointe) {
      // AUDIT-MESSAGES-PhaseB — "Transférer" ne re-upload jamais un fichier
      // (référence uniquement) : le chemin fourni doit obligatoirement
      // pointer vers un fichier déjà stocké par cette messagerie, jamais un
      // chemin arbitraire (path traversal).
      if (typeof pieceJointe.path !== 'string' || !pieceJointe.path.startsWith('/uploads/messages/')) {
        return res.status(400).json({ success: false, message: 'Pièce jointe invalide.' });
      }
      msgData.pieceJointe = {
        filename: pieceJointe.filename,
        path: pieceJointe.path,
        type: pieceJointe.type,
        duration: pieceJointe.duration,
      };
      apercu = { audio: '🎙️ Message vocal', image: '🖼️ Image', document: '📄 Document' }[pieceJointe.type] || '📎 Pièce jointe';
    }

    let msg = await Message.create(msgData);
    await msg.populate('expediteur', 'nom prenom avatar role');

    await Conversation.updateOne({ _id: conv._id }, {
      dernier_message: new Date(),
      // AUDIT-MESSAGES-PhaseA — le frontend affichait un aperçu du dernier
      // message dans la liste des conversations en lisant `dernier_message`
      // (une Date), jamais le texte réel — champ dédié, renseigné ici.
      dernier_message_apercu: apercu,
    });

    // Émettre le message à la room de la conversation
    emitTo(`conversation:${conv._id}`, 'message:new', {
      conversationId: conv._id,
      message: msg,
    });
    // Notifier aussi chaque membre via sa room privée (badge non-lus)
    conv.membres.forEach(memberId => {
      if (memberId.toString() !== req.user._id.toString()) {
        emitTo(`user:${memberId}`, 'message:new', {
          conversationId: conv._id,
          message: msg,
        });
      }
    });

    res.json({ success: true, message: msg });
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
    if (!conv) {
      // AUDIT-ARCHIVAGE-E — même garde que deleteMessage (Point A), même
      // traitement du refus : trouvée en marge en ajoutant le logAction
      // du succès demandé ci-dessous, corrigée dans le même commit.
      await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'messages', ip: req.ip, statut: 'echec', message: 'Tentative d\'envoi de pièce jointe refusée — utilisateur non membre de la conversation' });
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier reçu.' });

    const { type, duration } = req.body;
    const pieceJointe = {
      filename: req.file.originalname,
      path: `/uploads/messages/${req.file.filename}`,
      type: type || 'document',
      duration: duration ? Number(duration) : undefined,
    };
    const apercu = { audio: '🎙️ Message vocal', image: '🖼️ Image', document: '📄 Document' }[pieceJointe.type] || '📎 Pièce jointe';

    let msg = await Message.create({ conversation_id: conv._id, expediteur: req.user._id, contenu: '', pieceJointe, lu_par: [req.user._id] });
    await Conversation.updateOne({ _id: conv._id }, { dernier_message: new Date(), dernier_message_apercu: apercu });
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'messages', entite_id: conv._id, ip: req.ip, message: `Pièce jointe envoyée (${pieceJointe.type})` });

    await msg.populate('expediteur', 'nom prenom avatar role');

    emitTo(`conversation:${conv._id}`, 'message:new', { conversationId: conv._id, message: msg });
    conv.membres.forEach(memberId => {
      if (memberId.toString() !== req.user._id.toString()) {
        emitTo(`user:${memberId}`, 'message:new', { conversationId: conv._id, message: msg });
      }
    });

    res.json({ success: true, message: msg });
  } catch (err) { next(err); }
};

// AUDIT-ELEVE-5 — chargeait auparavant TOUT le tableau embarqué puis
// réécrivait le document Conversation entier juste pour marquer comme lu —
// le bug principal ayant motivé cette migration. Pagination par curseur
// (date_envoi, le plus récent d'abord ; ?before=<date_envoi> pour charger
// les plus anciens) ; marquage comme lu via une seule mise à jour ciblée
// sur les messages réellement non lus, jamais une réécriture de document.
const MESSAGES_PAGE_SIZE = 50;

exports.getMessages = async (req, res, next) => {
  try {
    const conv = await Conversation.findOne({ _id: req.params.id, membres: req.user._id });
    if (!conv) return res.status(403).json({ success: false, message: 'Accès refusé.' });

    // Marque TOUTE la conversation comme lue (pas seulement la page chargée
    // ci-dessous) — même sémantique qu'avant la migration : ouvrir une
    // conversation la marque intégralement lue, quel que soit le nombre de
    // messages plus anciens non encore paginés. Fait AVANT la lecture de la
    // page pour que celle-ci reflète directement le lu_par à jour, sans
    // correctif local après-coup. Une seule opération ciblée sur les
    // messages réellement non lus, jamais une réécriture de document.
    await Message.updateMany(
      { conversation_id: conv._id, lu_par: { $ne: req.user._id } },
      { $addToSet: { lu_par: req.user._id } }
    );

    const limit = Math.min(parseInt(req.query.limit) || MESSAGES_PAGE_SIZE, 200);
    const filter = { conversation_id: conv._id };
    if (req.query.before) filter.date_envoi = { $lt: new Date(req.query.before) };

    // +1 pour détecter s'il existe encore des messages plus anciens, sans
    // requête de comptage séparée.
    const page = await Message.find(filter)
      .populate('expediteur', 'nom prenom avatar role')
      .sort({ date_envoi: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = page.length > limit;
    const messages = page.slice(0, limit).reverse(); // ordre chronologique pour l'affichage

    res.json({ success: true, messages, hasMore });
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
// AUDIT-ELEVE-5 — le message est désormais son propre document ; la
// conversation n'est plus interrogée que pour la vérification d'appartenance
// (msg.conversation_id), plus jamais parcourue comme parent d'un sous-document.
exports.toggleReaction = async (req, res, next) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ success: false, message: 'emoji requis.' });

    const msg = await Message.findById(req.params.msgId);
    if (!msg) return res.status(404).json({ success: false, message: 'Message introuvable.' });

    const conv = await Conversation.findById(msg.conversation_id).select('membres');
    const estMembre = conv && conv.membres.some(m => m.toString() === req.user._id.toString());
    if (!estMembre) return res.status(403).json({ success: false, message: 'Accès refusé.' });

    const idx = msg.reactions.findIndex(r => r.emoji === emoji && r.utilisateur.toString() === req.user._id.toString());
    let action;
    if (idx === -1) { msg.reactions.push({ emoji, utilisateur: req.user._id }); action = 'ajoutee'; }
    else { msg.reactions.splice(idx, 1); action = 'retiree'; }
    await msg.save();

    // reactions complet (pas juste le delta) — évite de dupliquer la logique
    // de toggle côté client pour les autres membres qui reçoivent l'évènement.
    emitTo(`conversation:${msg.conversation_id}`, 'message:reaction', {
      conversationId: msg.conversation_id, msgId: msg._id, reactions: msg.reactions, action,
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
    const msg = await Message.findById(req.params.msgId);
    if (!msg) return res.status(404).json({ success: false, message: 'Message introuvable.' });

    const conv = await Conversation.findById(msg.conversation_id).select('membres');
    const estMembre = conv && conv.membres.some(m => m.toString() === req.user._id.toString());
    if (!estMembre) {
      await logAction({ utilisateur: req.user._id, action: 'DELETE', module: 'messages', entite_id: msg.conversation_id, ip: req.ip, statut: 'echec', message: 'Tentative de suppression refusée — utilisateur non membre de la conversation' });
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    if (msg.expediteur.toString() !== req.user._id.toString()) {
      await logAction({ utilisateur: req.user._id, action: 'DELETE', module: 'messages', entite_id: msg.conversation_id, ip: req.ip, statut: 'echec', message: "Tentative de suppression refusée — utilisateur non auteur du message" });
      return res.status(403).json({ success: false, message: "Seul l'auteur peut supprimer ce message." });
    }

    await Message.findByIdAndDelete(msg._id);
    // AUDIT-MESSAGES-PhaseC — dernier_message_apercu n'était jamais recalculé
    // après une suppression : la liste des conversations continuait
    // d'afficher l'aperçu du message supprimé jusqu'au prochain message.
    // Recalculé ici depuis le nouveau dernier message réel de la collection
    // Message (plus un sous-document en fin de tableau).
    const last = await Message.findOne({ conversation_id: msg.conversation_id }).sort({ date_envoi: -1 });
    const apercu = last ? (last.contenu || (last.pieceJointe
      ? ({ audio: '🎙️ Message vocal', image: '🖼️ Image', document: '📄 Document' }[last.pieceJointe.type] || '📎 Pièce jointe')
      : '')) : '';
    await Conversation.updateOne({ _id: msg.conversation_id }, {
      dernier_message_apercu: apercu,
      ...(last ? { dernier_message: last.date_envoi } : {}),
    });
    await logAction({ utilisateur: req.user._id, action: 'DELETE', module: 'messages', entite_id: msg.conversation_id, ip: req.ip, message: 'Message supprimé' });

    emitTo(`conversation:${msg.conversation_id}`, 'message:deleted', { conversationId: msg.conversation_id, msgId: req.params.msgId });

    res.json({ success: true });
  } catch (err) { next(err); }
};

// AUDIT-MESSAGES-PhaseD — l'onglet "Communication patients" affichait un
// faux succès (toast seul) pour l'envoi d'email à un patient. Réutilise
// utils/mail.js::sendEmail (déjà utilisé ailleurs — activation, rappels,
// ordonnances) ; tracé dans AuditLog comme les autres canaux (succès/échec).
// AUDIT-RECU-PDF-PARTAGE — attachment optionnel {filename, contentBase64},
// pour joindre réellement un PDF (facture/reçu) généré côté client — jusqu'ici
// cet endpoint n'envoyait que du texte. Garde-fou de taille avant décodage
// pour ne pas accepter une pièce jointe arbitrairement volumineuse dans le
// corps JSON.
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

// AUDIT-11-7 — le compte-rendu échographie (bouton "Envoyer par email",
// Echographie.jsx) réutilisait cet endpoint générique mais construisait déjà
// son propre HTML côté FRONTEND (buildRapportEmailHtml : <strong>/<br> autour
// de rapport_texte/conclusion/recommandations) et l'envoyait tel quel comme
// `contenu` — le backend ne pouvait alors pas échapper ce contenu sans casser
// sa mise en forme légitime (<br>/<strong>), ni lui faire confiance sans
// risque (rapport_texte etc. restent du texte libre saisi par
// l'échographiste ; un compte compromis aurait pu y injecter du HTML actif
// tout aussi bien que dans un message classique). Résolu en déplaçant la
// construction du HTML ICI : le frontend envoie désormais les champs bruts
// (`rapport`), et cette fonction échappe chacun individuellement avant de
// les insérer dans une mise en forme de confiance qu'elle contrôle
// elle-même — jamais de HTML pré-construit côté client accepté tel quel.
const buildRapportHtml = (rapport) => {
  const nl2br = (s) => escapeHtml(s).replace(/\n/g, '<br>');
  const parts = [`<strong>Type d'examen :</strong> ${escapeHtml(rapport.type || '')}${rapport.sous_type ? ` — ${escapeHtml(rapport.sous_type)}` : ''}`];
  if (rapport.rapport_texte) parts.push(nl2br(rapport.rapport_texte));
  if (rapport.conclusion) parts.push(`<strong>Conclusion :</strong><br>${nl2br(rapport.conclusion)}`);
  if (rapport.recommandations) parts.push(`<strong>Recommandations :</strong><br>${nl2br(rapport.recommandations)}`);
  return parts.join('<br><br>');
};

exports.sendPatientEmail = async (req, res, next) => {
  try {
    const { patient: patientId, sujet, contenu, attachment, rapport } = req.body;
    if (!sujet || !sujet.trim()) {
      return res.status(400).json({ success: false, message: 'Sujet et message requis.' });
    }
    const estRapport = rapport && typeof rapport === 'object';
    if (!estRapport && (!contenu || !contenu.trim())) {
      return res.status(400).json({ success: false, message: 'Sujet et message requis.' });
    }
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient introuvable.' });
    if (!patient.email) return res.status(400).json({ success: false, message: "Ce patient n'a pas d'adresse email enregistrée." });

    let attachments;
    if (attachment && attachment.contentBase64) {
      const buf = Buffer.from(attachment.contentBase64, 'base64');
      if (buf.length > MAX_ATTACHMENT_BYTES) {
        return res.status(400).json({ success: false, message: 'Pièce jointe trop volumineuse (max 8 Mo).' });
      }
      attachments = [{ filename: attachment.filename || 'document.pdf', content: buf }];
    }

    try {
      // AUDIT-11-7 — contenu (message classique) est saisi librement par le
      // personnel : échappé avant insertion dans le corps HTML de l'email
      // (jamais interprété comme du HTML/JS actif), sinon un compte
      // compromis ou malveillant pourrait envoyer un email de phishing
      // crédible (liens/scripts arbitraires) avec l'adresse d'expédition
      // officielle de la clinique. rapport (compte-rendu) est construit et
      // échappé champ par champ par buildRapportHtml ci-dessus.
      const html = estRapport ? `<p>${buildRapportHtml(rapport)}</p>` : `<p>${escapeHtml(contenu)}</p>`;
      const result = await mail.sendEmail({ to: patient.email, subject: sujet, html, attachments });
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
// AUDIT-ELEVE-5 — chargeait auparavant TOUS les messages de TOUTES les
// conversations de l'utilisateur en mémoire Node pour agréger des
// compteurs (un second point de lecture non bornée, jamais cité dans le
// constat initial sur getMessages/getConversations). Remplacé par une
// vraie agrégation MongoDB sur la collection Message.
exports.getHistorique = async (req, res, next) => {
  try {
    const mesConvs = await Conversation.find({ membres: req.user._id }).select('_id').lean();
    const convIds = mesConvs.map(c => c._id);

    // AUDIT-M-A1 — User.service est désormais une référence (comme
    // Staff.service), résolue ici avec la même priorité que partout ailleurs :
    // Staff.service (via Staff.utilisateur) prioritaire, User.service en
    // repli seulement si l'expéditeur n'a aucune fiche Staff liée — jamais
    // les deux affichés séparément.
    const [{ counts = [], parService = [] } = {}] = await Message.aggregate([
      { $match: { conversation_id: { $in: convIds } } },
      { $lookup: { from: 'users', localField: 'expediteur', foreignField: '_id', as: 'exp' } },
      { $unwind: { path: '$exp', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'staffs', localField: 'exp._id', foreignField: 'utilisateur', as: 'staffLink' } },
      { $unwind: { path: '$staffLink', preserveNullAndEmptyArrays: true } },
      { $addFields: { serviceId: { $ifNull: ['$staffLink.service', '$exp.service'] } } },
      { $lookup: { from: 'services', localField: 'serviceId', foreignField: '_id', as: 'serviceDoc' } },
      { $unwind: { path: '$serviceDoc', preserveNullAndEmptyArrays: true } },
      { $facet: {
        counts: [
          { $group: { _id: { $eq: ['$expediteur', req.user._id] }, count: { $sum: 1 } } },
        ],
        parService: [
          { $match: { expediteur: { $ne: req.user._id } } },
          { $group: { _id: { $ifNull: ['$serviceDoc.nom', 'Autre'] }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
      } },
    ]);
    const messages_envoyes = counts.find(c => c._id === true)?.count || 0;
    const messages_recus = counts.find(c => c._id === false)?.count || 0;
    const par_service = parService.map(s => ({ service: s._id, count: s.count }));

    const ICONS  = { CREATE: '👥', DELETE: '🗑️', SEND_SMS: '📱', SEND_EMAIL: '📧' };
    const LABELS = { CREATE: 'Conversation créée', DELETE: 'Message supprimé', SEND_SMS: 'SMS envoyé', SEND_EMAIL: 'Email envoyé' };
    const entries = await AuditLog.find({
      module: 'messages',
      $or: [
        { action: { $in: ['CREATE', 'DELETE'] }, entite_id: { $in: convIds.map(String) } },
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
      kpis: { messages_envoyes, messages_recus, conversations_actives: convIds.length },
      par_service,
      journal,
    });
  } catch (err) { next(err); }
};
