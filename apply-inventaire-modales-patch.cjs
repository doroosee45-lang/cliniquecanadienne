const fs = require('fs');
const path = "frontend/src/pages/Administration.jsx";
const raw = fs.readFileSync(path, "utf-8");
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r\n|\n/);
console.log("Fin de ligne détectée:", eol === '\r\n' ? "CRLF" : "LF");

const idxCreerService = lines.findIndex(l => l.includes('{I.save} {saving ? "..." : "Créer le service"}'));
if (idxCreerService === -1) { console.error("ABORT: bouton 'Créer le service' introuvable."); process.exit(1); }
let idxModalEnd = -1;
for (let i = idxCreerService; i < idxCreerService + 6; i++) {
  if (lines[i].trim() === '</Modal>') { idxModalEnd = i; break; }
}
if (idxModalEnd === -1) { console.error("ABORT: fermeture </Modal> introuvable."); process.exit(1); }
console.log("Insertion après la ligne", idxModalEnd + 1);

const newModales = [
  '',
  '        {/* ═══ MODAL : ÉQUIPEMENT (Cas #1, audit métier) ═══ */}',
  '        <Modal open={modalEquipment} onClose={() => { setModalEquipment(false); setEditEquipment(null); }} title={editEquipment ? `${I.edit} Modifier — ${editEquipment.nom}` : `${I.plus} Nouvel équipement`} maxWidth={480}>',
  '          <form onSubmit={saveEquipment}>',
  '            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>',
  '              <div>',
  '                <label className="clbl">Nom de l\'équipement *</label>',
  '                <input className="cinp" required value={formEquipment.nom} onChange={e => setFormEquipment(f=>({...f,nom:e.target.value}))} placeholder="Ex: Ordinateur portable" />',
  '              </div>',
  '              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>',
  '                <div>',
  '                  <label className="clbl">Catégorie</label>',
  '                  <select className="cinp" value={formEquipment.categorie} onChange={e => setFormEquipment(f=>({...f,categorie:e.target.value}))}>',
  '                    {["Informatique","Mobilier médical","Imagerie","Laboratoire","Bloc opératoire","Consommable","Autre"].map(c => <option key={c} value={c}>{c}</option>)}',
  '                  </select>',
  '                </div>',
  '                <div>',
  '                  <label className="clbl">Service</label>',
  '                  <select className="cinp" value={formEquipment.service} onChange={e => setFormEquipment(f=>({...f,service:e.target.value}))}>',
  '                    <option value="">— Aucun —</option>',
  '                    {services.map(s => <option key={s._id} value={s._id}>{s.nom}</option>)}',
  '                  </select>',
  '                </div>',
  '              </div>',
  '              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:12 }}>',
  '                <div>',
  '                  <label className="clbl">Quantité</label>',
  '                  <input type="number" min="0" className="cinp" value={formEquipment.quantite} onChange={e => setFormEquipment(f=>({...f,quantite:e.target.value}))} />',
  '                </div>',
  '                <div>',
  '                  <label className="clbl">Unité</label>',
  '                  <input className="cinp" value={formEquipment.unite} onChange={e => setFormEquipment(f=>({...f,unite:e.target.value}))} placeholder="unité" />',
  '                </div>',
  '                <div>',
  '                  <label className="clbl">Seuil d\'alerte</label>',
  '                  <input type="number" min="0" className="cinp" value={formEquipment.seuil_alerte} onChange={e => setFormEquipment(f=>({...f,seuil_alerte:e.target.value}))} />',
  '                </div>',
  '              </div>',
  '              <div>',
  '                <label className="clbl">État</label>',
  '                <select className="cinp" value={formEquipment.etat} onChange={e => setFormEquipment(f=>({...f,etat:e.target.value}))}>',
  '                  <option value="bon">Bon</option>',
  '                  <option value="moyen">Moyen</option>',
  '                  <option value="hors_service">Hors service</option>',
  '                </select>',
  '              </div>',
  '              <div>',
  '                <label className="clbl">Notes</label>',
  '                <textarea className="cinp" rows={2} value={formEquipment.notes} onChange={e => setFormEquipment(f=>({...f,notes:e.target.value}))} />',
  '              </div>',
  '              <div style={{ display:"flex", gap:10 }}>',
  '                <button type="button" className="cbtn cbtn-ghost" onClick={() => { setModalEquipment(false); setEditEquipment(null); }}>Annuler</button>',
  '                <button type="submit" className="cbtn cbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>',
  '                  {I.save} {saving ? "..." : editEquipment ? "Enregistrer" : "Ajouter l\'équipement"}',
  '                </button>',
  '              </div>',
  '            </div>',
  '          </form>',
  '        </Modal>',
  '',
  '        {/* ═══ MODAL : MOUVEMENT DE STOCK (Cas #1, audit métier) ═══ */}',
  '        <Modal open={modalMouvement} onClose={() => { setModalMouvement(false); setMouvementTarget(null); }} title={mouvementTarget ? `📦 Mouvement — ${mouvementTarget.nom}` : "📦 Mouvement de stock"} maxWidth={420}>',
  '          <form onSubmit={saveMouvement}>',
  '            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>',
  '              <div>',
  '                <label className="clbl">Type de mouvement</label>',
  '                <select className="cinp" value={formMouvement.type} onChange={e => setFormMouvement(f=>({...f,type:e.target.value}))}>',
  '                  <option value="entree">Entrée</option>',
  '                  <option value="sortie">Sortie</option>',
  '                  <option value="ajustement">Ajustement (nouvelle quantité totale)</option>',
  '                </select>',
  '              </div>',
  '              <div>',
  '                <label className="clbl">Quantité *</label>',
  '                <input type="number" min="1" required className="cinp" value={formMouvement.quantite} onChange={e => setFormMouvement(f=>({...f,quantite:e.target.value}))} />',
  '              </div>',
  '              <div>',
  '                <label className="clbl">Motif</label>',
  '                <input className="cinp" value={formMouvement.motif} onChange={e => setFormMouvement(f=>({...f,motif:e.target.value}))} placeholder="Ex: Achat, casse, prêt..." />',
  '              </div>',
  '              <div style={{ display:"flex", gap:10 }}>',
  '                <button type="button" className="cbtn cbtn-ghost" onClick={() => { setModalMouvement(false); setMouvementTarget(null); }}>Annuler</button>',
  '                <button type="submit" className="cbtn cbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>',
  '                  {I.save} {saving ? "..." : "Enregistrer le mouvement"}',
  '                </button>',
  '              </div>',
  '            </div>',
  '          </form>',
  '        </Modal>'
];
lines.splice(idxModalEnd + 1, 0, ...newModales);

fs.writeFileSync(path, lines.join(eol), "utf-8");
console.log("OK: modales inventaire ajoutées.");
