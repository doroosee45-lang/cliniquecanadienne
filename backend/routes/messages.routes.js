// routes/messages.routes.js
const router  = require('express').Router();
const msgC    = require('../controllers/messages.controller');
const { protect } = require('../middleware/auth');
const { uploadMessageAttachment } = require('../middleware/upload');

router.get('/directory',         protect, msgC.getDirectory);
// AUDIT-MESSAGES-PhaseD — routes statiques déclarées avant '/:id' (sinon
// Express les matcherait comme id de conversation).
router.get('/historique',        protect, msgC.getHistorique);
router.post('/patient-sms',      protect, msgC.sendPatientSms);
router.post('/patient-email',    protect, msgC.sendPatientEmail);
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
