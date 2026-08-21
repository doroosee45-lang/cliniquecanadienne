// Gap "base de test indépendante" (checklist Phase 0) — orchestrateur
// appelé par le script npm "test" (voir package.json). Démarre un mongod
// local isolé partagé pour toute la suite (tests/helpers/globalTestDb.js),
// injecte son URI dans process.env.MONGO_URI, lance la suite complète
// contre cette base locale (jamais le cluster Atlas partagé), puis l'arrête
// et nettoie son dossier temporaire — que la suite réussisse ou échoue.
//
// Si mongod est introuvable sur cette machine, MONGO_URI est explicitement
// mis à chaîne vide (dotenv ne réécrit jamais une variable déjà présente
// dans process.env, même vide — vérifié empiriquement) : les tests
// nécessitant une base de données s'ignorent alors proprement via leur
// garde `{ skip: !process.env.MONGO_URI && '...' }` déjà en place, plutôt
// que de retomber silencieusement sur une base partagée.
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { startGlobalTestMongod, mongodExists } = require('../tests/helpers/globalTestDb');

async function main() {
  const backendDir = path.join(__dirname, '..');
  const testsDir = path.join(backendDir, 'tests');
  const testFiles = fs.readdirSync(testsDir)
    .filter((f) => f.endsWith('.test.js'))
    .sort()
    .map((f) => path.join('tests', f));

  let db = null;
  let mongoUri = '';

  if (mongodExists()) {
    db = await startGlobalTestMongod();
    mongoUri = db.uri;
    console.log(`[tests] mongod local isolé démarré — ${mongoUri} (${testFiles.length} fichiers)`);
  } else {
    console.warn('[tests] mongod introuvable — les tests nécessitant une base de données seront ignorés (skip). Aucune bascule vers une base partagée.');
  }

  const cleanup = async (code) => {
    if (db) {
      try { await db.stop(); } catch (err) { console.error('[tests] échec de l\'arrêt propre de mongod :', err.message); }
    }
    process.exit(code);
  };

  const child = spawn(
    process.execPath,
    ['--test', '--test-concurrency=1', '--test-force-exit', ...testFiles],
    { cwd: backendDir, stdio: 'inherit', env: { ...process.env, MONGO_URI: mongoUri } }
  );

  child.on('exit', (code) => { cleanup(code ?? 1); });
  child.on('error', (err) => { console.error('[tests] échec du lancement de node --test :', err.message); cleanup(1); });

  // Filet de sécurité : si le processus principal est interrompu (Ctrl+C),
  // ne jamais laisser mongod tourner en arrière-plan.
  process.on('SIGINT', () => { child.kill('SIGINT'); });
  process.on('SIGTERM', () => { child.kill('SIGTERM'); });
}

main().catch((err) => {
  console.error('[tests] erreur fatale dans l\'orchestrateur de tests :', err);
  process.exit(1);
});
