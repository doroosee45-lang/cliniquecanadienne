const router = require('express').Router();
const c      = require('../controllers/echographieController');
const { protect, authorize } = require('../middleware/auth');

const CAN = ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'sage_femme'];

router.get('/stats',         protect, authorize(...CAN), c.getStats);
router.get('/',              protect, authorize(...CAN), c.getAll);
router.post('/',             protect, authorize(...CAN), c.create);
router.get('/:id',           protect, authorize(...CAN), c.getOne);
router.put('/:id',           protect, authorize(...CAN), c.update);
router.put('/:id/planifier', protect, authorize(...CAN), c.planifier);
router.put('/:id/rapport',   protect, authorize(...CAN), c.saveRapport);
router.put('/:id/annuler',   protect, authorize(...CAN), c.annuler);

module.exports = router;
