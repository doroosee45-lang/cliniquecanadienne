// routes/settings.routes.js
const router     = require('express').Router();
const settingsC  = require('../controllers/settings.controller');
const tasksC     = require('../controllers/tasks.controller');
const suppliersC = require('../controllers/suppliers.controller');
const { protect, authorize } = require('../middleware/auth');
const { authorizePermission } = require('../utils/permissions');
const { ADMIN, STAFF } = require('../utils/roles');

// ── Paramètres clinique ───────────────────────────────────────
router.get('/',         protect, authorize(...ADMIN), settingsC.getAll);
router.post('/',        protect, authorize(...ADMIN), settingsC.upsert);

// ── Rôles & Permissions (Sous-phase 5.5.b) ─────────────────────
// superadmin uniquement — donnée sensible (contrôle d'accès de tout le
// personnel), contrairement au reste de /settings ouvert à adminclinique.
router.get('/roles-permissions', protect, authorize('superadmin'), settingsC.getRolesPermissions);
router.put('/roles-permissions', protect, authorize('superadmin'), settingsC.updateRolesPermissions);

// ── Sauvegarde externe (Sous-phase 5.5.c) ──────────────────────
// superadmin uniquement — export complet de la base de données.
router.post('/backup',        protect, authorize('superadmin'), settingsC.triggerBackup);
router.get('/backup/status',  protect, authorize('superadmin'), settingsC.getBackupStatus);

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
// Correction 3 — POST/PUT manquants (audit du 4 sept. 2026) : Room n'était
// peuplé que par utils/seed.js, aucune route de gestion n'existait.
router.get('/rooms',          protect, authorize(...STAFF),   settingsC.getRooms);
router.post('/rooms',         protect, authorize(...ADMIN),   settingsC.createRoom);
router.put('/rooms/:id',      protect, authorize(...ADMIN),   settingsC.updateRoom);

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
// Sous-phase 5.5.b — POST /suppliers sert de démonstration réelle de la
// matrice éditable : authorize(...ADMIN) (statique) remplacé par
// authorizePermission('creation') (dynamique, lit la matrice réellement
// stockée). Choisie précisément parce qu'elle est peu sensible et peu
// utilisée — modifier la permission "creation" d'un rôle change réellement
// l'accès à CETTE route, sans toucher au reste de l'application (migrer
// l'ensemble des routes vers ce mécanisme est un chantier distinct, hors
// périmètre ici).
router.get('/suppliers',      protect, authorize(...ADMIN),           suppliersC.getSuppliers);
router.post('/suppliers',     protect, authorizePermission('creation'), suppliersC.createSupplier);

module.exports = router;