const router = require('express').Router();
const patC   = require('../controllers/patients.controller');
const { protect, authorize } = require('../middleware/auth');

// Seuls Réceptionniste, SuperAdmin, AdminClinique peuvent créer un patient
const CAN_CREATE = ['superadmin', 'adminclinique', 'receptionniste'];
const CAN_WRITE  = ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'receptionniste'];

// ── Public : activation compte patient via lien email ──────────────────────
router.get('/activate/:token', patC.activate);

// ── Protégées ──────────────────────────────────────────────────────────────
router.get('/search',  protect,                               patC.search);
router.get('/',        protect,                               patC.getAll);
router.post('/',       protect, authorize(...CAN_CREATE),     patC.create);
router.get('/:id',     protect,                               patC.getOne);
router.put('/:id',     protect, authorize(...CAN_WRITE),      patC.update);
router.delete('/:id',  protect, authorize('superadmin', 'adminclinique'), patC.remove);

module.exports = router;
