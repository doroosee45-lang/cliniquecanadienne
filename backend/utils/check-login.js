/**
 * Script de diagnostic — vérifie que le login fonctionne correctement.
 * Usage : node backend/utils/check-login.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const EMAIL    = 'superadmin@medisync.clinic';
const PASSWORD = 'medisync123';

async function check() {
  console.log('\n══════════════════════════════════════');
  console.log('  DIAGNOSTIC LOGIN LOCAL');
  console.log('══════════════════════════════════════');

  // 1. Variables d'environnement
  console.log('\n1. Variables d\'environnement :');
  console.log('   MONGO_URI  :', process.env.MONGO_URI ? '✅ défini' : '❌ MANQUANT');
  console.log('   JWT_SECRET :', process.env.JWT_SECRET ? '✅ défini' : '❌ MANQUANT (cause du 500)');
  console.log('   NODE_ENV   :', process.env.NODE_ENV || '(non défini)');

  if (!process.env.MONGO_URI) {
    console.log('\n❌ MONGO_URI manquant — vérifiez backend/.env\n');
    process.exit(1);
  }

  // 2. Connexion MongoDB
  console.log('\n2. Connexion MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('   ✅ Connecté à :', mongoose.connection.db.databaseName);

  // 3. Chercher l'utilisateur
  console.log(`\n3. Recherche de "${EMAIL}"...`);
  const user = await User.findOne({ email: EMAIL }).select('+password');
  if (!user) {
    console.log('   ❌ Utilisateur introuvable !');
    console.log('   → Exécutez : node backend/utils/seed.js');
    await mongoose.disconnect();
    return;
  }
  console.log('   ✅ Utilisateur trouvé :', user.prenom, user.nom, `(${user.role})`);
  console.log('   Statut :', user.statut);
  console.log('   Password hash :', user.password ? user.password.substring(0, 20) + '...' : '❌ ABSENT');

  // 4. Vérifier le mot de passe
  console.log(`\n4. Test mot de passe "${PASSWORD}"...`);
  if (!user.password) {
    console.log('   ❌ Pas de mot de passe stocké (compte Google ?)');
  } else {
    const match = await user.matchPassword(PASSWORD);
    console.log('   Résultat :', match ? '✅ MOT DE PASSE CORRECT' : '❌ MOT DE PASSE INCORRECT');
    if (!match) {
      console.log('   → Relancez le seed : node backend/utils/seed.js');
    }
  }

  // 5. Test JWT
  console.log('\n5. Test génération JWT...');
  if (!process.env.JWT_SECRET) {
    console.log('   ❌ JWT_SECRET manquant — cause du 500 !');
    console.log('   → Vérifiez que backend/.env contient JWT_SECRET=...');
  } else {
    const token = user.getSignedJWT();
    console.log('   ✅ JWT généré :', token.substring(0, 30) + '...');
  }

  console.log('\n══════════════════════════════════════');
  if (process.env.JWT_SECRET && user.password) {
    const match = await user.matchPassword(PASSWORD);
    if (match && user.statut === 'actif') {
      console.log('  ✅ TOUT EST OK — Login devrait fonctionner');
      console.log(`  Email    : ${EMAIL}`);
      console.log(`  Password : ${PASSWORD}`);
    }
  }
  console.log('══════════════════════════════════════\n');

  await mongoose.disconnect();
}

check().catch(err => {
  console.error('\n❌ Erreur :', err.message);
  process.exit(1);
});
