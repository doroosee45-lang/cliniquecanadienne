/**
 * Migration à exécuter UNE SEULE FOIS pour appliquer le correctif AUDIT-19-1
 * (models/Insurance.js) sur une base déjà déployée.
 *
 * L'index unique sur Insurance.code n'avait pas `sparse: true` : MongoDB
 * traite toutes les valeurs absentes comme le même `null`, donc la 2e
 * assurance créée sans code (champ optionnel, non `required`) faisait
 * échouer sa création (E11000 dup key { code: null }). Le schéma a été
 * corrigé, mais Mongoose ne migre jamais automatiquement les OPTIONS d'un
 * index déjà construit avec le même nom/clé sur une base existante
 * (Model.init() se contente de vérifier qu'un index du même nom existe,
 * jamais que ses options correspondent) : sans cette migration, l'ancien
 * index non-sparse resterait actif indéfiniment en production.
 *
 * Usage : node utils/migrate-insurance-code-sparse-index.js
 * Sans danger à ré-exécuter : si l'index est déjà sparse, ne fait rien.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connecté — migration index Insurance.code\n');

  const coll = mongoose.connection.db.collection('insurances');
  const indexes = await coll.indexes();
  const codeIndex = indexes.find(i => i.name === 'code_1');

  if (!codeIndex) {
    console.log('Aucun index code_1 trouvé — rien à migrer (sera créé sparse au prochain démarrage).');
    await mongoose.disconnect();
    return;
  }
  if (codeIndex.sparse) {
    console.log('Index code_1 déjà sparse — rien à faire.');
    await mongoose.disconnect();
    return;
  }

  // Garde-fou : si des doublons `code: null` existent déjà (ne devraient pas,
  // l'ancien index unique les en empêchait), recréer un index sparse
  // échouerait de la même façon — les signaler plutôt que de les recréer en
  // silence.
  const nullCodeCount = await coll.countDocuments({ code: null });
  if (nullCodeCount > 1) {
    console.error(`❌ ${nullCodeCount} documents avec code: null trouvés — l'ancien index unique aurait dû l'empêcher. Migration interrompue, à investiguer manuellement avant de continuer.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Index code_1 trouvé, unique sans sparse — reconstruction (0 ou 1 document code:null, migration sûre)...`);
  await coll.dropIndex('code_1');
  await coll.createIndex({ code: 1 }, { unique: true, sparse: true, name: 'code_1' });
  console.log('✅ Index code_1 recréé avec sparse: true.');

  await mongoose.disconnect();
};

run().catch(err => { console.error('❌', err.message); process.exit(1); });
