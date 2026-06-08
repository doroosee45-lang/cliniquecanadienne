// routes/audit.routes.js
const router  = require('express').Router();
const auditC  = require('../controllers/audit.controller');
const { protect, authorize } = require('../middleware/auth');

const ADMIN = ['superadmin', 'adminclinique'];

router.get('/',            protect, authorize(...ADMIN), auditC.getAll);
router.get('/connexions',  protect, authorize(...ADMIN), auditC.getConnexions);
router.get('/suspects',    protect, authorize(...ADMIN), auditC.getSuspects);
router.get('/stats',       protect, authorize(...ADMIN), auditC.getStats);

module.exports = router;
