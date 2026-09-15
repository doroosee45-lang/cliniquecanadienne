/**
 * PURGE DES COMPTES SEED EN PRODUCTION
 * Usage : node backend/utils/purge-seed-accounts.js --confirm
 *
 * À exécuter UNE SEULE FOIS, manuellement, après vérification que ces
 * comptes ne sont pas de vrais utilisateurs de production.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const SEED_EMAILS = [
  'admin@clinique-souanke.cg',
  'cpt.ella@clinique-souanke.cg',
  'dr.moussavou@clinique-souanke.cg',
  'dr.nguema@clinique-souanke.cg',
  'dr.nze@clinique-souanke.cg',
  'dr.obiang@clinique-souanke.cg',
  'inf.bekale@clinique-souanke.cg',
  'inf.eyeghe@clinique-souanke.cg',
  'inf.mba@clinique-souanke.cg',
  'lab.bongo@clinique-souanke.cg',
  'lab.mbemba@clinique-souanke.cg',
  'patient@clinique-souanke.cg',
  'ph.ndong@clinique-souanke.cg',
  'rec.mouanda@clinique-souanke.cg',
  'sf.ngoyi@clinique-souanke.cg',
];

const run = async () => {
  const confirmed = process.argv.includes('--confirm');

  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri);
  const dbName = mongoose.connection.db.databaseName;
  console.log(`🔌 Connecté à la base : "${dbName}"`);

  const found = await User.find({ email: { $in: SEED_EMAILS } }).select('email role nom prenom');

  if (found.length === 0) {
    console.log('✅ Aucun compte seed trouvé. Rien à faire.');
    return mongoose.disconnect();
  }

  console.log(`\n⚠️  ${found.length} compte(s) seed trouvé(s) :`);
  found.forEach(u => console.log(`   - ${u.email} (${u.role}) — ${u.prenom} ${u.nom}`));

  if (!confirmed) {
    console.log('\n❗ Mode simulation. Relancez avec --confirm pour supprimer ces comptes.');
    return mongoose.disconnect();
  }

  const result = await User.deleteMany({ email: { $in: SEED_EMAILS } });
  console.log(`\n🗑️  ${result.deletedCount} compte(s) supprimé(s) de la production.`);

  await mongoose.disconnect();
  console.log('✅ Terminé.');
};

run().catch(err => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});