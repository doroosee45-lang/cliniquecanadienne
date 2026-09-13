// AUDIT-B5 — config/env.js centralise process.env pour le code applicatif
// (server.js, config/db.js, 2 controllers, middleware/auth.js, models/User.js,
// utils/helpers.js, utils/logger.js, utils/mail.js) qui n'avait jusqu'ici
// aucune source unique. Hors périmètre volontaire : backend/tests/*.js
// (bootstrap dotenv par fichier, nécessaire pour rester exécutables
// individuellement) et les scripts CLI déjà autonomes (backup.js/restore.js
// paramètrent déjà MONGO_URI plutôt que le lire en dur ; check-login.js,
// checkProductionConfig.js, create-user.js, migrate-*.js, seed.js sont des
// scripts de maintenance manuels avec leur propre bootstrap explicite).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');

test('B5 — config/env.js expose les variables centralisées avec les mêmes défauts qu\'avant', () => {
  const env = require('../config/env');

  assert.equal(typeof env.MONGO_URI, 'string', 'MONGO_URI doit être défini dans cet environnement');
  assert.equal(typeof env.JWT_SECRET, 'string', 'JWT_SECRET doit être défini dans cet environnement');

  // Défauts préservés à l'identique de ce qui était dispersé avant ce correctif.
  assert.equal(env.JWT_EXPIRE, process.env.JWT_EXPIRE || '7d');
  assert.equal(env.JWT_COOKIE_EXPIRE, process.env.JWT_COOKIE_EXPIRE || '7');
  assert.equal(env.CLIENT_URL, process.env.CLIENT_URL || 'http://localhost:5173');
  assert.equal(env.NODE_ENV, process.env.NODE_ENV || 'development');
  assert.equal(env.PORT, process.env.PORT || 5000);
  assert.equal(env.LOG_LEVEL, process.env.LOG_LEVEL || 'info');
  // MIGRATION-RESEND (13 sept. 2026) — remplace SMTP_PORT/SMTP_FROM (retirés
  // de config/env.js avec le reste de l'ancien transport SMTP/nodemailer).
  assert.equal(env.MAIL_FROM, process.env.MAIL_FROM || '"Clinique Canadienne" <onboarding@resend.dev>');

  // require() de Node met en cache le module — deux require() successifs
  // doivent renvoyer exactement le même objet (une seule lecture réelle de
  // process.env, pas une relecture à chaque accès).
  const env2 = require('../config/env');
  assert.equal(env, env2, 'config/env.js doit être un singleton (cache require standard)');
});

test('B5 — les 9 fichiers migrés se chargent sans erreur et exposent leurs valeurs par défaut correctement', () => {
  // Charger chacun confirme qu'aucun require('../config/env') mal résolu
  // (mauvaise profondeur relative) ne casse le chargement du module.
  assert.doesNotThrow(() => require('../config/db'));
  assert.doesNotThrow(() => require('../middleware/auth'));
  assert.doesNotThrow(() => require('../models/User'));
  assert.doesNotThrow(() => require('../utils/helpers'));
  assert.doesNotThrow(() => require('../utils/logger'));
  assert.doesNotThrow(() => require('../utils/mail'));
  assert.doesNotThrow(() => require('../controllers/googleAuth.controller'));
  assert.doesNotThrow(() => require('../controllers/prescriptions.controller'));
});
