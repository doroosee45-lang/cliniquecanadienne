// routes/finance.routes.js
const router  = require('express').Router();
const finC    = require('../controllers/finance.controller');
const { protect, authorize } = require('../middleware/auth');

const CAN_ACCESS = ['superadmin','adminclinique','comptable'];

router.get('/stats',        protect, authorize(...CAN_ACCESS), finC.stats);
router.get('/',             protect, authorize(...CAN_ACCESS), finC.getAll);
router.post('/',            protect, authorize(...CAN_ACCESS), finC.create);
router.get('/:id',          protect,                           finC.getOne);
router.post('/:id/paiement',protect, authorize(...CAN_ACCESS), finC.addPayment);

module.exports = router;