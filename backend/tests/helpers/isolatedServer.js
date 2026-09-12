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
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

// TEST-01 (correction du 12 sept. 2026, audit indépendant) — MONGOD_PATH
// était codé en dur vers un chemin Windows précis, versionné (8.2). Sur une
// autre machine, en CI, ou après une mise à jour de MongoDB sur cette même
// machine, mongodExists() renvoyait false et ~200 tests dépendant de cet
// helper étaient silencieusement ignorés (skip discret, jamais un échec
// explicite) au lieu de réellement s'exécuter. Résolu désormais dans
// l'ordre : (1) override explicite via MONGOD_PATH (variable d'env, pour
// un chemin non standard) ; (2) `mongod` déjà sur le PATH (cas le plus
// courant en CI Linux/macOS, et sur toute machine où l'installateur a
// ajouté MongoDB au PATH) ; (3) emplacements d'installation par défaut
// connus, PAR PLATEFORME, en énumérant les versions réellement présentes
// plutôt qu'une seule version figée en dur.
function resolveMongodPath() {
  if (process.env.MONGOD_PATH && fs.existsSync(process.env.MONGOD_PATH)) return process.env.MONGOD_PATH;

  const finder = process.platform === 'win32' ? 'where' : 'which';
  try {
    const found = execFileSync(finder, ['mongod'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/).map(s => s.trim()).find(Boolean);
    if (found && fs.existsSync(found)) return found;
  } catch { /* mongod absent du PATH — on retombe sur les emplacements connus ci-dessous */ }

  const candidates = process.platform === 'win32'
    ? (() => {
        const base = 'C:\\Program Files\\MongoDB\\Server';
        if (!fs.existsSync(base)) return [];
        // Énumère les versions réellement installées (ex: 6.0, 7.0, 8.2...)
        // plutôt qu'une seule version figée — triées la plus récente d'abord.
        return fs.readdirSync(base)
          .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
          .map(v => path.join(base, v, 'bin', 'mongod.exe'));
      })()
    : [
        '/opt/homebrew/bin/mongod', '/usr/local/bin/mongod',
        '/usr/bin/mongod', '/snap/bin/mongod',
      ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

const MONGOD_PATH = resolveMongodPath();
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
  return !!MONGOD_PATH && fs.existsSync(MONGOD_PATH);
}

// httpReadyTimeoutMs configurable (défaut 45s — mesuré ~3s pour ce même
// serveur lancé seul, donc largement suffisant même en isolation) :
// accessMatrix.test.js, auditCorrection3RoomCRUD.test.js et d'autres
// consommateurs de cet helper ont chacun été observés en échec intermittent
// sur l'ancien délai de 15s en fin de suite complète (1050+ tests, mongod
// local + processus node.exe déjà nombreux) alors que la même invocation
// isolée réussit largement en ~3s — flake de contention réelle et
// récurrente sur cette machine (I/O disque, antivirus scannant les
// processus mongod.exe/node.exe nouvellement créés), pas un défaut de
// logique propre à un seul test. Relevé au niveau du défaut partagé plutôt
// que patché fichier par fichier, pour couvrir tous les appelants actuels
// et futurs de cet helper (voir aussi auditCorrection2CSPConnectSrc.test.js,
// qui maintient sa propre copie locale de ce même mécanisme et a reçu le
// même correctif séparément).
async function startIsolatedServer({ httpReadyTimeoutMs = 45000 } = {}) {
  if (!MONGOD_PATH) throw new Error("mongod introuvable (ni MONGOD_PATH, ni PATH, ni emplacement d'installation connu) — utilisez mongodExists() pour ignorer proprement ce test plutôt que d'appeler startIsolatedServer().");
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
    await waitForHttpOk(`http://127.0.0.1:${httpPort}/api/health`, httpReadyTimeoutMs);
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
