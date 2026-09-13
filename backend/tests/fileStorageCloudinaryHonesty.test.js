// MIGRATION-CLOUDINARY (13 sept. 2026) — remplace le stockage disque local
// direct (middleware/upload.js::diskStorage) par utils/fileStorage.js, qui
// upload sur Cloudinary quand configuré, et retombe SINON sur l'écriture
// disque locale historique (backend/uploads/) — jamais un succès simulé
// (contrairement à mail.js/Resend, un fichier envoyé doit toujours être
// réellement stocké quelque part, voir commentaire d'utils/cloudinary.js).
// Ce fichier prouve : (a) sans configuration Cloudinary, le fichier atterrit
// réellement sur disque, au bon endroit, avec le bon contenu ; (b) avec
// Cloudinary configuré et un succès réel de l'API, l'URL Cloudinary est
// utilisée, rien n'est écrit sur disque ; (c) une vraie erreur Cloudinary
// est relancée, jamais avalée en faux succès.
//
// Stubbe cloudinary.v2.uploader.upload_stream (propriété mutable du
// singleton exporté par le package 'cloudinary', lue par utils/cloudinary.js
// à chaque appel) — aucune vraie clé API ni aucun réseau réel n'est jamais
// sollicité.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const cloudinaryLib = require('cloudinary').v2;

test('utils/fileStorage.js::storeUploadedFile — Cloudinary si configuré, repli disque local sinon', async (t) => {
  const { storeUploadedFile } = require('../utils/fileStorage');
  const env = require('../config/env');

  const original = {
    name: env.CLOUDINARY_CLOUD_NAME, key: env.CLOUDINARY_API_KEY, secret: env.CLOUDINARY_API_SECRET,
  };
  const originalUploadStream = cloudinaryLib.uploader.upload_stream;
  const stamp = Date.now();
  const writtenFiles = [];

  try {
    await t.test('CLOUDINARY_* absent — écrit réellement sur disque local, jamais un faux succès', async () => {
      env.CLOUDINARY_CLOUD_NAME = ''; env.CLOUDINARY_API_KEY = ''; env.CLOUDINARY_API_SECRET = '';
      const file = { originalname: 'test.jpg', buffer: Buffer.from('contenu-test-' + stamp) };
      const { url, public_id } = await storeUploadedFile(file, { folder: 'patients', filenameBase: `_fstest-${stamp}` });

      assert.equal(url, `/uploads/patients/_fstest-${stamp}.jpg`);
      assert.equal(public_id, null, 'aucun public_id Cloudinary en repli disque local');
      const written = path.join(__dirname, '..', 'uploads', 'patients', `_fstest-${stamp}.jpg`);
      writtenFiles.push(written);
      assert.ok(fs.existsSync(written), 'le fichier doit être réellement présent sur disque');
      assert.equal(fs.readFileSync(written, 'utf8'), 'contenu-test-' + stamp, 'le contenu écrit doit être exactement le buffer reçu');
    });

    await t.test('CLOUDINARY_* configuré + succès réel de l\'API — URL Cloudinary utilisée, rien écrit sur disque', async () => {
      env.CLOUDINARY_CLOUD_NAME = 'demo'; env.CLOUDINARY_API_KEY = '123'; env.CLOUDINARY_API_SECRET = 'secret';
      let capturedOptions = null;
      cloudinaryLib.uploader.upload_stream = (opts, cb) => {
        capturedOptions = opts;
        const chunks = [];
        return {
          end: (buf) => { chunks.push(buf); cb(null, { secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/medisync/patients/stub.jpg', public_id: 'medisync/patients/stub', resource_type: 'image', format: 'jpg', version: 1 }); },
        };
      };

      const file = { originalname: 'test2.jpg', buffer: Buffer.from('contenu-cloudinary-' + stamp) };
      const { url, public_id } = await storeUploadedFile(file, { folder: 'patients', filenameBase: `_fstest-cloud-${stamp}` });

      // SEC-CLOUDINARY-01 — livraison signée (type:authenticated) : l'URL
      // finale n'est jamais le secure_url brut renvoyé par l'API d'upload
      // (jamais signé), mais reconstruite localement via cloudinary.url()
      // avec la signature HMAC (jamais prévisible sans le secret, donc pas
      // de correspondance exacte ici — juste la forme attendue).
      assert.match(url, /^https:\/\/res\.cloudinary\.com\/demo\/image\/authenticated\/s--[\w-]+--\/v1\/medisync\/patients\/stub\.jpg(\?.*)?$/);
      assert.equal(public_id, 'medisync/patients/stub');
      assert.equal(capturedOptions.folder, 'medisync/patients');
      assert.equal(capturedOptions.type, 'authenticated', 'l\'upload doit demander une livraison authenticated, jamais publique par défaut, pour des fichiers sensibles');
      const notWritten = path.join(__dirname, '..', 'uploads', 'patients', `_fstest-cloud-${stamp}.jpg`);
      assert.ok(!fs.existsSync(notWritten), 'rien ne doit être écrit sur disque quand Cloudinary est configuré et réussit');
    });

    await t.test('CLOUDINARY_* configuré + échec réel de l\'API — relancé, jamais avalé en succès silencieux', async () => {
      env.CLOUDINARY_CLOUD_NAME = 'demo'; env.CLOUDINARY_API_KEY = '123'; env.CLOUDINARY_API_SECRET = 'secret';
      cloudinaryLib.uploader.upload_stream = (opts, cb) => ({
        end: () => { cb(new Error('Quota Cloudinary dépassé (simulation)')); },
      });

      const file = { originalname: 'test3.jpg', buffer: Buffer.from('x') };
      await assert.rejects(
        () => storeUploadedFile(file, { folder: 'patients', filenameBase: `_fstest-fail-${stamp}` }),
        /Quota Cloudinary dépassé/,
        'une vraie erreur Cloudinary doit être relancée avec son message réel'
      );
    });
  } finally {
    env.CLOUDINARY_CLOUD_NAME = original.name; env.CLOUDINARY_API_KEY = original.key; env.CLOUDINARY_API_SECRET = original.secret;
    cloudinaryLib.uploader.upload_stream = originalUploadStream;
    for (const f of writtenFiles) { try { fs.unlinkSync(f); } catch { /* déjà absent */ } }
  }
});
