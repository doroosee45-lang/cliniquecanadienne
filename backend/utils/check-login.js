/**
 * Script de diagnostic — vérifie que le login fonctionne correctement.
 * Usage : node backend/utils/check-login.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const EMAIL    = process.env.CHECK_EMAIL    || 'oseedoro@gmail.com';
const PASSWORD = process.env.SEED_PASSWORD;

async function check() {
  if (!PASSWORD) {
    console.error('❌  SEED_PASSWORD non défini dans .env — impossible de tester le login.');
    process.exit(1);
  }

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
  // SEC-012 (audit indépendant du 6 sept. 2026) — affichait un extrait du
  // hash bcrypt réel en clair dans le terminal (scrollback sensible, même
  // partiel) ; un simple indicateur de présence/format suffit au diagnostic.
  console.log('   Password hash :', user.password ? (user.password.startsWith('$2') ? '✅ présent (format bcrypt valide)' : '⚠️ présent mais format inattendu') : '❌ ABSENT');

  // 4. Vérifier le mot de passe
  // SEC-012 — n'affiche plus le mot de passe configuré (SEED_PASSWORD) en
  // clair : le développeur le connaît déjà via son propre .env, ce script
  // n'a besoin d'afficher que le résultat de la comparaison.
  console.log('\n4. Test du mot de passe configuré (SEED_PASSWORD)...');
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
    // SEC-012 — n'affiche plus d'extrait du jeton réel en clair.
    const token = user.getSignedJWT();
    console.log(`   ✅ JWT généré avec succès (${token.length} caractères)`);
  }

  console.log('\n══════════════════════════════════════');
  if (process.env.JWT_SECRET && user.password) {
    const match = await user.matchPassword(PASSWORD);
    if (match && user.statut === 'actif') {
      // SEC-012 — n'affiche plus le mot de passe en clair dans le résumé
      // final : il est déjà configuré dans backend/.env (SEED_PASSWORD),
      // pas besoin de le faire réapparaître dans le terminal.
      console.log('  ✅ TOUT EST OK — Login devrait fonctionner');
      console.log(`  Email    : ${EMAIL}`);
      console.log('  Password : (voir SEED_PASSWORD dans backend/.env)');
    }
  }
  console.log('══════════════════════════════════════\n');

  await mongoose.disconnect();
}

check().catch(err => {
  console.error('\n❌ Erreur :', err.message);
  process.exit(1);
});
