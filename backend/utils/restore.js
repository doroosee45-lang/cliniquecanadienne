// T9.11 — restauration correspondant à backup.js : relit les fichiers
// EJSON produits par la sauvegarde et réinsère chaque collection dans la
// base cible. Vide chaque collection cible avant réinsertion (une
// restauration doit reproduire exactement l'état sauvegardé, pas fusionner
// avec ce qui existe déjà) — c'est délibérément destructif, jamais visé sur
// une base de production sans confirmation explicite hors de ce script.
//
// Usage CLI : node utils/restore.js --dir=<dossier_sauvegarde> [--uri=<mongo_uri>]
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { EJSON } = require('bson');

async function runRestore({ uri, inDir }) {
  if (!uri) throw new Error('runRestore: uri requis (MONGO_URI).');
  if (!inDir) throw new Error('runRestore: inDir requis.');

  const manifestPath = path.join(inDir, '_manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Aucun _manifest.json trouvé dans ${inDir} — dossier de sauvegarde invalide.`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const restored = {};

    for (const name of Object.keys(manifest.collections)) {
      const filePath = path.join(inDir, `${name}.json`);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Fichier de sauvegarde manquant pour la collection "${name}" (${filePath}).`);
      }
      const docs = EJSON.parse(fs.readFileSync(filePath, 'utf8'));

      await db.collection(name).deleteMany({});
      if (docs.length > 0) {
        await db.collection(name).insertMany(docs);
      }
      restored[name] = docs.length;
    }

    return { timestamp: manifest.timestamp, sourceDatabase: manifest.database, targetDatabase: db.databaseName, restored };
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v]; }),
  );
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  if (!args.dir) {
    console.error('Usage : node utils/restore.js --dir=<dossier_sauvegarde> [--uri=<mongo_uri>]');
    process.exit(1);
  }
  const uri = args.uri || process.env.MONGO_URI;
  runRestore({ uri, inDir: args.dir })
    .then(result => { console.log('Restauration terminée :'); console.log(JSON.stringify(result, null, 2)); })
    .catch(err => { console.error('Échec de la restauration :', err.message); process.exit(1); });
}

module.exports = { runRestore };
