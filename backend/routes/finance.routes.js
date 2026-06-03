// routes/finance.routes.js
const router  = require('express').Router();
const finC    = require('../controllers/finance.controller');
const { protect, authorize } = require('../middleware/auth');
const Invoice = require('../models/Invoice');

const CAN_ACCESS = ['superadmin','adminclinique','comptable'];

router.get('/stats',        protect, authorize(...CAN_ACCESS), finC.stats);

// Aliases attendus par le frontend
router.get('/kpis',         protect, authorize(...CAN_ACCESS), finC.stats);
router.get('/factures',     protect, authorize(...CAN_ACCESS), finC.getAll);
router.post('/factures',    protect, authorize(...CAN_ACCESS), finC.create);

// Revenus = factures payées
router.get('/revenus', protect, authorize(...CAN_ACCESS), async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const items = await Invoice.find({ statut: 'payee' })
      .populate('patient', 'nom prenom').sort('-date_facture').limit(Number(limit));
    res.json({ success: true, revenus: items });
  } catch (err) { next(err); }
});

// Paiements = historique de paiements des factures
router.get('/paiements', protect, authorize(...CAN_ACCESS), async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const invoices = await Invoice.find({ 'paiements.0': { $exists: true } })
      .populate('patient', 'nom prenom').sort('-date_facture').limit(Number(limit));
    const paiements = invoices.flatMap(inv =>
      inv.paiements.map(p => ({ ...p.toObject(), facture: inv.numero_facture, patient: inv.patient }))
    );
    res.json({ success: true, paiements });
  } catch (err) { next(err); }
});

// Dépenses, salaires, assurances — stubs (pas de modèle dédié encore)
router.get('/depenses',   protect, authorize(...CAN_ACCESS), (req, res) => res.json({ success: true, depenses: [] }));
router.get('/salaires',   protect, authorize(...CAN_ACCESS), (req, res) => res.json({ success: true, salaires: [] }));
router.get('/assurances', protect,                           (req, res) => res.json({ success: true, assurances: [] }));
router.post('/caisse',    protect, authorize(...CAN_ACCESS), (req, res) => res.json({ success: true, message: 'Enregistré.' }));

router.get('/',             protect, authorize(...CAN_ACCESS), finC.getAll);
router.post('/',            protect, authorize(...CAN_ACCESS), finC.create);
router.get('/:id',          protect,                           finC.getOne);
router.post('/:id/paiement',protect, authorize(...CAN_ACCESS), finC.addPayment);

module.exports = router;