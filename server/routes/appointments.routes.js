// routes/appointments.routes.js
const router  = require('express').Router();
const apptC   = require('../controllers/appointments.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/',       protect,                                    apptC.getAll);
router.post('/',      protect,                                    apptC.create);
router.get('/:id',    protect,                                    apptC.getOne);
router.put('/:id',    protect,                                    apptC.update);
router.delete('/:id', protect, authorize('superadmin','adminclinique'), apptC.remove);

module.exports = router;