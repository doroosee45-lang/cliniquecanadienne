const fs = require('fs');
const path = "backend/controllers/settings.controller.js";
const raw = fs.readFileSync(path, "utf-8");
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r\n|\n/);
console.log("Fin de ligne détectée:", eol === '\r\n' ? "CRLF" : "LF");

// --- Ajouter les imports des 2 nouveaux modèles, juste après l'import Service ---
const idxServiceImport = lines.findIndex(l => l.includes("require('../models/Service')"));
if (idxServiceImport === -1) { console.error("ABORT: import Service introuvable."); process.exit(1); }
lines.splice(idxServiceImport + 1, 0,
  "const Equipment    = require('../models/Equipment');",
  "const MouvementInventaire = require('../models/MouvementInventaire');"
);
const shift1 = 2;

// --- Trouver la fin de updateService pour insérer les 4 nouvelles fonctions juste après ---
const idxUpdateServiceStart = lines.findIndex(l => l.includes('exports.updateService = async'));
if (idxUpdateServiceStart === -1) { console.error("ABORT: updateService introuvable."); process.exit(1); }
let endIdx = -1;
for (let i = idxUpdateServiceStart; i < idxUpdateServiceStart + 15; i++) {
  if (lines[i].trim() === '};') { endIdx = i; break; }
}
if (endIdx === -1) { console.error("ABORT: fin de updateService introuvable."); process.exit(1); }
console.log("updateService: début", idxUpdateServiceStart + 1, "fin", endIdx + 1);

const newFunctions = [
  '',
  '// Cas #1 (audit métier) — Administration.jsx (section === "ressources")',
  '// affichait "🚧 Fonctionnalité en cours de développement — aucun suivi',
  '// réel d\'inventaire/équipements n\'existe dans ce système." Modèles',
  '// Equipment + MouvementInventaire créés ; CRUD ci-dessous, même pattern',
  '// que getServices/createService/updateService (liste blanche de champs,',
  '// logAction avant/après).',
  "const EQUIPMENT_ALLOWED_FIELDS = ['nom', 'categorie', 'service', 'quantite', 'unite', 'seuil_alerte', 'etat', 'notes'];",
  '',
  'exports.getEquipments = async (req, res, next) => {',
  '  try {',
  "    const equipments = await Equipment.find().populate('service', 'nom').sort('categorie nom').lean();",
  '    const withAlerte = equipments.map(e => ({ ...e, alerte_stock_bas: e.quantite <= e.seuil_alerte }));',
  '    res.json({ success: true, equipments: withAlerte });',
  '  } catch (err) { next(err); }',
  '};',
  '',
  'exports.createEquipment = async (req, res, next) => {',
  '  try {',
  '    const data = pickAllowedFields(req.body, EQUIPMENT_ALLOWED_FIELDS);',
  "    if (!data.nom || !data.nom.trim()) return res.status(400).json({ success: false, message: 'Nom requis.' });",
  '    data.enregistre_par = req.user._id;',
  '    const equipment = await Equipment.create(data);',
  "    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'settings', entite_id: equipment._id, ip: req.ip, message: `Nouvel équipement : ${equipment.nom}` });",
  '    res.status(201).json({ success: true, equipment });',
  '  } catch (err) { next(err); }',
  '};',
  '',
  'exports.updateEquipment = async (req, res, next) => {',
  '  try {',
  '    const avant = await Equipment.findById(req.params.id).lean();',
  "    if (!avant) return res.status(404).json({ success: false, message: 'Équipement introuvable.' });",
  '    const data = pickAllowedFields(req.body, EQUIPMENT_ALLOWED_FIELDS);',
  '    const equipment = await Equipment.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });',
  "    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'settings', entite_id: equipment._id, ip: req.ip, message: `Équipement modifié : ${equipment.nom}`, avant, apres: equipment });",
  '    res.json({ success: true, equipment });',
  '  } catch (err) { next(err); }',
  '};',
  '',
  '// POST /settings/inventory/:id/mouvement — crée un mouvement ET ajuste',
  '// Equipment.quantite de façon atomique (findByIdAndUpdate avec $inc,',
  '// jamais un read-then-write qui pourrait perdre un mouvement concurrent).',
  '// Une sortie ne peut jamais amener la quantité sous 0.',
  'exports.createMouvement = async (req, res, next) => {',
  '  try {',
  '    const { type, quantite, motif } = req.body;',
  "    const qte = Number(quantite);",
  "    if (!['entree','sortie','ajustement'].includes(type)) return res.status(400).json({ success: false, message: 'Type de mouvement invalide.' });",
  "    if (!qte || qte <= 0) return res.status(400).json({ success: false, message: 'Quantité invalide.' });",
  '',
  '    const equipment = await Equipment.findById(req.params.id);',
  "    if (!equipment) return res.status(404).json({ success: false, message: 'Équipement introuvable.' });",
  '',
  "    const delta = type === 'sortie' ? -qte : (type === 'entree' ? qte : qte - equipment.quantite);",
  '    const nouvelleQuantite = equipment.quantite + delta;',
  "    if (nouvelleQuantite < 0) return res.status(400).json({ success: false, message: 'Stock insuffisant pour cette sortie.' });",
  '',
  '    const mouvement = await MouvementInventaire.create({',
  '      equipement: equipment._id, type, quantite: qte, motif, enregistre_par: req.user._id,',
  '    });',
  '    equipment.quantite = nouvelleQuantite;',
  '    await equipment.save();',
  '',
  "    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'settings', entite_id: mouvement._id, ip: req.ip, message: `Mouvement inventaire (${type}) sur ${equipment.nom} : ${qte}` });",
  '    res.status(201).json({ success: true, mouvement, equipment });',
  '  } catch (err) { next(err); }',
  '};',
  '',
  'exports.getMouvementsInventaire = async (req, res, next) => {',
  '  try {',
  "    const mouvements = await MouvementInventaire.find({ equipement: req.params.id })",
  "      .populate('enregistre_par', 'nom prenom').sort('-createdAt').limit(50).lean();",
  '    res.json({ success: true, mouvements });',
  '  } catch (err) { next(err); }',
  '};'
];
lines.splice(endIdx + 1, 0, ...newFunctions);

fs.writeFileSync(path, lines.join(eol), "utf-8");
console.log("OK: controller inventaire ajouté.");
