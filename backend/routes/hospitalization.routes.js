// routes/hospitalization.routes.js
const router  = require('express').Router();
const hospC   = require('../controllers/hospitalization.controller');
const { protect, authorize } = require('../middleware/auth');

const CAN_WRITE = ['superadmin','adminclinique','medecin','infirmier'];

router.get('/stats',            protect, authorize(...CAN_WRITE), hospC.getStats);
router.get('/rooms',            protect, authorize(...CAN_WRITE), hospC.getRooms);
router.get('/',                 protect, authorize(...CAN_WRITE), hospC.getAll);
router.post('/',                protect, authorize(...CAN_WRITE), hospC.create);
router.post('/:id/notes',       protect, authorize(...CAN_WRITE), hospC.addNote);
router.put('/:id/discharge',    protect, authorize(...CAN_WRITE), hospC.discharge);

module.exports = router;