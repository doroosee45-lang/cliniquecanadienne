const router = require('express').Router();
const aiC    = require('../controllers/ai.controller');
const { protect, authorize } = require('../middleware/auth');

const roles = ['superadmin', 'adminclinique', 'medecin'];

router.get('/stats',            protect, authorize(...roles),            aiC.getStats);
router.get('/predictions',      protect, authorize(...roles),            aiC.getPredictions);
router.get('/alerts',           protect, authorize(...roles),            aiC.getAlerts);
router.get('/patient-summary/:patientId', protect, authorize(...roles),  aiC.getPatientSummary);
router.get('/lab-insights/:patientId',    protect, authorize(...roles),  aiC.getLabInsights);
router.get('/imaging-insights/:patientId',protect, authorize(...roles),  aiC.getImagingInsights);
router.get('/rdv-insights',               protect, authorize(...roles),  aiC.getRdvInsights);
router.post('/consultation-summary/:consultationId', protect, authorize(...roles), aiC.getConsultationSummary);
router.get('/finance-insights',           protect, authorize(...roles),  aiC.getFinanceInsights);
router.get('/knowledge-base',             protect, authorize(...roles),  aiC.getKnowledgeBase);
router.get('/dashboard-highlights',       protect, authorize(...roles),  aiC.getDashboardHighlights);
router.post('/diagnose',        protect, authorize(...roles),            aiC.runDiagnosis);
router.post('/interactions',    protect, authorize(...roles),            aiC.checkInteractions);
router.post('/chat',            protect, authorize(...roles),            aiC.chat);
router.put('/predictions/:id',  protect, authorize(...roles, 'infirmier'), aiC.updatePrediction);

module.exports = router;
