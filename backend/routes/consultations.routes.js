// routes/consultations.routes.js
const router    = require('express').Router();
const consultC  = require('../controllers/consultations.controller');
const { protect, authorize } = require('../middleware/auth');

const CAN_READ = ['superadmin','adminclinique','medecin','infirmier'];

router.get('/',       protect, authorize(...CAN_READ),                       consultC.getAll);
router.post('/',      protect, authorize('superadmin','medecin','infirmier'), consultC.create);
router.get('/:id',    protect, authorize(...CAN_READ),                       consultC.getOne);
router.put('/:id',    protect, authorize('superadmin','medecin'),             consultC.update);
router.delete('/:id', protect, authorize('superadmin','adminclinique'),       consultC.remove);

module.exports = router;