/**
 * Socket.IO singleton — partagé entre server.js et tous les contrôleurs.
 * Initialiser avec setIO(io) dans server.js avant tout usage.
 */

let _io = null;

/** Enregistre l'instance Socket.IO (appelé une seule fois dans server.js) */
const setIO = (io) => { _io = io; };

/** Récupère l'instance Socket.IO */
const getIO = () => _io;

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
 * Diffuse un événement à tous les clients connectés.
 */
const broadcast = (event, data) => {
  if (!_io) return;
  _io.emit(event, data);
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
  if (!_io) return;
  _io.emit('dashboard:refresh');
};

module.exports = { setIO, getIO, emitTo, broadcast, emitActivity, emitDashboardUpdate };
