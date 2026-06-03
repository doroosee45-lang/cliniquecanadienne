const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  if (process.env.NODE_ENV === 'development') console.error(err.stack);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    error.message = 'Ressource introuvable.';
    return res.status(404).json({ success: false, message: error.message });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error.message = `La valeur "${err.keyValue[field]}" pour le champ "${field}" existe déjà.`;
    return res.status(400).json({ success: false, message: error.message });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ success: false, message: messages.join('. ') });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: error.message || 'Erreur interne du serveur.',
  });
};

module.exports = errorHandler;
