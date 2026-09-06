// routes/audit.routes.js
const router  = require('express').Router();
const auditC  = require('../controllers/audit.controller');
const { protect, authorize } = require('../middleware/auth');
const { ADMIN } = require('../utils/roles');

router.get('/',            protect, authorize(...ADMIN), auditC.getAll);
router.get('/connexions',  protect, authorize(...ADMIN), auditC.getConnexions);
router.get('/suspects',    protect, authorize(...ADMIN), auditC.getSuspects);
router.get('/stats',       protect, authorize(...ADMIN), auditC.getStats);
router.post('/archive',    protect, authorize(...ADMIN), auditC.archiveLogs);
// Sous-phase 5.7 — "Enquêter"/"Clôturer"/"Notifier admin"/"Créer alerte"
// (Audit.jsx), jusqu'ici de purs faux succès sans persistance réelle.
router.put('/suspects/:id/statut',    protect, authorize(...ADMIN), auditC.updateSuspectStatut);
router.post('/suspects/:id/notifier', protect, authorize(...ADMIN), auditC.notifySuspect);
router.post('/alertes',               protect, authorize(...ADMIN), auditC.createAlert);

module.exports = router;
