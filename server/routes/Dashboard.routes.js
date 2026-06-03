// routes/dashboard.routes.js
const router  = require('express').Router();
const dashC   = require('../controllers/dashboard.controller');
const { protect, authorize } = require('../middleware/auth');

// Route générique — dispatche automatiquement selon req.user.role
router.get('/',               protect, dashC.getStats);

// Routes spécifiques par rôle
router.get('/superadmin',     protect, authorize('superadmin'),                                      dashC.superAdminStats);
router.get('/adminclinique',  protect, authorize('superadmin','adminclinique'),                      dashC.adminCliniqueStats);
router.get('/medecin',        protect, authorize('superadmin','adminclinique','medecin'),             dashC.medecinStats);
router.get('/infirmier',      protect, authorize('superadmin','adminclinique','infirmier'),           dashC.infirmierStats);
router.get('/laborantin',     protect, authorize('superadmin','adminclinique','laborantin'),          dashC.laborantinStats);
router.get('/pharmacien',     protect, authorize('superadmin','adminclinique','pharmacien'),          dashC.pharmacienStats);
router.get('/receptionniste', protect, authorize('superadmin','adminclinique','receptionniste'),      dashC.receptionnisteStats);
router.get('/comptable',      protect, authorize('superadmin','adminclinique','comptable'),           dashC.comptableStats);
router.get('/radiologue',     protect, authorize('superadmin','adminclinique','radiologue'),          dashC.radiologueStats);

module.exports = router;