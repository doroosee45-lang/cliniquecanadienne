// T9.10 — journalisation structurée (Winston) en remplacement des console.*
// du serveur en fonctionnement. Vérifie : le logger produit bien des
// enregistrements structurés (niveau + message + métadonnées, pas juste une
// chaîne concaténée), que le mode JSON de production sérialise correctement
// les métadonnées passées, et que l'absence de SENTRY_DSN dans cet
// environnement (bloquant documenté, pas sauté en silence) ne fait planter
// ni le chargement du module ni un appel à captureException.
const test = require('node:test');
const assert = require('node:assert/strict');

test('T9.10 — logger structuré et intégration Sentry gated', async (t) => {
  await t.test('le logger expose les niveaux attendus et n\'échoue pas sur un appel avec métadonnées', () => {
    const { logger } = require('../utils/logger');
    assert.equal(typeof logger.info, 'function');
    assert.equal(typeof logger.warn, 'function');
    assert.equal(typeof logger.error, 'function');
    // Ne doit lever aucune exception, y compris avec des métadonnées imbriquées.
    assert.doesNotThrow(() => logger.info('T9.10 test log', { module: 'test', nested: { a: 1 } }));
  });

  await t.test('sans SENTRY_DSN (cas réel de cet environnement), sentryEnabled est false et captureException ne lève rien', () => {
    delete require.cache[require.resolve('../utils/logger')];
    const originalDsn = process.env.SENTRY_DSN;
    delete process.env.SENTRY_DSN;
    const { sentryEnabled, captureException } = require('../utils/logger');
    assert.equal(sentryEnabled, false, 'sans DSN, Sentry ne doit pas se déclarer actif');
    assert.doesNotThrow(() => captureException(new Error('test'), { context: 'unit-test' }), 'captureException doit être un no-op silencieux, jamais une exception, quand Sentry est désactivé');
    if (originalDsn) process.env.SENTRY_DSN = originalDsn;
  });

  await t.test('le format JSON de production sérialise correctement message + métadonnées', () => {
    delete require.cache[require.resolve('../utils/logger')];
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const winston = require('winston');
    const { Writable } = require('stream');
    let captured = '';
    const memoryStream = new Writable({
      write(chunk, enc, cb) { captured += chunk.toString(); cb(); },
    });
    delete require.cache[require.resolve('../utils/logger')];
    const { logger } = require('../utils/logger');
    // Ajoute un transport temporaire pointant vers notre stream mémoire pour
    // capturer la sortie réellement produite, sans dépendre de stdout.
    const streamTransport = new winston.transports.Stream({ stream: memoryStream });
    logger.add(streamTransport);
    logger.info('Message de test T9.10', { patientId: 'abc123', action: 'test' });
    logger.remove(streamTransport);
    process.env.NODE_ENV = originalEnv;

    const parsed = JSON.parse(captured.trim());
    assert.equal(parsed.message, 'Message de test T9.10');
    assert.equal(parsed.level, 'info');
    assert.equal(parsed.patientId, 'abc123');
    assert.ok(parsed.timestamp, 'un timestamp doit être inclus dans chaque entrée structurée');
    assert.equal(parsed.service, 'medisync-backend');
  });
});
