const multer = require('multer');
const path   = require('path');

// AUDIT-3.5 (SEC-02) — req.params.id était injecté tel quel dans le nom de
// fichier ; un ID contenant des séquences "../" pouvait donc écrire hors du
// répertoire d'upload prévu. Seuls les ObjectId Mongo valides sont attendus
// ici (routes /:id/photo) — exporté (MIGRATION-CLOUDINARY) car la
// construction du nom de fichier a été déplacée dans le contrôleur (multer
// n'a plus de callback filename() en memoryStorage, voir plus bas), mais la
// validation elle-même doit rester appliquée avant toute construction de
// chemin, que le fichier parte ensuite vers Cloudinary ou vers le repli
// disque local (utils/fileStorage.js).
const isObjectId = (v) => /^[a-f\d]{24}$/i.test(v);

// MIGRATION-CLOUDINARY (13 sept. 2026) — remplace les 6 configurations
// multer.diskStorage (écriture directe sous backend/uploads/) par une
// storage engine commune en mémoire : chaque fichier n'est plus jamais
// écrit sur disque par multer lui-même, il est simplement mis à disposition
// en Buffer (req.file.buffer / req.files[].buffer) pour que le contrôleur
// le transmette à utils/fileStorage.js::storeUploadedFile (Cloudinary si
// configuré, sinon repli sur l'écriture disque locale historique — jamais
// un succès simulé, un fichier envoyé doit toujours être réellement stocké
// quelque part). fileFilter et limits, qui appliquent la validation
// métier (extensions autorisées, taille/nombre max), restent strictement
// identiques à avant — seule la destination change.
const memoryStorage = multer.memoryStorage();

// SEC-002 — statusCode posé explicitement sur chaque erreur de fileFilter
// ci-dessous : errorHandler.js respecte déjà err.statusCode dans sa branche
// générique (même convention que utils/patientAnonymization.js, Patient.js),
// mais une Error() nue n'en porte aucun et retombait donc sur le 500 par
// défaut de cette branche — un fichier rejeté (extension interdite) devenait
// ainsi indiscernable d'une vraie panne serveur pour le client.
const fileFilter = (req, file, cb) => {
  const allowed = ['.dcm', '.jpg', '.jpeg', '.png', '.pdf', '.tiff', '.bmp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) return cb(null, true);
  const err = new Error(`Type de fichier non autorisé : ${ext}`);
  err.statusCode = 400;
  err.code = 'UPLOAD_FILE_REJECTED';
  cb(err, false);
};

const uploadImages = multer({
  storage: memoryStorage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024, files: 20 },
});

// ── Photo patient ─────────────────────────────────────────────────────────────
const fileFilterPhoto = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  if (allowed.includes(path.extname(file.originalname).toLowerCase())) return cb(null, true);
  const err = new Error('Format non autorisé : jpg, jpeg, png ou webp uniquement.');
  err.statusCode = 400;
  err.code = 'UPLOAD_FILE_REJECTED';
  cb(err, false);
};

const uploadPatientPhoto = multer({
  storage: memoryStorage,
  fileFilter: fileFilterPhoto,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

// ── Photo médicament ──────────────────────────────────────────────────────────
const uploadMedPhoto = multer({
  storage: memoryStorage,
  fileFilter: fileFilterPhoto,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

// ── Document générique (pièces justificatives, contrats, rapports scannés) ────
const fileFilterDocument = (req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) return cb(null, true);
  const err = new Error(`Type de fichier non autorisé : ${ext}`);
  err.statusCode = 400;
  err.code = 'UPLOAD_FILE_REJECTED';
  cb(err, false);
};

const uploadDocument = multer({
  storage: memoryStorage,
  fileFilter: fileFilterDocument,
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});

// ── Pièce jointe messagerie (vocal, image, document) — AUDIT-MESSAGES-PhaseB ──
const fileFilterMessageAttachment = (req, file, cb) => {
  const allowed = [
    '.webm', '.mp3', '.wav', '.ogg', '.m4a',       // audio (messages vocaux)
    '.jpg', '.jpeg', '.png', '.webp', '.gif',      // images
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',      // documents
  ];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) return cb(null, true);
  const err = new Error(`Type de fichier non autorisé : ${ext}`);
  err.statusCode = 400;
  err.code = 'UPLOAD_FILE_REJECTED';
  cb(err, false);
};

const uploadMessageAttachment = multer({
  storage: memoryStorage,
  fileFilter: fileFilterMessageAttachment,
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});

// AUDIT-ECHOGRAPHIE-IMAGES — même pattern que uploadImages (radiology) ci-dessus.
const uploadEchographieImages = multer({
  storage: memoryStorage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024, files: 20 },
});

module.exports = { uploadImages, uploadPatientPhoto, uploadMedPhoto, uploadDocument, uploadMessageAttachment, uploadEchographieImages, isObjectId };
