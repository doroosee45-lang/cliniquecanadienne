const router = require('express').Router();
const rc     = require('../controllers/recurring.controller');
const { protect } = require('../middleware/auth');

router.get('/',           protect, rc.getAll);
router.post('/',          protect, rc.create);
router.put('/:id',        protect, rc.update);
router.delete('/:id',     protect, rc.remove);
router.post('/:id/planifier', protect, rc.planifier);

module.exports = router;
