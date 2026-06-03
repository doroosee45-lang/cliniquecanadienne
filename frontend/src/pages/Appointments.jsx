


import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchAppointments, createAppointment, updateAppointment, cancelAppointment,
  selectAppointments, selectAppointmentsLoading, selectAppointmentsTotal,
} from '../store/slices/appointmentsSlice';
// import api from "../api";
// import toast from "react-hot-toast";

// ─── Stub toast & api for standalone preview ─────────────────
const toast = {
  success: (m) => console.log("✅", m),
  error: (m) => console.error("❌", m),
  loading: (m, o) => console.log("⏳", m),
};
const api = {
  get: async () => { throw new Error("demo"); },
  post: async () => { throw new Error("demo"); },
  put: async () => { throw new Error("demo"); },
};

// ─── Chart.js loader ─────────────────────────────────────────
function loadChartJs(cb) {
  if (window.Chart) { cb(); return; }
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
  s.onload = cb;
  document.head.appendChild(s);
}

// ─── CSS — identique au style Chirurgie ──────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.rdv * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --cn: #0B1E3B; --cn2: #132744; --cb: #1B4F9E;
  --ct: #0EA5A0; --ct2: #0D9490; --cr: #DC2626;
  --co: #D97706; --cg: #059669; --cp: #7C3AED;
  --cbr: #E2EAF4; --cm: #6B7A99; --cl: #EEF4FF; --cs: #F8FAFD;
  --sh: 0 1px 3px rgba(11,30,59,.08); --shm: 0 4px 16px rgba(11,30,59,.10); --shl: 0 12px 40px rgba(11,30,59,.14);
}

/* Topbar */
.rdv-top { background:linear-gradient(135deg,var(--cn) 0%,var(--cn2) 55%,#1B4F9E 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.rdv-top::before { content:''; position:absolute; top:-50px; right:-50px; width:200px; height:200px; background:radial-gradient(circle,rgba(14,165,160,.22) 0%,transparent 70%); border-radius:50%; pointer-events:none; }

/* Tabs */
.rdv-tabs { display:flex; gap:2px; padding:0; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.rdv-tabs::-webkit-scrollbar { display:none; }
.rdv-tab { display:flex; align-items:center; gap:7px; padding:10px 18px 12px; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.55); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.rdv-tab:hover { color:rgba(255,255,255,.88); background:rgba(255,255,255,.08); }
.rdv-tab.active { color:var(--cn); background:var(--cs); box-shadow:0 -2px 0 var(--ct) inset; }
.rdv-tab-badge { background:var(--cr); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:99px; animation:rdvP 2s infinite; }
@keyframes rdvP { 0%,100%{opacity:1} 50%{opacity:.4} }

/* Cards */
.rdv-card { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; }
.rdv-card:hover { box-shadow:var(--shm); }
.rdv-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.rdv-card-hdr h3 { font-size:14px; font-weight:700; color:var(--cn); margin:0; display:flex; align-items:center; gap:8px; }
.rdv-card-hdr p  { font-size:11px; color:var(--cm); margin:2px 0 0; }

/* KPI */
.rdv-kpi { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:pointer; }
.rdv-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.rdv-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.rdv-kpi.blue::before   { background:var(--cb); } .rdv-kpi.teal::before   { background:var(--ct); }
.rdv-kpi.red::before    { background:var(--cr); } .rdv-kpi.orange::before { background:var(--co); }
.rdv-kpi.green::before  { background:var(--cg); } .rdv-kpi.purple::before { background:var(--cp); }
.rdv-kpi.indigo::before { background:#4F46E5; }
.kpi-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
.kpi-icon.blue   { background:#EFF6FF; color:var(--cb); } .kpi-icon.teal   { background:#F0FDFC; color:var(--ct); }
.kpi-icon.red    { background:#FEF2F2; color:var(--cr); } .kpi-icon.orange { background:#FFF7ED; color:var(--co); }
.kpi-icon.green  { background:#ECFDF5; color:var(--cg); } .kpi-icon.purple { background:#F5F3FF; color:var(--cp); }
.kpi-icon.indigo { background:#EEF2FF; color:#4F46E5; }
.kpi-val { font-size:26px; font-weight:800; color:var(--cn); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.kpi-lbl { font-size:11.5px; font-weight:600; color:var(--cm); }
.kpi-sub { font-size:10.5px; color:#9CA3AF; margin-top:2px; }
.kpi-dot { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--cr); animation:rdvP 2s infinite; }

/* Badges */
.cbdg { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.cbdg.red    { background:#FEF2F2; color:var(--cr); border:1px solid #FECACA; }
.cbdg.orange { background:#FFF7ED; color:var(--co); border:1px solid #FED7AA; }
.cbdg.yellow { background:#FEFCE8; color:#CA8A04;   border:1px solid #FEF08A; }
.cbdg.green  { background:#ECFDF5; color:var(--cg); border:1px solid #A7F3D0; }
.cbdg.blue   { background:#EFF6FF; color:var(--cb); border:1px solid #BFDBFE; }
.cbdg.teal   { background:#F0FDFC; color:var(--ct); border:1px solid #99F6E4; }
.cbdg.purple { background:#F5F3FF; color:var(--cp); border:1px solid #DDD6FE; }
.cbdg.gray   { background:#F9FAFB; color:#4B5563;   border:1px solid #E5E7EB; }
.cbdg.indigo { background:#EEF2FF; color:#4F46E5;   border:1px solid #C7D2FE; }

/* Progress */
.rdv-prog { background:#EEF4FF; border-radius:99px; height:7px; overflow:hidden; }
.rdv-prog-f { height:100%; border-radius:99px; transition:width .5s; }

/* Buttons */
.cbtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; text-decoration:none; }
.cbtn-primary { background:var(--cb); color:#fff; } .cbtn-primary:hover { background:#174391; transform:translateY(-1px); }
.cbtn-teal    { background:var(--ct); color:#fff; } .cbtn-teal:hover    { background:var(--ct2); transform:translateY(-1px); }
.cbtn-ghost   { background:transparent; color:var(--cm); border:1.5px solid var(--cbr); }
.cbtn-ghost:hover { background:var(--cl); color:var(--cn); }
.cbtn-danger  { background:#FEF2F2; color:var(--cr); border:1.5px solid #FECACA; }
.cbtn-danger:hover { background:var(--cr); color:#fff; }
.cbtn-orange  { background:#FFF7ED; color:var(--co); border:1.5px solid #FED7AA; }
.cbtn-orange:hover { background:var(--co); color:#fff; }
.cbtn-sm { padding:6px 12px; font-size:12px; }
.cbtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }

/* Forms */
.clbl { font-size:12px; font-weight:600; color:var(--cm); margin-bottom:6px; display:block; }
.cinp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--cbr); background:#FAFBFF; font-size:13px; color:var(--cn); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.cinp:focus { border-color:var(--ct); box-shadow:0 0 0 3px rgba(14,165,160,.12); }

/* Table */
.rdv-tbl { width:100%; border-collapse:collapse; }
.rdv-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.rdv-tbl th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--cm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--cbr); white-space:nowrap; }
.rdv-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.rdv-tbl tbody tr:last-child td { border-bottom:none; }
.rdv-tbl tbody tr:hover { background:#F8FAFF; }

/* Modal */
.mov { position:fixed; inset:0; z-index:500; background:rgba(11,30,59,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.mov-box { background:#fff; border-radius:20px; box-shadow:var(--shl); width:100%; max-width:620px; max-height:90vh; overflow-y:auto; animation:slideUp .25s ease; }
@keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.mov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:#EEF4FF; position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.mov-hdr h3 { font-size:16px; font-weight:700; color:var(--cn); margin:0; display:flex; align-items:center; gap:10px; }
.mov-cls { width:32px; height:32px; border-radius:8px; background:#F3F7FF; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--cm); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.mov-cls:hover { background:#FEF2F2; color:var(--cr); }
.mov-body { padding:24px; }

/* Calendar */
.cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:1px; background:var(--cbr); border-radius:12px; overflow:hidden; }
.cal-head { background:#EEF4FF; padding:8px 4px; text-align:center; font-size:11px; font-weight:700; color:var(--cm); text-transform:uppercase; letter-spacing:.5px; }
.cal-day { background:#fff; min-height:80px; padding:6px; cursor:pointer; transition:background .15s; position:relative; }
.cal-day:hover { background:#F0FDFC; }
.cal-day.today { background:#EEF4FF; }
.cal-day.today .cal-day-nb { background:var(--ct); color:#fff; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; }
.cal-day.other-month { background:#FAFBFF; opacity:.5; }
.cal-day-nb { font-size:12px; font-weight:600; color:var(--cn); margin-bottom:4px; width:22px; height:22px; display:flex; align-items:center; justify-content:center; }
.cal-evt { font-size:10px; font-weight:600; border-radius:4px; padding:2px 5px; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:pointer; }
.cal-evt.confirme  { background:#ECFDF5; color:var(--cg); border-left:2px solid var(--cg); }
.cal-evt.attente   { background:#FFF7ED; color:var(--co); border-left:2px solid var(--co); }
.cal-evt.annule    { background:#FEF2F2; color:var(--cr); border-left:2px solid var(--cr); }
.cal-evt.termine   { background:#EFF6FF; color:var(--cb); border-left:2px solid var(--cb); }
.cal-evt.reporte   { background:#F5F3FF; color:var(--cp); border-left:2px solid var(--cp); }

/* Waiting room */
.wl-item { display:flex; align-items:center; gap:14px; padding:12px 16px; border-radius:12px; border:1.5px solid var(--cbr); background:#fff; transition:all .2s; }
.wl-item:hover { box-shadow:var(--shm); }
.wl-num { width:32px; height:32px; border-radius:10px; background:var(--cl); color:var(--cn); font-weight:800; font-size:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.wl-num.urgent { background:#FEF2F2; color:var(--cr); }

/* Alerts */
.al-ia   { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; border-left:4px solid var(--cb); border-radius:14px; padding:14px 18px; }
.al-warn { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--co); border-radius:14px; padding:14px 18px; }
.al-danger { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--cr); border-radius:14px; padding:14px 18px; }

/* Fade */
@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
.fu { animation:fadeUp .35s ease both; }

/* Section nav */
.sec-nav { display:flex; gap:6px; flex-wrap:wrap; padding:14px 20px; background:linear-gradient(to right,#F8FAFD,#EEF4FF); border-bottom:1.5px solid var(--cbr); }
.sec-btn { display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all .2s; color:var(--cm); background:none; font-family:'Poppins',sans-serif; }
.sec-btn:hover { background:white; color:var(--cn); border-color:var(--cbr); }
.sec-btn.active { background:var(--cn); color:white; border-color:var(--cn); }

/* ─── Grilles responsives ─── */
.rdv-g2       { display:grid; grid-template-columns:2fr 1fr; gap:20px; }
.rdv-g11      { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.rdv-g-side   { display:grid; grid-template-columns:1fr 320px; gap:20px; }
.rdv-form-g   { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.rdv-filters  { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.rdv-inp-s    { width:220px; }
.rdv-inp-m    { width:170px; }
.rdv-inp-l    { width:200px; }
.rdv-col-all  { grid-column:1/-1; }

/* ─── Responsive mobile (≤ 767px) ───────────────────────────── */
@media (max-width:767px) {
  /* Topbar plus compact */
  .rdv-top { padding:12px 14px 0; }
  .rdv-tab { padding:7px 10px 9px; font-size:11px; gap:4px; }

  /* KPI cards */
  .kpi-val  { font-size:20px; }
  .kpi-icon { width:34px; height:34px; margin-bottom:8px; font-size:14px; }
  .kpi-lbl  { font-size:10.5px; }
  .kpi-sub  { font-size:10px; }
  .rdv-kpi  { padding:14px 16px; border-radius:14px; }

  /* Grilles → 1 colonne */
  .rdv-g2, .rdv-g11, .rdv-g-side { grid-template-columns:1fr; gap:14px; }

  /* Formulaire modal → 1 colonne */
  .rdv-form-g { grid-template-columns:1fr; }
  .rdv-col-all { grid-column:1; }

  /* Filtres → pleine largeur */
  .rdv-filters { flex-direction:column; align-items:stretch; }
  .rdv-inp-s, .rdv-inp-m, .rdv-inp-l { width:100%; }

  /* Inputs anti-zoom iOS */
  .cinp { font-size:16px !important; padding:10px 12px; }

  /* Boutons */
  .cbtn    { font-size:12px; padding:8px 12px; }
  .cbtn-sm { font-size:11px; padding:5px 8px; }

  /* Cards */
  .rdv-card      { border-radius:14px; }
  .rdv-card-hdr  { padding:11px 14px; }
  .rdv-card-hdr h3 { font-size:13px; }

  /* Table */
  .rdv-tbl th { padding:8px 10px; font-size:10.5px; }
  .rdv-tbl td { padding:9px 10px; font-size:12px; }

  /* Waiting room */
  .wl-item { flex-wrap:wrap; gap:8px; padding:10px 12px; }
  .wl-num  { width:28px; height:28px; font-size:13px; }

  /* Section nav */
  .sec-nav { padding:10px 12px; gap:4px; }
  .sec-btn { padding:5px 10px; font-size:11px; }

  /* Modal → bottom-sheet */
  .mov     { padding:0; align-items:flex-end; }
  .mov-box { border-radius:20px 20px 0 0; max-width:100%; max-height:93vh; }
  .mov-hdr { padding:13px 16px; }
  .mov-body{ padding:14px; }
}

/* ─── Très petit écran (≤ 479px) ───────────────────────────── */
@media (max-width:479px) {
  .kpi-val  { font-size:18px; }
  .rdv-kpi  { padding:12px 14px; }
  .cbtn     { font-size:11.5px; padding:7px 10px; }
  .rdv-card-hdr { flex-wrap:wrap; gap:8px; }
}
`;

// ─── Helpers ─────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const fmtDateInput = (d) => d ? new Date(d).toISOString().substring(0, 10) : "";
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";
const today = new Date();

const STATUT_CFG = {
  attente:       { cls: "orange", label: "En attente",      dot: "#D97706" },
  confirme:      { cls: "green",  label: "Confirmé",        dot: "#059669" },
  arrive:        { cls: "teal",   label: "Arrivé",          dot: "#0EA5A0" },
  en_consultation:{ cls:"blue",   label: "En consultation", dot: "#1B4F9E" },
  termine:       { cls: "gray",   label: "Terminé",         dot: "#6B7280" },
  reporte:       { cls: "purple", label: "Reporté",         dot: "#7C3AED" },
  annule:        { cls: "red",    label: "Annulé",          dot: "#DC2626" },
  absent:        { cls: "red",    label: "Absent",          dot: "#DC2626" },
};

const MOTIF_CFG = {
  consultation:      "🩺 Consultation",
  controle:          "🔄 Contrôle",
  vaccination:       "💉 Vaccination",
  echographie:       "🔊 Échographie",
  imagerie:          "🩻 Imagerie",
  analyse:           "🔬 Analyse laboratoire",
  chirurgie:         "🔪 Chirurgie",
  hospitalisation:   "🛏 Hospitalisation",
};

// ─── Demo data ────────────────────────────────────────────────
const DEMO_RDVS = [
  { _id:"1", reference:"RDV-001", patient_nom:"Jean Dupont",    patient_tel:"+242 06 123 4567", date:"2026-06-01T09:00:00", duree:30, medecin_nom:"Dr. Martin Leblanc", service:"Chirurgie",    motif:"consultation",    statut:"confirme",  salle:"Salle 1", notes:"Suivi hernie inguinale" },
  { _id:"2", reference:"RDV-002", patient_nom:"Marie Paul",     patient_tel:"+242 05 987 6543", date:"2026-06-01T10:30:00", duree:45, medecin_nom:"Dr. Sophie Pierre",  service:"Gynécologie",  motif:"controle",        statut:"arrive",    salle:"Salle 3", notes:"" },
  { _id:"3", reference:"RDV-003", patient_nom:"Paul Nguema",    patient_tel:"+242 06 555 0011", date:"2026-06-01T11:00:00", duree:60, medecin_nom:"Dr. Martin Leblanc", service:"Urgences",     motif:"chirurgie",       statut:"en_consultation", salle:"Bloc 1", notes:"Urgence absolue" },
  { _id:"4", reference:"RDV-004", patient_nom:"Fatou Bongo",    patient_tel:"+242 05 222 3344", date:"2026-06-01T14:00:00", duree:20, medecin_nom:"Dr. Claire Mba",     service:"Pédiatrie",    motif:"vaccination",     statut:"attente",   salle:"Salle 2", notes:"" },
  { _id:"5", reference:"RDV-005", patient_nom:"André Mboula",   patient_tel:"+242 06 777 8899", date:"2026-06-01T15:30:00", duree:30, medecin_nom:"Dr. Sophie Pierre",  service:"Cardiologie",  motif:"echographie",     statut:"attente",   salle:"Salle Echo", notes:"Contrôle post-op" },
  { _id:"6", reference:"RDV-006", patient_nom:"Brigitte Obam",  patient_tel:"+242 06 111 2233", date:"2026-06-02T09:00:00", duree:30, medecin_nom:"Dr. Claire Mba",     service:"Médecine gén.","motif":"controle",       statut:"confirme",  salle:"Salle 1", notes:"" },
  { _id:"7", reference:"RDV-007", patient_nom:"Clément Ondo",   patient_tel:"+242 05 444 5566", date:"2026-06-02T11:00:00", duree:45, medecin_nom:"Dr. Martin Leblanc", service:"Chirurgie",    motif:"consultation",    statut:"attente",   salle:"Salle 2", notes:"" },
  { _id:"8", reference:"RDV-008", patient_nom:"Sylvie Ndong",   patient_tel:"+242 06 333 7788", date:"2026-06-03T10:00:00", duree:30, medecin_nom:"Dr. Sophie Pierre",  service:"Gynécologie",  motif:"echographie",     statut:"confirme",  salle:"Salle Echo", notes:"" },
  { _id:"9", reference:"RDV-009", patient_nom:"Marc Ella",      patient_tel:"+242 05 888 9900", date:"2026-05-31T09:30:00", duree:20, medecin_nom:"Dr. Claire Mba",     service:"Pédiatrie",    motif:"vaccination",     statut:"termine",   salle:"Salle 2", notes:"" },
  { _id:"10",reference:"RDV-010", patient_nom:"Rose Minko",     patient_tel:"+242 06 999 1122", date:"2026-05-30T16:00:00", duree:30, medecin_nom:"Dr. Martin Leblanc", service:"Chirurgie",    motif:"controle",        statut:"annule",    salle:"Salle 1", notes:"Annulé par patient" },
];

const DEMO_MEDECINS = [
  { _id:"m1", nom:"Dr. Martin Leblanc", specialite:"Chirurgie Générale",  color:"#1B4F9E" },
  { _id:"m2", nom:"Dr. Sophie Pierre",  specialite:"Gynécologie",         color:"#7C3AED" },
  { _id:"m3", nom:"Dr. Claire Mba",     specialite:"Pédiatrie / Méd. gén",color:"#0EA5A0" },
];

const EMPTY_RDV = {
  patient_nom:"", patient_tel:"", patient_email:"",
  date:"", heure:"", duree:"30",
  motif:"consultation", service:"", medecin_id:"", salle:"", notes:"",
  statut:"attente",
};

// ─── SVG Icons ────────────────────────────────────────────────
const I = {
  cal:      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  plus:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  clock:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  check:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  x:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  edit:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  user:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  bell:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  grid:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  list:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  repeat:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>,
  chart:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  history:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>,
  save:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  print:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  phone:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.01 2.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>,
  sms:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  report:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
};

// ─── Modal ────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, maxWidth = 620 }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="mov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mov-box" style={{ maxWidth }}>
        <div className="mov-hdr">
          <h3>{title}</h3>
          <button className="mov-cls" onClick={onClose}>×</button>
        </div>
        <div className="mov-body">{children}</div>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({ color, icon, value, label, sub, urgent, onClick }) {
  return (
    <div className={`rdv-kpi ${color} fu`} onClick={onClick}>
      {urgent && <div className="kpi-dot" />}
      <div className={`kpi-icon ${color}`}>{icon}</div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-lbl">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function Badge({ cls, children }) {
  return <span className={`cbdg ${cls}`}>{children}</span>;
}

function Prog({ pct, color }) {
  return (
    <div className="rdv-prog">
      <div className="rdv-prog-f" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────
function BarChart({ labels, data, color = "#1B4F9E", height = 200 }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new window.Chart(ref.current, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            data, backgroundColor: `${color}26`, borderColor: color,
            borderWidth: 2, borderRadius: 8, borderSkipped: false,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: { legend: { display: false }, tooltip: { backgroundColor: "#0B1E3B", padding: 10, cornerRadius: 10 } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#9CA3AF" }, border: { display: false } },
            y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.04)" }, ticks: { font: { size: 10 }, color: "#9CA3AF", precision: 0 }, border: { display: false } },
          },
        },
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [labels, data, color]);
  return <canvas ref={ref} style={{ maxHeight: height }} />;
}

// ─── Mini Calendar ────────────────────────────────────────────
function CalendrierMois({ rdvs, onDayClick }) {
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = offset - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, other: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, other: false });
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - daysInMonth - offset + 1, other: true });

  const rdvsByDay = {};
  rdvs.forEach(r => {
    const d = new Date(r.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const k = d.getDate();
      if (!rdvsByDay[k]) rdvsByDay[k] = [];
      rdvsByDay[k].push(r);
    }
  });

  const jours = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  const moisNom = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}>←</button>
        <span style={{ fontWeight:700, color:"var(--cn)", fontSize:14 }}>{moisNom[month]} {year}</span>
        <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}>→</button>
      </div>
      <div className="cal-grid">
        {jours.map(j => <div key={j} className="cal-head">{j}</div>)}
        {cells.map((cell, idx) => {
          const isToday = !cell.other && cell.day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const evts = cell.other ? [] : (rdvsByDay[cell.day] || []);
          return (
            <div key={idx} className={`cal-day ${isToday ? "today" : ""} ${cell.other ? "other-month" : ""}`}
              onClick={() => !cell.other && onDayClick && onDayClick(new Date(year, month, cell.day))}>
              <div className="cal-day-nb">{cell.day}</div>
              {evts.slice(0, 3).map(r => (
                <div key={r._id} className={`cal-evt ${r.statut}`} title={`${fmtTime(r.date)} — ${r.patient_nom}`}>
                  {fmtTime(r.date)} {r.patient_nom.split(" ")[0]}
                </div>
              ))}
              {evts.length > 3 && <div style={{ fontSize:9, color:"var(--cm)", fontWeight:600 }}>+{evts.length - 3} autres</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══ MAIN ═════════════════════════════════════════════════════
export default function RendezVous() {
  const dispatch = useDispatch();
  const reduxRdvs = useSelector(selectAppointments);

  useEffect(() => { dispatch(fetchAppointments({})); }, [dispatch]);

  // Détection mobile pour les onglets (inline styles → priorité absolue)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 599);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const [tab, setTab]               = useState("dashboard");
  const [rdvs, setRdvs]             = useState(DEMO_RDVS);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState("");
  const [filterStatut, setFilter]   = useState("");
  const [filterMedecin, setFilterMedecin] = useState("");
  const [calView, setCalView]       = useState("mois"); // mois | semaine | jour | agenda
  const [saving, setSaving]         = useState(false);
  const [selectedRdv, setSelectedRdv] = useState(null);

  // Modals
  const [modalNouv, setModalNouv]       = useState(false);
  const [modalDetail, setModalDetail]   = useState(false);
  const [modalReport, setModalReport]   = useState(false);
  const [modalNotif, setModalNotif]     = useState(false);

  // Form
  const [formRdv, setFormRdv]           = useState(EMPTY_RDV);
  const [formReport, setFormReport]     = useState({ date:"", heure:"", motif:"" });

  // KPIs computed
  const aujourd_hui = rdvs.filter(r => {
    const d = new Date(r.date); return d.toDateString() === today.toDateString();
  });
  const kpis = {
    aujourd_hui: aujourd_hui.length,
    semaine: rdvs.filter(r => {
      const d = new Date(r.date); const start = new Date(today); start.setDate(today.getDate() - today.getDay() + 1);
      const end = new Date(start); end.setDate(start.getDate() + 6);
      return d >= start && d <= end;
    }).length,
    confirmes: rdvs.filter(r => r.statut === "confirme").length,
    attente: rdvs.filter(r => r.statut === "attente").length,
    annules: rdvs.filter(r => r.statut === "annule").length,
    reporte: rdvs.filter(r => r.statut === "reporte").length,
    en_salle: rdvs.filter(r => ["arrive","en_consultation"].includes(r.statut) && new Date(r.date).toDateString() === today.toDateString()).length,
  };

  // Salles attente (aujourd'hui)
  const salleAttente = rdvs
    .filter(r => new Date(r.date).toDateString() === today.toDateString() && ["arrive","en_consultation","attente"].includes(r.statut))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Filtered list
  const rdvsFiltres = rdvs.filter(r => {
    const q = search.toLowerCase();
    const matchQ = !q || r.patient_nom.toLowerCase().includes(q) || r.reference.toLowerCase().includes(q) || r.medecin_nom.toLowerCase().includes(q);
    const matchS = !filterStatut || r.statut === filterStatut;
    const matchM = !filterMedecin || r.medecin_nom === filterMedecin;
    return matchQ && matchS && matchM;
  });

  // Actions
  const updateStatut = (id, statut) => {
    setRdvs(prev => prev.map(r => r._id === id ? { ...r, statut } : r));
    if (selectedRdv?._id === id) setSelectedRdv(r => ({ ...r, statut }));
    toast.success(`✅ Statut mis à jour : ${STATUT_CFG[statut]?.label}`);
  };

  const createRdv = (e) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      const newRdv = {
        ...formRdv,
        _id: Date.now().toString(),
        reference: `RDV-${String(rdvs.length + 1).padStart(3,"0")}`,
        date: formRdv.date && formRdv.heure ? `${formRdv.date}T${formRdv.heure}:00` : new Date().toISOString(),
        medecin_nom: DEMO_MEDECINS.find(m => m._id === formRdv.medecin_id)?.nom || "—",
      };
      setRdvs(prev => [newRdv, ...prev]);
      toast.success(`✅ Rendez-vous ${newRdv.reference} créé`);
      setModalNouv(false);
      setFormRdv(EMPTY_RDV);
      setSaving(false);
    }, 600);
  };

  const reporterRdv = (e) => {
    e.preventDefault();
    if (!selectedRdv) return;
    const newDate = `${formReport.date}T${formReport.heure}:00`;
    setRdvs(prev => prev.map(r => r._id === selectedRdv._id ? { ...r, statut:"reporte", date:newDate } : r));
    toast.success("📅 Rendez-vous reporté");
    setModalReport(false);
    setFormReport({ date:"", heure:"", motif:"" });
  };

  // Chart data
  const moisLabels = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
  const moisData   = [38, 52, 45, 61, 73, 58, 42, 35, 50, 67, 55, 70];
  const tauxPresence = Math.round(rdvs.filter(r => r.statut === "termine").length / Math.max(1,rdvs.filter(r=>!["attente","confirme"].includes(r.statut)).length) * 100);

  return (
    <>
      <style>{CSS}</style>
      <div className="rdv">

        {/* ── TOPBAR ─────────────────────────────────────────── */}
        <div className="rdv-top">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap", position:"relative", zIndex:2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:54, height:54, borderRadius:14, background:"rgba(255,255,255,.12)", border:"1.5px solid rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {I.cal}
              </div>
              <div>
                <div style={{ fontSize:21, fontWeight:700, color:"#fff", letterSpacing:-.3 }}>Rendez-vous</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.55)", marginTop:2 }}>
                  {kpis.aujourd_hui} RDV aujourd'hui · {kpis.en_salle} en salle · Clinique Canadienne de Souanké
                </div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button className="cbtn cbtn-teal" onClick={() => { setFormRdv(EMPTY_RDV); setModalNouv(true); }}>
                {I.plus} Nouveau rendez-vous
              </button>
              <button className="cbtn cbtn-ghost" style={{ color:"#fff", borderColor:"rgba(255,255,255,.3)" }} onClick={() => setModalNotif(true)}>
                {I.bell} Notifications
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={isMobile ? {
            display:'grid', gridTemplateColumns:'repeat(3,1fr)',
            gap:'4px', padding:'8px 10px', marginTop:'8px',
            background:'rgba(255,255,255,.07)', borderRadius:'10px 10px 0 0',
          } : {
            display:'flex', gap:'2px', padding:'0', marginTop:'16px',
            overflowX:'auto', scrollbarWidth:'none',
          }}>
            {[
              { key:"dashboard",  icon:I.grid,   label: isMobile ? "Dashboard"  : "Tableau de bord" },
              { key:"calendrier", icon:I.cal,    label:"Calendrier" },
              { key:"liste",      icon:I.list,   label: isMobile ? "Liste RDV"  : "Liste des RDV", badge: kpis.attente > 0 ? kpis.attente : null },
              { key:"attente",    icon:I.clock,  label: isMobile ? "Salle att." : "Salle d'attente", badge: kpis.en_salle > 0 ? kpis.en_salle : null },
              { key:"recurrents", icon:I.repeat, label: isMobile ? "Récurrents" : "RDV récurrents" },
              { key:"rapports",   icon:I.chart,  label:"Rapports" },
            ].map(t => (
              <button
                key={t.key}
                className={`rdv-tab ${tab === t.key ? "active" : ""}`}
                style={isMobile ? {
                  flexDirection:'column', alignItems:'center', justifyContent:'center',
                  textAlign:'center', padding:'7px 4px 8px', fontSize:'9.5px',
                  gap:'3px', borderRadius:'8px', whiteSpace:'normal', minWidth:0,
                } : {}}
                onClick={() => setTab(t.key)}
              >
                {t.icon}
                <span style={isMobile ? { lineHeight:1.2 } : {}}>{t.label}</span>
                {t.badge && <span className="rdv-tab-badge">{t.badge}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ── CONTENT ─────────────────────────────────────────── */}
        <div style={{ padding:24 }}>

          {/* ══════════ DASHBOARD ══════════ */}
          {tab === "dashboard" && (
            <div>
              {/* Alerte en attente */}
              {kpis.attente > 0 && (
                <div className="al-warn fu" style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, flexWrap:"wrap" }}>
                  <div style={{ width:42, height:42, background:"#FEF3C7", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {I.clock}
                  </div>
                  <div style={{ flex:1 }}>
                    <strong style={{ color:"#92400E", fontSize:13 }}>📅 Rendez-vous en attente de confirmation</strong>
                    <div style={{ fontSize:12, color:"#B45309", marginTop:3 }}>
                      <strong>{kpis.attente}</strong> rendez-vous nécessitent une confirmation. Veuillez les traiter dès que possible.
                    </div>
                  </div>
                  <button className="cbtn cbtn-orange cbtn-sm" onClick={() => { setFilter("attente"); setTab("liste"); }}>Voir les RDV →</button>
                </div>
              )}

              {/* KPIs */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="blue"   icon={I.cal}   value={kpis.aujourd_hui} label="RDV aujourd'hui"   sub="toutes statuts"       onClick={() => { setFilter(""); setTab("liste"); }} />
                <KpiCard color="indigo" icon={I.chart} value={kpis.semaine}     label="Cette semaine"     sub="7 jours glissants"     onClick={() => setTab("calendrier")} />
                <KpiCard color="green"  icon={I.check} value={kpis.confirmes}   label="Confirmés"         sub="en attente de venue"  onClick={() => { setFilter("confirme"); setTab("liste"); }} />
                <KpiCard color="orange" icon={I.clock} value={kpis.attente}     label="En attente"        sub="à confirmer"          urgent={kpis.attente > 0} onClick={() => { setFilter("attente"); setTab("liste"); }} />
                <KpiCard color="red"    icon={I.x}     value={kpis.annules}     label="Annulés"           sub="ce mois"              onClick={() => { setFilter("annule"); setTab("liste"); }} />
                <KpiCard color="teal"   icon={I.user}  value={kpis.en_salle}    label="En salle maintenant" sub="arrivés + en consult" onClick={() => setTab("attente")} />
              </div>

              {/* Main grid */}
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:20, marginBottom:24 }}>
                {/* Calendrier aperçu */}
                <div className="rdv-card fu">
                  <div className="rdv-card-hdr">
                    <div><h3>{I.cal} Calendrier mensuel</h3><p>Vue globale des rendez-vous</p></div>
                    <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => setTab("calendrier")}>Plein écran →</button>
                  </div>
                  <div style={{ padding:20 }}>
                    <CalendrierMois rdvs={rdvs} onDayClick={() => setTab("calendrier")} />
                  </div>
                </div>

                {/* Panel droit */}
                <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                  {/* RDV du jour */}
                  <div className="rdv-card fu">
                    <div className="rdv-card-hdr">
                      <div><h3>📋 Aujourd'hui</h3><p>{aujourd_hui.length} rendez-vous</p></div>
                    </div>
                    <div style={{ padding:"8px 0", maxHeight:260, overflowY:"auto" }}>
                      {aujourd_hui.length === 0 ? (
                        <div style={{ padding:"20px", textAlign:"center", color:"var(--cm)", fontSize:13 }}>Aucun RDV aujourd'hui</div>
                      ) : aujourd_hui.sort((a,b) => new Date(a.date)-new Date(b.date)).map(r => {
                        const sc = STATUT_CFG[r.statut] || {};
                        return (
                          <div key={r._id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 16px", borderBottom:"1px solid #F3F7FF", cursor:"pointer", transition:"background .15s" }}
                            onClick={() => { setSelectedRdv(r); setModalDetail(true); }}
                            onMouseOver={e=>e.currentTarget.style.background="#F8FAFF"}
                            onMouseOut={e=>e.currentTarget.style.background=""}>
                            <div style={{ width:6, height:6, borderRadius:"50%", background:sc.dot || "#6B7280", flexShrink:0 }} />
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontWeight:600, fontSize:12.5, color:"var(--cn)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.patient_nom}</div>
                              <div style={{ fontSize:11, color:"var(--cm)" }}>{fmtTime(r.date)} · {r.medecin_nom.replace("Dr. ","")}</div>
                            </div>
                            <Badge cls={sc.cls}>{sc.label}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Répartition */}
                  <div className="rdv-card fu">
                    <div className="rdv-card-hdr"><div><h3>📊 Répartition</h3><p>{rdvs.length} RDV total</p></div></div>
                    <div style={{ padding:16 }}>
                      {[
                        ["Confirmés",    kpis.confirmes, "#059669"],
                        ["En attente",   kpis.attente,   "#D97706"],
                        ["Annulés",      kpis.annules,   "#DC2626"],
                        ["Reportés",     kpis.reporte,   "#7C3AED"],
                      ].map(([lbl, val, col]) => (
                        <div key={lbl} style={{ marginBottom:8 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                            <span style={{ fontSize:11.5, color:"var(--cm)", display:"flex", alignItems:"center", gap:6 }}>
                              <span style={{ width:8, height:8, borderRadius:2, background:col, display:"inline-block" }} />
                              {lbl}
                            </span>
                            <span style={{ fontWeight:700, fontSize:11.5, color:"var(--cn)" }}>{val}</span>
                          </div>
                          <Prog pct={rdvs.length > 0 ? Math.round(val / rdvs.length * 100) : 0} color={col} />
                        </div>
                      ))}
                      <div style={{ marginTop:12, paddingTop:10, borderTop:"1px solid var(--cbr)", display:"flex", justifyContent:"space-between", fontSize:11.5, color:"var(--cm)" }}>
                        <span>Taux de présence</span>
                        <strong style={{ color:"var(--cg)" }}>{tauxPresence}%</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RDV récents tableau */}
              <div className="rdv-card fu">
                <div className="rdv-card-hdr">
                  <div><h3>{I.list} Derniers rendez-vous</h3><p>Activité récente</p></div>
                  <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => setTab("liste")}>Voir tous →</button>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table className="rdv-tbl">
                    <thead>
                      <tr>
                        <th>Référence</th><th>Patient</th><th>Date / Heure</th>
                        <th>Médecin</th><th>Service</th><th>Motif</th><th>Statut</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rdvs.slice(0, 8).map(r => {
                        const sc = STATUT_CFG[r.statut] || { cls:"gray", label:r.statut };
                        return (
                          <tr key={r._id}>
                            <td><span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--cb)", fontSize:12 }}>{r.reference}</span></td>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--cn)" }}>{r.patient_nom}</div>
                              <div style={{ fontSize:11, color:"var(--cm)", display:"flex", alignItems:"center", gap:4 }}>{I.phone} {r.patient_tel}</div>
                            </td>
                            <td>
                              <div style={{ fontWeight:600, fontSize:12, color:"var(--cn)" }}>{fmtDate(r.date)}</div>
                              <div style={{ fontSize:11, color:"var(--cm)" }}>{fmtTime(r.date)} · {r.duree} min</div>
                            </td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{r.medecin_nom}</td>
                            <td><Badge cls="blue">{r.service}</Badge></td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{MOTIF_CFG[r.motif] || r.motif}</td>
                            <td><Badge cls={sc.cls}>{sc.label}</Badge></td>
                            <td>
                              <button className="cbtn cbtn-ghost cbtn-sm" style={{ fontSize:11 }} onClick={() => { setSelectedRdv(r); setModalDetail(true); }}>
                                {I.edit} Gérer
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ CALENDRIER ══════════ */}
          {tab === "calendrier" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:20, flexWrap:"wrap" }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>Calendrier des rendez-vous</div>
                  <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>Cliquez sur un jour pour voir les détails</div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  {["mois","semaine","jour","agenda"].map(v => (
                    <button key={v} className={`cbtn cbtn-sm ${calView === v ? "cbtn-primary" : "cbtn-ghost"}`}
                      onClick={() => setCalView(v)} style={{ textTransform:"capitalize" }}>{v}</button>
                  ))}
                </div>
              </div>

              <div className="rdv-g-side">
                <div className="rdv-card">
                  <div style={{ padding:20 }}>
                    <CalendrierMois rdvs={rdvs} />
                  </div>
                </div>

                {/* Légende + médecins */}
                <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                  <div className="rdv-card">
                    <div className="rdv-card-hdr"><h3>🎨 Légende</h3></div>
                    <div style={{ padding:16 }}>
                      {[
                        ["confirme", "Confirmé"],
                        ["attente",  "En attente"],
                        ["annule",   "Annulé"],
                        ["termine",  "Terminé"],
                        ["reporte",  "Reporté"],
                      ].map(([st, lbl]) => {
                        const sc = STATUT_CFG[st];
                        return (
                          <div key={st} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, cursor:"pointer" }}
                            onClick={() => { setFilter(st); setTab("liste"); }}>
                            <div style={{ width:12, height:12, borderRadius:3, background:sc.dot, flexShrink:0 }} />
                            <span style={{ fontSize:12.5, color:"var(--cn)" }}>{lbl}</span>
                            <span style={{ marginLeft:"auto", fontWeight:700, fontSize:12, color:"var(--cm)" }}>
                              {rdvs.filter(r=>r.statut===st).length}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rdv-card">
                    <div className="rdv-card-hdr"><h3>👨‍⚕️ Médecins</h3></div>
                    <div style={{ padding:12 }}>
                      {DEMO_MEDECINS.map(m => (
                        <div key={m._id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 4px", borderBottom:"1px solid #F3F7FF", cursor:"pointer" }}
                          onClick={() => { setFilterMedecin(m.nom); setTab("liste"); }}>
                          <div style={{ width:10, height:10, borderRadius:"50%", background:m.color, flexShrink:0 }} />
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12.5, fontWeight:600, color:"var(--cn)" }}>{m.nom}</div>
                            <div style={{ fontSize:10.5, color:"var(--cm)" }}>{m.specialite}</div>
                          </div>
                          <Badge cls="blue">{rdvs.filter(r => r.medecin_nom === m.nom).length}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ LISTE ══════════ */}
          {tab === "liste" && (
            <div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>Liste des rendez-vous</div>
                  <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>{rdvsFiltres.length} rendez-vous</div>
                </div>
                <div className="rdv-filters">
                  <div style={{ position:"relative", flex:"1 1 200px" }}>
                    <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }}>{I.search}</span>
                    <input className="cinp rdv-inp-s" style={{ paddingLeft:34 }} placeholder="Patient, référence..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <select className="cinp rdv-inp-m" value={filterStatut} onChange={e => setFilter(e.target.value)}>
                    <option value="">Tous les statuts</option>
                    {Object.entries(STATUT_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <select className="cinp rdv-inp-l" value={filterMedecin} onChange={e => setFilterMedecin(e.target.value)}>
                    <option value="">Tous les médecins</option>
                    {DEMO_MEDECINS.map(m => <option key={m._id} value={m.nom}>{m.nom}</option>)}
                  </select>
                  <button className="cbtn cbtn-primary" onClick={() => { setFormRdv(EMPTY_RDV); setModalNouv(true); }}>
                    {I.plus} Nouveau RDV
                  </button>
                </div>
              </div>

              <div className="rdv-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="rdv-tbl" style={{ minWidth:1000 }}>
                    <thead>
                      <tr>
                        <th>Référence</th><th>Patient</th><th>Date</th><th>Heure</th>
                        <th>Médecin</th><th>Service</th><th>Motif</th><th>Salle</th>
                        <th>Statut</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rdvsFiltres.map(r => {
                        const sc = STATUT_CFG[r.statut] || { cls:"gray", label:r.statut };
                        return (
                          <tr key={r._id}>
                            <td><span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--cb)", fontSize:12 }}>{r.reference}</span></td>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--cn)" }}>{r.patient_nom}</div>
                              <div style={{ fontSize:11, color:"var(--cm)", display:"flex", alignItems:"center", gap:4 }}>{I.phone} {r.patient_tel}</div>
                            </td>
                            <td style={{ fontSize:12, fontWeight:600, color:"var(--cn)" }}>{fmtDate(r.date)}</td>
                            <td>
                              <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600, color:"var(--cn)" }}>
                                {I.clock} {fmtTime(r.date)}
                              </span>
                              <div style={{ fontSize:10.5, color:"var(--cm)" }}>{r.duree} min</div>
                            </td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{r.medecin_nom}</td>
                            <td><Badge cls="blue">{r.service}</Badge></td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{MOTIF_CFG[r.motif] || r.motif}</td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{r.salle || "—"}</td>
                            <td><Badge cls={sc.cls}>{sc.label}</Badge></td>
                            <td>
                              <div style={{ display:"flex", gap:4, flexWrap:"nowrap" }}>
                                <button className="cbtn cbtn-ghost cbtn-sm" style={{ fontSize:11, padding:"5px 8px" }} onClick={() => { setSelectedRdv(r); setModalDetail(true); }} title="Gérer">{I.edit}</button>
                                {r.statut === "attente" && (
                                  <button className="cbtn cbtn-sm" style={{ background:"#ECFDF5", color:"var(--cg)", border:"1px solid #A7F3D0", padding:"5px 8px", fontSize:11 }} onClick={() => updateStatut(r._id, "confirme")} title="Confirmer">{I.check}</button>
                                )}
                                {["attente","confirme"].includes(r.statut) && (
                                  <button className="cbtn cbtn-danger cbtn-sm" style={{ padding:"5px 8px", fontSize:11 }} onClick={() => updateStatut(r._id, "annule")} title="Annuler">{I.x}</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {rdvsFiltres.length === 0 && (
                        <tr><td colSpan={10} style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>
                          {search ? `Aucun résultat pour "${search}"` : "Aucun rendez-vous"}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ SALLE D'ATTENTE ══════════ */}
          {tab === "attente" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>Salle d'attente virtuelle</div>
                  <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>Suivi en temps réel — {new Date().toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long" })}</div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => { /* refresh */ }}>🔄 Actualiser</button>
                  <button className="cbtn cbtn-primary cbtn-sm" onClick={() => { setFormRdv(EMPTY_RDV); setModalNouv(true); }}>
                    {I.plus} Enregistrer arrivée
                  </button>
                </div>
              </div>

              {/* Stats attente */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
                {[
                  { color:"blue",   icon:I.user,  val: aujourd_hui.length,                                      lbl:"Prévus aujourd'hui",    sub:"total" },
                  { color:"teal",   icon:I.check, val: rdvs.filter(r=>r.statut==="arrive"&&new Date(r.date).toDateString()===today.toDateString()).length, lbl:"Arrivés", sub:"en salle" },
                  { color:"orange", icon:I.clock, val: rdvs.filter(r=>r.statut==="en_consultation"&&new Date(r.date).toDateString()===today.toDateString()).length, lbl:"En consultation", sub:"actuellement" },
                  { color:"green",  icon:I.check, val: rdvs.filter(r=>r.statut==="termine"&&new Date(r.date).toDateString()===today.toDateString()).length, lbl:"Terminés",      sub:"aujourd'hui" },
                ].map((k,i) => (
                  <KpiCard key={i} color={k.color} icon={k.icon} value={k.val} label={k.lbl} sub={k.sub} />
                ))}
              </div>

              <div className="rdv-g2">
                {/* File d'attente */}
                <div className="rdv-card">
                  <div className="rdv-card-hdr">
                    <div><h3>📋 File d'attente</h3><p>{salleAttente.length} patient(s)</p></div>
                  </div>
                  <div style={{ padding:16, display:"flex", flexDirection:"column", gap:10 }}>
                    {salleAttente.length === 0 ? (
                      <div style={{ padding:30, textAlign:"center", color:"var(--cm)", fontSize:13 }}>
                        <div style={{ fontSize:32, marginBottom:10 }}>✅</div>
                        Salle d'attente vide
                      </div>
                    ) : salleAttente.map((r, idx) => {
                      const sc = STATUT_CFG[r.statut] || {};
                      const isUrgent = r.notes && r.notes.toLowerCase().includes("urgence");
                      return (
                        <div key={r._id} className="wl-item">
                          <div className={`wl-num ${isUrgent ? "urgent" : ""}`}>{idx + 1}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:700, fontSize:13.5, color:"var(--cn)" }}>{r.patient_nom}</div>
                            <div style={{ fontSize:11.5, color:"var(--cm)", marginTop:2 }}>
                              {fmtTime(r.date)} · {r.medecin_nom} · {r.service}
                            </div>
                            {r.notes && <div style={{ fontSize:11, color:"var(--co)", marginTop:3 }}>⚠ {r.notes}</div>}
                          </div>
                          <Badge cls={sc.cls}>{sc.label}</Badge>
                          <div style={{ display:"flex", gap:4 }}>
                            {r.statut === "attente" && (
                              <button className="cbtn cbtn-sm" style={{ background:"#F0FDFC", color:"var(--ct)", border:"1px solid #99F6E4", padding:"5px 10px", fontSize:11 }}
                                onClick={() => updateStatut(r._id, "arrive")}>✓ Arrivé</button>
                            )}
                            {r.statut === "arrive" && (
                              <button className="cbtn cbtn-primary cbtn-sm" style={{ padding:"5px 10px", fontSize:11 }}
                                onClick={() => updateStatut(r._id, "en_consultation")}>▶ Consultation</button>
                            )}
                            {r.statut === "en_consultation" && (
                              <button className="cbtn cbtn-sm" style={{ background:"#ECFDF5", color:"var(--cg)", border:"1px solid #A7F3D0", padding:"5px 10px", fontSize:11 }}
                                onClick={() => updateStatut(r._id, "termine")}>✅ Terminé</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Infos médecins */}
                <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                  <div className="rdv-card">
                    <div className="rdv-card-hdr"><h3>👨‍⚕️ Médecins disponibles</h3></div>
                    <div style={{ padding:14 }}>
                      {DEMO_MEDECINS.map(m => {
                        const enConsult = rdvs.filter(r => r.medecin_nom === m.nom && r.statut === "en_consultation" && new Date(r.date).toDateString() === today.toDateString());
                        const enAttente = rdvs.filter(r => r.medecin_nom === m.nom && r.statut === "arrive" && new Date(r.date).toDateString() === today.toDateString());
                        return (
                          <div key={m._id} style={{ background:"#F8FAFD", borderRadius:12, padding:"12px 14px", marginBottom:10 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <div style={{ width:10, height:10, borderRadius:"50%", background: enConsult.length > 0 ? "#059669" : "#D1D5DB", flexShrink:0 }} />
                              <div style={{ flex:1 }}>
                                <div style={{ fontWeight:700, fontSize:12.5, color:"var(--cn)" }}>{m.nom}</div>
                                <div style={{ fontSize:11, color:"var(--cm)" }}>{m.specialite}</div>
                              </div>
                            </div>
                            <div style={{ display:"flex", gap:6, marginTop:8 }}>
                              {enConsult.length > 0 && <Badge cls="teal">🟢 En consultation</Badge>}
                              {enAttente.length > 0 && <Badge cls="orange">{enAttente.length} en attente</Badge>}
                              {enConsult.length === 0 && enAttente.length === 0 && <Badge cls="green">Disponible</Badge>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rdv-card">
                    <div className="rdv-card-hdr"><h3>⏱ Temps d'attente estimé</h3></div>
                    <div style={{ padding:16 }}>
                      {DEMO_MEDECINS.map(m => {
                        const nb = rdvs.filter(r => r.medecin_nom === m.nom && r.statut === "arrive" && new Date(r.date).toDateString() === today.toDateString()).length;
                        const tps = nb * 25;
                        return (
                          <div key={m._id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, fontSize:12 }}>
                            <span style={{ color:"var(--cm)" }}>{m.nom.replace("Dr. ","Dr. ")}</span>
                            <span style={{ fontWeight:700, color: tps > 45 ? "var(--cr)" : tps > 20 ? "var(--co)" : "var(--cg)" }}>
                              {nb === 0 ? "—" : `~${tps} min`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ RÉCURRENTS ══════════ */}
          {tab === "recurrents" && (
            <div>
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>Rendez-vous récurrents</div>
                <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>Suivi de pathologies chroniques et traitements réguliers</div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 }}>
                {[
                  { icon:"🤰", titre:"Suivi de grossesse",   freq:"Mensuel",     nb:4, col:"#7C3AED", cls:"purple", prochain:"15/06/2026", medecin:"Dr. Sophie Pierre" },
                  { icon:"💉", titre:"Dialyse",               freq:"3×/semaine",  nb:8, col:"#DC2626", cls:"red",    prochain:"02/06/2026", medecin:"Dr. Martin Leblanc" },
                  { icon:"🩺", titre:"Contrôle diabète",     freq:"Mensuel",     nb:6, col:"#D97706", cls:"orange", prochain:"10/06/2026", medecin:"Dr. Claire Mba" },
                  { icon:"🏃", titre:"Rééducation",           freq:"Hebdomadaire",nb:3, col:"#0EA5A0", cls:"teal",  prochain:"04/06/2026", medecin:"Dr. Martin Leblanc" },
                  { icon:"❤️", titre:"Suivi cardiologique",  freq:"Bimensuel",   nb:5, col:"#1B4F9E", cls:"blue",   prochain:"08/06/2026", medecin:"Dr. Claire Mba" },
                  { icon:"🫁", titre:"Suivi BPCO",            freq:"Trimestriel", nb:2, col:"#059669", cls:"green",  prochain:"20/06/2026", medecin:"Dr. Sophie Pierre" },
                ].map((p, i) => (
                  <div key={i} className="rdv-card fu" style={{ borderLeft:`3px solid ${p.col}` }}>
                    <div style={{ padding:18 }}>
                      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <span style={{ fontSize:22 }}>{p.icon}</span>
                          <div>
                            <div style={{ fontWeight:700, fontSize:13.5, color:"var(--cn)" }}>{p.titre}</div>
                            <div style={{ fontSize:11.5, color:"var(--cm)", marginTop:2 }}>{p.medecin}</div>
                          </div>
                        </div>
                        <Badge cls={p.cls}>{p.freq}</Badge>
                      </div>
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
                        <span style={{ fontSize:11.5, color:"var(--cm)", display:"flex", alignItems:"center", gap:5 }}>
                          {I.user} <strong style={{ color:"var(--cn)" }}>{p.nb}</strong> patients
                        </span>
                        <span style={{ fontSize:11.5, color:"var(--cm)", display:"flex", alignItems:"center", gap:5 }}>
                          {I.clock} Prochain : <strong style={{ color:"var(--cn)" }}>{p.prochain}</strong>
                        </span>
                      </div>
                      <div style={{ display:"flex", gap:6 }}>
                        <button className="cbtn cbtn-ghost cbtn-sm" style={{ flex:1, justifyContent:"center" }}>{I.edit} Modifier</button>
                        <button className="cbtn cbtn-primary cbtn-sm" style={{ flex:1, justifyContent:"center" }}>{I.plus} Planifier</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rdv-card fu" style={{ marginTop:20 }}>
                <div className="rdv-card-hdr">
                  <div><h3>⚙️ Configuration des récurrences</h3><p>Créer un nouveau protocole de suivi récurrent</p></div>
                  <button className="cbtn cbtn-teal cbtn-sm">{I.plus} Nouveau protocole</button>
                </div>
                <div style={{ padding:20, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16 }}>
                  {[
                    { icon:"📅", titre:"Quotidien",      ex:"Pansements, dialyse, injections" },
                    { icon:"📆", titre:"Hebdomadaire",   ex:"Rééducation, chimio, suivi psy" },
                    { icon:"🗓️",  titre:"Mensuel",       ex:"Diabète, grossesse, cardiologie" },
                    { icon:"⚙️",  titre:"Personnalisé",  ex:"Fréquence sur mesure du médecin" },
                  ].map((p, i) => (
                    <div key={i} style={{ background:"#F8FAFD", border:"1.5px solid var(--cbr)", borderRadius:12, padding:14, cursor:"pointer", transition:"all .2s" }}
                      onMouseOver={e=>e.currentTarget.style.boxShadow="var(--shm)"}
                      onMouseOut={e=>e.currentTarget.style.boxShadow=""}>
                      <div style={{ fontSize:22, marginBottom:8 }}>{p.icon}</div>
                      <div style={{ fontWeight:700, fontSize:13, color:"var(--cn)" }}>{p.titre}</div>
                      <div style={{ fontSize:11, color:"var(--cm)", marginTop:4 }}>{p.ex}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════════ RAPPORTS ══════════ */}
          {tab === "rapports" && (
            <div>
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>Rapports & Statistiques</div>
                <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>Analyse de l'activité des consultations</div>
              </div>

              {/* KPIs rapport */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="blue"   icon={I.cal}   value={rdvs.length}    label="Total RDV"        sub="toutes périodes" />
                <KpiCard color="green"  icon={I.check} value={`${tauxPresence}%`} label="Taux présence" sub="patients venus" />
                <KpiCard color="red"    icon={I.x}     value={`${rdvs.length > 0 ? Math.round(kpis.annules/rdvs.length*100) : 0}%`} label="Taux annulation" sub="ce mois" />
                <KpiCard color="orange" icon={I.clock} value="28 min"         label="Durée moy. RDV"   sub="toutes spécialités" />
                <KpiCard color="teal"   icon={I.user}  value={rdvs.filter(r=>r.statut==="termine").length} label="Consultations terminées" sub="ce mois" />
              </div>

              <div className="rdv-g2" style={{ marginBottom:24 }}>
                <div className="rdv-card fu">
                  <div className="rdv-card-hdr">
                    <div><h3>{I.chart} Volume mensuel de rendez-vous</h3><p>Évolution sur 12 mois</p></div>
                  </div>
                  <div style={{ padding:20 }}>
                    <BarChart labels={moisLabels} data={moisData} color="#0EA5A0" />
                  </div>
                </div>

                <div className="rdv-card fu">
                  <div className="rdv-card-hdr"><div><h3>🏥 Par service</h3><p>Répartition des RDV</p></div></div>
                  <div style={{ padding:16 }}>
                    {[
                      ["Chirurgie",    "#1B4F9E", rdvs.filter(r=>r.service==="Chirurgie").length],
                      ["Gynécologie",  "#7C3AED", rdvs.filter(r=>r.service==="Gynécologie").length],
                      ["Pédiatrie",    "#0EA5A0", rdvs.filter(r=>r.service==="Pédiatrie").length],
                      ["Cardiologie",  "#D97706", rdvs.filter(r=>r.service==="Cardiologie").length],
                      ["Médecine gén.","#059669", rdvs.filter(r=>r.service==="Médecine gén.").length],
                      ["Urgences",     "#DC2626", rdvs.filter(r=>r.service==="Urgences").length],
                    ].map(([lbl, col, val]) => (
                      <div key={lbl} style={{ marginBottom:9 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <span style={{ fontSize:11.5, color:"var(--cm)", display:"flex", alignItems:"center", gap:6 }}>
                            <span style={{ width:8, height:8, borderRadius:2, background:col, display:"inline-block" }} />
                            {lbl}
                          </span>
                          <span style={{ fontWeight:700, fontSize:11.5, color:"var(--cn)" }}>{val}</span>
                        </div>
                        <Prog pct={rdvs.length > 0 ? Math.round(val / rdvs.length * 100) : 0} color={col} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rdv-g11">
                <div className="rdv-card fu">
                  <div className="rdv-card-hdr"><div><h3>👨‍⚕️ RDV par médecin</h3></div></div>
                  <div style={{ overflowX:"auto" }}>
                    <table className="rdv-tbl">
                      <thead><tr><th>Médecin</th><th>Spécialité</th><th>Total</th><th>Taux présence</th></tr></thead>
                      <tbody>
                        {DEMO_MEDECINS.map(m => {
                          const total = rdvs.filter(r => r.medecin_nom === m.nom).length;
                          const term = rdvs.filter(r => r.medecin_nom === m.nom && r.statut === "termine").length;
                          return (
                            <tr key={m._id}>
                              <td><div style={{ fontWeight:600, color:"var(--cn)", fontSize:12.5 }}>{m.nom}</div></td>
                              <td><Badge cls="blue">{m.specialite}</Badge></td>
                              <td style={{ fontWeight:700 }}>{total}</td>
                              <td>
                                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                  <Prog pct={total > 0 ? Math.round(term/total*100) : 0} color="#059669" />
                                  <span style={{ fontSize:11, color:"var(--cg)", fontWeight:700, minWidth:32 }}>{total > 0 ? Math.round(term/total*100) : 0}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rdv-card fu">
                  <div className="rdv-card-hdr"><div><h3>📄 Exports disponibles</h3></div></div>
                  <div style={{ padding:16, display:"flex", flexDirection:"column", gap:10 }}>
                    {[
                      ["📊","Rapport mensuel des RDV","Excel / PDF"],
                      ["📋","Liste des RDV du jour","Impression"],
                      ["📈","Statistiques de présence","PDF"],
                      ["📉","Taux d'annulation","Excel"],
                      ["🏥","Activité par service","PDF"],
                    ].map(([icon, titre, fmt]) => (
                      <div key={titre} style={{ display:"flex", alignItems:"center", gap:10, background:"#F8FAFD", borderRadius:10, padding:"10px 14px" }}>
                        <span style={{ fontSize:18 }}>{icon}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:12.5, fontWeight:600, color:"var(--cn)" }}>{titre}</div>
                          <div style={{ fontSize:11, color:"var(--cm)" }}>{fmt}</div>
                        </div>
                        <button className="cbtn cbtn-ghost cbtn-sm">{I.print} Exporter</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ MODAL : NOUVEAU RDV ═══ */}
        <Modal open={modalNouv} onClose={() => setModalNouv(false)} title={<>{I.plus} Nouveau rendez-vous</>} maxWidth={680}>
          <form onSubmit={createRdv}>
            <div className="rdv-form-g">
              <div className="rdv-col-all">
                <div style={{ background:"#EEF4FF", borderRadius:12, padding:"12px 16px", marginBottom:4 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"var(--cb)", marginBottom:8 }}>👤 Informations Patient</div>
                  <div className="rdv-form-g" style={{ gap:10 }}>
                    <div>
                      <label className="clbl">Nom complet *</label>
                      <input className="cinp" required placeholder="Ex: Jean Dupont" value={formRdv.patient_nom} onChange={e => setFormRdv(f=>({...f,patient_nom:e.target.value}))} />
                    </div>
                    <div>
                      <label className="clbl">Téléphone</label>
                      <input className="cinp" placeholder="+242 06 …" value={formRdv.patient_tel} onChange={e => setFormRdv(f=>({...f,patient_tel:e.target.value}))} />
                    </div>
                    <div className="rdv-col-all">
                      <label className="clbl">E-mail</label>
                      <input className="cinp" type="email" placeholder="patient@email.com" value={formRdv.patient_email} onChange={e => setFormRdv(f=>({...f,patient_email:e.target.value}))} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="clbl">Date *</label>
                <input type="date" className="cinp" required value={formRdv.date} min={new Date().toISOString().substring(0,10)} onChange={e => setFormRdv(f=>({...f,date:e.target.value}))} />
              </div>
              <div>
                <label className="clbl">Heure *</label>
                <input type="time" className="cinp" required value={formRdv.heure} onChange={e => setFormRdv(f=>({...f,heure:e.target.value}))} />
              </div>
              <div>
                <label className="clbl">Durée estimée (min)</label>
                <select className="cinp" value={formRdv.duree} onChange={e => setFormRdv(f=>({...f,duree:e.target.value}))}>
                  {[15,20,30,45,60,90,120].map(d => <option key={d} value={d}>{d} minutes</option>)}
                </select>
              </div>
              <div>
                <label className="clbl">Motif *</label>
                <select className="cinp" required value={formRdv.motif} onChange={e => setFormRdv(f=>({...f,motif:e.target.value}))}>
                  {Object.entries(MOTIF_CFG).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="clbl">Service concerné</label>
                <select className="cinp" value={formRdv.service} onChange={e => setFormRdv(f=>({...f,service:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  {["Chirurgie","Gynécologie","Pédiatrie","Cardiologie","Médecine gén.","Urgences","Laboratoire","Imagerie"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="clbl">Médecin assigné</label>
                <select className="cinp" value={formRdv.medecin_id} onChange={e => setFormRdv(f=>({...f,medecin_id:e.target.value}))}>
                  <option value="">— Non assigné —</option>
                  {DEMO_MEDECINS.map(m => <option key={m._id} value={m._id}>{m.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="clbl">Salle</label>
                <select className="cinp" value={formRdv.salle} onChange={e => setFormRdv(f=>({...f,salle:e.target.value}))}>
                  <option value="">— Non attribuée —</option>
                  {["Salle 1","Salle 2","Salle 3","Salle Echo","Bloc 1","Bloc 2","Laboratoire","Radiologie"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="rdv-col-all">
                <label className="clbl">Notes / Observations</label>
                <textarea className="cinp" rows={2} placeholder="Informations complémentaires..." value={formRdv.notes} onChange={e => setFormRdv(f=>({...f,notes:e.target.value}))} />
              </div>

              {/* Notifications */}
              <div className="rdv-col-all" style={{ background:"#F0FDFC", border:"1.5px solid #99F6E4", borderRadius:12, padding:"12px 16px" }}>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--ct)", marginBottom:8 }}>{I.bell} Notifications automatiques</div>
                <div style={{ display:"flex", gap:16, flexWrap:"wrap", fontSize:12, color:"var(--cm)" }}>
                  {["SMS de confirmation","Rappel 24h avant","Rappel 2h avant"].map(n => (
                    <label key={n} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
                      <input type="checkbox" defaultChecked style={{ accentColor:"var(--ct)", width:14, height:14 }} /> {n}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button type="button" className="cbtn cbtn-ghost" onClick={() => setModalNouv(false)}>Annuler</button>
              <button type="submit" className="cbtn cbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>
                {I.save} {saving ? "Création..." : "Créer le rendez-vous"}
              </button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : DÉTAIL / GESTION RDV ═══ */}
        <Modal open={modalDetail && !!selectedRdv} onClose={() => setModalDetail(false)} title={<>{I.cal} Gestion du rendez-vous</>} maxWidth={560}>
          {selectedRdv && (() => {
            const sc = STATUT_CFG[selectedRdv.statut] || {};
            return (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {/* Header patient */}
                <div style={{ background:"linear-gradient(135deg,var(--cn),var(--cn2))", borderRadius:14, padding:16, color:"#fff" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <div style={{ width:48, height:48, borderRadius:12, background:"rgba(255,255,255,.15)", border:"2px solid rgba(255,255,255,.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>👤</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:16 }}>{selectedRdv.patient_nom}</div>
                      <div style={{ fontSize:12, color:"rgba(255,255,255,.65)", marginTop:2 }}>
                        📞 {selectedRdv.patient_tel} · 📅 {fmtDate(selectedRdv.date)} {fmtTime(selectedRdv.date)}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontFamily:"monospace", fontSize:13, fontWeight:700, color:"rgba(255,255,255,.9)" }}>{selectedRdv.reference}</span>
                      <div style={{ marginTop:6 }}><Badge cls={sc.cls}>{sc.label}</Badge></div>
                    </div>
                  </div>
                </div>

                {/* Infos */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  {[
                    ["👨‍⚕️ Médecin",   selectedRdv.medecin_nom],
                    ["🏥 Service",     selectedRdv.service],
                    ["🩺 Motif",       MOTIF_CFG[selectedRdv.motif] || selectedRdv.motif],
                    ["🚪 Salle",       selectedRdv.salle || "—"],
                    ["⏱ Durée",       `${selectedRdv.duree} minutes`],
                    ["📝 Notes",       selectedRdv.notes || "—"],
                  ].map(([lbl, val]) => (
                    <div key={lbl} style={{ background:"#F8FAFD", borderRadius:10, padding:"10px 12px" }}>
                      <div style={{ fontSize:10, fontWeight:600, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.4 }}>{lbl}</div>
                      <div style={{ fontSize:12.5, fontWeight:600, color:"var(--cn)", marginTop:3 }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Changement de statut */}
                <div style={{ background:"#EEF4FF", borderRadius:12, padding:"12px 16px" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"var(--cn)", marginBottom:10 }}>Changer le statut</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {Object.entries(STATUT_CFG).filter(([k]) => k !== selectedRdv.statut).map(([k, v]) => (
                      <button key={k} className="cbtn cbtn-ghost cbtn-sm"
                        style={{ fontSize:11 }}
                        onClick={() => { updateStatut(selectedRdv._id, k); setModalDetail(false); }}>
                        <span style={{ width:8, height:8, borderRadius:"50%", background:v.dot, display:"inline-block" }} />
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => { setModalDetail(false); setModalReport(true); }}>
                    📅 Reporter
                  </button>
                  <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => toast.success("📱 SMS envoyé")}>
                    {I.sms} Envoyer SMS
                  </button>
                  <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => window.print()}>
                    {I.print} Imprimer
                  </button>
                  <button className="cbtn cbtn-danger cbtn-sm" style={{ marginLeft:"auto" }} onClick={() => { updateStatut(selectedRdv._id, "annule"); setModalDetail(false); }}>
                    {I.x} Annuler le RDV
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>

        {/* ═══ MODAL : REPORTER ═══ */}
        <Modal open={modalReport && !!selectedRdv} onClose={() => setModalReport(false)} title="📅 Reporter le rendez-vous" maxWidth={440}>
          <form onSubmit={reporterRdv}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {selectedRdv && (
                <div style={{ background:"#FFF7ED", border:"1.5px solid #FED7AA", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#92400E" }}>
                  RDV actuel : <strong>{selectedRdv.patient_nom}</strong> — {fmtDate(selectedRdv.date)} à {fmtTime(selectedRdv.date)}
                </div>
              )}
              <div>
                <label className="clbl">Nouvelle date *</label>
                <input type="date" className="cinp" required value={formReport.date} min={new Date().toISOString().substring(0,10)} onChange={e => setFormReport(f=>({...f,date:e.target.value}))} />
              </div>
              <div>
                <label className="clbl">Nouvelle heure *</label>
                <input type="time" className="cinp" required value={formReport.heure} onChange={e => setFormReport(f=>({...f,heure:e.target.value}))} />
              </div>
              <div>
                <label className="clbl">Motif du report</label>
                <textarea className="cinp" rows={2} placeholder="Raison du report..." value={formReport.motif} onChange={e => setFormReport(f=>({...f,motif:e.target.value}))} />
              </div>
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:13, color:"var(--cn)" }}>
                <input type="checkbox" defaultChecked style={{ accentColor:"var(--ct)", width:15, height:15 }} />
                Notifier le patient par SMS
              </label>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="cbtn cbtn-ghost" onClick={() => setModalReport(false)}>Annuler</button>
                <button type="submit" className="cbtn cbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>
                  {I.save} Confirmer le report
                </button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : NOTIFICATIONS ═══ */}
        <Modal open={modalNotif} onClose={() => setModalNotif(false)} title={<>{I.bell} Notifications & rappels</>} maxWidth={520}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {[
              { icon:"💬", titre:"SMS",       items:["Confirmation de rendez-vous","Rappel 24h avant","Rappel 2h avant"], col:"#1B4F9E" },
              { icon:"📧", titre:"E-mail",    items:["Convocation","Modification de RDV","Annulation"], col:"#0EA5A0" },
              { icon:"📲", titre:"WhatsApp",  items:["Confirmation automatique","Rappel automatique"], col:"#059669" },
            ].map(({ icon, titre, items, col }) => (
              <div key={titre} style={{ background:"#F8FAFD", border:"1.5px solid var(--cbr)", borderRadius:14, padding:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                  <span style={{ fontSize:20 }}>{icon}</span>
                  <span style={{ fontWeight:700, fontSize:14, color:"var(--cn)" }}>{titre}</span>
                  <span style={{ marginLeft:"auto" }}><Badge cls="green">Actif</Badge></span>
                </div>
                {items.map(item => (
                  <label key={item} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginBottom:8, fontSize:13, color:"var(--cm)" }}>
                    <input type="checkbox" defaultChecked style={{ accentColor:col, width:15, height:15 }} />
                    {item}
                  </label>
                ))}
              </div>
            ))}
            <div style={{ display:"flex", gap:10 }}>
              <button className="cbtn cbtn-ghost" style={{ flex:1, justifyContent:"center" }} onClick={() => setModalNotif(false)}>Fermer</button>
              <button className="cbtn cbtn-teal" style={{ flex:1, justifyContent:"center" }} onClick={() => { toast.success("✅ Paramètres sauvegardés"); setModalNotif(false); }}>
                {I.save} Sauvegarder
              </button>
            </div>
          </div>
        </Modal>

      </div>
    </>
  );
}