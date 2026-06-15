const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/radiology');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '_').slice(0, 40);
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.dcm', '.jpg', '.jpeg', '.png', '.pdf', '.tiff', '.bmp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) return cb(null, true);
  cb(new Error(`Type de fichier non autorisé : ${ext}`), false);
};

const uploadImages = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024, files: 20 },
});

// ── Photo patient ─────────────────────────────────────────────────────────────
const storagePhoto = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/patients');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `patient-${req.params.id}-${Date.now()}${ext}`);
  },
});

const fileFilterPhoto = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  if (allowed.includes(path.extname(file.originalname).toLowerCase())) return cb(null, true);
  cb(new Error('Format non autorisé : jpg, jpeg, png ou webp uniquement.'), false);
};

const uploadPatientPhoto = multer({
  storage: storagePhoto,
  fileFilter: fileFilterPhoto,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

// ── Photo médicament ──────────────────────────────────────────────────────────
const storageMedPhoto = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/medications');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `med-${req.params.id}-${Date.now()}${ext}`);
  },
});

const uploadMedPhoto = multer({
  storage: storageMedPhoto,
  fileFilter: fileFilterPhoto,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

module.exports = { uploadImages, uploadPatientPhoto, uploadMedPhoto };
