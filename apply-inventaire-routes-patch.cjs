const fs = require('fs');
const path = "backend/routes/settings.routes.js";
const raw = fs.readFileSync(path, "utf-8");
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r\n|\n/);

const idxRoomsSection = lines.findIndex(l => l.includes("router.put('/rooms/:id'"));
if (idxRoomsSection === -1) { console.error("ABORT: ligne rooms/:id introuvable."); process.exit(1); }

const newRoutes = [
  '',
  '// ── Inventaire / Équipements (Cas #1, audit métier) ────────────',
  "router.get('/inventory',                protect, authorize(...ADMIN), settingsC.getEquipments);",
  "router.post('/inventory',               protect, authorize(...ADMIN), settingsC.createEquipment);",
  "router.put('/inventory/:id',            protect, authorize(...ADMIN), settingsC.updateEquipment);",
  "router.post('/inventory/:id/mouvement', protect, authorize(...ADMIN), settingsC.createMouvement);",
  "router.get('/inventory/:id/mouvements', protect, authorize(...ADMIN), settingsC.getMouvementsInventaire);"
];
lines.splice(idxRoomsSection + 1, 0, ...newRoutes);

fs.writeFileSync(path, lines.join(eol), "utf-8");
console.log("OK: routes inventaire ajoutées.");
