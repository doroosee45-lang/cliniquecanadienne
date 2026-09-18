const fs = require('fs');
const path = "frontend/src/pages/Appointments.jsx";
const raw = fs.readFileSync(path, "utf-8");
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r\n|\n/);

const idxOurBlockStart = lines.findIndex(l => l.includes('"📊","Rapport mensuel des RDV","Excel / PDF", exportRapportMensuel'));
if (idxOurBlockStart === -1) { console.error("ABORT: notre bloc introuvable."); process.exit(1); }

if (lines[idxOurBlockStart - 1].trim() !== '{[') {
  console.error("ABORT: ligne précédente n'est pas '{[' comme attendu.");
  console.error(JSON.stringify(lines[idxOurBlockStart - 1]));
  process.exit(1);
}
if (lines[idxOurBlockStart - 2].trim() !== '{[') {
  console.error("ABORT: pas de doublon '{[' trouvé.");
  console.error(JSON.stringify(lines[idxOurBlockStart - 2]));
  process.exit(1);
}

lines.splice(idxOurBlockStart - 1, 1);

fs.writeFileSync(path, lines.join(eol), "utf-8");
console.log("OK: doublon '{[' supprimé.");
