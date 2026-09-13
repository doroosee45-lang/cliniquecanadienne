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

  // AUDIT-ANALYTICS-P8 — rapport hebdomadaire IA (utils/openai.js),
  // même pattern que TWILIO_* : absent en développement, utils/openai.js
  // retombe alors en mode simulé (jamais un faux succès).
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,

  LOG_LEVEL:  process.env.LOG_LEVEL || 'info',
  SENTRY_DSN: process.env.SENTRY_DSN,

  // MIGRATION-RESEND (13 sept. 2026) — remplace SMTP_HOST/PORT/USER/PASS
  // (nodemailer) : Resend n'utilise qu'une clé API, aucune notion de
  // host/port/utilisateur. utils/mail.js retombe en mode simulé si absente
  // (même pattern que OPENAI_API_KEY/TWILIO_*).
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  MAIL_FROM: process.env.MAIL_FROM || '"Clinique Canadienne" <onboarding@resend.dev>',

  TWILIO_ACCOUNT_SID:  process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN:   process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
};
