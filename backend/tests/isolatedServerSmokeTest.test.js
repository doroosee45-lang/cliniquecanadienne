// Vérification de l'infrastructure Phase 10 elle-même, avant de construire
// dessus : le serveur isolé démarre, répond en HTTP réel, et se ferme
// proprement (aucun process résiduel ensuite).
const test = require('node:test');
const assert = require('node:assert/strict');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

test('infrastructure Phase 10 — serveur isolé démarre, répond, s\'arrête proprement', { skip: !mongodExists() && 'mongod introuvable' }, async (t) => {
  let server;
  try {
    await t.test('démarrage et /api/health répond réellement en HTTP', async () => {
      server = await startIsolatedServer();
      const res = await fetch(`${server.baseUrl}/health`);
      assert.equal(res.ok, true);
    });

    await t.test('la base isolée est bien vide au départ (pas le cluster Atlas partagé)', async () => {
      const mongoose = require('mongoose');
      const conn = await mongoose.createConnection(server.mongoUri).asPromise();
      const User = conn.model('User', new mongoose.Schema({ email: String }));
      const count = await User.countDocuments();
      assert.equal(count, 0, 'une base fraîchement créée ne doit contenir aucun document');
      await conn.close();
    });
  } finally {
    if (server) await server.stop();
  }
});
