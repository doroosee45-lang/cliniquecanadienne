const router = require('express').Router();
const patC   = require('../controllers/patients.controller');
const { protect, authorize } = require('../middleware/auth');
const { uploadPatientPhoto } = require('../middleware/upload');

// Seuls Réceptionniste, SuperAdmin, AdminClinique peuvent créer un patient
const CAN_CREATE = ['superadmin', 'adminclinique', 'receptionniste'];
const CAN_WRITE  = ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'receptionniste'];
// Lecture du dossier patient : tout le personnel soignant/admin, JAMAIS un
// compte patient (qui doit passer par /portal, scopé à son propre dossier).
const CAN_READ = ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'sage_femme',
                   'receptionniste', 'laborantin', 'radiologue', 'pharmacien', 'comptable'];

// ── Public : activation compte patient via lien email ──────────────────────
router.get('/activate/:token',  patC.activate);
router.post('/activate/:token', patC.setPasswordAndActivate);

// ── Protégées ──────────────────────────────────────────────────────────────
router.get('/search',  protect, authorize(...CAN_READ),      patC.search);
router.get('/',        protect, authorize(...CAN_READ),      patC.getAll);
router.post('/',       protect, authorize(...CAN_CREATE),     patC.create);
router.get('/:id',     protect, authorize(...CAN_READ),      patC.getOne);
router.put('/:id/activate-admin', protect, authorize(...CAN_WRITE), patC.activateAdmin);
router.put('/:id',     protect, authorize(...CAN_WRITE),      patC.update);
router.post('/:id/photo', protect, authorize(...CAN_WRITE), uploadPatientPhoto.single('photo'), patC.uploadPhoto);
router.delete('/:id',  protect, authorize('superadmin', 'adminclinique'), patC.remove);
router.put('/:id/anonymize', protect, authorize('superadmin', 'adminclinique'), patC.anonymize);

module.exports = router;
