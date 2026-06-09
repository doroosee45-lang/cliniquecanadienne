const router = require('express').Router();
const c      = require('../controllers/maternityController');
const { protect, authorize } = require('../middleware/auth');

const CAN = ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'sage_femme'];

router.get('/stats',                 protect, authorize(...CAN), c.getStats);

// Grossesses
router.get('/grossesses',            protect, authorize(...CAN), c.getAll);
router.post('/grossesses',           protect, authorize(...CAN), c.create);
router.get('/grossesses/:id',        protect, authorize(...CAN), c.getOne);
router.put('/grossesses/:id',        protect, authorize(...CAN), c.update);
router.post('/grossesses/:id/cpn',   protect, authorize(...CAN), c.addCPN);
router.post('/grossesses/:id/echo',  protect, authorize(...CAN), c.addEcho);
router.put('/grossesses/:id/travail',protect, authorize(...CAN), c.updateTravail);
router.post('/grossesses/:id/postnatal', protect, authorize(...CAN), c.addPostnatal);

// Accouchements
router.get('/accouchements',         protect, authorize(...CAN), c.getDeliveries);
router.post('/accouchements',        protect, authorize(...CAN), c.createDelivery);

// Nouveau-nés
router.get('/nouveau-nes',           protect, authorize(...CAN), c.getNewborns);
router.post('/nouveau-nes',          protect, authorize(...CAN), c.createNewborn);
router.put('/nouveau-nes/:id',       protect, authorize(...CAN), c.updateNewborn);

module.exports = router;
