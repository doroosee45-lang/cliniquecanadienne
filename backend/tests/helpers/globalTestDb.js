// Gap "base de test indépendante" (checklist Phase 0 du plan directeur) —
// jusqu'ici, la grande majorité des ~90 fichiers de tests backend faisaient
// chacun `require('dotenv').config()` + `mongoose.connect(process.env.MONGO_URI)`,
// pointant vers le MÊME cluster MongoDB Atlas que le développement (une
// seule variable MONGO_URI dans backend/.env) — jamais de base de test
// réellement isolée pour l'immense majorité des fichiers, contrairement aux
// quelques tests Phase 10/T9.11 qui démarrent déjà chacun leur propre mongod
// local isolé via tests/helpers/isolatedServer.js.
//
// Généralise CE MÊME principe (mongod local, pas mongodb-memory-server —
// réutilise le binaire déjà installé et déjà utilisé avec succès par
// isolatedServer.js/backupRestoreT911/productionConfigCheckT102, évite une
// dépendance supplémentaire qui devrait télécharger un binaire) à
// l'ensemble de la suite, mais en démarrant UN SEUL mongod partagé pour
// toute l'exécution (pas un par fichier — node:test lance chaque fichier
// *.test.js dans son propre process enfant ; démarrer ~90 mongod séparés
// serait inutilement lent). scripts/run-tests-local-db.js injecte l'URI
// obtenue ici dans process.env.MONGO_URI AVANT de lancer `node --test` :
// dotenv ne réécrit jamais une variable déjà présente dans process.env
// (vérifié empiriquement), donc chaque fichier de test existant se
// connecte à ce mongod local sans qu'aucun de leur code n'ait besoin
// d'être modifié.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { findFreePort, waitForPort, mongodExists, MONGOD_PATH } = require('./isolatedServer');

async function startGlobalTestMongod() {
  const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 'medisync-test-db-'));
  const port = await findFreePort();
  const proc = spawn(MONGOD_PATH, ['--dbpath', dbPath, '--port', String(port), '--bind_ip', '127.0.0.1', '--quiet', '--noauth'], { stdio: 'ignore' });
  await waitForPort(port);

  return {
    uri: `mongodb://127.0.0.1:${port}/medisync_test`,
    async stop() {
      await new Promise((resolve) => {
        proc.once('exit', resolve);
        proc.kill();
        setTimeout(resolve, 5000);
      });
      for (let i = 0; i < 5; i++) {
        try { fs.rmSync(dbPath, { recursive: true, force: true }); break; }
        catch { await new Promise((r) => setTimeout(r, 500)); }
      }
    },
  };
}

module.exports = { startGlobalTestMongod, mongodExists };
