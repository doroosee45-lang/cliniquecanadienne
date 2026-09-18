const fs = require('fs');
const path = "frontend/src/pages/Appointments.jsx";
const raw = fs.readFileSync(path, "utf-8");
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r\n|\n/);

// Trouver notre bloc déjà inséré (celui avec exportRapportMensuel dans le tableau JSX)
const idxOurBlockStart = lines.findIndex(l => l.includes('"📊","Rapport mensuel des RDV","Excel / PDF", exportRapportMensuel'));
if (idxOurBlockStart === -1) { console.error("ABORT: notre bloc introuvable."); process.exit(1); }

// La ligne juste avant doit être notre "{[" injecté
if (lines[idxOurBlockStart - 1].trim() !== '{[') {
  console.error("ABORT: ligne précédente n'est pas '{[' comme attendu.");
  console.error(JSON.stringify(lines[idxOurBlockStart - 1]));
  process.exit(1);
}
// Et la ligne encore avant doit être le "{[" ORIGINAL, en double
if (lines[idxOurBlockStart - 2].trim() !== '{[') {
  console.error("ABORT: pas de doublon '{[' trouvé — la structure est différente de ce qui était attendu.");
  console.error(JSON.stringify(lines[idxOurBlockStart - 2]));
  process.exit(1);
}

// Supprimer la ligne dupliquée (celle en position idxOurBlockStart - 1, notre "{[" injecté en trop)
lines.splice(idxOurBlockStart - 1, 1);

fs.writeFileSync(path, lines.join(eol), "utf-8");
console.log("OK: doublon '{[' supprimé.");
