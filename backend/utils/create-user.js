require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');

// Script d'admin en ligne de commande — usage :
//   node utils/create-user.js <email> <role> [nom] [prenom] [telephone]
// Le mot de passe n'est jamais codé en dur : généré aléatoirement (ou repris
// de la variable d'env CREATE_USER_PASSWORD si fournie) et affiché une seule
// fois en console, à charge pour l'opérateur de le transmettre de façon sûre.
const run = async () => {
  const [, , email, role, nom = 'Utilisateur', prenom = '', telephone = ''] = process.argv;
  if (!email || !role) {
    console.error('Usage : node utils/create-user.js <email> <role> [nom] [prenom] [telephone]');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connecté');

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`⚠️  Compte déjà existant : ${email}`);
    console.log(`   Aucune modification effectuée.`);
    await mongoose.disconnect();
    return;
  }

  const password = process.env.CREATE_USER_PASSWORD || crypto.randomBytes(9).toString('base64url');

  const user = await User.create({
    email,
    password,
    nom,
    prenom,
    role,
    telephone,
    statut: 'actif',
    must_change_password: true,
  });

  console.log('\n✅ Compte créé avec succès :');
  console.log(`   Email         : ${user.email}`);
  console.log(`   Mot de passe  : ${password}  (à communiquer de façon sécurisée — non stocké en clair, non journalisé ailleurs)`);
  console.log(`   Rôle          : ${user.role}`);
  await mongoose.disconnect();
};

run().catch(err => { console.error('❌', err.message); process.exit(1); });
