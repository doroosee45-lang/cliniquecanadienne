/**
 * Migration à exécuter UNE SEULE FOIS pour appliquer le correctif AUDIT-20-2
 * (models/ExamCatalogue.js) sur une base déjà déployée.
 *
 * Même défaut que Insurance.code (AUDIT-19-1, voir
 * migrate-insurance-code-sparse-index.js) : l'index unique sur
 * ExamCatalogue.code n'avait pas `sparse: true`. Dormant aujourd'hui (aucun
 * controller ne crée d'ExamCatalogue — seul utils/seed.js le fait, en
 * fournissant toujours un code), mais l'ancien index non-sparse resterait
 * actif indéfiniment en production sans cette migration si un futur
 * endpoint de création venait à exister.
 *
 * Usage : node utils/migrate-examcatalogue-code-sparse-index.js
 * Sans danger à ré-exécuter : si l'index est déjà sparse, ne fait rien.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connecté — migration index ExamCatalogue.code\n');

  const coll = mongoose.connection.db.collection('examcatalogues');
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
