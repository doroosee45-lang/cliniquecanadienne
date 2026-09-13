// T9.10 — journalisation structurée (Winston) en remplacement des console.*
// du serveur en fonctionnement. Vérifie : le logger produit bien des
// enregistrements structurés (niveau + message + métadonnées, pas juste une
// chaîne concaténée), que le mode JSON de production sérialise correctement
// les métadonnées passées, et que l'ABSENCE de SENTRY_DSN (simulée
// explicitement ici, quelle que soit la configuration réelle de la machine
// qui exécute ce test) ne fait planter ni le chargement du module ni un
// appel à captureException — sentryEnabled doit rester false et
// captureException un no-op silencieux.
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

  await t.test('sans SENTRY_DSN, sentryEnabled est false et captureException ne lève rien', () => {
    // logger.js lit env.SENTRY_DSN (config/env.js), jamais process.env.SENTRY_DSN
    // directement (AUDIT-B5) — et config/env.js fige sa valeur au premier
    // require(), comme le documente déjà le 3e sous-test de ce fichier.
    //
    // Piège : config/env.js appelle lui-même dotenv.config() à chaque
    // require() frais — dotenv ne fait jamais que COMPLÉTER les variables
    // absentes de process.env, jamais écraser celles déjà présentes. Un
    // simple `delete process.env.SENTRY_DSN` la rend "absente", et le
    // require() de config/env.js ci-dessous la repeuple aussitôt depuis le
    // vrai .env de la machine (s'il en contient une) — le test croirait
    // alors tester l'absence de SENTRY_DSN alors qu'il testerait en fait sa
    // présence réelle sur cette machine. Régler à une chaîne vide plutôt
    // que supprimer (comme le 3e sous-test le fait déjà pour NODE_ENV) :
    // "déjà présente, juste falsy" n'est jamais complétée par dotenv.
    delete require.cache[require.resolve('../config/env')];
    delete require.cache[require.resolve('../utils/logger')];
    const originalDsn = process.env.SENTRY_DSN;
    process.env.SENTRY_DSN = '';
    const { sentryEnabled, captureException } = require('../utils/logger');
    assert.equal(sentryEnabled, false, 'sans DSN, Sentry ne doit pas se déclarer actif');
    assert.doesNotThrow(() => captureException(new Error('test'), { context: 'unit-test' }), 'captureException doit être un no-op silencieux, jamais une exception, quand Sentry est désactivé');
    if (originalDsn) process.env.SENTRY_DSN = originalDsn; else delete process.env.SENTRY_DSN;
    delete require.cache[require.resolve('../config/env')];
    delete require.cache[require.resolve('../utils/logger')];
  });

  await t.test('le format JSON de production sérialise correctement message + métadonnées', () => {
    delete require.cache[require.resolve('../utils/logger')];
    // AUDIT-B5 — logger.js lit désormais NODE_ENV via config/env.js, qui fige
    // sa valeur au premier require() (comportement voulu en production : ces
    // variables ne changent jamais en cours de process réel). Ce test simule
    // un changement d'environnement en cours de run, donc doit aussi vider le
    // cache de config/env.js — sinon logger.js recharge un module frais mais
    // qui lit un config/env.js resté figé sur la valeur d'avant.
    delete require.cache[require.resolve('../config/env')];
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
    // Ne pas laisser config/env.js figé sur 'production' pour le reste du
    // process si d'autres tests de ce fichier (ou un futur ajout) le
    // requièrent ensuite.
    delete require.cache[require.resolve('../config/env')];
    delete require.cache[require.resolve('../utils/logger')];

    const parsed = JSON.parse(captured.trim());
    assert.equal(parsed.message, 'Message de test T9.10');
    assert.equal(parsed.level, 'info');
    assert.equal(parsed.patientId, 'abc123');
    assert.ok(parsed.timestamp, 'un timestamp doit être inclus dans chaque entrée structurée');
    assert.equal(parsed.service, 'medisync-backend');
  });
});
