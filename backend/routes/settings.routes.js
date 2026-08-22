// routes/settings.routes.js
const router     = require('express').Router();
const settingsC  = require('../controllers/settings.controller');
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');

const ADMIN = ['superadmin','adminclinique'];
// Données de référence (services, salles, assurances) consultées par de
// nombreux formulaires métier — ouvert à tout le personnel, jamais aux patients.
const STAFF = ['superadmin','adminclinique','medecin','infirmier','sage_femme',
               'laborantin','radiologue','pharmacien','comptable','receptionniste'];

// ── Paramètres clinique ───────────────────────────────────────
router.get('/',         protect, authorize(...ADMIN), settingsC.getAll);
router.post('/',        protect, authorize(...ADMIN), settingsC.upsert);

// ── Gestion utilisateurs ──────────────────────────────────────
router.get('/users',          protect, authorize(...ADMIN),   settingsC.getUsers);
router.post('/users',         protect, authorize('superadmin'), settingsC.createUser);
router.put('/users/:id',      protect, authorize('superadmin'), settingsC.updateUser);
router.delete('/users/:id',   protect, authorize('superadmin'), async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { statut:'inactif' });
    res.json({ success:true, message:'Utilisateur désactivé.' });
  } catch (err) { next(err); }
});

// ── Services médicaux ─────────────────────────────────────────
router.get('/services',       protect, authorize(...STAFF),   settingsC.getServices);
router.post('/services',      protect, authorize(...ADMIN),   settingsC.createService);
router.put('/services/:id',   protect, authorize(...ADMIN),   settingsC.updateService);

// ── Salles ────────────────────────────────────────────────────
router.get('/rooms',          protect, authorize(...STAFF),   settingsC.getRooms);

// ── KPIs administration ───────────────────────────────────────
router.get('/kpis',           protect, authorize(...ADMIN),   settingsC.getKpis);

// ── Assurances ────────────────────────────────────────────────
router.get('/insurances',     protect, authorize(...STAFF),   settingsC.getInsurances);
router.post('/insurances',    protect, authorize(...ADMIN),   settingsC.createInsurance);
router.put('/insurances/:id', protect, authorize(...ADMIN),   settingsC.updateInsurance);

module.exports = router;