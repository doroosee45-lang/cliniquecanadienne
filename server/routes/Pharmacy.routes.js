// routes/pharmacy.routes.js
const router   = require('express').Router();
const pharmaC  = require('../controllers/pharmacy.controller');
const { protect, authorize } = require('../middleware/auth');

const CAN_MANAGE = ['superadmin','adminclinique','pharmacien'];

router.get('/prescriptions',                    protect,                              pharmaC.getPrescriptions);
router.put('/prescriptions/:id/dispenser',      protect, authorize(...CAN_MANAGE),    pharmaC.dispenser);
router.get('/',                                 protect,                              pharmaC.getAll);
router.post('/',                                protect, authorize(...CAN_MANAGE),    pharmaC.create);
router.get('/:id',                              protect,                              pharmaC.getOne);
router.put('/:id',                              protect, authorize(...CAN_MANAGE),    pharmaC.update);
router.post('/:id/mouvement',                   protect, authorize(...CAN_MANAGE),    pharmaC.mouvement);

module.exports = router;