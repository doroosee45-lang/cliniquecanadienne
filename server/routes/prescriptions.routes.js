// routes/prescriptions.routes.js
const router  = require('express').Router();
const rxC     = require('../controllers/prescriptions.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/',             protect,                                    rxC.getAll);
router.post('/',            protect, authorize('superadmin','medecin'), rxC.create);
router.get('/:id',          protect,                                    rxC.getOne);
router.put('/:id',          protect, authorize('superadmin','medecin'), rxC.update);
router.put('/:id/cancel',   protect, authorize('superadmin','medecin'), rxC.cancel);

module.exports = router;