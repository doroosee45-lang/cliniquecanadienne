const router = require('express').Router();
const pc     = require('../controllers/portal.controller');
const { protect, authorize } = require('../middleware/auth');

const PATIENT = protect, ROLE = authorize('patient');

router.get('/me',                    PATIENT, ROLE, pc.getMe);
router.get('/dashboard',             PATIENT, ROLE, pc.getDashboard);
router.get('/appointments',          PATIENT, ROLE, pc.getAppointments);
router.get('/booking-options',       PATIENT, ROLE, pc.getBookingOptions);
router.post('/appointments',         PATIENT, ROLE, pc.createAppointment);
router.put('/appointments/:id/cancel',PATIENT, ROLE, pc.cancelAppointment);
router.get('/prescriptions',         PATIENT, ROLE, pc.getPrescriptions);
router.get('/lab-results',           PATIENT, ROLE, pc.getLabResults);
router.get('/imaging',               PATIENT, ROLE, pc.getImaging);
router.get('/invoices',              PATIENT, ROLE, pc.getInvoices);
router.get('/vaccinations',          PATIENT, ROLE, pc.getVaccinations);
router.get('/consultations',         PATIENT, ROLE, pc.getConsultations);
router.get('/hospitalizations',      PATIENT, ROLE, pc.getHospitalizations);
router.get('/documents',             PATIENT, ROLE, pc.getDocuments);
router.get('/documents/:id/download',PATIENT, ROLE, pc.downloadDocument);
router.get('/messages/contacts',     PATIENT, ROLE, pc.getMessageContacts);
router.post('/messages',             PATIENT, ROLE, pc.getOrCreatePatientConversation);
router.get('/notifications',         PATIENT, ROLE, pc.getNotifications);
router.put('/notifications/read-all',PATIENT, ROLE, pc.markNotificationsRead);
router.put('/profile',               PATIENT, ROLE, pc.updateProfile);
router.put('/change-password',       PATIENT, ROLE, pc.changePassword);
router.post('/ai/chat',              PATIENT, ROLE, pc.aiChat);

module.exports = router;
