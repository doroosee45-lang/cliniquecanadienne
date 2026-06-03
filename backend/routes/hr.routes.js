// routes/hr.routes.js
const router  = require('express').Router();
const hrC     = require('../controllers/hr.controller');
const { protect, authorize } = require('../middleware/auth');

const ADMIN = ['superadmin','adminclinique'];

// Alias attendus par le frontend
router.get('/staff',     protect, authorize(...ADMIN), hrC.getAll);
router.get('/leaves',    protect,                      (req, res) => res.json({ success: true, leaves: [] }));
router.get('/schedules', protect,                      (req, res) => res.json({ success: true, schedules: [] }));

router.get('/',          protect, authorize(...ADMIN), hrC.getAll);
router.post('/',         protect, authorize(...ADMIN), hrC.create);
router.get('/:id',       protect, authorize(...ADMIN), hrC.getOne);
router.put('/:id',       protect, authorize(...ADMIN), hrC.update);
router.post('/:id/conge',protect,                      hrC.leave);

module.exports = router;