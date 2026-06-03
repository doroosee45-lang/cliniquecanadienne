// routes/radiology.routes.js
const router   = require('express').Router();
const radioC   = require('../controllers/radiology.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/catalogue',        protect,                                    radioC.getCatalogue);
router.get('/',                 protect,                                    radioC.getAll);
router.post('/',                protect, authorize('superadmin','medecin'), radioC.create);
router.put('/:id/rapport',      protect, authorize('superadmin','radiologue'), radioC.rapport);

module.exports = router;