// routes/Auth.routes.js
const router  = require('express').Router();
const authC   = require('../controllers/auth.controller');
const { googleLogin } = require('../controllers/googleAuth.controller'); // ✅ nouveau
const { protect } = require('../middleware/auth');

// ── Routes existantes ─────────────────────────────────────────────────────
router.post('/login',                    authC.login);
router.post('/logout',          protect, authC.logout);
router.get('/me',               protect, authC.me);
router.put('/password',         protect, authC.updatePassword);
router.post('/forgot-password',          authC.forgotPassword);
router.post('/reset-password/:token',    authC.resetPassword);

// ── Google OAuth ──────────────────────────────────────────────────────────
// POST /api/auth/google   ← appelé par le frontend avec { access_token }
router.post('/google', googleLogin);

module.exports = router;