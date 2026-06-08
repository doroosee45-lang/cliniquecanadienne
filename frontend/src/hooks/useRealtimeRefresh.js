import { useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';

/**
 * useRealtimeRefresh — ajoute le temps réel à n'importe quelle page.
 *
 * Fonctionnement :
 *  1. Polling de sécurité toutes les `intervalMs` ms (défaut 30 s)
 *  2. Re-fetch immédiat quand le serveur émet `dashboard:refresh`
 *  3. Re-fetch immédiat sur chaque événement listé dans `extraEvents`
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
  const { socket } = useSocket();
  // Référence stable pour éviter les re-renders inutiles dans les closures
  const loadRef = useRef(loadData);
  useEffect(() => { loadRef.current = loadData; }, [loadData]);

  // Polling de sécurité (fonctionne même si socket non connecté)
  useEffect(() => {
    const iv = setInterval(() => loadRef.current?.(), intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs]);

  // Écoute des événements Socket.IO
  useEffect(() => {
    if (!socket) return;
    const handler = () => loadRef.current?.();
    const events = ['dashboard:refresh', ...extraEvents];
    events.forEach(ev => socket.on(ev, handler));
    return () => events.forEach(ev => socket.off(ev, handler));
  }, [socket, ...extraEvents]); // eslint-disable-line react-hooks/exhaustive-deps
}
