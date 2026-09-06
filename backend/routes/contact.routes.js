const router = require('express').Router();
const contactC = require('../controllers/contact.controller');
const { protect, authorize } = require('../middleware/auth');
const { ADMIN } = require('../utils/roles');

// Public, non authentifié — formulaire de contact de la page d'accueil.
router.post('/', contactC.create);

// Correction 5 — consultation des messages reçus, réservée au personnel
// (admin + réception, rôle naturellement en charge du premier contact
// avec le public).
router.get('/',     protect, authorize(...ADMIN, 'receptionniste'), contactC.getAll);
router.put('/:id',  protect, authorize(...ADMIN, 'receptionniste'), contactC.markTraite);

module.exports = router;
