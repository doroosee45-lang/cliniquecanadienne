
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

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignorer les erreurs réseau lors du logout
    } finally {
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

// LAB-HOOKS-001 (audit métier du 13 sept. 2026, Phase 4) — Laboratory.jsx
// appelait useAuth() à l'intérieur d'un try/catch pour tolérer un rendu
// isolé sans <AuthProvider> (ex. test), ce qui viole react-hooks/rules-of-
// hooks (un hook ne doit jamais être appelé dans un bloc try/catch — sans
// risque en usage normal ici, App.jsx montant toujours <AuthProvider>,
// mais un contournement fragile si un hook était ajouté après ce point).
// useAuthSafe() appelle useContext directement (jamais conditionnellement,
// jamais dans un try/catch) et renvoie simplement null en l'absence de
// provider, au lieu de lever — un composant qui tolère un rendu isolé peut
// s'appuyer dessus sans jamais contourner les Rules of Hooks.
export const useAuthSafe = () => useContext(AuthContext);

export default AuthContext;