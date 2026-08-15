const router = require('express').Router();
const rc     = require('../controllers/recurring.controller');
const { protect, authorize } = require('../middleware/auth');

// Mêmes rôles que la prise de rendez-vous classique (appointments.routes.js) —
// un protocole récurrent finit par créer de vrais Appointment.
const CAN_WRITE = ['superadmin','adminclinique','medecin','infirmier','receptionniste'];

router.get('/',           protect, authorize(...CAN_WRITE), rc.getAll);
router.post('/',          protect, authorize(...CAN_WRITE), rc.create);
router.put('/:id',        protect, authorize(...CAN_WRITE), rc.update);
router.delete('/:id',     protect, authorize(...CAN_WRITE), rc.remove);
router.post('/:id/planifier', protect, authorize(...CAN_WRITE), rc.planifier);

module.exports = router;
