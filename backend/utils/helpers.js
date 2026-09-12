const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { emitTo } = require('./socket');
const { logger, captureException } = require('./logger');
const env = require('../config/env');

const logAction = async ({ utilisateur, action, module, entite_id, ip, ua, avant, apres, message, statut = 'succes' }) => {
  try {
    await AuditLog.create({
      utilisateur,
      action,
      module,
      entite_id: entite_id?.toString(),
      ip_address: ip,
      user_agent: ua,
      donnees_avant: avant,
      donnees_apres: apres,
      message,
      statut,
    });
  } catch (e) {
    // SEC-B-05 (correction du 12 sept. 2026, audit indépendant) — un échec
    // d'écriture d'audit-log n'était remonté que par un simple
    // logger.error, invisible en dehors des logs console/fichier locaux.
    // Ajout de captureException (même mécanisme déjà utilisé par
    // errorHandler.js/googleAuth.controller.js/les jobs planifiés pour tout
    // incident nécessitant une remontée au-delà d'un simple log) — jamais
    // un throw : la politique de ce système n'exige pas qu'une opération
    // métier échoue si son audit-log échoue à être persisté, seulement que
    // l'incident soit réellement visible.
    logger.error('Audit log error', { error: e.message, action, module, entite_id });
    captureException(e, { context: 'logAction', action, module, entite_id: entite_id?.toString() });
  }
};

const createNotification = async ({ destinataire, type = 'info', titre, message, lien, priorite = 'normale' }) => {
  try {
    const notif = await Notification.create({ destinataire, type, titre, message, lien, priorite });
    // Push en temps réel vers la room privée de l'utilisateur destinataire
    emitTo(`user:${destinataire}`, 'notification:new', notif);
  } catch (e) {
    logger.error('Notification error', { error: e.message, destinataire, type });
  }
};

const sendTokenCookie = (user, statusCode, res) => {
  const token = user.getSignedJWT();
  const options = {
    expires: new Date(Date.now() + parseInt(env.JWT_COOKIE_EXPIRE) * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    // 'lax' est requis en développement avec le proxy Vite (localhost:5173 → :5000)
    // 'strict' bloque les cookies dans ce contexte cross-port
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
  };
  res.status(statusCode).cookie('token', token, options).json({
    success: true,
    user: {
      _id: user._id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
      specialite: user.specialite,
      couleur_theme: user.couleur_theme,
      avatar: user.avatar,
      must_change_password: user.must_change_password || false,
    },
  });
};

const paginate = (query, page = 1, limit = 20) => {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  return query.skip(skip).limit(parseInt(limit));
};

// AUDIT-11 (audit complet post-Phase 10) — extrait de patients.controller.js
// (seul endroit qui l'avait, avant cette généralisation) : un terme de
// recherche utilisateur passé tel quel dans un $regex Mongo permet une
// construction de motif arbitraire (ReDoS via des motifs pathologiques du
// type (a+)+, ou des correspondances non voulues via des métacaractères
// comme . ou |). Échapper les métacaractères regex avant de construire le
// filtre, jamais interpréter l'entrée comme un motif.
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// AUDIT-11-7 — messages.controller.js::sendPatientEmail construisait le
// corps de l'email par interpolation directe du texte saisi par le
// personnel (`<p>${contenu}</p>`) : un compte compromis ou malveillant peut
// ainsi envoyer un email contenant du HTML/liens arbitraires avec l'adresse
// d'expédition officielle de la clinique comme origine — un vecteur de
// phishing crédible, indétectable côté client. Aucune dépendance
// d'échappement HTML n'existe déjà dans le projet (escape-html n'est qu'une
// dépendance transitive d'Express, jamais déclarée dans package.json — n'y
// pas s'appuyer) ; échapper les 5 caractères HTML-actifs suffit ici, même
// principe minimaliste que escapeRegex ci-dessus. N'échapper QUE le contenu
// variable saisi par un utilisateur avant de l'insérer dans un template
// HTML — jamais le HTML légitime du template lui-même (en-tête, boutons,
// mise en forme).
const HTML_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => HTML_ESCAPE_MAP[c]);

// AUDIT-P7-6 — factorisé depuis appointments.controller.js::create, seul
// endroit qui vérifiait un conflit de créneau avant ce correctif.
// update() (report de RDV) et recurring.controller.js::planifier() créaient
// ou déplaçaient des rendez-vous sans aucune re-vérification, permettant un
// double-booking du même médecin. excludeId sert à ignorer le rendez-vous
// lui-même lors d'un report (sinon il entrerait toujours en conflit avec
// sa propre plage horaire actuelle).
const checkAppointmentConflict = async ({ medecin, date_heure, duree_minutes = 30, excludeId }) => {
  const Appointment = require('../models/Appointment');
  const start = new Date(date_heure);
  const end = new Date(start.getTime() + duree_minutes * 60000);
  const filter = {
    medecin,
    statut: { $nin: ['annule', 'absent'] },
    date_heure: { $lt: end },
    $expr: { $gt: [{ $add: ['$date_heure', { $multiply: ['$duree_minutes', 60000] }] }, start] },
  };
  if (excludeId) filter._id = { $ne: excludeId };
  return Appointment.findOne(filter);
};

// AUDIT-M-B4 (Groupe B, Point 4) — checkAppointmentConflict() ci-dessus reste
// une lecture avant écriture séparée (utile comme garde-fou UX rapide, mais
// pas atomique) : deux réservations sur des date_heure DIFFÉRENTS mais qui se
// chevauchent partiellement pouvaient toutes deux la franchir avant que
// l'une n'ait écrit — l'index unique partiel du modèle (medecin+date_heure)
// ne protège que le créneau EXACT, jamais un chevauchement partiel. Aucune
// contrainte d'unicité classique ni de findOneAndUpdate à filtre-garde ne
// peut exprimer "ce document ne doit chevaucher aucun autre document
// existant" (c'est une relation entre documents, pas l'état d'un seul).
// Corrigé par écriture optimiste + relecture + élimination déterministe :
// après avoir écrit (create ou update), on relit TOUS les rendez-vous actifs
// en chevauchement pour ce médecin, moi inclus ; s'il y en a plus d'un, seul
// celui au plus petit _id (ObjectId, donc le premier réellement validé)
// survit — l'appelant doit annuler sa propre écriture s'il n'est pas ce
// survivant, AVANT tout effet de bord (email, Socket.IO, log de succès).
//
// Correction sous concurrence réelle : une relecture qui s'exécute après
// qu'une autre écriture a été validée voit TOUJOURS cette écriture — c'est
// une garantie de cohérence lecture-après-écriture sur le nœud primaire
// MongoDB, valable quel que soit le nombre de processus Node qui
// interrogent ce même primaire (PAS une hypothèse "process unique" : rien
// ici ne repose sur un état en mémoire partagé entre requêtes, contrairement
// par exemple à utils/dashboardCache.js). La seule vraie dépendance : la
// comparaison par _id (ObjectId, horodaté côté client au moment de la
// création) suppose des horloges à peu près synchronisées entre les
// instances qui génèrent des documents concurrents — vrai en pratique (NTP)
// y compris en cluster PM2/multi-serveur ; en cas de dérive d'horloge
// significative, le résultat resterait déterministe et sans double-booking,
// mais le "gagnant" ne serait plus garanti être le tout premier au sens
// strict de l'horloge murale — un désagrément d'équité, jamais une
// corruption de données.
const isAppointmentRaceWinner = async (apptId) => {
  const Appointment = require('../models/Appointment');
  const appt = await Appointment.findById(apptId).select('medecin date_heure duree_minutes statut').lean();
  if (!appt || ['annule', 'absent'].includes(appt.statut)) return true;
  const start = new Date(appt.date_heure);
  const end = new Date(start.getTime() + appt.duree_minutes * 60000);
  const overlapping = await Appointment.find({
    medecin: appt.medecin,
    statut: { $nin: ['annule', 'absent'] },
    date_heure: { $lt: end },
    $expr: { $gt: [{ $add: ['$date_heure', { $multiply: ['$duree_minutes', 60000] }] }, start] },
  }).select('_id').lean();
  if (overlapping.length <= 1) return true;
  const survivorId = overlapping.reduce((min, o) => (o._id.toString() < min ? o._id.toString() : min), overlapping[0]._id.toString());
  return survivorId === apptId.toString();
};

// AUDIT-ELEVE-5 — factorisé depuis dashboard.controller.js/portal.controller.js,
// qui dupliquaient la même requête Conversation.countDocuments({messages:
// {$elemMatch:...}}) — devenue invalide après la migration de
// Conversation.messages vers une collection Message séparée (voir plan de
// migration validé). Même sémantique qu'avant : nombre de conversations
// (pas de messages) où l'utilisateur est membre et a au moins un message non
// lu qu'il n'a pas lui-même envoyé.
const countUnreadConversations = async (userId) => {
  const Conversation = require('../models/Conversation');
  const Message = require('../models/Message');
  const convIds = await Conversation.find({ membres: userId }).distinct('_id');
  if (convIds.length === 0) return 0;
  const unread = await Message.distinct('conversation_id', {
    conversation_id: { $in: convIds },
    lu_par: { $ne: userId },
    expediteur: { $ne: userId },
  });
  return unread.length;
};

module.exports = { logAction, createNotification, sendTokenCookie, paginate, escapeRegex, escapeHtml, checkAppointmentConflict, isAppointmentRaceWinner, countUnreadConversations };
