const router = require('express').Router();
const pc     = require('../controllers/portal.controller');
const { protect, authorize } = require('../middleware/auth');

const PATIENT = protect, ROLE = authorize('patient');

router.get('/me',                    PATIENT, ROLE, pc.getMe);
router.get('/appointments',          PATIENT, ROLE, pc.getAppointments);
router.get('/prescriptions',         PATIENT, ROLE, pc.getPrescriptions);
router.get('/lab-results',           PATIENT, ROLE, pc.getLabResults);
router.get('/imaging',               PATIENT, ROLE, pc.getImaging);
router.get('/invoices',              PATIENT, ROLE, pc.getInvoices);
router.get('/notifications',         PATIENT, ROLE, pc.getNotifications);
router.put('/notifications/read-all',PATIENT, ROLE, pc.markNotificationsRead);
router.put('/profile',               PATIENT, ROLE, pc.updateProfile);
router.put('/change-password',       PATIENT, ROLE, pc.changePassword);

module.exports = router;
