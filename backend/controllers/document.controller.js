const crypto = require('crypto');
const Document = require('../models/Document');
const { logAction, paginate } = require('../utils/helpers');
const { storeUploadedFile } = require('../utils/fileStorage');
const cloudinaryUtil = require('../utils/cloudinary');

// SEC-DOC-01 (audit métier du 13 sept. 2026, Phase 4) — fichier_path stocke
// une URL Cloudinary signée valide indéfiniment (voir models/Document.js).
// Régénère une URL signée à courte durée de vie (5 min) juste avant de
// répondre, pour CE document précis et CETTE lecture autorisée — jamais
// persistée, jamais la même URL resservie à la requête suivante. Un
// document en repli disque local (cloudinary_public_id absent) n'est pas
// concerné : fichier_path reste tel quel, déjà protégé par rôle à la
// livraison (uploads.controller.js::serveUpload).
function withFreshDeliveryUrl(doc) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  if (!plain.cloudinary_public_id) return plain;
  plain.fichier_path = cloudinaryUtil.getSignedDeliveryUrl({
    public_id: plain.cloudinary_public_id,
    resource_type: plain.cloudinary_resource_type,
    format: plain.cloudinary_format,
    version: plain.cloudinary_version,
  });
  return plain;
}

// R-10b / ticket 0006 — périmètre volontairement minimal : upload, hash,
// consultation, statut par défaut 'actif'. Les transitions de cycle de vie
// (archive_chaud, archive_froid, purge_permise) ne sont pas implémentées
// ici — ticket séparé si le besoin se confirme à l'usage.
//
// SEC-B-04 (correction du 12 sept. 2026, audit indépendant) — absence de
// scoping patient au-delà du rôle sur getAll/getOne : analysé, décision
// documentée. Vérifié dans document.routes.js : les 3 routes (GET /, POST
// /, GET /:id) sont déjà exclusivement réservées à ADMIN
// (superadmin/adminclinique, utils/roles.js), jamais accessibles à un rôle
// clinique (médecin/infirmier/etc.) qui pourrait avoir un intérêt légitime
// à contourner un scoping par patient. Un scoping supplémentaire par
// patient irait ici CONTRE le besoin métier réel : un administrateur gère
// le dépôt documentaire à travers TOUS les patients par nature de son rôle
// (conformité, archivage). Aucune restriction supplémentaire ajoutée —
// correction purement théorique dans ce contexte précis, RBAC déjà
// suffisant.

// POST /documents
exports.create = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier reçu.' });

    // Hash d'intégrité calculé à la réception, avant toute autre écriture —
    // c'est précisément ce que R-10b constatait comme jamais fait.
    // MIGRATION-CLOUDINARY — calculé depuis le Buffer en mémoire
    // (req.file.path n'existe plus, multer utilise memoryStorage désormais).
    const hash_integrite = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    const { url, public_id, resource_type, format, version } = await storeUploadedFile(req.file, { folder: 'documents', filenameBase: `${Date.now()}-${hash_integrite.slice(0, 16)}` });

    const doc = await Document.create({
      nom:            req.body.nom || req.file.originalname,
      type:           req.body.type,
      fichier_path:   url,
      // SEC-DOC-01 — undefined en repli disque local (public_id null),
      // laissant fichier_path comme unique source pour ces documents.
      cloudinary_public_id:     public_id || undefined,
      cloudinary_resource_type: resource_type || undefined,
      cloudinary_format:        format || undefined,
      cloudinary_version:       version || undefined,
      taille:         req.file.size,
      mime_type:      req.file.mimetype,
      patient:        req.body.patient || undefined,
      created_by:     req.user._id,
      hash_integrite,
      commentaire:    req.body.commentaire,
      tags:           req.body.tags ? String(req.body.tags).split(',').map(t => t.trim()).filter(Boolean) : undefined,
    });

    await logAction({
      utilisateur: req.user._id, action: 'CREATE', module: 'documents',
      entite_id: doc._id, ip: req.ip,
      message: `Document déposé : ${doc.nom} (${doc.type || 'autre'})`,
    });

    res.status(201).json({ success: true, document: doc });
  } catch (err) { next(err); }
};

// GET /documents
exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, patient, type } = req.query;
    const filter = {};
    if (patient) filter.patient = patient;
    if (type)    filter.type    = type;

    // PERF-001 (audit de performance du 12 sept. 2026) — countDocuments et
    // find indépendants, exécutés en parallèle.
    const [total, documents] = await Promise.all([
      Document.countDocuments(filter),
      paginate(
        Document.find(filter)
          .populate('patient', 'nom prenom numero_dossier')
          .populate('created_by', 'nom prenom')
          .sort('-createdAt'),
        page, limit
      ),
    ]);
    res.json({ success: true, total, documents: documents.map(withFreshDeliveryUrl) });
  } catch (err) { next(err); }
};

// GET /documents/:id
exports.getOne = async (req, res, next) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate('patient', 'nom prenom numero_dossier')
      .populate('created_by', 'nom prenom');
    if (!doc) return res.status(404).json({ success: false, message: 'Document introuvable.' });
    res.json({ success: true, document: withFreshDeliveryUrl(doc) });
  } catch (err) { next(err); }
};
