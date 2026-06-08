const router     = require('express').Router();
const analyticsC = require('../controllers/analytics.controller');
const { protect, authorize } = require('../middleware/auth');

const roles = ['superadmin', 'adminclinique'];

router.get('/stats',     protect, authorize(...roles), analyticsC.getStats);
router.get('/financial', protect, authorize(...roles), analyticsC.getFinancial);
router.get('/patients',  protect, authorize(...roles), analyticsC.getPatientStats);
router.get('/',          protect, authorize(...roles), analyticsC.getReport);

module.exports = router;
