// MIGRATION-CLOUDINARY (13 sept. 2026) — remplace le stockage disque local
// (backend/uploads/) par Cloudinary pour les photos patients/médicaments et
// les pièces jointes (radiologie, documents, messagerie, échographie).
// Même principe d'honnêteté externe que utils/mail.js (Resend)/utils/sms.js/
// utils/openai.js : isConfigured() expose la présence réelle des 3
// variables requises, jamais une clé partiellement renseignée acceptée à
// moitié ; une vraie erreur Cloudinary n'est jamais avalée (rejet de la
// promesse, propagé normalement à l'appelant).
//
// Contrairement aux autres services optionnels, l'absence de configuration
// ne peut pas produire un {simulated:true} : un fichier envoyé par
// l'utilisateur doit être stocké quelque part pour que la fonctionnalité
// reste utilisable en développement sans compte Cloudinary — chaque
// contrôleur appelant retombe donc sur l'écriture disque locale historique
// (backend/uploads/) quand isConfigured() est faux, jamais un succès fictif
// qui perdrait silencieusement le fichier.
//
// require('cloudinary') gardé comme référence au module (jamais destructuré)
// — un test peut remplacer cloudinarySdk.v2.uploader.upload_stream par un
// stub (cloudinary expose déjà uploader.upload_stream comme une propriété
// mutable du singleton v2, lue ici à chaque appel), même technique que le
// stub historique de nodemailer.createTransport et que resendSdk.Resend
// (utils/mail.js).
const cloudinarySdk = require('cloudinary');
const env = require('../config/env');

const isConfigured = () => !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

const configure = () => {
  cloudinarySdk.v2.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
};

// SEC-CLOUDINARY-01 (13 sept. 2026, retour produit) — livraison publique par
// défaut (type:'upload') rejetée : les fichiers concernés (photos patientes,
// pièces jointes de messagerie médicale, imagerie) sont des données
// sensibles — un lien deviné/partagé ne doit jamais suffire à y accéder,
// contrairement à l'ancien /uploads/* (protégé par rôle, SUBPATH_ROLES).
// type:'authenticated' exige une URL signée (HMAC avec CLOUDINARY_API_SECRET,
// jamais transmis au client) pour être livrée : Cloudinary répond 401 sans
// signature valide, quel que soit qui la demande. sign_url:true sans
// expires_at ne fait PAS expirer la signature dans le temps (elle ne dépend
// que de public_id/type/resource_type/version + api_secret, jamais d'un
// horodatage) — l'URL signée générée une seule fois à l'upload peut donc
// être stockée telle quelle en base, exactement comme l'ancienne secure_url
// publique, sans revalidation à chaque lecture.
const AUTH_TYPE = 'authenticated';

// uploadBuffer — folder namespace les fichiers par module (même
// arborescence logique que backend/uploads/<dir> aujourd'hui) ; public_id
// optionnel (sinon Cloudinary en génère un). resource_type:'auto' laisse
// Cloudinary détecter image/vidéo/brut (pdf, docx, audio...), nécessaire ici
// puisque plusieurs des 6 points d'upload acceptent des types non-image
// (documents, pièces jointes de messagerie).
//
// Le secure_url renvoyé par l'API d'upload elle-même n'est PAS utilisable
// tel quel pour un asset authenticated (jamais signé par Cloudinary côté
// upload) : reconstruit ici via cloudinarySdk.v2.url(), la seule fonction
// qui calcule réellement la signature HMAC avec la clé secrète locale.
const uploadBuffer = (buffer, { folder, public_id, resource_type = 'auto' } = {}) => {
  configure();
  return new Promise((resolve, reject) => {
    const stream = cloudinarySdk.v2.uploader.upload_stream({ folder, public_id, resource_type, type: AUTH_TYPE }, (err, result) => {
      if (err) return reject(err instanceof Error ? err : new Error(err?.message || 'Échec de l\'upload Cloudinary.'));
      const signedUrl = cloudinarySdk.v2.url(result.public_id, {
        type: AUTH_TYPE,
        resource_type: result.resource_type,
        format: result.format,
        version: result.version,
        sign_url: true,
        secure: true,
      });
      resolve({ ...result, secure_url: signedUrl });
    });
    stream.end(buffer);
  });
};

// getSignedDeliveryUrl — SEC-DOC-01 (audit métier du 13 sept. 2026, Phase 4).
// uploadBuffer() ci-dessus produit une URL signée SANS expires_at : valide
// indéfiniment une fois obtenue, jamais révocable. Cette fonction régénère
// une signature à COURTE durée de vie (ttlSeconds, défaut 5 min — largement
// suffisant pour qu'un client suive une redirection ou charge une image
// immédiatement, mais rend l'URL inutilisable si elle fuite/est réutilisée
// plus tard) à partir des seules données d'identification de l'asset
// (public_id/resource_type/format/version — jamais un nouvel appel réseau,
// signature HMAC locale comme dans uploadBuffer). Destinée à être appelée à
// CHAQUE lecture autorisée (jamais persistée en base), contrairement à
// l'URL figée que uploadBuffer() retourne à l'upload.
const getSignedDeliveryUrl = ({ public_id, resource_type, format, version }, ttlSeconds = 300) => {
  configure();
  return cloudinarySdk.v2.url(public_id, {
    type: AUTH_TYPE,
    resource_type,
    format,
    version,
    sign_url: true,
    secure: true,
    expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
};

// destroy — utilisé par le seul point qui nettoyait déjà l'ancien fichier
// lors d'un remplacement (photo patient, patients.controller.js::uploadPhoto)
// ; une erreur ici est volontairement journalisée puis avalée par l'appelant
// (le nouvel upload a déjà réussi, un échec de nettoyage de l'ancien fichier
// ne doit jamais faire échouer la requête pour l'utilisateur). type doit
// correspondre à celui utilisé à l'upload (AUTH_TYPE) — sans quoi Cloudinary
// ne retrouve pas l'asset à supprimer.
const destroy = (public_id, opts = {}) => {
  configure();
  return cloudinarySdk.v2.uploader.destroy(public_id, { type: AUTH_TYPE, ...opts });
};

module.exports = { isConfigured, uploadBuffer, getSignedDeliveryUrl, destroy };
