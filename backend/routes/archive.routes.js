const router   = require('express').Router();
const archiveC = require('../controllers/archive.controller');
const { protect, authorize } = require('../middleware/auth');

const ADMIN = ['superadmin', 'adminclinique'];

// ── Routes fixes (avant /:id) ─────────────────────────────────
router.get('/stats',         protect, authorize(...ADMIN), archiveC.getStats);
router.get('/export',        protect, authorize(...ADMIN), archiveC.exportAll);
router.post('/bulk-restore', protect, authorize(...ADMIN), archiveC.bulkRestore);
router.post('/bulk-delete',  protect, authorize(...ADMIN), archiveC.bulkDelete);
router.put('/config',        protect, authorize(...ADMIN), archiveC.updateConfig);

// ── CRUD principal ────────────────────────────────────────────
router.get('/',              protect, authorize(...ADMIN), archiveC.getAll);
router.post('/',             protect, authorize(...ADMIN), archiveC.create);
router.post('/:id/restore',  protect, authorize(...ADMIN), archiveC.restore);
router.delete('/:id',        protect, authorize(...ADMIN), archiveC.remove);

module.exports = router;
