const path = require('path');
const fs   = require('fs');

// AUDIT-S-1 — /uploads était servi par express.static, protégé uniquement
// par un `protect` global (authentification) : n'importe quel compte
// authentifié, quel que soit son rôle, pouvait récupérer n'importe quel
// fichier (photo patient, image radiologique, document administratif...)
// en devinant/énumérant un nom de fichier. Remplacé par un contrôleur
// dédié qui réapplique un contrôle de rôle par sous-répertoire, sur le
// même modèle que les listes CAN_READ déjà utilisées par les routes qui
// produisent ces fichiers (patients.routes.js, pharmacy.routes.js,
// radiology.routes.js, document.routes.js) — mêmes rôles, pas une
// nouvelle matrice inventée pour l'occasion.
const SUBPATH_ROLES = {
  // patients.routes.js::CAN_READ — lecture du dossier patient (jamais le
  // rôle patient lui-même, qui passe par /portal, scopé à son propre dossier).
  patients: ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'sage_femme',
             'receptionniste', 'laborantin', 'radiologue', 'pharmacien', 'comptable'],
  // pharmacy.routes.js::CAN_READ
  medications: ['superadmin', 'adminclinique', 'pharmacien', 'medecin', 'infirmier'],
  // radiology.routes.js::CAN_READ
  radiology: ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'radiologue'],
  // document.routes.js — module entier réservé à l'administration (ADMIN)
  documents: ['superadmin', 'adminclinique'],
  // AUDIT-MESSAGES-PhaseB — messages.routes.js n'a aucune restriction de
  // rôle (protect seul, comme getDirectory ajoutée en Phase A) : mêmes
  // rôles non-patient, cohérent avec qui peut réellement envoyer/recevoir
  // des pièces jointes de messagerie.
  messages: ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'sage_femme',
             'radiologue', 'pharmacien', 'laborantin', 'comptable', 'receptionniste'],
  // AUDIT-M-D8 (Groupe D, Point 8) — absente ici alors que
  // echographieController.js::uploadImages stocke bel et bien les fichiers
  // dans uploads/echographie/ : toute lecture (SUBPATH_ROLES['echographie']
  // undefined) échouait en 404 avant même la vérification de rôle. Copie
  // exacte de CAN (echographie.routes.js) — mêmes rôles que ceux qui créent/
  // consultent une demande d'échographie, aucun rôle ajouté.
  echographie: ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'radiologue', 'sage_femme'],
};

const uploadsRoot = path.resolve(path.join(__dirname, '..', 'uploads'));
// PORTAL-DOC-001 — exporté (additif, aucun comportement existant modifié)
// pour que portal.controller.js::downloadDocument réutilise exactement la
// même racine de résolution que ce contrôleur, plutôt que de recalculer un
// second chemin potentiellement divergent. Le contrôle d'accès du portail
// reste volontairement DIFFÉRENT de SUBPATH_ROLES ci-dessus (qui exclut
// délibérément 'patient' — cf. commentaire de la clé `patients`) :
// downloadDocument vérifie une appartenance réelle (Document.patient ===
// dossier du patient connecté), jamais un simple rôle.
exports.uploadsRoot = uploadsRoot;

exports.serveUpload = (req, res) => {
  const requested = req.params[0] || '';
  const subpath = requested.split('/')[0];
  const allowedRoles = SUBPATH_ROLES[subpath];
  if (!allowedRoles) return res.status(404).json({ success: false, message: 'Ressource introuvable.' });
  if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Accès refusé.' });

  // Garde anti-traversée de chemin : requested vient directement de l'URL
  // (paramètre wildcard), un "../../../.env" doit être rejeté avant tout
  // accès disque, pas seulement filtré par convention de nommage.
  const resolved = path.resolve(path.join(uploadsRoot, requested));
  if (!resolved.startsWith(uploadsRoot + path.sep) && resolved !== uploadsRoot) {
    return res.status(400).json({ success: false, message: 'Chemin invalide.' });
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return res.status(404).json({ success: false, message: 'Fichier introuvable.' });
  }
  res.sendFile(resolved);
};
