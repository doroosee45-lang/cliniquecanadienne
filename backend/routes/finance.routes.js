// routes/finance.routes.js
const router  = require('express').Router();
const finC    = require('../controllers/finance.controller');
const { protect, authorize } = require('../middleware/auth');

const CAN_ACCESS = ['superadmin','adminclinique','comptable'];

router.get('/stats',        protect, authorize(...CAN_ACCESS), finC.stats);

// Aliases attendus par le frontend
router.get('/kpis',         protect, authorize(...CAN_ACCESS), finC.stats);
router.get('/factures',     protect, authorize(...CAN_ACCESS), finC.getAll);
router.post('/factures',    protect, authorize(...CAN_ACCESS), finC.create);

// Enregistrer un revenu direct (crée une facture payée)
router.post('/revenus', protect, authorize(...CAN_ACCESS), finC.createRevenu);

// Revenus = factures payées ou partiellement payées
// AUDIT-19-7 (18 sept. 2026) — logique déplacée vers finance.controller.js
// (délégation systématique à un contrôleur nommé, convention universelle du
// projet jusqu'ici rompue par ces deux seules routes), comportement inchangé.
router.get('/revenus', protect, authorize(...CAN_ACCESS), finC.getRevenus);

// Paiements = historique de paiements des factures
router.get('/paiements', protect, authorize(...CAN_ACCESS), finC.getPaiements);

router.get('/depenses',            protect, authorize(...CAN_ACCESS), finC.getDepenses);
router.post('/depenses',           protect, authorize(...CAN_ACCESS), finC.createDepense);
router.put('/depenses/:id/valider',protect, authorize(...CAN_ACCESS), finC.validerDepense);
router.get('/salaires',            protect, authorize(...CAN_ACCESS), finC.getSalaires);
router.put('/salaires/:id/payer',  protect, authorize(...CAN_ACCESS), finC.payerSalaire);
router.get('/assurances',          protect, authorize(...CAN_ACCESS), finC.getAssurances);
router.get('/budget',              protect, authorize(...CAN_ACCESS), finC.getBudget);
router.put('/budget/:categorie',   protect, authorize(...CAN_ACCESS), finC.updateBudget);
router.post('/caisse',    protect, authorize(...CAN_ACCESS), finC.caisse);

router.get('/bilan', protect, authorize(...CAN_ACCESS), finC.getBilan);
router.put('/bilan', protect, authorize(...CAN_ACCESS), finC.updateBilanManuel);

router.get('/',             protect, authorize(...CAN_ACCESS), finC.getAll);
router.post('/',            protect, authorize(...CAN_ACCESS), finC.create);
router.get('/:id',          protect, authorize(...CAN_ACCESS), finC.getOne);
router.put('/:id',          protect, authorize(...CAN_ACCESS), finC.updateStatut);
router.post('/:id/paiement',protect, authorize(...CAN_ACCESS), finC.addPayment);

module.exports = router;