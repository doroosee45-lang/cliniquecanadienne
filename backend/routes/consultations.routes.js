// routes/consultations.routes.js
const router    = require('express').Router();
const consultC  = require('../controllers/consultations.controller');
const { protect, authorize } = require('../middleware/auth');

const CAN_READ = ['superadmin','adminclinique','medecin','infirmier'];

router.get('/',       protect, authorize(...CAN_READ),                       consultC.getAll);
// Correction 6 (relecture du 6 sept. 2026, FE-BUG-008) — dédié plutôt que
// d'élargir /admin/users (réservé à superadmin/adminclinique) : infirmier
// peut créer une consultation (ligne suivante) mais ne peut pas lister le
// personnel via l'endpoint admin. Avant /:id pour ne pas être capturé par lui.
router.get('/medecins', protect, authorize('superadmin','medecin','infirmier'), consultC.getMedecins);
router.post('/',      protect, authorize('superadmin','medecin','infirmier'), consultC.create);
router.get('/:id',    protect, authorize(...CAN_READ),                       consultC.getOne);
// FACTURATION-CONSULTATION-001 (rapport de clôture du 11 sept. 2026) — même
// niveau d'accès que le reste du module (CAN_READ) : consulter/envoyer une
// facture déjà générée n'est pas plus sensible que consulter la consultation
// elle-même, qui l'inclut déjà (getOne).
router.get('/:id/facture',          protect, authorize(...CAN_READ), consultC.getFacture);
router.post('/:id/facture/envoyer', protect, authorize(...CAN_READ), consultC.envoyerFacture);
router.put('/:id',    protect, authorize('superadmin','medecin'),             consultC.update);
router.delete('/:id', protect, authorize('superadmin','adminclinique'),       consultC.remove);

module.exports = router;