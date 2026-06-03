// routes/notifications.routes.js
const router   = require('express').Router();
const notifC   = require('../controllers/notifications.controller');
const { protect } = require('../middleware/auth');

router.get('/',                 protect, notifC.getAll);
router.put('/read-all',         protect, notifC.markAllRead);
router.put('/:id/read',         protect, notifC.markRead);

module.exports = router;