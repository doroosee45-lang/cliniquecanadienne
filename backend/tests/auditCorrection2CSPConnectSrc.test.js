// Correction 2 (relecture du 5 sept. 2026, découverte pendant SEC-007) —
// server.js, connectSrc de la CSP contenait ws://localhost:5000 /
// wss://localhost:5000 codés en dur : une URL de développement qui ne
// correspond à aucune origine réelle en production.
//
// Correctif : dérivé de env.CLIENT_URL (déjà utilisé pour CORS/Socket.IO,
// pas une nouvelle variable) — frontend/src/contexts/SocketContext.jsx se
// connecte toujours à window.location.origin, qui est par construction
// l'une des origines listées dans CLIENT_URL, en développement comme en
// production (server.js sert le frontend buildé depuis la même origine).
//
// Preuve réelle : démarre un vrai processus server.js séparé (mongod isolé
// dédié), avec un CLIENT_URL réellement différent selon le scénario, et lit
// le VRAI en-tête HTTP Content-Security-Policy renvoyé par une vraie
// requête — jamais une inspection du code source ou une valeur supposée.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const { findFreePort, waitForPort, mongodExists, MONGOD_PATH } = require('./helpers/isolatedServer');

const BACKEND_DIR = path.join(__dirname, '..');

async function waitForHttpOk(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { const res = await fetch(url); if (res.ok) return true; } catch { /* pas prêt */ }
    if (Date.now() > deadline) return false;
    await new Promise(r => setTimeout(r, 300));
  }
}

async function startServerWithClientUrl(mongoPort, clientUrl, extraEnv = {}) {
  const httpPort = await findFreePort();
  const proc = spawn('node', ['server.js'], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(httpPort),
      MONGO_URI: `mongodb://127.0.0.1:${mongoPort}/correction2_isolated`,
      JWT_SECRET: 'correction2-isolated-test-secret-fixe',
      JWT_EXPIRE: '1h',
      JWT_COOKIE_EXPIRE: '1',
      CLIENT_URL: clientUrl,
      SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
      ...extraEnv,
    },
    stdio: 'ignore',
  });
  const up = await waitForHttpOk(`http://127.0.0.1:${httpPort}/api/health`);
  if (!up) { proc.kill(); throw new Error('le serveur enfant ne répond pas OK dans le délai imparti'); }
  return { proc, httpPort };
}

test('Correction 2 — connect-src de la CSP reflète réellement CLIENT_URL, plus un port de développement codé en dur', { skip: !mongodExists() && 'mongod introuvable — infrastructure isolée indisponible' }, async (t) => {
  const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 'correction2-mongod-'));
  const mongoPort = await findFreePort();
  const mongod = spawn(MONGOD_PATH, ['--dbpath', dbPath, '--port', String(mongoPort), '--bind_ip', '127.0.0.1', '--quiet', '--noauth'], { stdio: 'ignore' });
  await waitForPort(mongoPort);

  const servers = [];
  try {
    await t.test('CLIENT_URL de développement multi-origines → connect-src contient exactement ces origines en ws://, jamais localhost:5000', async () => {
      const clientUrl = 'http://localhost:5173,http://localhost:9999';
      const { proc, httpPort } = await startServerWithClientUrl(mongoPort, clientUrl);
      servers.push(proc);
      const res = await fetch(`http://127.0.0.1:${httpPort}/api/health`);
      const csp = res.headers.get('content-security-policy');
      assert.match(csp, /connect-src[^;]*ws:\/\/localhost:5173/, 'doit contenir la vraie première origine de CLIENT_URL, dérivée en ws://');
      assert.match(csp, /connect-src[^;]*ws:\/\/localhost:9999/, 'doit contenir la vraie seconde origine de CLIENT_URL, dérivée en ws://');
      assert.doesNotMatch(csp, /localhost:5000/, 'le port 5000 codé en dur ne doit plus jamais apparaître, quel que soit CLIENT_URL');
    });

    await t.test('CLIENT_URL de type production (https) → connect-src contient la vraie origine en wss://, jamais un ws:// localhost', async () => {
      const clientUrl = 'https://exemple-clinique-prod.example.com';
      const { proc, httpPort } = await startServerWithClientUrl(mongoPort, clientUrl);
      servers.push(proc);
      const res = await fetch(`http://127.0.0.1:${httpPort}/api/health`);
      const csp = res.headers.get('content-security-policy');
      assert.match(csp, /connect-src[^;]*wss:\/\/exemple-clinique-prod\.example\.com/, 'doit contenir la vraie origine de production, dérivée en wss://');
      assert.doesNotMatch(csp, /ws:\/\/localhost/, 'aucune trace d\'un localhost de développement ne doit apparaître pour une origine de production réelle');
    });
  } finally {
    for (const proc of servers) proc.kill();
    await new Promise((resolve) => { mongod.once('exit', resolve); mongod.kill(); setTimeout(resolve, 5000); });
    for (let i = 0; i < 5; i++) {
      try { fs.rmSync(dbPath, { recursive: true, force: true }); break; }
      catch { await new Promise(r => setTimeout(r, 500)); }
    }
  }
});
