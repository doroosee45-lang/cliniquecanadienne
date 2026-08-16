// R-09 — authorize() rejetait un accès non autorisé (403) sans jamais
// journaliser l'évènement : la règle "Accès refusé" de
// audit.controller.js::getSuspects cherchait une action ACCESS_DENIED
// qu'aucun code n'écrivait réellement en base (confirmé par recherche
// exhaustive sur tout le backend avant ce correctif). Vérifie que le refus
// est maintenant journalisé, et que getSuspects le fait effectivement
// remonter.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('authorize() journalise les accès refusés (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const AuditLog = require('../models/AuditLog');
  const User = require('../models/User');
  const { authorize } = require('../middleware/auth');
  const auditC = require('../controllers/audit.controller');

  const stamp = Date.now();
  const user = await User.create({ email: `_t09-accessdenied-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'AccessDeniedT09', prenom: 'Test', role: 'receptionniste', statut: 'actif' });

  try {
    await t.test('un rôle non autorisé écrit une entrée ACCESS_DENIED', async () => {
      let status = 200, body = null;
      const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
      const req = { user, baseUrl: '/api/finance', originalUrl: '/api/finance/stats', method: 'GET', ip: '127.0.0.1' };

      const before = await AuditLog.countDocuments({ action: 'ACCESS_DENIED', utilisateur: user._id });
      await authorize('superadmin', 'comptable')(req, res, () => { throw new Error('next() ne doit pas être appelé'); });
      assert.equal(status, 403);
      const after = await AuditLog.countDocuments({ action: 'ACCESS_DENIED', utilisateur: user._id });
      assert.equal(after, before + 1);

      const entry = await AuditLog.findOne({ action: 'ACCESS_DENIED', utilisateur: user._id }).sort('-createdAt');
      assert.equal(entry.module, 'finance');
      assert.equal(entry.statut, 'echec');
      assert.match(entry.message, /receptionniste/);
    });

    await t.test('un rôle autorisé n\'écrit rien et appelle next()', async () => {
      let nextCalled = false;
      const req = { user, baseUrl: '/api/finance', originalUrl: '/api/finance/stats', method: 'GET', ip: '127.0.0.1' };
      const before = await AuditLog.countDocuments({ action: 'ACCESS_DENIED', utilisateur: user._id });
      await authorize('receptionniste')(req, {}, () => { nextCalled = true; });
      assert.equal(nextCalled, true);
      const after = await AuditLog.countDocuments({ action: 'ACCESS_DENIED', utilisateur: user._id });
      assert.equal(after, before);
    });

    await t.test('getSuspects fait remonter le refus journalisé', async () => {
      let body = null;
      const res = { status: () => res, json: (d) => { body = d; } };
      await auditC.getSuspects({}, res, () => {});
      const found = body.suspects.some(s => s.type === 'Accès refusé' && s.utilisateur.includes('AccessDeniedT09'));
      assert.ok(found, 'le refus journalisé doit apparaître dans /audit/suspects');
    });
  } finally {
    await AuditLog.deleteMany({ utilisateur: user._id });
    await User.findByIdAndDelete(user._id);
    await mongoose.disconnect();
  }
});
