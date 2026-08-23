// AUDIT-M-A3 (Groupe A, Point 3) — ADMIN/STAFF étaient redéclarés à
// l'identique dans 6 fichiers de routes (archive/audit/document/dashboard/
// hr/settings.routes.js) — jamais divergents en valeur (juste un espacement
// cosmétique différent), une simple omission au fil des chantiers
// successifs. Centralisés dans utils/roles.js (fichier dédié, séparé de
// middleware/auth.js par choix explicite : taxonomie des rôles vs
// mécanique d'authentification, cohérent avec ROLES.* déjà séparé côté
// frontend). Ce test prouve : (a) statiquement, plus aucune redéclaration
// locale ne subsiste dans les 6 fichiers, tous importent bien utils/roles.js ;
// (b) en HTTP réel, le comportement d'autorisation reste strictement
// identique à avant le refactor pour un représentant ADMIN et un
// représentant STAFF.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const ROUTES_DIR = path.join(__dirname, '..', 'routes');
const FILES_WITH_ADMIN = ['archive.routes.js', 'audit.routes.js', 'document.routes.js', 'hr.routes.js', 'settings.routes.js'];
const FILES_WITH_STAFF = ['dashboard.routes.js', 'hr.routes.js', 'settings.routes.js'];

test('AUDIT-M-A3 — ADMIN/STAFF centralisés dans utils/roles.js, plus aucune redéclaration locale', () => {
  const rolesFile = fs.readFileSync(path.join(__dirname, '..', 'utils', 'roles.js'), 'utf8');
  assert.match(rolesFile, /ADMIN\s*=\s*\['superadmin',\s*'adminclinique'\]/);
  assert.match(rolesFile, /STAFF\s*=\s*\[/);
  assert.match(rolesFile, /module\.exports\s*=\s*\{\s*ADMIN,\s*STAFF\s*\}/);

  for (const file of new Set([...FILES_WITH_ADMIN, ...FILES_WITH_STAFF])) {
    const content = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
    assert.doesNotMatch(content, /^const ADMIN\s*=\s*\[/m, `${file} ne doit plus redéclarer ADMIN localement`);
    assert.doesNotMatch(content, /^const STAFF\s*=\s*\[/m, `${file} ne doit plus redéclarer STAFF localement`);
    assert.match(content, /require\(['"]\.\.\/utils\/roles['"]\)/, `${file} doit importer utils/roles.js`);
  }
});

const PASSWORD = 'RolesA3Test2026!';

async function login(base, email) {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (res.headers.get('set-cookie') || '').split(';')[0];
}
async function call(base, cookie, method, path) {
  const res = await fetch(`${base}${path}`, { method, headers: { Cookie: cookie } });
  return res.status;
}

test('AUDIT-M-A3 — comportement d\'autorisation inchangé après centralisation (HTTP réel)', { skip: !mongodExists() && 'mongod introuvable — impossible de démarrer un serveur isolé' }, async (t) => {
  const server = await startIsolatedServer();
  const BASE = server.baseUrl;
  const stamp = Date.now();

  try {
    await mongoose.connect(server.mongoUri);
    const User = require('../models/User');

    const superadmin  = `_a3-superadmin-${stamp}@_test.local`;
    const adminclinique = `_a3-adminclinique-${stamp}@_test.local`;
    const medecin      = `_a3-medecin-${stamp}@_test.local`;
    const infirmier     = `_a3-infirmier-${stamp}@_test.local`;
    await User.create({ email: superadmin,    password: PASSWORD, nom: 'T', prenom: 'SuperAdmin',    role: 'superadmin',    statut: 'actif' });
    await User.create({ email: adminclinique, password: PASSWORD, nom: 'T', prenom: 'AdminClinique', role: 'adminclinique', statut: 'actif' });
    await User.create({ email: medecin,       password: PASSWORD, nom: 'T', prenom: 'Medecin',       role: 'medecin',       statut: 'actif' });
    await User.create({ email: infirmier,     password: PASSWORD, nom: 'T', prenom: 'Infirmier',     role: 'infirmier',     statut: 'actif' });

    const cookieSuperadmin    = await login(BASE, superadmin);
    const cookieAdminClinique = await login(BASE, adminclinique);
    const cookieMedecin       = await login(BASE, medecin);
    const cookieInfirmier     = await login(BASE, infirmier);

    await t.test('ADMIN (via utils/roles.js) — /audit accessible à superadmin/adminclinique, refusé à medecin', async () => {
      assert.notEqual(await call(BASE, cookieSuperadmin, 'GET', '/audit'), 403);
      assert.notEqual(await call(BASE, cookieAdminClinique, 'GET', '/audit'), 403);
      assert.equal(await call(BASE, cookieMedecin, 'GET', '/audit'), 403);
    });

    await t.test('STAFF (via utils/roles.js) — /dashboard accessible à medecin/infirmier, refusé à un rôle hors liste (patient)', async () => {
      assert.notEqual(await call(BASE, cookieMedecin, 'GET', '/dashboard'), 403);
      assert.notEqual(await call(BASE, cookieInfirmier, 'GET', '/dashboard'), 403);

      const patientEmail = `_a3-patient-${stamp}@_test.local`;
      await User.create({ email: patientEmail, password: PASSWORD, nom: 'T', prenom: 'Patient', role: 'patient', statut: 'actif' });
      const cookiePatient = await login(BASE, patientEmail);
      assert.equal(await call(BASE, cookiePatient, 'GET', '/dashboard'), 403);
    });

    await User.deleteMany({ email: { $regex: /@_test\.local$/ } });
  } finally {
    await mongoose.disconnect();
    await server.stop();
  }
});
