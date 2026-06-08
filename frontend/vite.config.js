import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
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
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Proxy Socket.IO (WebSocket + polling)
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
