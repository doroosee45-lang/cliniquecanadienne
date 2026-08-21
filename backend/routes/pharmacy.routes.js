// routes/pharmacy.routes.js
const router   = require('express').Router();
const pharmaC  = require('../controllers/pharmacy.controller');
const { protect, authorize } = require('../middleware/auth');
const { uploadMedPhoto }   = require('../middleware/upload');

const CAN_MANAGE = ['superadmin','adminclinique','pharmacien'];
const CAN_READ   = ['superadmin','adminclinique','pharmacien','medecin','infirmier'];

router.get('/prescriptions',                    protect, authorize(...CAN_READ),      pharmaC.getPrescriptions);
router.put('/prescriptions/:id/dispenser',      protect, authorize(...CAN_MANAGE),    pharmaC.dispenser);

// Alias français : /pharmacie/medicaments
router.get('/medicaments',                      protect, authorize(...CAN_READ),      pharmaC.getAll);
router.post('/medicaments',                     protect, authorize(...CAN_MANAGE),    pharmaC.create);

// Stats KPI
router.get('/stats',                            protect, authorize(...CAN_READ),      pharmaC.getStats);

// Mouvements agrégés
router.get('/mouvements',                       protect, authorize(...CAN_READ),      pharmaC.getMovements);

// Ventes
router.post('/ventes',                          protect, authorize(...CAN_MANAGE),    pharmaC.createVente);

// Commandes & fournisseurs
router.get('/commandes',                        protect, authorize(...CAN_MANAGE),    pharmaC.getCommandes);
router.post('/commandes',                       protect, authorize(...CAN_MANAGE),    pharmaC.createCommande);
router.put('/commandes/:id/reception',          protect, authorize(...CAN_MANAGE),    pharmaC.receptionCommande);
router.get('/fournisseurs',                     protect, authorize(...CAN_MANAGE),    pharmaC.getFournisseurs);

router.get('/',                                 protect, authorize(...CAN_READ),      pharmaC.getAll);
router.post('/',                                protect, authorize(...CAN_MANAGE),    pharmaC.create);
router.get('/:id',                              protect, authorize(...CAN_READ),      pharmaC.getOne);
router.put('/:id',                              protect, authorize(...CAN_MANAGE),    pharmaC.update);
router.delete('/:id',                           protect, authorize(...CAN_MANAGE),    pharmaC.remove);
router.post('/:id/photo',                       protect, authorize(...CAN_MANAGE),    uploadMedPhoto.single('photo'), pharmaC.uploadPhoto);
router.post('/:id/mouvement',                   protect, authorize(...CAN_MANAGE),    pharmaC.mouvement);

module.exports = router;