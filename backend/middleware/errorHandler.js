const { logger, captureException } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  const logContext = { method: req.method, path: req.originalUrl, userId: req.user?._id };

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

  res.status(err.statusCode || 500).json({
    success: false,
    message: error.message || 'Erreur interne du serveur.',
  });
};

module.exports = errorHandler;
