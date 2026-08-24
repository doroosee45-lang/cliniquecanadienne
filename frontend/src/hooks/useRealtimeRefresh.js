import { useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';

/**
 * useRealtimeRefresh — ajoute le temps réel à n'importe quelle page.
 *
 * Fonctionnement :
 *  1. Polling de secours toutes les `intervalMs` ms (défaut 30 s), actif
 *     UNIQUEMENT tant que le socket n'est pas connecté (AUDIT-M-E10 — coupé
 *     dès la connexion : le socket porte alors déjà le temps réel, un
 *     polling permanent en plus était redondant sur les 17 pages
 *     consommatrices de ce hook).
 *  2. Dès que le socket se (re)connecte, un rafraîchissement immédiat
 *     unique rattrape ce qui aurait pu être manqué pendant la coupure.
 *  3. Re-fetch immédiat quand le serveur émet `dashboard:refresh`
 *  4. Re-fetch immédiat sur chaque événement listé dans `extraEvents`
 *
 * Usage :
 *   useRealtimeRefresh(loadData);
 *   useRealtimeRefresh(loadData, { intervalMs: 15000 });
 *   useRealtimeRefresh(loadData, { extraEvents: ['activity:new'] });
 *
 * @param {Function} loadData   - fonction appelée pour rafraîchir les données
 * @param {Object}   options
 * @param {number}   options.intervalMs   - intervalle de polling en ms (défaut 30000)
 * @param {string[]} options.extraEvents  - événements socket supplémentaires
 */
export function useRealtimeRefresh(loadData, { intervalMs = 30000, extraEvents = [] } = {}) {
  const { socket, connected } = useSocket();
  // Référence stable pour éviter les re-renders inutiles dans les closures
  const loadRef = useRef(loadData);
  useEffect(() => { loadRef.current = loadData; }, [loadData]);

  // Polling de secours — seulement tant que le socket n'est pas connecté
  // (au tout premier montage, connected vaut déjà false : le polling
  // démarre donc immédiatement, avant toute connexion, comme avant).
  useEffect(() => {
    if (connected) return;
    const iv = setInterval(() => loadRef.current?.(), intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs, connected]);

  // Rattrapage unique à la (re)connexion — données potentiellement
  // manquées pendant que le socket était déconnecté et que seul le
  // polling de secours tournait.
  const wasConnected = useRef(false);
  useEffect(() => {
    if (connected && !wasConnected.current) loadRef.current?.();
    wasConnected.current = connected;
  }, [connected]);

  // Écoute des événements Socket.IO
  useEffect(() => {
    if (!socket) return;
    const handler = () => loadRef.current?.();
    const events = ['dashboard:refresh', ...extraEvents];
    events.forEach(ev => socket.on(ev, handler));
    return () => events.forEach(ev => socket.off(ev, handler));
  }, [socket, ...extraEvents]); // eslint-disable-line react-hooks/exhaustive-deps
}
