// Test de non-régression — contrôle d'accès serveur.
// Garantit statiquement (sans réseau ni base de données) que chaque route
// mutante (POST/PUT/PATCH/DELETE) de l'API, et chaque route de lecture des
// modules cliniques/financiers sensibles, passe par authorize(...) — pas
// seulement par protect (authentifié) — pour empêcher la régression de la
// faille corrigée en audit : un compte `patient` pouvait lire/écrire les
// données de tous les autres patients faute de contrôle de rôle.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', 'routes');

// Routes légitimement ouvertes à tout utilisateur authentifié (scoping fait
// au niveau du contrôleur par req.user._id — vérifié manuellement en audit) :
// messagerie, notifications, son propre profil. Routes publiques (login,
// activation par lien e-mail) légitimement sans authorize().
const EXEMPT_FILES = new Set(['messages.routes.js', 'notifications.routes.js', 'portal.routes.js']);
const EXEMPT_LINE_PATTERNS = [
  /router\.post\('\/login'/, /router\.post\('\/forgot-password'/, /router\.post\('\/reset-password/,
  /router\.post\('\/google'/, /router\.post\('\/logout'/, /router\.get\('\/me'/, /router\.put\('\/password'/,
  /router\.get\('\/activate\/:token'/,
];

function routeFiles() {
  return fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js') && f !== 'index.js');
}

test('toutes les routes mutantes déclarent authorize(...)', () => {
  const violations = [];
  for (const file of routeFiles()) {
    if (EXEMPT_FILES.has(file)) continue;
    const content = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      const isMutating = /^\s*router\.(post|put|patch|delete)\(/.test(line);
      if (!isMutating) return;
      if (EXEMPT_LINE_PATTERNS.some(p => p.test(line))) return;
      // authorize peut être inline (authorize(...)) ou via une variable
      // pré-liée (const canWrite = authorize(...); ... router.post(path, canWrite, ...))
      const hasInlineAuthorize = /authorize\(/.test(line);
      const usesNamedGuard = /,\s*(canWrite|canRead|ROLE)\s*,/.test(line) || /,\s*(canWrite|canRead|ROLE)\s*\)/.test(line);
      if (!hasInlineAuthorize && !usesNamedGuard) {
        violations.push(`${file}:${i + 1} — ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(violations, [], `Routes mutantes sans authorize() :\n${violations.join('\n')}`);
});

test('les routes de lecture des modules cliniques/financiers sensibles déclarent authorize(...)', () => {
  // Modules où une fuite de lecture inter-patients a été corrigée en audit —
  // toute régression sur router.get('/') ou router.get('/:id') doit échouer.
  const SENSITIVE_FILES = [
    'patients.routes.js', 'consultations.routes.js', 'hospitalization.routes.js',
    'laboratory.routes.js', 'radiology.routes.js', 'pharmacy.routes.js',
    'prescriptions.routes.js', 'finance.routes.js', 'appointments.routes.js',
    'dashboard.routes.js', 'chirurgieRoutes.js',
  ];
  const violations = [];
  for (const file of SENSITIVE_FILES) {
    const full = path.join(ROUTES_DIR, file);
    if (!fs.existsSync(full)) { violations.push(`${file} — fichier introuvable`); continue; }
    const lines = fs.readFileSync(full, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const isRead = /^\s*router\.get\(/.test(line);
      if (!isRead) return;
      if (/\/activate\/:token/.test(line)) return; // route publique légitime
      const hasInlineAuthorize = /authorize\(/.test(line);
      const usesNamedGuard = /,\s*(canWrite|canRead|ROLE)\s*[,)]/.test(line);
      if (!hasInlineAuthorize && !usesNamedGuard) violations.push(`${file}:${i + 1} — ${line.trim()}`);
    });
  }
  assert.deepEqual(violations, [], `Lectures sensibles sans authorize() :\n${violations.join('\n')}`);
});
