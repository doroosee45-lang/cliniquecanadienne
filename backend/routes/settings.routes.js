// routes/settings.routes.js
const router     = require('express').Router();
const settingsC  = require('../controllers/settings.controller');
const tasksC     = require('../controllers/tasks.controller');
const suppliersC = require('../controllers/suppliers.controller');
const { protect, authorize } = require('../middleware/auth');
const { ADMIN, STAFF } = require('../utils/roles');

// ── Paramètres clinique ───────────────────────────────────────
router.get('/',         protect, authorize(...ADMIN), settingsC.getAll);
router.post('/',        protect, authorize(...ADMIN), settingsC.upsert);

// ── Gestion utilisateurs ──────────────────────────────────────
router.get('/users',          protect, authorize(...ADMIN),   settingsC.getUsers);
router.post('/users',         protect, authorize('superadmin'), settingsC.createUser);
router.put('/users/:id',      protect, authorize('superadmin'), settingsC.updateUser);
router.delete('/users/:id',   protect, authorize('superadmin'), settingsC.deactivateUser);

// ── Services médicaux ─────────────────────────────────────────
router.get('/services',       protect, authorize(...STAFF),   settingsC.getServices);
router.post('/services',      protect, authorize(...ADMIN),   settingsC.createService);
router.put('/services/:id',   protect, authorize(...ADMIN),   settingsC.updateService);

// ── Salles ────────────────────────────────────────────────────
router.get('/rooms',          protect, authorize(...STAFF),   settingsC.getRooms);

// ── KPIs administration ───────────────────────────────────────
router.get('/kpis',           protect, authorize(...ADMIN),   settingsC.getKpis);

// ── Assurances ────────────────────────────────────────────────
router.get('/insurances',     protect, authorize(...STAFF),   settingsC.getInsurances);
router.post('/insurances',    protect, authorize(...ADMIN),   settingsC.createInsurance);
router.put('/insurances/:id', protect, authorize(...ADMIN),   settingsC.updateInsurance);

// ── Tâches administratives (AUDIT-11-8) ────────────────────────
router.get('/tasks',          protect, authorize(...ADMIN),   tasksC.getTasks);
router.post('/tasks',         protect, authorize(...ADMIN),   tasksC.createTask);
router.put('/tasks/:id',      protect, authorize(...ADMIN),   tasksC.updateStatut);

// ── Fournisseurs (AUDIT-11-8) ───────────────────────────────────
router.get('/suppliers',      protect, authorize(...ADMIN),   suppliersC.getSuppliers);
router.post('/suppliers',     protect, authorize(...ADMIN),   suppliersC.createSupplier);

module.exports = router;