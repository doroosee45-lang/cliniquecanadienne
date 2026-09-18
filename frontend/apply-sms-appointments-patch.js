const fs = require('fs');
const path = "frontend/src/pages/Appointments.jsx";
const raw = fs.readFileSync(path, "utf-8");

const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r\n|\n/);

console.log("Fin de ligne détectée:", eol === '\r\n' ? "CRLF" : "LF");

// --- Vérifications de sécurité (comparaison insensible au \r) ---
if (!lines[1965] || !lines[1965].includes("AUDIT-P7-8")) {
  console.error("ABORT: ligne 1966 ne contient pas AUDIT-P7-8.");
  console.error("Contenu:", JSON.stringify(lines[1965]));
  process.exit(1);
}
if (!lines[1973] || !lines[1973].trim().startsWith("</button>")) {
  console.error("ABORT: ligne 1974 n'est pas </button>.");
  console.error("Contenu:", JSON.stringify(lines[1973]));
  process.exit(1);
}

// --- Edit A ---
const idxA = lines.findIndex(l => l.trim() === 'const [selectedRdv, setSelectedRdv] = useState(null);');
if (idxA === -1) {
  console.error("ABORT: Edit A — ligne selectedRdv introuvable.");
  process.exit(1);
}
lines.splice(idxA + 1, 0, '  const [smsSending, setSmsSending] = useState(false);');

// --- Edit B ---
const shift = 1;
const startIdx = 1965 + shift;
const endIdx   = 1973 + shift;
const deleteCount = endIdx - startIdx + 1;

const newBlockLines = [
'                  {/* AUDIT-P7-8 (mise à jour) — au moment de l\'audit initial,',
'                      Twilio n\'était pas intégré. Depuis, backend/utils/sms.js +',
'                      POST /messages/patient-sms + messages.controller.js::',
'                      sendPatientSms existent et sont déjà branchés dans',
'                      Messages.jsx avec repli honnête en mode simulé si Twilio',
'                      n\'est pas configuré (jamais de faux succès). Ce bouton',
'                      n\'avait juste jamais été reconnecté à cette route déjà',
'                      disponible. Même pattern de réponse (data.simulated)',
'                      repris ici pour rester cohérent avec Messages.jsx. */}',
'                  <button className="cbtn cbtn-ghost cbtn-sm"',
'                    disabled={smsSending || !selectedRdv.patient_tel}',
'                    title={selectedRdv.patient_tel ? "Envoyer un rappel SMS au patient" : "Ce patient n\'a pas de numéro de téléphone enregistré."}',
'                    onClick={async () => {',
'                      setSmsSending(true);',
'                      try {',
'                        const contenu = `Rappel : rendez-vous le ${fmtDate(selectedRdv.date)} à ${fmtTime(selectedRdv.date)}${selectedRdv.medecin_nom ? \' avec \' + selectedRdv.medecin_nom : \'\'}.`;',
'                        const { data } = await api.post("/messages/patient-sms", { patient: selectedRdv.patient_id, contenu });',
'                        toast.success(data.simulated ? "📱 SMS simulé (Twilio non configuré en environnement local)" : "📱 SMS de rappel envoyé");',
'                      } catch (err) {',
'                        toast.error(err?.response?.data?.message || "Échec de l\'envoi du SMS.");',
'                      } finally {',
'                        setSmsSending(false);',
'                      }',
'                    }}>',
'                    {smsSending ? "Envoi…" : <>{I.sms} Envoyer SMS</>}',
'                  </button>'
];

lines.splice(startIdx, deleteCount, ...newBlockLines);

fs.writeFileSync(path, lines.join(eol), "utf-8");
console.log("OK: modifications appliquées avec succès.");
