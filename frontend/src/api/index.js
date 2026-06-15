import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ── Réponse : gestion centralisée des erreurs ───────────────────────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url    = err.config?.url || '';
    const status = err.response?.status;
    const msg    = err.response?.data?.message || 'Erreur réseau.';

    if (status === 401) {
      // /auth/me est appelé au démarrage pour vérifier si l'utilisateur est
      // connecté — un 401 ici est normal (pas encore connecté). On ne redirige
      // PAS, on laisse AuthContext mettre user = null silencieusement.
      if (!url.includes('/auth/me') && !url.includes('/auth/login')) {
        toast.error('Session expirée. Veuillez vous reconnecter.');
        setTimeout(() => { window.location.href = '/login'; }, 1500);
      }
    } else if (status === 429) {
      toast.error('Trop de requêtes. Attendez quelques instants.');
    } else if (status >= 500) {
      toast.error(msg);
    }
    // Les 400 sont gérés par chaque page individuellement
    return Promise.reject(err);
  }
);

export default api;
