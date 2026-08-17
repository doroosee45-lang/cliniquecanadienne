// routes/messages.routes.js
const router  = require('express').Router();
const msgC    = require('../controllers/messages.controller');
const { protect } = require('../middleware/auth');

router.get('/',                  protect, msgC.getConversations);
router.post('/',                 protect, msgC.getOrCreate);
router.post('/groups',           protect, msgC.createGroup);
router.post('/reactions/:msgId', protect, msgC.toggleReaction);
router.get('/:id',               protect, msgC.getMessages);
router.post('/:id/send',         protect, msgC.sendMessage);
router.delete('/:msgId',         protect, msgC.deleteMessage);

module.exports = router;