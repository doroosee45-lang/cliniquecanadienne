/**
 * Socket.IO singleton — partagé entre server.js et tous les contrôleurs.
 * Initialiser avec setIO(io) dans server.js avant tout usage.
 */

let _io = null;

/** Enregistre l'instance Socket.IO (appelé une seule fois dans server.js) */
const setIO = (io) => { _io = io; };

/**
 * Émet un événement vers une room spécifique.
 * @param {string} room   ex: 'user:abc123', 'conversation:xyz'
 * @param {string} event  ex: 'notification:new', 'message:new'
 * @param {*}      data
 */
const emitTo = (room, event, data) => {
  if (!_io) return;
  _io.to(room).emit(event, data);
};

/**
 * Émet une activité clinique en temps réel visible sur le dashboard.
 * Chaque contrôleur l'appelle après une mutation significative.
 *
 * @param {{ module, action, detail, icon, userId, userName }} activity
 */
const emitActivity = (activity) => {
  if (!_io) return;
  _io.emit('activity:new', {
    ...activity,
    timestamp: new Date(),
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
};

/**
 * Signale au dashboard qu'une statistique vient de changer.
 * Déclenche un re-fetch léger côté client.
 */
const emitDashboardUpdate = () => {
  // T9.9 — invalide le cache court des stats dashboard à chaque évènement
  // métier connu, plutôt que de compter uniquement sur l'expiration passive
  // du TTL (30s) : un client qui reçoit dashboard:refresh et re-fetch
  // immédiatement après doit voir la donnée à jour, pas l'ancienne servie
  // depuis le cache pour encore quelques secondes.
  require('./dashboardCache').invalidateStatsCache();
  if (!_io) return;
  _io.emit('dashboard:refresh');
};

// CODE-001 (audit indépendant du 6 sept. 2026) — getIO() et broadcast()
// étaient exportées mais jamais appelées nulle part dans le backend
// (vérifié exhaustivement : aucune occurrence de "getIO(" ni "broadcast("
// hors leur propre définition ici, et les ~20 fichiers qui importent ce
// module ne déstructurent jamais ces deux noms). Retirées.
module.exports = { setIO, emitTo, emitActivity, emitDashboardUpdate };
