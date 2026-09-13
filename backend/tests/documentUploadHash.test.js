// Ticket 0006 / R-10b — le modèle Document n'était référencé nulle part
// dans le backend : aucun endpoint d'upload, donc hash_integrite jamais
// calculé. Ce test vérifie le nouvel endpoint minimal (upload, hash,
// consultation, statut par défaut actif) — pas les transitions de cycle
// de vie, hors périmètre par décision explicite.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { withLocalUploadFallback } = require('./helpers/forceLocalUploadFallback');

test('upload de document + hash d\'intégrité (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Document = require('../models/Document');
  const User = require('../models/User'); // enregistré pour Document.populate('created_by') dans getAll/getOne, et pour le test authorize() ci-dessous
  require('../models/Patient'); // idem pour populate('patient')
  const docC = require('../controllers/document.controller');
  const { authorize } = require('../middleware/auth');
  const { uploadDocument } = require('../middleware/upload');

  const admin = { _id: new mongoose.Types.ObjectId(), prenom: 'Admin', nom: 'Test' };
  const cleanup = [];

  // Simule une vraie requête multipart/form-data pour exercer le multer réel
  // (uploadDocument) plutôt que d'appeler une fonction interne — fileFilter
  // et limits.fileSize sont tous deux implémentés par la lib multer/busboy
  // en flux, pas par une fonction pure isolable, donc c'est le seul moyen
  // fiable de vérifier leur comportement de rejet réel.
  const multerReject = (parts, boundary) => new Promise((resolve) => {
    const totalLength = parts.reduce((n, p) => n + p.length, 0);
    const req = new Readable({ read() {} });
    // type-is (utilisé par multer pour détecter une requête multipart) exige
    // content-length ou transfer-encoding pour considérer que la requête a un
    // corps — sans ça, is(req, ['multipart']) renvoie null et multer saute
    // silencieusement le parsing (next() sans erreur, aucun test réel).
    req.headers = {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(totalLength),
    };
    for (const part of parts) req.push(part);
    req.push(null);
    uploadDocument.single('fichier')(req, {}, (err) => resolve(err || null));
  });

  // next() capturant l'erreur au lieu de l'avaler silencieusement — sinon
  // un contrôleur qui échoue et appelle next(err) laisse juste res.json()
  // jamais invoqué, sans indice sur la cause réelle.
  const call = async (fn, req) => {
    let status = 200, body = null, error = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { error = err; });
    if (error) throw error;
    return { status, body };
  };

  try {
    await t.test('create() calcule le hash SHA-256 réel du fichier reçu', async () => {
      // MIGRATION-CLOUDINARY — req.file.buffer (multer memoryStorage), plus
      // req.file.path : document.controller.js::create hashe désormais le
      // Buffer directement. Force le repli disque local même si
      // CLOUDINARY_* est réellement configuré dans le .env de cette machine.
      const content = `contenu-test-${Date.now()}`;
      const expectedHash = crypto.createHash('sha256').update(content).digest('hex');

      const { status, body } = await withLocalUploadFallback(() => call(docC.create, {
        user: admin, ip: '127.0.0.1',
        body: { nom: 'Justificatif test', type: 'autre' },
        file: { buffer: Buffer.from(content), size: content.length, mimetype: 'application/pdf', originalname: 'justificatif.pdf' },
      }));

      assert.equal(status, 201);
      assert.equal(body.document.hash_integrite, expectedHash, 'le hash stocké doit correspondre au SHA-256 réel du contenu');
      assert.equal(body.document.lifecycle_statut, 'actif', 'statut par défaut');
      assert.equal(body.document.nom, 'Justificatif test');
      assert.match(body.document.fichier_path, /^\/uploads\/documents\/\d+-[0-9a-f]{16}\.pdf$/);
      const createdId = body.document._id;
      cleanup.push(() => Document.findByIdAndDelete(createdId));
      cleanup.push(() => fs.promises.unlink(path.join(__dirname, '..', body.document.fichier_path)).catch(() => {}));
    });

    await t.test('create() refuse un upload sans fichier', async () => {
      const { status } = await call(docC.create, { user: admin, ip: '127.0.0.1', body: {} });
      assert.equal(status, 400);
    });

    await t.test('getAll retourne le document créé, getOne le récupère individuellement', async () => {
      const created = await withLocalUploadFallback(() => call(docC.create, {
        user: admin, ip: '127.0.0.1',
        body: { nom: 'Doc pour liste', type: 'autre' },
        file: { buffer: Buffer.from('contenu-liste'), size: 12, mimetype: 'application/pdf', originalname: 'liste.pdf' },
      }));
      const createdId = created.body.document._id;
      cleanup.push(() => Document.findByIdAndDelete(createdId));
      cleanup.push(() => fs.promises.unlink(path.join(__dirname, '..', created.body.document.fichier_path)).catch(() => {}));

      const list = await call(docC.getAll, { query: {} });
      assert.equal(list.status, 200);
      assert.ok(list.body.documents.some(d => String(d._id) === String(createdId)));

      const one = await call(docC.getOne, { params: { id: createdId } });
      assert.equal(one.status, 200);
      assert.equal(one.body.document.nom, 'Doc pour liste');
    });

    await t.test('un rôle non autorisé reçoit 403 sur POST /documents (authorize)', async () => {
      const stamp = Date.now();
      const nonAdmin = await User.create({
        email: `_t0006-nonadmin-${stamp}@_test.local`, password: 'Xx1aaaaa',
        nom: 'DocT0006', prenom: 'NonAdmin', role: 'receptionniste', statut: 'actif',
      });
      cleanup.push(() => User.findByIdAndDelete(nonAdmin._id));

      let status = 200;
      const res = { status: (c) => { status = c; return res; }, json: () => {} };
      const req = { user: nonAdmin, baseUrl: '/api/documents', originalUrl: '/api/documents', method: 'POST', ip: '127.0.0.1' };
      await authorize('superadmin', 'adminclinique')(req, res, () => { throw new Error('next() ne doit pas être appelé pour un rôle non autorisé'); });
      assert.equal(status, 403);
    });

    await t.test('multer rejette une extension hors liste blanche (.exe)', async () => {
      const boundary = `----t0006boundary${Date.now()}a`;
      const err = await multerReject([
        Buffer.from(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="fichier"; filename="malware.exe"\r\n` +
          `Content-Type: application/octet-stream\r\n\r\n` +
          `contenu\r\n` +
          `--${boundary}--\r\n`
        ),
      ], boundary);
      assert.ok(err, 'une extension hors liste blanche doit être rejetée');
      assert.match(err.message, /non autorisé/);
    });

    await t.test('multer rejette un fichier dépassant la limite de 20 Mo', async () => {
      const boundary = `----t0006boundary${Date.now()}b`;
      const err = await multerReject([
        Buffer.from(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="fichier"; filename="trop-gros.pdf"\r\n` +
          `Content-Type: application/pdf\r\n\r\n`
        ),
        Buffer.alloc(21 * 1024 * 1024, 'x'), // > limite de 20 Mo configurée dans middleware/upload.js
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ], boundary);
      assert.ok(err, 'un fichier de plus de 20 Mo doit être rejeté');
      assert.equal(err.code, 'LIMIT_FILE_SIZE');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
