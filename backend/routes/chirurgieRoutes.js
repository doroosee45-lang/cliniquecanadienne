// backend/routes/chirurgieRoutes.js
const express = require('express');
const router = express.Router();
const chirurgieController = require('../controllers/chirurgieController');
const { protect, authorize } = require('../middleware/auth');

// Aligné sur la convention du bloc opératoire (blocoperatoire.routes.js),
// qui partage le même modèle DossierChirurgical.
const CHIR_ROLES  = ['superadmin', 'adminclinique', 'medecin', 'infirmier'];
const CHIR_MANAGE = ['superadmin', 'adminclinique', 'medecin'];

// Routes principales
router.get('/', protect, authorize(...CHIR_ROLES), chirurgieController.getDossiers);
router.get('/stats', protect, authorize(...CHIR_ROLES), chirurgieController.getStats);
router.get('/:id', protect, authorize(...CHIR_ROLES), chirurgieController.getDossierById);
router.post('/', protect, authorize(...CHIR_MANAGE), chirurgieController.createDossier);
router.put('/:id', protect, authorize(...CHIR_MANAGE), chirurgieController.updateDossier);

// Sous-ressources
router.post('/:id/bilan', protect, authorize(...CHIR_ROLES), chirurgieController.addBilan);
router.post('/:id/suivi', protect, authorize(...CHIR_MANAGE), chirurgieController.addSuivi);
router.post('/:id/complications', protect, authorize(...CHIR_MANAGE), chirurgieController.addComplication);

module.exports = router;