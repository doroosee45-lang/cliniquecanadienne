// Sous-phase 5.5.c — Audit.jsx:1495-1497 avait un bouton "Sauvegarder" sans
// la moindre route associée (faux succès classique de ce chantier).
// utils/backup.js (T9.11) existait déjà comme utilitaire réel et testé,
// mais uniquement en CLI — jamais exposé en HTTP. Volumétrie réelle
// mesurée avant exposition (2383 documents / 49 collections sur la base
// actuelle) : quelques secondes, exposition jugée raisonnable avec deux
// garde-fous : verrou anti-concurrence + réponse asynchrone honnête (202,
// jamais une requête bloquée le temps du backup).
//
// Ce test prouve : (1) une sauvegarde RÉELLE est déclenchée — un vrai
// fichier apparaît sur disque avec un manifest cohérent avec la base
// réelle ; (2) le statut passe bien par "en cours" avant "terminé" ; (3)
// deux déclenchements concurrents sont refusés (409), pas d'exécution en
// parallèle ; (4) authorize('superadmin') — la vraie fonction montée sur
// ces 2 routes — refuse un rôle non-admin (403).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

async function waitUntilNotRunning(backupState, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (backupState.running) {
    if (Date.now() > deadline) throw new Error('Timeout : la sauvegarde ne s\'est jamais terminée.');
    await new Promise(r => setTimeout(r, 150));
  }
}

test('Sous-phase 5.5.c — sauvegarde réelle déclenchée via HTTP, verrou, statut asynchrone, 403', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const settingsC = require('../controllers/settings.controller');
  const backupState = require('../utils/backupState');
  const { authorize } = require('../middleware/auth');

  const superadmin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin' };
  const createdDirs = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('POST /settings/backup répond immédiatement 202 "en_cours" (réponse asynchrone honnête, pas d\'attente bloquée)', async () => {
      const { status, body } = await call(settingsC.triggerBackup, { user: superadmin, ip: '127.0.0.1' });
      assert.equal(status, 202, JSON.stringify(body));
      assert.equal(body.status, 'en_cours');
      assert.equal(backupState.running, true, 'le verrou doit être posé immédiatement, avant même la fin du travail réel');
    });

    await t.test('un second déclenchement pendant que le premier tourne encore est refusé (409) — verrou anti-concurrence', async () => {
      const { status, body } = await call(settingsC.triggerBackup, { user: superadmin, ip: '127.0.0.1' });
      assert.equal(status, 409, JSON.stringify(body));
      assert.equal(body.success, false);
    });

    await t.test('GET /settings/backup/status reflète "en cours" pendant l\'exécution, puis un vrai manifest une fois terminé', async () => {
      const { body: pendant } = await call(settingsC.getBackupStatus, {});
      assert.equal(pendant.running, true);

      await waitUntilNotRunning(backupState);

      const { body: apres } = await call(settingsC.getBackupStatus, {});
      assert.equal(apres.running, false);
      assert.equal(apres.lastError, null, 'la sauvegarde réelle ne doit pas avoir échoué');
      assert.ok(apres.lastManifest, 'un vrai manifest doit être disponible après la fin du travail réel');
      assert.ok(apres.lastManifest.collections && Object.keys(apres.lastManifest.collections).length > 10, 'le manifest doit couvrir un nombre réaliste de collections réelles');

      // Preuve la plus stricte : un vrai fichier existe réellement sur disque,
      // pas seulement une réponse JSON qui prétend qu'il existe.
      const dirs = fs.readdirSync(path.join(__dirname, '..', 'backups')).filter(d => d !== '.gitkeep');
      const mostRecent = dirs.sort().pop();
      const backupDir = path.join(__dirname, '..', 'backups', mostRecent);
      createdDirs.push(backupDir);
      assert.ok(fs.existsSync(path.join(backupDir, '_manifest.json')), 'le fichier _manifest.json doit réellement exister sur disque');
      const manifestOnDisk = JSON.parse(fs.readFileSync(path.join(backupDir, '_manifest.json'), 'utf8'));
      assert.equal(manifestOnDisk.database, mongoose.connection.name);
      assert.ok(fs.existsSync(path.join(backupDir, 'users.json')), 'une vraie collection (users) doit avoir un fichier JSON réel correspondant');
    });

    await t.test('une fois terminé, un nouveau déclenchement est de nouveau accepté (202) — le verrou n\'est pas resté bloqué', async () => {
      const { status, body } = await call(settingsC.triggerBackup, { user: superadmin, ip: '127.0.0.1' });
      assert.equal(status, 202, JSON.stringify(body));
      await waitUntilNotRunning(backupState);
      const dirs = fs.readdirSync(path.join(__dirname, '..', 'backups'));
      const mostRecent = dirs.sort().pop();
      createdDirs.push(path.join(__dirname, '..', 'backups', mostRecent));
    });

    await t.test('authorize(\'superadmin\') — la vraie fonction montée sur ces 2 routes — refuse un rôle non-admin (403)', async () => {
      let status = 200, nextCalled = false;
      const res = { status: (c) => { status = c; return res; }, json: () => {} };
      const req = { user: { _id: new mongoose.Types.ObjectId(), role: 'adminclinique' }, baseUrl: '/settings', originalUrl: '/settings/backup', method: 'POST', ip: '127.0.0.1' };
      await authorize('superadmin')(req, res, () => { nextCalled = true; });
      assert.equal(status, 403);
      assert.equal(nextCalled, false);
    });
  } finally {
    for (const dir of createdDirs) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
    }
    await mongoose.disconnect();
  }
});
