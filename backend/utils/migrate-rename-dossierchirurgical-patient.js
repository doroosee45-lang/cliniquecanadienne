/**
 * ADR-0006 — Migration ponctuelle : renomme DossierChirurgical.patient_id
 * en DossierChirurgical.patient (convention majoritaire, voir ticket 0021).
 *
 * Opère directement sur la collection MongoDB ($rename), pas via Mongoose,
 * pour renommer aussi les documents dont le schéma applicatif ne connaît
 * déjà plus `patient_id` au moment de l'exécution.
 *
 * Non destructif : ne fait que renommer un champ existant, ne supprime ni
 * ne modifie aucune autre donnée. Idempotent — un document déjà migré
 * (pas de champ patient_id) n'est pas affecté par le filtre.
 *
 * Usage : node utils/migrate-rename-dossierchirurgical-patient.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connecté\n');

  const collection = mongoose.connection.collection('dossierchirurgicals');

  const toMigrate = await collection.countDocuments({ patient_id: { $exists: true } });
  console.log(`Documents avec patient_id encore présent : ${toMigrate}`);

  if (toMigrate === 0) {
    console.log('Rien à migrer — déjà à jour ou collection vide.');
  } else {
    const result = await collection.updateMany(
      { patient_id: { $exists: true } },
      { $rename: { patient_id: 'patient' } }
    );
    console.log(`Renommés : ${result.modifiedCount}/${toMigrate}`);
  }

  const remaining = await collection.countDocuments({ patient_id: { $exists: true } });
  const total = await collection.countDocuments({});
  const withPatient = await collection.countDocuments({ patient: { $exists: true } });
  console.log(`\n── Vérification finale ──`);
  console.log(`  Total documents         : ${total}`);
  console.log(`  Avec champ patient      : ${withPatient}`);
  console.log(`  Avec patient_id restant : ${remaining} (doit être 0)`);

  await mongoose.disconnect();
  process.exit(remaining === 0 ? 0 : 1);
};

run().catch(err => { console.error('❌', err.message); process.exit(1); });
