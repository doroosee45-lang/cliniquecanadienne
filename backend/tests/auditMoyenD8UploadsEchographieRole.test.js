// AUDIT-M-D8 (Groupe D, Point 8) — uploads.controller.js::SUBPATH_ROLES ne
// référençait pas le sous-répertoire 'echographie' (seuls patients,
// medications, radiology, documents, messages y figuraient), alors même que
// echographieController.js::uploadImages stocke réellement les fichiers dans
// uploads/echographie/ (cf. echographieUploadImages.test.js, déjà vert). Le
// flux cassait exclusivement en LECTURE : GET /uploads/echographie/<fichier>
// tombait sur SUBPATH_ROLES['echographie'] === undefined → 404 immédiat,
// avant même la vérification de rôle (L.38-39 du contrôleur), quel que soit
// l'utilisateur et que le fichier existe ou non sur disque.
//
// Correctif : une seule entrée ajoutée, copie exacte de CAN
// (echographie.routes.js) — mêmes rôles que ceux qui créent/consultent une
// demande d'échographie, aucun rôle inventé. Même pattern que test S-1
// (auditS1UploadsControleRole.test.js), qui reste la preuve de
// non-régression pour patients/documents/traversée — non dupliqué ici.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('AUDIT-M-D8 — /uploads/echographie/* servi aux rôles autorisés, refusé aux autres, protections intactes (pas de DB requise)', async (t) => {
  const uploadsC = require('../controllers/uploads.controller');
  const uploadsRoot = path.join(__dirname, '..', 'uploads');
  const testDir = path.join(uploadsRoot, 'echographie');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
  const testFile = `_d8-test-${Date.now()}.jpg`;
  const testFilePath = path.join(testDir, testFile);
  fs.writeFileSync(testFilePath, 'contenu image test D8');

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
    // Cohérence rôles — recopie exacte de CAN (echographie.routes.js), pas
    // une matrice inventée pour ce point. Toute divergence future entre les
    // deux listes doit faire échouer ce test explicitement plutôt que de
    // dériver silencieusement.
    await t.test('SUBPATH_ROLES.echographie == CAN de echographie.routes.js (aucun rôle ajouté/oublié)', () => {
      const routesSrc = fs.readFileSync(path.join(__dirname, '..', 'routes', 'echographie.routes.js'), 'utf8');
      const match = routesSrc.match(/const CAN = \[([^\]]+)\]/);
      assert.ok(match, 'CAN doit toujours exister dans echographie.routes.js');
      const canRoles = match[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
      const uploadsSrc = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'uploads.controller.js'), 'utf8');
      const matchUp = uploadsSrc.match(/echographie:\s*\[([^\]]+)\]/);
      assert.ok(matchUp, 'SUBPATH_ROLES.echographie doit exister');
      const uploadRoles = matchUp[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
      assert.deepEqual([...uploadRoles].sort(), [...canRoles].sort());
    });

    // Test 2/4 (liste utilisateur) : accès rôle autorisé → image servie.
    await t.test('rôle autorisé (medecin, dans CAN échographie) → image servie', () => {
      const { status, sentFile } = call(`echographie/${testFile}`, 'medecin');
      assert.equal(status, 200, 'aucun .status() explicite ne doit être appelé sur un succès');
      assert.equal(sentFile, path.resolve(testFilePath));
    });

    await t.test('autre rôle autorisé (sage_femme, présent dans CAN) → image servie', () => {
      const { sentFile } = call(`echographie/${testFile}`, 'sage_femme');
      assert.equal(sentFile, path.resolve(testFilePath));
    });

    // Test 5 : rôle non autorisé → 403, fichier jamais servi.
    await t.test('rôle non autorisé pour échographie (receptionniste) → 403, fichier jamais servi', () => {
      const { status, body, sentFile } = call(`echographie/${testFile}`, 'receptionniste');
      assert.equal(status, 403);
      assert.equal(sentFile, null);
      assert.match(body.message, /refus/i);
    });

    await t.test('rôle patient (jamais destiné à consulter ce sous-répertoire) → 403', () => {
      const { status, sentFile } = call(`echographie/${testFile}`, 'patient');
      assert.equal(status, 403);
      assert.equal(sentFile, null);
    });

    // Test 6 : chemin/fichier inexistant → 404, aucune fuite d'information
    // (même message générique que pour les autres sous-répertoires).
    await t.test('fichier inexistant dans echographie/ (rôle autorisé) → 404, pas de fuite', () => {
      const { status, body, sentFile } = call('echographie/_d8-inexistant.jpg', 'radiologue');
      assert.equal(status, 404);
      assert.equal(sentFile, null);
      assert.match(body.message, /introuvable/i);
    });

    // Anti-traversée — garde générique de serveUpload, doit continuer à
    // s'appliquer identiquement sous echographie/.
    await t.test('tentative de traversée de chemin sous echographie/ → 400, jamais de fichier hors uploads/', () => {
      const { status, sentFile } = call('echographie/../../../.env', 'superadmin');
      assert.equal(status, 400);
      assert.equal(sentFile, null);
    });
  } finally {
    if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
  }
});

// Round-trip complet : preuve que le chemin réellement produit par
// echographieController.js::uploadImages (pas un fichier de test synthétique
// placé à la main) est ensuite servable par serveUpload — le flux upload →
// stockage → chemin retourné → récupération dans son intégralité, pas ses
// deux moitiés testées séparément.
test('AUDIT-M-D8 — round-trip réel : uploadImages persiste, serveUpload sert le même fichier (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGO_URI);
  const Echographie = require('../models/Echographie');
  const User = require('../models/User');
  const echoC = require('../controllers/echographieController');
  const uploadsC = require('../controllers/uploads.controller');
  const uploadsRoot = path.join(__dirname, '..', 'uploads');

  const stamp = Date.now();
  const agent = await User.create({ email: `_d8-rt-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Agent', prenom: 'RT', role: 'radiologue', statut: 'actif' });
  const demande = await Echographie.create({
    patient: new mongoose.Types.ObjectId(), patient_nom: `Patiente D8 ${stamp}`, dossier: 'DOS-D8-0001', age: 28, sexe: 'F',
    source: 'Maternité', medecin_presc: 'Dr. Test', type: 'Obstétricale', sous_type: 'Morphologique',
    motif: 'Contrôle', priorite: 'normale', statut: 'realisee',
  });
  const echoDir = path.join(uploadsRoot, 'echographie');
  if (!fs.existsSync(echoDir)) fs.mkdirSync(echoDir, { recursive: true });
  const realFilename = `${stamp}-roundtrip.jpg`;
  fs.writeFileSync(path.join(echoDir, realFilename), 'contenu réel round-trip D8');

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };
  const callServe = (params0, role) => {
    let status = 200, body = null, sentFile = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; return res; }, sendFile: (p) => { sentFile = p; } };
    uploadsC.serveUpload({ params: { 0: params0 }, user: { role } }, res);
    return { status, body, sentFile };
  };

  try {
    const { status, body } = await call(echoC.uploadImages, {
      user: agent, ip: '127.0.0.1', params: { id: demande._id.toString() },
      files: [{ filename: realFilename, originalname: 'roundtrip.jpg' }],
    });
    assert.equal(status, 200);
    const url = body.images[0].url;
    assert.equal(url, `/uploads/echographie/${realFilename}`);

    // Même transformation que <img src={img.url}> → GET /uploads/<url sans le préfixe /uploads/>.
    const subpathFromUrl = url.replace(/^\/uploads\//, '');
    const { sentFile } = callServe(subpathFromUrl, agent.role);
    assert.equal(sentFile, path.resolve(path.join(echoDir, realFilename)), 'le fichier réellement uploadé doit être servable via son url persisté, tel quel');
  } finally {
    const f = path.join(echoDir, realFilename);
    if (fs.existsSync(f)) fs.unlinkSync(f);
    await Echographie.findByIdAndDelete(demande._id);
    await User.findByIdAndDelete(agent._id);
    await mongoose.disconnect();
  }
});
