// routes/radiology.routes.js
const router   = require('express').Router();
const radioC   = require('../controllers/radiology.controller');
const { protect, authorize } = require('../middleware/auth');
const { uploadImages } = require('../middleware/upload');

const CAN_READ = ['superadmin','adminclinique','medecin','infirmier','radiologue'];

router.get('/stats',              protect, authorize(...CAN_READ),                 radioC.getStats);
router.get('/catalogue',          protect, authorize(...CAN_READ),                 radioC.getCatalogue);
router.get('/',                   protect, authorize(...CAN_READ),                 radioC.getAll);
router.post('/',                  protect, authorize('superadmin','medecin','infirmier'), radioC.create);
router.get('/:id',                protect, authorize(...CAN_READ),                 radioC.getOne);
router.put('/:id',                protect, authorize('superadmin','medecin','radiologue'), radioC.update);
router.post('/:id/images',         protect, authorize('superadmin','medecin','radiologue'), uploadImages.array('images', 20), radioC.uploadImages);
router.put('/:id/cr',             protect, authorize('superadmin','radiologue'),   radioC.saveCR);
router.put('/:id/rapport',        protect, authorize('superadmin','radiologue'),   radioC.rapport);
router.put('/:id/validation',     protect, authorize('superadmin','radiologue'),   radioC.validation);

module.exports = router;