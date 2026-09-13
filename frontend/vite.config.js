import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// defineConfig vient de 'vite' (pas 'vitest/config') : Render installe avec
// NODE_ENV=production, qui saute les devDependencies (dont vitest) — importer
// 'vitest/config' faisait alors échouer `vite build` en prod avec
// ERR_MODULE_NOT_FOUND. 'vite' exporte le même defineConfig ; il ne fait que
// retourner l'objet tel quel, donc le bloc `test` ci-dessous (lu par Vitest
// en local/CI) n'est ni validé ni modifié par ce changement.

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
    // HOSP-04/diagnostic du 13 sept. 2026 — en parallélisme par défaut
    // (jusqu'à 1 fork par cœur), la création concurrente de ~8 environnements
    // jsdom sature la machine et pousse occasionnellement un test par
    // ailleurs rapide (ex. HOSP-04 : 1792ms isolé) au-delà du testTimeout de
    // 5000ms — mesuré : 2/133 échecs aléatoires en parallèle non borné
    // (166.90s), 0/133 en séquentiel (157.78s) et 0/133 avec maxWorkers à
    // 50% des cœurs, cette dernière option étant aussi la plus rapide des
    // trois (73.84s). Aucun test ni composant modifié — seule la
    // concurrence est bornée.
    maxWorkers: '50%',
  },
});
