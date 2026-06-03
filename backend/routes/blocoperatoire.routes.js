const router = require('express').Router();
const boC    = require('../controllers/blocoperatoireController');
const { protect, authorize } = require('../middleware/auth');

const BLOC_ROLES = ['superadmin', 'adminclinique', 'medecin', 'infirmier'];

router.get('/salles',         protect, authorize(...BLOC_ROLES), boC.getSalles);
router.get('/planning',       protect, authorize(...BLOC_ROLES), boC.getPlanning);
router.post('/planning',      protect, authorize('superadmin', 'adminclinique', 'medecin'), boC.scheduleIntervention);
router.put('/planning/:id',   protect, authorize('superadmin', 'adminclinique', 'medecin'), boC.updateIntervention);

module.exports = router;
