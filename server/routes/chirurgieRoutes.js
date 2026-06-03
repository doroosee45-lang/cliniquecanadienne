// backend/routes/chirurgieRoutes.js
const express = require('express');
const router = express.Router();
const chirurgieController = require('../controllers/chirurgieController');

// Routes principales
router.get('/', chirurgieController.getDossiers);
router.get('/stats', chirurgieController.getStats);
router.get('/:id', chirurgieController.getDossierById);
router.post('/', chirurgieController.createDossier);
router.put('/:id', chirurgieController.updateDossier);

// Sous-ressources
router.post('/:id/bilan', chirurgieController.addBilan);
router.post('/:id/suivi', chirurgieController.addSuivi);
router.post('/:id/complications', chirurgieController.addComplication);

module.exports = router;