// routes/messages.routes.js
const router  = require('express').Router();
const msgC    = require('../controllers/messages.controller');
const { protect } = require('../middleware/auth');

router.get('/',             protect, msgC.getConversations);
router.post('/',            protect, msgC.getOrCreate);
router.get('/:id',          protect, msgC.getMessages);
router.post('/:id/send',    protect, msgC.sendMessage);

module.exports = router;