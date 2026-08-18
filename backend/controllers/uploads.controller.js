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
};

const uploadsRoot = path.resolve(path.join(__dirname, '..', 'uploads'));

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
