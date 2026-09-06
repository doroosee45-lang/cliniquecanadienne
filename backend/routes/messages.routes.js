// routes/messages.routes.js
const router  = require('express').Router();
const msgC    = require('../controllers/messages.controller');
const { protect, authorize } = require('../middleware/auth');
const { uploadMessageAttachment } = require('../middleware/upload');
const { STAFF } = require('../utils/roles');

// SEC-004 — GET /directory listait nom/rôle/service de tout le personnel
// actif pour n'importe quel utilisateur authentifié, sans restriction de
// rôle : une fuite d'annuaire interne, un compte role:'patient' pouvait
// lister l'ensemble du personnel. STAFF (utils/roles.js, exclut
// explicitement 'patient') restreint désormais l'accès au personnel.
router.get('/directory',         protect, authorize(...STAFF), msgC.getDirectory);
// AUDIT-MESSAGES-PhaseD — routes statiques déclarées avant '/:id' (sinon
// Express les matcherait comme id de conversation).
router.get('/historique',        protect, msgC.getHistorique);
// SEC-001 (audit du 4 sept. 2026) — aucune de ces deux routes n'avait de
// restriction de rôle : un compte role:'patient' pouvait déclencher un vrai
// envoi SMS/e-mail (Twilio/SMTP) vers n'importe quel autre patient de la
// base en devinant/énumérant un patientId, sans aucun lien de propriété
// requis. STAFF (utils/roles.js) exclut explicitement 'patient' — seuls les
// rôles professionnels peuvent désormais déclencher ces envois. Vérifié
// qu'aucun appel frontend existant ne dépend d'un accès patient à ces deux
// endpoints (Echographie.jsx, Finance.jsx, Messages.jsx — jamais Portal.jsx).
router.post('/patient-sms',      protect, authorize(...STAFF), msgC.sendPatientSms);
router.post('/patient-email',    protect, authorize(...STAFF), msgC.sendPatientEmail);
router.get('/',                  protect, msgC.getConversations);
// SEC-005 — POST / (getOrCreate) ouvrait une conversation directe avec
// n'importe quel userId envoyé par le client, sans restriction de rôle ni
// vérification de relation de soin : un compte role:'patient' pouvait
// ouvrir une conversation avec n'importe quel autre utilisateur (personnel
// ou patient) en devinant/énumérant un userId. STAFF exclut explicitement
// 'patient'.
//
// Constat annexe découvert en vérifiant l'usage frontend réel (non traité
// ici, hors périmètre de cette correction précise) : contrairement à
// Finance/Administration/Archive (routes React protégées par <Guard
// roles={...}>), la route frontend /messages (App.jsx) n'a AUCUN Guard, et
// le lien "Messagerie" du menu (Sidebar.jsx) est visible pour tous les
// rôles (roles: null) — un compte role:'patient' peut donc aujourd'hui
// atteindre la page Messages.jsx elle-même, qui ne fait par ailleurs aucune
// distinction de rôle en interne. Ce correctif bloque bien l'exploitation
// réelle côté API (directory/getOrCreate), mais un patient qui navigue vers
// /messages verra désormais des erreurs 403 sur ces deux appels au lieu
// d'un contenu chargé silencieusement — un vrai Guard sur la route
// frontend (ou une vue patient dédiée) reste à faire séparément.
router.post('/',                 protect, authorize(...STAFF), msgC.getOrCreate);
// SEC-010 (audit indépendant du 6 sept. 2026) — même classe de faille que
// SEC-005 (POST / getOrCreate) sur une route que ce correctif n'avait pas
// couverte : createGroup() accepte un tableau `membres` d'IDs arbitraires
// venant du client sans aucune vérification de relation, et n'importe quel
// compte authentifié — y compris role:'patient' — pouvait donc créer un
// groupe avec n'importe quel autre utilisateur. STAFF exclut explicitement
// 'patient' ; seul appelant frontend réel confirmé : Messages.jsx (module
// personnel), jamais Portal.jsx.
router.post('/groups',           protect, authorize(...STAFF), msgC.createGroup);
router.post('/reactions/:msgId', protect, msgC.toggleReaction);
router.get('/:id',               protect, msgC.getMessages);
router.post('/:id/send',         protect, msgC.sendMessage);
// AUDIT-MESSAGES-PhaseB
router.put('/:id/favori',        protect, msgC.toggleFavori);
router.put('/:id/archiver',      protect, msgC.toggleArchive);
router.post('/:id/attachment',   protect, uploadMessageAttachment.single('fichier'), msgC.sendAttachment);
router.delete('/:msgId',         protect, msgC.deleteMessage);

module.exports = router;
