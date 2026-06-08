// routes/radiology.routes.js
const router   = require('express').Router();
const radioC   = require('../controllers/radiology.controller');
const { protect, authorize } = require('../middleware/auth');
const { uploadImages } = require('../middleware/upload');

router.get('/stats',              protect,                                         radioC.getStats);
router.get('/catalogue',          protect,                                         radioC.getCatalogue);
router.get('/',                   protect,                                         radioC.getAll);
router.post('/',                  protect, authorize('superadmin','medecin','infirmier'), radioC.create);
router.get('/:id',                protect,                                         radioC.getOne);
router.put('/:id',                protect, authorize('superadmin','medecin','radiologue'), radioC.update);
router.post('/:id/images',         protect, uploadImages.array('images', 20),       radioC.uploadImages);
router.put('/:id/cr',             protect, authorize('superadmin','radiologue'),   radioC.saveCR);
router.put('/:id/rapport',        protect, authorize('superadmin','radiologue'),   radioC.rapport);
router.put('/:id/validation',     protect, authorize('superadmin','radiologue'),   radioC.validation);

module.exports = router;