// routes/hospitalization.routes.js
const router  = require('express').Router();
const hospC   = require('../controllers/hospitalization.controller');
const { protect, authorize } = require('../middleware/auth');

const CAN_WRITE = ['superadmin','adminclinique','medecin','infirmier'];

router.get('/stats',            protect, authorize(...CAN_WRITE), hospC.getStats);
router.get('/rooms',            protect, authorize(...CAN_WRITE), hospC.getRooms);
router.get('/',                 protect, authorize(...CAN_WRITE), hospC.getAll);
router.post('/',                protect, authorize(...CAN_WRITE), hospC.create);
router.post('/:id/notes',       protect, authorize(...CAN_WRITE), hospC.addNote);
router.put('/:id/discharge',    protect, authorize(...CAN_WRITE), hospC.discharge);

// P7-2 — sous-ressources du dossier de séjour
router.get('/:id/constantes',    protect, authorize(...CAN_WRITE), hospC.getConstantes);
router.post('/:id/constantes',   protect, authorize(...CAN_WRITE), hospC.addConstante);
router.get('/:id/traitements',   protect, authorize(...CAN_WRITE), hospC.getTraitements);
router.post('/:id/traitements',  protect, authorize(...CAN_WRITE), hospC.addTraitement);
// Correction 3 (relecture du 6 sept. 2026, FE-BUG-005) — "Valider traitement"
// n'avait aucune route à appeler, seul l'état React local était modifié.
router.put('/:id/traitements/:sid', protect, authorize(...CAN_WRITE), hospC.updateTraitement);
router.get('/:id/examens',       protect, authorize(...CAN_WRITE), hospC.getExamens);
router.post('/:id/examens',      protect, authorize(...CAN_WRITE), hospC.addExamen);
// Correction 3 (relecture du 6 sept. 2026, FE-BUG-005) — "Saisir résultat
// examen" idem : window.prompt() + état local uniquement, jamais persisté.
router.put('/:id/examens/:sid',  protect, authorize(...CAN_WRITE), hospC.updateExamen);
router.get('/:id/visites',       protect, authorize(...CAN_WRITE), hospC.getVisites);
router.post('/:id/visites',      protect, authorize(...CAN_WRITE), hospC.addVisite);
router.get('/:id/prescriptions', protect, authorize(...CAN_WRITE), hospC.getPrescriptionsSejour);
router.post('/:id/prescriptions',protect, authorize(...CAN_WRITE), hospC.addPrescriptionSejour);

// P7-1 — mise à jour générique (édition dossier, contact urgence, chambre/lit...).
// La fonction contrôleur existait déjà mais n'était routée nulle part.
router.put('/:id',              protect, authorize(...CAN_WRITE), hospC.update);

module.exports = router;