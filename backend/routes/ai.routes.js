const router = require('express').Router();
const aiC    = require('../controllers/ai.controller');
const { protect, authorize } = require('../middleware/auth');

const roles = ['superadmin', 'adminclinique', 'medecin'];

router.get('/stats',            protect, authorize(...roles),            aiC.getStats);
router.get('/predictions',      protect, authorize(...roles),            aiC.getPredictions);
router.get('/alerts',           protect, authorize(...roles),            aiC.getAlerts);
router.post('/diagnose',        protect, authorize(...roles),            aiC.runDiagnosis);
router.post('/interactions',    protect, authorize(...roles),            aiC.checkInteractions);
router.put('/predictions/:id',  protect, authorize(...roles, 'infirmier'), aiC.updatePrediction);

module.exports = router;
