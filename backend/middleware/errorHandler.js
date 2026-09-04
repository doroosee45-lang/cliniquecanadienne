const multer = require('multer');
const env = require('../config/env');
const { logger, captureException } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  const logContext = { method: req.method, path: req.originalUrl, userId: req.user?._id };

  // SEC-002 — multer.MulterError (limite de taille/nombre de fichiers
  // dépassée) tombait dans la branche générique tout en bas et renvoyait 500
  // au lieu de 400 : la whitelist d'extensions (middleware/upload.js)
  // fonctionnait déjà correctement, seul le code HTTP retourné était faux.
  // Messages fixes ci-dessous plutôt que err.message brut : ne dépend pas du
  // texte interne de multer, jamais de chemin serveur.
  if (err instanceof multer.MulterError) {
    const MULTER_MESSAGES = {
      LIMIT_FILE_SIZE:        'Fichier trop volumineux.',
      LIMIT_FILE_COUNT:       'Trop de fichiers envoyés.',
      LIMIT_UNEXPECTED_FILE:  'Champ de fichier inattendu.',
    };
    error.message = MULTER_MESSAGES[err.code] || 'Fichier rejeté.';
    logger.warn(error.message, logContext);
    return res.status(400).json({ success: false, message: error.message });
  }

  // SEC-002 (suite) — erreur de fileFilter (middleware/upload.js, extension
  // hors whitelist), marquée err.code = 'UPLOAD_FILE_REJECTED' à la source :
  // détectée ici explicitement, plutôt que de retomber dans la branche
  // générique tout en bas (qui l'aurait classée en erreur inattendue —
  // niveau error, envoi Sentry — pour un simple fichier hors format). Le
  // message vient de fileFilter lui-même (nom d'extension issu du fichier
  // envoyé par le client, jamais un détail serveur).
  if (err.code === 'UPLOAD_FILE_REJECTED') {
    logger.warn(err.message, logContext);
    return res.status(400).json({ success: false, message: err.message });
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    error.message = 'Ressource introuvable.';
    logger.warn(error.message, logContext);
    return res.status(404).json({ success: false, message: error.message });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error.message = `La valeur "${err.keyValue[field]}" pour le champ "${field}" existe déjà.`;
    logger.warn(error.message, logContext);
    return res.status(400).json({ success: false, message: error.message });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    logger.warn(messages.join('. '), logContext);
    return res.status(400).json({ success: false, message: messages.join('. ') });
  }

  // T9.10 — au-delà des cas 4xx attendus ci-dessus (qui ont leur propre
  // cause connue et leur propre réponse), tout le reste est une erreur
  // réellement inattendue : niveau error (pas juste en dev comme avant),
  // pile complète, et envoi au suivi d'erreurs si configuré (Sentry) — les
  // erreurs de validation routinières ci-dessus ne sont volontairement PAS
  // envoyées à Sentry, pour ne pas noyer les vraies alertes sous le bruit.
  logger.error(err.message, { ...logContext, stack: err.stack });
  captureException(err, logContext);

  // SEC-003 — cette branche générique renvoyait error.message (le message
  // brut de l'exception réellement imprévue : driver Mongo, TypeError,
  // erreur réseau...) tel quel au client, y compris en production. La stack
  // trace elle-même n'a jamais été renvoyée (seulement loguée ci-dessus) —
  // seul le message était en cause. En production, message générique fixe :
  // le détail réel reste dans les logs/Sentry (déjà capturés ci-dessus),
  // jamais exposé au client. Les 3 branches 4xx explicites au-dessus (et les
  // 2 branches SEC-002) gardent leur propre message contrôlé dans les deux
  // environnements — non concernées par ce changement.
  const messagePublic = env.NODE_ENV === 'production'
    ? 'Erreur interne du serveur.'
    : (error.message || 'Erreur interne du serveur.');

  res.status(err.statusCode || 500).json({
    success: false,
    message: messagePublic,
  });
};

module.exports = errorHandler;
