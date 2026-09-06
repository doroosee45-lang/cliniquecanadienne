// routes/hr.routes.js
const router  = require('express').Router();
const hrC     = require('../controllers/hr.controller');
const { protect, authorize } = require('../middleware/auth');
const { ADMIN, STAFF } = require('../utils/roles');

// Toute personne salariée peut soumettre sa propre demande de congé — la
// vérification de propriété (staff.utilisateur === req.user._id) ou du rôle
// admin se fait dans le contrôleur (hr.controller.js::leave).

// Alias attendus par le frontend
router.get('/staff',     protect, authorize(...ADMIN), hrC.getAll);
router.get('/leaves',    protect, authorize(...ADMIN), hrC.getLeaves);
router.get('/schedules', protect, authorize(...ADMIN), hrC.getSchedules);

// Sous-phase 5.5.a — Recrutement (Candidature). Doit impérativement précéder
// `/:id` ci-dessous : sinon GET /hr/candidatures serait capté par
// `router.get('/:id', ...)` (id="candidatures") avant d'atteindre cette
// route, comme pour /staff /leaves /schedules ci-dessus.
router.get('/candidatures',          protect, authorize(...ADMIN), hrC.getCandidatures);
router.post('/candidatures',         protect, authorize(...ADMIN), hrC.createCandidature);
router.put('/candidatures/:id',      protect, authorize(...ADMIN), hrC.updateCandidatureStatut);

router.get('/',          protect, authorize(...ADMIN), hrC.getAll);
router.post('/',         protect, authorize(...ADMIN), hrC.create);
router.get('/:id',       protect, authorize(...ADMIN), hrC.getOne);
router.put('/:id',       protect, authorize(...ADMIN), hrC.update);
router.post('/:id/conge',            protect, authorize(...STAFF), hrC.leave);
router.put('/:id/conge/:congeId',    protect, authorize(...ADMIN), hrC.updateLeaveStatus);
router.post('/:id/planning',         protect, authorize(...ADMIN), hrC.addSchedule);
router.put('/:id/planning/publier',  protect, authorize(...ADMIN), hrC.publishSchedules);

module.exports = router;