const router = require('express').Router();
const c      = require('../controllers/echographieController');
const { protect, authorize } = require('../middleware/auth');
const { uploadEchographieImages } = require('../middleware/upload');

const CAN = ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'radiologue', 'sage_femme'];

router.get('/stats',         protect, authorize(...CAN), c.getStats);
router.get('/',              protect, authorize(...CAN), c.getAll);
router.post('/',             protect, authorize(...CAN), c.create);
router.get('/:id',           protect, authorize(...CAN), c.getOne);
router.put('/:id',           protect, authorize(...CAN), c.update);
router.put('/:id/planifier', protect, authorize(...CAN), c.planifier);
// AUDIT-ELEVE-2 — miroir de radiology.routes.js (/cr, /rapport, /validation
// réservés à radiologue/superadmin) : validation d'un compte rendu
// d'échographie, jamais ouvert à infirmier/sage_femme/medecin/adminclinique.
router.put('/:id/rapport',   protect, authorize('superadmin', 'radiologue'), c.saveRapport);
router.post('/:id/images',   protect, authorize(...CAN), uploadEchographieImages.array('images', 20), c.uploadImages);
router.put('/:id/annuler',   protect, authorize(...CAN), c.annuler);

module.exports = router;
