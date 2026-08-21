// Phase 10 — infrastructure partagée pour tous les tests d'intégration HTTP
// réels de 10.1/10.2 (extension de la checklist de baseline, tests croisés
// inter-modules, test de charge). Démarre un mongod local isolé (même
// principe que T9.8/T9.11 — jamais le cluster Atlas partagé) ET une vraie
// instance du serveur Express (server.js), sur des ports libres dédiés,
// avec ses propres variables d'environnement — jamais backend/.env, jamais
// le port par défaut. C'est délibérément l'infrastructure qui aurait dû
// être utilisée par accessMatrix.test.js et les tests d'intégration
// similaires : ceux-ci, en l'absence de serveur dédié, ont fini par
// s'exécuter pour de vrai contre le serveur de développement resté allumé,
// laissant le résidu nettoyé avant de démarrer cette phase.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

const MONGOD_PATH = 'C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe';
const BACKEND_DIR = path.join(__dirname, '..', '..');

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
        if (Date.now() > deadline) return reject(new Error(`Rien n'écoute sur le port ${port} dans le délai imparti`));
        setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

async function waitForHttpOk(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* pas encore prêt */ }
    if (Date.now() > deadline) throw new Error(`${url} ne répond pas OK dans le délai imparti`);
    await new Promise(r => setTimeout(r, 300));
  }
}

// mongodExists() : permet aux tests appelants de fournir un motif de skip
// clair si mongod n'est pas installé sur la machine, plutôt qu'un échec
// opaque au démarrage.
function mongodExists() {
  return fs.existsSync(MONGOD_PATH);
}

async function startIsolatedServer() {
  const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 'p10-mongod-'));
  const mongoPort = await findFreePort();
  const mongod = spawn(MONGOD_PATH, ['--dbpath', dbPath, '--port', String(mongoPort), '--bind_ip', '127.0.0.1', '--quiet', '--noauth'], { stdio: 'ignore' });
  await waitForPort(mongoPort);

  const mongoUri = `mongodb://127.0.0.1:${mongoPort}/p10_isolated`;
  const httpPort = await findFreePort();

  // Environnement dédié — ne touche jamais backend/.env. dotenv.config()
  // (appelé en tête de server.js) ne réécrit jamais une variable déjà
  // présente dans process.env : ces valeurs ont donc la priorité.
  // AUDIT-0 (gap "base de test indépendante") — JWT_SECRET fixe (pas
  // suffixé par Date.now()) et exposé ci-dessous dans la valeur de retour :
  // un appelant qui doit fabriquer lui-même un JWT valide sans passer par
  // /auth/login (ex. googleAutoSignup.test.js, compte Google sans mot de
  // passe) a besoin de signer avec EXACTEMENT le même secret que celui que
  // ce serveur isolé utilisera pour vérifier — sinon 401 "Token invalide"
  // au lieu du 403 réellement testé. Fixe plutôt que randomisé : aucun
  // risque, chaque instance est éphémère, locale (127.0.0.1) et détruite en
  // fin de test.
  const jwtSecret = 'phase10-isolated-test-secret-fixe';
  const serverProc = spawn('node', ['server.js'], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(httpPort),
      MONGO_URI: mongoUri,
      JWT_SECRET: jwtSecret,
      JWT_EXPIRE: '1h',
      JWT_COOKIE_EXPIRE: '1',
      CLIENT_URL: 'http://127.0.0.1:0',
      // SMTP volontairement absent : mail.js retombe sur son mode simulé,
      // aucun email réel envoyé pendant les tests d'intégration.
      SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
    },
    stdio: 'ignore',
  });

  try {
    await waitForHttpOk(`http://127.0.0.1:${httpPort}/api/health`);
  } catch (err) {
    serverProc.kill();
    mongod.kill();
    throw err;
  }

  return {
    baseUrl: `http://127.0.0.1:${httpPort}/api`,
    mongoUri,
    jwtSecret,
    async stop() {
      await new Promise((resolve) => {
        serverProc.once('exit', resolve);
        serverProc.kill();
        setTimeout(resolve, 5000);
      });
      await new Promise((resolve) => {
        mongod.once('exit', resolve);
        mongod.kill();
        setTimeout(resolve, 5000);
      });
      for (let i = 0; i < 5; i++) {
        try { fs.rmSync(dbPath, { recursive: true, force: true }); break; }
        catch { await new Promise(r => setTimeout(r, 500)); }
      }
    },
  };
}

// AUDIT-0 (gap "base de test indépendante") — findFreePort/waitForPort/
// MONGOD_PATH exportés pour être réutilisés par
// tests/helpers/globalTestDb.js, qui généralise le même principe de mongod
// local isolé à l'ensemble de la suite plutôt que dupliquer cette logique.
module.exports = { startIsolatedServer, mongodExists, findFreePort, waitForPort, MONGOD_PATH };
