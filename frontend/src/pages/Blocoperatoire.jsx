



import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchBlocPlanning, fetchSalles,
  selectBlocPlanning, selectSalles, selectBlocLoading, selectBlocStats,
} from '../store/slices/blocoperatoireSlice';
import api from "../api";
import toast from "react-hot-toast";

// ─── Chart.js loader ─────────────────────────────────────────
function loadChartJs(cb) {
  if (window.Chart) { cb(); return; }
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
  s.onload = cb;
  document.head.appendChild(s);
}

// ─── CSS Bloc Opératoire — Steel Blue + Surgical Green ───────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.bo * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --bn: #0A1628; --bn2: #0F2040; --bb: #1A5276; --bt: #17A589;
  --bt2: #148F77; --br: #C0392B; --bo: #D68910; --bg: #1E8449;
  --bp: #6C3483; --bv: #117A65; --cbr: #D6EAF8; --cm: #5D7892;
  --cl: #EAF4FB; --cs: #F4F9FD;
  --sh: 0 1px 3px rgba(10,22,40,.08); --shm: 0 4px 16px rgba(10,22,40,.12); --shl: 0 12px 40px rgba(10,22,40,.16);
}

/* Topbar */
.bo-top { background:linear-gradient(135deg,var(--bn) 0%,var(--bn2) 50%,#1A5276 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.bo-top::before { content:''; position:absolute; top:-60px; right:-60px; width:240px; height:240px; background:radial-gradient(circle,rgba(23,165,137,.18) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
.bo-top::after  { content:''; position:absolute; bottom:-30px; left:40%; width:180px; height:180px; background:radial-gradient(circle,rgba(26,82,118,.25) 0%,transparent 70%); border-radius:50%; pointer-events:none; }

/* Tabs */
.bo-tabs { display:flex; gap:2px; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.bo-tabs::-webkit-scrollbar { display:none; }
.bo-tab { display:flex; align-items:center; gap:7px; padding:10px 18px 12px; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.5); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.bo-tab:hover { color:rgba(255,255,255,.85); background:rgba(255,255,255,.08); }
.bo-tab.active { color:var(--bn); background:var(--cs); box-shadow:0 -2px 0 var(--bt) inset; }
.bo-tab-badge { background:var(--br); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:99px; animation:boP 2s infinite; }
@keyframes boP { 0%,100%{opacity:1} 50%{opacity:.4} }

/* Cards */
.bo-card { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; }
.bo-card:hover { box-shadow:var(--shm); }
.bo-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(234,244,251,.7),transparent); }
.bo-card-hdr h3 { font-size:14px; font-weight:700; color:var(--bn); margin:0; display:flex; align-items:center; gap:8px; }
.bo-card-hdr p  { font-size:11px; color:var(--cm); margin:2px 0 0; }

/* KPI */
.bo-kpi { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:pointer; }
.bo-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.bo-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.bo-kpi.blue::before   { background:var(--bb); } .bo-kpi.teal::before   { background:var(--bt); }
.bo-kpi.red::before    { background:var(--br); } .bo-kpi.orange::before { background:var(--bo); }
.bo-kpi.green::before  { background:var(--bg); } .bo-kpi.purple::before { background:var(--bp); }
.kpi-icon-bo { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
.kpi-icon-bo.blue   { background:#EBF5FB; color:var(--bb); } .kpi-icon-bo.teal   { background:#E8F8F5; color:var(--bt); }
.kpi-icon-bo.red    { background:#FDEDEC; color:var(--br); } .kpi-icon-bo.orange { background:#FEF9E7; color:var(--bo); }
.kpi-icon-bo.green  { background:#EAFAF1; color:var(--bg); } .kpi-icon-bo.purple { background:#F4ECF7; color:var(--bp); }
.kpi-val-bo { font-size:26px; font-weight:800; color:var(--bn); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.kpi-lbl-bo { font-size:11.5px; font-weight:600; color:var(--cm); }
.kpi-sub-bo { font-size:10.5px; color:#9CA3AF; margin-top:2px; }
.kpi-dot-bo { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--br); animation:boP 2s infinite; }

/* Badges */
.bbdg { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.bbdg.red    { background:#FDEDEC; color:var(--br); border:1px solid #F5B7B1; }
.bbdg.orange { background:#FEF9E7; color:var(--bo); border:1px solid #FAD7A0; }
.bbdg.yellow { background:#FEFCE8; color:#B7950B;   border:1px solid #F9E79F; }
.bbdg.green  { background:#EAFAF1; color:var(--bg); border:1px solid #A9DFBF; }
.bbdg.blue   { background:#EBF5FB; color:var(--bb); border:1px solid #AED6F1; }
.bbdg.teal   { background:#E8F8F5; color:var(--bt); border:1px solid #A2D9CE; }
.bbdg.purple { background:#F4ECF7; color:var(--bp); border:1px solid #C39BD3; }
.bbdg.gray   { background:#F8F9FA; color:#4B5563;   border:1px solid #DEE2E6; }
.bbdg.dark   { background:var(--bn); color:#fff;    border:1px solid var(--bn2); }

/* Progress */
.bo-prog { background:#EAF4FB; border-radius:99px; height:7px; overflow:hidden; }
.bo-prog-f { height:100%; border-radius:99px; transition:width .5s; }

/* Buttons */
.bbtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; }
.bbtn-primary { background:var(--bb); color:#fff; } .bbtn-primary:hover { background:#154360; transform:translateY(-1px); }
.bbtn-teal    { background:var(--bt); color:#fff; } .bbtn-teal:hover    { background:var(--bt2); transform:translateY(-1px); }
.bbtn-ghost   { background:transparent; color:var(--cm); border:1.5px solid var(--cbr); }
.bbtn-ghost:hover { background:var(--cl); color:var(--bn); }
.bbtn-danger  { background:#FDEDEC; color:var(--br); border:1.5px solid #F5B7B1; }
.bbtn-danger:hover { background:var(--br); color:#fff; }
.bbtn-success { background:#EAFAF1; color:var(--bg); border:1.5px solid #A9DFBF; }
.bbtn-success:hover { background:var(--bg); color:#fff; }
.bbtn-sm { padding:6px 12px; font-size:12px; }
.bbtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }

/* Forms */
.blbl { font-size:12px; font-weight:600; color:var(--cm); margin-bottom:6px; display:block; }
.binp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--cbr); background:#FAFCFF; font-size:13px; color:var(--bn); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.binp:focus { border-color:var(--bt); box-shadow:0 0 0 3px rgba(23,165,137,.12); }

/* Section nav */
.sec-nav-bo { display:flex; gap:6px; flex-wrap:wrap; padding:14px 20px; background:linear-gradient(to right,#F4F9FD,#EAF4FB); border-bottom:1.5px solid var(--cbr); border-radius:18px 18px 0 0; }
.sec-btn-bo { display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all .2s; color:var(--cm); background:none; font-family:'Poppins',sans-serif; }
.sec-btn-bo:hover { background:white; color:var(--bn); border-color:var(--cbr); }
.sec-btn-bo.active { background:var(--bn); color:white; border-color:var(--bn); }
.sec-btn-bo.warn { border-color:#F5B7B1; color:var(--br); }

/* Alerts */
.al-bo-ia     { background:linear-gradient(135deg,#EBF5FB,#D6EAF8); border:1.5px solid #AED6F1; border-left:4px solid var(--bb); border-radius:14px; padding:14px 18px; }
.al-bo-warn   { background:linear-gradient(135deg,#FEFCE8,#FEF3C7); border:1.5px solid #FAD7A0; border-left:4px solid var(--bo); border-radius:14px; padding:14px 18px; }
.al-bo-danger { background:linear-gradient(135deg,#FDEDEC,#FADBD8); border:1.5px solid #F5B7B1; border-left:4px solid var(--br); border-radius:14px; padding:14px 18px; }
.al-bo-success{ background:linear-gradient(135deg,#EAFAF1,#D5F5E3); border:1.5px solid #A9DFBF; border-left:4px solid var(--bg); border-radius:14px; padding:14px 18px; }

/* Table */
.bo-tbl { width:100%; border-collapse:collapse; }
.bo-tbl thead tr { background:linear-gradient(to right,#F4F9FD,#EAF4FB); }
.bo-tbl th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--cm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--cbr); white-space:nowrap; }
.bo-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #EAF4FB; vertical-align:middle; }
.bo-tbl tbody tr:last-child td { border-bottom:none; }
.bo-tbl tbody tr:hover { background:#F4F9FD; }

/* Modal */
.bov { position:fixed; inset:0; z-index:500; background:rgba(10,22,40,.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.bov-box { background:#fff; border-radius:20px; box-shadow:var(--shl); width:100%; max-width:680px; max-height:92vh; overflow-y:auto; animation:boSlide .25s ease; }
@keyframes boSlide { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.bov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:#EAF4FB; position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.bov-hdr h3 { font-size:16px; font-weight:700; color:var(--bn); margin:0; display:flex; align-items:center; gap:10px; }
.bov-cls { width:32px; height:32px; border-radius:8px; background:#F4F9FD; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--cm); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.bov-cls:hover { background:#FDEDEC; color:var(--br); }
.bov-body { padding:24px; }

/* Checklist */
.chk-item { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:10px; background:#F4F9FD; border:1.5px solid var(--cbr); margin-bottom:8px; transition:all .2s; cursor:pointer; }
.chk-item:hover { background:#EAF4FB; }
.chk-item.done { background:#EAFAF1; border-color:#A9DFBF; }
.chk-box { width:20px; height:20px; border-radius:6px; border:2px solid var(--cbr); display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .2s; }
.chk-item.done .chk-box { background:var(--bg); border-color:var(--bg); }

/* Vital card */
.vital-bo { background:#F4F9FD; border:1.5px solid var(--cbr); border-radius:12px; padding:12px 16px; text-align:center; }
.vital-bo.warn { background:#FEF9E7; border-color:#FAD7A0; }
.vital-bo.danger { background:#FDEDEC; border-color:#F5B7B1; }
.vital-v-bo { font-size:22px; font-weight:800; color:var(--bn); }
.vital-l-bo { font-size:10px; color:var(--cm); font-weight:600; text-transform:uppercase; margin-top:2px; }

/* Timeline */
.bo-timeline { position:relative; padding-left:28px; }
.bo-timeline::before { content:''; position:absolute; left:10px; top:8px; bottom:8px; width:2px; background:var(--cbr); border-radius:2px; }
.bo-tl-item { position:relative; margin-bottom:16px; }
.bo-tl-dot { position:absolute; left:-23px; top:4px; width:14px; height:14px; border-radius:50%; border:2.5px solid white; box-shadow:0 0 0 2px var(--cbr); z-index:1; }
.bo-tl-dot.done   { background:var(--bg); box-shadow:0 0 0 2px #A9DFBF; }
.bo-tl-dot.active { background:var(--bt); box-shadow:0 0 0 2px #A2D9CE; animation:boP 2s infinite; }
.bo-tl-dot.pending{ background:#E5E7EB; }

/* Status strip */
.status-strip { display:flex; align-items:center; gap:0; border-radius:12px; overflow:hidden; border:1.5px solid var(--cbr); }
.status-step { flex:1; padding:10px 8px; text-align:center; font-size:11px; font-weight:600; color:var(--cm); background:#F4F9FD; transition:all .2s; position:relative; }
.status-step.done   { background:var(--bg); color:#fff; }
.status-step.active { background:var(--bt); color:#fff; }
.status-step:not(:last-child)::after { content:'›'; position:absolute; right:-2px; top:50%; transform:translateY(-50%); font-size:16px; color:var(--cbr); z-index:1; }

/* Room grid */
.room-card { background:#F4F9FD; border:1.5px solid var(--cbr); border-radius:14px; padding:16px; transition:all .2s; cursor:pointer; }
.room-card:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.room-card.occupied { border-color:#F5B7B1; background:#FDEDEC; }
.room-card.available { border-color:#A9DFBF; background:#EAFAF1; }
.room-card.maintenance { border-color:#FAD7A0; background:#FEF9E7; }

/* Consommable row */
.conso-row { display:flex; align-items:center; gap:10px; padding:10px 14px; background:#F4F9FD; border-radius:10px; border:1.5px solid var(--cbr); margin-bottom:8px; }

/* Fade */
@keyframes boFadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
.bofu { animation:boFadeUp .35s ease both; }

/* Print */
@media print { .bo-top,.bo-tabs,.sec-nav-bo,.bbtn { display:none!important; } }

/* ─── Responsive ─── */
.bo-g2  { display:grid; grid-template-columns:2fr 1fr; gap:20px; }
.bo-g11 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.bo-g11s{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
@media (max-width:767px) {
  .bo-top { padding:12px 14px 0; }
  .bo-g2,.bo-g11 { grid-template-columns:1fr; gap:14px; }
  .bo-g11s { grid-template-columns:1fr 1fr; gap:8px; }
  .binp { font-size:16px !important; }
  .bbtn { font-size:12px; padding:8px 12px; } .bbtn-sm { font-size:11px; padding:5px 8px; }
  .bo-card { border-radius:14px; } .bo-card-hdr { padding:11px 14px; }
  .bov { padding:0; align-items:flex-end; } .bov-box { border-radius:20px 20px 0 0; max-width:100%; max-height:93vh; }
  .bov-hdr { padding:13px 16px; } .bov-body { padding:14px; }
  .sec-nav-bo { overflow-x:auto; flex-wrap:nowrap; scrollbar-width:none; }
  .sec-nav-bo::-webkit-scrollbar { display:none; }
}
@media (max-width:479px) {
  .bo-top { padding:10px 12px 0; } .bo-g11s { grid-template-columns:1fr; }
  .bo-card-hdr { flex-wrap:wrap; gap:8px; }
}
`;

// ─── Helpers ─────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
const fmtDateInput  = (d) => d ? new Date(d).toISOString().substring(0, 10) : "";
const fmtDateTimeInput = (d) => d ? new Date(d).toISOString().substring(0, 16) : "";
const ageCalc = (dob) => {
  if (!dob) return "—";
  return `${Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 3600 * 1000))} ans`;
};

const STATUT_BO = {
  programmee:     { cls:"blue",   label:"Programmée",      icon:"📅" },
  preparation:    { cls:"orange", label:"En préparation",  icon:"🔧" },
  en_cours:       { cls:"teal",   label:"En cours",        icon:"🔪" },
  terminee:       { cls:"green",  label:"Terminée",        icon:"✅" },
  annulee:        { cls:"red",    label:"Annulée",         icon:"❌" },
  reveil:         { cls:"purple", label:"En salle réveil", icon:"💊" },
};

const URGENCE_BO = {
  programmee:      { cls:"green",  label:"Programmée" },
  urgente:         { cls:"orange", label:"Urgente" },
  extreme_urgence: { cls:"red",    label:"Extrême urgence" },
};

const SPECIALITE_BO = {
  chirurgie_generale: "Chirurgie générale",
  gynecologie:        "Gynécologie",
  orthopédie:         "Orthopédie",
  urologie:           "Urologie",
  orl:                "ORL",
  ophtalmologie:      "Ophtalmologie",
  autre:              "Autre",
};

// ─── Demo data ────────────────────────────────────────────────
const DEMO_INTERVENTIONS = [];

const DEMO_SALLES = [];

const CHECKLIST_ITEMS = [
  { id:"identite",       label:"Identité du patient vérifiée (bracelet, carte)" },
  { id:"site_op",        label:"Site opératoire confirmé et marqué" },
  { id:"allergie",       label:"Allergies vérifiées et signalées" },
  { id:"consentement",   label:"Consentement éclairé signé en dossier" },
  { id:"materiel",       label:"Matériel et instruments stériles disponibles" },
  { id:"sang",           label:"Sang disponible si nécessaire (RAI valide)" },
  { id:"bilan",          label:"Bilan biologique validé par anesthésiste" },
  { id:"imagerie",       label:"Imagerie disponible en salle (radio, scanner)" },
  { id:"antibio",        label:"Antibioprophylaxie administrée si indiquée" },
  { id:"timeout",        label:"Time-out équipe réalisé avant incision" },
];

const DEMO_CONSO = [];

const EMPTY_INTERV = {
  patient_id:"", chirurgien:"", assistant:"", anesthesiste:"", infirmier_instru:"", infirmier_circu:"",
  type_intervention:"", specialite:"chirurgie_generale", niveau_urgence:"programmee",
  statut:"programmee", diagnostic_preop:"", salle:"", date_heure_op:"", duree_estimee:90,
  service_demandeur:"", consentement_signe:false,
};

const EMPTY_CR = {
  diagnostic_preop:"", diagnostic_postop:"", resume:"", cr_detail:"", recommandations:"",
  materiel_implante:"", saignement_ml:"", transfusion_ml:"", incidents:"",
};

const EMPTY_REVEIL = {
  heure_arrivee:"", heure_sortie:"", etat_patient:"stable",
  temperature:"", tension_sys:"", tension_dia:"", pouls:"", douleur_score:"",
  complications:[], observations:"",
};

// ─── SVG Icons ────────────────────────────────────────────────
const I = {
  scalpel:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3l4 4-9.5 9.5-4-4L17 3z"/><path d="M10.5 16.5l-6.5 3 1-6.5"/><line x1="4" y1="20" x2="8" y2="16"/></svg>,
  file:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  calendar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  users:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  clock:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  pulse:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  alert:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  plus:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  save:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  check:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  dl:       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  print:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  trend:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  grid:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  list:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  link:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  room:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  box:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>,
  money:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  open:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
};

// ─── Modal wrapper ───────────────────────────────────────────
function Modal({ open, onClose, title, children, maxWidth = 680 }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="bov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bov-box" style={{ maxWidth }}>
        <div className="bov-hdr">
          <h3>{title}</h3>
          <button className="bov-cls" onClick={onClose}>×</button>
        </div>
        <div className="bov-body">{children}</div>
      </div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────
function KpiCard({ color, icon, value, label, sub, urgent, onClick }) {
  return (
    <div className={`bo-kpi ${color} bofu`} onClick={onClick} style={{ cursor:onClick ? "pointer" : "default" }}>
      {urgent && <div className="kpi-dot-bo" />}
      <div className={`kpi-icon-bo ${color}`}>{icon}</div>
      <div className="kpi-val-bo">{value}</div>
      <div className="kpi-lbl-bo">{label}</div>
      {sub && <div className="kpi-sub-bo">{sub}</div>}
    </div>
  );
}

// ─── Prog bar ────────────────────────────────────────────────
function Prog({ pct, color }) {
  return <div className="bo-prog"><div className="bo-prog-f" style={{ width:`${pct}%`, background:color }} /></div>;
}

// ─── Badge ──────────────────────────────────────────────────
function Badge({ cls, children }) {
  return <span className={`bbdg ${cls}`}>{children}</span>;
}

// ─── Bar Chart ───────────────────────────────────────────────
function BarChart({ labels, data, color = "#1A5276", height = 200 }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new window.Chart(ref.current, {
        type:"bar",
        data: {
          labels,
          datasets: [{ label:"Interventions", data, backgroundColor:`${color}28`, borderColor:color, borderWidth:2, borderRadius:8, borderSkipped:false }],
        },
        options: {
          responsive:true, maintainAspectRatio:true,
          plugins: { legend:{ display:false }, tooltip:{ backgroundColor:"#0A1628", padding:10, cornerRadius:10 } },
          scales: {
            x:{ grid:{ display:false }, ticks:{ font:{ size:10 }, color:"#9CA3AF" }, border:{ display:false } },
            y:{ beginAtZero:true, grid:{ color:"rgba(0,0,0,.04)" }, ticks:{ font:{ size:10 }, color:"#9CA3AF", precision:0 }, border:{ display:false } },
          },
        },
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [labels, data, color]);
  return <canvas ref={ref} style={{ maxHeight:height }} />;
}

// ─── Doughnut Chart ──────────────────────────────────────────
function DoughnutChart({ labels, data, colors, height = 200 }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new window.Chart(ref.current, {
        type:"doughnut",
        data: { labels, datasets:[{ data, backgroundColor:colors, borderWidth:0, hoverOffset:4 }] },
        options: {
          responsive:true, maintainAspectRatio:true, cutout:"70%",
          plugins: { legend:{ position:"right", labels:{ font:{ size:11 }, padding:14, boxWidth:12, borderRadius:3 } }, tooltip:{ backgroundColor:"#0A1628", padding:10 } },
        },
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [labels, data, colors]);
  return <canvas ref={ref} style={{ maxHeight:height }} />;
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function BlocOperatoire() {
  const dispatch = useDispatch();
  const reduxPlanning = useSelector(selectBlocPlanning);
  const reduxSalles = useSelector(selectSalles);
  const reduxStats = useSelector(selectBlocStats);

  useEffect(() => {
    dispatch(fetchBlocPlanning({}));
    dispatch(fetchSalles());
  }, [dispatch]);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => { const fn = () => setIsMobile(window.innerWidth <= 599); window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn); }, []);

  const [tab, setTab]           = useState("dashboard");
  const [section, setSection]   = useState("general");
  const [interventions, setInterventions] = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState("");
  const [filterStatut, setFilter] = useState("");
  const [currentInterv, setCurrentInterv] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [checklist, setChecklist] = useState({});
  const [consommables, setConsommables] = useState(DEMO_CONSO);
  const [patients, setPatients] = useState([]);

  // Modals
  const [modalNouv, setModalNouv]     = useState(false);
  const [modalCR, setModalCR]         = useState(false);
  const [modalReveil, setModalReveil] = useState(false);

  // Forms
  const [formInterv, setFormInterv] = useState(EMPTY_INTERV);
  const [formCR, setFormCR]         = useState(EMPTY_CR);
  const [formReveil, setFormReveil] = useState(EMPTY_REVEIL);

  // KPIs
  const [kpis, setKpis] = useState({ total:0, programmees:0, en_cours:0, terminees:0, annulees:0, reveil:0, taux_occ:0 });
  const [chartMois, setChartMois]   = useState(["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"]);
  const [chartData, setChartData]   = useState([3, 5, 4, 7, 8, 6, 5, 3, 4, 6, 5, 7]);

  // ── Load interventions ─────────────────────────────────────
  const loadInterventions = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit:15 });
      if (search) p.set("q", search);
      if (filterStatut) p.set("statut", filterStatut);
      const { data } = await api.get(`/bloc-operatoire?${p}`);
      setInterventions(data.interventions || data.data || []);
      setTotal(data.total || 0);
    } catch {
      setInterventions(DEMO_INTERVENTIONS);
      setTotal(DEMO_INTERVENTIONS.length);
    } finally { setLoading(false); }
  }, [page, search, filterStatut]);

  // ── Load stats ─────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/bloc-operatoire/stats");
      setKpis(data.kpis || kpis);
      if (data.chart) { setChartMois(data.chart.labels); setChartData(data.chart.data); }
    } catch {
      const d = DEMO_INTERVENTIONS;
      setKpis({
        total: d.length,
        programmees: d.filter(x => x.statut === "programmee").length,
        en_cours: d.filter(x => x.statut === "en_cours").length,
        terminees: d.filter(x => x.statut === "terminee").length,
        annulees: d.filter(x => x.statut === "annulee").length,
        reveil: d.filter(x => x.statut === "reveil").length,
        taux_occ: 65,
      });
    }
  }, []);

  // ── Load patients ──────────────────────────────────────────
  const loadPatients = useCallback(async () => {
    try {
      const { data } = await api.get("/patients?limit=500");
      setPatients(data.patients || data.data || []);
    } catch {
      setPatients([{ _id:"p1", prenom:"Jean", nom:"Dupont", numero_dossier:"PAT-001" }]);
    }
  }, []);

  useEffect(() => { loadInterventions(); loadStats(); loadPatients(); }, [loadInterventions, loadStats, loadPatients]);

  // ── Open intervention ──────────────────────────────────────
  const openInterv = (d) => {
    setCurrentInterv(d);
    setChecklist(CHECKLIST_ITEMS.reduce((acc, item) => ({ ...acc, [item.id]: d.checklist_done }), {}));
    setSection("general");
    setTab("dossier");
  };

  // ── Create intervention ────────────────────────────────────
  const createInterv = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/bloc-operatoire", formInterv);
      toast.success(`✅ Intervention ${data.numero || "créée"} avec succès`);
      setModalNouv(false);
      setFormInterv(EMPTY_INTERV);
      loadInterventions(); loadStats();
    } catch {
      const fake = { ...formInterv, _id: Date.now().toString(), numero: `BO-2026-${String(interventions.length + 1).padStart(4,"0")}`, patient_nom:"Nouveau patient", patient_dob:"1985-01-01", patient_gs:"—", patient_poids:70, statut:"programmee" };
      setInterventions(prev => [fake, ...prev]);
      toast.success("✅ Intervention programmée");
      setModalNouv(false);
      setFormInterv(EMPTY_INTERV);
    } finally { setSaving(false); }
  };

  // ── Update intervention ────────────────────────────────────
  const updateInterv = async (updates) => {
    if (!currentInterv) return;
    setSaving(true);
    try {
      await api.put(`/bloc-operatoire/${currentInterv._id}`, { ...currentInterv, ...updates });
      toast.success("✅ Intervention mise à jour");
      setCurrentInterv(prev => ({ ...prev, ...updates }));
      loadInterventions();
    } catch {
      setCurrentInterv(prev => ({ ...prev, ...updates }));
      toast.success("✅ Enregistré (local)");
    } finally { setSaving(false); }
  };

  // ── Save CR ────────────────────────────────────────────────
  const saveCR = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/bloc-operatoire/${currentInterv._id}/cr`, formCR);
      toast.success("✅ Compte rendu opératoire enregistré");
      setCurrentInterv(prev => ({ ...prev, cr: formCR, statut: prev.statut === "en_cours" ? "reveil" : prev.statut }));
      setModalCR(false);
    } catch {
      setCurrentInterv(prev => ({ ...prev, cr: formCR }));
      toast.success("✅ CR enregistré (local)");
      setModalCR(false);
    } finally { setSaving(false); }
  };

  // ── Save Réveil ────────────────────────────────────────────
  const saveReveil = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/bloc-operatoire/${currentInterv._id}/reveil`, formReveil);
      toast.success("✅ Salle de réveil enregistrée");
      setCurrentInterv(prev => ({ ...prev, reveil: formReveil }));
      setModalReveil(false);
    } catch {
      setCurrentInterv(prev => ({ ...prev, reveil: formReveil }));
      toast.success("✅ Réveil enregistré (local)");
      setModalReveil(false);
    } finally { setSaving(false); }
  };

  const enCoursCount = interventions.filter(x => x.statut === "en_cours").length;
  const today = new Date().toLocaleDateString("fr-FR");

  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      <div className="bo">

        {/* ── TOPBAR ── */}
        <div className="bo-top">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap", position:"relative", zIndex:2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:54, height:54, borderRadius:14, background:"rgba(255,255,255,.12)", border:"1.5px solid rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {I.scalpel}
              </div>
              <div>
                <div style={{ fontSize:21, fontWeight:700, color:"#fff", letterSpacing:-.3 }}>Bloc Opératoire</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.55)", marginTop:2 }}>
                  {kpis.total} interventions · {today} · {enCoursCount > 0 && <span style={{ color:"#A2D9CE", fontWeight:600 }}>{enCoursCount} en cours</span>}
                </div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button className="bbtn bbtn-teal" onClick={() => { setFormInterv(EMPTY_INTERV); setModalNouv(true); }}>
                {I.plus} Nouvelle intervention
              </button>
              {currentInterv && (
                <button className="bbtn bbtn-ghost" style={{ color:"#fff", borderColor:"rgba(255,255,255,.3)" }} onClick={() => window.print()}>
                  {I.print} Imprimer
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          {(() => {
            const TABS = [
              { key:"dashboard", icon:I.grid,     label:"Tableau de bord",           labelM:"Dashboard" },
              { key:"programme", icon:I.calendar, label:"Programme du jour",          labelM:"Programme" },
              { key:"liste",     icon:I.list,     label:"Toutes les interventions",   labelM:"Intervent." },
              { key:"salles",    icon:I.room,     label:"Salles & disponibilité",     labelM:"Salles" },
              { key:"dossier",   icon:I.file,     label:currentInterv?`Intervention ${currentInterv.numero}`:"Dossier intervention", labelM:"Dossier", disabled:!currentInterv },
              { key:"stats",     icon:I.trend,    label:"Statistiques",               labelM:"Stats" },
            ].filter(t=>!t.disabled);
            return (
              <div style={isMobile?{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:'4px',padding:'8px 10px',marginTop:'8px',background:'rgba(255,255,255,.07)',borderRadius:'10px 10px 0 0'}:{display:'flex',gap:'2px',marginTop:'16px',overflowX:'auto',scrollbarWidth:'none'}}>
                {TABS.map(t=>(
                  <button key={t.key} className={`bo-tab ${tab===t.key?"active":""}`} style={isMobile?{flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'7px 3px 8px',fontSize:'9.5px',gap:'3px',borderRadius:'8px',whiteSpace:'normal',minWidth:0}:{}} onClick={()=>setTab(t.key)}>
                    <span style={isMobile?{fontSize:'14px'}:{}}>{t.icon}</span>
                    <span style={isMobile?{lineHeight:1.2}:{}}>{isMobile?t.labelM:t.label}</span>
                    {t.key==="programme"&&enCoursCount>0&&<span className="bo-tab-badge">{enCoursCount}</span>}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

        {/* ── CONTENT ── */}
        <div style={{ padding: isMobile ? 14 : 24 }}>

          {/* ══ DASHBOARD ══ */}
          {tab === "dashboard" && (
            <div>
              {/* Alert interventions en cours */}
              {enCoursCount > 0 && (
                <div className="al-bo-warn bofu" style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, flexWrap:"wrap" }}>
                  <div style={{ width:42, height:42, background:"#FAD7A0", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {I.pulse}
                  </div>
                  <div style={{ flex:1 }}>
                    <strong style={{ color:"#7E5109", fontSize:13 }}>🔪 Interventions chirurgicales en cours</strong>
                    <div style={{ fontSize:12, color:"#D68910", marginTop:3 }}>
                      <strong>{enCoursCount}</strong> intervention(s) en cours en ce moment. Surveillance active requise.
                    </div>
                  </div>
                  <button className="bbtn bbtn-teal bbtn-sm" onClick={() => setTab("programme")}>Voir le programme →</button>
                </div>
              )}

              {/* KPIs */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="blue"   icon={I.calendar} value={kpis.total}       label="Total interventions"  sub="tous statuts"          onClick={() => setTab("liste")} />
                <KpiCard color="teal"   icon={I.clock}    value={kpis.programmees}  label="Programmées"          sub="à venir"               onClick={() => { setFilter("programmee"); setTab("liste"); }} />
                <KpiCard color="orange" icon={I.pulse}    value={kpis.en_cours}     label="En cours"             sub="salles actives"        urgent={kpis.en_cours > 0} onClick={() => setTab("programme")} />
                <KpiCard color="green"  icon={I.scalpel}  value={kpis.terminees}    label="Terminées"            sub="aujourd'hui"           onClick={() => { setFilter("terminee"); setTab("liste"); }} />
                <KpiCard color="purple" icon={I.users}    value={kpis.reveil}       label="En salle réveil"      sub="surveillance postop"   onClick={() => setTab("programme")} />
                <KpiCard color="teal"   icon={I.room}     value={`${kpis.taux_occ}%`} label="Taux occupation"   sub="salles d'opération"    onClick={() => setTab("salles")} />
              </div>

              {/* Charts + Status */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"2fr 1fr", gap:20, marginBottom:24 }}>
                <div className="bo-card bofu">
                  <div className="bo-card-hdr">
                    <div><h3>{I.trend} Volume opératoire — 12 mois</h3><p>Nombre d'interventions par mois</p></div>
                  </div>
                  <div style={{ padding:20 }}>
                    <BarChart labels={chartMois} data={chartData} color="#1A5276" />
                  </div>
                </div>
                <div className="bo-card bofu">
                  <div className="bo-card-hdr">
                    <div><h3>Par spécialité</h3><p>Répartition des interventions</p></div>
                  </div>
                  <div style={{ padding:20 }}>
                    <DoughnutChart
                      labels={["Chir. Générale","Gynécologie","Orthopédie","Urologie","ORL","Autre"]}
                      data={[40, 22, 15, 10, 8, 5]}
                      colors={["#1A5276","#17A589","#D68910","#6C3483","#117A65","#5D7892"]}
                    />
                  </div>
                </div>
              </div>

              {/* Today's table */}
              <div className="bo-card bofu">
                <div className="bo-card-hdr">
                  <div><h3>{I.calendar} Programme du jour — {today}</h3><p>{DEMO_INTERVENTIONS.length} interventions planifiées</p></div>
                  <button className="bbtn bbtn-ghost bbtn-sm" onClick={() => setTab("programme")}>Programme complet →</button>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table className="bo-tbl">
                    <thead>
                      <tr><th>N°</th><th>Patient</th><th>Intervention</th><th>Chirurgien</th><th>Salle</th><th>Heure</th><th>Urgence</th><th>Statut</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {(loading ? DEMO_INTERVENTIONS : interventions).slice(0, 8).map(d => {
                        const sc = STATUT_BO[d.statut] || { cls:"gray", label:d.statut, icon:"" };
                        const uc = URGENCE_BO[d.niveau_urgence] || { cls:"gray", label:d.niveau_urgence };
                        return (
                          <tr key={d._id} style={{ background: d.statut === "en_cours" ? "#E8F8F5" : d.niveau_urgence === "extreme_urgence" ? "#FEF9E7" : "" }}>
                            <td><span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--bb)", fontSize:12 }}>{d.numero}</span></td>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--bn)" }}>{d.patient_nom}</div>
                              <div style={{ fontSize:11, color:"var(--cm)" }}>{ageCalc(d.patient_dob)} · {d.patient_gs || "—"}</div>
                            </td>
                            <td>
                              <div style={{ fontSize:12.5, color:"var(--bn)", fontWeight:500 }}>{d.type_intervention || "—"}</div>
                              <div style={{ fontSize:11, color:"var(--cm)" }}>{SPECIALITE_BO[d.specialite] || d.specialite}</div>
                            </td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{d.chirurgien || "—"}</td>
                            <td><Badge cls="blue">{d.salle || "—"}</Badge></td>
                            <td style={{ fontSize:12, fontWeight:600, color:"var(--bn)" }}>{d.date_heure_op ? new Date(d.date_heure_op).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" }) : "—"}</td>
                            <td><Badge cls={uc.cls}>{uc.label}</Badge></td>
                            <td>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <span style={{ fontSize:14 }}>{sc.icon}</span>
                                <Badge cls={sc.cls}>{sc.label}</Badge>
                              </div>
                            </td>
                            <td>
                              <button className="bbtn bbtn-ghost bbtn-sm" style={{ fontSize:11 }} onClick={() => openInterv(d)}>
                                {I.open} Ouvrir
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

          {/* ══ PROGRAMME DU JOUR ══ */}
          {tab === "programme" && (
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--bn)", marginBottom:20 }}>
                Programme opératoire — <span style={{ color:"var(--bt)" }}>{today}</span>
              </div>

              {/* Status strip */}
              <div className="status-strip bofu" style={{ marginBottom:20 }}>
                {[
                  ["Programmée",    kpis.programmees],
                  ["Préparation",   1],
                  ["En cours",      kpis.en_cours],
                  ["Salle réveil",  kpis.reveil],
                  ["Terminée",      kpis.terminees],
                ].map(([lbl, val], i) => (
                  <div key={lbl} className={`status-step ${i === 2 && kpis.en_cours > 0 ? "active" : i === 4 && kpis.terminees > 0 ? "done" : "pending"}`}>
                    <div style={{ fontSize:18, fontWeight:800 }}>{val}</div>
                    <div>{lbl}</div>
                  </div>
                ))}
              </div>

              {/* Timeline par salle */}
              {["Bloc 1","Bloc 2","Bloc 3"].map(salle => {
                const items = DEMO_INTERVENTIONS.filter(x => x.salle === salle);
                const sc_bloc = { "Bloc 1":{ color:"var(--bb)", light:"#EBF5FB" }, "Bloc 2":{ color:"var(--bt)", light:"#E8F8F5" }, "Bloc 3":{ color:"var(--bg)", light:"#EAFAF1" } }[salle] || { color:"var(--cm)", light:"#F4F9FD" };
                return (
                  <div key={salle} className="bo-card bofu" style={{ marginBottom:16 }}>
                    <div className="bo-card-hdr" style={{ background:`linear-gradient(to right,${sc_bloc.light},transparent)` }}>
                      <h3 style={{ color:sc_bloc.color }}>🏥 {salle}</h3>
                      <span style={{ fontSize:12, color:"var(--cm)" }}>{items.length} intervention(s)</span>
                    </div>
                    {items.length === 0 ? (
                      <div style={{ padding:20, textAlign:"center", color:"var(--cm)", fontSize:13 }}>Aucune intervention programmée dans cette salle</div>
                    ) : (
                      <div style={{ padding:20 }}>
                        <div className="bo-timeline">
                          {items.map(d => {
                            const sc = STATUT_BO[d.statut] || { cls:"gray", label:d.statut, icon:"" };
                            const dotCls = d.statut === "terminee" ? "done" : d.statut === "en_cours" ? "active" : "pending";
                            return (
                              <div key={d._id} className="bo-tl-item">
                                <div className={`bo-tl-dot ${dotCls}`} />
                                <div style={{ background:"#F4F9FD", border:"1.5px solid var(--cbr)", borderRadius:14, padding:"14px 16px", display:"flex", alignItems:"center", flexWrap:"wrap", gap:12, cursor:"pointer" }}
                                  onClick={() => openInterv(d)}>
                                  <div style={{ flex:1, minWidth:180 }}>
                                    <div style={{ fontWeight:700, color:"var(--bn)", fontSize:13 }}>{d.type_intervention}</div>
                                    <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>{d.patient_nom} · {d.chirurgien}</div>
                                  </div>
                                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                                    <Badge cls={sc.cls}>{sc.icon} {sc.label}</Badge>
                                    <Badge cls={URGENCE_BO[d.niveau_urgence]?.cls || "gray"}>{URGENCE_BO[d.niveau_urgence]?.label}</Badge>
                                    <span style={{ fontSize:12, color:"var(--cm)" }}>
                                      {d.date_heure_op ? new Date(d.date_heure_op).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" }) : "—"}
                                      {d.duree_estimee ? ` (${d.duree_estimee} min)` : ""}
                                    </span>
                                    {d.patient_allergies && <Badge cls="red">⚠ {d.patient_allergies}</Badge>}
                                  </div>
                                  <button className="bbtn bbtn-ghost bbtn-sm" style={{ fontSize:11 }} onClick={e => { e.stopPropagation(); openInterv(d); }}>Détails</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ LISTE ══ */}
          {tab === "liste" && (
            <div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--bn)" }}>Interventions chirurgicales</div>
                  <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>{total} intervention(s) au total</div>
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }}>{I.search}</span>
                    <input className="binp" style={{ paddingLeft:34, width:220 }} placeholder="Patient, intervention..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                  </div>
                  <select className="binp" style={{ width:180 }} value={filterStatut} onChange={e => { setFilter(e.target.value); setPage(1); }}>
                    <option value="">Tous les statuts</option>
                    <option value="programmee">Programmée</option>
                    <option value="preparation">En préparation</option>
                    <option value="en_cours">En cours</option>
                    <option value="terminee">Terminée</option>
                    <option value="reveil">Salle réveil</option>
                    <option value="annulee">Annulée</option>
                  </select>
                  <button className="bbtn bbtn-primary" onClick={() => { setFormInterv(EMPTY_INTERV); setModalNouv(true); }}>
                    {I.plus} Nouvelle intervention
                  </button>
                </div>
              </div>

              <div className="bo-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="bo-tbl" style={{ minWidth:1000 }}>
                    <thead>
                      <tr>
                        <th>N° BO</th><th>Patient</th><th>Intervention</th><th>Spécialité</th>
                        <th>Chirurgien</th><th>Anesthésiste</th><th>Salle</th>
                        <th>Date / Heure</th><th>Urgence</th><th>Statut</th><th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={11} style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>Chargement...</td></tr>
                      ) : interventions.map(d => {
                        const sc = STATUT_BO[d.statut] || { cls:"gray", label:d.statut, icon:"" };
                        const uc = URGENCE_BO[d.niveau_urgence] || { cls:"gray", label:d.niveau_urgence };
                        return (
                          <tr key={d._id} style={{ background: d.statut === "en_cours" ? "#E8F8F5" : d.niveau_urgence === "extreme_urgence" && d.statut !== "terminee" ? "#FEF9E7" : "" }}>
                            <td><span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--bb)", fontSize:12 }}>{d.numero}</span></td>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--bn)" }}>{d.patient_nom}</div>
                              <div style={{ fontSize:11, color:"var(--cm)" }}>{ageCalc(d.patient_dob)} · {d.patient_gs || "—"}</div>
                              {d.patient_allergies && <div style={{ fontSize:10, color:"var(--br)" }}>⚠ {d.patient_allergies}</div>}
                            </td>
                            <td style={{ fontSize:12.5, maxWidth:160 }}><div style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{d.type_intervention || "—"}</div></td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{SPECIALITE_BO[d.specialite] || d.specialite}</td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{d.chirurgien || "—"}</td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{d.anesthesiste || "—"}</td>
                            <td><Badge cls="blue">{d.salle || "—"}</Badge></td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>
                              <div style={{ fontWeight:600 }}>{d.date_heure_op ? new Date(d.date_heure_op).toLocaleDateString("fr-FR") : "—"}</div>
                              <div>{d.date_heure_op ? new Date(d.date_heure_op).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" }) : ""}</div>
                            </td>
                            <td><Badge cls={uc.cls}>{uc.label}</Badge></td>
                            <td><span style={{ fontSize:14 }}>{sc.icon}</span> <Badge cls={sc.cls}>{sc.label}</Badge></td>
                            <td>
                              <button className="bbtn bbtn-ghost bbtn-sm" style={{ fontSize:11 }} onClick={() => openInterv(d)}>
                                {I.open} Ouvrir
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!loading && interventions.length === 0 && (
                        <tr><td colSpan={11} style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>
                          {search ? `Aucun résultat pour "${search}"` : "Aucune intervention enregistrée"}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {total > 15 && (
                  <div style={{ padding:"12px 20px", borderTop:"1.5px solid var(--cbr)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontSize:12, color:"var(--cm)" }}>Page {page} / {Math.ceil(total/15)}</span>
                    <div style={{ display:"flex", gap:8 }}>
                      {page > 1 && <button className="bbtn bbtn-ghost bbtn-sm" onClick={() => setPage(p=>p-1)}>← Précédent</button>}
                      {page < Math.ceil(total/15) && <button className="bbtn bbtn-primary bbtn-sm" onClick={() => setPage(p=>p+1)}>Suivant →</button>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ SALLES ══ */}
          {tab === "salles" && (
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--bn)", marginBottom:20 }}>
                Salles d'opération — Disponibilité en temps réel
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:16, marginBottom:24 }}>
                {DEMO_SALLES.map(s => (
                  <div key={s.id} className={`room-card ${s.statut} bofu`}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--bn)" }}>{s.nom}</div>
                      <Badge cls={s.statut === "available" ? "green" : s.statut === "occupied" ? "red" : "orange"}>
                        {s.statut === "available" ? "✅ Disponible" : s.statut === "occupied" ? "🔴 Occupée" : "🔧 Maintenance"}
                      </Badge>
                    </div>
                    <div style={{ fontSize:12, color:"var(--cm)", marginBottom:8 }}>{s.specialite}</div>
                    {s.statut === "occupied" && s.patient && (
                      <div style={{ background:"#FDEDEC", borderRadius:8, padding:"8px 10px", fontSize:12 }}>
                        <span style={{ color:"var(--br)", fontWeight:600 }}>Patient : </span>
                        <span style={{ color:"var(--bn)" }}>{s.patient}</span>
                        {s.heure && <span style={{ color:"var(--cm)" }}> · depuis {s.heure}</span>}
                      </div>
                    )}
                    {s.statut === "maintenance" && (
                      <div style={{ background:"#FEF9E7", borderRadius:8, padding:"8px 10px", fontSize:12, color:"var(--bo)" }}>
                        {s.maintenance}
                      </div>
                    )}
                    {s.statut === "available" && s.equipement && (
                      <div style={{ fontSize:11, color:"var(--cm)", marginTop:4 }}>Équipement : {s.equipement}</div>
                    )}
                    {s.id === "reveil" && (
                      <div style={{ background:"#E8F8F5", borderRadius:8, padding:"8px 10px", fontSize:12, marginTop:8 }}>
                        <span style={{ color:"var(--bt)", fontWeight:600 }}>{s.lits_occupes}/{s.lits} lits occupés</span>
                        <div style={{ marginTop:4 }}><Prog pct={Math.round(s.lits_occupes / s.lits * 100)} color="var(--bt)" /></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Occupation rate */}
              <div className="bo-card">
                <div className="bo-card-hdr"><h3>📊 Taux d'occupation des salles — 7 derniers jours</h3></div>
                <div style={{ padding:20 }}>
                  <BarChart
                    labels={["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"]}
                    data={[75, 85, 60, 90, 70, 30, 10]}
                    color="#17A589"
                    height={160}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ══ DOSSIER INTERVENTION ══ */}
          {tab === "dossier" && currentInterv && (
            <div>
              {/* Header */}
              <div style={{ background:"linear-gradient(135deg,#0A1628,#0F2040)", borderRadius:18, padding:"20px 24px", marginBottom:20, color:"#fff" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                    <div style={{ width:56, height:56, borderRadius:14, background:"rgba(255,255,255,.15)", border:"2px solid rgba(255,255,255,.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>
                      {currentInterv.patient_sexe === "femme" ? "👩" : "👨"}
                    </div>
                    <div>
                      <div style={{ fontSize:18, fontWeight:700 }}>{currentInterv.patient_nom}</div>
                      <div style={{ fontSize:12, color:"rgba(255,255,255,.65)", marginTop:2 }}>
                        {ageCalc(currentInterv.patient_dob)} · {currentInterv.patient_poids}kg · Gr. {currentInterv.patient_gs || "—"}
                        {currentInterv.patient_allergies && <span style={{ color:"#F5B7B1" }}> · ⚠ {currentInterv.patient_allergies}</span>}
                      </div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.45)", marginTop:3 }}>
                        Dossier : {currentInterv.patient_dossier || "—"} · Service : {currentInterv.service_demandeur || "—"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                    <div style={{ background:"rgba(255,255,255,.1)", borderRadius:12, padding:"10px 16px", minWidth:160 }}>
                      <div style={{ fontSize:10, color:"rgba(255,255,255,.55)", fontWeight:600, textTransform:"uppercase", letterSpacing:.5, marginBottom:6 }}>Intervention</div>
                      <div style={{ fontSize:13, fontWeight:600, color:"#A2D9CE", marginBottom:2 }}>{currentInterv.type_intervention || "—"}</div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.6)" }}>{SPECIALITE_BO[currentInterv.specialite] || ""}</div>
                      <div style={{ marginTop:6, display:"flex", gap:6, flexWrap:"wrap" }}>
                        <Badge cls={(STATUT_BO[currentInterv.statut] || {}).cls || "gray"}>{(STATUT_BO[currentInterv.statut] || {}).icon} {(STATUT_BO[currentInterv.statut] || {}).label || currentInterv.statut}</Badge>
                        <Badge cls={(URGENCE_BO[currentInterv.niveau_urgence] || {}).cls || "gray"}>{(URGENCE_BO[currentInterv.niveau_urgence] || {}).label}</Badge>
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontFamily:"monospace", fontSize:16, fontWeight:700, color:"rgba(255,255,255,.9)" }}>{currentInterv.numero}</div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:6 }}>
                        🏥 {currentInterv.salle || "Salle non attribuée"}<br/>
                        {currentInterv.date_heure_op ? `📅 ${fmtDateTime(currentInterv.date_heure_op)}` : ""}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Alert allergies */}
              {currentInterv.patient_allergies && (
                <div className="al-bo-danger" style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                  {I.alert}
                  <div>
                    <strong style={{ color:"#922B21", fontSize:13 }}>⚠️ Allergies connues — Attention lors de l'anesthésie</strong>
                    <div style={{ fontSize:12, color:"var(--br)", marginTop:2 }}>{currentInterv.patient_allergies}</div>
                  </div>
                </div>
              )}

              {/* Section nav */}
              <div className="sec-nav-bo">
                {[
                  { id:"general",       label:"📋 Infos générales" },
                  { id:"patient",       label:"👤 Patient & Diagnostic" },
                  { id:"equipe",        label:"👥 Équipe opératoire" },
                  { id:"preop",         label:"🔬 Éval. préopératoire" },
                  { id:"checklist",     label:`✅ Check-list` },
                  { id:"deroulement",   label:"🔪 Déroulement" },
                  { id:"cr",            label:"📝 Compte rendu" },
                  { id:"reveil",        label:"💊 Salle réveil" },
                  { id:"consommables",  label:`📦 Consommables (${consommables.length})` },
                  { id:"facturation",   label:"💰 Facturation" },
                  { id:"documents",     label:"📄 Documents" },
                ].map(s => (
                  <button key={s.id} className={`sec-btn-bo ${section === s.id ? "active" : ""}`} onClick={() => setSection(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>

              {/* ── GÉNÉRAL ── */}
              {section === "general" && (
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20, marginTop:20 }}>
                  <div className="bo-card">
                    <div className="bo-card-hdr"><h3>📋 Informations générales</h3></div>
                    <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
                      <div>
                        <label className="blbl">Statut de l'intervention *</label>
                        <select className="binp" value={currentInterv.statut} onChange={e => setCurrentInterv(d => ({ ...d, statut:e.target.value }))}>
                          <option value="programmee">📅 Programmée</option>
                          <option value="preparation">🔧 En préparation</option>
                          <option value="en_cours">🔪 En cours</option>
                          <option value="reveil">💊 Salle de réveil</option>
                          <option value="terminee">✅ Terminée</option>
                          <option value="annulee">❌ Annulée</option>
                        </select>
                      </div>
                      <div>
                        <label className="blbl">Date et heure de l'opération</label>
                        <input type="datetime-local" className="binp" value={fmtDateTimeInput(currentInterv.date_heure_op)} onChange={e => setCurrentInterv(d => ({ ...d, date_heure_op:e.target.value }))} />
                      </div>
                      <div>
                        <label className="blbl">Salle attribuée</label>
                        <select className="binp" value={currentInterv.salle || ""} onChange={e => setCurrentInterv(d => ({ ...d, salle:e.target.value }))}>
                          <option value="">— Non attribuée —</option>
                          {[1,2,3,4].map(n => <option key={n} value={`Bloc ${n}`}>Bloc {n}</option>)}
                          <option value="Salle urgences">Salle urgences</option>
                        </select>
                      </div>
                      <div>
                        <label className="blbl">Service demandeur</label>
                        <input className="binp" value={currentInterv.service_demandeur || ""} onChange={e => setCurrentInterv(d => ({ ...d, service_demandeur:e.target.value }))} placeholder="Ex: Urgences, Chirurgie générale..." />
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                        <div>
                          <label className="blbl">Heure d'entrée en salle</label>
                          <input type="time" className="binp" value={currentInterv.heure_debut ? new Date(currentInterv.heure_debut).toTimeString().substring(0,5) : ""} onChange={e => setCurrentInterv(d => ({ ...d, heure_debut: e.target.value }))} />
                        </div>
                        <div>
                          <label className="blbl">Heure de sortie de salle</label>
                          <input type="time" className="binp" value={currentInterv.heure_fin ? new Date(currentInterv.heure_fin).toTimeString().substring(0,5) : ""} onChange={e => setCurrentInterv(d => ({ ...d, heure_fin: e.target.value }))} />
                        </div>
                      </div>
                      <button className="bbtn bbtn-teal" disabled={saving} onClick={() => updateInterv({ statut:currentInterv.statut, date_heure_op:currentInterv.date_heure_op, salle:currentInterv.salle, service_demandeur:currentInterv.service_demandeur })}>
                        {I.save} {saving ? "Enregistrement..." : "Enregistrer"}
                      </button>
                    </div>
                  </div>

                  {/* Liaisons modules */}
                  <div className="bo-card">
                    <div className="bo-card-hdr"><h3>🔗 Intégrations modules</h3></div>
                    <div style={{ padding:20 }}>
                      <div style={{ fontSize:12, color:"var(--cm)", marginBottom:14 }}>Le dossier du bloc est connecté aux modules suivants :</div>
                      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
                        {[
                          ["🩺","Consultation","Dossier chirurgical source"],
                          ["🛏","Hospitalisation","Liaison lit préop/postop"],
                          ["🔬","Laboratoire","Résultats bilan préop"],
                          ["🩻","Imagerie","Radiologies disponibles"],
                          ["💊","Pharmacie","Prescriptions & médicaments"],
                          ["📦","Stock médical","Consommables utilisés"],
                          ["💰","Facturation","Frais opératoires"],
                          ["📁","Dossier patient","Centralisation données"],
                        ].map(([ico,mod,desc]) => (
                          <div key={mod} style={{ background:"#F4F9FD", border:"1.5px solid var(--cbr)", borderRadius:10, padding:"10px 12px", display:"flex", alignItems:"flex-start", gap:8, cursor:"pointer", transition:"all .2s" }}
                            onMouseOver={e => e.currentTarget.style.background = "#EAF4FB"}
                            onMouseOut={e => e.currentTarget.style.background = "#F4F9FD"}>
                            <span style={{ fontSize:16, flexShrink:0 }}>{ico}</span>
                            <div>
                              <div style={{ fontSize:12, fontWeight:700, color:"var(--bn)" }}>{mod}</div>
                              <div style={{ fontSize:10, color:"var(--cm)" }}>{desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── PATIENT & DIAGNOSTIC ── */}
              {section === "patient" && (
                <div style={{ marginTop:20 }}>
                  <div className="bo-card">
                    <div className="bo-card-hdr"><h3>👤 Patient & Diagnostic préopératoire</h3></div>
                    <div style={{ padding:20, display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>
                      <div style={{ gridColumn:"1/-1", display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
                        {[
                          ["Nom complet", currentInterv.patient_nom],
                          ["Âge", ageCalc(currentInterv.patient_dob)],
                          ["Sexe", currentInterv.patient_sexe ? currentInterv.patient_sexe.charAt(0).toUpperCase() + currentInterv.patient_sexe.slice(1) : "—"],
                          ["Poids", currentInterv.patient_poids ? `${currentInterv.patient_poids} kg` : "—"],
                          ["Groupe sanguin", currentInterv.patient_gs || "—"],
                          ["N° dossier", currentInterv.patient_dossier || "—"],
                        ].map(([lbl,val]) => (
                          <div key={lbl} style={{ background:"#F4F9FD", border:"1.5px solid var(--cbr)", borderRadius:10, padding:"10px 12px" }}>
                            <div style={{ fontSize:10, fontWeight:600, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.4 }}>{lbl}</div>
                            <div style={{ fontSize:13, fontWeight:600, color:"var(--bn)", marginTop:2 }}>{val}</div>
                          </div>
                        ))}
                      </div>
                      {currentInterv.patient_allergies && (
                        <div style={{ gridColumn:"1/-1", background:"#FDEDEC", border:"1.5px solid #F5B7B1", borderRadius:10, padding:"10px 14px" }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"var(--br)", textTransform:"uppercase", letterSpacing:.4 }}>⚠️ Allergies connues</div>
                          <div style={{ fontSize:13, color:"var(--bn)", marginTop:4 }}>{currentInterv.patient_allergies}</div>
                        </div>
                      )}
                      <div style={{ gridColumn:"1/-1" }}>
                        <label className="blbl">Diagnostic préopératoire *</label>
                        <textarea className="binp" rows={3} value={currentInterv.diagnostic_preop || ""} onChange={e => setCurrentInterv(d => ({ ...d, diagnostic_preop:e.target.value }))} placeholder="Diagnostic établi lors de la consultation chirurgicale..." />
                      </div>
                      <div>
                        <label className="blbl">Type d'intervention</label>
                        <input className="binp" value={currentInterv.type_intervention || ""} onChange={e => setCurrentInterv(d => ({ ...d, type_intervention:e.target.value }))} />
                      </div>
                      <div>
                        <label className="blbl">Spécialité chirurgicale</label>
                        <select className="binp" value={currentInterv.specialite || "chirurgie_generale"} onChange={e => setCurrentInterv(d => ({ ...d, specialite:e.target.value }))}>
                          {Object.entries(SPECIALITE_BO).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="blbl">Niveau d'urgence</label>
                        <select className="binp" value={currentInterv.niveau_urgence || "programmee"} onChange={e => setCurrentInterv(d => ({ ...d, niveau_urgence:e.target.value }))}>
                          <option value="programmee">Programmée</option>
                          <option value="urgente">Urgente</option>
                          <option value="extreme_urgence">Extrême urgence</option>
                        </select>
                      </div>
                      <div>
                        <label className="blbl">Durée estimée (min)</label>
                        <input type="number" className="binp" min={10} max={600} value={currentInterv.duree_estimee || ""} onChange={e => setCurrentInterv(d => ({ ...d, duree_estimee:e.target.value }))} placeholder="90" />
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
                    <button className="bbtn bbtn-teal" disabled={saving} onClick={() => updateInterv({ diagnostic_preop:currentInterv.diagnostic_preop, type_intervention:currentInterv.type_intervention, specialite:currentInterv.specialite, niveau_urgence:currentInterv.niveau_urgence, duree_estimee:currentInterv.duree_estimee })}>
                      {I.save} {saving ? "..." : "Enregistrer"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── ÉQUIPE ── */}
              {section === "equipe" && (
                <div style={{ marginTop:20, display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:20 }}>
                  {/* Chirurgie */}
                  <div className="bo-card">
                    <div className="bo-card-hdr" style={{ background:"linear-gradient(to right,#EBF5FB,transparent)" }}>
                      <h3 style={{ color:"var(--bb)" }}>🔪 Équipe chirurgicale</h3>
                    </div>
                    <div style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>
                      <div>
                        <label className="blbl">Chirurgien principal *</label>
                        <input className="binp" value={currentInterv.chirurgien || ""} onChange={e => setCurrentInterv(d => ({ ...d, chirurgien:e.target.value }))} placeholder="Dr. Nom Prénom" />
                      </div>
                      <div>
                        <label className="blbl">Assistant chirurgien</label>
                        <input className="binp" value={currentInterv.assistant || ""} onChange={e => setCurrentInterv(d => ({ ...d, assistant:e.target.value }))} placeholder="Dr. Nom Prénom" />
                      </div>
                    </div>
                  </div>
                  {/* Anesthésie */}
                  <div className="bo-card">
                    <div className="bo-card-hdr" style={{ background:"linear-gradient(to right,#E8F8F5,transparent)" }}>
                      <h3 style={{ color:"var(--bt)" }}>💉 Équipe anesthésique</h3>
                    </div>
                    <div style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>
                      <div>
                        <label className="blbl">Anesthésiste *</label>
                        <input className="binp" value={currentInterv.anesthesiste || ""} onChange={e => setCurrentInterv(d => ({ ...d, anesthesiste:e.target.value }))} placeholder="Dr. Nom Prénom" />
                      </div>
                      <div>
                        <label className="blbl">Assistant anesthésiste</label>
                        <input className="binp" value={currentInterv.assistant_anesth || ""} onChange={e => setCurrentInterv(d => ({ ...d, assistant_anesth:e.target.value }))} placeholder="Dr. / IADE Nom Prénom" />
                      </div>
                    </div>
                  </div>
                  {/* Infirmiers */}
                  <div className="bo-card">
                    <div className="bo-card-hdr" style={{ background:"linear-gradient(to right,#EAFAF1,transparent)" }}>
                      <h3 style={{ color:"var(--bg)" }}>🩺 Personnel infirmier</h3>
                    </div>
                    <div style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>
                      <div>
                        <label className="blbl">Infirmier(ère) instrumentiste</label>
                        <input className="binp" value={currentInterv.infirmier_instru || ""} onChange={e => setCurrentInterv(d => ({ ...d, infirmier_instru:e.target.value }))} placeholder="Inf. Nom Prénom" />
                      </div>
                      <div>
                        <label className="blbl">Infirmier(ère) circulant(e)</label>
                        <input className="binp" value={currentInterv.infirmier_circu || ""} onChange={e => setCurrentInterv(d => ({ ...d, infirmier_circu:e.target.value }))} placeholder="Inf. Nom Prénom" />
                      </div>
                    </div>
                  </div>
                  <div style={{ gridColumn:"1/-1", display:"flex", justifyContent:"flex-end" }}>
                    <button className="bbtn bbtn-teal" disabled={saving} onClick={() => updateInterv({ chirurgien:currentInterv.chirurgien, assistant:currentInterv.assistant, anesthesiste:currentInterv.anesthesiste, assistant_anesth:currentInterv.assistant_anesth, infirmier_instru:currentInterv.infirmier_instru, infirmier_circu:currentInterv.infirmier_circu })}>
                      {I.save} {saving ? "..." : "Enregistrer l'équipe"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── ÉVALUATION PRÉOP ── */}
              {section === "preop" && (
                <div style={{ marginTop:20 }}>
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20, marginBottom:20 }}>
                    <div className="bo-card">
                      <div className="bo-card-hdr"><h3>🔬 Examens obligatoires</h3></div>
                      <div style={{ padding:16, display:"flex", flexDirection:"column", gap:10 }}>
                        {[
                          { id:"bio",      label:"Analyses biologiques (NFS, coag, biochimie)", done:true },
                          { id:"imagerie", label:"Imagerie médicale appropriée", done:true },
                          { id:"anesth",   label:"Évaluation anesthésique (score ASA)", done:false },
                          { id:"ecg",      label:"ECG si patient > 40 ans", done:true },
                          { id:"rxp",      label:"Radiographie pulmonaire", done:false },
                        ].map(item => (
                          <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background: item.done ? "#EAFAF1" : "#F4F9FD", borderRadius:10, border:`1.5px solid ${item.done ? "#A9DFBF" : "var(--cbr)"}` }}>
                            <div style={{ width:20, height:20, borderRadius:6, background: item.done ? "var(--bg)" : "var(--cbr)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                              {item.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                            <span style={{ fontSize:12.5, color:item.done ? "var(--bg)" : "var(--cm)", fontWeight: item.done ? 600 : 400 }}>{item.label}</span>
                            {!item.done && <Badge cls="orange" style={{ marginLeft:"auto" }}>En attente</Badge>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bo-card">
                      <div className="bo-card-hdr"><h3>✍️ Consentement éclairé</h3></div>
                      <div style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>
                        <div style={{ background: currentInterv.consentement_signe ? "#EAFAF1" : "#FEF9E7", border:`1.5px solid ${currentInterv.consentement_signe ? "#A9DFBF" : "#FAD7A0"}`, borderRadius:12, padding:16, textAlign:"center" }}>
                          <div style={{ fontSize:28, marginBottom:8 }}>{currentInterv.consentement_signe ? "✅" : "⚠️"}</div>
                          <div style={{ fontWeight:700, color:currentInterv.consentement_signe ? "var(--bg)" : "var(--bo)", fontSize:14 }}>
                            {currentInterv.consentement_signe ? "Consentement signé" : "Consentement non signé"}
                          </div>
                          {currentInterv.consentement_signe && <div style={{ fontSize:11, color:"var(--cm)", marginTop:4 }}>Date de signature disponible en documents</div>}
                        </div>
                        <div>
                          <label className="blbl">Date de signature</label>
                          <input type="date" className="binp" value={fmtDateInput(currentInterv.date_consentement)} onChange={e => setCurrentInterv(d => ({ ...d, date_consentement:e.target.value }))} />
                        </div>
                        <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", padding:"10px 12px", background:"#F4F9FD", borderRadius:10 }}>
                          <input type="checkbox" checked={currentInterv.consentement_signe || false} onChange={e => setCurrentInterv(d => ({ ...d, consentement_signe:e.target.checked }))} style={{ width:16, height:16, accentColor:"var(--bg)" }} />
                          <span style={{ fontSize:13, fontWeight:600, color:"var(--bn)" }}>✅ Consentement éclairé signé</span>
                        </label>
                        <button className="bbtn bbtn-ghost bbtn-sm">{I.dl} Générer le formulaire</button>
                      </div>
                    </div>
                  </div>

                  {/* Score ASA */}
                  <div className="bo-card">
                    <div className="bo-card-hdr"><h3>💉 Score ASA — Évaluation risque anesthésique</h3></div>
                    <div style={{ padding:16 }}>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:10 }}>
                        {[
                          { val:"I",   desc:"Patient sain",                        color:"#1E8449", bg:"#EAFAF1" },
                          { val:"II",  desc:"Maladie systémique légère",            color:"#17A589", bg:"#E8F8F5" },
                          { val:"III", desc:"Maladie systémique sévère",            color:"#D68910", bg:"#FEF9E7" },
                          { val:"IV",  desc:"Maladie systémique sévère avec risque vital", color:"#C0392B", bg:"#FDEDEC" },
                          { val:"V",   desc:"Moribond sans chirurgie",              color:"#7B241C", bg:"#FADBD8" },
                        ].map(s => {
                          const active = currentInterv.score_asa === s.val;
                          return (
                            <div key={s.val}
                              style={{ border:`2px solid ${active ? s.color : "var(--cbr)"}`, borderRadius:12, padding:"12px 14px", background: active ? s.bg : "#F4F9FD", cursor:"pointer", transition:"all .2s" }}
                              onClick={() => setCurrentInterv(d => ({ ...d, score_asa:s.val }))}>
                              <div style={{ fontSize:18, fontWeight:800, color:s.color }}>ASA {s.val}</div>
                              <div style={{ fontSize:11, color:"var(--cm)", marginTop:4 }}>{s.desc}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── CHECK-LIST ── */}
              {section === "checklist" && (
                <div style={{ marginTop:20 }}>
                  <div className="al-bo-ia" style={{ marginBottom:20 }}>
                    <strong style={{ color:"#154360", fontSize:13 }}>✅ Check-list sécurité — OMS Bloc Opératoire</strong>
                    <div style={{ fontSize:12, color:"var(--bb)", marginTop:4 }}>
                      Validation obligatoire avant toute incision. {Object.values(checklist).filter(Boolean).length}/{CHECKLIST_ITEMS.length} items validés.
                    </div>
                    <div style={{ marginTop:8 }}><Prog pct={Math.round(Object.values(checklist).filter(Boolean).length / CHECKLIST_ITEMS.length * 100)} color="var(--bb)" /></div>
                  </div>

                  <div className="bo-card">
                    <div className="bo-card-hdr"><h3>📋 Vérifications préopératoires</h3></div>
                    <div style={{ padding:16 }}>
                      {CHECKLIST_ITEMS.map(item => (
                        <div key={item.id} className={`chk-item ${checklist[item.id] ? "done" : ""}`}
                          onClick={() => setChecklist(c => ({ ...c, [item.id]:!c[item.id] }))}>
                          <div className="chk-box">
                            {checklist[item.id] && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          </div>
                          <span style={{ fontSize:13, color:checklist[item.id] ? "var(--bg)" : "var(--bn)", fontWeight:checklist[item.id] ? 600 : 400 }}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12, gap:10 }}>
                    {Object.values(checklist).every(Boolean) && (
                      <div className="al-bo-success" style={{ flex:1, display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontSize:20 }}>✅</span>
                        <strong style={{ color:"var(--bg)", fontSize:13 }}>Check-list complète — Autorisation d'incision confirmée</strong>
                      </div>
                    )}
                    <button className="bbtn bbtn-teal" onClick={() => { updateInterv({ checklist:checklist, checklist_done:Object.values(checklist).every(Boolean) }); toast.success("✅ Check-list sauvegardée"); }}>
                      {I.save} Sauvegarder la check-list
                    </button>
                  </div>
                </div>
              )}

              {/* ── DÉROULEMENT ── */}
              {section === "deroulement" && (
                <div style={{ marginTop:20 }}>
                  <div className="bo-card">
                    <div className="bo-card-hdr"><h3>🔪 Déroulement opératoire</h3></div>
                    <div style={{ padding:20, display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>
                      <div>
                        <label className="blbl">Heure de début réelle</label>
                        <input type="datetime-local" className="binp" value={fmtDateTimeInput(currentInterv.heure_debut)} onChange={e => setCurrentInterv(d => ({ ...d, heure_debut:e.target.value }))} />
                      </div>
                      <div>
                        <label className="blbl">Heure de fin réelle</label>
                        <input type="datetime-local" className="binp" value={fmtDateTimeInput(currentInterv.heure_fin)} onChange={e => setCurrentInterv(d => ({ ...d, heure_fin:e.target.value }))} />
                      </div>
                      {currentInterv.heure_debut && currentInterv.heure_fin && (
                        <div style={{ gridColumn:"1/-1", background:"#E8F8F5", border:"1.5px solid #A2D9CE", borderRadius:10, padding:"10px 14px" }}>
                          <span style={{ fontSize:12, color:"var(--bt)", fontWeight:600 }}>⏱ Durée réelle : </span>
                          <span style={{ fontSize:13, fontWeight:700, color:"var(--bn)" }}>
                            {Math.round((new Date(currentInterv.heure_fin) - new Date(currentInterv.heure_debut)) / 60000)} min
                          </span>
                          {currentInterv.duree_estimee && <span style={{ fontSize:11, color:"var(--cm)", marginLeft:8 }}>(estimée : {currentInterv.duree_estimee} min)</span>}
                        </div>
                      )}
                      <div style={{ gridColumn:"1/-1" }}>
                        <label className="blbl">Technique utilisée</label>
                        <input className="binp" value={currentInterv.technique || ""} onChange={e => setCurrentInterv(d => ({ ...d, technique:e.target.value }))} placeholder="Ex: Laparoscopie, Laparotomie, Arthroscopie..." />
                      </div>
                      <div>
                        <label className="blbl">Matériel implanté</label>
                        <input className="binp" value={currentInterv.materiel_implante || ""} onChange={e => setCurrentInterv(d => ({ ...d, materiel_implante:e.target.value }))} placeholder="Prothèse, filet, drain..." />
                      </div>
                      <div>
                        <label className="blbl">Saignement peropératoire (ml)</label>
                        <input type="number" className="binp" min={0} value={currentInterv.saignement_ml || ""} onChange={e => setCurrentInterv(d => ({ ...d, saignement_ml:e.target.value }))} placeholder="Ex: 150" />
                      </div>
                      <div>
                        <label className="blbl">Transfusion sanguine (ml)</label>
                        <input type="number" className="binp" min={0} value={currentInterv.transfusion_ml || ""} onChange={e => setCurrentInterv(d => ({ ...d, transfusion_ml:e.target.value }))} placeholder="0" />
                      </div>
                      <div>
                        <label className="blbl">Type d'anesthésie</label>
                        <select className="binp" value={currentInterv.type_anesth || ""} onChange={e => setCurrentInterv(d => ({ ...d, type_anesth:e.target.value }))}>
                          <option value="">— Sélectionner —</option>
                          <option value="generale">Anesthésie générale</option>
                          <option value="locoreg">Anesthésie locorégionale</option>
                          <option value="rachianesthesie">Rachianesthésie</option>
                          <option value="peridurale">Péridurale</option>
                          <option value="locale">Anesthésie locale</option>
                        </select>
                      </div>
                      <div style={{ gridColumn:"1/-1" }}>
                        <label className="blbl">Incidents peropératoires</label>
                        <textarea className="binp" rows={3} value={currentInterv.incidents || ""} onChange={e => setCurrentInterv(d => ({ ...d, incidents:e.target.value }))} placeholder="Difficultés rencontrées, incidents, complications peropératoires..." />
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
                    <button className="bbtn bbtn-teal" disabled={saving} onClick={() => updateInterv({ heure_debut:currentInterv.heure_debut, heure_fin:currentInterv.heure_fin, technique:currentInterv.technique, materiel_implante:currentInterv.materiel_implante, saignement_ml:currentInterv.saignement_ml, transfusion_ml:currentInterv.transfusion_ml, type_anesth:currentInterv.type_anesth, incidents:currentInterv.incidents })}>
                      {I.save} {saving ? "..." : "Enregistrer le déroulement"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── COMPTE RENDU ── */}
              {section === "cr" && (
                <div style={{ marginTop:20 }}>
                  {currentInterv.cr ? (
                    <div>
                      <div className="al-bo-success" style={{ marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontSize:20 }}>📝</span>
                        <strong style={{ color:"var(--bg)" }}>Compte rendu opératoire enregistré</strong>
                      </div>
                      <div className="bo-card">
                        <div className="bo-card-hdr">
                          <h3>📝 Compte rendu opératoire</h3>
                          <button className="bbtn bbtn-ghost bbtn-sm" onClick={() => { setFormCR(currentInterv.cr); setModalCR(true); }}>Modifier</button>
                        </div>
                        <div style={{ padding:20 }}>
                          {[
                            ["Diagnostic préopératoire", currentInterv.cr.diagnostic_preop],
                            ["Diagnostic postopératoire", currentInterv.cr.diagnostic_postop],
                            ["Résumé opératoire", currentInterv.cr.resume],
                            ["Compte rendu détaillé", currentInterv.cr.cr_detail],
                            ["Recommandations", currentInterv.cr.recommandations],
                          ].map(([lbl, val]) => val && (
                            <div key={lbl} style={{ marginBottom:14 }}>
                              <div style={{ fontSize:11, fontWeight:700, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.4, marginBottom:6 }}>{lbl}</div>
                              <div style={{ background:"#F4F9FD", borderRadius:10, padding:"10px 14px", fontSize:13, color:"var(--bn)", whiteSpace:"pre-wrap" }}>{val}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bo-card" style={{ padding:40, textAlign:"center" }}>
                      <div style={{ fontSize:40, marginBottom:14 }}>📝</div>
                      <div style={{ fontWeight:700, fontSize:16, color:"var(--bn)", marginBottom:8 }}>Compte rendu opératoire</div>
                      <div style={{ color:"var(--cm)", fontSize:13, marginBottom:20 }}>Aucun compte rendu enregistré pour cette intervention.</div>
                      <button className="bbtn bbtn-primary" onClick={() => { setFormCR({ ...EMPTY_CR, diagnostic_preop:currentInterv.diagnostic_preop || "" }); setModalCR(true); }}>
                        {I.plus} Rédiger le compte rendu
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── SALLE RÉVEIL ── */}
              {section === "reveil" && (
                <div style={{ marginTop:20 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--bn)" }}>Surveillance salle de réveil</div>
                      <div style={{ fontSize:12, color:"var(--cm)" }}>Monitoring postanesthésique</div>
                    </div>
                    <button className="bbtn bbtn-primary" onClick={() => { setFormReveil({ ...EMPTY_REVEIL }); setModalReveil(true); }}>
                      {I.plus} Enregistrer surveillance
                    </button>
                  </div>

                  {currentInterv.reveil ? (
                    <div className="bo-card">
                      <div className="bo-card-hdr">
                        <h3>💊 Paramètres de réveil</h3>
                        <Badge cls={currentInterv.reveil.etat_patient === "stable" ? "green" : currentInterv.reveil.etat_patient === "instable" ? "red" : "orange"}>
                          État : {currentInterv.reveil.etat_patient}
                        </Badge>
                      </div>
                      <div style={{ padding:20 }}>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:12, marginBottom:16 }}>
                          {[
                            { lbl:"Température", val:currentInterv.reveil.temperature ? `${currentInterv.reveil.temperature}°C` : "—", warn:currentInterv.reveil.temperature > 38.5 || currentInterv.reveil.temperature < 36 },
                            { lbl:"Tension", val:currentInterv.reveil.tension_sys && currentInterv.reveil.tension_dia ? `${currentInterv.reveil.tension_sys}/${currentInterv.reveil.tension_dia}` : "—", warn:false },
                            { lbl:"Pouls", val:currentInterv.reveil.pouls ? `${currentInterv.reveil.pouls} bpm` : "—", warn:currentInterv.reveil.pouls > 100 || currentInterv.reveil.pouls < 55 },
                            { lbl:"Douleur", val:currentInterv.reveil.douleur_score !== "" ? `${currentInterv.reveil.douleur_score}/10` : "—", warn:currentInterv.reveil.douleur_score > 5 },
                          ].map(v => (
                            <div key={v.lbl} className={`vital-bo ${v.warn && v.val !== "—" ? "danger" : ""}`}>
                              <div className="vital-v-bo" style={v.warn && v.val !== "—" ? { color:"var(--br)" } : {}}>{v.val}</div>
                              <div className="vital-l-bo">{v.lbl}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                          <div style={{ background:"#F4F9FD", borderRadius:10, padding:"10px 12px" }}>
                            <div style={{ fontSize:11, color:"var(--cm)", fontWeight:600 }}>HEURE D'ARRIVÉE</div>
                            <div style={{ fontSize:14, fontWeight:700, color:"var(--bn)", marginTop:2 }}>{currentInterv.reveil.heure_arrivee || "—"}</div>
                          </div>
                          <div style={{ background:"#F4F9FD", borderRadius:10, padding:"10px 12px" }}>
                            <div style={{ fontSize:11, color:"var(--cm)", fontWeight:600 }}>HEURE DE SORTIE</div>
                            <div style={{ fontSize:14, fontWeight:700, color:"var(--bn)", marginTop:2 }}>{currentInterv.reveil.heure_sortie || "En salle réveil"}</div>
                          </div>
                        </div>
                        {currentInterv.reveil.observations && (
                          <div style={{ marginTop:12, background:"#F4F9FD", borderRadius:10, padding:"10px 14px", fontSize:12, color:"var(--cm)" }}>
                            <strong>Observations :</strong> {currentInterv.reveil.observations}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bo-card" style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>
                      Aucune donnée de réveil enregistrée
                    </div>
                  )}
                </div>
              )}

              {/* ── CONSOMMABLES ── */}
              {section === "consommables" && (
                <div style={{ marginTop:20 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--bn)" }}>Consommables & Matériel utilisés</div>
                      <div style={{ fontSize:12, color:"var(--cm)" }}>Déduction automatique du stock médical</div>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button className="bbtn bbtn-primary bbtn-sm" onClick={() => toast.success("📦 Ajout au stock en cours...")}>
                        {I.plus} Ajouter article
                      </button>
                      <button className="bbtn bbtn-teal bbtn-sm" onClick={() => toast.success("✅ Déduction stock enregistrée")}>
                        {I.box} Valider déduction stock
                      </button>
                    </div>
                  </div>

                  <div className="bo-card">
                    <div className="bo-card-hdr">
                      <h3>📦 Liste des consommables utilisés</h3>
                      <Badge cls="blue">{consommables.reduce((s,c)=>s+c.quantite,0)} articles</Badge>
                    </div>
                    <div style={{ padding:16 }}>
                      {consommables.map((c, i) => (
                        <div key={c.id} className="conso-row">
                          <div style={{ width:28, height:28, borderRadius:8, background:"#EBF5FB", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>📦</div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:"var(--bn)" }}>{c.designation}</div>
                            <div style={{ fontSize:11, color:"var(--cm)" }}>{c.categorie} · Stock dispo : {c.stock_dispo}</div>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <button style={{ width:28, height:28, borderRadius:8, border:"1.5px solid var(--cbr)", background:"#F4F9FD", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Poppins,sans-serif" }}
                              onClick={() => setConsommables(prev => prev.map((x,j) => j===i ? { ...x, quantite:Math.max(1,x.quantite-1) } : x))}>−</button>
                            <span style={{ fontSize:14, fontWeight:700, color:"var(--bn)", minWidth:24, textAlign:"center" }}>{c.quantite}</span>
                            <button style={{ width:28, height:28, borderRadius:8, border:"1.5px solid var(--cbr)", background:"#F4F9FD", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Poppins,sans-serif" }}
                              onClick={() => setConsommables(prev => prev.map((x,j) => j===i ? { ...x, quantite:x.quantite+1 } : x))}>+</button>
                            <span style={{ fontSize:11, color:"var(--cm)" }}>{c.unite}</span>
                          </div>
                        </div>
                      ))}
                      <div style={{ marginTop:14, paddingTop:12, borderTop:"1.5px solid var(--cbr)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                        <span style={{ fontSize:12, color:"var(--cm)" }}>Total articles utilisés</span>
                        <strong style={{ color:"var(--bn)", fontSize:15 }}>{consommables.reduce((s,c)=>s+c.quantite,0)} unités</strong>
                      </div>
                    </div>
                  </div>

                  <div className="al-bo-ia" style={{ marginTop:16, display:"flex", alignItems:"flex-start", gap:12 }}>
                    <span style={{ fontSize:18 }}>📦</span>
                    <div>
                      <strong style={{ color:"#154360", fontSize:13 }}>Liaison automatique avec le stock médical</strong>
                      <div style={{ fontSize:12, color:"var(--bb)", marginTop:4 }}>
                        Après validation, les quantités utilisées seront automatiquement déduites du stock. Alertes de stock critique activées.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── FACTURATION ── */}
              {section === "facturation" && (
                <div style={{ marginTop:20 }}>
                  <div className="bo-card">
                    <div className="bo-card-hdr"><h3>💰 Facturation du bloc opératoire</h3></div>
                    <div style={{ padding:20 }}>
                      {(() => {
                        const actes = [
                          ["Utilisation de la salle d'opération", 150000],
                          [`Honoraires chirurgien — ${currentInterv.chirurgien || "—"}`, 200000],
                          [`Honoraires anesthésiste — ${currentInterv.anesthesiste || "—"}`, 100000],
                          ["Consommables médicaux utilisés", consommables.reduce((s,c)=>s+(c.quantite*2000),0)],
                          ["Médicaments anesthésiques", 45000],
                          ["Frais de stérilisation & nettoyage", 20000],
                        ];
                        const total = actes.reduce((s,[,v])=>s+v,0);
                        const paye = Math.round(total * 0.6);
                        const reste = total - paye;
                        return (
                          <>
                            <table className="bo-tbl" style={{ marginBottom:20 }}>
                              <thead><tr><th>Prestation</th><th style={{textAlign:"right"}}>Montant (CFA)</th></tr></thead>
                              <tbody>{actes.map(([lbl,val]) => <tr key={lbl}><td>{lbl}</td><td style={{textAlign:"right",fontWeight:600}}>{val.toLocaleString("fr-FR")}</td></tr>)}</tbody>
                            </table>
                            <div style={{ background:"#F4F9FD", borderRadius:14, padding:16 }}>
                              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:12 }}>
                                <div style={{ background:"#EBF5FB", borderRadius:10, padding:14, textAlign:"center" }}>
                                  <div style={{ fontSize:18, fontWeight:800, color:"var(--bb)" }}>{total.toLocaleString("fr-FR")}</div>
                                  <div style={{ fontSize:11, color:"var(--cm)", marginTop:2 }}>TOTAL (CFA)</div>
                                </div>
                                <div style={{ background:"#EAFAF1", borderRadius:10, padding:14, textAlign:"center" }}>
                                  <div style={{ fontSize:18, fontWeight:800, color:"var(--bg)" }}>{paye.toLocaleString("fr-FR")}</div>
                                  <div style={{ fontSize:11, color:"var(--cm)", marginTop:2 }}>PAYÉ (CFA)</div>
                                </div>
                                <div style={{ background:"#FDEDEC", borderRadius:10, padding:14, textAlign:"center" }}>
                                  <div style={{ fontSize:18, fontWeight:800, color:"var(--br)" }}>{reste.toLocaleString("fr-FR")}</div>
                                  <div style={{ fontSize:11, color:"var(--cm)", marginTop:2 }}>RESTE À PAYER</div>
                                </div>
                              </div>
                              <Prog pct={Math.round(paye/total*100)} color="var(--bg)" />
                            </div>
                            <div style={{ display:"flex", gap:10, marginTop:16, flexWrap:"wrap" }}>
                              <button className="bbtn bbtn-teal">{I.dl} Générer facture</button>
                              <button className="bbtn bbtn-ghost">{I.print} Imprimer devis</button>
                              <button className="bbtn bbtn-ghost">{I.link} Envoyer à la facturation</button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* ── DOCUMENTS ── */}
              {section === "documents" && (
                <div style={{ marginTop:20 }}>
                  <div className="bo-card">
                    <div className="bo-card-hdr"><h3>📄 Documents du bloc opératoire</h3></div>
                    <div style={{ padding:20, display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:14 }}>
                      {[
                        ["📅","Programme opératoire","Planning et horaires d'intervention"],
                        ["✍️","Consentement éclairé","Formulaire de consentement patient"],
                        ["✅","Check-list sécurité","Vérifications préopératoires OMS"],
                        ["📝","Compte rendu opératoire","Rapport détaillé de l'intervention"],
                        ["💉","Rapport anesthésique","Fiche d'anesthésie et monitoring"],
                        ["💊","Ordonnance postopératoire","Prescriptions de sortie de bloc"],
                        ["📦","Bon de consommables","Liste du matériel utilisé"],
                        ["💰","Facture du bloc","Détail des frais opératoires"],
                      ].map(([icon,title,desc]) => (
                        <div key={title} style={{ background:"#F4F9FD", border:"1.5px solid var(--cbr)", borderRadius:14, padding:16, display:"flex", flexDirection:"column", gap:8 }}
                          onMouseOver={e => e.currentTarget.style.boxShadow="var(--shm)"} onMouseOut={e => e.currentTarget.style.boxShadow="none"}>
                          <div style={{ fontSize:24 }}>{icon}</div>
                          <div style={{ fontWeight:700, color:"var(--bn)", fontSize:13 }}>{title}</div>
                          <div style={{ fontSize:11, color:"var(--cm)" }}>{desc}</div>
                          <button className="bbtn bbtn-ghost bbtn-sm" style={{ marginTop:"auto" }} onClick={() => toast.success(`📄 Génération : ${title}...`)}>
                            {I.dl} Générer
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ STATISTIQUES ══ */}
          {tab === "stats" && (
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--bn)", marginBottom:20 }}>Statistiques & Analytiques — Bloc Opératoire</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
                {[
                  { color:"blue",   val:kpis.terminees + 2,   lbl:"Interventions/mois",   sub:"moyenne sur 3 mois" },
                  { color:"teal",   val:"72%",                 lbl:"Taux d'occupation",    sub:"salles opératoires" },
                  { color:"green",  val:"92%",                 lbl:"Taux de succès",       sub:"interventions terminées" },
                  { color:"orange", val:"4.2%",                lbl:"Taux de complications", sub:"sur 12 mois" },
                  { color:"purple", val:"68 min",              lbl:"Durée moyenne",         sub:"par intervention" },
                  { color:"blue",   val:"1.8M CFA",            lbl:"Recettes/mois",         sub:"honoraires + salle" },
                ].map((k,i) => (
                  <div key={i} className={`bo-kpi ${k.color} bofu`}>
                    <div className="kpi-val-bo">{k.val}</div>
                    <div className="kpi-lbl-bo">{k.lbl}</div>
                    <div className="kpi-sub-bo">{k.sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"3fr 2fr", gap:20, marginBottom:20 }}>
                <div className="bo-card">
                  <div className="bo-card-hdr"><h3>{I.trend} Interventions par mois</h3></div>
                  <div style={{ padding:20 }}><BarChart labels={chartMois} data={chartData} color="#1A5276" /></div>
                </div>
                <div className="bo-card">
                  <div className="bo-card-hdr"><h3>Répartition par spécialité</h3></div>
                  <div style={{ padding:20 }}>
                    <DoughnutChart
                      labels={["Chir. Générale","Gynécologie","Orthopédie","Urologie","ORL","Autre"]}
                      data={[40, 22, 15, 10, 8, 5]}
                      colors={["#1A5276","#17A589","#D68910","#6C3483","#117A65","#5D7892"]}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                <div className="bo-card">
                  <div className="bo-card-hdr"><h3>📊 Taux occupation des salles</h3></div>
                  <div style={{ padding:16 }}>
                    {[
                      ["Bloc 1", 82, "var(--bb)"],
                      ["Bloc 2", 75, "var(--bt)"],
                      ["Bloc 3", 60, "var(--bg)"],
                      ["Bloc 4", 40, "var(--bo)"],
                      ["Salle réveil", 55, "var(--bp)"],
                    ].map(([lbl,pct,col]) => (
                      <div key={lbl} style={{ marginBottom:12 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                          <span style={{ color:"var(--cm)" }}>{lbl}</span>
                          <strong style={{ color:"var(--bn)" }}>{pct}%</strong>
                        </div>
                        <Prog pct={pct} color={col} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bo-card">
                  <div className="bo-card-hdr"><h3>💊 Consommation de matériel</h3></div>
                  <div style={{ padding:16 }}>
                    {[
                      ["Gants stériles",   240, "var(--bb)"],
                      ["Compresses",       850, "var(--bt)"],
                      ["Fils de suture",   95,  "var(--bg)"],
                      ["Seringues",        310, "var(--bo)"],
                      ["Trocarts",         42,  "var(--bp)"],
                    ].map(([lbl,val,col]) => (
                      <div key={lbl} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #EAF4FB" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ width:8, height:8, borderRadius:2, background:col, display:"inline-block" }} />
                          <span style={{ fontSize:12, color:"var(--cm)" }}>{lbl}</span>
                        </div>
                        <strong style={{ fontSize:13, color:"var(--bn)" }}>{val} unités</strong>
                      </div>
                    ))}
                    <div style={{ marginTop:12, fontSize:12, color:"var(--cm)", display:"flex", justifyContent:"space-between" }}>
                      <span>Recettes estimées (mois)</span>
                      <strong style={{ color:"var(--bg)" }}>1 845 000 CFA</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ MODAL : NOUVELLE INTERVENTION ═══ */}
        <Modal open={modalNouv} onClose={() => setModalNouv(false)} title={<>{I.plus} Nouvelle intervention chirurgicale</>} maxWidth={720}>
          <form onSubmit={createInterv}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="blbl">Patient *</label>
                <select className="binp" required value={formInterv.patient_id} onChange={e => setFormInterv(f=>({...f,patient_id:e.target.value}))}>
                  <option value="">— Sélectionner un patient —</option>
                  {patients.map(p => <option key={p._id} value={p._id}>{p.prenom} {p.nom} — {p.numero_dossier}</option>)}
                </select>
              </div>
              <div>
                <label className="blbl">Type d'intervention *</label>
                <input className="binp" required placeholder="Ex: Appendicectomie, Myomectomie..." value={formInterv.type_intervention} onChange={e => setFormInterv(f=>({...f,type_intervention:e.target.value}))} />
              </div>
              <div>
                <label className="blbl">Spécialité</label>
                <select className="binp" value={formInterv.specialite} onChange={e => setFormInterv(f=>({...f,specialite:e.target.value}))}>
                  {Object.entries(SPECIALITE_BO).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="blbl">Diagnostic préopératoire *</label>
                <input className="binp" required placeholder="Ex: Appendicite aiguë non perforée..." value={formInterv.diagnostic_preop} onChange={e => setFormInterv(f=>({...f,diagnostic_preop:e.target.value}))} />
              </div>
              <div>
                <label className="blbl">Chirurgien principal</label>
                <input className="binp" placeholder="Dr. Nom Prénom" value={formInterv.chirurgien} onChange={e => setFormInterv(f=>({...f,chirurgien:e.target.value}))} />
              </div>
              <div>
                <label className="blbl">Anesthésiste</label>
                <input className="binp" placeholder="Dr. Nom Prénom" value={formInterv.anesthesiste} onChange={e => setFormInterv(f=>({...f,anesthesiste:e.target.value}))} />
              </div>
              <div>
                <label className="blbl">Salle attribuée</label>
                <select className="binp" value={formInterv.salle} onChange={e => setFormInterv(f=>({...f,salle:e.target.value}))}>
                  <option value="">— Non attribuée —</option>
                  {[1,2,3,4].map(n => <option key={n} value={`Bloc ${n}`}>Bloc {n}</option>)}
                  <option value="Salle urgences">Salle urgences</option>
                </select>
              </div>
              <div>
                <label className="blbl">Service demandeur</label>
                <input className="binp" placeholder="Ex: Urgences, Chirurgie générale..." value={formInterv.service_demandeur} onChange={e => setFormInterv(f=>({...f,service_demandeur:e.target.value}))} />
              </div>
              <div>
                <label className="blbl">Date et heure de l'opération</label>
                <input type="datetime-local" className="binp" value={formInterv.date_heure_op} onChange={e => setFormInterv(f=>({...f,date_heure_op:e.target.value}))} />
              </div>
              <div>
                <label className="blbl">Durée estimée (minutes)</label>
                <input type="number" className="binp" min={10} max={600} value={formInterv.duree_estimee} onChange={e => setFormInterv(f=>({...f,duree_estimee:e.target.value}))} placeholder="90" />
              </div>
              <div>
                <label className="blbl">Niveau d'urgence</label>
                <select className="binp" value={formInterv.niveau_urgence} onChange={e => setFormInterv(f=>({...f,niveau_urgence:e.target.value}))}>
                  <option value="programmee">Programmée</option>
                  <option value="urgente">Urgente</option>
                  <option value="extreme_urgence">Extrême urgence</option>
                </select>
              </div>
              <div>
                <label className="blbl">Statut initial</label>
                <select className="binp" value={formInterv.statut} onChange={e => setFormInterv(f=>({...f,statut:e.target.value}))}>
                  <option value="programmee">📅 Programmée</option>
                  <option value="preparation">🔧 En préparation</option>
                  <option value="en_cours">🔪 En cours</option>
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                  <input type="checkbox" checked={formInterv.consentement_signe} onChange={e => setFormInterv(f=>({...f,consentement_signe:e.target.checked}))} style={{ width:16, height:16, accentColor:"var(--bg)" }} />
                  <span style={{ fontSize:13, color:"var(--bn)" }}>✅ Consentement éclairé signé</span>
                </label>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button type="button" className="bbtn bbtn-ghost" onClick={() => setModalNouv(false)}>Annuler</button>
              <button type="submit" className="bbtn bbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>
                {I.save} {saving ? "Création..." : "Programmer l'intervention"}
              </button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : COMPTE RENDU ═══ */}
        <Modal open={modalCR} onClose={() => setModalCR(false)} title="📝 Compte rendu opératoire" maxWidth={680}>
          <form onSubmit={saveCR}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label className="blbl">Diagnostic préopératoire *</label>
                <textarea className="binp" rows={2} required value={formCR.diagnostic_preop} onChange={e => setFormCR(f=>({...f,diagnostic_preop:e.target.value}))} placeholder="Diagnostic établi avant l'intervention..." />
              </div>
              <div>
                <label className="blbl">Diagnostic postopératoire *</label>
                <textarea className="binp" rows={2} required value={formCR.diagnostic_postop} onChange={e => setFormCR(f=>({...f,diagnostic_postop:e.target.value}))} placeholder="Diagnostic confirmé après intervention..." />
              </div>
              <div>
                <label className="blbl">Résumé opératoire</label>
                <textarea className="binp" rows={3} value={formCR.resume} onChange={e => setFormCR(f=>({...f,resume:e.target.value}))} placeholder="Résumé court de l'intervention réalisée..." />
              </div>
              <div>
                <label className="blbl">Compte rendu détaillé *</label>
                <textarea className="binp" rows={5} required value={formCR.cr_detail} onChange={e => setFormCR(f=>({...f,cr_detail:e.target.value}))} placeholder="Description détaillée : voie d'abord, gestes effectués, findings peropératoires, fermeture..." />
              </div>
              <div>
                <label className="blbl">Matériel implanté</label>
                <input className="binp" value={formCR.materiel_implante} onChange={e => setFormCR(f=>({...f,materiel_implante:e.target.value}))} placeholder="Prothèse, filet, drain, sonde..." />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                <div>
                  <label className="blbl">Saignement (ml)</label>
                  <input type="number" className="binp" min={0} value={formCR.saignement_ml} onChange={e => setFormCR(f=>({...f,saignement_ml:e.target.value}))} placeholder="0" />
                </div>
                <div>
                  <label className="blbl">Transfusion sanguine (ml)</label>
                  <input type="number" className="binp" min={0} value={formCR.transfusion_ml} onChange={e => setFormCR(f=>({...f,transfusion_ml:e.target.value}))} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="blbl">Incidents peropératoires</label>
                <input className="binp" value={formCR.incidents} onChange={e => setFormCR(f=>({...f,incidents:e.target.value}))} placeholder="RAS ou description des incidents..." />
              </div>
              <div>
                <label className="blbl">Recommandations postopératoires</label>
                <textarea className="binp" rows={3} value={formCR.recommandations} onChange={e => setFormCR(f=>({...f,recommandations:e.target.value}))} placeholder="Surveillance, traitements, restriction activité, rendez-vous de contrôle..." />
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="bbtn bbtn-ghost" onClick={() => setModalCR(false)}>Annuler</button>
                <button type="submit" className="bbtn bbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>
                  {I.save} {saving ? "Enregistrement..." : "Valider le compte rendu"}
                </button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : RÉVEIL ═══ */}
        <Modal open={modalReveil} onClose={() => setModalReveil(false)} title="💊 Salle de réveil — Surveillance postanesthésique" maxWidth={540}>
          <form onSubmit={saveReveil}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
              <div>
                <label className="blbl">Heure d'arrivée en réveil</label>
                <input type="time" className="binp" value={formReveil.heure_arrivee} onChange={e => setFormReveil(f=>({...f,heure_arrivee:e.target.value}))} />
              </div>
              <div>
                <label className="blbl">Heure de sortie de réveil</label>
                <input type="time" className="binp" value={formReveil.heure_sortie} onChange={e => setFormReveil(f=>({...f,heure_sortie:e.target.value}))} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="blbl">État général du patient</label>
                <select className="binp" value={formReveil.etat_patient} onChange={e => setFormReveil(f=>({...f,etat_patient:e.target.value}))}>
                  <option value="stable">✅ Stable</option>
                  <option value="surveillance">⚠️ Sous surveillance</option>
                  <option value="instable">🚨 Instable</option>
                </select>
              </div>
              <div>
                <label className="blbl">Température (°C)</label>
                <input type="number" className="binp" step="0.1" min="34" max="42" placeholder="37.0" value={formReveil.temperature} onChange={e => setFormReveil(f=>({...f,temperature:e.target.value}))} />
              </div>
              <div>
                <label className="blbl">Tension artérielle</label>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <input type="number" className="binp" placeholder="120" style={{flex:1}} value={formReveil.tension_sys} onChange={e => setFormReveil(f=>({...f,tension_sys:e.target.value}))} />
                  <span style={{ fontWeight:700, color:"var(--cm)" }}>/</span>
                  <input type="number" className="binp" placeholder="80" style={{flex:1}} value={formReveil.tension_dia} onChange={e => setFormReveil(f=>({...f,tension_dia:e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="blbl">Pouls (bpm)</label>
                <input type="number" className="binp" placeholder="72" min="20" max="250" value={formReveil.pouls} onChange={e => setFormReveil(f=>({...f,pouls:e.target.value}))} />
              </div>
              <div>
                <label className="blbl">Douleur (0-10)</label>
                <input type="number" className="binp" placeholder="0" min="0" max="10" value={formReveil.douleur_score} onChange={e => setFormReveil(f=>({...f,douleur_score:e.target.value}))} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="blbl">Complications éventuelles</label>
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:8 }}>
                  {["Infection","Hémorragie","Réaction anesthésique","Nausées/vomissements","Autre"].map(c => (
                    <label key={c} style={{ display:"flex", alignItems:"center", gap:7, cursor:"pointer", fontSize:12.5 }}>
                      <input type="checkbox"
                        checked={formReveil.complications.includes(c)}
                        onChange={e => setFormReveil(f => ({ ...f, complications: e.target.checked ? [...f.complications, c] : f.complications.filter(x => x !== c) }))}
                        style={{ accentColor:"var(--br)" }} />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="blbl">Observations</label>
                <textarea className="binp" rows={2} value={formReveil.observations} onChange={e => setFormReveil(f=>({...f,observations:e.target.value}))} placeholder="État du patient, analgésie, soins..." />
              </div>
              <div style={{ gridColumn:"1/-1", display:"flex", gap:10 }}>
                <button type="button" className="bbtn bbtn-ghost" onClick={() => setModalReveil(false)}>Annuler</button>
                <button type="submit" className="bbtn bbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>
                  {I.save} {saving ? "..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </form>
        </Modal>

      </div>
    </>
  );
}