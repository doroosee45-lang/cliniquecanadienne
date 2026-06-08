const router  = require('express').Router();
const rxC     = require('../controllers/prescriptions.controller');
const { protect, authorize } = require('../middleware/auth');

const canWrite = authorize('superadmin','medecin','infirmier');

router.get('/stats',            protect,            rxC.getStats);
router.get('/',                 protect,            rxC.getAll);
router.post('/',                protect, canWrite,  rxC.create);
router.get('/:id',              protect,            rxC.getOne);
router.put('/:id',              protect, canWrite,  rxC.update);
router.put('/:id/cancel',       protect, canWrite,  rxC.cancel);
router.post('/:id/publier',     protect, canWrite,  rxC.publier);
router.post('/:id/renouveler',  protect, canWrite,  rxC.renouveler);

module.exports = router;
