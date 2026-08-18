// AUDIT-B5 — process.env était accédé ad hoc dans le code applicatif
// (server.js, controllers, middleware, models, utils), chacun relisant la
// variable brute avec sa propre valeur par défaut dupliquée à chaque site
// d'appel. Centralisé ici : une seule lecture, une seule définition de
// chaque défaut, un seul point à modifier si une variable change de nom.
//
// Hors périmètre volontairement (voir commit) :
// - backend/tests/*.js (69 fichiers) — bootstrap dotenv par fichier,
//   nécessaire pour rester exécutables individuellement
//   (`node --test tests/X.test.js`) sans dépendre du démarrage de
//   server.js ; pattern déjà établi dans tout le projet, pas un oubli.
// - utils/backup.js, utils/restore.js — MONGO_URI y est déjà paramétré
//   (passé en argument aux fonctions exportées, jamais lu en dur à
//   l'intérieur), leur bootstrap dotenv est scopé au seul chemin CLI
//   (`if (require.main === module)`) — déjà le pattern que ce fichier
//   généralise, pas un cas "ad hoc" à corriger.
// - utils/check-login.js, checkProductionConfig.js, create-user.js,
//   migrate-init-counters.js, migrate-link-patient-id.js, seed.js —
//   scripts de maintenance exécutés manuellement et rarement, chacun déjà
//   autonome avec son propre bootstrap explicite ; les migrer ajoute un
//   risque (casser un script peu testé) pour un bénéfice marginal face au
//   code de chemin de requête ci-dessous, qui s'exécute à chaque appel.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

module.exports = {
  NODE_ENV:   process.env.NODE_ENV || 'development',
  PORT:       process.env.PORT || 5000,

  MONGO_URI:  process.env.MONGO_URI,

  JWT_SECRET:        process.env.JWT_SECRET,
  JWT_EXPIRE:        process.env.JWT_EXPIRE || '7d',
  JWT_COOKIE_EXPIRE:  process.env.JWT_COOKIE_EXPIRE || '7',

  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,

  LOG_LEVEL:  process.env.LOG_LEVEL || 'info',
  SENTRY_DSN: process.env.SENTRY_DSN,

  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT || '587',
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM || '"Clinique Canadienne" <noreply@clinique.cg>',
};
