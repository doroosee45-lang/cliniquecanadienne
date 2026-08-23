// routes/dashboard.routes.js
const router  = require('express').Router();
const dashC   = require('../controllers/dashboard.controller');
const { protect, authorize } = require('../middleware/auth');

// Route générique — dispatche automatiquement selon req.user.role.
// Un rôle non mappé (dont 'patient') retombe sur un agrégat clinique global :
// on exclut donc explicitement les comptes patient de ce endpoint.
const STAFF = ['superadmin','adminclinique','medecin','infirmier','sage_femme',
               'laborantin','radiologue','pharmacien','comptable','receptionniste'];
router.get('/',               protect, authorize(...STAFF), dashC.getStats);

// Routes spécifiques par rôle
router.get('/superadmin',     protect, authorize('superadmin'),                                      dashC.superAdminStats);
router.get('/adminclinique',  protect, authorize('superadmin','adminclinique'),                      dashC.adminCliniqueStats);
router.get('/medecin',        protect, authorize('superadmin','adminclinique','medecin'),             dashC.medecinStats);
router.get('/sage_femme',     protect, authorize('superadmin','adminclinique','sage_femme'),           dashC.sageFemmeStats);
router.get('/infirmier',      protect, authorize('superadmin','adminclinique','infirmier'),           dashC.infirmierStats);
router.get('/laborantin',     protect, authorize('superadmin','adminclinique','laborantin'),          dashC.laborantinStats);
router.get('/pharmacien',     protect, authorize('superadmin','adminclinique','pharmacien'),          dashC.pharmacienStats);
router.get('/receptionniste', protect, authorize('superadmin','adminclinique','receptionniste'),      dashC.receptionnisteStats);
router.get('/comptable',      protect, authorize('superadmin','adminclinique','comptable'),           dashC.comptableStats);
router.get('/radiologue',     protect, authorize('superadmin','adminclinique','radiologue'),          dashC.radiologueStats);

module.exports = router;