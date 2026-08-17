// T9.11 — sauvegarde MongoDB en JS pur (driver mongodb natif + EJSON), sans
// dépendre de mongodump/mongoexport (MongoDB Database Tools) : ni l'un ni
// l'autre n'est installé sur cette machine, et le cluster est hébergé sur
// Atlas, pas en local — décision validée avec l'utilisateur avant
// implémentation. EJSON (bson) préserve les types (ObjectId, Date,
// Decimal128...) que JSON.stringify brut corromprait silencieusement.
//
// Usage CLI : node utils/backup.js [--uri=<mongo_uri>] [--out=<dossier>]
// Par défaut : MONGO_URI de l'environnement, dossier backups/<timestamp>/.
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { EJSON } = require('bson');

async function runBackup({ uri, outDir }) {
  if (!uri) throw new Error('runBackup: uri requis (MONGO_URI).');
  if (!outDir) throw new Error('runBackup: outDir requis.');

  fs.mkdirSync(outDir, { recursive: true });

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const collections = await db.listCollections().toArray();

    const manifest = { timestamp: new Date().toISOString(), database: db.databaseName, collections: {} };

    for (const { name } of collections) {
      // Collections système/vues internes — jamais des données applicatives,
      // pas de sens à les sauvegarder.
      if (name.startsWith('system.')) continue;

      const docs = await db.collection(name).find({}).toArray();
      const filePath = path.join(outDir, `${name}.json`);
      fs.writeFileSync(filePath, EJSON.stringify(docs, null, 0), 'utf8');
      manifest.collections[name] = docs.length;
    }

    fs.writeFileSync(path.join(outDir, '_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    return manifest;
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v]; }),
  );
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  const uri = args.uri || process.env.MONGO_URI;
  const outDir = args.out || path.join(__dirname, '..', 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
  runBackup({ uri, outDir })
    .then(manifest => {
      console.log(`Sauvegarde terminée → ${outDir}`);
      console.log(JSON.stringify(manifest, null, 2));
    })
    .catch(err => { console.error('Échec de la sauvegarde :', err.message); process.exit(1); });
}

module.exports = { runBackup };
