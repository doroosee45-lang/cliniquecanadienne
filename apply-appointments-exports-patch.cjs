const fs = require('fs');
const path = "frontend/src/pages/Appointments.jsx";
const raw = fs.readFileSync(path, "utf-8");
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r\n|\n/);
console.log("Fin de ligne détectée:", eol === '\r\n' ? "CRLF" : "LF");

// --- Vérification et point d'insertion : fin de updateStatut ---
const idxUpdateStatutEnd = lines.findIndex(l => l.trim() === '};' && lines[l ? 0 : 0]); // placeholder, real search below
let endIdx = -1;
const idxStart = lines.findIndex(l => l.includes('const updateStatut = async (id, statut) => {'));
if (idxStart === -1) { console.error("ABORT: début de updateStatut introuvable."); process.exit(1); }
for (let i = idxStart; i < idxStart + 15; i++) {
  if (lines[i].trim() === '};') { endIdx = i; break; }
}
if (endIdx === -1) { console.error("ABORT: fin de updateStatut introuvable."); process.exit(1); }
console.log("updateStatut: début", idxStart+1, "fin", endIdx+1);

const newFunctions = [
  '',
  '  // Sous-phase 5.2 — les 5 rapports du panneau "Exports disponibles"',
  "  // n'avaient aucun onClick : aucun moteur d'export n'existait dans ce",
  '  // fichier. rdvs (déjà chargé en state) contient tout le nécessaire',
  '  // (service, statut, medecin_id, date) pour calculer ces 5 rapports',
  '  // localement, sans nouvelle route backend. Même pattern jsPDF/autoTable',
  '  // que Archive.jsx/Analytics.jsx ; xlsx (SheetJS) déjà en dépendance du',
  '  // projet mais jamais utilisé dans une page avant ce correctif.',
  '  const exportRapportMensuel = async () => {',
  '    const [{ default: XLSX }] = await Promise.all([import("xlsx")]);',
  '    const rows = rdvs.map(r => ({',
  '      Reference: r.reference, Patient: r.patient_nom, Medecin: r.medecin_nom,',
  '      Service: r.service, Date: fmtDate(r.date), Heure: fmtTime(r.date), Statut: r.statut,',
  '    }));',
  '    const ws = XLSX.utils.json_to_sheet(rows);',
  '    const wb = XLSX.utils.book_new();',
  '    XLSX.utils.book_append_sheet(wb, ws, "RDV du mois");',
  '    XLSX.writeFile(wb, `rapport-rdv-mensuel-${new Date().toISOString().split("T")[0]}.xlsx`);',
  '    toast.success("Rapport mensuel exporté (Excel).");',
  '  };',
  '',
  '  const exportListeDuJour = () => {',
  '    window.print();',
  '  };',
  '',
  '  const exportStatistiquesPresence = async () => {',
  '    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([',
  '      import("jspdf"), import("jspdf-autotable"),',
  '    ]);',
  '    const doc = new jsPDF();',
  '    doc.setFontSize(14);',
  '    doc.text("Statistiques de présence par médecin", 14, 16);',
  '    autoTable(doc, {',
  '      startY: 22,',
  '      head: [["Médecin", "Spécialité", "Total RDV", "Taux présence"]],',
  '      body: medecins.map(m => {',
  '        const total = rdvs.filter(r => r.medecin_id === m._id).length;',
  '        const term = rdvs.filter(r => r.medecin_id === m._id && r.statut === "termine").length;',
  '        const taux = total > 0 ? Math.round(term / total * 100) : 0;',
  '        return [`Dr. ${m.prenom} ${m.nom}`, m.specialite || m.role, String(total), `${taux}%`];',
  '      }),',
  '    });',
  '    doc.save(`statistiques-presence-${new Date().toISOString().split("T")[0]}.pdf`);',
  '    toast.success("Statistiques de présence exportées (PDF).");',
  '  };',
  '',
  '  const exportTauxAnnulation = async () => {',
  '    const [{ default: XLSX }] = await Promise.all([import("xlsx")]);',
  '    const total = rdvs.length;',
  '    const annules = rdvs.filter(r => r.statut === "annule").length;',
  '    const taux = total > 0 ? Math.round(annules / total * 100) : 0;',
  '    const rows = [{ "Total RDV": total, "RDV annulés": annules, "Taux d\'annulation (%)": taux }];',
  '    const ws = XLSX.utils.json_to_sheet(rows);',
  '    const wb = XLSX.utils.book_new();',
  '    XLSX.utils.book_append_sheet(wb, ws, "Taux annulation");',
  '    XLSX.writeFile(wb, `taux-annulation-${new Date().toISOString().split("T")[0]}.xlsx`);',
  '    toast.success("Taux d\'annulation exporté (Excel).");',
  '  };',
  '',
  '  const exportActiviteParService = async () => {',
  '    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([',
  '      import("jspdf"), import("jspdf-autotable"),',
  '    ]);',
  '    const doc = new jsPDF();',
  '    doc.setFontSize(14);',
  '    doc.text("Activité par service", 14, 16);',
  '    const services = [...new Set(rdvs.map(r => r.service).filter(Boolean))];',
  '    autoTable(doc, {',
  '      startY: 22,',
  '      head: [["Service", "Nombre de RDV", "% du total"]],',
  '      body: services.map(s => {',
  '        const count = rdvs.filter(r => r.service === s).length;',
  '        const pct = rdvs.length > 0 ? Math.round(count / rdvs.length * 100) : 0;',
  '        return [s, String(count), `${pct}%`];',
  '      }),',
  '    });',
  '    doc.save(`activite-par-service-${new Date().toISOString().split("T")[0]}.pdf`);',
  '    toast.success("Activité par service exportée (PDF).");',
  '  };'
];
lines.splice(endIdx + 1, 0, ...newFunctions);
const shift = newFunctions.length;

// --- Remplacement du bloc de boutons désactivés ---
const idxOldButton = lines.findIndex(l => l.includes('aucun export réel n\'existe encore pour ce rapport'));
if (idxOldButton === -1) { console.error("ABORT: bouton désactivé introuvable."); process.exit(1); }

// remonter jusqu'au début du .map (titre) pour remplacer tout le bloc proprement
let mapStartIdx = -1;
for (let i = idxOldButton; i > idxOldButton - 20; i--) {
  if (lines[i].includes('["📊","Rapport mensuel des RDV","Excel / PDF"],')) { mapStartIdx = i; break; }
}
if (mapStartIdx === -1) { console.error("ABORT: début du tableau de rapports introuvable."); process.exit(1); }

// trouver la fin du .map (la ligne ')}' fermant le .map, après le bouton)
let mapEndIdx = -1;
for (let i = idxOldButton; i < idxOldButton + 10; i++) {
  if (lines[i].trim() === '))}') { mapEndIdx = i; break; }
}
if (mapEndIdx === -1) { console.error("ABORT: fin du tableau de rapports introuvable."); process.exit(1); }

const newReportsBlock = [
  '                    {[',
  '                      ["📊","Rapport mensuel des RDV","Excel / PDF", exportRapportMensuel],',
  '                      ["📋","Liste des RDV du jour","Impression", exportListeDuJour],',
  '                      ["📈","Statistiques de présence","PDF", exportStatistiquesPresence],',
  '                      ["📉","Taux d\'annulation","Excel", exportTauxAnnulation],',
  '                      ["🏥","Activité par service","PDF", exportActiviteParService],',
  '                    ].map(([icon, titre, fmt, handler]) => (',
  '                      <div key={titre} style={{ display:"flex", alignItems:"center", gap:10, background:"#F8FAFD", borderRadius:10, padding:"10px 14px" }}>',
  '                        <span style={{ fontSize:18 }}>{icon}</span>',
  '                        <div style={{ flex:1 }}>',
  '                          <div style={{ fontSize:12.5, fontWeight:600, color:"var(--cn)" }}>{titre}</div>',
  '                          <div style={{ fontSize:11, color:"var(--cm)" }}>{fmt}</div>',
  '                        </div>',
  '                        <button className="cbtn cbtn-ghost cbtn-sm" onClick={handler}>{I.print} Exporter</button>',
  '                      </div>',
  '                    ))}'
];
lines.splice(mapStartIdx, mapEndIdx - mapStartIdx + 1, ...newReportsBlock);

fs.writeFileSync(path, lines.join(eol), "utf-8");
console.log("OK: patch appliqué (5 fonctions d'export + tableau reconnecté).");
