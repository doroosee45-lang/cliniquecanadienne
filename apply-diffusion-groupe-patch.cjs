const fs = require('fs');

// ═══════════════ PATCH 1 : controller ═══════════════
const ctrlPath = "backend/controllers/settings.controller.js";
const ctrlRaw = fs.readFileSync(ctrlPath, "utf-8");
const ctrlEol = ctrlRaw.includes('\r\n') ? '\r\n' : '\n';
const ctrlLines = ctrlRaw.split(/\r\n|\n/);

const idxGetUsersStart = ctrlLines.findIndex(l => l.includes('exports.getUsers = async'));
if (idxGetUsersStart === -1) {
  console.error("ABORT: début de getUsers introuvable.");
  process.exit(1);
}
let endOfGetUsers = -1;
for (let i = idxGetUsersStart; i < idxGetUsersStart + 20; i++) {
  if (ctrlLines[i].trim() === '};') { endOfGetUsers = i; break; }
}
if (endOfGetUsers === -1) {
  console.error("ABORT: fin de getUsers (ligne '};') introuvable dans les 20 lignes suivantes.");
  process.exit(1);
}
console.log("getUsers: début ligne", idxGetUsersStart + 1, "— fin ligne", endOfGetUsers + 1);

const newCtrlFunction = [
  '',
  "// POST /settings/users/broadcast — 'Envoyer une note de service générale'",
  '// (Administration.jsx, panneau Communication interne) affichait un',
  "// bouton désactivé : 'aucune route backend de diffusion en masse",
  "// n'existe (createNotification est un utilitaire interne, non exposé en",
  "// API)'. createNotification (utils/helpers.js) est déjà réel et déjà",
  '// utilisé en masse ailleurs (audit.controller.js::notifySuspect,',
  '// Promise.all sur plusieurs admins) — même pattern repris ici, élargi à',
  '// tout le personnel actif (STAFF, jamais les patients).',
  'exports.broadcastNote = async (req, res, next) => {',
  '  try {',
  '    const { titre, message } = req.body;',
  "    if (!message || !message.trim()) return res.status(400).json({ success: false, message: 'Message requis.' });",
  '    const destinataires = await User.find({ role: { $in: STAFF }, statut: \'actif\' }).select(\'_id\');',
  '    await Promise.all(destinataires.map(u => createNotification({',
  "      destinataire: u._id, type: 'info', priorite: 'normale',",
  "      titre: titre?.trim() || 'Note de service',",
  '      message: message.trim(),',
  "      lien: '/administration',",
  '    })));',
  '    await logAction({ utilisateur: req.user._id, action: \'BROADCAST\', module: \'settings\', ip: req.ip, message: `Note de service diffusée à ${destinataires.length} membres du personnel : ${message.trim().slice(0, 120)}` });',
  '    res.json({ success: true, notifies: destinataires.length });',
  '  } catch (err) { next(err); }',
  '};'
];
ctrlLines.splice(endOfGetUsers + 1, 0, ...newCtrlFunction);

const hasStaffImport = ctrlLines.some(l => l.includes("require('../utils/roles')"));
if (!hasStaffImport) {
  const idxHelpers = ctrlLines.findIndex(l => l.includes("createNotification") && l.includes("require('../utils/helpers')"));
  if (idxHelpers === -1) {
    console.error("ABORT: ligne d'import createNotification introuvable.");
    process.exit(1);
  }
  ctrlLines.splice(idxHelpers + 1, 0, "const { STAFF } = require('../utils/roles');");
  console.log("Import STAFF ajouté après la ligne", idxHelpers + 1);
}

fs.writeFileSync(ctrlPath, ctrlLines.join(ctrlEol), "utf-8");
console.log("OK: controller patché.");

// ═══════════════ PATCH 2 : route ═══════════════
const routePath = "backend/routes/settings.routes.js";
const routeRaw = fs.readFileSync(routePath, "utf-8");
const routeEol = routeRaw.includes('\r\n') ? '\r\n' : '\n';
const routeLines = routeRaw.split(/\r\n|\n/);

const idxForceLogout = routeLines.findIndex(l => l.includes("router.post('/users/:id/force-logout'"));
if (idxForceLogout === -1) {
  console.error("ABORT: ligne force-logout introuvable dans les routes.");
  process.exit(1);
}
routeLines.splice(idxForceLogout + 1, 0,
  "router.post('/users/broadcast', protect, authorize(...ADMIN), settingsC.broadcastNote);"
);

fs.writeFileSync(routePath, routeLines.join(routeEol), "utf-8");
console.log("OK: route ajoutée.");
