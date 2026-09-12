// REALTIME-SALLES-001 (rapport de clôture du 11 sept. 2026) — getSalles()
// calcule l'occupation réelle des salles depuis salle_entree_at/
// salle_sortie_at (entreeSalle()/sortieSalle()), mais ni l'une ni l'autre
// n'émettait jamais d'événement Socket.IO : un changement d'occupation
// depuis un autre poste n'était donc jamais reflété en temps réel côté
// frontend, malgré NEW-007 qui a unifié la source des salles sur loadStats()
// (Blocoperatoire.jsx). Corrigé en réutilisant emitDashboardUpdate(), le
// même mécanisme déjà utilisé partout ailleurs dans ce contrôleur (ex.
// scheduleIntervention) — jamais un second système temps réel créé pour
// l'occasion.
//
// blocoperatoireController.js déstructure emitDashboardUpdate au chargement
// du module (`const { emitDashboardUpdate } = require('../utils/socket')`) :
// remplacer utils/socket.js::emitDashboardUpdate après coup n'aurait aucun
// effet sur la référence déjà capturée par le contrôleur. Seule une vraie
// preuve de bout en bout — vrai server.js, vrai socket.io-client connecté,
// vrai appel HTTP — peut donc démontrer que l'événement atteint réellement
// un client, comme audit35SocketIoStatutRecheck.test.js pour l'auth Socket.IO.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { io: ioClient } = require('socket.io-client');

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
    srv.on('error', reject);
  });
}
function waitForPort(port, timeoutMs = 45000) {
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

test('REALTIME-SALLES-001 — entreeSalle()/sortieSalle() émettent réellement dashboard:refresh, reçu par un vrai client Socket.IO', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  const DossierChirurgical = require('../models/DossierChirurgical');

  const stamp = Date.now();
  const PASSWORD = 'Rt001TestPass1!';
  const medecin = await User.create({ email: `_rt001-${stamp}@_test.local`, password: PASSWORD, nom: 'RT001', prenom: 'Test', role: 'medecin', statut: 'actif' });
  const dossier = await DossierChirurgical.create({
    numero: `BLOC-RT001-${stamp}`,
    patient: new mongoose.Types.ObjectId(),
    patient_nom: `T-RT001-${stamp}`,
    salle_prevue: 'BO-1',
  });

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
      // Même contention réelle documentée dans isolatedServer.js::
      // startIsolatedServer et audit35SocketIoStatutRecheck.test.js (ce
      // fichier lance aussi un vrai server.js séparé) — délai aligné à 45s.
      const deadline = Date.now() + 45000;
      const check = () => {
        if (out.includes('Serveur démarré')) return resolve();
        if (Date.now() > deadline) return reject(new Error(`démarrage non confirmé\n${out}`));
        setTimeout(check, 150);
      };
      check();
    });
    await waitForPort(port);

    const loginRes = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: medecin.email, password: PASSWORD }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];
    const token = cookie.slice(cookie.indexOf('=') + 1);

    const socket = ioClient(`http://127.0.0.1:${port}`, { auth: { token }, reconnection: false, timeout: 5000, transports: ['websocket'] });
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });

    await t.test('entreeSalle() — un vrai client Socket.IO connecté reçoit réellement dashboard:refresh', async () => {
      const received = new Promise((resolve) => socket.once('dashboard:refresh', resolve));
      const res = await fetch(`http://127.0.0.1:${port}/api/blocoperatoire/${dossier._id}/entree-salle`, {
        method: 'PUT', headers: { Cookie: cookie },
      });
      assert.equal(res.status, 200);
      await Promise.race([
        received,
        new Promise((_, reject) => setTimeout(() => reject(new Error('dashboard:refresh jamais reçu après entreeSalle()')), 5000)),
      ]);
    });

    await t.test('sortieSalle() — un vrai client Socket.IO connecté reçoit également dashboard:refresh', async () => {
      const received = new Promise((resolve) => socket.once('dashboard:refresh', resolve));
      const res = await fetch(`http://127.0.0.1:${port}/api/blocoperatoire/${dossier._id}/sortie-salle`, {
        method: 'PUT', headers: { Cookie: cookie },
      });
      assert.equal(res.status, 200);
      await Promise.race([
        received,
        new Promise((_, reject) => setTimeout(() => reject(new Error('dashboard:refresh jamais reçu après sortieSalle()')), 5000)),
      ]);
    });

    socket.close();
  } finally {
    child.kill('SIGKILL');
    await new Promise((resolve) => { child.once('exit', resolve); setTimeout(resolve, 3000); });
    await DossierChirurgical.findByIdAndDelete(dossier._id);
    await User.findByIdAndDelete(medecin._id);
    await mongoose.disconnect();
  }
});
