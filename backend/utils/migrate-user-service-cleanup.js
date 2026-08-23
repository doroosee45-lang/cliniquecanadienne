// AUDIT-M-A1 (Groupe A, Point 1) — User.service passe de chaîne libre
// (défaut '') à vraie référence ObjectId (ref Service). Le changement de
// schéma ne migre jamais les documents déjà en base : les 57 comptes
// existants (patients inclus) ont tous littéralement service:"" stocké au
// niveau driver (confirmé par lecture directe de la collection, en
// contournant le cast Mongoose). Sans ce nettoyage, tout populate('service')
// sur ces documents lève une CastError (ObjectId attendu, chaîne vide
// reçue). $unset plutôt que null : cohérent avec Staff.utilisateur
// (sparse:true) — un champ de référence optionnel non renseigné est absent,
// jamais une valeur vide explicite.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connecté\n');

  const before = await mongoose.connection.db.collection('users').countDocuments({ service: '' });
  console.log(`Comptes avec service:"" (à nettoyer) : ${before}`);

  const result = await mongoose.connection.db.collection('users').updateMany(
    { service: '' },
    { $unset: { service: '' } }
  );
  console.log(`Documents modifiés : ${result.modifiedCount}`);

  const after = await mongoose.connection.db.collection('users').countDocuments({ service: '' });
  console.log(`\n── Vérification ──`);
  console.log(`Comptes avec service:"" restants : ${after}`);
  if (after !== 0) {
    console.error('❌ Des documents avec service:"" subsistent — migration incomplète.');
    process.exitCode = 1;
  } else {
    console.log('✅ Nettoyage validé — plus aucun service:"" en base.');
  }

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exitCode = 1; });
