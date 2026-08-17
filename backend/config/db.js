const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

const connectDB = async () => {
  try {
    // maxPoolSize par défaut du driver (100) est insuffisant dès qu'un seul
    // endpoint agrégé (ex: /api/dashboard, ~15-19 requêtes Mongo par appel)
    // est sollicité par une poignée d'utilisateurs simultanés — voir rapport
    // d'audit de charge. Relevé à 200 ; à ajuster selon le dimensionnement
    // réel du serveur MongoDB en production.
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 200,
      minPoolSize: 10,
    });
    logger.info('MongoDB connecté', { host: conn.connection.host });
  } catch (err) {
    logger.error('Erreur MongoDB', { error: err.message });
    process.exit(1);
  }
};

module.exports = connectDB;
