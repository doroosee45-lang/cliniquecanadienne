import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Cible du proxy dev — configurable via VITE_PROXY_TARGET pour les tests
// bout en bout (Playwright, etc.) qui doivent pointer vers un backend local
// isolé (mongod local, cf. tests/helpers/isolatedServer.js) plutôt que vers
// le backend de développement réel connecté à Atlas. Fallback inchangé :
// sans cette variable, comportement strictement identique à avant.
const PROXY_TARGET = process.env.VITE_PROXY_TARGET || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: PROXY_TARGET,
        changeOrigin: true,
        secure: false,
        // Réécriture du domaine du cookie pour que le navigateur accepte
        // les cookies Set-Cookie de l'upstream (localhost:5000) sur localhost:5173
        cookieDomainRewrite: 'localhost',
        // Conserver les en-têtes Set-Cookie tels quels
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const cookies = proxyRes.headers['set-cookie'];
            if (cookies) {
              // Supprimer SameSite=Strict pour que le proxy fonctionne correctement
              proxyRes.headers['set-cookie'] = cookies.map((c) =>
                c
                  .replace(/SameSite=Strict/gi, 'SameSite=Lax')
                  .replace(/Secure;?\s*/gi, '')
              );
            }
          });
        },
      },
      '/uploads': {
        target: PROXY_TARGET,
        changeOrigin: true,
      },
      // Proxy Socket.IO (WebSocket + polling)
      '/socket.io': {
        target: PROXY_TARGET,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  // QA-002 — infrastructure de test frontend (0 test existant avant ce
  // chantier). jsdom : les pages testées ici rendent du vrai DOM (formulaires,
  // boutons désactivés) sans navigateur réel. globals:true évite un import
  // répété de describe/it/expect dans chaque fichier de test, cohérent avec
  // la convention déjà choisie côté backend (node:test global-like usage).
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
});
