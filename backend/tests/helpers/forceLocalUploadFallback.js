// MIGRATION-CLOUDINARY (13 sept. 2026) — plusieurs tests invoquent
// directement un contrôleur consommant middleware/upload.js
// (uploadPhoto/uploadImages/sendAttachment/document create) avec un faux
// req.file/req.files, sans jamais passer par le vrai middleware Express. Ces
// tests ne doivent jamais dépendre d'un vrai compte Cloudinary externe ni de
// son état de configuration sur la machine qui les exécute (ce dépôt a
// réellement CLOUDINARY_* configuré dans backend/.env pour l'usage réel de
// l'application) — ce helper force le repli disque local
// (utils/fileStorage.js) le temps de l'appel, quelle que soit la
// configuration réelle, puis la restaure toujours (même en cas d'erreur).
const env = require('../../config/env');

async function withLocalUploadFallback(fn) {
  const saved = { name: env.CLOUDINARY_CLOUD_NAME, key: env.CLOUDINARY_API_KEY, secret: env.CLOUDINARY_API_SECRET };
  env.CLOUDINARY_CLOUD_NAME = ''; env.CLOUDINARY_API_KEY = ''; env.CLOUDINARY_API_SECRET = '';
  try {
    return await fn();
  } finally {
    env.CLOUDINARY_CLOUD_NAME = saved.name; env.CLOUDINARY_API_KEY = saved.key; env.CLOUDINARY_API_SECRET = saved.secret;
  }
}

module.exports = { withLocalUploadFallback };
