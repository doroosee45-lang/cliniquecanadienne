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
