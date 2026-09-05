import { useState, useEffect, useRef, useId } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  fetchPediatrieStats,
  fetchEnfants,
  fetchConsultations,
  fetchUrgences,
  createEnfant,
  createConsultation,
  addVaccination,
  addMesureCroissance,
  addMaladieChronique,
  setFilters,
  selectPediatrieStats,
  selectRepartitionAge,
  selectTopPatho,
  selectPediatrieChart,
  selectEnfants,
  selectConsultations,
  selectUrgences,
  selectPediatrieLoading,
  selectPediatrieSaving,
} from "../store/slices/pediatrieSlice";
import { Baby, Plus, Printer } from 'lucide-react';
import Hero, { HeroButton } from '../components/UI/Hero';
import Button from '../components/UI/Button';
import api from '../api';

// ─── Chart.js loader ─────────────────────────────────────────
function loadChartJs(cb) {
  if (window.Chart) { cb(); return; }
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
  s.onload = cb;
  document.head.appendChild(s);
}

// ─── CSS Pédiatrie — Vert Émeraude + Bleu Ciel ───────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.ped * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --pn:#0B1E3B; --pn2:#132744;
  --pg:#0EA5A0; --pg2:#0D9490;
  --pb:#1B4F9E; --pb2:#154396;
  --pr:#DC2626; --po:#D97706;
  --pp:#7C3AED; --pk:#EC4899;
  --pyr:#F59E0B;
  --pbr:#E2EAF4; --pm:#6B7A99; --pl:#EEF4FF; --ps:#F8FAFD;
  --sh:0 1px 3px rgba(11,30,59,.08); --shm:0 4px 16px rgba(11,30,59,.10); --shl:0 12px 40px rgba(11,30,59,.14);
}
.ped-top { background:linear-gradient(135deg,var(--pn) 0%,var(--pn2) 55%,#1B4F9E 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.ped-top::before { content:''; position:absolute; top:-60px; right:-60px; width:280px; height:280px; background:radial-gradient(circle,rgba(14,165,160,.22) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
.ped-top::after  { content:''; position:absolute; bottom:-80px; left:25%; width:220px; height:220px; background:radial-gradient(circle,rgba(27,79,158,.15) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
.ped-tabs { display:flex; gap:2px; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.ped-tabs::-webkit-scrollbar { display:none; }
.ped-tab { display:flex; align-items:center; gap:6px; padding:10px 15px 12px; font-size:12px; font-weight:600; color:rgba(255,255,255,.55); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.ped-tab:hover { color:rgba(255,255,255,.88); background:rgba(255,255,255,.08); }
.ped-tab.active { color:var(--pn); background:var(--ps); box-shadow:0 -2px 0 var(--pg) inset; }
.ped-card { background:#fff; border:1.5px solid var(--pbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; }
.ped-card:hover { box-shadow:var(--shm); }
.ped-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--pbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); flex-wrap:wrap; gap:8px; }
.ped-card-hdr h3 { font-size:14px; font-weight:700; color:var(--pn); margin:0; display:flex; align-items:center; gap:8px; }
.ped-card-hdr p  { font-size:11px; color:var(--pm); margin:2px 0 0; }
.ped-kpi { background:#fff; border:1.5px solid var(--pbr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:default; }
.ped-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.ped-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.ped-kpi.green::before  { background:var(--pg); }
.ped-kpi.blue::before   { background:var(--pb); }
.ped-kpi.red::before    { background:var(--pr); }
.ped-kpi.orange::before { background:var(--po); }
.ped-kpi.purple::before { background:var(--pp); }
.ped-kpi.yellow::before { background:var(--pyr); }
.ped-kpi.pink::before   { background:var(--pk); }
.pkpi-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; font-size:20px; }
.pkpi-icon.green  { background:#ECFDF5; } .pkpi-icon.blue   { background:#E0F2FE; }
.pkpi-icon.red    { background:#FEF2F2; } .pkpi-icon.orange { background:#FFF7ED; }
.pkpi-icon.purple { background:#F5F3FF; } .pkpi-icon.yellow { background:#FFFBEB; }
.pkpi-icon.pink   { background:#FDF2F8; }
.pkpi-val { font-size:28px; font-weight:800; color:var(--pn); line-height:1; margin-bottom:4px; letter-spacing:-1.5px; }
.pkpi-lbl { font-size:12px; font-weight:600; color:var(--pm); }
.pkpi-sub { font-size:11px; color:#9CA3AF; margin-top:3px; }
.pkpi-dot { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--pr); animation:pedP 2s infinite; }
@keyframes pedP { 0%,100%{opacity:1} 50%{opacity:.3} }
.pmini { background:#F8FAFD; border:1.5px solid var(--pbr); border-radius:12px; padding:12px 14px; }
.pmini-val { font-size:20px; font-weight:800; color:var(--pn); letter-spacing:-1px; }
.pmini-lbl { font-size:11px; font-weight:600; color:var(--pm); margin-top:2px; }
.ped-prog { background:#EEF4FF; border-radius:99px; overflow:hidden; }
.ped-prog-f { border-radius:99px; transition:width .8s cubic-bezier(.34,1.56,.64,1); }
.pbdg { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.pbdg.green  { background:#ECFDF5; color:var(--pg); border:1px solid #6EE7B7; }
.pbdg.blue   { background:#E0F2FE; color:var(--pb2); border:1px solid #7DD3FC; }
.pbdg.red    { background:#FEF2F2; color:var(--pr); border:1px solid #FECACA; }
.pbdg.orange { background:#FFF7ED; color:var(--po); border:1px solid #FED7AA; }
.pbdg.purple { background:#F5F3FF; color:var(--pp); border:1px solid #DDD6FE; }
.pbdg.yellow { background:#FFFBEB; color:#B45309; border:1px solid #FDE68A; }
.pbdg.pink   { background:#FDF2F8; color:var(--pk); border:1px solid #F9A8D4; }
.pbdg.gray   { background:#F9FAFB; color:#4B5563; border:1px solid #E5E7EB; }
.pbtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; }
.pbtn-green  { background:var(--pg); color:#fff; } .pbtn-green:hover  { background:var(--pg2); transform:translateY(-1px); }
.pbtn-blue   { background:var(--pb); color:#fff; } .pbtn-blue:hover   { background:var(--pb2); transform:translateY(-1px); }
.pbtn-ghost  { background:transparent; color:var(--pm); border:1.5px solid var(--pbr); }
.pbtn-ghost:hover { background:var(--pl); color:var(--pn); }
.pbtn-danger { background:var(--pr); color:#fff; } .pbtn-danger:hover { background:#B91C1C; transform:translateY(-1px); }
.pbtn-sm { padding:6px 13px; font-size:12px; }
.ped-tbl { width:100%; border-collapse:collapse; }
.ped-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.ped-tbl th { padding:10px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--pm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--pbr); white-space:nowrap; }
.ped-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #EEF4FF; vertical-align:middle; }
.ped-tbl tbody tr:last-child td { border-bottom:none; }
.ped-tbl tbody tr:hover { background:#F8FAFD; }
.al-danger { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--pr); border-radius:14px; padding:14px 18px; }
.al-warn   { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--po); border-radius:14px; padding:14px 18px; }
.al-green  { background:linear-gradient(135deg,#F0FDFC,#CCFBF1); border:1.5px solid #99F6E4; border-left:4px solid var(--pg); border-radius:14px; padding:14px 18px; }
.al-blue   { background:linear-gradient(135deg,#EEF4FF,#DBEAFE); border:1.5px solid #93C5FD; border-left:4px solid var(--pb); border-radius:14px; padding:14px 18px; }
.ped-overlay { position:fixed; inset:0; background:rgba(11,30,59,.55); z-index:1000; display:flex; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(4px); }
.ped-modal { background:#fff; border-radius:20px; width:100%; max-width:660px; max-height:90vh; overflow-y:auto; box-shadow:var(--shl); }
.ped-modal-hdr { padding:20px 24px 16px; border-bottom:1.5px solid var(--pbr); display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:1; border-radius:20px 20px 0 0; background:linear-gradient(135deg,#EEF4FF,#fff); }
.ped-modal-hdr h2 { font-size:17px; font-weight:800; color:var(--pn); margin:0; }
.ped-modal-body { padding:20px 24px; }
.pfield { margin-bottom:16px; }
.plabel { font-size:12px; font-weight:700; color:var(--pm); margin-bottom:6px; display:block; text-transform:uppercase; letter-spacing:.4px; }
.pinput { width:100%; padding:10px 14px; border:1.5px solid var(--pbr); border-radius:10px; font-size:13px; font-family:'Poppins',sans-serif; color:var(--pn); background:#F8FAFD; outline:none; transition:border-color .2s; }
.pinput:focus { border-color:var(--pg); background:#fff; }
.pselect { width:100%; padding:10px 14px; border:1.5px solid var(--pbr); border-radius:10px; font-size:13px; font-family:'Poppins',sans-serif; color:var(--pn); background:#F8FAFD; outline:none; cursor:pointer; }
.pselect:focus { border-color:var(--pg); }
.pg2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.pg3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
.sec-lbl { font-size:13px; font-weight:700; color:var(--pm); text-transform:uppercase; letter-spacing:.6px; margin-bottom:12px; display:flex; align-items:center; gap:8px; }
.pfilter-bar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; padding:16px 0 20px; }
.pfilter-btn { padding:7px 16px; border-radius:99px; font-size:12px; font-weight:600; border:1.5px solid var(--pbr); background:white; color:var(--pm); cursor:pointer; transition:all .2s; font-family:'Poppins',sans-serif; white-space:nowrap; }
.pfilter-btn:hover { border-color:var(--pg); color:var(--pg); }
.pfilter-btn.active { background:var(--pg); color:white; border-color:var(--pg); }
.pfilter-select { padding:7px 12px; border-radius:10px; border:1.5px solid var(--pbr); background:white; font-size:12px; font-weight:600; color:var(--pm); font-family:'Poppins',sans-serif; outline:none; cursor:pointer; }
.vacc-cell { border-radius:10px; padding:10px 12px; text-align:center; transition:all .2s; cursor:pointer; }
.vacc-cell:hover { transform:scale(1.04); }
.vacc-done { background:#ECFDF5; border:1.5px solid #6EE7B7; }
.vacc-plan { background:#FFFBEB; border:1.5px solid #FDE68A; }
.growth-row { display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--pbr); }
.growth-row:last-child { border-bottom:none; }
@keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
.fu  { animation:fadeUp .4s ease both; }
.d1{animation-delay:.05s}.d2{animation-delay:.1s}.d3{animation-delay:.15s}
.d4{animation-delay:.2s}.d5{animation-delay:.25s}.d6{animation-delay:.3s}
.nice-scroll::-webkit-scrollbar { width:5px; height:5px; }
.nice-scroll::-webkit-scrollbar-thumb { background:var(--pbr); border-radius:99px; }
@media print { .ped-top,.pfilter-bar,.pbtn { display:none!important; } }
@media (max-width:767px) {
  .ped-top { padding:12px 14px 0; }
  .pg2 { grid-template-columns:1fr; gap:10px; }
  .pg3 { grid-template-columns:1fr 1fr; gap:8px; }
  .pbtn { font-size:12px; padding:8px 12px; } .pbtn-sm { font-size:11px; padding:5px 8px; }
  .ped-card { border-radius:14px; } .ped-card-hdr { padding:11px 14px; }
  .pfilter-bar { overflow-x:auto; flex-wrap:nowrap; scrollbar-width:none; padding:10px 0 14px; }
  .pfilter-bar::-webkit-scrollbar { display:none; }
  .ped-tbl th, .ped-tbl td { padding:9px 10px; font-size:12px; }
  .ped-modal { max-height:95vh; }
  .ped-modal-hdr { padding:16px 18px 12px; }
  .ped-modal-body { padding:14px 18px; }
}
@media (max-width:479px) {
  .ped-top { padding:10px 12px 0; }
  .pkpi-val { font-size:22px; }
  .pg3 { grid-template-columns:1fr; }
}
`;

// ─── Vaccins de référence (calendrier PEV — données statiques) ────────────────
const VACCINS_REF = [
  { nom: "BCG",          age_rec: "Naissance",    doses: 1 },
  { nom: "Polio",        age_rec: "6-10-14 sem",  doses: 3 },
  { nom: "DTC",          age_rec: "6-10-14 sem",  doses: 3 },
  { nom: "Hépatite B",   age_rec: "Naissance",    doses: 3 },
  { nom: "Pneumocoque",  age_rec: "6-10-14 sem",  doses: 3 },
  { nom: "Rotavirus",    age_rec: "6-10 sem",     doses: 2 },
  { nom: "Rougeole",     age_rec: "9-12 mois",    doses: 2 },
  { nom: "Méningite A",  age_rec: "12 mois",      doses: 1 },
  { nom: "Fièvre jaune", age_rec: "9 mois",       doses: 1 },
  { nom: "HPV",          age_rec: "9-14 ans",     doses: 2 },
];

// ─── Chart composants ─────────────────────────────────────────
function LineChart({ labels, datasets, height = 200 }) {
  const ref  = useRef(null);
  const cRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (cRef.current) cRef.current.destroy();
      cRef.current = new window.Chart(ref.current, {
        type: "line", data: { labels, datasets },
        options: { responsive:true, maintainAspectRatio:true, interaction:{ mode:"index", intersect:false },
          plugins:{ legend:{ display:true, position:"top", labels:{ font:{ size:11, family:"'Poppins',sans-serif" }, usePointStyle:true, boxWidth:8 } }, tooltip:{ backgroundColor:"#0B2818", padding:12, cornerRadius:10 } },
          scales:{ x:{ grid:{ display:false }, ticks:{ font:{ size:10 }, color:"#9CA3AF" }, border:{ display:false } }, y:{ beginAtZero:true, grid:{ color:"rgba(0,0,0,.04)" }, ticks:{ font:{ size:10 }, color:"#9CA3AF", precision:0 }, border:{ display:false } } } },
      });
    });
    return () => { if (cRef.current) cRef.current.destroy(); };
  }, [labels, datasets]);
  return <canvas ref={ref} style={{ maxHeight: height }} />;
}

function DonutChart({ labels, data, colors, height = 180 }) {
  const ref  = useRef(null);
  const cRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (cRef.current) cRef.current.destroy();
      cRef.current = new window.Chart(ref.current, {
        type: "doughnut",
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth:3, borderColor:"#fff", hoverOffset:8 }] },
        options: { responsive:true, maintainAspectRatio:true, cutout:"68%",
          plugins:{ legend:{ position:"right", labels:{ font:{ size:11, family:"'Poppins',sans-serif" }, usePointStyle:true, boxWidth:8, padding:12 } }, tooltip:{ backgroundColor:"#0B2818", padding:10, cornerRadius:10 } } },
      });
    });
    return () => { if (cRef.current) cRef.current.destroy(); };
  }, [labels, data, colors]);
  return <canvas ref={ref} style={{ maxHeight: height }} />;
}

function BarChart({ labels, data, colors, height = 180 }) {
  const ref  = useRef(null);
  const cRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (cRef.current) cRef.current.destroy();
      cRef.current = new window.Chart(ref.current, {
        type: "bar",
        data: { labels, datasets: [{ data, backgroundColor: colors || data.map((_, i) => `hsl(${150 + i * 20},65%,50%)`), borderRadius:8, borderSkipped:false }] },
        options: { responsive:true, maintainAspectRatio:true,
          plugins:{ legend:{ display:false }, tooltip:{ backgroundColor:"#0B2818", padding:10, cornerRadius:10 } },
          scales:{ x:{ grid:{ display:false }, ticks:{ font:{ size:10 }, color:"#9CA3AF" }, border:{ display:false } }, y:{ beginAtZero:true, grid:{ color:"rgba(0,0,0,.04)" }, ticks:{ font:{ size:10 }, color:"#9CA3AF", precision:0 }, border:{ display:false } } } },
      });
    });
    return () => { if (cRef.current) cRef.current.destroy(); };
  }, [labels, data, colors]);
  return <canvas ref={ref} style={{ maxHeight: height }} />;
}

// ─── Helpers ─────────────────────────────────────────────────
function Badge({ cls, children }) { return <span className={`pbdg ${cls}`}>{children}</span>; }
function Prog({ pct, color, h = 8 }) {
  return <div className="ped-prog" style={{ height: h }}><div className="ped-prog-f" style={{ width:`${Math.min(100,pct)}%`, height:"100%", background:color }}/></div>;
}
function KpiCard({ color, icon, value, label, sub, urgent }) {
  return (
    <div className={`ped-kpi ${color} fu`}>
      {urgent && <div className="pkpi-dot"/>}
      <div className={`pkpi-icon ${color}`}>{icon}</div>
      <div className="pkpi-val">{value ?? "—"}</div>
      <div className="pkpi-lbl">{label}</div>
      {sub && <div className="pkpi-sub">{sub}</div>}
    </div>
  );
}

const graviteBadge = (g) => g==="normal"?"green":g==="modere"?"yellow":g==="critique"?"red":g==="chronique"?"blue":"orange";
const statutBadge  = (s) => s==="normal"?"green":s==="a_risque"?"red":s==="chronique"?"blue":"orange";
const statutLabel  = (s) => ({ normal:"Normal", surveillance:"Surveillance", a_risque:"À risque", chronique:"Chronique" })[s] || s;
const graviteLabel = (g) => ({ normal:"Normal", modere:"Modéré", grave:"Grave", critique:"Critique", chronique:"Chronique" })[g] || g;
const fmtDate      = (d) => d ? new Date(d).toLocaleDateString("fr-FR",{ day:"2-digit", month:"2-digit", year:"numeric" }) : "—";
const ageTexte     = (ddn) => {
  if (!ddn) return "—";
  const diff = Math.floor((Date.now() - new Date(ddn)) / (365.25 * 86400000));
  if (diff < 1) { const m = Math.floor((Date.now() - new Date(ddn)) / (30.5 * 86400000)); return `${m} mois`; }
  return `${diff} an${diff > 1 ? "s" : ""}`;
};

// ─── MODAL Nouveau dossier pédiatrique ──────────────────────
// AUDIT-PEDIATRIE-PATIENT — nom/prénom étaient retapés à la main, sans lien
// vers un vrai document Patient (patient_id du schéma Child jamais rempli
// par ce formulaire). Recherche/sélection identique au pattern déjà établi
// dans Messages.jsx (Phase C) : même endpoint GET /patients/search, même
// debounce — aucun composant partagé n'existe pour ça dans le projet
// (vérifié), chaque module qui en a besoin réimplémente la même logique
// locale (Appointments.jsx, Finance.jsx, Consultations.jsx, Messages.jsx).
function ModalDossier({ onClose, saving }) {
  const dispatch = useDispatch();
  const [form, setForm] = useState({ date_naissance:"", sexe:"M", parent_nom:"", parent_tel:"", groupe_sanguin:"", allergies:"", antecedents_medicaux:"" });
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const boxRef = useRef(null);
  const titleId = useId();
  // Extension du correctif fix/modal-focus-loss-on-keystroke : onClose est
  // une closure inline recréée à chaque frappe (le formulaire est local à
  // la modale ici, donc moins souvent reproductible qu'ailleurs, mais le
  // même piège existe dès que le composant se re-rend pendant la saisie) —
  // lu via une ref pour que cet effet ne se ré-exécute jamais après le
  // montage et ne vole plus le focus du champ actif.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", h);
    boxRef.current?.focus();
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    if (selectedPatient || patientQuery.trim().length < 2) { setPatientResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/patients/search?q=${encodeURIComponent(patientQuery.trim())}`);
        setPatientResults(data.patients || []);
      } catch { setPatientResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [patientQuery, selectedPatient]);

  const pickPatient = (p) => { setSelectedPatient(p); setPatientQuery(""); setPatientResults([]); };
  const clearPatient = () => setSelectedPatient(null);

  const submit = async () => {
    if (!selectedPatient) { toast.error("Sélectionnez un patient existant avant de créer le dossier."); return; }
    if (!form.date_naissance) { toast.error("Date de naissance obligatoire"); return; }
    const body = {
      ...form,
      patient_id: selectedPatient._id,
      nom: selectedPatient.nom,
      prenom: selectedPatient.prenom,
      allergies: form.allergies ? form.allergies.split(",").map(s => s.trim()).filter(Boolean) : [],
    };
    const result = await dispatch(createEnfant(body));
    if (createEnfant.fulfilled.match(result)) {
      toast.success(`✅ Dossier pédiatrique créé pour ${selectedPatient.prenom} ${selectedPatient.nom}`);
      onClose();
    } else {
      toast.error(result.payload || "Erreur création");
    }
  };

  return (
    <div className="ped-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className="ped-modal nice-scroll" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="ped-modal-hdr">
          <h2 id={titleId}>👶 Nouveau dossier pédiatrique</h2>
          <button className="pbtn pbtn-ghost pbtn-sm" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div className="ped-modal-body">
          <div style={{ fontSize:13, fontWeight:700, color:"var(--pg)", marginBottom:10 }}>🧒 Identité de l'enfant</div>

          {!selectedPatient && (
            <div className="pfield" style={{ marginBottom:10 }}>
              <label className="plabel">Patient *</label>
              <input className="pinput" autoFocus placeholder="Rechercher un patient (nom, n° dossier, téléphone)..." aria-label="Rechercher un patient (nom, n° dossier, téléphone)" value={patientQuery} onChange={e => setPatientQuery(e.target.value)} />
              <div style={{ maxHeight:220, overflowY:"auto", display:"flex", flexDirection:"column", gap:4, marginTop:8 }}>
                {patientQuery.trim().length >= 2 && patientResults.length === 0 && (
                  <div style={{ textAlign:"center", padding:12, color:"var(--pm)", fontSize:12 }}>Aucun patient trouvé.</div>
                )}
                {patientResults.map(p => (
                  <div key={p._id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:10, cursor:"pointer", border:"1.5px solid var(--pbr)" }} onClick={() => pickPatient(p)}>
                    <div style={{ width:32, height:32, borderRadius:8, background:"var(--pl)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>🧑‍⚕️</div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--pn)" }}>{p.prenom} {p.nom}</div>
                      <div style={{ fontSize:11, color:"var(--pm)" }}>{p.numero_dossier || "—"} · {p.telephone || "—"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {selectedPatient && (
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10, background:"var(--pl)", border:"1.5px solid var(--pg)", marginBottom:10 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>🧑‍⚕️</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--pn)" }}>{selectedPatient.prenom} {selectedPatient.nom}</div>
                <div style={{ fontSize:11, color:"var(--pm)" }}>{selectedPatient.numero_dossier || "—"}</div>
              </div>
              <button type="button" className="pbtn pbtn-ghost pbtn-sm" onClick={clearPatient}>Changer</button>
            </div>
          )}

          <div className="pg2">
            <div className="pfield"><label className="plabel">Nom</label><input className="pinput" value={selectedPatient?.nom || ""} readOnly disabled placeholder="Dérivé du patient sélectionné" /></div>
            <div className="pfield"><label className="plabel">Prénom</label><input className="pinput" value={selectedPatient?.prenom || ""} readOnly disabled placeholder="Dérivé du patient sélectionné" /></div>
            <div className="pfield"><label className="plabel">Date de naissance *</label><input className="pinput" type="date" value={form.date_naissance} onChange={e => setForm({...form,date_naissance:e.target.value})}/></div>
            <div className="pfield"><label className="plabel">Sexe</label>
              <select className="pselect" value={form.sexe} onChange={e => setForm({...form,sexe:e.target.value})}>
                <option value="M">Masculin</option><option value="F">Féminin</option>
              </select>
            </div>
            <div className="pfield"><label className="plabel">Groupe sanguin</label>
              <select className="pselect" value={form.groupe_sanguin} onChange={e => setForm({...form,groupe_sanguin:e.target.value})}>
                <option value="">-- Sélectionner --</option>
                {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--pg)", margin:"12px 0 10px" }}>👨‍👩‍👦 Parents / Tuteurs</div>
          <div className="pg2">
            <div className="pfield"><label className="plabel">Nom parent / tuteur</label><input className="pinput" placeholder="Nom complet du parent ou tuteur" value={form.parent_nom} onChange={e => setForm({...form,parent_nom:e.target.value})}/></div>
            <div className="pfield"><label className="plabel">Téléphone</label><input className="pinput" placeholder="06-XX-XX-XX" value={form.parent_tel} onChange={e => setForm({...form,parent_tel:e.target.value})}/></div>
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--pg)", margin:"12px 0 10px" }}>🏥 Informations médicales</div>
          <div className="pfield"><label className="plabel">Allergies connues (séparées par virgule)</label><input className="pinput" placeholder="Ex: Pénicilline, arachides..." value={form.allergies} onChange={e => setForm({...form,allergies:e.target.value})}/></div>
          <div className="pfield"><label className="plabel">Antécédents médicaux</label><textarea className="pinput" rows={3} value={form.antecedents_medicaux} onChange={e => setForm({...form,antecedents_medicaux:e.target.value})} style={{resize:"vertical"}}/></div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 }}>
            <button className="pbtn pbtn-ghost" onClick={onClose}>Annuler</button>
            <button className="pbtn pbtn-green" onClick={submit} disabled={saving || !selectedPatient} title={!selectedPatient ? "Sélectionnez d'abord un patient" : undefined}>{saving?"⏳ Création...":"💾 Créer le dossier"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL Consultation pédiatrique ─────────────────────────
function ModalConsultation({ enfant, patientNom, onClose, saving }) {
  const dispatch = useDispatch();
  const [form, setForm] = useState({ motif:"Fièvre", type:"consultation", temp:"", fc:"", fr:"", spo2:"", tension_sys:"", tension_dia:"", poids:"", etat_general:"bon", diagnostic:"", gravite:"normal", medicaments:"", posologie:"", conseils:"" });
  const boxRef = useRef(null);
  const titleId = useId();
  // Extension du correctif fix/modal-focus-loss-on-keystroke : onClose est
  // une closure inline recréée à chaque frappe (le formulaire est local à
  // la modale ici, donc moins souvent reproductible qu'ailleurs, mais le
  // même piège existe dès que le composant se re-rend pendant la saisie) —
  // lu via une ref pour que cet effet ne se ré-exécute jamais après le
  // montage et ne vole plus le focus du champ actif.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", h);
    boxRef.current?.focus();
    return () => window.removeEventListener("keydown", h);
  }, []);

  const submit = async () => {
    if (!form.diagnostic) { toast.error("Veuillez saisir un diagnostic"); return; }
    if (!enfant?._id) { toast.error("Sélectionnez d'abord un patient"); return; }
    const body = {
      child_id: enfant._id,
      motif: form.motif, type: form.type,
      diagnostic: form.diagnostic, gravite: form.gravite,
      etat_general: form.etat_general,
      medicaments: form.medicaments, posologie: form.posologie, conseils: form.conseils,
      ...(form.temp      && { temperature: Number(form.temp) }),
      ...(form.fc        && { fc:          Number(form.fc) }),
      ...(form.fr        && { fr:          Number(form.fr) }),
      ...(form.spo2      && { spo2:        Number(form.spo2) }),
      ...(form.tension_sys && { tension_sys: Number(form.tension_sys) }),
      ...(form.tension_dia && { tension_dia: Number(form.tension_dia) }),
      ...(form.poids     && { poids:       Number(form.poids) }),
    };
    const result = await dispatch(createConsultation(body));
    if (createConsultation.fulfilled.match(result)) {
      toast.success(`✅ Consultation enregistrée pour ${patientNom}`);
      onClose();
    } else {
      toast.error(result.payload || "Erreur enregistrement");
    }
  };

  return (
    <div className="ped-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className="ped-modal nice-scroll" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="ped-modal-hdr">
          <h2 id={titleId}>🩺 Consultation — {patientNom}</h2>
          <button className="pbtn pbtn-ghost pbtn-sm" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div className="ped-modal-body">
          <div className="pg2">
            <div className="pfield"><label className="plabel">Motif</label>
              <select className="pselect" value={form.motif} onChange={e => setForm({...form,motif:e.target.value})}>
                {["Fièvre","Toux","Diarrhée","Vomissements","Allergie","Contrôle médical","Vaccination","Urgence","Autre"].map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="pfield"><label className="plabel">Type</label>
              <select className="pselect" value={form.type} onChange={e => setForm({...form,type:e.target.value})}>
                {[["consultation","Consultation"],["vaccination","Vaccination"],["urgence","Urgence"],["chronique","Maladie chronique"],["controle","Contrôle"],["nutrition","Nutrition"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--pg)", marginBottom:10 }}>📊 Signes vitaux</div>
          <div className="pg3">
            <div className="pfield"><label className="plabel">Température (°C)</label><input className="pinput" placeholder="37.5" value={form.temp} onChange={e=>setForm({...form,temp:e.target.value})}/></div>
            <div className="pfield"><label className="plabel">FC (bpm)</label><input className="pinput" placeholder="90" value={form.fc} onChange={e=>setForm({...form,fc:e.target.value})}/></div>
            <div className="pfield"><label className="plabel">FR (/min)</label><input className="pinput" placeholder="22" value={form.fr} onChange={e=>setForm({...form,fr:e.target.value})}/></div>
            <div className="pfield"><label className="plabel">SpO2 (%)</label><input className="pinput" placeholder="98" value={form.spo2} onChange={e=>setForm({...form,spo2:e.target.value})}/></div>
            <div className="pfield"><label className="plabel">TA systolique</label><input className="pinput" placeholder="100" value={form.tension_sys} onChange={e=>setForm({...form,tension_sys:e.target.value})}/></div>
            <div className="pfield"><label className="plabel">Poids (kg)</label><input className="pinput" placeholder="16" value={form.poids} onChange={e=>setForm({...form,poids:e.target.value})}/></div>
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--pg)", margin:"12px 0 10px" }}>🔬 Examen clinique</div>
          <div className="pg2">
            <div className="pfield"><label className="plabel">État général</label>
              <select className="pselect" value={form.etat_general} onChange={e=>setForm({...form,etat_general:e.target.value})}>
                <option value="bon">Bon</option><option value="altere">Altéré</option><option value="critique">Critique</option>
              </select>
            </div>
            <div className="pfield"><label className="plabel">Gravité</label>
              <select className="pselect" value={form.gravite} onChange={e=>setForm({...form,gravite:e.target.value})}>
                <option value="normal">Normal</option><option value="modere">Modéré</option><option value="grave">Grave</option><option value="critique">Critique</option><option value="chronique">Chronique</option>
              </select>
            </div>
          </div>
          <div className="pfield"><label className="plabel">Diagnostic *</label><input className="pinput" placeholder="Ex: Paludisme simple, GEA..." value={form.diagnostic} onChange={e=>setForm({...form,diagnostic:e.target.value})}/></div>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--pg)", margin:"12px 0 10px" }}>💊 Traitement</div>
          <div className="pg2">
            <div className="pfield"><label className="plabel">Médicament(s)</label><input className="pinput" placeholder="Ex: Paracétamol..." value={form.medicaments} onChange={e=>setForm({...form,medicaments:e.target.value})}/></div>
            <div className="pfield"><label className="plabel">Posologie / dose poids</label><input className="pinput" placeholder="Ex: 15mg/kg/8h x 5j" value={form.posologie} onChange={e=>setForm({...form,posologie:e.target.value})}/></div>
          </div>
          <div className="pfield"><label className="plabel">Conseils aux parents</label><textarea className="pinput" rows={2} value={form.conseils} onChange={e=>setForm({...form,conseils:e.target.value})} style={{resize:"vertical"}}/></div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 }}>
            <button className="pbtn pbtn-ghost" onClick={onClose}>Annuler</button>
            <button className="pbtn pbtn-green" onClick={submit} disabled={saving}>{saving?"⏳ Enregistrement...":"💾 Enregistrer"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL Vaccination ───────────────────────────────────────
function ModalVaccination({ enfant, patientNom, onClose, saving }) {
  const dispatch = useDispatch();
  const vaccinesAdministres = new Set((enfant?.vaccinations || []).map(v => v.vaccin));
  const [doses, setDoses] = useState(() => {
    const init = {};
    VACCINS_REF.forEach(v => { init[v.nom] = vaccinesAdministres.has(v.nom); });
    return init;
  });
  const boxRef = useRef(null);
  const titleId = useId();
  // Extension du correctif fix/modal-focus-loss-on-keystroke : onClose est
  // une closure inline recréée à chaque frappe (le formulaire est local à
  // la modale ici, donc moins souvent reproductible qu'ailleurs, mais le
  // même piège existe dès que le composant se re-rend pendant la saisie) —
  // lu via une ref pour que cet effet ne se ré-exécute jamais après le
  // montage et ne vole plus le focus du champ actif.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", h);
    boxRef.current?.focus();
    return () => window.removeEventListener("keydown", h);
  }, []);

  const submit = async () => {
    if (!enfant?._id) { toast.error("Sélectionnez un patient"); return; }
    const newVaccins = VACCINS_REF.filter(v => doses[v.nom] && !vaccinesAdministres.has(v.nom));
    if (newVaccins.length === 0) { toast.success("Aucun nouveau vaccin à enregistrer"); onClose(); return; }
    for (const v of newVaccins) {
      await dispatch(addVaccination({ id: enfant._id, body: { vaccin: v.nom, dose: `${v.doses} dose(s)` } }));
    }
    toast.success(`💉 ${newVaccins.length} vaccination(s) enregistrée(s) pour ${patientNom}`);
    onClose();
  };

  return (
    <div className="ped-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className="ped-modal nice-scroll" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="ped-modal-hdr">
          <h2 id={titleId}>💉 Carnet vaccinal — {patientNom}</h2>
          <button className="pbtn pbtn-ghost pbtn-sm" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div className="ped-modal-body">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
            {VACCINS_REF.map(v => (
              <div key={v.nom} className={`vacc-cell ${doses[v.nom]?"vacc-done":"vacc-plan"}`}
                onClick={() => !vaccinesAdministres.has(v.nom) && setDoses({...doses,[v.nom]:!doses[v.nom]})}
                style={{ opacity: vaccinesAdministres.has(v.nom) ? 0.7 : 1, cursor: vaccinesAdministres.has(v.nom) ? "default":"pointer" }}
                title={vaccinesAdministres.has(v.nom) ? "Déjà administré" : "Cliquer pour basculer"}>
                <div style={{ fontSize:18 }}>{doses[v.nom] ? "✅":"📅"}</div>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--pn)", marginTop:4 }}>{v.nom}</div>
                <div style={{ fontSize:10, color:"var(--pm)" }}>{v.age_rec}</div>
                <div style={{ fontSize:10, color:doses[v.nom]?"var(--pg)":"var(--po)", marginTop:2, fontWeight:600 }}>{doses[v.nom]?"✔ Administré":"En attente"}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button className="pbtn pbtn-ghost" onClick={onClose}>Annuler</button>
            <button className="pbtn pbtn-green" onClick={submit} disabled={saving}>{saving?"⏳ Enregistrement...":"💾 Enregistrer"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL Mesure de croissance ───────────────────────────────
function ModalMesure({ enfant, patientNom, onClose, saving }) {
  const dispatch = useDispatch();
  const [form, setForm] = useState({ poids:"", taille:"", perimetre_cranien:"", date: new Date().toISOString().slice(0,10) });
  const boxRef = useRef(null);
  const titleId = useId();
  // Extension du correctif fix/modal-focus-loss-on-keystroke : onClose est
  // une closure inline recréée à chaque frappe (le formulaire est local à
  // la modale ici, donc moins souvent reproductible qu'ailleurs, mais le
  // même piège existe dès que le composant se re-rend pendant la saisie) —
  // lu via une ref pour que cet effet ne se ré-exécute jamais après le
  // montage et ne vole plus le focus du champ actif.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", h);
    boxRef.current?.focus();
    return () => window.removeEventListener("keydown", h);
  }, []);

  const submit = async () => {
    if (!enfant?._id) { toast.error("Sélectionnez d'abord un patient"); return; }
    const poidsNum = parseFloat(form.poids);
    const tailleNum = parseFloat(form.taille);
    if (!form.poids || isNaN(poidsNum) || poidsNum <= 0) { toast.error("Veuillez saisir un poids valide (> 0 kg)"); return; }
    if (!form.taille || isNaN(tailleNum) || tailleNum <= 0) { toast.error("Veuillez saisir une taille valide (> 0 cm)"); return; }
    const body = { poids: poidsNum, taille: tailleNum, date: form.date || new Date().toISOString().slice(0,10) };
    if (form.perimetre_cranien) {
      const pcNum = parseFloat(form.perimetre_cranien);
      if (!isNaN(pcNum) && pcNum > 0) body.perimetre_cranien = pcNum;
    }
    const result = await dispatch(addMesureCroissance({ id: enfant._id, body }));
    if (addMesureCroissance.fulfilled.match(result)) {
      toast.success(`➕ Mesure enregistrée pour ${patientNom}`);
      onClose();
    } else {
      toast.error(result.payload || "Erreur enregistrement");
    }
  };

  return (
    <div className="ped-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className="ped-modal nice-scroll" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="ped-modal-hdr">
          <h2 id={titleId}>📏 Nouvelle mesure — {patientNom}</h2>
          <button className="pbtn pbtn-ghost pbtn-sm" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div className="ped-modal-body">
          <div className="pg3">
            <div className="pfield"><label className="plabel">Poids (kg) *</label><input type="number" min="0.1" step="0.1" className="pinput" placeholder="Ex: 12.5" value={form.poids} onChange={e=>setForm({...form,poids:e.target.value})}/></div>
            <div className="pfield"><label className="plabel">Taille (cm) *</label><input type="number" min="1" step="0.1" className="pinput" placeholder="Ex: 85" value={form.taille} onChange={e=>setForm({...form,taille:e.target.value})}/></div>
            <div className="pfield"><label className="plabel">Périmètre crânien (cm)</label><input type="number" min="0" step="0.1" className="pinput" placeholder="Optionnel" value={form.perimetre_cranien} onChange={e=>setForm({...form,perimetre_cranien:e.target.value})}/></div>
          </div>
          <div className="pfield"><label className="plabel">Date de la mesure</label><input type="date" className="pinput" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 }}>
            <button className="pbtn pbtn-ghost" onClick={onClose}>Annuler</button>
            <button className="pbtn pbtn-green" onClick={submit} disabled={saving}>{saving?"⏳ Enregistrement...":"💾 Enregistrer"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL Maladie chronique ───────────────────────────────────
// AUDIT-P6-6 — addMaladieChronique existait dans pediatrieSlice.js (backend
// déjà fonctionnel, addMaladieChron) mais n'était jamais importé ni
// dispatché : le bouton "Nouveau dossier" de l'onglet Chroniques était un
// toast.success factice, aucune maladie chronique n'était jamais réellement
// persistée. Contrairement aux autres modales de cette page, l'enfant n'est
// pas toujours pré-sélectionné (le bouton d'en-tête n'a pas de contexte),
// d'où le sélecteur ci-dessous quand enfant est null.
function ModalMaladieChron({ enfant, enfants, onClose, saving }) {
  const dispatch = useDispatch();
  const [enfantId, setEnfantId] = useState(enfant?._id || "");
  const [form, setForm] = useState({
    maladie:"", date_diagnostic:"", traitement:"", controle:"bien", notes:"",
  });
  const boxRef = useRef(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", h);
    boxRef.current?.focus();
    return () => window.removeEventListener("keydown", h);
  }, []);

  const cibleNom = enfant
    ? `${enfant.prenom||""} ${enfant.nom||""}`.trim()
    : (enfants.find(e => e._id === enfantId) ? `${enfants.find(e => e._id === enfantId).prenom||""} ${enfants.find(e => e._id === enfantId).nom||""}`.trim() : "");

  const submit = async () => {
    if (!enfantId) { toast.error("Sélectionnez d'abord un enfant"); return; }
    if (!form.maladie.trim()) { toast.error("Le nom de la maladie est requis"); return; }
    const body = { maladie: form.maladie.trim(), controle: form.controle };
    if (form.date_diagnostic) body.date_diagnostic = form.date_diagnostic;
    if (form.traitement) body.traitement = form.traitement;
    if (form.notes) body.notes = form.notes;
    const result = await dispatch(addMaladieChronique({ id: enfantId, body }));
    if (addMaladieChronique.fulfilled.match(result)) {
      toast.success(`📋 Maladie chronique enregistrée pour ${cibleNom || "l'enfant"}`);
      onClose();
    } else {
      toast.error(result.payload || "Erreur enregistrement maladie chronique");
    }
  };

  return (
    <div className="ped-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className="ped-modal nice-scroll" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="ped-modal-hdr">
          <h2 id={titleId}>📋 Nouvelle maladie chronique{cibleNom ? ` — ${cibleNom}` : ""}</h2>
          <button className="pbtn pbtn-ghost pbtn-sm" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div className="ped-modal-body">
          {!enfant && (
            <div className="pfield">
              <label className="plabel">Enfant *</label>
              <select className="pinput" value={enfantId} onChange={e=>setEnfantId(e.target.value)}>
                <option value="">— Sélectionner —</option>
                {enfants.map(e => <option key={e._id} value={e._id}>{e.prenom} {e.nom}</option>)}
              </select>
            </div>
          )}
          <div className="pfield"><label className="plabel">Maladie *</label><input className="pinput" placeholder="Ex: Asthme, Diabète type 1..." value={form.maladie} onChange={e=>setForm({...form,maladie:e.target.value})}/></div>
          <div className="pg3">
            <div className="pfield"><label className="plabel">Date de diagnostic</label><input type="date" className="pinput" value={form.date_diagnostic} onChange={e=>setForm({...form,date_diagnostic:e.target.value})}/></div>
            <div className="pfield">
              <label className="plabel">Contrôle</label>
              <select className="pinput" value={form.controle} onChange={e=>setForm({...form,controle:e.target.value})}>
                <option value="bien">Bien contrôlé</option>
                <option value="acceptable">Acceptable</option>
                <option value="modere">Modéré</option>
                <option value="mauvais">Mauvais</option>
              </select>
            </div>
            <div className="pfield"><label className="plabel">Traitement</label><input className="pinput" placeholder="Ex: Ventoline si besoin" value={form.traitement} onChange={e=>setForm({...form,traitement:e.target.value})}/></div>
          </div>
          <div className="pfield"><label className="plabel">Notes</label><textarea className="pinput" rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={{resize:"vertical"}}/></div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 }}>
            <button className="pbtn pbtn-ghost" onClick={onClose}>Annuler</button>
            <button className="pbtn pbtn-green" onClick={submit} disabled={saving}>{saving?"⏳ Enregistrement...":"💾 Enregistrer"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────
export default function Pediatrie() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const stats         = useSelector(selectPediatrieStats);
  const repartitionAge= useSelector(selectRepartitionAge);
  const topPatho      = useSelector(selectTopPatho);
  const chart         = useSelector(selectPediatrieChart);
  const enfants       = useSelector(selectEnfants);
  const consultations = useSelector(selectConsultations);
  const urgences      = useSelector(selectUrgences);
  const loading       = useSelector(selectPediatrieLoading);
  const saving        = useSelector(selectPediatrieSaving);

  const [tab, setTab]               = useState("dashboard");
  const [isMobile, setIsMobile]     = useState(false);
  const [modal, setModal]           = useState(null);
  const [mesureModalOpen, setMesureModalOpen] = useState(false);
  const [selectedEnfant, setSelectedEnfant] = useState(null);
  const [enfantDossier, setEnfantDossier]   = useState(null);
  const [filterAge, setFilterAge]   = useState("tous");
  const [filterStatut, setFilterStatut] = useState("tous");
  const [searchQ, setSearchQ]       = useState("");
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 767);
    fn(); window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => {
    dispatch(fetchPediatrieStats());
    dispatch(fetchEnfants());
    dispatch(fetchConsultations({ limit: 50 }));
    dispatch(fetchUrgences());
  }, [dispatch]);

  const handleRefresh = () => {
    dispatch(fetchPediatrieStats());
    dispatch(fetchEnfants({ q: searchQ, statut: filterStatut !== "tous" ? filterStatut : "", age: filterAge !== "tous" ? filterAge : "" }));
    dispatch(fetchConsultations({ limit: 50 }));
    dispatch(fetchUrgences());
    setLastUpdate(new Date());
    toast.success("🔄 Données actualisées");
  };

  const openModal = (type, enfant = null) => { setSelectedEnfant(enfant); setModal(type); };

  // Sous-phase 5.7 — "Rappel envoyé" (vaccination/maladie chronique)
  // affichait un faux succès sans le moindre SMS réel. Réutilise le vrai
  // envoi SMS déjà réel et déjà testé (POST /messages/patient-sms,
  // utils/sms.js::sendSms via Twilio, déjà utilisé pour la messagerie
  // patient) — jamais un faux succès si Twilio n'est pas configuré, le
  // vrai indicateur "simulated" renvoyé par le backend est honnêtement
  // reporté à l'utilisateur.
  const envoyerRappelSms = async (enfant, contenu) => {
    const patientId = enfant?.patient_id?._id || enfant?.patient_id;
    if (!patientId) { toast.error("Aucun dossier patient lié — impossible d'envoyer un SMS."); return; }
    try {
      const { data } = await api.post('/messages/patient-sms', { patient: patientId, contenu });
      toast.success(data.simulated ? "📨 Rappel simulé — SMS non configuré (Twilio)" : "📨 Rappel envoyé par SMS");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Erreur lors de l'envoi du rappel.");
    }
  };
  const closeModal = () => { setModal(null); setSelectedEnfant(null); };
  const openDossier = (e) => { setEnfantDossier(e); setTab("dossier"); };

  // Filtrage local
  const enfantsFiltres = enfants.filter(e => {
    const nomComplet = `${e.prenom||""} ${e.nom}`.toLowerCase();
    const age = Math.floor((Date.now() - new Date(e.date_naissance)) / (365.25 * 86400000));
    const matchAge = filterAge === "tous"
      || (filterAge === "nourr"  && age < 1)
      || (filterAge === "enfant" && age >= 1 && age < 5)
      || (filterAge === "grand"  && age >= 5 && age <= 12);
    const matchStatut = filterStatut === "tous" || e.statut === filterStatut;
    const matchSearch = !searchQ || nomComplet.includes(searchQ.toLowerCase()) || (e.numero||"").includes(searchQ);
    return matchAge && matchStatut && matchSearch;
  });

  const chroniqueEnfants = enfants.filter(e => e.statut === "chronique");

  // Sous-phase 5.2 — "Exporter" (onglet Patients) affichait un faux succès
  // (toast.success("📊 Export Excel généré")) sans générer le moindre
  // fichier. Réel désormais : export xlsx des patients réellement affichés
  // (enfantsFiltres), même mécanisme (import dynamique 'xlsx', writeFile)
  // déjà utilisé ailleurs dans l'application (HR.jsx, Finance.jsx...).
  const exportEnfantsExcel = async (liste, nomFichier) => {
    if (!liste.length) { toast.error("Aucun patient à exporter."); return; }
    const XLSX = await import('xlsx');
    const rows = liste.map(e => ({
      'N° Dossier': e.numero || e._id?.slice(-6) || '—',
      'Nom': e.nom, 'Prénom': e.prenom || '',
      'Âge': ageTexte(e.date_naissance),
      'Sexe': e.sexe === 'F' ? 'Fille' : 'Garçon',
      'Parent': e.parent_nom || '—', 'Téléphone parent': e.parent_tel || '—',
      'Groupe sanguin': e.groupe_sanguin || '—',
      'Statut': statutLabel(e.statut),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Patients');
    XLSX.writeFile(wb, `${nomFichier}-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Sous-phase 5.2 — même bug (toast.success("📊 Export Excel") sans fichier
  // réel) pour "Exporter" sur l'onglet Consultations.
  const exportConsultationsExcel = async () => {
    if (!consultations.length) { toast.error("Aucune consultation à exporter."); return; }
    const XLSX = await import('xlsx');
    const rows = consultations.map(c => ({
      'Date': fmtDate(c.date),
      'Patient': c.patient_nom || (c.child_id ? `${c.child_id.prenom||""} ${c.child_id.nom}` : '—'),
      'Médecin': c.medecin || '—', 'Motif': c.motif || '—',
      'Diagnostic': c.diagnostic || '—', 'Gravité': graviteLabel(c.gravite),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consultations');
    XLSX.writeFile(wb, `consultations-pediatrie-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const TABS = [
    { key:"dashboard",    icon:"📊", label:"Tableau de bord",         labelM:"Bord"      },
    { key:"patients",     icon:"🧒", label:"Patients pédiatriques",    labelM:"Patients"  },
    { key:"consultations",icon:"🩺", label:"Consultations",            labelM:"Consult."  },
    { key:"croissance",   icon:"📏", label:"Suivi de croissance",      labelM:"Croiss."   },
    { key:"vaccinations", icon:"💉", label:"Vaccinations",             labelM:"Vaccins"   },
    { key:"developpement",icon:"🧠", label:"Développement",            labelM:"Développ." },
    { key:"nutrition",    icon:"🥗", label:"Nutrition",                labelM:"Nutrition" },
    { key:"urgences",     icon:"🚨", label:"Urgences pédiatriques",    labelM:"Urgences"  },
    { key:"chroniques",   icon:"📋", label:"Maladies chroniques",      labelM:"Chroniq."  },
    { key:"dossier",      icon:"📂", label: enfantDossier ? `Dossier — ${enfantDossier.prenom||""} ${enfantDossier.nom||""}` : "Dossier patient", labelM:"Dossier", disabled: !enfantDossier },
  ].filter(t => !t.disabled);

  return (
    <>
      <style>{CSS}</style>
      <div className="ped">

        {/* ── HERO ── */}
        <Hero
          icon={Baby}
          title="Pédiatrie"
          dateLabel={`${lastUpdate.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})} · Clinique Canadienne de Souanké`}
          right={
            <>
              <HeroButton label="Actualiser" onClick={handleRefresh} />
              <button className="hero-btn-ghost" onClick={() => window.print()}>
                <Printer size={14} /> Imprimer
              </button>
              <Button icon={Plus} onClick={() => openModal("dossier")}>Nouveau patient</Button>
            </>
          }
        />

        {isMobile ? (
          <div className="tab-bar" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:4 }}>
            {TABS.map(t => (
              <button key={t.key} className={`tab-bar-item ${tab===t.key?"active":""}`}
                style={{ flexDirection:"column", textAlign:"center", padding:"7px 3px 8px", fontSize:"9.5px", gap:"3px", whiteSpace:"normal", minWidth:0 }}
                onClick={() => setTab(t.key)}>
                <span style={{ fontSize:14 }}>{t.icon}</span>
                <span style={{ lineHeight:1.2 }}>{t.labelM}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="tab-bar">
            {TABS.map(t => (
              <button key={t.key} className={`tab-bar-item ${tab===t.key?"active":""}`} onClick={() => setTab(t.key)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        )}

        {/* ── CONTENT ── */}
        <div style={{ padding:isMobile?12:24 }}>

          {/* ══════ TABLEAU DE BORD ══════ */}
          {tab === "dashboard" && (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="green"  icon="🧒" value={stats?.totalEnfants ?? enfants.length}              label="Enfants suivis"          sub="Dossiers actifs" />
                <KpiCard color="blue"   icon="🩺" value={stats?.consultationsAujourdhui ?? "—"}              label="Consultations du jour"   sub="Aujourd'hui" />
                <KpiCard color="orange" icon="🏥" value={stats?.urgences ?? urgences.length}                  label="Urgences actives"        sub="En cours" urgent={urgences.length > 0} />
                <KpiCard color="yellow" icon="💉" value={stats?.vaccinationsAujourdhui ?? "—"}               label="Vaccinations du jour"    sub="Calendrier PEV" />
                <KpiCard color="red"    icon="⚠️" value={stats?.aRisque ?? enfants.filter(e=>e.statut==="a_risque").length} label="Enfants à risque" sub="Surveillance" urgent />
                <KpiCard color="blue"   icon="📋" value={stats?.chroniqueCount ?? chroniqueEnfants.length}   label="Maladies chroniques"     sub="En suivi actif" />
              </div>

              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"2fr 1fr", gap:20, marginBottom:20 }}>
                <div className="ped-card fu">
                  <div className="ped-card-hdr">
                    <div><h3>📈 Consultations pédiatriques — 6 mois</h3><p>Évolution mensuelle</p></div>
                  </div>
                  <div style={{ padding:20 }}>
                    <LineChart
                      labels={chart?.labels || ["Jan","Fév","Mar","Avr","Mai","Jun"]}
                      datasets={[
                        { label:"Consultations", data:chart?.data || [0,0,0,0,0,0], borderColor:"#059669", backgroundColor:"rgba(5,150,105,.1)", tension:.4, fill:true, pointRadius:4, pointBackgroundColor:"#059669" },
                      ]}
                      height={210}
                    />
                  </div>
                </div>

                <div className="ped-card fu">
                  <div className="ped-card-hdr"><div><h3>👶 Répartition par âge</h3><p>{enfants.length} enfants</p></div></div>
                  <div style={{ padding:20 }}>
                    <DonutChart
                      labels={["0-1 an","1-5 ans","5-10 ans","10-15 ans"]}
                      data={repartitionAge.length > 0 ? repartitionAge : [0,0,0,0]}
                      colors={["#059669","#0EA5E9","#7C3AED","#F59E0B"]}
                      height={180}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20, marginBottom:20 }}>
                <div className="ped-card fu">
                  <div className="ped-card-hdr"><div><h3>🦠 Principales pathologies</h3><p>Ce mois</p></div></div>
                  <div style={{ padding:"4px 0 0" }}>
                    {(topPatho.length > 0 ? topPatho : []).map((p, i) => (
                      <div key={p.nom} style={{ padding:"10px 20px", display:"flex", alignItems:"center", gap:14, borderBottom:i<topPatho.length-1?"1px solid #F0FDF4":"" }}>
                        <div style={{ width:26, height:26, borderRadius:6, background:`hsl(${150+i*25},65%,50%)20`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:12, color:`hsl(${150+i*25},65%,45%)`, flexShrink:0 }}>{i+1}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                            <span style={{ fontSize:12.5, fontWeight:600, color:"var(--pn)", textTransform:"capitalize" }}>{p.nom}</span>
                            <span style={{ fontWeight:800, fontSize:13, color:`hsl(${150+i*25},65%,45%)` }}>{p.nb}</span>
                          </div>
                          <Prog pct={topPatho[0]?.nb ? Math.round(p.nb/topPatho[0].nb*100) : 0} color={`hsl(${150+i*25},65%,50%)`} h={5}/>
                        </div>
                      </div>
                    ))}
                    {topPatho.length === 0 && (
                      <div style={{ textAlign:"center", color:"var(--pm)", padding:"24px 0", fontSize:13 }}>Aucune consultation enregistrée ce mois</div>
                    )}
                  </div>
                </div>

                <div className="ped-card fu">
                  <div className="ped-card-hdr">
                    <h3>🚨 Urgences actives</h3>
                    <Badge cls="red">{urgences.length} active{urgences.length!==1?"s":""}</Badge>
                  </div>
                  <div style={{ padding:14, display:"flex", flexDirection:"column", gap:10 }}>
                    {urgences.length === 0 && <div style={{ textAlign:"center", color:"var(--pm)", padding:"20px 0" }}>Aucune urgence en cours</div>}
                    {urgences.slice(0,4).map((u, i) => {
                      const child = u.child_id;
                      const nom = u.patient_nom || (child ? `${child.prenom||""} ${child.nom}` : "—");
                      const age = child?.date_naissance ? ageTexte(child.date_naissance) : "—";
                      return (
                        <div key={u._id} className={u.gravite==="critique"?"al-danger":u.gravite==="grave"?"al-warn":"al-blue"}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:6 }}>
                            <div>
                              <div style={{ fontSize:14, fontWeight:700, color:"var(--pn)", cursor:child?.patient_id?._id?"pointer":"default", textDecoration:child?.patient_id?._id?"underline dotted":"none", textUnderlineOffset:2 }} onClick={()=>child?.patient_id?._id&&navigate(`/patients/${child.patient_id._id}`)}>{nom} <span style={{ fontSize:12, color:"var(--pm)", fontWeight:500 }}>({age})</span>{child?.patient_id?.numero_dossier&&<span style={{fontFamily:"monospace",fontSize:10,fontWeight:700,color:"#1B4F9E",background:"#EFF6FF",padding:"1px 5px",borderRadius:4,marginLeft:6}}>{child.patient_id.numero_dossier}</span>}</div>
                              <div style={{ fontSize:12, color:"var(--pm)", marginTop:2 }}>🚑 {u.motif}</div>
                              <div style={{ fontSize:11, color:"var(--pm)", marginTop:2 }}>⏰ {fmtDate(u.date)}</div>
                            </div>
                            <Badge cls={u.gravite==="critique"?"red":u.gravite==="grave"?"orange":"yellow"}>{graviteLabel(u.gravite)}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════ PATIENTS PÉDIATRIQUES ══════ */}
          {tab === "patients" && (
            <div>
              <div className="pfilter-bar">
                <input className="pinput" style={{ width:220, padding:"8px 14px" }} placeholder="🔍 Rechercher nom, dossier..." aria-label="Rechercher nom, dossier" value={searchQ} onChange={e => setSearchQ(e.target.value)}/>
                {[["tous","Tous"],["nourr","👶 0-1 an"],["enfant","🧒 1-5 ans"],["grand","🏫 6-12 ans"]].map(([k,l]) => (
                  <button key={k} className={`pfilter-btn ${filterAge===k?"active":""}`} onClick={() => setFilterAge(k)}>{l}</button>
                ))}
                <select className="pfilter-select" value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
                  <option value="tous">Tous statuts</option>
                  <option value="normal">Normal</option>
                  <option value="surveillance">Surveillance</option>
                  <option value="a_risque">À risque</option>
                  <option value="chronique">Chronique</option>
                </select>
                <button className="pbtn pbtn-green pbtn-sm" style={{ marginLeft:"auto" }} onClick={() => openModal("dossier")}>➕ Nouveau patient</button>
              </div>

              <div className="ped-card fu">
                <div className="ped-card-hdr">
                  <div><h3>🧒 Patients pédiatriques</h3><p>{enfantsFiltres.length} enfant{enfantsFiltres.length!==1?"s":""} affiché{enfantsFiltres.length!==1?"s":""}</p></div>
                  <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => exportEnfantsExcel(enfantsFiltres, 'patients-pediatrie')}>📊 Exporter</button>
                </div>
                {loading ? (
                  <div style={{ textAlign:"center", padding:40, color:"var(--pm)" }}>⏳ Chargement...</div>
                ) : (
                  <div style={{ overflowX:"auto" }}>
                    <table className="ped-tbl">
                      <thead>
                        <tr><th>N° Dossier</th><th>Nom & Prénom</th><th>Âge</th><th>Sexe</th><th>Parent</th><th>Tél.</th><th>Groupe</th><th>Statut</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {enfantsFiltres.length === 0 ? (
                          <tr><td colSpan={9} style={{ textAlign:"center", color:"var(--pm)", padding:24 }}>Aucun patient trouvé</td></tr>
                        ) : enfantsFiltres.map(e => (
                          <tr key={e._id}>
                            <td><span style={{ fontWeight:700, color:"var(--pg)" }}>{e.numero||e._id?.slice(-6)}</span></td>
                            <td><div style={{ fontWeight:600, color:"var(--pn)", cursor:e.patient_id?._id?"pointer":"default", textDecoration:e.patient_id?._id?"underline dotted":"none", textUnderlineOffset:2 }} onClick={()=>e.patient_id?._id&&navigate(`/patients/${e.patient_id._id}`)} title={e.patient_id?._id?"Ouvrir le dossier patient":""}>{e.prenom} {e.nom}</div>{e.patient_id?.numero_dossier&&<span style={{fontFamily:"monospace",fontSize:10,fontWeight:700,color:"#1B4F9E",background:"#EFF6FF",padding:"1px 6px",borderRadius:4,display:"inline-block",marginTop:2}}>{e.patient_id.numero_dossier}</span>}</td>
                            <td>{ageTexte(e.date_naissance)}</td>
                            <td><Badge cls={e.sexe==="F"?"pink":"blue"}>{e.sexe==="F"?"👧 Fille":"👦 Garçon"}</Badge></td>
                            <td style={{ fontSize:12, color:"var(--pm)" }}>{e.parent_nom||"—"}</td>
                            <td style={{ fontSize:12 }}>{e.parent_tel||"—"}</td>
                            <td><Badge cls="gray">{e.groupe_sanguin||"—"}</Badge></td>
                            <td><Badge cls={statutBadge(e.statut)}>{statutLabel(e.statut)}</Badge></td>
                            <td>
                              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                                <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => openDossier(e)}>📂 Ouvrir</button>
                                <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => openModal("consultation", e)}>🩺</button>
                                <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => openModal("vaccination", e)}>💉</button>
                                {/* Sous-phase 5.7 — "📅" affichait un faux
                                    succès sans création réelle de RDV :
                                    redirige réellement vers le module dédié
                                    (Appointments.jsx). "🖨" câblé sur
                                    window.print(), même mécanisme réel utilisé
                                    partout ailleurs dans ce système. */}
                                <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => navigate("/appointments")}>📅</button>
                                <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => window.print()}>🖨</button>
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

          {/* ══════ CONSULTATIONS ══════ */}
          {tab === "consultations" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                <div className="sec-lbl">🩺 Consultations pédiatriques</div>
                <button className="pbtn pbtn-green" onClick={() => openModal("consultation", enfants[0]||null)}>➕ Nouvelle consultation</button>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14, marginBottom:20 }}>
                <KpiCard color="green"  icon="🩺" value={stats?.consultationsAujourdhui ?? "—"} label="Aujourd'hui" sub="Consultations" />
                <KpiCard color="blue"   icon="📋" value={consultations.length}                   label="Chargées"    sub="50 dernières" />
                <KpiCard color="yellow" icon="💉" value={consultations.filter(c=>c.type==="vaccination").length} label="Vaccinations" />
                <KpiCard color="orange" icon="🚨" value={consultations.filter(c=>c.type==="urgence").length}    label="Urgences"    sub="Dans la liste" />
              </div>

              <div className="ped-card fu">
                <div className="ped-card-hdr">
                  <div><h3>📋 Historique des consultations</h3></div>
                  <button className="pbtn pbtn-ghost pbtn-sm" onClick={exportConsultationsExcel}>📊 Exporter</button>
                </div>
                {loading ? (
                  <div style={{ textAlign:"center", padding:40, color:"var(--pm)" }}>⏳ Chargement...</div>
                ) : (
                  <div style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>
                    {consultations.length === 0 && <div style={{ textAlign:"center", color:"var(--pm)", padding:"24px 0" }}>Aucune consultation enregistrée</div>}
                    {consultations.map((c, i) => {
                      const child = c.child_id;
                      const nom = c.patient_nom || (child ? `${child.prenom||""} ${child.nom}` : "—");
                      const age = child?.date_naissance ? ageTexte(child.date_naissance) : "—";
                      return (
                        <div key={c._id} style={{ background:"#F0FDF4", borderRadius:14, padding:14, border:"1.5px solid var(--pbr)" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8, marginBottom:10 }}>
                            <div>
                              <div style={{ fontSize:14, fontWeight:700, color:"var(--pn)", cursor:child?.patient_id?._id?"pointer":"default", textDecoration:child?.patient_id?._id?"underline dotted":"none", textUnderlineOffset:2 }} onClick={()=>child?.patient_id?._id&&navigate(`/patients/${child.patient_id._id}`)}>{nom} <span style={{ fontSize:12, color:"var(--pm)", fontWeight:500 }}>({age})</span>{child?.patient_id?.numero_dossier&&<span style={{fontFamily:"monospace",fontSize:10,fontWeight:700,color:"#1B4F9E",background:"#EFF6FF",padding:"1px 5px",borderRadius:4,marginLeft:6}}>{child.patient_id.numero_dossier}</span>}</div>
                              <div style={{ fontSize:11, color:"var(--pm)" }}>{fmtDate(c.date)} · {c.medecin||"—"}</div>
                            </div>
                            <div style={{ display:"flex", gap:6 }}>
                              <Badge cls="blue">{c.motif}</Badge>
                              <Badge cls={graviteBadge(c.gravite)}>{graviteLabel(c.gravite)}</Badge>
                            </div>
                          </div>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                            <span style={{ fontSize:13, color:"var(--pn)", fontWeight:600 }}>🔬 {c.diagnostic}</span>
                            <div style={{ display:"flex", gap:6 }}>
                              {/* Sous-phase 5.7 — "Dossier" affichait un faux
                                  succès sans rien ouvrir : câblé sur la vraie
                                  navigation patient (même lien réel que le
                                  nom ci-dessus). "Ordonnance imprimée"
                                  affichait un faux succès sans document
                                  réel : aucune génération d'ordonnance
                                  formatée n'existe dans ce module.
                                  Désactivé honnêtement. */}
                              <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => child?.patient_id?._id && navigate(`/patients/${child.patient_id._id}`)}>Dossier</button>
                              <button className="pbtn pbtn-ghost pbtn-sm" disabled title="Fonctionnalité en cours de développement — aucune génération réelle d'ordonnance n'existe ici." onClick={() => toast("🚧 Fonctionnalité en cours de développement.")}>📄 Ordonnance</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════ SUIVI DE CROISSANCE ══════ */}
          {tab === "croissance" && (
            <div>
              <div className="sec-lbl" style={{ marginBottom:16 }}>📏 Suivi de croissance</div>

              <div className="ped-card fu" style={{ marginBottom:20 }}>
                <div className="ped-card-hdr"><h3>🔍 Sélectionner un patient</h3></div>
                <div style={{ padding:16, display:"flex", gap:10, flexWrap:"wrap" }}>
                  {enfants.length === 0 && <div style={{ color:"var(--pm)", fontSize:13 }}>Aucun patient enregistré</div>}
                  {enfants.map(e => (
                    <button key={e._id} className="pbtn pbtn-ghost pbtn-sm" onClick={() => setSelectedEnfant(e)}
                      style={{ border:selectedEnfant?._id===e._id?"2px solid var(--pg)":undefined, color:selectedEnfant?._id===e._id?"var(--pg)":undefined, fontWeight:selectedEnfant?._id===e._id?700:600 }}>
                      {e.sexe==="F"?"👧":"👦"} {e.prenom||e.nom}
                    </button>
                  ))}
                </div>
              </div>

              {selectedEnfant && (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20, marginBottom:20 }}>
                    <div className="ped-card fu">
                      <div className="ped-card-hdr"><div><h3>⚖️ Courbe Poids / Âge</h3><p>{selectedEnfant.prenom} {selectedEnfant.nom}</p></div></div>
                      <div style={{ padding:20 }}>
                        <LineChart
                          labels={(selectedEnfant.mesures_croissance||[]).map(m => fmtDate(m.date)).reverse().slice(0,8)}
                          datasets={[
                            { label:"Poids (kg)", data:(selectedEnfant.mesures_croissance||[]).map(m=>m.poids).reverse().slice(0,8), borderColor:"#059669", backgroundColor:"rgba(5,150,105,.1)", tension:.4, fill:true, pointRadius:4, pointBackgroundColor:"#059669" },
                          ]}
                          height={200}
                        />
                        {(selectedEnfant.mesures_croissance||[]).length === 0 && <div style={{ textAlign:"center", color:"var(--pm)", fontSize:13 }}>Aucune mesure enregistrée</div>}
                      </div>
                    </div>

                    <div className="ped-card fu">
                      <div className="ped-card-hdr"><div><h3>📐 Courbe Taille / Âge</h3><p>{selectedEnfant.prenom} {selectedEnfant.nom}</p></div></div>
                      <div style={{ padding:20 }}>
                        <LineChart
                          labels={(selectedEnfant.mesures_croissance||[]).map(m => fmtDate(m.date)).reverse().slice(0,8)}
                          datasets={[
                            { label:"Taille (cm)", data:(selectedEnfant.mesures_croissance||[]).map(m=>m.taille).reverse().slice(0,8), borderColor:"#7C3AED", backgroundColor:"rgba(124,58,237,.08)", tension:.4, fill:true, pointRadius:4, pointBackgroundColor:"#7C3AED" },
                          ]}
                          height={200}
                        />
                        {(selectedEnfant.mesures_croissance||[]).length === 0 && <div style={{ textAlign:"center", color:"var(--pm)", fontSize:13 }}>Aucune mesure enregistrée</div>}
                      </div>
                    </div>
                  </div>

                  <div className="ped-card fu">
                    <div className="ped-card-hdr">
                      <div><h3>📊 Historique des mesures</h3><p>{selectedEnfant.prenom} {selectedEnfant.nom}</p></div>
                      <button className="pbtn pbtn-green pbtn-sm" onClick={() => setMesureModalOpen(true)}>➕ Ajouter</button>
                    </div>
                    <div style={{ padding:14 }}>
                      <div style={{ display:"grid", gridTemplateColumns:"auto 1fr 1fr 1fr 1fr", gap:"0 12px", padding:"8px 6px", background:"#F0FDF4", borderRadius:10, marginBottom:6, fontSize:11, fontWeight:700, color:"var(--pm)", textTransform:"uppercase" }}>
                        <span>Date</span><span>Poids</span><span>Taille</span><span>PC</span><span>IMC</span>
                      </div>
                      {(selectedEnfant.mesures_croissance||[]).length === 0 && (
                        <div style={{ textAlign:"center", color:"var(--pm)", padding:"16px 0" }}>Aucune mesure enregistrée</div>
                      )}
                      {[...(selectedEnfant.mesures_croissance||[])].reverse().map((m, i) => (
                        <div key={i} className="growth-row" style={{ display:"grid", gridTemplateColumns:"auto 1fr 1fr 1fr 1fr", gap:"0 12px", alignItems:"center" }}>
                          <span style={{ fontSize:12, color:"var(--pm)", fontWeight:600, whiteSpace:"nowrap" }}>{fmtDate(m.date)}</span>
                          <span style={{ fontSize:13, fontWeight:700, color:"var(--pg)" }}>{m.poids?`${m.poids} kg`:"—"}</span>
                          <span style={{ fontSize:13, fontWeight:700, color:"var(--pb2)" }}>{m.taille?`${m.taille} cm`:"—"}</span>
                          <span style={{ fontSize:13, fontWeight:700, color:"var(--pp)" }}>{m.perimetre_cranien?`${m.perimetre_cranien} cm`:"—"}</span>
                          <Badge cls={m.imc&&m.imc<18.5?"blue":m.imc&&m.imc>25?"orange":"green"}>{m.imc||"—"}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {!selectedEnfant && (
                <div style={{ textAlign:"center", color:"var(--pm)", padding:"60px 0", fontSize:14 }}>Sélectionnez un patient pour voir ses courbes de croissance</div>
              )}
            </div>
          )}

          {/* ══════ VACCINATIONS ══════ */}
          {tab === "vaccinations" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                <div className="sec-lbl">💉 Gestion des vaccinations</div>
                <button className="pbtn pbtn-green" onClick={() => openModal("vaccination", enfants[0]||null)}>➕ Nouvelle vaccination</button>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14, marginBottom:20 }}>
                <KpiCard color="green"  icon="✅" value={stats?.vaccinationsAujourdhui ?? "—"} label="Vaccinés aujourd'hui" />
                <KpiCard color="blue"   icon="📊" value={enfants.length > 0 ? `${Math.round(enfants.filter(e=>(e.vaccinations||[]).length>=3).length/Math.max(enfants.length,1)*100)}%` : "—"} label="≥ 3 vaccins" sub="Couverture min." />
                <KpiCard color="red"    icon="⏰" value={enfants.filter(e=>(e.vaccinations||[]).length===0).length} label="Aucune vaccination" sub="Rappels à envoyer" urgent />
                <KpiCard color="yellow" icon="📅" value={VACCINS_REF.length}                   label="Vaccins au calendrier" sub="Programme PEV" />
              </div>

              <div className="ped-card fu" style={{ marginBottom:20 }}>
                <div className="ped-card-hdr">
                  <div><h3>📅 Calendrier vaccinal numérique — PEV</h3></div>
                  {/* Sous-phase 5.7 — faux succès sans génération réelle de
                      certificat vaccinal. */}
                  <button className="pbtn pbtn-ghost pbtn-sm" disabled title="Fonctionnalité en cours de développement — aucune génération réelle de certificat n'existe encore." onClick={() => toast("🚧 Fonctionnalité en cours de développement.")}>📄 Certificat</button>
                </div>
                {loading ? (
                  <div style={{ textAlign:"center", padding:40, color:"var(--pm)" }}>⏳ Chargement...</div>
                ) : (
                  <div style={{ overflowX:"auto" }}>
                    <table className="ped-tbl" style={{ minWidth:700 }}>
                      <thead>
                        <tr>
                          <th>Enfant</th>
                          {VACCINS_REF.slice(0,8).map(v => <th key={v.nom} style={{ textAlign:"center" }}>{v.nom}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {enfants.slice(0,8).map(e => {
                          const admis = new Set((e.vaccinations||[]).map(v => v.vaccin));
                          return (
                            <tr key={e._id}>
                              <td>
                                <div style={{ fontWeight:600, color:"var(--pn)" }}>{e.prenom} {e.nom}</div>
                                <div style={{ fontSize:11, color:"var(--pm)" }}>{ageTexte(e.date_naissance)}</div>
                              </td>
                              {VACCINS_REF.slice(0,8).map(v => (
                                <td key={v.nom} style={{ textAlign:"center" }}>
                                  {admis.has(v.nom)
                                    ? <span style={{ fontSize:18 }} title="Administré">✅</span>
                                    : <span style={{ fontSize:18 }} title="Non administré">📅</span>
                                  }
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                        {enfants.length === 0 && <tr><td colSpan={9} style={{ textAlign:"center", color:"var(--pm)", padding:24 }}>Aucun patient</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{ padding:"10px 20px", display:"flex", gap:16, flexWrap:"wrap" }}>
                  {[["✅","Administré"],["📅","Non administré"]].map(([ico,lbl]) => (
                    <div key={lbl} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"var(--pm)" }}>{ico} {lbl}</div>
                  ))}
                </div>
              </div>

              {/* Enfants sans vaccins */}
              {enfants.filter(e=>(e.vaccinations||[]).length===0).length > 0 && (
                <div className="ped-card fu">
                  <div className="ped-card-hdr"><h3>🔴 Enfants sans vaccination enregistrée</h3><Badge cls="red">{enfants.filter(e=>(e.vaccinations||[]).length===0).length} enfants</Badge></div>
                  <div style={{ padding:16, display:"flex", flexDirection:"column", gap:10 }}>
                    {enfants.filter(e=>(e.vaccinations||[]).length===0).map((e,i) => (
                      <div key={i} className="al-warn">
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700, color:"var(--pn)" }}>{e.prenom} {e.nom} ({ageTexte(e.date_naissance)})</div>
                            <div style={{ fontSize:11, color:"var(--pm)", marginTop:2 }}>📞 {e.parent_tel||"—"} — {e.parent_nom||"—"}</div>
                          </div>
                          <div style={{ display:"flex", gap:6 }}>
                            <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => envoyerRappelSms(e, `Rappel : le calendrier vaccinal de ${e.prenom} ${e.nom} n'est pas à jour. Merci de prendre rendez-vous pour la vaccination.`)}>📨 Rappel</button>
                            <button className="pbtn pbtn-green pbtn-sm" onClick={() => openModal("vaccination", e)}>💉 Vacciner</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════ DÉVELOPPEMENT PSYCHOMOTEUR ══════ */}
          {tab === "developpement" && (
            <div>
              <div className="sec-lbl" style={{ marginBottom:16 }}>🧠 Développement psychomoteur</div>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20, marginBottom:20 }}>
                <div className="ped-card fu">
                  <div className="ped-card-hdr"><div><h3>👶 Jalons de développement</h3><p>0-24 mois — repères OMS</p></div></div>
                  <div style={{ padding:16, display:"flex", flexDirection:"column", gap:8 }}>
                    {[
                      { jalon:"Tient sa tête",     age_typ:"3 mois",  mois_max:4  },
                      { jalon:"Suit du regard",    age_typ:"2 mois",  mois_max:3  },
                      { jalon:"Sourit",            age_typ:"2 mois",  mois_max:3  },
                      { jalon:"S'assoit",          age_typ:"6 mois",  mois_max:9  },
                      { jalon:"Rampe",             age_typ:"8 mois",  mois_max:12 },
                      { jalon:"Premiers mots",     age_typ:"10 mois", mois_max:15 },
                      { jalon:"Marche seul",       age_typ:"12 mois", mois_max:18 },
                      { jalon:"Phrase de 2 mots",  age_typ:"24 mois", mois_max:30 },
                    ].map((j, i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 10px", background:"#F0FDF4", borderRadius:10, border:"1px solid var(--pbr)" }}>
                        <span style={{ fontSize:16, flexShrink:0 }}>📌</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:"var(--pn)" }}>{j.jalon}</div>
                          <div style={{ fontSize:11, color:"var(--pm)" }}>Âge typique : {j.age_typ} · Limite : {j.mois_max} mois</div>
                        </div>
                        <Badge cls="green">Repère OMS</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ped-card fu">
                  <div className="ped-card-hdr"><h3>⚠️ Alertes de développement</h3></div>
                  <div style={{ padding:16, display:"flex", flexDirection:"column", gap:10 }}>
                    {enfants.filter(e=>e.statut==="a_risque"||e.statut==="surveillance").map((e,i) => (
                      <div key={i} className={e.statut==="a_risque"?"al-danger":"al-warn"}>
                        <div style={{ fontSize:13, fontWeight:700, color:"var(--pn)" }}>{e.prenom} {e.nom} ({ageTexte(e.date_naissance)})</div>
                        <div style={{ fontSize:12, color:"var(--pm)", marginTop:4 }}>Statut : {statutLabel(e.statut)}</div>
                        <div style={{ display:"flex", gap:8, marginTop:8 }}>
                          <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => openModal("consultation", e)}>🩺 Évaluer</button>
                        </div>
                      </div>
                    ))}
                    {enfants.filter(e=>e.statut==="a_risque"||e.statut==="surveillance").length === 0 && (
                      <div className="al-green"><div style={{ fontSize:13, fontWeight:700 }}>✅ Aucune alerte de développement</div></div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════ NUTRITION ══════ */}
          {tab === "nutrition" && (
            <div>
              <div className="sec-lbl" style={{ marginBottom:16 }}>🥗 Nutrition pédiatrique</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14, marginBottom:20 }}>
                <KpiCard color="red"    icon="⚠️" value={enfants.filter(e=>e.mesures_croissance?.slice(-1)[0]?.statut_nutritionnel==="mam"||e.mesures_croissance?.slice(-1)[0]?.statut_nutritionnel==="mas").length} label="Malnutrition aiguë" sub="MAM + MAS" urgent />
                <KpiCard color="yellow" icon="⚖️" value={enfants.filter(e=>e.mesures_croissance?.slice(-1)[0]?.statut_nutritionnel==="surpoids").length} label="Surpoids" sub="IMC ≥ 85e pctile" />
                <KpiCard color="green"  icon="✅" value={enfants.filter(e=>!e.mesures_croissance?.slice(-1)[0]||e.mesures_croissance?.slice(-1)[0]?.statut_nutritionnel==="normal").length} label="Statut normal" />
                <KpiCard color="blue"   icon="📊" value={enfants.filter(e=>(e.mesures_croissance||[]).length>0).length} label="Avec mesures" sub="Suivi de croissance" />
              </div>

              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                <div className="ped-card fu">
                  <div className="ped-card-hdr"><h3>🥗 État nutritionnel</h3></div>
                  <div style={{ padding:16 }}>
                    {enfants.length === 0 && <div style={{ textAlign:"center", color:"var(--pm)", padding:"24px 0" }}>Aucun patient enregistré</div>}
                    {enfants.slice(0,8).map((e, i) => {
                      const derniereMesure = [...(e.mesures_croissance||[])].reverse()[0];
                      const etat = derniereMesure?.statut_nutritionnel || "normal";
                      const bdg  = etat==="normal"?"green":etat==="surpoids"?"orange":"red";
                      const lbl  = { normal:"Normal", mam:"MAM", mas:"MAS", surpoids:"Surpoids", obesite:"Obésité" }[etat] || etat;
                      return (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 4px", borderBottom:i<Math.min(enfants.length,8)-1?"1px solid #F0FDF4":"" }}>
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                              <span style={{ fontSize:13, fontWeight:700, color:"var(--pn)" }}>{e.prenom} {e.nom} ({ageTexte(e.date_naissance)})</span>
                              <Badge cls={bdg}>{lbl}</Badge>
                            </div>
                            <div style={{ fontSize:11, color:"var(--pm)", marginTop:2 }}>
                              {derniereMesure ? `Poids: ${derniereMesure.poids||"—"}kg · Taille: ${derniereMesure.taille||"—"}cm · IMC: ${derniereMesure.imc||"—"}` : "Aucune mesure"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="ped-card fu">
                  <div className="ped-card-hdr"><h3>📋 Recommandations nutritionnelles</h3></div>
                  <div style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>
                    {[
                      { titre:"🍼 Allaitement maternel exclusif", age:"0-6 mois",   detail:"Recommandé jusqu'à 6 mois sans complément.", col:"#059669" },
                      { titre:"🥣 Alimentation complémentaire",   age:"6-24 mois",  detail:"Introduire purées, légumes, céréales enrichies.", col:"#0EA5E9" },
                      { titre:"💊 Supplémentation vitamine A",     age:"6-59 mois",  detail:"200 000 UI tous les 6 mois — campagnes PEV.", col:"#D97706" },
                      { titre:"💊 Déparasitage systématique",      age:"12-59 mois", detail:"Albendazole 400mg tous les 6 mois.", col:"#7C3AED" },
                      { titre:"🥦 Diversification alimentaire",    age:"> 2 ans",    detail:"5 groupes alimentaires par jour.", col:"#EC4899" },
                    ].map((r, i) => (
                      <div key={i} style={{ display:"flex", gap:12, padding:"10px 12px", background:"#F0FDF4", borderRadius:12, borderLeft:`3px solid ${r.col}` }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:"var(--pn)" }}>{r.titre}</div>
                          <div style={{ fontSize:11, color:"var(--pb2)", marginTop:1, fontWeight:600 }}>{r.age}</div>
                          <div style={{ fontSize:11, color:"var(--pm)", marginTop:3 }}>{r.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════ URGENCES PÉDIATRIQUES ══════ */}
          {tab === "urgences" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                <div className="sec-lbl">🚨 Urgences pédiatriques</div>
                <button className="pbtn pbtn-danger" onClick={() => openModal("consultation", enfants[0]||null)}>🚨 Admettre en urgence</button>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14, marginBottom:20 }}>
                <KpiCard color="red"    icon="🚨" value={urgences.length}  label="En cours"     sub="Prise en charge active" urgent={urgences.length>0} />
                <KpiCard color="green"  icon="✅" value={consultations.filter(c=>c.type==="urgence").length} label="Total urgences" sub="Enregistrées" />
                <KpiCard color="blue"   icon="🏥" value="—"                label="Hospitalisées" sub="Suite urgence" />
              </div>

              {loading && <div style={{ textAlign:"center", color:"var(--pm)", padding:24 }}>⏳ Chargement...</div>}

              {urgences.length === 0 && !loading && (
                <div style={{ textAlign:"center", color:"var(--pm)", padding:"60px 0", fontSize:14 }}>Aucune urgence active aujourd'hui</div>
              )}

              <div style={{ display:"flex", flexDirection:"column", gap:16, marginBottom:20 }}>
                {urgences.map((u, i) => {
                  const child = u.child_id;
                  const nom = u.patient_nom || (child ? `${child.prenom||""} ${child.nom}` : "—");
                  const age = child?.date_naissance ? ageTexte(child.date_naissance) : "—";
                  return (
                    <div key={u._id} className="ped-card fu">
                      <div className="ped-card-hdr">
                        <div>
                          <h3>🚨 <span style={{cursor:child?.patient_id?._id?"pointer":"default",textDecoration:child?.patient_id?._id?"underline dotted":"none",textUnderlineOffset:2}} onClick={()=>child?.patient_id?._id&&navigate(`/patients/${child.patient_id._id}`)}>{nom}</span> <span style={{ fontSize:13, fontWeight:500, color:"var(--pm)" }}>({age})</span>{child?.patient_id?.numero_dossier&&<span style={{fontFamily:"monospace",fontSize:10,fontWeight:700,color:"#1B4F9E",background:"#EFF6FF",padding:"1px 5px",borderRadius:4,marginLeft:6}}>{child.patient_id.numero_dossier}</span>}</h3>
                          <p>Enregistré : {fmtDate(u.date)}</p>
                        </div>
                        <Badge cls={u.gravite==="critique"?"red":u.gravite==="grave"?"orange":"yellow"}>{graviteLabel(u.gravite)}</Badge>
                      </div>
                      <div style={{ padding:16 }}>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:14 }}>
                          <div className="pmini"><div className="pmini-lbl">Motif</div><div className="pmini-val" style={{ fontSize:14, color:"var(--pr)" }}>{u.motif}</div></div>
                          <div className="pmini"><div className="pmini-lbl">Diagnostic</div><div className="pmini-val" style={{ fontSize:13 }}>{u.diagnostic}</div></div>
                          <div className="pmini"><div className="pmini-lbl">Médecin</div><div className="pmini-val" style={{ fontSize:13 }}>{u.medecin||"—"}</div></div>
                        </div>
                        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                          {/* Sous-phase 5.7 — "Fiche" affichait un faux
                              succès sans document réel. "Urgence absolue"
                              affichait une fausse alerte déclenchée sans
                              aucun mécanisme réel d'alerte — désactivés
                              honnêtement plutôt que de laisser croire à une
                              alerte réellement envoyée dans un contexte
                              d'urgence pédiatrique. */}
                          <button className="pbtn pbtn-ghost pbtn-sm" disabled title="Fonctionnalité en cours de développement — aucune génération réelle de fiche n'existe encore." onClick={() => toast("🚧 Fonctionnalité en cours de développement.")}>📋 Fiche</button>
                          <button className="pbtn pbtn-danger pbtn-sm" disabled title="Fonctionnalité en cours de développement — aucun mécanisme réel d'alerte n'existe encore." onClick={() => toast("🚧 Fonctionnalité en cours de développement — aucune alerte réelle n'a été envoyée.")}>🚨 Urgence absolue</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Protocoles */}
              <div className="ped-card fu">
                <div className="ped-card-hdr"><h3>📋 Protocoles d'urgence pédiatrique</h3></div>
                <div style={{ padding:20, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:12 }}>
                  {[
                    { ico:"🔥", col:"#DC2626", titre:"Fièvre > 39°C",        steps:"1. T° axillaire · 2. Paracétamol 15mg/kg · 3. Déshabiller · 4. Surveiller" },
                    { ico:"💧", col:"#0EA5E9", titre:"Déshydratation",        steps:"1. Évaluer signe pli · 2. SRO 50-100ml/kg · 3. Peser · 4. Voie IV si échec" },
                    { ico:"⚡", col:"#7C3AED", titre:"Convulsions fébriles",  steps:"1. Position latérale · 2. Diazépam 0.3mg/kg · 3. O2 · 4. Bilan urgence" },
                    { ico:"🫁", col:"#D97706", titre:"Détresse respiratoire", steps:"1. Position assise · 2. O2 nasal · 3. Salbutamol · 4. SpO2 > 92%" },
                  ].map((p, i) => (
                    <div key={i} style={{ background:"#F0FDF4", borderRadius:14, padding:"14px 16px", borderLeft:`3px solid ${p.col}` }}>
                      <div style={{ fontSize:20, marginBottom:6 }}>{p.ico}</div>
                      <div style={{ fontSize:13, fontWeight:700, color:"var(--pn)", marginBottom:6 }}>{p.titre}</div>
                      <div style={{ fontSize:11, color:"var(--pm)", lineHeight:1.6 }}>{p.steps}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════ MALADIES CHRONIQUES ══════ */}
          {tab === "chroniques" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                <div className="sec-lbl">📋 Maladies chroniques pédiatriques</div>
                <button className="pbtn pbtn-green" onClick={() => openModal("maladieChron")}>➕ Nouveau dossier</button>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14, marginBottom:20 }}>
                <KpiCard color="blue"   icon="📋" value={chroniqueEnfants.length} label="Enfants chroniques" sub="En suivi actif" />
                <KpiCard color="red"    icon="⚠️" value={chroniqueEnfants.filter(e=>e.maladies_chroniques?.some(m=>m.controle==="mauvais")).length} label="Contrôle insuffisant" urgent />
                <KpiCard color="green"  icon="✅" value={chroniqueEnfants.filter(e=>e.maladies_chroniques?.every(m=>m.controle==="bien")).length} label="Bien contrôlés" />
              </div>

              {chroniqueEnfants.length === 0 && !loading && (
                <div style={{ textAlign:"center", color:"var(--pm)", padding:"60px 0", fontSize:14 }}>Aucun enfant avec maladie chronique enregistrée</div>
              )}

              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {chroniqueEnfants.map((e, i) => (
                  <div key={e._id} className={`ped-card fu d${Math.min(i+1,6)}`}>
                    <div className="ped-card-hdr">
                      <div>
                        <h3>📋 {e.prenom} {e.nom} <span style={{ fontSize:12, fontWeight:500, color:"var(--pm)" }}>({ageTexte(e.date_naissance)})</span></h3>
                        <p>{(e.maladies_chroniques||[]).map(m=>m.maladie).join(", ")||"—"}</p>
                      </div>
                      <Badge cls="blue">Chronique</Badge>
                    </div>
                    <div style={{ padding:16 }}>
                      {(e.maladies_chroniques||[]).map((mc, j) => (
                        <div key={j} style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:12 }}>
                          <div className="pmini"><div className="pmini-lbl">Maladie</div><div className="pmini-val" style={{ fontSize:14, color:"var(--pb2)" }}>{mc.maladie}</div></div>
                          <div className="pmini"><div className="pmini-lbl">Dernière consultation</div><div className="pmini-val" style={{ fontSize:13 }}>{fmtDate(mc.derniere_consultation)}</div></div>
                          <div className="pmini"><div className="pmini-lbl">Prochaine</div><div className="pmini-val" style={{ fontSize:13, color:"var(--pg)" }}>{fmtDate(mc.prochaine_consultation)}</div></div>
                          <div className="pmini"><div className="pmini-lbl">Traitement</div><div className="pmini-val" style={{ fontSize:11, color:"var(--pm)", fontWeight:600 }}>{mc.traitement||"—"}</div></div>
                        </div>
                      ))}
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                        <button className="pbtn pbtn-green pbtn-sm" onClick={() => openModal("consultation", e)}>🩺 Consulter</button>
                        <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => openModal("maladieChron", e)}>➕ Ajouter maladie</button>
                        {/* Sous-phase 5.7 — "RDV" redirige réellement vers
                            le module dédié. "Rapport" désactivé
                            honnêtement (aucune génération réelle). "Rappel
                            parents" câblé sur le vrai envoi SMS
                            (envoyerRappelSms, même mécanisme réel que
                            l'onglet Vaccinations ci-dessus). */}
                        <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => navigate("/appointments")}>📅 RDV</button>
                        <button className="pbtn pbtn-ghost pbtn-sm" disabled title="Fonctionnalité en cours de développement — aucune génération réelle de rapport n'existe encore." onClick={() => toast("🚧 Fonctionnalité en cours de développement.")}>📄 Rapport</button>
                        <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => envoyerRappelSms(e, `Rappel de suivi pour ${e.prenom} ${e.nom} — merci de prendre rendez-vous pour la consultation de suivi de sa maladie chronique.`)}>📨 Rappel parents</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="ped-card fu" style={{ marginTop:20 }}>
                <div className="ped-card-hdr"><h3>🤖 Assistance IA — Pédiatrie</h3></div>
                <div style={{ padding:20, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:12 }}>
                  {[
                    { col:"#059669", ico:"💊", titre:"Calcul doses pédiatriques", desc:"Calcul automatique selon poids : Paracétamol 15mg/kg, Amox 40mg/kg/j..." },
                    { col:"#0EA5E9", ico:"📈", titre:"Analyse courbes de croissance", desc:"Comparaison automatique aux courbes OMS. Détection Z-score, alertes." },
                    { col:"#7C3AED", ico:"💉", titre:"Alertes vaccinales IA",       desc:"Rappel intelligent basé sur le calendrier PEV. Aucune notification SMS automatique pour l'instant." },
                    { col:"#D97706", ico:"🔍", titre:"Suggestions diagnostiques",   desc:"Aide au diagnostic différentiel basé sur l'âge et les symptômes." },
                  ].map((r, i) => (
                    // Sous-phase 5.7 — ces 4 cartes affichaient un faux
                    // succès "Module IA — {titre}" au clic, alors qu'aucune
                    // des 4 fonctionnalités décrites (calcul de doses,
                    // analyse de courbes, alertes vaccinales IA, suggestions
                    // diagnostiques) n'est réellement implémentée. Ce ne
                    // sont que des descriptions de fonctionnalités prévues :
                    // retirées du statut "cliquable" (plus de cursor:pointer
                    // ni d'onClick simulant une activation), avec un badge
                    // honnête plutôt qu'une fausse interaction.
                    <div key={i} style={{ background:"#F0FDF4", borderRadius:14, padding:"14px 16px", borderLeft:`3px solid ${r.col}` }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                        <div style={{ fontSize:22, marginBottom:6 }}>{r.ico}</div>
                        <span style={{ fontSize:10, fontWeight:700, color:"var(--pm)", background:"#fff", border:"1px solid var(--pbr)", borderRadius:99, padding:"2px 8px" }}>🚧 Prévu</span>
                      </div>
                      <div style={{ fontSize:13, fontWeight:700, color:"var(--pn)", marginBottom:4 }}>{r.titre}</div>
                      <div style={{ fontSize:11, color:"var(--pm)", lineHeight:1.5 }}>{r.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════ DOSSIER PATIENT ══════ */}
          {tab === "dossier" && enfantDossier && (
            <div className="fu">
              <button className="pbtn pbtn-ghost pbtn-sm" style={{ marginBottom:16 }} onClick={() => { setEnfantDossier(null); setTab("patients"); }}>
                ← Retour à la liste
              </button>

              {/* Header patient */}
              <div className="ped-card" style={{ marginBottom:16 }}>
                <div className="ped-card-hdr">
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <div style={{ width:52, height:52, borderRadius:12, background:"#ECFDF5", border:"2px solid #6EE7B7", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26 }}>
                      {enfantDossier.sexe==="F"?"👧":"👦"}
                    </div>
                    <div>
                      <div style={{ fontSize:17, fontWeight:800, color:"var(--pn)" }}>{enfantDossier.prenom} {enfantDossier.nom}</div>
                      <div style={{ fontSize:12, color:"var(--pm)", marginTop:3 }}>
                        {enfantDossier.numero} · {ageTexte(enfantDossier.date_naissance)} · {enfantDossier.sexe==="F"?"Fille":"Garçon"} · GS {enfantDossier.groupe_sanguin||"—"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button className="pbtn pbtn-green pbtn-sm" onClick={() => openModal("consultation", enfantDossier)}>🩺 Consultation</button>
                    <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => openModal("vaccination", enfantDossier)}>💉 Vacciner</button>
                  </div>
                </div>
                <div style={{ padding:16, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12 }}>
                  {[
                    ["👨‍👩‍👦 Parent / Tuteur", enfantDossier.parent_nom||"—"],
                    ["📞 Téléphone",        enfantDossier.parent_tel||"—"],
                    ["📅 Date de naissance",fmtDate(enfantDossier.date_naissance)],
                    ["🩸 Groupe sanguin",   enfantDossier.groupe_sanguin||"—"],
                    ["⚠️ Allergies",        enfantDossier.allergies||"Aucune connue"],
                    ["📋 Antécédents",      enfantDossier.antecedents||"Aucun"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background:"#F8FAFD", borderRadius:10, padding:"10px 14px", border:"1.5px solid var(--pbr)" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"var(--pm)", marginBottom:3 }}>{k}</div>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--pn)" }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16, marginBottom:16 }}>
                {/* Consultations récentes */}
                <div className="ped-card">
                  <div className="ped-card-hdr">
                    <div><h3>🩺 Consultations récentes</h3></div>
                    <button className="pbtn pbtn-green pbtn-sm" onClick={() => openModal("consultation", enfantDossier)}>➕</button>
                  </div>
                  <div style={{ padding:14 }}>
                    {consultations.filter(c=>(c.enfant?._id||c.enfant)===enfantDossier._id).slice(0,5).length === 0 ? (
                      <div style={{ textAlign:"center", color:"var(--pm)", padding:"16px 0", fontSize:12 }}>Aucune consultation enregistrée</div>
                    ) : consultations.filter(c=>(c.enfant?._id||c.enfant)===enfantDossier._id).slice(0,5).map((c,i)=>(
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid var(--pbr)", fontSize:12 }}>
                        <div>
                          <div style={{ fontWeight:700, color:"var(--pn)", fontSize:13 }}>{c.motif||"—"}</div>
                          <div style={{ color:"var(--pm)", fontSize:11 }}>{fmtDate(c.date)} · {c.medecin||"—"}</div>
                        </div>
                        <Badge cls={c.type==="urgence"?"red":c.type==="vaccination"?"green":"blue"}>{c.type||"—"}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vaccinations */}
                <div className="ped-card">
                  <div className="ped-card-hdr">
                    <div><h3>💉 Vaccinations</h3></div>
                    <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => openModal("vaccination", enfantDossier)}>➕</button>
                  </div>
                  <div style={{ padding:14 }}>
                    {(enfantDossier.vaccinations||[]).length === 0 ? (
                      <div style={{ textAlign:"center", color:"var(--pm)", padding:"16px 0", fontSize:12 }}>Aucune vaccination enregistrée</div>
                    ) : [...(enfantDossier.vaccinations||[])].reverse().slice(0,6).map((v,i)=>(
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid var(--pbr)", fontSize:12 }}>
                        <div>
                          <div style={{ fontWeight:700, color:"var(--pn)", fontSize:13 }}>{v.vaccin}</div>
                          <div style={{ color:"var(--pm)", fontSize:11 }}>{fmtDate(v.date)} · Dose {v.dose||1}</div>
                        </div>
                        <Badge cls="green">✅</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Courbe de croissance */}
              <div className="ped-card fu">
                <div className="ped-card-hdr"><div><h3>📏 Mesures de croissance</h3><p>5 dernières mesures</p></div></div>
                <div style={{ padding:14 }}>
                  {(enfantDossier.mesures_croissance||[]).length === 0 ? (
                    <div style={{ textAlign:"center", color:"var(--pm)", padding:"16px 0", fontSize:12 }}>Aucune mesure enregistrée</div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {[...(enfantDossier.mesures_croissance||[])].reverse().slice(0,5).map((m,i)=>(
                        <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:10, background:"#F8FAFD", borderRadius:10, padding:"10px 14px", border:"1.5px solid var(--pbr)" }}>
                          <div><div style={{ fontSize:11, color:"var(--pm)", fontWeight:700 }}>Date</div><div style={{ fontSize:12, fontWeight:600, color:"var(--pn)" }}>{fmtDate(m.date)}</div></div>
                          <div><div style={{ fontSize:11, color:"var(--pm)", fontWeight:700 }}>Poids</div><div style={{ fontSize:13, fontWeight:700, color:"var(--pg)" }}>{m.poids?`${m.poids} kg`:"—"}</div></div>
                          <div><div style={{ fontSize:11, color:"var(--pm)", fontWeight:700 }}>Taille</div><div style={{ fontSize:13, fontWeight:700, color:"var(--pb2)" }}>{m.taille?`${m.taille} cm`:"—"}</div></div>
                          <div><div style={{ fontSize:11, color:"var(--pm)", fontWeight:700 }}>Périm. crân.</div><div style={{ fontSize:13, fontWeight:700, color:"var(--pp)" }}>{m.perimetre_cranien?`${m.perimetre_cranien} cm`:"—"}</div></div>
                          <div><div style={{ fontSize:11, color:"var(--pm)", fontWeight:700 }}>IMC</div><Badge cls={m.imc&&m.imc<18.5?"blue":m.imc&&m.imc>25?"orange":"green"}>{m.imc||"—"}</Badge></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── MODALS ── */}
      {modal === "dossier" && <ModalDossier onClose={closeModal} saving={saving}/>}
      {modal === "consultation" && (
        <ModalConsultation
          enfant={selectedEnfant}
          patientNom={selectedEnfant ? `${selectedEnfant.prenom||""} ${selectedEnfant.nom}`.trim() : "Patient"}
          onClose={closeModal}
          saving={saving}
        />
      )}
      {modal === "vaccination" && (
        <ModalVaccination
          enfant={selectedEnfant}
          patientNom={selectedEnfant ? `${selectedEnfant.prenom||""} ${selectedEnfant.nom}`.trim() : "Patient"}
          onClose={closeModal}
          saving={saving}
        />
      )}
      {mesureModalOpen && selectedEnfant && (
        <ModalMesure
          enfant={selectedEnfant}
          patientNom={`${selectedEnfant.prenom||""} ${selectedEnfant.nom}`.trim()}
          onClose={() => setMesureModalOpen(false)}
          saving={saving}
        />
      )}
      {modal === "maladieChron" && (
        <ModalMaladieChron
          enfant={selectedEnfant}
          enfants={enfants}
          onClose={closeModal}
          saving={saving}
        />
      )}
    </>
  );
}
