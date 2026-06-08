// routes/index.js  ─── Point d'entrée unique de toutes les routes API
// Usage dans app.js : app.use('/api', require('./routes'));

const router = require('express').Router();

router.use('/auth',             require('./auth.routes'));
router.use('/dashboard',        require('./dashboard.routes'));
router.use('/patients',         require('./patients.routes'));
router.use('/appointments',     require('./appointments.routes'));
router.use('/recurring',        require('./recurring.routes'));
router.use('/consultations',    require('./consultations.routes'));
router.use('/hospitalization',  require('./hospitalization.routes'));
router.use('/hospitalisations', require('./hospitalization.routes'));
router.use('/chambres',         require('./hospitalization.routes'));  // alias → /rooms
router.use('/laboratory',       require('./laboratory.routes'));
router.use('/laboratoire',      require('./laboratory.routes'));   // alias français
router.use('/radiology',        require('./radiology.routes'));
router.use('/imagerie',         require('./radiology.routes'));   // alias français
router.use('/pharmacy',         require('./pharmacy.routes'));
router.use('/pharmacie',        require('./pharmacy.routes'));   // alias français
router.use('/finance',          require('./finance.routes'));
router.use('/hr',               require('./hr.routes'));
router.use('/messages',         require('./messages.routes'));
router.use('/notifications',    require('./notifications.routes'));
router.use('/audit',            require('./audit.routes'));
router.use('/archive',          require('./archive.routes'));
router.use('/archives',         require('./archive.routes'));  // alias pluriel (frontend)
router.use('/analytics',        require('./analytics.routes'));
router.use('/prescriptions',    require('./prescriptions.routes'));
router.use('/settings',         require('./settings.routes'));
router.use('/chirurgie',        require('./chirurgieRoutes'));
router.use('/blocoperatoire',   require('./blocoperatoire.routes')); // Bloc opératoire
router.use('/portal',           require('./portal.routes'));         // Portail patient
router.use('/ai',               require('./ai.routes'));              // Intelligence Artificielle
// Alias admin/* → settings/*
router.use('/admin',            require('./settings.routes'));

module.exports = router;