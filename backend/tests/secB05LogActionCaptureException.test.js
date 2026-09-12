// SEC-B-05 (correction du 12 sept. 2026, audit indépendant) —
// utils/helpers.js::logAction n'exposait un échec d'écriture d'audit-log
// que via un simple logger.error, invisible en dehors des logs console/
// fichier locaux (jamais remonté au mécanisme de suivi d'erreurs déjà câblé
// ailleurs, utils/logger.js::captureException). Ce test prouve, avec une
// vraie erreur de validation Mongoose réelle (action/module requis omis),
// que logAction (1) ne relève jamais l'erreur (continuité métier
// préservée — politique inchangée), et (2) appelle désormais réellement
// captureException avec le contexte de l'échec.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('SEC-B-05 — un échec réel d\'écriture AuditLog est remonté via captureException, jamais silencieux, jamais bloquant', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);

  const captured = [];
  const fauxDsn = 'https://faux-dsn@o0.ingest.sentry.io/0';
  const ancienDsn = process.env.SENTRY_DSN;
  process.env.SENTRY_DSN = fauxDsn;
  delete require.cache[require.resolve('../config/env')];
  delete require.cache[require.resolve('../utils/logger')];
  delete require.cache[require.resolve('../utils/helpers')];

  // Patch réel du module @sentry/node (objet partagé du cache require) —
  // utils/logger.js::captureException fait require('@sentry/node') à
  // l'appel, donc ce patch est bien vu par le vrai code de production,
  // jamais une resimulation de sa logique.
  const Sentry = require('@sentry/node');
  const originalInit = Sentry.init;
  const originalCapture = Sentry.captureException;
  Sentry.init = () => {}; // évite toute vraie tentative réseau vers Sentry
  Sentry.captureException = (err, ctx) => { captured.push({ err, ctx }); };

  try {
    const { logAction } = require('../utils/helpers');
    const { sentryEnabled } = require('../utils/logger');
    assert.equal(sentryEnabled, true, 'avec un SENTRY_DSN présent, sentryEnabled doit être vrai pour ce test');

    // action/module omis (tous deux required) → vraie ValidationError Mongoose.
    await assert.doesNotReject(
      () => logAction({ utilisateur: new mongoose.Types.ObjectId(), ip: '127.0.0.1' }),
      'logAction ne doit jamais faire échouer l\'opération métier appelante, même si l\'écriture audit échoue réellement'
    );

    assert.equal(captured.length, 1, 'captureException doit être appelé exactement une fois pour cet échec réel');
    assert.ok(captured[0].err instanceof Error);
    assert.match(captured[0].err.message, /validation/i);
    assert.equal(captured[0].ctx.extra.context, 'logAction');
  } finally {
    Sentry.init = originalInit;
    Sentry.captureException = originalCapture;
    if (ancienDsn === undefined) delete process.env.SENTRY_DSN; else process.env.SENTRY_DSN = ancienDsn;
    delete require.cache[require.resolve('../config/env')];
    delete require.cache[require.resolve('../utils/logger')];
    delete require.cache[require.resolve('../utils/helpers')];
    await mongoose.disconnect();
  }
});
