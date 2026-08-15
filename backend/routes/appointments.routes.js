// routes/appointments.routes.js
const router  = require('express').Router();
const apptC   = require('../controllers/appointments.controller');
const { protect, authorize } = require('../middleware/auth');

// La prise de rendez-vous est un acte administratif/clinique — un compte
// patient (portail, en lecture seule sur /portal/appointments) ne doit pas
// pouvoir créer/modifier un rendez-vous en appelant directement cette API.
const CAN_WRITE = ['superadmin','adminclinique','medecin','infirmier','receptionniste'];

router.get('/',       protect, authorize(...CAN_WRITE), apptC.getAll);
router.post('/',      protect, authorize(...CAN_WRITE), apptC.create);
router.get('/:id',    protect, authorize(...CAN_WRITE), apptC.getOne);
router.put('/:id',    protect, authorize(...CAN_WRITE), apptC.update);
router.delete('/:id', protect, authorize('superadmin','adminclinique'), apptC.remove);

module.exports = router;