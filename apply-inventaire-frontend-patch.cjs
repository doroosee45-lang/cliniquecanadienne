const fs = require('fs');
const path = "frontend/src/pages/Administration.jsx";
const raw = fs.readFileSync(path, "utf-8");
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r\n|\n/);
console.log("Fin de ligne détectée:", eol === '\r\n' ? "CRLF" : "LF");

// --- Edit A : ajouter EMPTY_EQUIPMENT après EMPTY_SERVICE ---
const idxEmptyService = lines.findIndex(l => l.includes('const EMPTY_SERVICE ='));
if (idxEmptyService === -1) { console.error("ABORT: EMPTY_SERVICE introuvable."); process.exit(1); }
lines.splice(idxEmptyService + 1, 0,
  'const EMPTY_EQUIPMENT = { nom:"", categorie:"Autre", service:"", quantite:0, unite:"unité", seuil_alerte:0, etat:"bon", notes:"" };'
);

// --- Edit B : ajouter les states après modalService/formService ---
const idxModalService = lines.findIndex(l => l.includes("const [modalService, setModalService]"));
if (idxModalService === -1) { console.error("ABORT: modalService introuvable."); process.exit(1); }
lines.splice(idxModalService + 1, 0,
  '  const [modalEquipment, setModalEquipment] = useState(false);',
  '  const [modalMouvement, setModalMouvement] = useState(false);'
);

const idxFormService = lines.findIndex(l => l.includes("const [formService, setFormService]"));
if (idxFormService === -1) { console.error("ABORT: formService introuvable."); process.exit(1); }
lines.splice(idxFormService + 1, 0,
  '  const [equipments, setEquipments] = useState([]);',
  '  const [formEquipment, setFormEquipment] = useState(EMPTY_EQUIPMENT);',
  '  const [editEquipment, setEditEquipment] = useState(null);',
  '  const [mouvementTarget, setMouvementTarget] = useState(null);',
  '  const [formMouvement, setFormMouvement] = useState({ type:"entree", quantite:"", motif:"" });'
);

// --- Edit C : ajouter l'appel API dans le Promise.allSettled ---
const idxPermRes = lines.findIndex(l => l.includes('api.get("/settings/roles-permissions"),'));
if (idxPermRes === -1) { console.error("ABORT: appel roles-permissions introuvable."); process.exit(1); }
lines.splice(idxPermRes + 1, 0, '        api.get("/settings/inventory"),');

// --- Edit D : renommer la déstructuration pour inclure eqRes ---
const idxDestructure = lines.findIndex(l => l.includes('const [kRes, uRes, svcRes, rRes, sRes, tRes, aRes, depRes, setRes, permRes] = await Promise.allSettled(['));
if (idxDestructure === -1) { console.error("ABORT: ligne de déstructuration introuvable."); process.exit(1); }
lines[idxDestructure] = lines[idxDestructure].replace(
  'const [kRes, uRes, svcRes, rRes, sRes, tRes, aRes, depRes, setRes, permRes] = await Promise.allSettled([',
  'const [kRes, uRes, svcRes, rRes, sRes, tRes, aRes, depRes, setRes, permRes, eqRes] = await Promise.allSettled(['
);

// --- Edit E : traiter eqRes après setServices ---
const idxSetServices = lines.findIndex(l => l.includes('setServices(svcRes.status === "fulfilled" ? toArr(svcRes.value.data.services || svcRes.value.data, []) : []);'));
if (idxSetServices === -1) { console.error("ABORT: setServices introuvable."); process.exit(1); }
lines.splice(idxSetServices + 1, 0,
  '      setEquipments(eqRes.status === "fulfilled" ? toArr(eqRes.value.data.equipments || eqRes.value.data, []) : []);'
);

// --- Edit F : ajouter setEquipments([]) dans le catch ---
const idxCatchFallback = lines.findIndex(l => l.includes('setUsers(DEMO_USERS); setServices([]); setRooms(DEMO_ROOMS);'));
if (idxCatchFallback === -1) { console.error("ABORT: fallback catch introuvable."); process.exit(1); }
lines[idxCatchFallback] = lines[idxCatchFallback].replace(
  'setUsers(DEMO_USERS); setServices([]); setRooms(DEMO_ROOMS);',
  'setUsers(DEMO_USERS); setServices([]); setEquipments([]); setRooms(DEMO_ROOMS);'
);

// --- Edit G : ajouter saveEquipment et saveMouvement juste après saveService ---
const idxSaveServiceStart = lines.findIndex(l => l.includes('const saveService = async (e) => {'));
if (idxSaveServiceStart === -1) { console.error("ABORT: saveService introuvable."); process.exit(1); }
let endSaveService = -1;
for (let i = idxSaveServiceStart; i < idxSaveServiceStart + 20; i++) {
  if (lines[i].trim() === '};') { endSaveService = i; break; }
}
if (endSaveService === -1) { console.error("ABORT: fin de saveService introuvable."); process.exit(1); }

const newSaveFunctions = [
  '',
  '  // Cas #1 (audit métier) — remplace le placeholder "🚧 en cours de',
  '  // développement" par un vrai CRUD (Equipment + MouvementInventaire),',
  '  // même pattern que saveService ci-dessus.',
  '  const saveEquipment = async (e) => {',
  '    e.preventDefault();',
  '    setSaving(true);',
  '    try {',
  '      const payload = {',
  '        nom: formEquipment.nom,',
  '        categorie: formEquipment.categorie,',
  '        service: formEquipment.service || undefined,',
  '        quantite: Number(formEquipment.quantite) || 0,',
  '        unite: formEquipment.unite,',
  '        seuil_alerte: Number(formEquipment.seuil_alerte) || 0,',
  '        etat: formEquipment.etat,',
  '        notes: formEquipment.notes,',
  '      };',
  '      if (editEquipment) {',
  '        const { data } = await api.put(`/settings/inventory/${editEquipment._id}`, payload);',
  '        setEquipments(prev => prev.map(eq => eq._id === data.equipment._id ? data.equipment : eq));',
  '        toast.success(`✅ Équipement "${data.equipment.nom}" modifié`);',
  '      } else {',
  '        const { data } = await api.post("/settings/inventory", payload);',
  '        setEquipments(prev => [...prev, data.equipment]);',
  '        toast.success(`✅ Équipement "${data.equipment.nom}" ajouté`);',
  '      }',
  '      setModalEquipment(false); setFormEquipment(EMPTY_EQUIPMENT); setEditEquipment(null);',
  '    } catch (err) {',
  '      toast.error(err?.response?.data?.message || "❌ Échec de l\'enregistrement de l\'équipement.");',
  '    } finally {',
  '      setSaving(false);',
  '    }',
  '  };',
  '',
  '  const saveMouvement = async (e) => {',
  '    e.preventDefault();',
  '    if (!mouvementTarget) return;',
  '    setSaving(true);',
  '    try {',
  '      const { data } = await api.post(`/settings/inventory/${mouvementTarget._id}/mouvement`, {',
  '        type: formMouvement.type, quantite: Number(formMouvement.quantite), motif: formMouvement.motif,',
  '      });',
  '      setEquipments(prev => prev.map(eq => eq._id === data.equipment._id ? { ...data.equipment, alerte_stock_bas: data.equipment.quantite <= data.equipment.seuil_alerte } : eq));',
  '      toast.success("✅ Mouvement enregistré");',
  '      setModalMouvement(false); setMouvementTarget(null); setFormMouvement({ type:"entree", quantite:"", motif:"" });',
  '    } catch (err) {',
  '      toast.error(err?.response?.data?.message || "❌ Échec de l\'enregistrement du mouvement.");',
  '    } finally {',
  '      setSaving(false);',
  '    }',
  '  };'
];
lines.splice(endSaveService + 1, 0, ...newSaveFunctions);

// --- Edit H : remplacer le panneau UI "section === ressources" ---
const idxRessourcesStart = lines.findIndex(l => l.includes('{section === "ressources" && ('));
if (idxRessourcesStart === -1) { console.error("ABORT: bloc ressources introuvable."); process.exit(1); }
let idxRessourcesEnd = -1;
for (let i = idxRessourcesStart; i < idxRessourcesStart + 15; i++) {
  if (lines[i].trim() === ')}') { idxRessourcesEnd = i; break; }
}
if (idxRessourcesEnd === -1) { console.error("ABORT: fin du bloc ressources introuvable."); process.exit(1); }

const newRessourcesBlock = [
  '              {section === "ressources" && (',
  '                <div>',
  '                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>',
  '                    <div>',
  '                      <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)" }}>Gestion des ressources & équipements</div>',
  '                      <div style={{ fontSize:12, color:"var(--cm)" }}>{equipments.length} équipement(s) référencé(s)</div>',
  '                    </div>',
  '                    <button className="cbtn cbtn-primary" onClick={() => { setFormEquipment(EMPTY_EQUIPMENT); setEditEquipment(null); setModalEquipment(true); }}>',
  '                      {I.plus} Ajouter un équipement',
  '                    </button>',
  '                  </div>',
  '                  <div className="adm-card">',
  '                    <div style={{ overflowX:"auto" }}>',
  '                      <table className="adm-tbl">',
  '                        <thead><tr><th>Nom</th><th>Catégorie</th><th>Quantité</th><th>Seuil</th><th>État</th><th>Actions</th></tr></thead>',
  '                        <tbody>',
  '                          {equipments.length === 0 ? (',
  '                            <tr><td colSpan={6} style={{ textAlign:"center", color:"var(--cm)", fontSize:12, padding:"16px 0" }}>Aucun équipement enregistré</td></tr>',
  '                          ) : equipments.map(eq => (',
  '                            <tr key={eq._id}>',
  '                              <td><div style={{ fontWeight:600, color:"var(--cn)", fontSize:12.5 }}>{eq.nom}</div>{eq.alerte_stock_bas && <Badge cls="red">⚠ Stock bas</Badge>}</td>',
  '                              <td><Badge cls="blue">{eq.categorie}</Badge></td>',
  '                              <td style={{ fontWeight:700 }}>{eq.quantite} {eq.unite}</td>',
  '                              <td style={{ color:"var(--cm)" }}>{eq.seuil_alerte}</td>',
  '                              <td><Badge cls={eq.etat === "bon" ? "green" : eq.etat === "moyen" ? "orange" : "red"}>{eq.etat}</Badge></td>',
  '                              <td>',
  '                                <div style={{ display:"flex", gap:6 }}>',
  '                                  <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => { setFormMouvement({ type:"entree", quantite:"", motif:"" }); setMouvementTarget(eq); setModalMouvement(true); }}>Mouvement</button>',
  '                                  <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => { setFormEquipment({ nom:eq.nom, categorie:eq.categorie, service:eq.service?._id || "", quantite:eq.quantite, unite:eq.unite, seuil_alerte:eq.seuil_alerte, etat:eq.etat, notes:eq.notes || "" }); setEditEquipment(eq); setModalEquipment(true); }}>{I.edit}</button>',
  '                                </div>',
  '                              </td>',
  '                            </tr>',
  '                          ))}',
  '                        </tbody>',
  '                      </table>',
  '                    </div>',
  '                  </div>',
  '                </div>',
  '              )}'
];
lines.splice(idxRessourcesStart, idxRessourcesEnd - idxRessourcesStart + 1, ...newRessourcesBlock);

fs.writeFileSync(path, lines.join(eol), "utf-8");
console.log("OK: patch frontend inventaire appliqué (partie 1 : states + CRUD + tableau). Modales à ajouter séparément.");
