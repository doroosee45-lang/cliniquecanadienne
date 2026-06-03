// routes/audit.routes.js
const router   = require('express').Router();
const auditC   = require('../controllers/audit.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, authorize('superadmin','adminclinique'), auditC.getAll);

module.exports = router;