// routes/laboratory.routes.js
const router  = require('express').Router();
const labC    = require('../controllers/laboratory.controller');
const { protect, authorize } = require('../middleware/auth');

const CAN_READ = ['superadmin','adminclinique','medecin','infirmier','laborantin'];

router.get('/stats',            protect, authorize(...CAN_READ),                   labC.getStats);
router.get('/catalogue',        protect, authorize(...CAN_READ),                   labC.getCatalogue);
router.get('/',                 protect, authorize(...CAN_READ),                   labC.getAll);
router.post('/',                protect, authorize('superadmin','medecin','infirmier'), labC.create);
router.get('/:id',              protect, authorize(...CAN_READ),                   labC.getOne);
router.put('/:id/validate',     protect, authorize('superadmin','laborantin'),     labC.validate);
router.put('/:id/acquit',       protect, authorize('superadmin','medecin'),        labC.acquit);

module.exports = router;