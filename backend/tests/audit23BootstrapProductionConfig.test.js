// AUDIT-2.3 — utils/checkProductionConfig.js existait et était testé
// (productionConfigCheckT102.test.js) mais n'était jamais invoqué
// automatiquement au démarrage réel de server.js : un JWT_SECRET
// faible/placeholder en production ne pouvait être détecté que par une
// exécution manuelle du script, facilement oubliée avant un déploiement.
// server.js appelle désormais checkProductionConfig() dans bootstrap(),
// uniquement en production, et le serveur ne doit JAMAIS se mettre à
// écouter si un écart est détecté.
//
// Ce test exerce le VRAI server.js en processus séparé (spawn), pas une
// fonction extraite — c'est la seule façon de prouver que le branchement
// réel empêche le démarrage, pas seulement que la fonction sous-jacente
// détecte l'écart (déjà couvert par productionConfigCheckT102.test.js).
// Attention particulière portée à la terminaison propre du processus
// (ticket 0009 : un `node`/`server.js` oublié en arrière-plan reste
// connecté à la base réelle indéfiniment) — timeout strict + kill()
// garanti en `finally`, jamais de processus laissé en vie au-delà du test.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

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

// Lance server.js avec l'env fourni, capture stdout/stderr, résout dès que
// le processus se termine seul OU après timeoutMs (dans ce cas, tué de force
// et rejeté pour distinguer clairement un blocage d'une terminaison propre).
function runServer(envOverrides, { timeoutMs = 6000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, ...envOverrides },
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { out += d.toString(); });

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(Object.assign(new Error('timeout — le processus ne s\'est pas terminé seul dans le délai imparti'), { out }));
    }, timeoutMs);

    child.once('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, out });
    });
    child.once('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

test('AUDIT-2.3 — bootstrap() refuse de démarrer en production si la configuration est invalide (processus réel)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await t.test('NODE_ENV=production + JWT_SECRET faible → le serveur ne démarre jamais, sort en erreur', async () => {
    const port = await findFreePort();
    // AUDIT-3.6 — timeout relevé de 6s à 20s : checkProductionConfig()
    // inclut checkSeedAccounts(), une vraie connexion réseau au cluster
    // Atlas partagé (TLS + résolution SRV) dont la latence peut
    // occasionnellement dépasser quelques secondes sous charge — un premier
    // passage de cette suite a échoué ici en timeout (6036ms) sans qu'il
    // s'agisse d'une régression du correctif lui-même (le second passage,
    // sans changement de code, est repassé au vert).
    const { code, out } = await runServer({
      NODE_ENV: 'production',
      PORT: String(port),
      JWT_SECRET: 'trop-court',
    }, { timeoutMs: 20000 });
    assert.notEqual(code, 0, `le processus doit sortir en erreur (code obtenu: ${code})\n${out}`);
    assert.ok(!out.includes('Serveur démarré'), `le serveur ne doit jamais annoncer un démarrage réussi\n${out}`);
    assert.match(out, /Vérification de configuration production échouée/, `le message d'échec attendu doit apparaître\n${out}`);

    // Le port ne doit jamais avoir été occupé — preuve que .listen() n'a
    // jamais été atteint.
    await new Promise((resolve, reject) => {
      const probe = net.createConnection({ port, host: '127.0.0.1' });
      probe.once('connect', () => { probe.destroy(); reject(new Error('le port répond alors que le serveur ne devait jamais écouter')); });
      probe.once('error', () => { probe.destroy(); resolve(); });
    });
  });

  await t.test('NODE_ENV=development (inchangé) — la vérification production ne s\'applique pas, le serveur démarre normalement', async () => {
    const port = await findFreePort();
    const child = spawn(process.execPath, ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'development', PORT: String(port) },
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { out += d.toString(); });
    try {
      await new Promise((resolve, reject) => {
        const deadline = Date.now() + 8000;
        const check = () => {
          if (out.includes('Serveur démarré')) return resolve();
          if (Date.now() > deadline) return reject(new Error(`démarrage non confirmé dans le délai imparti\n${out}`));
          setTimeout(check, 150);
        };
        check();
      });
    } finally {
      child.kill('SIGKILL');
      await new Promise((resolve) => { child.once('exit', resolve); setTimeout(resolve, 3000); });
    }
  });
});
