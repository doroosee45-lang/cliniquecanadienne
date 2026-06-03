// routes/archive.routes.js
const router    = require('express').Router();
const archiveC  = require('../controllers/archive.controller');
const { protect, authorize } = require('../middleware/auth');

const ADMIN = ['superadmin','adminclinique'];

router.get('/',                  protect, authorize(...ADMIN), archiveC.getAll);
router.post('/',                 protect, authorize(...ADMIN), archiveC.create);
router.put('/:id/lifecycle',     protect, authorize(...ADMIN), archiveC.updateLifecycle);

module.exports = router;