// backend/routes/chirurgieRoutes.js
const express = require('express');
const router = express.Router();
const chirurgieController = require('../controllers/chirurgieController');
const { protect } = require('../middleware/auth');

// Routes principales
router.get('/', protect, chirurgieController.getDossiers);
router.get('/stats', protect, chirurgieController.getStats);
router.get('/:id', protect, chirurgieController.getDossierById);
router.post('/', protect, chirurgieController.createDossier);
router.put('/:id', protect, chirurgieController.updateDossier);

// Sous-ressources
router.post('/:id/bilan', protect, chirurgieController.addBilan);
router.post('/:id/suivi', protect, chirurgieController.addSuivi);
router.post('/:id/complications', protect, chirurgieController.addComplication);

module.exports = router;