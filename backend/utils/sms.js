// AUDIT-MESSAGES-PhaseD — même structure que utils/mail.js : une fonction
// d'envoi, repli explicite en mode simulé si Twilio n'est pas configuré
// (jamais un faux succès, jamais un échec silencieux), erreur réelle
// propagée si Twilio répond en échec (numéro invalide, compte suspendu...).
// Le client Twilio n'est instancié qu'à l'envoi (jamais au chargement du
// module) pour ne jamais construire un client avec des identifiants vides
// quand Twilio n'est pas configuré.
const { logger } = require('./logger');
const env = require('../config/env');

const isConfigured = () => Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER);

const getClient = () => {
  const twilio = require('twilio');
  return twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
};

/**
 * @param {{ to: string, body: string }} opts
 * @returns {Promise<{ simulated: true } | { sid: string, status: string }>}
 */
const sendSms = async ({ to, body }) => {
  if (!isConfigured()) {
    logger.warn('[SMS] Twilio non configuré — SMS simulé', { to });
    return { simulated: true };
  }
  try {
    const message = await getClient().messages.create({ to, body, from: env.TWILIO_PHONE_NUMBER });
    return { sid: message.sid, status: message.status };
  } catch (err) {
    // Les erreurs Twilio (numéro invalide, compte suspendu, solde épuisé...)
    // décrivent l'échec de l'appel API, jamais les identifiants eux-mêmes —
    // sûr à logger/propager tel quel, comme nodemailer dans mail.js.
    logger.error('[SMS ERROR] Échec envoi SMS', { to, error: err.message });
    const wrapped = new Error(err.message || "Échec de l'envoi du SMS.");
    wrapped.code = err.code;
    throw wrapped;
  }
};

module.exports = { sendSms, isConfigured };
