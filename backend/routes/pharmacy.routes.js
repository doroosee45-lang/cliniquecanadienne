// routes/pharmacy.routes.js
const router   = require('express').Router();
const pharmaC  = require('../controllers/pharmacy.controller');
const { protect, authorize } = require('../middleware/auth');

const CAN_MANAGE = ['superadmin','adminclinique','pharmacien'];

router.get('/prescriptions',                    protect,                              pharmaC.getPrescriptions);
router.put('/prescriptions/:id/dispenser',      protect, authorize(...CAN_MANAGE),    pharmaC.dispenser);

// Alias français : /pharmacie/medicaments
router.get('/medicaments',                      protect,                              pharmaC.getAll);
router.post('/medicaments',                     protect, authorize(...CAN_MANAGE),    pharmaC.create);

// Stats KPI
router.get('/stats',                            protect,                              pharmaC.getStats);

// Mouvements agrégés
router.get('/mouvements',                       protect,                              pharmaC.getMovements);

// Ventes
router.post('/ventes',                          protect, authorize(...CAN_MANAGE),    pharmaC.createVente);

// Commandes & fournisseurs
router.get('/commandes',                        protect,                              pharmaC.getCommandes);
router.post('/commandes',                       protect, authorize(...CAN_MANAGE),    pharmaC.createCommande);
router.get('/fournisseurs',                     protect,                              pharmaC.getFournisseurs);

router.get('/',                                 protect,                              pharmaC.getAll);
router.post('/',                                protect, authorize(...CAN_MANAGE),    pharmaC.create);
router.get('/:id',                              protect,                              pharmaC.getOne);
router.put('/:id',                              protect, authorize(...CAN_MANAGE),    pharmaC.update);
router.post('/:id/mouvement',                   protect, authorize(...CAN_MANAGE),    pharmaC.mouvement);

module.exports = router;