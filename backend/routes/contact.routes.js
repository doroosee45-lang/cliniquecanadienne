const router = require('express').Router();
const contactC = require('../controllers/contact.controller');

// Public, non authentifié — formulaire de contact de la page d'accueil.
router.post('/', contactC.create);

module.exports = router;
