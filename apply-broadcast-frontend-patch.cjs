const fs = require('fs');
const path = "frontend/src/pages/Administration.jsx";
const raw = fs.readFileSync(path, "utf-8");
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r\n|\n/);
console.log("Fin de ligne détectée:", eol === '\r\n' ? "CRLF" : "LF");

// --- Edit A : ajouter le state broadcasting ---
const idxSaving = lines.findIndex(l => l.trim() === "const [saving, setSaving]     = useState(false);");
if (idxSaving === -1) {
  console.error("ABORT: ligne 'saving' introuvable.");
  process.exit(1);
}
lines.splice(idxSaving + 1, 0, '  const [broadcasting, setBroadcasting] = useState(false);');
const shiftA = 1;

// --- Edit B : remplacer le bouton désactivé (indices d'origine décalés de shiftA) ---
const idxButtonLine1 = 1724 + shiftA; // ligne 1725 d'origine
const idxButtonLine2 = 1725 + shiftA; // ligne 1726 d'origine

if (!lines[idxButtonLine1].includes('aucune route backend de diffusion en masse')) {
  console.error("ABORT: la ligne du bouton ne correspond plus après décalage.");
  console.error("Contenu:", JSON.stringify(lines[idxButtonLine1]));
  process.exit(1);
}
if (!lines[idxButtonLine2].includes('Envoyer une note de service générale')) {
  console.error("ABORT: la deuxième ligne du bouton ne correspond plus après décalage.");
  console.error("Contenu:", JSON.stringify(lines[idxButtonLine2]));
  process.exit(1);
}

const newButtonLines = [
  '                    <button className="cbtn cbtn-teal" disabled={broadcasting} style={{ marginTop:14, width:"100%" }} onClick={async () => {',
  '                      const message = window.prompt("Message de la note de service (envoyée à tout le personnel actif) :");',
  '                      if (!message || !message.trim()) return;',
  '                      setBroadcasting(true);',
  '                      try {',
  '                        const { data } = await api.post("/settings/users/broadcast", { message: message.trim() });',
  '                        toast.success(`Note de service envoyée à ${data.notifies} membre${data.notifies > 1 ? "s" : ""} du personnel.`);',
  '                      } catch (err) {',
  '                        toast.error(err?.response?.data?.message || "Échec de l\'envoi de la note de service.");',
  '                      } finally {',
  '                        setBroadcasting(false);',
  '                      }',
  '                    }}>',
  '                      {I.msg} {broadcasting ? "Envoi..." : "Envoyer une note de service générale"}'
];

lines.splice(idxButtonLine1, 2, ...newButtonLines);

fs.writeFileSync(path, lines.join(eol), "utf-8");
console.log("OK: patch frontend appliqué.");
