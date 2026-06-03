// routes/laboratory.routes.js
const router  = require('express').Router();
const labC    = require('../controllers/laboratory.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/catalogue',        protect,                                           labC.getCatalogue);
router.get('/',                 protect,                                           labC.getAll);
router.post('/',                protect, authorize('superadmin','medecin','infirmier'), labC.create);
router.get('/:id',              protect,                                           labC.getOne);
router.put('/:id/validate',     protect, authorize('superadmin','laborantin'),     labC.validate);
router.put('/:id/acquit',       protect, authorize('superadmin','medecin'),        labC.acquit);

module.exports = router;