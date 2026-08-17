// T9.10 — journalisation structurée (Winston), en remplacement des appels
// console.* dispersés dans le code du serveur en fonctionnement (pas les
// scripts CLI ponctuels — seed.js, create-user.js, check-login.js,
// migrate-*.js — jamais chargés par server.js, où la sortie console brute
// reste l'UX correcte pour un développeur qui lance le script à la main).
const winston = require('winston');

const isProd = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    isProd
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple()),
  ),
  defaultMeta: { service: 'medisync-backend' },
  transports: [new winston.transports.Console()],
});

// ── Suivi d'erreurs (Sentry) ────────────────────────────────────────────────
// Aucun SENTRY_DSN disponible dans cet environnement (pas de compte Sentry
// provisionné) — bloquant réel, documenté ici plutôt que sauté en silence.
// Le point d'intégration est néanmoins câblé et s'active automatiquement dès
// qu'un SENTRY_DSN est fourni en variable d'environnement : aucune autre
// modification de code ne sera nécessaire pour l'activer.
let sentryEnabled = false;
if (process.env.SENTRY_DSN) {
  const Sentry = require('@sentry/node');
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'development' });
  sentryEnabled = true;
  logger.info('Sentry initialisé (SENTRY_DSN détecté)');
} else {
  logger.warn('SENTRY_DSN non configuré — suivi d\'erreurs désactivé (T9.10 : aucun compte/DSN Sentry disponible dans cet environnement ; intégration câblée, s\'active dès que SENTRY_DSN est fourni)');
}

function captureException(err, context) {
  if (sentryEnabled) {
    require('@sentry/node').captureException(err, context ? { extra: context } : undefined);
  }
}

module.exports = { logger, captureException, sentryEnabled };
