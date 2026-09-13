// Phase 10.2 — vérification de configuration production, demandée en
// clôture de Phase 10.1 : NODE_ENV, JWT_SECRET unique, SMTP hors mode
// simulation, absence des comptes seed. Exerce utils/checkProductionConfig.js
// avec des configurations bonnes et mauvaises pour prouver qu'il détecte
// réellement chaque écart, pas seulement qu'il « s'exécute sans planter ».
//
// Le contrôle des comptes seed a besoin d'une vraie base MongoDB — instance
// locale isolée (même motif que backupRestoreT911.test.js), jamais le
// cluster Atlas partagé : celui-ci a réellement servi à `npm run seed` au
// cours du développement et contient donc légitimement certains des emails
// seed, ce qui rendrait ce test faux-positif s'il tournait contre Atlas.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { checkProductionConfig, KNOWN_SEED_EMAILS, JWT_MIN_LENGTH, JWT_PLACEHOLDER_MARKERS } = require('../utils/checkProductionConfig');

// TEST-01 (correction du 12 sept. 2026) — voir helpers/isolatedServer.js :
// même résolution robuste réutilisée au lieu d'une seconde copie figée.
const { MONGOD_PATH } = require('./helpers/isolatedServer');

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function waitForPort(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const sock = net.createConnection({ port, host: '127.0.0.1' });
      sock.once('connect', () => { sock.destroy(); resolve(); });
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() > deadline) return reject(new Error(`mongod n'a pas démarré sur le port ${port} dans le délai imparti`));
        setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

const GOOD_ENV = {
  NODE_ENV: 'production',
  JWT_SECRET: 'x'.repeat(80),
  RESEND_API_KEY: 're_' + 'x'.repeat(20),
  OPENAI_API_KEY: 'sk-' + 'x'.repeat(40),
  TWILIO_ACCOUNT_SID: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  TWILIO_AUTH_TOKEN: 'x'.repeat(32),
  TWILIO_PHONE_NUMBER: '+15005550006',
  GOOGLE_CLIENT_ID: 'xxxx.apps.googleusercontent.com',
};

test('Phase 10.2 — checkProductionConfig() détecte réellement chaque écart de configuration production', async (t) => {
  await t.test('configuration saine (production, secret long+aléatoire, Resend configuré) — aucun écart', async () => {
    const findings = await checkProductionConfig({ env: GOOD_ENV });
    assert.deepEqual(findings, []);
  });

  await t.test('NODE_ENV=development — signalé', async () => {
    const findings = await checkProductionConfig({ env: { ...GOOD_ENV, NODE_ENV: 'development' } });
    assert.ok(findings.some(f => f.check === 'NODE_ENV'), 'doit signaler NODE_ENV');
  });

  await t.test('JWT_SECRET absent — signalé', async () => {
    const findings = await checkProductionConfig({ env: { ...GOOD_ENV, JWT_SECRET: undefined } });
    assert.ok(findings.some(f => f.check === 'JWT_SECRET'), 'doit signaler JWT_SECRET absent');
  });

  await t.test(`JWT_SECRET trop court (< ${JWT_MIN_LENGTH}) — signalé`, async () => {
    const findings = await checkProductionConfig({ env: { ...GOOD_ENV, JWT_SECRET: 'trop-court' } });
    assert.ok(findings.some(f => f.check === 'JWT_SECRET'), 'doit signaler JWT_SECRET trop court');
  });

  await t.test('JWT_SECRET contenant un marqueur de placeholder connu — signalé', async () => {
    // Valeur synthétique construite à partir du marqueur lui-même (pas la
    // vraie valeur du .env de développement de ce dépôt) — un test ne doit
    // jamais faire porter un secret réel dans l'historique git, même un
    // secret de développement non sensible en production.
    const findings = await checkProductionConfig({ env: { ...GOOD_ENV, JWT_SECRET: `synthetic_test_value_${JWT_PLACEHOLDER_MARKERS[1]}_${'x'.repeat(30)}` } });
    assert.ok(findings.some(f => f.check === 'JWT_SECRET'), 'doit signaler un JWT_SECRET non régénéré');
  });

  await t.test('Resend non configuré (mode simulé) — signalé', async () => {
    const findings = await checkProductionConfig({ env: { ...GOOD_ENV, RESEND_API_KEY: undefined } });
    assert.ok(findings.some(f => f.check === 'RESEND'), 'doit signaler Resend en mode simulé');
  });

  await t.test('OpenAI non configurée (mode simulé) — signalé', async () => {
    const findings = await checkProductionConfig({ env: { ...GOOD_ENV, OPENAI_API_KEY: undefined } });
    assert.ok(findings.some(f => f.check === 'OPENAI'), 'doit signaler OpenAI en mode simulé');
  });

  await t.test('Twilio non configuré (mode simulé) — signalé', async () => {
    const findings = await checkProductionConfig({ env: { ...GOOD_ENV, TWILIO_ACCOUNT_SID: undefined, TWILIO_AUTH_TOKEN: undefined, TWILIO_PHONE_NUMBER: undefined } });
    assert.ok(findings.some(f => f.check === 'TWILIO'), 'doit signaler Twilio en mode simulé');
  });

  // SEC-011 — GOOGLE_CLIENT_ID absent désactivait silencieusement la
  // vérification d'audience du jeton Google (googleAuth.controller.js,
  // corrigé séparément) ; ce contrôle de pré-déploiement doit le détecter.
  await t.test('GOOGLE_CLIENT_ID non configuré — signalé', async () => {
    const findings = await checkProductionConfig({ env: { ...GOOD_ENV, GOOGLE_CLIENT_ID: undefined } });
    assert.ok(findings.some(f => f.check === 'GOOGLE_OAUTH'), 'doit signaler GOOGLE_CLIENT_ID absent');
  });

  await t.test('plusieurs écarts simultanés — tous signalés, pas seulement le premier', async () => {
    const findings = await checkProductionConfig({ env: { NODE_ENV: 'development', RESEND_API_KEY: undefined } });
    const checks = findings.map(f => f.check);
    assert.ok(checks.includes('NODE_ENV'));
    assert.ok(checks.includes('JWT_SECRET'));
    assert.ok(checks.includes('RESEND'));
  });
});

test('Phase 10.2 — checkProductionConfig() détecte réellement des comptes seed en base (instance MongoDB locale isolée)', { skip: !(MONGOD_PATH && fs.existsSync(MONGOD_PATH)) && `mongod introuvable (ni MONGOD_PATH, ni PATH, ni emplacement d'installation connu)` }, async (t) => {
  const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 't102-mongod-'));
  const port = await findFreePort();
  let mongodProc;

  try {
    await t.test('démarrage de mongod local isolé', async () => {
      mongodProc = spawn(MONGOD_PATH, ['--dbpath', dbPath, '--port', String(port), '--bind_ip', '127.0.0.1', '--quiet', '--noauth'], { stdio: 'ignore' });
      await waitForPort(port);
    });

    const mongoUri = `mongodb://127.0.0.1:${port}/t102_seedcheck`;
    const mongoose = require('mongoose');

    await t.test('base vide — aucun compte seed détecté', async () => {
      const findings = await checkProductionConfig({ env: GOOD_ENV, mongoUri });
      assert.equal(findings.filter(f => f.check === 'SEED_ACCOUNTS').length, 0);
    });

    await t.test('un compte seed présent en base — détecté et nommé dans le message', async () => {
      const conn = await mongoose.createConnection(mongoUri).asPromise();
      const User = conn.model('User', new mongoose.Schema({ email: String }, { strict: false }));
      await User.create({ email: KNOWN_SEED_EMAILS[0] });
      await conn.close();

      const findings = await checkProductionConfig({ env: GOOD_ENV, mongoUri });
      const seedFinding = findings.find(f => f.check === 'SEED_ACCOUNTS');
      assert.ok(seedFinding, 'doit détecter le compte seed injecté');
      assert.ok(seedFinding.message.includes(KNOWN_SEED_EMAILS[0]), 'le message doit nommer le compte détecté');
    });
  } finally {
    if (mongodProc && !mongodProc.killed) {
      await new Promise((resolve) => {
        mongodProc.once('exit', resolve);
        mongodProc.kill();
        setTimeout(resolve, 5000);
      });
      for (let i = 0; i < 5; i++) {
        try { fs.rmSync(dbPath, { recursive: true, force: true }); break; }
        catch { await new Promise(r => setTimeout(r, 500)); }
      }
    }
  }
});
