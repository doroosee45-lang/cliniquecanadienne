// AUDIT-S-1 — /uploads était servi par express.static, protégé uniquement
// par `protect` (authentification) : n'importe quel compte authentifié,
// quel que soit son rôle, pouvait récupérer n'importe quel fichier en
// devinant/énumérant un nom. Remplacé par uploads.controller.js::serveUpload,
// qui réapplique un contrôle de rôle par sous-répertoire (mêmes listes
// CAN_READ que les routes qui produisent ces fichiers). Ce test prouve :
// rôle autorisé → fichier servi, rôle non autorisé → 403, sous-répertoire
// inconnu → 404, tentative de traversée de chemin → 400 (jamais un fichier
// hors uploads/), fichier absent dans un sous-répertoire autorisé → 404.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('S-1 — contrôle de rôle par sous-répertoire sur /uploads (pas de DB requise)', async (t) => {
  const uploadsC = require('../controllers/uploads.controller');
  const uploadsRoot = path.join(__dirname, '..', 'uploads');
  const testDir = path.join(uploadsRoot, 'patients');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
  const testFile = `_s1-test-${Date.now()}.txt`;
  const testFilePath = path.join(testDir, testFile);
  fs.writeFileSync(testFilePath, 'contenu de test S-1');

  const call = (params0, role) => {
    let status = 200, body = null, sentFile = null;
    const res = {
      status: (c) => { status = c; return res; },
      json: (d) => { body = d; return res; },
      sendFile: (p) => { sentFile = p; },
    };
    uploadsC.serveUpload({ params: { 0: params0 }, user: { role } }, res);
    return { status, body, sentFile };
  };

  try {
    await t.test('rôle autorisé (medecin, dans CAN_READ patients) → fichier servi', () => {
      const { sentFile, status } = call(`patients/${testFile}`, 'medecin');
      assert.equal(status, 200, 'aucun .status() explicite ne doit être appelé sur un succès (sendFile gère la réponse)');
      assert.equal(sentFile, path.resolve(testFilePath));
    });

    await t.test('rôle non autorisé pour ce sous-répertoire (patient) → 403, fichier jamais servi', () => {
      const { status, body, sentFile } = call(`patients/${testFile}`, 'patient');
      assert.equal(status, 403);
      assert.equal(sentFile, null);
      assert.match(body.message, /refus/i);
    });

    await t.test('sous-répertoire inconnu → 404 avant même de vérifier le rôle', () => {
      const { status, sentFile } = call('etc/passwd', 'superadmin');
      assert.equal(status, 404);
      assert.equal(sentFile, null);
    });

    await t.test('tentative de traversée de chemin → 400, jamais de fichier hors uploads/', () => {
      const { status, sentFile } = call('patients/../../../.env', 'superadmin');
      assert.equal(status, 400);
      assert.equal(sentFile, null);
    });

    await t.test('fichier absent dans un sous-répertoire autorisé → 404', () => {
      const { status, sentFile } = call('patients/_s1-inexistant.jpg', 'medecin');
      assert.equal(status, 404);
      assert.equal(sentFile, null);
    });

    await t.test('rôle superadmin autorisé sur tous les sous-répertoires, y compris documents (ADMIN uniquement)', () => {
      const docsDir = path.join(uploadsRoot, 'documents');
      if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
      const docFile = `_s1-doc-${Date.now()}.pdf`;
      fs.writeFileSync(path.join(docsDir, docFile), 'doc test');
      try {
        const { status: statusAdmin } = call(`documents/${docFile}`, 'superadmin');
        assert.equal(statusAdmin, 200);
        const { status: statusMed } = call(`documents/${docFile}`, 'medecin');
        assert.equal(statusMed, 403, 'documents reste réservé à ADMIN, même un médecin ne doit pas y accéder');
      } finally {
        fs.unlinkSync(path.join(docsDir, docFile));
      }
    });
  } finally {
    if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
  }
});
