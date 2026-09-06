// Sous-phase 5.5.b — Rôles & Permissions éditables.
//
// Avant ce chantier, Administration.jsx (section "roles") et Settings.jsx
// (ROLES_PERMS) affichaient chacun une matrice de permissions codée en dur
// dans le frontend, jamais lue par le moindre contrôleur backend : aucune
// route n'appliquait réellement ces permissions, et les deux constantes
// avaient déjà divergé l'une de l'autre (ex. "Comptable" pouvait
// créer/modifier selon Administration.jsx, mais pas selon Settings.jsx).
//
// Source de vérité unique désormais : Setting{ cle:'roles_permissions' }.
// PROFESSIONAL_ROLES est dérivé de l'enum réel de User.role (jamais
// redupliqué en dur une 3e fois) — patient exclu : ce module gère les
// permissions du personnel, pas l'accès patient (régi séparément).
const User = require('../models/User');
const { logAction } = require('./helpers');

const PROFESSIONAL_ROLES = User.schema.path('role').enumValues.filter(r => r !== 'patient');

// 7 actions = union des deux anciennes taxonomies (Administration.jsx :
// lecture/creation/modification/suppression/validation/exportation ;
// Settings.jsx : read/add/edit/del/print/export). "impression" reprend le
// concept "print" de Settings.jsx, absent d'Administration.jsx — aucune des
// deux ne perd de colonne dans la fusion.
const PERMISSION_ACTIONS = ['lecture', 'creation', 'modification', 'suppression', 'validation', 'impression', 'exportation'];

// Valeurs par défaut — reconstruites en fusionnant les deux anciennes
// constantes codées en dur (voir commit) : quand les deux sources
// divergeaient sur une cellule (ex. Comptable/modification, Laborantin/
// modification), la valeur la plus permissive des deux est retenue,
// puisqu'aucune des deux n'a jamais été appliquée par le backend jusqu'ici
// — aucun accès réel n'a donc jamais dépendu du côté restrictif. Pour
// sage_femme/radiologue (absents de l'ancienne matrice Settings.jsx),
// "impression" est déduit par analogie avec les rôles cliniques comparables
// (infirmier/médecin), documenté ici plutôt que deviné silencieusement.
const DEFAULT_ROLES_PERMISSIONS = {
  superadmin:     { lecture:true,  creation:true,  modification:true,  suppression:true,  validation:true,  impression:true,  exportation:true  },
  adminclinique:  { lecture:true,  creation:true,  modification:true,  suppression:false, validation:true,  impression:true,  exportation:true  },
  medecin:        { lecture:true,  creation:true,  modification:true,  suppression:false, validation:false, impression:true,  exportation:false },
  infirmier:      { lecture:true,  creation:true,  modification:false, suppression:false, validation:false, impression:true,  exportation:false },
  sage_femme:     { lecture:true,  creation:true,  modification:false, suppression:false, validation:false, impression:true,  exportation:false },
  radiologue:     { lecture:true,  creation:true,  modification:true,  suppression:false, validation:false, impression:true,  exportation:false },
  pharmacien:     { lecture:true,  creation:true,  modification:true,  suppression:false, validation:false, impression:true,  exportation:false },
  laborantin:     { lecture:true,  creation:true,  modification:true,  suppression:false, validation:false, impression:true,  exportation:false },
  comptable:      { lecture:true,  creation:true,  modification:true,  suppression:false, validation:true,  impression:true,  exportation:true  },
  receptionniste: { lecture:true,  creation:true,  modification:false, suppression:false, validation:false, impression:false, exportation:false },
};

const SETTING_KEY = 'roles_permissions';

// Garde-fou anti-verrouillage : superadmin doit toujours conserver les 7
// permissions, sans exception — sinon un superadmin pourrait, par erreur ou
// via un compte compromis, se retirer à lui-même (et à tout autre
// superadmin) l'accès à cette page, rendant la matrice définitivement
// impossible à corriger depuis l'interface.
function enforceSuperadminSafeguard(matrix) {
  const superadminPerms = matrix.superadmin || {};
  const missing = PERMISSION_ACTIONS.filter(a => superadminPerms[a] !== true);
  if (missing.length) {
    return `Le rôle "superadmin" doit impérativement conserver toutes les permissions (manquant : ${missing.join(', ')}) — refusé pour éviter un verrouillage total du système.`;
  }
  return null;
}

async function getRolesPermissionsMatrix() {
  const Setting = require('../models/Setting');
  const doc = await Setting.findOne({ cle: SETTING_KEY }).lean();
  return doc?.valeur || DEFAULT_ROLES_PERMISSIONS;
}

// Middleware réel appliqué à une route protégée : authorize(...ADMIN)
// vérifiait un rôle contre une liste statique ; celui-ci vérifie une action
// contre la matrice réellement stockée (modifiable depuis l'interface).
// superadmin passe toujours, y compris si la matrice est absente/corrompue
// — jamais de verrouillage total possible depuis ce chemin non plus.
exports.authorizePermission = (action) => async (req, res, next) => {
  if (req.user.role === 'superadmin') return next();
  const matrix = await getRolesPermissionsMatrix();
  if (matrix[req.user.role]?.[action] === true) return next();

  const module = (req.baseUrl || req.originalUrl || '').replace(/^\/api\/?/, '').split('/')[0] || 'inconnu';
  await logAction({
    utilisateur: req.user._id,
    action: 'ACCESS_DENIED',
    module,
    ip: req.ip,
    message: `Accès refusé — rôle "${req.user.role}" sans la permission "${action}" sur ${req.method} ${req.originalUrl}`,
    statut: 'echec',
  });
  return res.status(403).json({
    success: false,
    message: `Le rôle "${req.user.role}" n'a pas la permission "${action}" requise pour cette action.`,
  });
};

module.exports.PROFESSIONAL_ROLES = PROFESSIONAL_ROLES;
module.exports.PERMISSION_ACTIONS = PERMISSION_ACTIONS;
module.exports.DEFAULT_ROLES_PERMISSIONS = DEFAULT_ROLES_PERMISSIONS;
module.exports.SETTING_KEY = SETTING_KEY;
module.exports.enforceSuperadminSafeguard = enforceSuperadminSafeguard;
module.exports.getRolesPermissionsMatrix = getRolesPermissionsMatrix;
