// routes/messages.routes.js
const router  = require('express').Router();
const msgC    = require('../controllers/messages.controller');
const { protect, authorize } = require('../middleware/auth');
const { uploadMessageAttachment } = require('../middleware/upload');
const { STAFF } = require('../utils/roles');

router.get('/directory',         protect, msgC.getDirectory);
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
router.post('/',                 protect, msgC.getOrCreate);
router.post('/groups',           protect, msgC.createGroup);
router.post('/reactions/:msgId', protect, msgC.toggleReaction);
router.get('/:id',               protect, msgC.getMessages);
router.post('/:id/send',         protect, msgC.sendMessage);
// AUDIT-MESSAGES-PhaseB
router.put('/:id/favori',        protect, msgC.toggleFavori);
router.put('/:id/archiver',      protect, msgC.toggleArchive);
router.post('/:id/attachment',   protect, uploadMessageAttachment.single('fichier'), msgC.sendAttachment);
router.delete('/:msgId',         protect, msgC.deleteMessage);

module.exports = router;
