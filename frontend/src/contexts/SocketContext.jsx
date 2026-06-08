import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket]       = useState(null);
  const [connected, setConnected] = useState(false);
  // File d'activités reçues en temps réel (max 50 entrées)
  const [activities, setActivities] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      // Déconnexion propre si l'utilisateur se déconnecte
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const token = sessionStorage.getItem('ms_token');

    // En développement, Vite proxifie /socket.io → localhost:5000
    // En production, même origine
    const s = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 20000,
      path: '/socket.io',
    });

    socketRef.current = s;

    s.on('connect', () => {
      setConnected(true);
    });

    s.on('disconnect', () => {
      setConnected(false);
    });

    s.on('connect_error', (err) => {
      console.warn('[Socket] Erreur de connexion:', err.message);
      setConnected(false);
    });

    // Flux d'activités cliniques (visible sur le dashboard)
    s.on('activity:new', (activity) => {
      setActivities(prev => [activity, ...prev].slice(0, 50));
    });

    setSocket(s);

    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  // Se re-connecte uniquement si l'utilisateur change (login/logout)
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SocketContext.Provider value={{ socket, connected, activities }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within <SocketProvider>');
  return ctx;
};

export default SocketContext;
