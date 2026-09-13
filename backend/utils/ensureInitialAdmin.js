/**
 * AUDIT-SEC-SEED-ADMIN (13 sept. 2026) — bootstrap/rotation SÛRE, séparée de
 * seed.js, du compte administrateur initial nécessaire en production.
 *
 * Contrairement à seed.js (qui vide 17 collections et refuse explicitement
 * de tourner si NODE_ENV=production), ce script :
 *   - ne touche JAMAIS que le document User correspondant à
 *     INITIAL_ADMIN_EMAIL (aucun deleteMany, aucune autre collection) ;
 *   - est fait pour être exécuté EN PRODUCTION, à la demande, pour créer ce
 *     compte s'il n'existe pas encore, ou changer son mot de passe s'il
 *     existe déjà (ex. pour sortir un compte du contrôle SEED_ACCOUNTS de
 *     checkProductionConfig.js, en lui donnant un mot de passe qui n'est
 *     plus celui, partagé, de seed.js) ;
 *   - lit le mot de passe UNIQUEMENT depuis process.env.INITIAL_ADMIN_PASSWORD
 *     — jamais en dur ici, jamais commité, jamais journalisé.
 *
 * Usage :
 *   INITIAL_ADMIN_EMAIL=... INITIAL_ADMIN_PASSWORD=... node utils/ensureInitialAdmin.js
 * (ou défini dans les variables d'environnement du service Render — jamais
 * dans un fichier versionné.)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const run = async () => {
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('❌  INITIAL_ADMIN_EMAIL et INITIAL_ADMIN_PASSWORD doivent être définis dans l\'environnement (jamais en dur dans un fichier).');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const dbName = mongoose.connection.db.databaseName;
  console.log(`✅ MongoDB connecté — base : "${dbName}"`);

  try {
    let user = await User.findOne({ email });
    if (user) {
      // Réinitialise aussi le verrouillage éventuel (T3.4) — cohérent avec
      // une rotation de mot de passe volontaire par un administrateur.
      user.password = password;
      user.tentatives_echouees = 0;
      user.verrouille_jusqu_a = null;
      await user.save(); // déclenche pre('save') → bcrypt.hash, jamais en clair
      console.log(`✅ Mot de passe mis à jour pour le compte existant : ${email} (role: ${user.role})`);
    } else {
      user = await User.create({
        email,
        password,
        nom: process.env.INITIAL_ADMIN_NOM || 'Admin',
        prenom: process.env.INITIAL_ADMIN_PRENOM || 'Principal',
        role: 'superadmin',
        statut: 'actif',
      });
      console.log(`✅ Compte superadmin créé : ${email}`);
    }
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  run().catch((err) => {
    console.error('❌ Échec :', err.message);
    process.exit(1);
  });
}

module.exports = { run };
