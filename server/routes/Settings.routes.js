// routes/settings.routes.js
const router     = require('express').Router();
const settingsC  = require('../controllers/settings.controller');
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');

const ADMIN = ['superadmin','adminclinique'];

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
router.get('/services',       protect,                        settingsC.getServices);
router.post('/services',      protect, authorize(...ADMIN),   settingsC.createService);

// ── Assurances ────────────────────────────────────────────────
router.get('/insurances',     protect,                        settingsC.getInsurances);
router.post('/insurances',    protect, authorize(...ADMIN),   settingsC.createInsurance);

module.exports = router;