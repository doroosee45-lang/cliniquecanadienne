// routes/pharmacy.routes.js
const router   = require('express').Router();
const pharmaC  = require('../controllers/pharmacy.controller');
const { protect, authorize } = require('../middleware/auth');
const { uploadMedPhoto }   = require('../middleware/upload');

const CAN_MANAGE = ['superadmin','adminclinique','pharmacien'];
// ACCES-PHARMACIE-001 (correction du 13 sept. 2026) — 'medecin' retiré : le
// module Pharmacie (stock, mouvements, commandes, ventes, statistiques,
// file de dispensation) est désormais exclusivement réservé à
// pharmacien/adminclinique/superadmin (+ infirmier, accès déjà existant et
// hors périmètre de cette correction). Un médecin ne doit recevoir aucune
// donnée de ces routes. Le seul besoin métier réel identifié pour ce rôle
// (sélectionner un médicament réel — nom/prix — pour prescrire/facturer un
// traitement en urgence, cf. Urgences.jsx) est servi par la route dédiée
// /catalogue-urgence ci-dessous, dont le contrôleur ne projette QUE les
// champs de catalogue/tarif — jamais stock/coûts/lots/mouvements.
const CAN_READ   = ['superadmin','adminclinique','pharmacien','infirmier'];

// Catalogue minimal (nom + prix uniquement) — voir commentaire ci-dessus.
// Même convention de nommage que /laboratory/catalogue et /radiology/catalogue.
router.get('/catalogue',                        protect, authorize(...CAN_READ, 'medecin'), pharmaC.getCatalogueMinimal);

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