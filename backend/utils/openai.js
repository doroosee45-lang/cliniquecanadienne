// AUDIT-ANALYTICS-P8 — même structure que utils/sms.js : une fonction
// d'appel, repli explicite en mode simulé si OPENAI_API_KEY n'est pas
// configurée (jamais un faux succès, jamais un texte de repli présenté
// comme réellement généré par IA), erreur réelle propagée si l'appel
// OpenAI échoue (clé invalide, quota dépassé, réponse vide...). Le fetch
// n'est fait qu'à l'appel (jamais au chargement du module).
const { logger } = require('./logger');
const env = require('../config/env');

const OPENAI_MODEL = 'gpt-4o-mini';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const isConfigured = () => Boolean(env.OPENAI_API_KEY);

/**
 * @param {{ systemPrompt: string, userPrompt: string }} opts
 * @returns {Promise<{ simulated: true } | { content: string }>}
 */
const generateReport = async ({ systemPrompt, userPrompt }) => {
  if (!isConfigured()) {
    logger.warn('[OPENAI] OPENAI_API_KEY non configurée — rapport IA simulé');
    return { simulated: true };
  }
  let res, data;
  try {
    res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
      }),
    });
    data = await res.json();
  } catch (err) {
    logger.error('[OPENAI ERROR] Échec réseau appel OpenAI', { error: err.message });
    throw new Error(err.message || "Échec réseau lors de l'appel OpenAI.");
  }
  if (!res.ok) {
    const message = data?.error?.message || `Échec de l'appel OpenAI (HTTP ${res.status}).`;
    logger.error('[OPENAI ERROR] Réponse OpenAI en échec', { status: res.status, message });
    throw new Error(message);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    logger.error('[OPENAI ERROR] Réponse OpenAI vide ou de forme inattendue');
    throw new Error('Réponse OpenAI vide ou de forme inattendue.');
  }
  return { content };
};

module.exports = { generateReport, isConfigured };
