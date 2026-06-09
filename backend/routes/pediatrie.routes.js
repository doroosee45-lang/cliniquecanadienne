const router = require('express').Router();
const c      = require('../controllers/pediatrieController');
const { protect, authorize } = require('../middleware/auth');

const CAN = ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'sage_femme'];

// Stats
router.get('/stats',                          protect, authorize(...CAN), c.getStats);

// Patients pédiatriques
router.get('/enfants',                        protect, authorize(...CAN), c.getAll);
router.post('/enfants',                       protect, authorize(...CAN), c.create);
router.get('/enfants/:id',                    protect, authorize(...CAN), c.getOne);
router.put('/enfants/:id',                    protect, authorize(...CAN), c.update);
router.post('/enfants/:id/vaccinations',      protect, authorize(...CAN), c.addVaccination);
router.post('/enfants/:id/mesures',           protect, authorize(...CAN), c.addMesure);
router.post('/enfants/:id/chroniques',        protect, authorize(...CAN), c.addMaladieChron);

// Consultations
router.get('/consultations',                  protect, authorize(...CAN), c.getConsultations);
router.post('/consultations',                 protect, authorize(...CAN), c.createConsultation);
router.put('/consultations/:id',              protect, authorize(...CAN), c.updateConsultation);

// Urgences actives du jour
router.get('/urgences',                       protect, authorize(...CAN), c.getUrgences);

module.exports = router;
