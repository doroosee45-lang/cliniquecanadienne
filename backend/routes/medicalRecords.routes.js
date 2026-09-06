// routes/medicalRecords.routes.js
const router = require('express').Router();
const medicalRecordsC = require('../controllers/medicalRecordsController');
const { protect } = require('../middleware/auth');

// Pas d'authorize(...roles) statique ici : la matrice de permissions est
// appliquée par collection (types réellement interrogés) à l'intérieur du
// contrôleur, pas au niveau de la route — voir medicalRecordsController.js::
// SOURCES. Un rôle sans accès à aucune des 9 collections (ex. comptable,
// receptionniste) reste protégé (authentifié requis) mais reçoit toujours
// un résultat vide, jamais une donnée hors de sa matrice de rôle réelle.
router.get('/search', protect, medicalRecordsC.search);

module.exports = router;
