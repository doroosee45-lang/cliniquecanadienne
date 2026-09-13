// PORTAL-IA-001 (audit du 12 sept. 2026, mission Portail Patient) —
// l'onglet "Assistant IA" (Portal.jsx) n'appelait auparavant aucune API
// réelle (5 cartes décoratives, aucun handler). portal.controller.js::aiChat
// réutilise utils/openai.js::generateReport tel quel (même service que le
// chat IA du personnel, ai.controller.js::chat) — ce test couvre uniquement
// la validation d'entrée (avant tout appel réseau), pour ne jamais
// déclencher un vrai appel OpenAI facturé pendant la suite de tests
// automatisés. Le comportement de generateReport() lui-même (repli simulé
// honnête sans clé, appel réel sinon) est déjà la responsabilité de
// utils/openai.js, non retesté ici.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');

test('aiChat (portal.controller.js) — validation d\'entrée avant tout appel IA', async (t) => {
  const portalC = require('../controllers/portal.controller');
  const call = async (body) => {
    let status = 200, body_ = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body_ = d; } };
    await portalC.aiChat({ user: { _id: 'x' }, body }, res);
    return { status, body: body_ };
  };

  await t.test('message vide rejeté (400), jamais d\'appel IA', async () => {
    const { status, body } = await call({ message: '' });
    assert.equal(status, 400);
    assert.equal(body.success, false);
  });

  await t.test('message absent rejeté (400)', async () => {
    const { status } = await call({});
    assert.equal(status, 400);
  });

  await t.test('message trop long (> 2000 caractères) rejeté (400)', async () => {
    const { status, body } = await call({ message: 'a'.repeat(2001) });
    assert.equal(status, 400);
    assert.match(body.message, /trop long/);
  });
});

// SEC-AI-ERROR-LEAK (13 sept. 2026, découvert en test navigateur réel sur un
// vrai compte patient) — un vrai échec OpenAI (crédits épuisés) renvoyait
// jusqu'ici son message BRUT au patient, incluant un lien de facturation
// interne du compte OpenAI de la clinique (https://platform.openai.com/...).
// Nécessite une vraie base (logAction écrit dans AuditLog) — fichier séparé
// du reste de ce fichier, qui reste volontairement sans connexion Mongo.
test('aiChat (portal.controller.js) — un vrai échec IA ne renvoie jamais le message brut du fournisseur au patient (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const AuditLog = require('../models/AuditLog');
  const portalC = require('../controllers/portal.controller');
  const openai = require('../utils/openai');

  const stamp = Date.now();
  const patient = await User.create({ email: `_portalai-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'AI', prenom: 'Portal', role: 'patient', statut: 'actif' });
  const originalGenerateReport = openai.generateReport;

  const call = async (body) => {
    let status = 200, resBody = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { resBody = d; } };
    await portalC.aiChat({ user: patient, body, ip: '127.0.0.1' }, res);
    return { status, body: resBody };
  };

  try {
    openai.generateReport = async () => { throw new Error('You have no credits remaining. Add credits at https://platform.openai.com/settings/organization/billing (simulation).'); };
    const { status, body } = await call({ message: 'Question quelconque' });
    assert.equal(status, 502);
    assert.equal(body.success, false);
    assert.doesNotMatch(body.message, /platform\.openai\.com|credits remaining/, 'le message brut du fournisseur IA ne doit jamais atteindre le patient');
    assert.match(body.message, /indisponible/i, 'un message générique et honnête doit être renvoyé à la place');

    const log = await AuditLog.findOne({ action: 'PORTAL_AI_CHAT', module: 'portal', statut: 'echec', utilisateur: patient._id }).sort('-createdAt').lean();
    assert.ok(log, 'l\'échec réel doit être tracé côté serveur, pas seulement affiché génériquement au patient');
    assert.match(log.message, /platform\.openai\.com|credits remaining/, 'le détail réel de l\'erreur doit rester disponible côté serveur pour le diagnostic');
  } finally {
    openai.generateReport = originalGenerateReport;
    await AuditLog.deleteMany({ action: 'PORTAL_AI_CHAT', module: 'portal', utilisateur: patient._id });
    await User.findByIdAndDelete(patient._id);
    await mongoose.disconnect();
  }
});
