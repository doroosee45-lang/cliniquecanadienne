// CHAT-001 (rapport de clôture du 11 sept. 2026) — AI.jsx (section "Chat IA")
// et le mini-panneau IA du Header affichaient tous deux un unique message
// statique et un champ de saisie désactivé : aucune route /ai/chat n'a
// jamais existé. Les autres actions de ai.controller.js (diagnose/
// interactions/predictions) sont un moteur déterministe local (SYMPTOM_MAP),
// jamais un appel LLM — utils/openai.js::generateReport() (déjà réel, déjà
// testé par analyticsPhase8.test.js pour le rapport hebdomadaire Analytics)
// est réutilisé tel quel ici, sans modification de sa signature, pour ne
// jamais créer une seconde intégration OpenAI parallèle.
//
// Stubbe openai.generateReport (jamais un vrai appel réseau OpenAI) — même
// principe que new001SmtpApplicativeConfig.test.js pour nodemailer : capture
// exactement ce que le contrôleur transmettrait à un vrai appel, sans jamais
// dépendre d'une vraie clé ni déclencher de trafic réel.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('CHAT-001 — POST /ai/chat transmet réellement au service OpenAI existant, jamais de fausse réponse', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const openai = require('../utils/openai');
  const env = require('../config/env');
  const aiC = require('../controllers/ai.controller');

  const stamp = Date.now();
  const originalGenerateReport = openai.generateReport;
  const originalOpenaiKey = env.OPENAI_API_KEY;

  const call = async (req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await aiC.chat(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const medecin = await User.create({ email: `_chat001-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Chat', prenom: 'Test', role: 'medecin', statut: 'actif' });

  try {
    await t.test('message vide → 400, jamais transmis au service IA', async () => {
      let called = false;
      openai.generateReport = async () => { called = true; return { content: 'ne devrait jamais être atteint' }; };
      const { status, body } = await call({ user: medecin, body: { message: '   ' } });
      assert.equal(status, 400);
      assert.equal(body.success, false);
      assert.equal(called, false, 'un message vide ne doit jamais atteindre le service OpenAI');
    });

    await t.test('message trop long (>2000) → 400, jamais transmis', async () => {
      let called = false;
      openai.generateReport = async () => { called = true; return { content: 'x' }; };
      const { status, body } = await call({ user: medecin, body: { message: 'a'.repeat(2001) } });
      assert.equal(status, 400);
      assert.equal(body.success, false);
      assert.equal(called, false);
    });

    await t.test('OPENAI_API_KEY absente → mode simulé honnête, jamais une réponse IA fictive présentée comme réelle', async () => {
      openai.generateReport = originalGenerateReport; // vrai appel réel de utils/openai.js
      env.OPENAI_API_KEY = '';
      const { status, body } = await call({ user: medecin, body: { message: 'Quels sont les signes du paludisme ?' } });
      assert.equal(status, 200);
      assert.equal(body.success, false, 'un mode simulé ne doit jamais se présenter comme un succès');
      assert.equal(body.simulated, true);
      assert.equal(body.reply, undefined, 'aucun contenu de réponse ne doit être inventé en mode simulé');
      assert.match(body.message, /indisponible|non configurée/i);
      env.OPENAI_API_KEY = originalOpenaiKey;
    });

    await t.test('appel réel réussi → la vraie question est transmise, la vraie réponse est renvoyée avec son disclaimer', async () => {
      let capturedPrompt = null;
      openai.generateReport = async ({ systemPrompt, userPrompt }) => {
        capturedPrompt = { systemPrompt, userPrompt };
        return { content: 'Le paludisme se manifeste typiquement par fièvre, frissons et maux de tête.' };
      };
      const { status, body } = await call({ user: medecin, body: { message: 'Quels sont les signes du paludisme ?' } });
      assert.equal(status, 200);
      assert.equal(body.success, true);
      assert.equal(body.reply, 'Le paludisme se manifeste typiquement par fièvre, frissons et maux de tête.');
      assert.match(body.disclaimer, /à titre informatif.*non validée médicalement/i);
      assert.ok(capturedPrompt.userPrompt.includes('Quels sont les signes du paludisme'), 'la vraie question doit être transmise au service IA, jamais une donnée fabriquée');
      assert.match(capturedPrompt.systemPrompt, /jamais.*diagnostic définitif|responsabilité du professionnel/i, 'le prompt système doit garder le garde-fou anti-diagnostic autonome');
    });

    await t.test('historique de conversation réellement inclus dans la requête transmise au service IA', async () => {
      let capturedPrompt = null;
      openai.generateReport = async ({ userPrompt }) => { capturedPrompt = userPrompt; return { content: 'Suite de la réponse.' }; };
      await call({
        user: medecin,
        body: {
          message: 'Et pour un enfant de 5 ans ?',
          history: [
            { role: 'user', content: 'Quels sont les signes du paludisme ?' },
            { role: 'bot', content: 'Fièvre, frissons, maux de tête.' },
          ],
        },
      });
      assert.ok(capturedPrompt.includes('Quels sont les signes du paludisme'), 'le tour précédent de la conversation doit être transmis pour un vrai contexte multi-tours');
      assert.ok(capturedPrompt.includes('Et pour un enfant de 5 ans'));
    });

    await t.test('échec réel du service IA (réseau/API) → vraie erreur renvoyée, jamais un succès déguisé', async () => {
      openai.generateReport = async () => { throw new Error('Échec réseau lors de l\'appel OpenAI (simulation).'); };
      const { status, body } = await call({ user: medecin, body: { message: 'Question quelconque' } });
      assert.equal(status, 502);
      assert.equal(body.success, false);
      assert.match(body.message, /Échec réseau/);
    });

    await t.test('la clé OPENAI_API_KEY réelle n\'est jamais exposée dans une réponse, succès ou échec', async () => {
      env.OPENAI_API_KEY = 'sk-secret-ne-doit-jamais-apparaitre';
      openai.generateReport = async () => { throw new Error('Échec quelconque'); };
      const { body: bodyFail } = await call({ user: medecin, body: { message: 'Test' } });
      assert.ok(!JSON.stringify(bodyFail).includes('sk-secret-ne-doit-jamais-apparaitre'));

      openai.generateReport = async () => ({ content: 'Réponse réelle.' });
      const { body: bodyOk } = await call({ user: medecin, body: { message: 'Test' } });
      assert.ok(!JSON.stringify(bodyOk).includes('sk-secret-ne-doit-jamais-apparaitre'));
      env.OPENAI_API_KEY = originalOpenaiKey;
    });
  } finally {
    openai.generateReport = originalGenerateReport;
    env.OPENAI_API_KEY = originalOpenaiKey;
    await User.findByIdAndDelete(medecin._id);
    await mongoose.disconnect();
  }
});
