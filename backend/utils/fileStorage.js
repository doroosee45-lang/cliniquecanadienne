// MIGRATION-CLOUDINARY (13 sept. 2026) — point d'entrée commun aux 6 anciens
// points d'upload disque (middleware/upload.js, désormais en memoryStorage) :
// stocke le Buffer reçu sur Cloudinary si configuré (utils/cloudinary.js),
// sinon retombe sur l'écriture disque locale historique sous backend/uploads/
// (même arborescence, même convention de nom de fichier qu'avant cette
// migration) — jamais un succès simulé, un fichier envoyé par un utilisateur
// doit toujours être réellement stocké quelque part.
const fs = require('fs');
const path = require('path');
const cloudinaryUtil = require('./cloudinary');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

// storeUploadedFile — folder ('patients', 'medications', 'documents',
// 'messages', 'radiology', 'echographie') namespace Cloudinary comme le
// faisait déjà chaque sous-répertoire local ; filenameBase est le nom de
// fichier SANS extension déjà décidé par l'appelant (ex.
// `patient-${id}-${Date.now()}`), reproduisant exactement la convention de
// nommage que chaque storage.filename() de multer construisait avant cette
// migration. L'extension est reprise de file.originalname.
// Renvoie { url, public_id } — public_id est null en repli disque local (le
// concept n'existe pas hors Cloudinary) ; les appelants qui doivent nettoyer
// l'ancien fichier lors d'un remplacement (seul cas existant : photo
// patient) doivent donc vérifier public_id avant d'appeler cloudinaryUtil.destroy.
async function storeUploadedFile(file, { folder, filenameBase }) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (cloudinaryUtil.isConfigured()) {
    const result = await cloudinaryUtil.uploadBuffer(file.buffer, {
      folder: `medisync/${folder}`,
      public_id: filenameBase,
    });
    return { url: result.secure_url, public_id: result.public_id };
  }
  const dir = path.join(UPLOADS_ROOT, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `${filenameBase}${ext}`;
  fs.writeFileSync(path.join(dir, filename), file.buffer);
  return { url: `/uploads/${folder}/${filename}`, public_id: null };
}

module.exports = { storeUploadedFile };
