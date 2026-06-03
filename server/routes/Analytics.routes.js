// routes/analytics.routes.js
const router      = require('express').Router();
const analyticsC  = require('../controllers/analytics.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, authorize('superadmin','adminclinique'), analyticsC.getAnalytics);

module.exports = router;