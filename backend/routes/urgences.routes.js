const router = require('express').Router();
const c      = require('../controllers/urgencesController');
const { protect, authorize } = require('../middleware/auth');

const CAN = ['superadmin','adminclinique','medecin','infirmier','sage_femme'];

// Stats
router.get('/stats',                        protect, authorize(...CAN), c.getStats);

// Dossiers urgences
router.get('/',                             protect, authorize(...CAN), c.getAll);
router.post('/',                            protect, authorize(...CAN), c.create);
router.get('/:id',                          protect, authorize(...CAN), c.getOne);
router.put('/:id',                          protect, authorize(...CAN), c.update);

// Sous-ressources dossier
router.get('/:id/soins',                    protect, authorize(...CAN), c.getSoins);
router.post('/:id/soins',                   protect, authorize(...CAN), c.addSoin);
router.get('/:id/prescriptions',            protect, authorize(...CAN), c.getPrescriptions);
router.post('/:id/prescriptions',           protect, authorize(...CAN), c.addPrescription);
router.get('/:id/examens',                  protect, authorize(...CAN), c.getExamens);
router.post('/:id/examens',                 protect, authorize(...CAN), c.addExamen);
router.get('/:id/timeline',                 protect, authorize(...CAN), c.getTimeline);

module.exports = router;
