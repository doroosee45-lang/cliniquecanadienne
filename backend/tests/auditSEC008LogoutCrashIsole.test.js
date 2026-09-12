// SEC-008 (audit indépendant du 4 sept. 2026) — auth.controller.js::logout
// était async (req, res) sans paramètre next ni try/catch. Si logAction()
// (écriture AuditLog) rejette, c'est une unhandledRejection non
// interceptée : le gestionnaire global (server.js) la journalise puis
// appelle process.exit(1), ce qui ferait crasher le process entier pour
// TOUS les utilisateurs connectés, à cause d'un simple échec de
// journalisation sur une déconnexion.
//
// Ce test ne peut pas se contenter d'un appel direct au contrôleur : le
// comportement à prouver est justement que l'absence de try/catch fait
// crasher le PROCESS (pas juste rejeter une promesse localement), via le
// gestionnaire global process.on('unhandledRejection') de server.js. Chaque
// scénario démarre donc un vrai processus Node séparé et jetable (voir
// helpers/sec008LogoutCrashChild.js), avec son propre mongod isolé — jamais
// le process qui exécute cette suite de tests, qui doit survivre quel que
// soit le résultat.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { findFreePort, waitForPort, mongodExists, MONGOD_PATH } = require('./helpers/isolatedServer');
const fs = require('node:fs');
const os = require('node:os');

const BACKEND_DIR = path.join(__dirname, '..');
const CHILD_SCRIPT = path.join(__dirname, 'helpers', 'sec008LogoutCrashChild.js');

// Défaut porté à 45s (comme tests/helpers/isolatedServer.js, même
// correctif) — contention réelle et récurrente en fin de suite complète.
async function waitForHttpOk(url, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* pas encore prêt */ }
    if (Date.now() > deadline) return false;
    await new Promise(r => setTimeout(r, 300));
  }
}

// Démarre un vrai mongod isolé + le script enfant (server.js réel, avec le
// monkey-patch de logAction), fait un vrai login puis un vrai logout, et
// observe si le process enfant survit ou crashe dans les secondes qui
// suivent.
async function runScenario() {
  const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 'sec008-mongod-'));
  const mongoPort = await findFreePort();
  const mongod = spawn(MONGOD_PATH, ['--dbpath', dbPath, '--port', String(mongoPort), '--bind_ip', '127.0.0.1', '--quiet', '--noauth'], { stdio: 'ignore' });
  await waitForPort(mongoPort);

  const httpPort = await findFreePort();
  let childExited = false;
  let exitCode = null;
  const child = spawn('node', [CHILD_SCRIPT], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(httpPort),
      MONGO_URI: `mongodb://127.0.0.1:${mongoPort}/sec008_isolated`,
      JWT_SECRET: 'sec008-isolated-test-secret-fixe',
      JWT_EXPIRE: '1h',
      JWT_COOKIE_EXPIRE: '1',
      CLIENT_URL: 'http://127.0.0.1:0',
      SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
    },
    stdio: 'ignore',
  });
  child.once('exit', (code) => { childExited = true; exitCode = code; });

  const cleanup = async () => {
    if (!childExited) { child.kill(); }
    await new Promise((resolve) => { mongod.once('exit', resolve); mongod.kill(); setTimeout(resolve, 5000); });
    for (let i = 0; i < 5; i++) {
      try { fs.rmSync(dbPath, { recursive: true, force: true }); break; }
      catch { await new Promise(r => setTimeout(r, 500)); }
    }
  };

  try {
    const up = await waitForHttpOk(`http://127.0.0.1:${httpPort}/api/health`);
    if (!up) throw new Error('le serveur enfant ne répond pas OK dans le délai imparti');

    const stamp = Date.now();
    const mongoose = require('mongoose');
    await mongoose.connect(`mongodb://127.0.0.1:${mongoPort}/sec008_isolated`);
    const User = require('../models/User');
    const PASSWORD = 'Sec008TestPass1!';
    const user = await User.create({ email: `_sec008-${stamp}@_test.local`, password: PASSWORD, nom: 'Test', prenom: 'Sec008', role: 'medecin', statut: 'actif' });
    await mongoose.disconnect();

    const loginRes = await fetch(`http://127.0.0.1:${httpPort}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: PASSWORD }),
    });
    if (loginRes.status !== 200) throw new Error(`login a échoué (${loginRes.status})`);
    const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];

    let logoutStatus = null;
    let logoutError = null;
    try {
      const logoutRes = await fetch(`http://127.0.0.1:${httpPort}/api/auth/logout`, {
        method: 'POST', headers: { Cookie: cookie }, signal: AbortSignal.timeout(5000),
      });
      logoutStatus = logoutRes.status;
    } catch (err) {
      logoutError = err.message; // ex. connexion réinitialisée si le process crashe avant de répondre
    }

    // Laisse le temps au gestionnaire global unhandledRejection (s'il se
    // déclenche) de logger puis process.exit(1) avant de conclure.
    await new Promise(r => setTimeout(r, 2000));

    return { logoutStatus, logoutError, childExited, exitCode };
  } finally {
    await cleanup();
  }
}

test('SEC-008 — un échec réel de logAction() dans logout() ne doit jamais crasher le process (processus isolé jetable)', { skip: !mongodExists() && 'mongod introuvable — infrastructure isolée indisponible' }, async () => {
  const result = await runScenario();
  assert.equal(result.childExited, false, `le process enfant ne doit pas s'être arrêté après l'échec simulé de logAction (exitCode observé: ${result.exitCode})`);
  assert.equal(result.logoutStatus, 500, 'la requête doit recevoir une vraie réponse d\'erreur gérée (via next(err) → errorHandler), pas un crash silencieux');
});
