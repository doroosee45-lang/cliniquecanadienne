const router  = require('express').Router();
const docC    = require('../controllers/document.controller');
const { protect, authorize } = require('../middleware/auth');
const { uploadDocument } = require('../middleware/upload');
const { ADMIN } = require('../utils/roles');

router.get('/',   protect, authorize(...ADMIN), docC.getAll);
router.post('/',  protect, authorize(...ADMIN), uploadDocument.single('fichier'), docC.create);
router.get('/:id',protect, authorize(...ADMIN), docC.getOne);

module.exports = router;
