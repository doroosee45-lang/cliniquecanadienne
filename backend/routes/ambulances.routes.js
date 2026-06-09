const router = require('express').Router();
const c      = require('../controllers/urgencesController');
const { protect, authorize } = require('../middleware/auth');

const CAN = ['superadmin','adminclinique','medecin','infirmier','sage_femme'];

router.get('/',                        protect, authorize(...CAN), c.getAmbulances);
router.post('/missions',               protect, authorize(...CAN), c.assignMission);
router.put('/:numero/retour',          protect, authorize(...CAN), c.retourAmbulance);

module.exports = router;
