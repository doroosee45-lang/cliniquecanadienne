const router = require('express').Router();
const boC    = require('../controllers/blocoperatoireController');
const { protect, authorize } = require('../middleware/auth');

const BLOC_ROLES    = ['superadmin', 'adminclinique', 'medecin', 'infirmier'];
const BLOC_MANAGE   = ['superadmin', 'adminclinique', 'medecin'];

// Salles & planning
router.get('/salles',          protect, authorize(...BLOC_ROLES),  boC.getSalles);
router.get('/planning',        protect, authorize(...BLOC_ROLES),  boC.getPlanning);
router.post('/planning',       protect, authorize(...BLOC_MANAGE), boC.scheduleIntervention);
router.put('/planning/:id',    protect, authorize(...BLOC_MANAGE), boC.updateIntervention);

// Alias racine (utilisé par la page Blocoperatoire.jsx)
router.get('/',                protect, authorize(...BLOC_ROLES),  boC.getPlanning);
router.post('/',               protect, authorize(...BLOC_MANAGE), boC.createIntervention);
router.put('/:id',             protect, authorize(...BLOC_MANAGE), boC.updateIntervention);

// Sous-ressources
router.post('/:id/cr',         protect, authorize(...BLOC_MANAGE), boC.saveCR);
router.post('/:id/reveil',     protect, authorize(...BLOC_MANAGE), boC.saveReveil);

module.exports = router;
