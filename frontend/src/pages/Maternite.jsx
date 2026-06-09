import { useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  fetchMaterniteStats,
  fetchGrossesses,
  fetchAccouchements,
  fetchNouveauxNes,
  createGrossesse,
  addCPN,
  addEcho,
  createAccouchement,
  createNouveauNe,
  updateTravail,
  addPostnatal,
  setFilters,
  selectMaterniteStats,
  selectGrossesses,
  selectGrossesseTotal,
  selectAccouchements,
  selectNouveauNes,
  selectMaterniteLoading,
  selectMaterniteSaving,
  selectMaterniteError,
  selectMaterniteFilters,
} from "../store/slices/materniteSlice";

// ─── CSS Medical Navy + Teal (même palette qu'Analytics) ─────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.mat * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --an:#0B1E3B; --an2:#132744; --ab:#1B4F9E;
  --at:#0EA5A0; --at2:#0D9490; --ar:#DC2626;
  --ao:#D97706; --ag:#059669; --ap:#7C3AED;
  --apk:#EC4899; --apk2:#DB2777;
  --abr:#E2EAF4; --am:#6B7A99; --al:#EEF4FF; --as:#F8FAFD;
  --sh:0 1px 3px rgba(11,30,59,.08); --shm:0 4px 16px rgba(11,30,59,.10); --shl:0 12px 40px rgba(11,30,59,.14);
}
/* Topbar */
.mat-top { background:linear-gradient(135deg,#1a0a2e 0%,#2d1b5e 40%,#1B4F9E 80%, var(--apk2) 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.mat-top::before { content:''; position:absolute; top:-60px; right:-60px; width:260px; height:260px; background:radial-gradient(circle,rgba(236,72,153,.22) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
.mat-top::after  { content:''; position:absolute; bottom:-80px; left:30%; width:200px; height:200px; background:radial-gradient(circle,rgba(27,79,158,.15) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
/* Tabs */
.mat-tabs { display:flex; gap:2px; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.mat-tabs::-webkit-scrollbar { display:none; }
.mat-tab { display:flex; align-items:center; gap:7px; padding:10px 16px 12px; font-size:12px; font-weight:600; color:rgba(255,255,255,.55); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.mat-tab:hover { color:rgba(255,255,255,.88); background:rgba(255,255,255,.08); }
.mat-tab.active { color:var(--an); background:var(--as); box-shadow:0 -2px 0 var(--apk) inset; }
/* Cards */
.mat-card { background:#fff; border:1.5px solid var(--abr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; }
.mat-card:hover { box-shadow:var(--shm); }
.mat-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--abr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(252,231,243,.5),transparent); }
.mat-card-hdr h3 { font-size:14px; font-weight:700; color:var(--an); margin:0; display:flex; align-items:center; gap:8px; }
.mat-card-hdr p  { font-size:11px; color:var(--am); margin:2px 0 0; }
/* KPI */
.mat-kpi { background:#fff; border:1.5px solid var(--abr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:default; }
.mat-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.mat-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.mat-kpi.pink::before   { background:var(--apk); }
.mat-kpi.blue::before   { background:var(--ab); }
.mat-kpi.teal::before   { background:var(--at); }
.mat-kpi.red::before    { background:var(--ar); }
.mat-kpi.orange::before { background:var(--ao); }
.mat-kpi.green::before  { background:var(--ag); }
.mat-kpi.purple::before { background:var(--ap); }
.mkpi-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; font-size:20px; }
.mkpi-icon.pink   { background:#FDF2F8; }
.mkpi-icon.blue   { background:#EFF6FF; }
.mkpi-icon.teal   { background:#F0FDFC; }
.mkpi-icon.red    { background:#FEF2F2; }
.mkpi-icon.orange { background:#FFF7ED; }
.mkpi-icon.green  { background:#ECFDF5; }
.mkpi-icon.purple { background:#F5F3FF; }
.mkpi-val { font-size:28px; font-weight:800; color:var(--an); line-height:1; margin-bottom:4px; letter-spacing:-1.5px; }
.mkpi-lbl { font-size:12px; font-weight:600; color:var(--am); }
.mkpi-sub { font-size:11px; color:#9CA3AF; margin-top:3px; }
.mkpi-dot { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--ar); animation:matP 2s infinite; }
@keyframes matP { 0%,100%{opacity:1} 50%{opacity:.3} }
/* Mini KPI */
.mini-kpi { background:#F8FAFD; border:1.5px solid var(--abr); border-radius:12px; padding:12px 14px; }
.mini-kpi-val { font-size:20px; font-weight:800; color:var(--an); letter-spacing:-1px; }
.mini-kpi-lbl { font-size:11px; font-weight:600; color:var(--am); margin-top:2px; }
/* Progress */
.mat-prog { background:#EEF4FF; border-radius:99px; height:8px; overflow:hidden; }
.mat-prog-f { height:100%; border-radius:99px; transition:width .8s cubic-bezier(.34,1.56,.64,1); }
/* Badges */
.mbdg { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.mbdg.pink   { background:#FDF2F8; color:var(--apk); border:1px solid #F9A8D4; }
.mbdg.red    { background:#FEF2F2; color:var(--ar); border:1px solid #FECACA; }
.mbdg.orange { background:#FFF7ED; color:var(--ao); border:1px solid #FED7AA; }
.mbdg.green  { background:#ECFDF5; color:var(--ag); border:1px solid #A7F3D0; }
.mbdg.blue   { background:#EFF6FF; color:var(--ab); border:1px solid #BFDBFE; }
.mbdg.teal   { background:#F0FDFC; color:var(--at); border:1px solid #99F6E4; }
.mbdg.purple { background:#F5F3FF; color:var(--ap); border:1px solid #DDD6FE; }
.mbdg.gray   { background:#F9FAFB; color:#4B5563; border:1px solid #E5E7EB; }
/* Boutons */
.mbtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; }
.mbtn-pink    { background:var(--apk); color:#fff; } .mbtn-pink:hover  { background:var(--apk2); transform:translateY(-1px); }
.mbtn-primary { background:var(--ab); color:#fff; }  .mbtn-primary:hover { background:#174391; transform:translateY(-1px); }
.mbtn-teal    { background:var(--at); color:#fff; }  .mbtn-teal:hover   { background:var(--at2); transform:translateY(-1px); }
.mbtn-ghost   { background:transparent; color:var(--am); border:1.5px solid var(--abr); }
.mbtn-ghost:hover { background:var(--al); color:var(--an); }
.mbtn-sm { padding:6px 13px; font-size:12px; }
.mbtn-danger { background:var(--ar); color:#fff; } .mbtn-danger:hover { background:#B91C1C; transform:translateY(-1px); }
/* Table */
.mat-tbl { width:100%; border-collapse:collapse; }
.mat-tbl thead tr { background:linear-gradient(to right,#FDF2F8,#EEF4FF); }
.mat-tbl th { padding:10px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--am); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--abr); white-space:nowrap; }
.mat-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.mat-tbl tbody tr:last-child td { border-bottom:none; }
.mat-tbl tbody tr:hover { background:#FDF8FD; }
/* Alert boxes */
.al-danger { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--ar); border-radius:14px; padding:14px 18px; }
.al-warn   { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--ao); border-radius:14px; padding:14px 18px; }
.al-info   { background:linear-gradient(135deg,#FDF2F8,#FCE7F3); border:1.5px solid #F9A8D4; border-left:4px solid var(--apk); border-radius:14px; padding:14px 18px; }
.al-success{ background:linear-gradient(135deg,#ECFDF5,#D1FAE5); border:1.5px solid #A7F3D0; border-left:4px solid var(--ag); border-radius:14px; padding:14px 18px; }
/* Modal */
.mat-overlay { position:fixed; inset:0; background:rgba(11,30,59,.55); z-index:1000; display:flex; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(4px); }
.mat-modal { background:#fff; border-radius:20px; width:100%; max-width:640px; max-height:90vh; overflow-y:auto; box-shadow:var(--shl); }
.mat-modal-hdr { padding:20px 24px 16px; border-bottom:1.5px solid var(--abr); display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; background:#fff; z-index:1; border-radius:20px 20px 0 0; background:linear-gradient(135deg,#FDF2F8,#fff); }
.mat-modal-hdr h2 { font-size:17px; font-weight:800; color:var(--an); margin:0; }
.mat-modal-body { padding:20px 24px; }
/* Form */
.mat-field { margin-bottom:16px; }
.mat-label { font-size:12px; font-weight:700; color:var(--am); margin-bottom:6px; display:block; text-transform:uppercase; letter-spacing:.4px; }
.mat-input { width:100%; padding:10px 14px; border:1.5px solid var(--abr); border-radius:10px; font-size:13px; font-family:'Poppins',sans-serif; color:var(--an); background:#F8FAFD; outline:none; transition:border-color .2s; }
.mat-input:focus { border-color:var(--apk); background:#fff; }
.mat-select { width:100%; padding:10px 14px; border:1.5px solid var(--abr); border-radius:10px; font-size:13px; font-family:'Poppins',sans-serif; color:var(--an); background:#F8FAFD; outline:none; cursor:pointer; }
.mat-select:focus { border-color:var(--apk); }
.mat-g2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
/* Filter */
.filter-bar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; padding:16px 0 20px; }
.filter-btn { padding:7px 16px; border-radius:99px; font-size:12px; font-weight:600; border:1.5px solid var(--abr); background:white; color:var(--am); cursor:pointer; transition:all .2s; font-family:'Poppins',sans-serif; white-space:nowrap; }
.filter-btn:hover { border-color:var(--apk); color:var(--apk); }
.filter-btn.active { background:var(--apk); color:white; border-color:var(--apk); }
/* Section label */
.sec-label { font-size:13px; font-weight:700; color:var(--am); text-transform:uppercase; letter-spacing:.6px; margin-bottom:12px; display:flex; align-items:center; gap:8px; }
/* Partogramme cell */
.parto-cell { border:1px solid #E2EAF4; padding:6px; text-align:center; font-size:11px; font-weight:600; }
.parto-head { background:linear-gradient(to right,#FDF2F8,#EEF4FF); font-weight:700; color:var(--an); }
/* Fade */
@keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
.fu  { animation:fadeUp .4s ease both; }
.d1{animation-delay:.05s}.d2{animation-delay:.1s}.d3{animation-delay:.15s}
.d4{animation-delay:.2s}.d5{animation-delay:.25s}.d6{animation-delay:.3s}
/* Scrollbar */
.nice-scroll::-webkit-scrollbar { width:5px; height:5px; }
.nice-scroll::-webkit-scrollbar-thumb { background:var(--abr); border-radius:99px; }
/* Risk level indicator */
.risk-bar { display:flex; gap:3px; margin-top:6px; }
.risk-seg { height:6px; flex:1; border-radius:99px; }
/* Timeline */
.timeline-item { display:flex; gap:12px; padding-bottom:16px; position:relative; }
.timeline-item::before { content:''; position:absolute; left:15px; top:32px; bottom:0; width:2px; background:var(--abr); }
.timeline-item:last-child::before { display:none; }
.timeline-dot { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; border:2px solid #fff; box-shadow:0 0 0 2px var(--abr); }
@media print { .mat-top,.filter-bar,.mbtn { display:none!important; } }
/* ─── Responsive ─── */
@media (max-width:767px) {
  .mat-top { padding:12px 14px 0; }
  .mat-g2 { grid-template-columns:1fr; gap:10px; }
  .mbtn { font-size:12px; padding:8px 12px; } .mbtn-sm { font-size:11px; padding:5px 8px; }
  .mat-card { border-radius:14px; } .mat-card-hdr { padding:11px 14px; flex-wrap:wrap; gap:8px; }
  .filter-bar { overflow-x:auto; flex-wrap:nowrap; scrollbar-width:none; padding:10px 0 14px; }
  .filter-bar::-webkit-scrollbar { display:none; }
  .mat-tbl th, .mat-tbl td { padding:9px 10px; font-size:12px; }
  .mat-modal { max-width:100%; max-height:95vh; }
  .mat-modal-hdr { padding:16px 18px 12px; }
  .mat-modal-body { padding:14px 18px; }
}
@media (max-width:479px) {
  .mat-top { padding:10px 12px 0; }
  .mkpi-val { font-size:22px; }
  .mat-modal-hdr h2 { font-size:14px; }
}
`;

// ─── Helpers ─────────────────────────────────────────────────
const risqueBadge = (r) => r==="eleve"||r==="élevé" ? "red" : r==="modere"||r==="modéré" ? "orange" : "green";
const statutBadge = (s) => s==="active" ? "green" : s==="a_risque" ? "red" : s==="accouchee" ? "teal" : "orange";
const risqueLabel = (r) => r==="eleve" ? "Élevé" : r==="modere" ? "Modéré" : "Faible";
const statutLabel = (s) => {
  const m = { active:"Actif", a_risque:"À risque", accouchee:"Accouchée", suivi_postnatal:"Post-natal", cloturee:"Clôturée" };
  return m[s] || s;
};
const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric" });
};
const agSemaines = (ddr) => {
  if (!ddr) return "—";
  const diff = Math.floor((Date.now() - new Date(ddr)) / (7 * 86400000));
  return `${diff} SA`;
};

function Badge({ cls, children }) { return <span className={`mbdg ${cls}`}>{children}</span>; }
function Prog({ pct, color, h=8 }) {
  return <div className="mat-prog" style={{height:h}}><div className="mat-prog-f" style={{width:`${Math.min(100,pct)}%`,background:color}}/></div>;
}

// ─── MODAL Nouveau dossier grossesse ────────────────────────
function ModalDossier({ onClose, saving }) {
  const dispatch = useDispatch();
  const [form, setForm] = useState({ patient_nom:"", patient_prenom:"", telephone:"", ddr:"", groupe_sanguin:"", medecin_responsable:"", antecedents_medicaux:"", facteurs_risque:[] });

  const handleSubmit = async () => {
    if (!form.patient_nom || !form.ddr) { toast.error("Veuillez remplir les champs obligatoires"); return; }
    const result = await dispatch(createGrossesse(form));
    if (createGrossesse.fulfilled.match(result)) {
      toast.success(`✅ Dossier grossesse créé pour ${form.patient_prenom} ${form.patient_nom}`);
      onClose();
    } else {
      toast.error(result.payload || "Erreur création");
    }
  };

  return (
    <div className="mat-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="mat-modal nice-scroll">
        <div className="mat-modal-hdr">
          <h2>🤱 Nouveau dossier grossesse</h2>
          <button className="mbtn mbtn-ghost mbtn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="mat-modal-body">
          <div className="mat-g2">
            <div className="mat-field">
              <label className="mat-label">Nom *</label>
              <input className="mat-input" placeholder="Ex: Diallo" value={form.patient_nom} onChange={e=>setForm({...form,patient_nom:e.target.value})}/>
            </div>
            <div className="mat-field">
              <label className="mat-label">Prénom *</label>
              <input className="mat-input" placeholder="Ex: Aminata" value={form.patient_prenom} onChange={e=>setForm({...form,patient_prenom:e.target.value})}/>
            </div>
          </div>
          <div className="mat-g2">
            <div className="mat-field">
              <label className="mat-label">Téléphone</label>
              <input className="mat-input" placeholder="06-XX-XX-XX" value={form.telephone} onChange={e=>setForm({...form,telephone:e.target.value})}/>
            </div>
            <div className="mat-field">
              <label className="mat-label">Groupe sanguin</label>
              <select className="mat-select" value={form.groupe_sanguin} onChange={e=>setForm({...form,groupe_sanguin:e.target.value})}>
                <option value="">-- Sélectionner --</option>
                {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div className="mat-g2">
            <div className="mat-field">
              <label className="mat-label">Date dernières règles (DDR) *</label>
              <input className="mat-input" type="date" value={form.ddr} onChange={e=>setForm({...form,ddr:e.target.value})}/>
            </div>
            <div className="mat-field">
              <label className="mat-label">Médecin responsable</label>
              <select className="mat-select" value={form.medecin_responsable} onChange={e=>setForm({...form,medecin_responsable:e.target.value})}>
                <option value="">-- Sélectionner --</option>
                <option>Dr. Koffi</option><option>Dr. Bello</option>
              </select>
            </div>
          </div>
          <div className="mat-field">
            <label className="mat-label">Antécédents médicaux / obstétricaux</label>
            <textarea className="mat-input" rows={3} placeholder="Fausses couches, césariennes, maladies chroniques..." value={form.antecedents_medicaux} onChange={e=>setForm({...form,antecedents_medicaux:e.target.value})} style={{resize:"vertical"}}/>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
            <button className="mbtn mbtn-ghost" onClick={onClose}>Annuler</button>
            <button className="mbtn mbtn-pink" onClick={handleSubmit} disabled={saving}>{saving?"⏳ Création...":"💾 Créer le dossier"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL CPN ───────────────────────────────────────────────
function ModalCPN({ grossesse, patienteNom, onClose, saving }) {
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    tension_sys:"", tension_dia:"", temperature:"", poids:"", hauteur_uterine:"",
    bcf:"", presentation:"cephalique", hemoglobine:"", glycemie:"",
    vih:"negatif", hepatite_b:"negatif", syphilis:"negatif", proteinurie:"negative",
    conseils:"", vitamines:""
  });

  const handleSubmit = async () => {
    if (!grossesse?._id) { toast.error("Sélectionnez d'abord un dossier grossesse"); return; }
    const body = { ...form };
    if (form.tension_sys) body.tension_sys = Number(form.tension_sys);
    if (form.tension_dia) body.tension_dia = Number(form.tension_dia);
    if (form.temperature) body.temperature = Number(form.temperature);
    if (form.poids) body.poids = Number(form.poids);
    if (form.hauteur_uterine) body.hauteur_uterine = Number(form.hauteur_uterine);
    if (form.bcf) body.bcf = Number(form.bcf);
    if (form.hemoglobine) body.hemoglobine = Number(form.hemoglobine);
    if (form.glycemie) body.glycemie = Number(form.glycemie);
    const result = await dispatch(addCPN({ id: grossesse._id, body }));
    if (addCPN.fulfilled.match(result)) {
      toast.success(`✅ CPN enregistrée pour ${patienteNom}`);
      onClose();
    } else {
      toast.error(result.payload || "Erreur enregistrement CPN");
    }
  };

  const F = ({label,children}) => (
    <div className="mat-field">{label&&<label className="mat-label">{label}</label>}{children}</div>
  );
  return (
    <div className="mat-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="mat-modal nice-scroll">
        <div className="mat-modal-hdr">
          <h2>🩺 Consultation Prénatale — {patienteNom}</h2>
          <button className="mbtn mbtn-ghost mbtn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="mat-modal-body">
          <div style={{fontSize:13,fontWeight:700,color:"var(--apk)",marginBottom:12}}>📊 Signes vitaux</div>
          <div className="mat-g2">
            <F label="Tension systolique (mmHg)"><input className="mat-input" placeholder="Ex: 120" value={form.tension_sys} onChange={e=>setForm({...form,tension_sys:e.target.value})}/></F>
            <F label="Tension diastolique (mmHg)"><input className="mat-input" placeholder="Ex: 80" value={form.tension_dia} onChange={e=>setForm({...form,tension_dia:e.target.value})}/></F>
            <F label="Température (°C)"><input className="mat-input" placeholder="Ex: 37.2" value={form.temperature} onChange={e=>setForm({...form,temperature:e.target.value})}/></F>
            <F label="Poids (kg)"><input className="mat-input" placeholder="Ex: 68" value={form.poids} onChange={e=>setForm({...form,poids:e.target.value})}/></F>
            <F label="Hauteur utérine (cm)"><input className="mat-input" placeholder="Ex: 30" value={form.hauteur_uterine} onChange={e=>setForm({...form,hauteur_uterine:e.target.value})}/></F>
          </div>
          <div style={{fontSize:13,fontWeight:700,color:"var(--apk)",margin:"12px 0 10px"}}>👶 Examen obstétrical</div>
          <div className="mat-g2">
            <F label="Battements cœur fœtaux (/min)"><input className="mat-input" placeholder="Ex: 148" value={form.bcf} onChange={e=>setForm({...form,bcf:e.target.value})}/></F>
            <F label="Présentation du fœtus">
              <select className="mat-select" value={form.presentation} onChange={e=>setForm({...form,presentation:e.target.value})}>
                {["cephalique","siege","transverse"].map(p=><option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
              </select>
            </F>
          </div>
          <div style={{fontSize:13,fontWeight:700,color:"var(--apk)",margin:"12px 0 10px"}}>🔬 Résultats biologiques</div>
          <div className="mat-g2">
            <F label="Hémoglobine (g/dL)"><input className="mat-input" placeholder="Ex: 11.5" value={form.hemoglobine} onChange={e=>setForm({...form,hemoglobine:e.target.value})}/></F>
            <F label="Glycémie (g/L)"><input className="mat-input" placeholder="Ex: 0.90" value={form.glycemie} onChange={e=>setForm({...form,glycemie:e.target.value})}/></F>
            <F label="VIH"><select className="mat-select" value={form.vih} onChange={e=>setForm({...form,vih:e.target.value})}><option value="negatif">Négatif</option><option value="positif">Positif</option><option value="non_fait">Non fait</option></select></F>
            <F label="Hépatite B"><select className="mat-select" value={form.hepatite_b} onChange={e=>setForm({...form,hepatite_b:e.target.value})}><option value="negatif">Négatif</option><option value="positif">Positif</option><option value="non_fait">Non fait</option></select></F>
            <F label="Syphilis"><select className="mat-select" value={form.syphilis} onChange={e=>setForm({...form,syphilis:e.target.value})}><option value="negatif">Négatif</option><option value="positif">Positif</option><option value="non_fait">Non fait</option></select></F>
            <F label="Protéinurie"><select className="mat-select" value={form.proteinurie} onChange={e=>setForm({...form,proteinurie:e.target.value})}><option value="negative">Négative</option><option value="trace">Trace</option><option value="+">+</option><option value="++">++</option><option value="+++">+++</option></select></F>
          </div>
          <div style={{fontSize:13,fontWeight:700,color:"var(--apk)",margin:"12px 0 10px"}}>💊 Recommandations</div>
          <F label="Conseils médicaux"><textarea className="mat-input" rows={2} value={form.conseils} onChange={e=>setForm({...form,conseils:e.target.value})} style={{resize:"vertical"}}/></F>
          <F label="Vitamines / Médicaments prescrits"><input className="mat-input" placeholder="Ex: Acide folique, Fer, Vitamine D..." value={form.vitamines} onChange={e=>setForm({...form,vitamines:e.target.value})}/></F>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
            <button className="mbtn mbtn-ghost" onClick={onClose}>Annuler</button>
            <button className="mbtn mbtn-pink" onClick={handleSubmit} disabled={saving}>{saving?"⏳ Enregistrement...":"💾 Enregistrer CPN"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL Accouchement ──────────────────────────────────────
function ModalAccouchement({ grossesse, patienteNom, onClose, saving }) {
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    date_heure:"", type_accouchement:"voie_basse", obstetricien:"Dr. Koffi",
    sage_femme:"", complications:[], notes:"",
    bebe_prenom:"", bebe_sexe:"F", poids:"", taille:"", apgar_1:"", apgar_5:""
  });

  const handleSubmit = async () => {
    if (!form.date_heure) { toast.error("Renseignez la date d'accouchement"); return; }
    const accBody = {
      grossesse_id: grossesse?._id,
      date_heure: form.date_heure,
      type_accouchement: form.type_accouchement,
      obstetricien: form.obstetricien,
      sage_femme: form.sage_femme,
      complications: form.complications,
      notes: form.notes,
    };
    const result = await dispatch(createAccouchement(accBody));
    if (!createAccouchement.fulfilled.match(result)) {
      toast.error(result.payload || "Erreur déclaration accouchement");
      return;
    }
    const accId = result.payload._id;
    if (form.poids || form.taille || form.apgar_1) {
      const nbBody = {
        grossesse_id: grossesse?._id,
        accouchement_id: accId,
        mere_nom: patienteNom,
        prenom: form.bebe_prenom || `Bébé ${patienteNom?.split(" ").pop() || ""}`,
        sexe: form.bebe_sexe,
        poids: form.poids ? Number(form.poids) * 1000 : undefined,
        taille: form.taille ? Number(form.taille) : undefined,
        apgar_1: form.apgar_1 ? Number(form.apgar_1) : undefined,
        apgar_5: form.apgar_5 ? Number(form.apgar_5) : undefined,
      };
      await dispatch(createNouveauNe(nbBody));
    }
    toast.success(`🍼 Accouchement déclaré pour ${patienteNom}`);
    onClose();
  };

  return (
    <div className="mat-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="mat-modal nice-scroll">
        <div className="mat-modal-hdr">
          <h2>🍼 Déclaration d'accouchement — {patienteNom}</h2>
          <button className="mbtn mbtn-ghost mbtn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="mat-modal-body">
          <div style={{fontSize:13,fontWeight:700,color:"var(--apk)",marginBottom:10}}>📅 Informations accouchement</div>
          <div className="mat-field">
            <label className="mat-label">Date & Heure *</label>
            <input className="mat-input" type="datetime-local" value={form.date_heure} onChange={e=>setForm({...form,date_heure:e.target.value})}/>
          </div>
          <div className="mat-field"><label className="mat-label">Type d'accouchement</label>
            <select className="mat-select" value={form.type_accouchement} onChange={e=>setForm({...form,type_accouchement:e.target.value})}>
              {[["voie_basse","Voie basse"],["cesarienne","Césarienne"],["forceps","Forceps"],["ventouse","Ventouse"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="mat-g2">
            <div className="mat-field"><label className="mat-label">Obstétricien</label><select className="mat-select" value={form.obstetricien} onChange={e=>setForm({...form,obstetricien:e.target.value})}><option>Dr. Koffi</option><option>Dr. Bello</option></select></div>
            <div className="mat-field"><label className="mat-label">Sage-femme</label><input className="mat-input" value={form.sage_femme} onChange={e=>setForm({...form,sage_femme:e.target.value})}/></div>
          </div>
          <div className="mat-field">
            <label className="mat-label">Notes / Complications</label>
            <textarea className="mat-input" rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={{resize:"vertical"}}/>
          </div>
          <div style={{fontSize:13,fontWeight:700,color:"var(--apk)",margin:"12px 0 10px"}}>👶 Informations nouveau-né</div>
          <div className="mat-g2">
            <div className="mat-field"><label className="mat-label">Prénom du bébé</label><input className="mat-input" placeholder="Bébé..." value={form.bebe_prenom} onChange={e=>setForm({...form,bebe_prenom:e.target.value})}/></div>
            <div className="mat-field"><label className="mat-label">Sexe</label><select className="mat-select" value={form.bebe_sexe} onChange={e=>setForm({...form,bebe_sexe:e.target.value})}><option value="F">Fille</option><option value="M">Garçon</option></select></div>
            <div className="mat-field"><label className="mat-label">Poids (kg)</label><input className="mat-input" placeholder="Ex: 3.2" value={form.poids} onChange={e=>setForm({...form,poids:e.target.value})}/></div>
            <div className="mat-field"><label className="mat-label">Taille (cm)</label><input className="mat-input" placeholder="Ex: 49" value={form.taille} onChange={e=>setForm({...form,taille:e.target.value})}/></div>
            <div className="mat-field"><label className="mat-label">APGAR 1 min</label><input className="mat-input" placeholder="Ex: 8" value={form.apgar_1} onChange={e=>setForm({...form,apgar_1:e.target.value})}/></div>
            <div className="mat-field"><label className="mat-label">APGAR 5 min</label><input className="mat-input" placeholder="Ex: 9" value={form.apgar_5} onChange={e=>setForm({...form,apgar_5:e.target.value})}/></div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
            <button className="mbtn mbtn-ghost" onClick={onClose}>Annuler</button>
            <button className="mbtn mbtn-pink" onClick={handleSubmit} disabled={saving}>{saving?"⏳ Enregistrement...":"🍼 Enregistrer l'accouchement"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────
function KpiCard({ color, icon, value, label, sub, urgent }) {
  return (
    <div className={`mat-kpi ${color} fu`}>
      {urgent && <div className="mkpi-dot"/>}
      <div className={`mkpi-icon ${color}`}>{icon}</div>
      <div className="mkpi-val">{value ?? "—"}</div>
      <div className="mkpi-lbl">{label}</div>
      {sub && <div className="mkpi-sub">{sub}</div>}
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────
export default function Maternite() {
  const dispatch = useDispatch();
  const stats        = useSelector(selectMaterniteStats);
  const grossesses   = useSelector(selectGrossesses);
  const grossesseTotal = useSelector(state => state.maternite.grossesseTotal);
  const accouchements = useSelector(selectAccouchements);
  const nouveauNes   = useSelector(selectNouveauNes);
  const loading      = useSelector(selectMaterniteLoading);
  const saving       = useSelector(selectMaterniteSaving);
  const filters      = useSelector(selectMaterniteFilters);

  const [tab, setTab] = useState("dashboard");
  const [isMobile, setIsMobile] = useState(false);
  const [modal, setModal] = useState(null);
  const [selectedGrossesse, setSelectedGrossesse] = useState(null);
  const [grossesseDossier, setGrossesseDossier] = useState(null);
  const [filterRisque, setFilterRisque] = useState("tous");
  const [searchQ, setSearchQ] = useState("");
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 767);
    fn();
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // Chargement initial des données
  useEffect(() => {
    dispatch(fetchMaterniteStats());
    dispatch(fetchGrossesses({ q: filters.q, statut: filters.statut }));
    dispatch(fetchAccouchements());
    dispatch(fetchNouveauxNes());
  }, [dispatch]);

  const handleRefresh = () => {
    dispatch(fetchMaterniteStats());
    dispatch(fetchGrossesses({ q: searchQ, statut: filterRisque !== "tous" ? filterRisque : "" }));
    dispatch(fetchAccouchements());
    dispatch(fetchNouveauxNes());
    setLastUpdate(new Date());
    toast.success("🔄 Données actualisées");
  };

  const openModal = (type, grossesse=null) => {
    setSelectedGrossesse(grossesse);
    setModal(type);
  };
  const closeModal = () => { setModal(null); setSelectedGrossesse(null); };
  const openDossier = (g) => { setGrossesseDossier(g); setTab("dossier"); };

  // Filtrage local (côté client) sur les grossesses déjà chargées
  const grossessesFiltrees = grossesses.filter(p => {
    const matchRisque = filterRisque === "tous" || p.niveau_risque === filterRisque || p.statut === filterRisque;
    const nomComplet = `${p.patient_prenom || ""} ${p.patient_nom || ""}`.toLowerCase();
    const matchSearch = !searchQ || nomComplet.includes(searchQ.toLowerCase()) || (p.numero||"").includes(searchQ);
    return matchRisque && matchSearch;
  });

  // Grossesses en salle de travail
  const enTravail = grossesses.filter(g => g.salle_travail?.en_travail);

  // Grossesses à risque
  const aRisque = grossesses.filter(g => g.statut === "a_risque" || g.niveau_risque === "eleve" || g.niveau_risque === "modere");

  const TABS = [
    { key:"dashboard",    label:"Tableau de bord", labelM:"Bord",    icon:"📊" },
    { key:"patientes",    label:"Femmes enceintes", labelM:"Enceintes",icon:"🤰" },
    { key:"cpn",          label:"Consultations CPN",labelM:"CPN",     icon:"🩺" },
    { key:"echographies", label:"Échographies",     labelM:"Écho.",   icon:"🔍" },
    { key:"risques",      label:"Grossesses à risque",labelM:"Risques",icon:"⚠️" },
    { key:"travail",      label:"Salle de travail",  labelM:"Travail", icon:"🏥" },
    { key:"accouchements",label:"Accouchements",     labelM:"Accouche.",icon:"🍼" },
    { key:"nouveau_nes",  label:"Nouveau-nés",       labelM:"Bébés",   icon:"👶" },
    { key:"postnatal",    label:"Suivi postnatal",   labelM:"Postnatal",icon:"💊" },
    { key:"dossier", icon:"📂", label: grossesseDossier ? `Dossier — ${grossesseDossier.patient_prenom||""} ${grossesseDossier.patient_nom||""}` : "Dossier patiente", labelM:"Dossier", disabled: !grossesseDossier },
  ].filter(t => !t.disabled);

  return (
    <>
      <style>{CSS}</style>
      <div className="mat">

        {/* ── TOPBAR ── */}
        <div className="mat-top">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap",position:"relative",zIndex:2}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:54,height:54,borderRadius:14,background:"rgba(255,255,255,.12)",border:"1.5px solid rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>🤱</div>
              <div>
                <div style={{fontSize:isMobile?17:21,fontWeight:700,color:"#fff",letterSpacing:-.3}}>Maternité</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.55)",marginTop:2}}>
                  Mis à jour : {lastUpdate.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})} · Clinique Canadienne de Souanké
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button className="mbtn mbtn-ghost" style={{color:"#fff",borderColor:"rgba(255,255,255,.3)",fontSize:12}} onClick={handleRefresh}>
                🔄 Actualiser
              </button>
              <button className="mbtn mbtn-pink" style={{fontSize:12}} onClick={()=>openModal("dossier")}>
                ➕ Nouveau dossier
              </button>
            </div>
          </div>

          {/* Tabs */}
          {isMobile ? (
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"4px",padding:"8px 10px",marginTop:"8px",background:"rgba(255,255,255,.07)",borderRadius:"10px 10px 0 0"}}>
              {TABS.slice(0,9).map(t=>(
                <button key={t.key} className={`mat-tab ${tab===t.key?"active":""}`}
                  style={{flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"7px 3px 8px",fontSize:"9.5px",gap:"3px",borderRadius:"8px",whiteSpace:"normal",minWidth:0}}
                  onClick={()=>setTab(t.key)}>
                  <span style={{fontSize:14}}>{t.icon}</span>
                  <span style={{lineHeight:1.2}}>{t.labelM}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mat-tabs">
              {TABS.map(t=>(
                <button key={t.key} className={`mat-tab ${tab===t.key?"active":""}`} onClick={()=>setTab(t.key)}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── CONTENT ── */}
        <div style={{padding:isMobile?12:24}}>

          {/* ══════ TABLEAU DE BORD ══════ */}
          {tab==="dashboard" && (
            <div>
              {/* KPIs principaux */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:14,marginBottom:24}}>
                <KpiCard color="pink"   icon="🤰" value={stats?.totalGrossesses ?? grossesses.length}       label="Femmes enceintes"      sub="En suivi actif" />
                <KpiCard color="teal"   icon="🩺" value={stats?.cpnAujourdhui ?? "—"}                       label="CPN aujourd'hui"       sub="Consultations prév." />
                <KpiCard color="green"  icon="🍼" value={stats?.accouchementsAujourdhui ?? accouchements.length} label="Accouchements du mois" sub="Ce mois" />
                <KpiCard color="purple" icon="🏥" value={stats?.cesariennes ?? "—"}                         label="Césariennes réalisées" sub="Cette année" />
                <KpiCard color="blue"   icon="👶" value={stats?.nouveaunes ?? nouveauNes.length}             label="Nouveau-nés"           sub="Enregistrés" />
                <KpiCard color="red"    icon="⚠️" value={stats?.aRisque ?? aRisque.length}                   label="Grossesses à risque"   sub="Surveillance active" urgent />
              </div>

              {/* Activité du jour + Admissions en cours */}
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:20,marginBottom:20}}>

                {/* Salle de travail résumé */}
                <div className="mat-card fu">
                  <div className="mat-card-hdr">
                    <h3>🏥 Salle de travail — En cours</h3>
                    <Badge cls="pink">{enTravail.length} patiente{enTravail.length!==1?"s":""}</Badge>
                  </div>
                  <div style={{padding:16,display:"flex",flexDirection:"column",gap:14}}>
                    {enTravail.length === 0 && (
                      <div style={{textAlign:"center",color:"var(--am)",fontSize:13,padding:"20px 0"}}>Aucune patiente en salle de travail</div>
                    )}
                    {enTravail.map((p,i)=>(
                      <div key={i} style={{background:"#FDF8FD",borderRadius:14,padding:14,border:"1.5px solid #F9A8D4"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                          <div>
                            <div style={{fontSize:14,fontWeight:700,color:"var(--an)"}}>{p.patient_prenom} {p.patient_nom}</div>
                            <div style={{fontSize:11,color:"var(--am)"}}>Entrée : {fmtDate(p.salle_travail?.date_admission)}</div>
                          </div>
                          <Badge cls="red">En travail</Badge>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                          {[
                            ["Dilatation",`${p.salle_travail?.dilatation ?? "—"} cm`,"var(--apk)"],
                            ["RCF",`${p.salle_travail?.rcf ?? "—"} bpm`,"var(--ag)"]
                          ].map(([lbl,val,col])=>(
                            <div key={lbl} className="mini-kpi" style={{textAlign:"center"}}>
                              <div className="mini-kpi-val" style={{color:col,fontSize:16}}>{val}</div>
                              <div className="mini-kpi-lbl" style={{fontSize:10}}>{lbl}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rendez-vous à venir */}
                <div className="mat-card fu">
                  <div className="mat-card-hdr">
                    <h3>⚠️ Grossesses à risque</h3>
                    <Badge cls="red">{aRisque.filter(r=>r.niveau_risque==="eleve").length} critiques</Badge>
                  </div>
                  <div style={{padding:16,display:"flex",flexDirection:"column",gap:10}}>
                    {aRisque.length === 0 && (
                      <div style={{textAlign:"center",color:"var(--am)",fontSize:13,padding:"20px 0"}}>Aucune grossesse à risque</div>
                    )}
                    {aRisque.slice(0,4).map((r,i)=>(
                      <div key={i} className={r.niveau_risque==="eleve"?"al-danger":"al-warn"}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                          <div>
                            <div style={{fontSize:14,fontWeight:700,color:"var(--an)"}}>{r.patient_prenom} {r.patient_nom}</div>
                            <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                              {(r.facteurs_risque||[]).slice(0,3).map(f=><Badge key={f} cls={r.niveau_risque==="eleve"?"red":"orange"}>{f}</Badge>)}
                            </div>
                            <div style={{fontSize:11,color:"var(--am)",marginTop:4}}>DPA : {fmtDate(r.dpa)}</div>
                          </div>
                          <button className="mbtn mbtn-pink mbtn-sm" onClick={()=>openModal("cpn",r)}>Consulter</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Statistiques rapides */}
              <div className="mat-card fu">
                <div className="mat-card-hdr"><h3>📈 Statistiques du mois</h3></div>
                <div style={{padding:20,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:16}}>
                  {[
                    {lbl:"Taux de césariennes",val:stats?.cesariennes && accouchements.length ? Math.round(accouchements.filter(a=>a.type_accouchement==="cesarienne").length/Math.max(accouchements.length,1)*100) : 0,unit:"%",col:"var(--ap)"},
                    {lbl:"Accouchements normaux",val:stats?.cesariennes && accouchements.length ? Math.round(accouchements.filter(a=>a.type_accouchement==="voie_basse").length/Math.max(accouchements.length,1)*100) : 0,unit:"%",col:"var(--ag)"},
                    {lbl:"Grossesses actives",val: grossesses.length > 0 ? Math.round(grossesses.filter(g=>g.statut==="active").length/Math.max(grossesses.length,1)*100) : 0,unit:"%",col:"var(--apk)"},
                    {lbl:"Grossesses à terme (≥37 SA)",val: grossesses.length > 0 ? Math.round(grossesses.filter(g=> g.ddr && Math.floor((Date.now()-new Date(g.ddr))/(7*86400000))>=37).length/Math.max(grossesses.length,1)*100) : 0,unit:"%",col:"var(--at)"},
                  ].map(s=>(
                    <div key={s.lbl}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                        <span style={{fontSize:12,fontWeight:600,color:"var(--am)"}}>{s.lbl}</span>
                        <span style={{fontSize:15,fontWeight:800,color:s.col}}>{s.val}{s.unit}</span>
                      </div>
                      <Prog pct={s.val} color={s.col} h={8}/>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════ FEMMES ENCEINTES ══════ */}
          {tab==="patientes" && (
            <div>
              <div className="filter-bar">
                <input className="mat-input" style={{width:220,padding:"8px 14px"}} placeholder="🔍 Rechercher patiente, dossier..." value={searchQ} onChange={e=>setSearchQ(e.target.value)}/>
                {[["tous","Toutes"],["faible","✅ Faible"],["modere","⚠️ Modéré"],["eleve","🔴 Élevé"]].map(([val,lbl])=>(
                  <button key={val} className={`filter-btn ${filterRisque===val?"active":""}`} onClick={()=>setFilterRisque(val)}>{lbl}</button>
                ))}
                <button className="mbtn mbtn-pink mbtn-sm" onClick={()=>openModal("dossier")} style={{marginLeft:"auto"}}>➕ Nouveau dossier</button>
              </div>

              <div className="mat-card fu">
                <div className="mat-card-hdr">
                  <div><h3>🤰 Liste des femmes enceintes</h3><p>{grossessesFiltrees.length} patiente{grossessesFiltrees.length!==1?"s":""} affichée{grossessesFiltrees.length!==1?"s":""}</p></div>
                </div>
                {loading ? (
                  <div style={{textAlign:"center",padding:"40px",color:"var(--am)"}}>⏳ Chargement...</div>
                ) : (
                  <div style={{overflowX:"auto"}}>
                    <table className="mat-tbl">
                      <thead>
                        <tr>
                          <th>N° Dossier</th><th>Nom & Prénom</th><th>Téléphone</th>
                          <th>DPA</th><th>Âge gestationnel</th><th>Médecin</th><th>Risque</th><th>Statut</th><th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grossessesFiltrees.length === 0 ? (
                          <tr><td colSpan={9} style={{textAlign:"center",color:"var(--am)",padding:24}}>Aucun dossier trouvé</td></tr>
                        ) : grossessesFiltrees.map(p=>(
                          <tr key={p._id}>
                            <td><span style={{fontWeight:700,color:"var(--apk)"}}>{p.numero||p._id?.slice(-6)}</span></td>
                            <td><div style={{fontWeight:600,color:"var(--an)"}}>{p.patient_prenom} {p.patient_nom}</div></td>
                            <td style={{fontSize:12}}>{p.telephone||"—"}</td>
                            <td style={{fontWeight:600,color:"var(--ab)"}}>{fmtDate(p.dpa)}</td>
                            <td><Badge cls="purple">{agSemaines(p.ddr)}</Badge></td>
                            <td style={{fontSize:12,color:"var(--am)"}}>{p.medecin_responsable||"—"}</td>
                            <td><Badge cls={risqueBadge(p.niveau_risque)}>{risqueLabel(p.niveau_risque)}</Badge></td>
                            <td><Badge cls={statutBadge(p.statut)}>{statutLabel(p.statut)}</Badge></td>
                            <td>
                              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                                <button className="mbtn mbtn-ghost mbtn-sm" onClick={()=>openDossier(p)}>📂 Ouvrir</button>
                                <button className="mbtn mbtn-ghost mbtn-sm" onClick={()=>openModal("cpn",p)}>🩺 CPN</button>
                                <button className="mbtn mbtn-pink mbtn-sm" onClick={()=>openModal("accouchement",p)}>🍼 Accoucher</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════ CONSULTATIONS CPN ══════ */}
          {tab==="cpn" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
                <div className="sec-label">🩺 Consultations Prénatales</div>
                <button className="mbtn mbtn-pink" onClick={()=>openModal("cpn", grossesses[0] || null)}>➕ Nouvelle CPN</button>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:14,marginBottom:20}}>
                <KpiCard color="pink"  icon="🩺" value={stats?.cpnAujourdhui ?? "—"} label="CPN aujourd'hui" sub="Consultations prév." />
                <KpiCard color="teal"  icon="📋" value={grossesses.reduce((s,g)=>s+(g.cpns?.length||0),0)} label="CPN total" sub="Toutes grossesses" />
                <KpiCard color="green" icon="✅" value={grossesses.filter(g=>(g.cpns?.length||0)>=4).length} label="CPN complètes" sub="≥ 4 consultations" />
                <KpiCard color="orange"icon="⏰" value={grossesses.filter(g=>(g.cpns?.length||0)===0).length} label="Aucune CPN" sub="Sans consultation" urgent />
              </div>

              <div className="mat-card fu">
                <div className="mat-card-hdr"><h3>📋 CPN par dossier</h3><button className="mbtn mbtn-ghost mbtn-sm" onClick={()=>toast.success("📊 Export Excel")}>📊 Exporter</button></div>
                <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
                  {loading && <div style={{textAlign:"center",color:"var(--am)"}}>⏳ Chargement...</div>}
                  {grossesses.filter(g=>(g.cpns?.length||0)>0).slice(0,10).map((g,i)=>(
                    g.cpns.slice(-1).map((cpn,j)=>(
                      <div key={`${i}-${j}`} style={{background:"#F8FAFD",borderRadius:14,padding:14,border:"1.5px solid var(--abr)"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
                          <div>
                            <div style={{fontSize:14,fontWeight:700,color:"var(--an)"}}>{g.patient_prenom} {g.patient_nom} — <span style={{color:"var(--apk)"}}>CPN n°{g.cpns.length}</span></div>
                            <div style={{fontSize:11,color:"var(--am)"}}>{fmtDate(cpn.date)} · {cpn.medecin||g.medecin_responsable||"—"}</div>
                          </div>
                          <Badge cls="green">Enregistrée</Badge>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8}}>
                          {[
                            ["TA",cpn.tension_sys&&cpn.tension_dia?`${cpn.tension_sys}/${cpn.tension_dia}`:"—"],
                            ["Poids",cpn.poids?`${cpn.poids}kg`:"—"],
                            ["HU",cpn.hauteur_uterine?`${cpn.hauteur_uterine}cm`:"—"],
                            ["BCF",cpn.bcf?`${cpn.bcf} bpm`:"—"],
                            ["Hb",cpn.hemoglobine?`${cpn.hemoglobine} g/dL`:"—"],
                            ["VIH",cpn.vih||"—"]
                          ].map(([k,v])=>(
                            <div key={k} className="mini-kpi">
                              <div className="mini-kpi-lbl">{k}</div>
                              <div className="mini-kpi-val" style={{fontSize:14,color:v==="negatif"||v==="Négatif"?"var(--ag)":v==="positif"||v==="Positif"?"var(--ar)":"var(--an)"}}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ))}
                  {grossesses.filter(g=>(g.cpns?.length||0)>0).length===0 && (
                    <div style={{textAlign:"center",color:"var(--am)",padding:"24px 0"}}>Aucune CPN enregistrée</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════ ÉCHOGRAPHIES ══════ */}
          {tab==="echographies" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
                <div className="sec-label">🔍 Suivi échographique</div>
              </div>
              {loading && <div style={{textAlign:"center",color:"var(--am)",padding:24}}>⏳ Chargement...</div>}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
                {grossesses.filter(g=>(g.echographies?.length||0)>0).flatMap(g=>
                  g.echographies.map((e,i)=>({...e,patiente:`${g.patient_prenom} ${g.patient_nom}`,grossesse_id:g._id}))
                ).slice(0,12).map((e,i)=>(
                  <div key={i} className="mat-card fu">
                    <div className="mat-card-hdr">
                      <div>
                        <h3>🔍 {e.type||"Échographie"}</h3>
                        <p>{e.patiente} · {fmtDate(e.date)}</p>
                      </div>
                      <Badge cls={e.validee?"green":"orange"}>{e.validee?"Validée":"En attente"}</Badge>
                    </div>
                    <div style={{padding:16}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                        {[
                          ["Trimestre",e.trimestre?`${e.trimestre}ème`:"—"],
                          ["Sexe",e.sexe==="masculin"?"👦 Garçon":e.sexe==="feminin"?"👧 Fille":"Non déterminé"],
                          ["Poids estimé",e.poids_estime?`${e.poids_estime}g`:"—"],
                          ["Terme",e.terme?`${e.terme} SA`:"—"]
                        ].map(([k,v])=>(
                          <div key={k} className="mini-kpi">
                            <div className="mini-kpi-lbl">{k}</div>
                            <div className="mini-kpi-val" style={{fontSize:14}}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {e.observations && <p style={{fontSize:12,color:"var(--am)",margin:"0 0 12px"}}>{e.observations}</p>}
                      <div style={{background:"#F8FAFD",border:"2px dashed var(--abr)",borderRadius:12,padding:"20px",textAlign:"center",marginBottom:12}}>
                        <div style={{fontSize:32,marginBottom:6}}>🖼</div>
                        <div style={{fontSize:12,color:"var(--am)"}}>Image échographique</div>
                        <button className="mbtn mbtn-ghost mbtn-sm" style={{marginTop:8}} onClick={()=>toast.success("📎 Image jointe")}>📎 Joindre image</button>
                      </div>
                    </div>
                  </div>
                ))}
                {grossesses.filter(g=>(g.echographies?.length||0)>0).length===0 && !loading && (
                  <div style={{gridColumn:"1/-1",textAlign:"center",color:"var(--am)",padding:"40px 0"}}>Aucune échographie enregistrée</div>
                )}
              </div>
            </div>
          )}

          {/* ══════ GROSSESSES À RISQUE ══════ */}
          {tab==="risques" && (
            <div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:14,marginBottom:20}}>
                <KpiCard color="red"    icon="🔴" value={grossesses.filter(g=>g.niveau_risque==="eleve").length} label="Risque élevé"  sub="Surveillance rapprochée" urgent/>
                <KpiCard color="orange" icon="🟠" value={grossesses.filter(g=>g.niveau_risque==="modere").length} label="Risque modéré" sub="Suivi renforcé" />
                <KpiCard color="green"  icon="🟢" value={grossesses.filter(g=>g.niveau_risque==="faible").length} label="Risque faible" sub="Suivi standard" />
              </div>

              {loading && <div style={{textAlign:"center",color:"var(--am)",padding:24}}>⏳ Chargement...</div>}
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                {aRisque.length===0 && !loading && (
                  <div style={{textAlign:"center",color:"var(--am)",padding:"40px 0"}}>Aucune grossesse à risque enregistrée</div>
                )}
                {aRisque.map((r,i)=>(
                  <div key={r._id} className={`mat-card fu d${Math.min(i+1,6)}`}>
                    <div className="mat-card-hdr">
                      <div>
                        <h3>{r.patient_prenom} {r.patient_nom}</h3>
                        <p>DPA : {fmtDate(r.dpa)} · {r.medecin_responsable||"—"}</p>
                      </div>
                      <Badge cls={risqueBadge(r.niveau_risque)}>Risque {risqueLabel(r.niveau_risque)}</Badge>
                    </div>
                    <div style={{padding:16}}>
                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:12,fontWeight:700,color:"var(--am)",marginBottom:8,textTransform:"uppercase",letterSpacing:.4}}>Facteurs de risque</div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                          {(r.facteurs_risque||[]).map(f=><Badge key={f} cls={r.niveau_risque==="eleve"?"red":"orange"}>{f}</Badge>)}
                          {(r.facteurs_risque||[]).length===0 && <span style={{fontSize:12,color:"var(--am)"}}>Non renseignés</span>}
                        </div>
                      </div>
                      <div style={{marginBottom:14}}>
                        <div style={{fontSize:12,fontWeight:700,color:"var(--am)",marginBottom:6}}>Niveau de risque</div>
                        <div className="risk-bar">
                          <div className="risk-seg" style={{background:"var(--ag)"}}/>
                          <div className="risk-seg" style={{background:r.niveau_risque==="modere"||r.niveau_risque==="eleve"?"var(--ao)":"#E5E7EB"}}/>
                          <div className="risk-seg" style={{background:r.niveau_risque==="eleve"?"var(--ar)":"#E5E7EB"}}/>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--am)",marginTop:4}}>
                          <span>Faible</span><span>Modéré</span><span>Élevé</span>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        <button className="mbtn mbtn-pink mbtn-sm" onClick={()=>openModal("cpn",r)}>🩺 Consulter</button>
                        <button className="mbtn mbtn-ghost mbtn-sm" onClick={()=>toast.success("📅 RDV urgent programmé")}>📅 RDV urgent</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════ SALLE DE TRAVAIL ══════ */}
          {tab==="travail" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
                <div className="sec-label">🏥 Salle de travail</div>
                <button className="mbtn mbtn-pink" onClick={()=>toast.success("➕ Admission en salle de travail")}>➕ Admettre patiente</button>
              </div>

              {enTravail.length===0 && !loading && (
                <div style={{textAlign:"center",color:"var(--am)",padding:"60px 0",fontSize:14}}>Aucune patiente en salle de travail actuellement</div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                {enTravail.map((p,i)=>(
                  <div key={p._id} className="mat-card fu">
                    <div className="mat-card-hdr">
                      <div>
                        <h3>🏥 {p.patient_prenom} {p.patient_nom}</h3>
                        <p>Admission : {fmtDate(p.salle_travail?.date_admission)} · Membranes : {p.salle_travail?.rupture_membranes?"Rompues":"Intactes"}</p>
                      </div>
                      <Badge cls="red">En travail</Badge>
                    </div>
                    <div style={{padding:16}}>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:16}}>
                        {[
                          ["💉 Dilatation",`${p.salle_travail?.dilatation ?? "—"} cm`,"var(--apk)"],
                          ["💓 Contractions",p.salle_travail?.frequence_contractions?`${p.salle_travail.frequence_contractions}/10min`:"—","var(--ab)"],
                          ["👶 RCF",`${p.salle_travail?.rcf ?? "—"} bpm`,"var(--ag)"],
                          ["💧 Membranes",p.salle_travail?.rupture_membranes?"Rompues":"Intactes",p.salle_travail?.rupture_membranes?"var(--ar)":"var(--ag)"]
                        ].map(([lbl,val,col])=>(
                          <div key={lbl} className="mini-kpi">
                            <div className="mini-kpi-lbl">{lbl}</div>
                            <div className="mini-kpi-val" style={{color:col,fontSize:16}}>{val}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        <button className="mbtn mbtn-pink mbtn-sm" onClick={()=>openModal("accouchement",p)}>🍼 Déclarer accouchement</button>
                        <button className="mbtn mbtn-ghost mbtn-sm" onClick={()=>toast.success("📊 Partogramme mis à jour")}>📊 Mise à jour</button>
                        <button className="mbtn mbtn-danger mbtn-sm" onClick={()=>toast.error("🚨 Alerte urgence déclenchée")}>🚨 Urgence</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════ ACCOUCHEMENTS ══════ */}
          {tab==="accouchements" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
                <div className="sec-label">🍼 Gestion des accouchements</div>
                <button className="mbtn mbtn-pink" onClick={()=>openModal("accouchement", grossesses[0]||null)}>➕ Déclarer accouchement</button>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:14,marginBottom:20}}>
                <KpiCard color="pink"   icon="🍼" value={accouchements.length}      label="Total"          sub="Accouchements" />
                <KpiCard color="teal"   icon="✅" value={accouchements.filter(a=>a.type_accouchement==="voie_basse").length} label="Voie basse" sub="Accouchements normaux" />
                <KpiCard color="purple" icon="🏥" value={accouchements.filter(a=>a.type_accouchement==="cesarienne").length} label="Césariennes" />
                <KpiCard color="green"  icon="👶" value={nouveauNes.length}         label="Nouveau-nés"    sub="Enregistrés" />
              </div>

              <div className="mat-card fu">
                <div className="mat-card-hdr">
                  <div><h3>📋 Liste des accouchements</h3><p>{accouchements.length} accouchement{accouchements.length!==1?"s":""}</p></div>
                  <button className="mbtn mbtn-ghost mbtn-sm" onClick={()=>toast.success("📊 Export")}>📊 Exporter</button>
                </div>
                {loading ? (
                  <div style={{textAlign:"center",padding:40,color:"var(--am)"}}>⏳ Chargement...</div>
                ) : (
                  <div style={{overflowX:"auto"}}>
                    <table className="mat-tbl">
                      <thead><tr><th>N°</th><th>Patiente</th><th>Date</th><th>Type</th><th>Médecin</th><th>Actions</th></tr></thead>
                      <tbody>
                        {accouchements.length === 0 ? (
                          <tr><td colSpan={6} style={{textAlign:"center",color:"var(--am)",padding:24}}>Aucun accouchement enregistré</td></tr>
                        ) : accouchements.map(a=>(
                          <tr key={a._id}>
                            <td><span style={{fontWeight:700,color:"var(--apk)"}}>{a.numero||a._id?.slice(-6)}</span></td>
                            <td style={{fontWeight:600,color:"var(--an)"}}>{a.patient_nom||"—"}</td>
                            <td style={{fontSize:12}}>{fmtDate(a.date_heure)}</td>
                            <td>
                              <Badge cls={a.type_accouchement==="voie_basse"?"green":a.type_accouchement==="cesarienne"?"purple":"orange"}>
                                {a.type_accouchement==="voie_basse"?"Voie basse":a.type_accouchement==="cesarienne"?"Césarienne":a.type_accouchement||"—"}
                              </Badge>
                            </td>
                            <td style={{fontSize:12,color:"var(--am)"}}>{a.obstetricien||"—"}</td>
                            <td>
                              <div style={{display:"flex",gap:4}}>
                                <button className="mbtn mbtn-ghost mbtn-sm" onClick={()=>toast.success(`📄 Certificat — ${a.patient_nom}`)}>📄 Certificat</button>
                                <button className="mbtn mbtn-ghost mbtn-sm" onClick={()=>toast.success("🖨 Impression")}>🖨</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════ NOUVEAU-NÉS ══════ */}
          {tab==="nouveau_nes" && (
            <div>
              <div className="sec-label" style={{marginBottom:16}}>👶 Gestion des nouveau-nés</div>
              {loading && <div style={{textAlign:"center",color:"var(--am)",padding:24}}>⏳ Chargement...</div>}
              {nouveauNes.length===0 && !loading && (
                <div style={{textAlign:"center",color:"var(--am)",padding:"60px 0",fontSize:14}}>Aucun nouveau-né enregistré</div>
              )}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))",gap:16}}>
                {nouveauNes.map((n,i)=>(
                  <div key={n._id} className="mat-card fu">
                    <div className="mat-card-hdr">
                      <div>
                        <h3>{n.sexe==="F"?"👧":"👦"} {n.prenom||n.nom||"Bébé"}</h3>
                        <p>Né le {fmtDate(n.date_naissance)} · {n.numero}</p>
                      </div>
                      <Badge cls={n.etat==="bon"?"green":n.etat==="surveillance"?"orange":"red"}>{n.etat==="bon"?"Sain":n.etat==="surveillance"?"Surveillance":"Critique"}</Badge>
                    </div>
                    <div style={{padding:16}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
                        {[
                          ["Poids",n.poids?`${(n.poids/1000).toFixed(2)}kg`:"—","var(--apk)"],
                          ["Taille",n.taille?`${n.taille}cm`:"—","var(--ab)"],
                          ["APGAR",n.apgar_1&&n.apgar_5?`${n.apgar_1}/${n.apgar_5}`:"—",(n.apgar_1||0)>=9?"var(--ag)":"var(--ao)"]
                        ].map(([k,v,col])=>(
                          <div key={k} className="mini-kpi" style={{textAlign:"center"}}>
                            <div className="mini-kpi-val" style={{color:col,fontSize:16}}>{v}</div>
                            <div className="mini-kpi-lbl">{k}</div>
                          </div>
                        ))}
                      </div>
                      {/* Mère */}
                      <div style={{fontSize:12,color:"var(--am)",marginBottom:10}}>
                        Mère : <span style={{fontWeight:600,color:"var(--an)"}}>{n.mere_nom||"—"}</span>
                      </div>
                      {/* Vaccinations */}
                      <div style={{marginBottom:14}}>
                        <div style={{fontSize:11,fontWeight:700,color:"var(--am)",textTransform:"uppercase",letterSpacing:.4,marginBottom:8}}>Vaccinations</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {(n.vaccinations||[]).length===0 && <Badge cls="gray">Aucune</Badge>}
                          {(n.vaccinations||[]).map((v,j)=>(
                            <Badge key={j} cls="green">✅ {v.vaccin}</Badge>
                          ))}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button className="mbtn mbtn-pink mbtn-sm" style={{flex:1}} onClick={()=>toast.success(`📋 Dossier pédiatrique — ${n.prenom||"Bébé"}`)}>📋 Dossier</button>
                        <button className="mbtn mbtn-ghost mbtn-sm" onClick={()=>toast.success("📄 Certificat de naissance imprimé")}>📄 Certificat</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════ SUIVI POSTNATAL ══════ */}
          {tab==="postnatal" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
                <div className="sec-label">💊 Suivi postnatal</div>
                <button className="mbtn mbtn-pink" onClick={()=>toast.success("➕ Nouvelle consultation post-partum")}>➕ Nouvelle consultation</button>
              </div>

              {/* Grossesses en post-natal */}
              {(() => {
                const postnatales = grossesses.filter(g=>g.statut==="suivi_postnatal"||g.statut==="accouchee");
                return (
                  <>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:14,marginBottom:20}}>
                      <KpiCard color="pink"   icon="💊" value={postnatales.length}            label="En suivi post-partum" />
                      <KpiCard color="teal"   icon="🍼" value={nouveauNes.length}             label="Nouveau-nés suivis" />
                      <KpiCard color="green"  icon="✅" value={postnatales.filter(g=>(g.consultations_postnatales?.length||0)>0).length} label="Consultées" sub="Au moins 1 visite" />
                      <KpiCard color="orange" icon="⏰" value={postnatales.filter(g=>(g.consultations_postnatales?.length||0)===0).length} label="Non consultées" sub="Relance nécessaire" urgent={postnatales.filter(g=>(g.consultations_postnatales?.length||0)===0).length>0}/>
                    </div>

                    {postnatales.length===0 && !loading && (
                      <div style={{textAlign:"center",color:"var(--am)",padding:"40px 0",fontSize:14}}>Aucune patiente en suivi postnatal</div>
                    )}

                    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:20,marginBottom:20}}>
                      <div className="mat-card fu">
                        <div className="mat-card-hdr"><h3>👩 Suivi mère — Post-partum</h3></div>
                        <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
                          {postnatales.slice(0,5).map((m,i)=>{
                            const dernier = m.consultations_postnatales?.slice(-1)[0];
                            return (
                              <div key={i} style={{background:"#F8FAFD",borderRadius:12,padding:12,border:"1.5px solid var(--abr)"}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                                  <div style={{fontWeight:700,fontSize:13,color:"var(--an)"}}>{m.patient_prenom} {m.patient_nom}</div>
                                  <Badge cls={dernier?"green":"orange"}>{dernier?"Consultée":"À consulter"}</Badge>
                                </div>
                                {dernier && (
                                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                                    {[["Cicatrisation",dernier.cicatrisation||"—"],["Allaitement",dernier.allaitement?"Oui":"Non"]].map(([k,v])=>(
                                      <div key={k} className="mini-kpi">
                                        <div className="mini-kpi-lbl">{k}</div>
                                        <div className="mini-kpi-val" style={{fontSize:13,color:"var(--an)"}}>{v}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div style={{display:"flex",gap:6,marginTop:10}}>
                                  <button className="mbtn mbtn-ghost mbtn-sm" onClick={()=>toast.success(`📋 Dossier post-partum — ${m.patient_nom}`)}>Dossier</button>
                                  <button className="mbtn mbtn-pink mbtn-sm" onClick={()=>toast.success("💉 Contraception enregistrée")}>Contraception</button>
                                </div>
                              </div>
                            );
                          })}
                          {postnatales.length===0 && <div style={{textAlign:"center",color:"var(--am)",padding:"20px 0"}}>Aucune patiente</div>}
                        </div>
                      </div>

                      <div className="mat-card fu">
                        <div className="mat-card-hdr"><h3>👶 Suivi nourrissons</h3></div>
                        <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
                          {nouveauNes.slice(0,5).map((b,i)=>(
                            <div key={i} style={{background:"#F8FAFD",borderRadius:12,padding:12,border:"1.5px solid var(--abr)"}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                                <div style={{fontWeight:700,fontSize:13,color:"var(--an)"}}>{b.prenom||"Bébé"} · {b.date_naissance?`J${Math.floor((Date.now()-new Date(b.date_naissance))/86400000)}`:"—"}</div>
                                <Badge cls={b.etat==="bon"?"green":"orange"}>{b.etat==="bon"?"Normal":"Surveillance"}</Badge>
                              </div>
                              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                                {[["Poids",b.poids?`${(b.poids/1000).toFixed(2)}kg`:"—","var(--apk)"],["APGAR",b.apgar_1?`${b.apgar_1}/${b.apgar_5}pts`:"—","var(--at)"],["Vaccins",`${(b.vaccinations||[]).length}`,"var(--ab)"]].map(([k,v,col])=>(
                                  <div key={k} className="mini-kpi" style={{textAlign:"center"}}>
                                    <div className="mini-kpi-val" style={{color:col,fontSize:12}}>{v}</div>
                                    <div className="mini-kpi-lbl" style={{fontSize:10}}>{k}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                          {nouveauNes.length===0 && <div style={{textAlign:"center",color:"var(--am)",padding:"20px 0"}}>Aucun nouveau-né</div>}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

              <div className="mat-card fu">
                <div className="mat-card-hdr"><h3>📄 Documents & Rapports</h3></div>
                <div style={{padding:20,display:"flex",gap:12,flexWrap:"wrap"}}>
                  {[
                    {icon:"📗",label:"Carnet prénatal",      fn:()=>toast.success("📗 Carnet prénatal généré")},
                    {icon:"📄",label:"Rapport d'échographie",fn:()=>toast.success("📄 Rapport échographie")},
                    {icon:"🧪",label:"Résultats labo",       fn:()=>toast.success("🧪 Résultats laboratoire")},
                    {icon:"📋",label:"Certificat d'accouchement",fn:()=>toast.success("📋 Certificat d'accouchement")},
                    {icon:"🎂",label:"Certificat de naissance",fn:()=>toast.success("🎂 Certificat de naissance")},
                    {icon:"📧",label:"Envoyer par e-mail",   fn:()=>toast.success("📧 Documents envoyés")},
                  ].map((b,i)=>(
                    <button key={i} className="mbtn mbtn-ghost" onClick={b.fn}>
                      {b.icon} {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════ DOSSIER GROSSESSE ══════ */}
          {tab === "dossier" && grossesseDossier && (
            <div>
              <button className="mbtn mbtn-ghost mbtn-sm" style={{ marginBottom:16 }} onClick={() => { setGrossesseDossier(null); setTab("patientes"); }}>
                ← Retour à la liste
              </button>

              {/* Header grossesse */}
              <div className="mat-card" style={{ marginBottom:16 }}>
                <div className="mat-card-hdr">
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <div style={{ width:54, height:54, borderRadius:14, background:"#FDF2F8", border:"2px solid var(--apk)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>🤰</div>
                    <div>
                      <div style={{ fontSize:17, fontWeight:800, color:"var(--an)" }}>{grossesseDossier.patient_prenom} {grossesseDossier.patient_nom}</div>
                      <div style={{ fontSize:12, color:"var(--am)", marginTop:3 }}>
                        {grossesseDossier.numero||grossesseDossier._id?.slice(-6)} · {agSemaines(grossesseDossier.ddr)} · DPA : {fmtDate(grossesseDossier.dpa)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button className="mbtn mbtn-ghost mbtn-sm" onClick={() => openModal("cpn", grossesseDossier)}>🩺 Nouvelle CPN</button>
                    <button className="mbtn mbtn-pink mbtn-sm" onClick={() => openModal("accouchement", grossesseDossier)}>🍼 Déclarer accouchement</button>
                  </div>
                </div>
                <div style={{ padding:16, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:12 }}>
                  {[
                    ["📞 Téléphone",         grossesseDossier.telephone||"—"],
                    ["🩸 Groupe sanguin",     grossesseDossier.groupe_sanguin||"—"],
                    ["⚕️ Médecin",            grossesseDossier.medecin_responsable||"—"],
                    ["⚠️ Niveau de risque",   risqueLabel(grossesseDossier.niveau_risque)],
                    ["📋 Antécédents",        grossesseDossier.antecedents||"Aucun"],
                    ["💉 Allergies",          grossesseDossier.allergies||"Aucune connue"],
                    ["🔢 Gestité / Parité",   `G${grossesseDossier.gestite||0} / P${grossesseDossier.parite||0}`],
                    ["📊 Statut",             statutLabel(grossesseDossier.statut)],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background:"#F8FAFD", borderRadius:10, padding:"10px 14px", border:"1.5px solid var(--abr)" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"var(--am)", marginBottom:3 }}>{k}</div>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--an)" }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Historique CPN */}
              <div className="mat-card" style={{ marginBottom:16 }}>
                <div className="mat-card-hdr">
                  <div><h3>🩺 Consultations CPN</h3><p>Historique des visites prénatales</p></div>
                  <button className="mbtn mbtn-ghost mbtn-sm" onClick={() => openModal("cpn", grossesseDossier)}>➕ Ajouter</button>
                </div>
                <div style={{ padding:14 }}>
                  {(grossesseDossier.cpns||[]).length === 0 ? (
                    <div style={{ textAlign:"center", color:"var(--am)", padding:"16px 0", fontSize:12 }}>Aucune consultation CPN enregistrée</div>
                  ) : [...(grossesseDossier.cpns||[])].reverse().map((c,i) => (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:12, background:"#F8FAFD", borderRadius:10, padding:"10px 14px", border:"1.5px solid var(--abr)", marginBottom:8 }}>
                      <div><div style={{ fontSize:11, color:"var(--am)", fontWeight:700 }}>Date</div><div style={{ fontSize:12, fontWeight:600, color:"var(--an)" }}>{fmtDate(c.date)}</div></div>
                      <div><div style={{ fontSize:11, color:"var(--am)", fontWeight:700 }}>SA</div><div style={{ fontSize:12, fontWeight:600, color:"var(--ab)" }}>{c.sa||"—"} SA</div></div>
                      <div><div style={{ fontSize:11, color:"var(--am)", fontWeight:700 }}>TA</div><div style={{ fontSize:12, fontWeight:600 }}>{c.ta||"—"}</div></div>
                      <div><div style={{ fontSize:11, color:"var(--am)", fontWeight:700 }}>Poids</div><div style={{ fontSize:12, fontWeight:600 }}>{c.poids?`${c.poids} kg`:"—"}</div></div>
                      <div><div style={{ fontSize:11, color:"var(--am)", fontWeight:700 }}>Médecin</div><div style={{ fontSize:12, color:"var(--am)" }}>{c.medecin||"—"}</div></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Informations médicales */}
              <div className="mat-card">
                <div className="mat-card-hdr"><div><h3>📋 Informations médicales</h3></div></div>
                <div style={{ padding:16, display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:"var(--am)", marginBottom:8 }}>ANTÉCÉDENTS MÉDICAUX</div>
                    <div style={{ fontSize:13, color:"var(--an)", background:"#F8FAFD", borderRadius:10, padding:"12px 14px", border:"1.5px solid var(--abr)", minHeight:60 }}>
                      {grossesseDossier.antecedents_medicaux||grossesseDossier.antecedents||"Aucun antécédent connu"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:"var(--am)", marginBottom:8 }}>ANTÉCÉDENTS OBSTÉTRICAUX</div>
                    <div style={{ fontSize:13, color:"var(--an)", background:"#F8FAFD", borderRadius:10, padding:"12px 14px", border:"1.5px solid var(--abr)", minHeight:60 }}>
                      {grossesseDossier.antecedents_obstetriques||"Aucun antécédent obstétrical"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:"var(--am)", marginBottom:8 }}>TRAITEMENTS EN COURS</div>
                    <div style={{ fontSize:13, color:"var(--an)", background:"#F8FAFD", borderRadius:10, padding:"12px 14px", border:"1.5px solid var(--abr)", minHeight:60 }}>
                      {grossesseDossier.traitements||"Aucun traitement en cours"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:"var(--am)", marginBottom:8 }}>REMARQUES</div>
                    <div style={{ fontSize:13, color:"var(--an)", background:"#F8FAFD", borderRadius:10, padding:"12px 14px", border:"1.5px solid var(--abr)", minHeight:60 }}>
                      {grossesseDossier.remarques||"—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── MODALS ── */}
      {modal==="dossier" && (
        <ModalDossier onClose={closeModal} saving={saving}/>
      )}
      {modal==="cpn" && (
        <ModalCPN
          grossesse={selectedGrossesse}
          patienteNom={selectedGrossesse ? `${selectedGrossesse.patient_prenom||""} ${selectedGrossesse.patient_nom||""}`.trim() : "Patiente"}
          onClose={closeModal}
          saving={saving}
        />
      )}
      {modal==="accouchement" && (
        <ModalAccouchement
          grossesse={selectedGrossesse}
          patienteNom={selectedGrossesse ? `${selectedGrossesse.patient_prenom||""} ${selectedGrossesse.patient_nom||""}`.trim() : "Patiente"}
          onClose={closeModal}
          saving={saving}
        />
      )}
    </>
  );
}
