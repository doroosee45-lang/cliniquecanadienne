// SEC-B-01 (correction du 12 sept. 2026, audit indépendant) — server.js,
// imgSrc de la CSP contenait "https:" nu : autorisait le chargement
// d'image depuis N'IMPORTE QUEL hôte HTTPS, bien au-delà des besoins
// réels. Vérifié exhaustivement (grep sur tout frontend/src) : le seul
// hôte externe réellement utilisé pour des images est
// images.unsplash.com (home.jsx, Login.jsx) ; les images
// patients/médicaments uploadées sont servies en same-origin
// (/uploads/...), déjà couvertes par 'self'. Preuve réelle : lit le vrai
// en-tête HTTP Content-Security-Policy renvoyé par une vraie instance du
// serveur, jamais une inspection statique du code source.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

test('SEC-B-01 — imgSrc de la CSP restreint aux hôtes réellement utilisés, jamais "https:" nu', { skip: !mongodExists() && 'mongod introuvable — impossible de démarrer un serveur isolé pour ce test' }, async (t) => {
  const server = await startIsolatedServer();
  try {
    await t.test('le header CSP réel expose bien images.unsplash.com et self/data/blob, jamais un "https:" générique', async () => {
      const res = await fetch(`${server.baseUrl}/health`);
      const csp = res.headers.get('content-security-policy');
      assert.ok(csp, 'un en-tête CSP doit réellement être renvoyé');
      const imgSrcMatch = csp.match(/img-src ([^;]*)/);
      assert.ok(imgSrcMatch, 'la directive img-src doit être présente');
      const imgSrc = imgSrcMatch[1];
      assert.match(imgSrc, /'self'/);
      assert.match(imgSrc, /data:/);
      assert.match(imgSrc, /blob:/);
      assert.match(imgSrc, /https:\/\/images\.unsplash\.com/, 'le seul hôte externe réellement utilisé (home.jsx/Login.jsx) doit rester autorisé');
      assert.doesNotMatch(imgSrc, /(^|\s)https:(\s|;|$)/, 'un "https:" nu (tout hôte HTTPS) ne doit plus jamais apparaître dans img-src');
    });
  } finally {
    await server.stop();
  }
});
