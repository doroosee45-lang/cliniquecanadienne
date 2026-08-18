// T9.9 — cache court des statistiques de tableau de bord. Redis n'est ni
// installé ni configuré dans cet environnement (aucun redis-cli, aucune
// REDIS_URL) ; node-cache (mémoire du process) est retenu à la place —
// choix validé explicitement avec l'utilisateur avant implémentation.
// Justifié aussi sur le fond : un seul process Node (pas de cluster/PM2
// dans server.js), donc pas de problème de cohérence inter-process ; les
// stats sont des agrégats à TTL court où perdre le cache au redémarrage
// est sans conséquence (se reconstruit dès la première requête).
const NodeCache = require('node-cache');

const STATS_TTL_SECONDS = 30;
const statsCache = new NodeCache({ stdTTL: STATS_TTL_SECONDS, checkperiod: 60 });

// personalized : true pour les handlers qui filtrent par req.user._id
// (medecinStats: "mes patients" ; receptionnisteStats: messages non lus
// de l'utilisateur) — la clé de cache doit alors inclure l'utilisateur
// pour ne jamais servir les stats d'un médecin à un autre. Accepte aussi
// une fonction (req) => suffixe (AUDIT-B4) : nécessaire pour
// analytics.controller.js::getStats, dont la fenêtre temporelle dépend de
// req.query.periode — un même cacheKey global aurait servi le résultat
// d'une période à une requête pour une autre période.
function cacheStats(cacheKey, personalized, handler) {
  return async (req, res, next) => {
    const key = typeof personalized === 'function'
      ? `${cacheKey}:${personalized(req)}`
      : personalized ? `${cacheKey}:${req.user._id}` : cacheKey;
    const hit = statsCache.get(key);
    if (hit !== undefined) {
      // res.set est un en-tête de diagnostic optionnel — de nombreux tests
      // de ce projet appellent les contrôleurs avec un faux `res` minimal
      // ({status, json}) sans .set() ; ne jamais en dépendre pour le
      // fonctionnement réel du cache.
      if (typeof res.set === 'function') res.set('X-Dashboard-Cache', 'hit');
      return res.json(hit);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Ne met en cache que les réponses de succès — une erreur (ex. 404,
      // 500) ne doit jamais être mémorisée comme si c'était un résultat.
      // res.statusCode vaut 200 par défaut (http.ServerResponse), même sans
      // appel explicite à .status(200).
      if (res.statusCode >= 200 && res.statusCode < 300) {
        statsCache.set(key, body);
      }
      if (typeof res.set === 'function') res.set('X-Dashboard-Cache', 'miss');
      return originalJson(body);
    };

    return handler(req, res, next);
  };
}

// Invalidation explicite — appelée par emitDashboardUpdate() (utils/socket.js)
// pour que le cache ne serve jamais un état plus vieux que 30s après un
// évènement métier connu (nouvelle admission, paiement, etc.), plutôt que
// de compter uniquement sur l'expiration passive du TTL.
function invalidateStatsCache() {
  statsCache.flushAll();
}

module.exports = { cacheStats, invalidateStatsCache, statsCache };
