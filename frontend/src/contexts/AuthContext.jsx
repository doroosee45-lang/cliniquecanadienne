// import { createContext, useContext, useState, useEffect, useCallback } from 'react';
// import api from '../api';

// const AuthContext = createContext(null);

// export const AuthProvider = ({ children }) => {
//   const [user, setUser] = useState(null);
//   const [loading, setLoading] = useState(true);

//   // Vérifie si l'utilisateur est connecté au démarrage.
//   // On utilise un flag _silent pour que l'intercepteur 401 ne redirige pas.
//   const fetchMe = useCallback(async () => {
//     try {
//       const { data } = await api.get('/auth/me');
//       setUser(data.user);
//     } catch {
//       // 401 attendu si non connecté — pas de toast, pas de redirect
//       setUser(null);
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => { fetchMe(); }, [fetchMe]);

//   const login = async (email, password) => {
//     const { data } = await api.post('/auth/login', { email, password });
//     // Stocker le token en sessionStorage comme fallback au cookie httpOnly
//     if (data.token) {
//       sessionStorage.setItem('ms_token', data.token);
//     }
//     setUser(data.user);
//     return data.user;
//   };

//   const logout = async () => {
//     try {
//       await api.post('/auth/logout');
//     } catch {
//       // Ignorer les erreurs réseau lors du logout
//     } finally {
//       sessionStorage.removeItem('ms_token');
//       setUser(null);
//     }
//   };

//   const hasRole = (...roles) => user && roles.includes(user.role);

//   return (
//     <AuthContext.Provider value={{ user, loading, login, logout, hasRole, setUser, fetchMe }}>
//       {children}
//     </AuthContext.Provider>
//   );
// };

// export const useAuth = () => {
//   const ctx = useContext(AuthContext);
//   if (!ctx) throw new Error('useAuth must be used within AuthProvider');
//   return ctx;
// };

// export default AuthContext;



import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * fetchMe — vérifie la session courante.
   * ✅ Exposé dans le context pour que Login.jsx puisse le rappeler
   *    après une connexion Google (ou toute connexion par token externe).
   */
  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user ?? null);
    } catch (err) {
      // 401 = non connecté → silence voulu, pas d'erreur UI
      // Autre erreur réseau → on log mais on ne crash pas
      if (err?.response?.status !== 401) {
        console.warn('[AuthContext] fetchMe error:', err?.message);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Vérification au montage
  useEffect(() => { fetchMe(); }, [fetchMe]);

  /**
   * login — connexion email/mot de passe classique.
   * Stocke le token en sessionStorage comme fallback au cookie httpOnly.
   */
  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.token) {
      sessionStorage.setItem('ms_token', data.token);
    }
    setUser(data.user);
    return data.user;
  };

  /**
   * logout — déconnexion propre.
   */
  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignorer les erreurs réseau lors du logout
    } finally {
      sessionStorage.removeItem('ms_token');
      setUser(null);
    }
  };

  /**
   * hasRole — vérifie si l'utilisateur a l'un des rôles donnés.
   * Usage : hasRole('admin') ou hasRole('medecin', 'infirmier')
   */
  const hasRole = (...roles) => !!user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole, setUser, fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};

export default AuthContext;