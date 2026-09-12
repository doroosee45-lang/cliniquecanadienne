// AUDIT-3.5 (SEC-03) — l'authentification Socket.IO (server.js::io.use)
// vérifiait uniquement la signature/expiration du JWT, jamais le statut de
// l'utilisateur en base — contrairement à `protect` côté REST
// (middleware/auth.js), qui relit req.user.statut à CHAQUE requête. Un
// compte suspendu gardait donc l'accès temps réel (messagerie,
// notifications) jusqu'à expiration naturelle du token. Ce test lance le
// VRAI server.js en processus séparé (comme audit23BootstrapProductionConfig)
// et prouve, avec un vrai client socket.io-client, qu'un compte suspendu est
// désormais rejeté à la connexion, alors qu'un compte actif se connecte
// normalement.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { io: ioClient } = require('socket.io-client');

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
        if (Date.now() > deadline) return reject(new Error(`serveur non démarré sur le port ${port} dans le délai imparti`));
        setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

test('AUDIT-3.5 (SEC-03) — Socket.IO rejette un compte suspendu, accepte un compte actif (serveur réel)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');

  const stamp = Date.now();
  const actif = await User.create({ email: `_t35-actif-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'T35', prenom: 'Actif', role: 'medecin', statut: 'actif' });
  const suspendu = await User.create({ email: `_t35-susp-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'T35', prenom: 'Suspendu', role: 'medecin', statut: 'suspendu' });

  const tokenActif    = jwt.sign({ id: actif._id, role: actif.role },    process.env.JWT_SECRET, { expiresIn: '5m' });
  const tokenSuspendu = jwt.sign({ id: suspendu._id, role: suspendu.role }, process.env.JWT_SECRET, { expiresIn: '5m' });

  const port = await findFreePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port) },
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d.toString(); });
  child.stderr.on('data', (d) => { out += d.toString(); });

  const connectWith = (token) => new Promise((resolve) => {
    const socket = ioClient(`http://127.0.0.1:${port}`, { auth: { token }, reconnection: false, timeout: 5000, transports: ['websocket'] });
    socket.on('connect', () => { resolve({ connected: true }); socket.close(); });
    socket.on('connect_error', (err) => { resolve({ connected: false, message: err.message }); socket.close(); });
  });

  try {
    await new Promise((resolve, reject) => {
      // Correction (relecture du 11 sept. 2026, rapport de correction) —
      // délai porté de 8s à 30s, même contention réelle documentée dans
      // isolatedServer.js::startIsolatedServer.
      const deadline = Date.now() + 30000;
      const check = () => {
        if (out.includes('Serveur démarré')) return resolve();
        if (Date.now() > deadline) return reject(new Error(`démarrage non confirmé\n${out}`));
        setTimeout(check, 150);
      };
      check();
    });
    await waitForPort(port);

    await t.test('compte suspendu → connexion Socket.IO refusée', async () => {
      const result = await connectWith(tokenSuspendu);
      assert.equal(result.connected, false, 'un compte suspendu ne doit jamais établir la connexion');
      assert.match(result.message, /inactif|introuvable/i);
    });

    await t.test('compte actif → connexion Socket.IO acceptée (non-régression)', async () => {
      const result = await connectWith(tokenActif);
      assert.equal(result.connected, true, `un compte actif doit toujours pouvoir se connecter (${result.message || ''})`);
    });
  } finally {
    child.kill('SIGKILL');
    await new Promise((resolve) => { child.once('exit', resolve); setTimeout(resolve, 3000); });
    await User.deleteMany({ _id: { $in: [actif._id, suspendu._id] } });
    await mongoose.disconnect();
  }
});
