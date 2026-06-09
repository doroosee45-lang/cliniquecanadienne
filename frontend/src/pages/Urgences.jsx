import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  fetchUrgencesStats,
  fetchUrgences,
  createUrgence as createUrgenceThunk,
  updateUrgence as updateUrgenceThunk,
  fetchDossierData,
  addSoin      as addSoinThunk,
  addPrescription as addPrescriptionThunk,
  addExamen    as addExamenThunk,
  fetchAmbulances,
  assignMission as assignMissionThunk,
  retourAmbulance as retourAmbulanceThunk,
  setCurrentUrg,
  patchCurrentUrg,
  setFilters,
  setPage,
  setExamenResultat,
  selectUrgencesKpis,
  selectUrgencesChart,
  selectUrgencesList,
  selectUrgencesTotal,
  selectUrgencesPage,
  selectCurrentUrg,
  selectSoins,
  selectPrescriptions,
  selectExamens,
  selectTimeline,
  selectAmbulances,
  selectUrgencesLoading,
  selectUrgencesSaving,
  selectUrgencesFilters,
} from "../store/slices/urgencesSlice";

// ─── Chart.js loader ─────────────────────────────────────────
function loadChartJs(cb) {
  if (window.Chart) { cb(); return; }
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
  s.onload = cb;
  document.head.appendChild(s);
}

// ─── CSS (même système de design que Hospitalisation) ────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.urg * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --un:#0A1628; --un2:#0F2040; --ub:#1A5276; --ut:#17A589;
  --ut2:#148F77; --ur:#C0392B; --uo:#D68910; --ug:#1E8449;
  --up:#6C3483; --uv:#117A65; --ucr:#D6EAF8; --ucm:#5D7892;
  --ucl:#EAF4FB; --ucs:#F4F9FD;
  --ush:0 1px 3px rgba(10,22,40,.08); --ushm:0 4px 16px rgba(10,22,40,.12); --ushl:0 12px 40px rgba(10,22,40,.16);

  /* Couleurs triage */
  --triage-rouge:#C0392B;   --triage-rouge-bg:#FDEDEC;   --triage-rouge-bd:#F5B7B1;
  --triage-orange:#D68910;  --triage-orange-bg:#FEF9E7;  --triage-orange-bd:#FAD7A0;
  --triage-jaune:#B7950B;   --triage-jaune-bg:#FEFCE8;   --triage-jaune-bd:#F9E79F;
  --triage-vert:#1E8449;    --triage-vert-bg:#EAFAF1;    --triage-vert-bd:#A9DFBF;
  --triage-bleu:#1A5276;    --triage-bleu-bg:#EBF5FB;    --triage-bleu-bd:#AED6F1;
}
.urg-top { background:linear-gradient(135deg,#3D0A0A 0%,#1A0F0F 50%,#6B1A1A 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.urg-top::before { content:''; position:absolute; top:-60px; right:-60px; width:240px; height:240px; background:radial-gradient(circle,rgba(192,57,43,.25) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
.urg-top::after  { content:''; position:absolute; bottom:-30px; left:40%; width:180px; height:180px; background:radial-gradient(circle,rgba(214,137,16,.2) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
.urg-tabs { display:flex; gap:2px; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.urg-tabs::-webkit-scrollbar { display:none; }
.urg-tab { display:flex; align-items:center; gap:7px; padding:10px 18px 12px; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.5); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.urg-tab:hover { color:rgba(255,255,255,.85); background:rgba(255,255,255,.08); }
.urg-tab.active { color:var(--un); background:var(--ucs); box-shadow:0 -2px 0 var(--ur) inset; }
.urg-tab-badge { background:var(--ur); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:99px; animation:urgP 2s infinite; }
.urg-tab-badge.orange { background:var(--uo); }
@keyframes urgP { 0%,100%{opacity:1} 50%{opacity:.4} }

/* Cards */
.urg-card { background:#fff; border:1.5px solid var(--ucr); border-radius:18px; box-shadow:var(--ush); overflow:hidden; transition:box-shadow .2s; }
.urg-card:hover { box-shadow:var(--ushm); }
.urg-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--ucr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(234,244,251,.7),transparent); }
.urg-card-hdr h3 { font-size:14px; font-weight:700; color:var(--un); margin:0; display:flex; align-items:center; gap:8px; }
.urg-card-hdr p  { font-size:11px; color:var(--ucm); margin:2px 0 0; }

/* KPI */
.urg-kpi { background:#fff; border:1.5px solid var(--ucr); border-radius:18px; padding:18px 20px; box-shadow:var(--ush); position:relative; overflow:hidden; transition:all .25s; cursor:pointer; }
.urg-kpi:hover { transform:translateY(-2px); box-shadow:var(--ushm); }
.urg-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.urg-kpi.red::before    { background:var(--ur); }
.urg-kpi.orange::before { background:var(--uo); }
.urg-kpi.yellow::before { background:var(--triage-jaune); }
.urg-kpi.green::before  { background:var(--ug); }
.urg-kpi.blue::before   { background:var(--ub); }
.urg-kpi.teal::before   { background:var(--ut); }
.kpi-icon-urg { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
.kpi-icon-urg.red    { background:#FDEDEC; color:var(--ur); }
.kpi-icon-urg.orange { background:#FEF9E7; color:var(--uo); }
.kpi-icon-urg.yellow { background:#FEFCE8; color:var(--triage-jaune); }
.kpi-icon-urg.green  { background:#EAFAF1; color:var(--ug); }
.kpi-icon-urg.blue   { background:#EBF5FB; color:var(--ub); }
.kpi-icon-urg.teal   { background:#E8F8F5; color:var(--ut); }
.kpi-val-urg { font-size:26px; font-weight:800; color:var(--un); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.kpi-lbl-urg { font-size:11.5px; font-weight:600; color:var(--ucm); }
.kpi-sub-urg { font-size:10.5px; color:#9CA3AF; margin-top:2px; }
.kpi-dot-urg { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--ur); animation:urgP 2s infinite; }

/* Badges */
.ubdg { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.ubdg.red    { background:#FDEDEC; color:var(--ur);   border:1px solid #F5B7B1; }
.ubdg.orange { background:#FEF9E7; color:var(--uo);   border:1px solid #FAD7A0; }
.ubdg.yellow { background:#FEFCE8; color:#B7950B;     border:1px solid #F9E79F; }
.ubdg.green  { background:#EAFAF1; color:var(--ug);   border:1px solid #A9DFBF; }
.ubdg.blue   { background:#EBF5FB; color:var(--ub);   border:1px solid #AED6F1; }
.ubdg.teal   { background:#E8F8F5; color:var(--ut);   border:1px solid #A2D9CE; }
.ubdg.purple { background:#F4ECF7; color:var(--up);   border:1px solid #C39BD3; }
.ubdg.gray   { background:#F8F9FA; color:#4B5563;     border:1px solid #DEE2E6; }
.ubdg.dark   { background:var(--un); color:#fff;      border:1px solid var(--un2); }

/* Triage pill (large) */
.triage-pill { display:inline-flex; align-items:center; gap:6px; padding:5px 14px; border-radius:99px; font-size:12px; font-weight:700; border:2px solid; }
.triage-pill.rouge  { background:var(--triage-rouge-bg);  color:var(--triage-rouge);  border-color:var(--triage-rouge-bd); }
.triage-pill.orange { background:var(--triage-orange-bg); color:var(--triage-orange); border-color:var(--triage-orange-bd); }
.triage-pill.jaune  { background:var(--triage-jaune-bg);  color:var(--triage-jaune);  border-color:var(--triage-jaune-bd); }
.triage-pill.vert   { background:var(--triage-vert-bg);   color:var(--triage-vert);   border-color:var(--triage-vert-bd); }
.triage-pill.bleu   { background:var(--triage-bleu-bg);   color:var(--triage-bleu);   border-color:var(--triage-bleu-bd); }
.triage-pill.rouge.pulse  { animation:urgP .8s infinite; }
.triage-pill.orange.pulse { animation:urgP 1.2s infinite; }

/* Barre latérale de priorité */
.urgence-row { border-left:4px solid; border-radius:0 14px 14px 0; padding:12px 16px; margin-bottom:10px; transition:all .2s; cursor:pointer; background:#fff; border-top:1px solid var(--ucr); border-right:1px solid var(--ucr); border-bottom:1px solid var(--ucr); }
.urgence-row:hover { box-shadow:var(--ushm); transform:translateX(2px); }
.urgence-row.rouge  { border-left-color:var(--triage-rouge); }
.urgence-row.orange { border-left-color:var(--triage-orange); }
.urgence-row.jaune  { border-left-color:var(--triage-jaune); }
.urgence-row.vert   { border-left-color:var(--triage-vert); }
.urgence-row.bleu   { border-left-color:var(--triage-bleu); }

/* Progress */
.urg-prog { background:#EAF4FB; border-radius:99px; height:7px; overflow:hidden; }
.urg-prog-f { height:100%; border-radius:99px; transition:width .5s; }

/* Buttons */
.ubtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; }
.ubtn-primary { background:var(--ub); color:#fff; } .ubtn-primary:hover { background:#154360; transform:translateY(-1px); }
.ubtn-danger  { background:var(--ur); color:#fff; } .ubtn-danger:hover  { background:#922B21; transform:translateY(-1px); }
.ubtn-teal    { background:var(--ut); color:#fff; } .ubtn-teal:hover    { background:var(--ut2); transform:translateY(-1px); }
.ubtn-orange  { background:var(--uo); color:#fff; } .ubtn-orange:hover  { background:#B7770D; transform:translateY(-1px); }
.ubtn-ghost   { background:transparent; color:var(--ucm); border:1.5px solid var(--ucr); }
.ubtn-ghost:hover { background:var(--ucl); color:var(--un); }
.ubtn-success { background:#EAFAF1; color:var(--ug); border:1.5px solid #A9DFBF; }
.ubtn-success:hover { background:var(--ug); color:#fff; }
.ubtn-sm { padding:6px 12px; font-size:12px; }
.ubtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }

/* Form */
.ulbl { font-size:12px; font-weight:600; color:var(--ucm); margin-bottom:6px; display:block; }
.uinp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--ucr); background:#FAFCFF; font-size:13px; color:var(--un); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.uinp:focus { border-color:var(--ur); box-shadow:0 0 0 3px rgba(192,57,43,.12); }

/* Section nav */
.sec-nav-urg { display:flex; gap:6px; flex-wrap:wrap; padding:14px 20px; background:linear-gradient(to right,#F4F9FD,#EAF4FB); border-bottom:1.5px solid var(--ucr); border-radius:18px 18px 0 0; }
.sec-btn-urg { display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all .2s; color:var(--ucm); background:none; font-family:'Poppins',sans-serif; }
.sec-btn-urg:hover { background:white; color:var(--un); border-color:var(--ucr); }
.sec-btn-urg.active { background:var(--un); color:white; border-color:var(--un); }

/* Alerts */
.al-danger  { background:linear-gradient(135deg,#FDEDEC,#FADBD8); border:1.5px solid #F5B7B1; border-left:4px solid var(--ur);  border-radius:14px; padding:14px 18px; }
.al-warn    { background:linear-gradient(135deg,#FEFCE8,#FEF3C7); border:1.5px solid #FAD7A0; border-left:4px solid var(--uo);  border-radius:14px; padding:14px 18px; }
.al-success { background:linear-gradient(135deg,#EAFAF1,#D5F5E3); border:1.5px solid #A9DFBF; border-left:4px solid var(--ug);  border-radius:14px; padding:14px 18px; }
.al-info    { background:linear-gradient(135deg,#EBF5FB,#D6EAF8); border:1.5px solid #AED6F1; border-left:4px solid var(--ub);  border-radius:14px; padding:14px 18px; }

/* Table */
.urg-tbl { width:100%; border-collapse:collapse; }
.urg-tbl thead tr { background:linear-gradient(to right,#F4F9FD,#EAF4FB); }
.urg-tbl th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--ucm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--ucr); white-space:nowrap; }
.urg-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #EAF4FB; vertical-align:middle; }
.urg-tbl tbody tr:last-child td { border-bottom:none; }
.urg-tbl tbody tr:hover { background:#F4F9FD; }

/* Modal */
.uov { position:fixed; inset:0; z-index:500; background:rgba(10,22,40,.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.uov-box { background:#fff; border-radius:20px; box-shadow:var(--ushl); width:100%; max-width:760px; max-height:92vh; overflow-y:auto; animation:urgSlide .25s ease; }
@keyframes urgSlide { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.uov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--ucr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(135deg,#FDEDEC,#FAF0EF); position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.uov-hdr h3 { font-size:16px; font-weight:700; color:var(--un); margin:0; display:flex; align-items:center; gap:10px; }
.uov-cls { width:32px; height:32px; border-radius:8px; background:#F4F9FD; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--ucm); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.uov-cls:hover { background:#FDEDEC; color:var(--ur); }
.uov-body { padding:24px; }

/* Vital card */
.vital-urg { background:#F4F9FD; border:1.5px solid var(--ucr); border-radius:12px; padding:12px 16px; text-align:center; }
.vital-urg.warn    { background:#FEF9E7; border-color:#FAD7A0; }
.vital-urg.danger  { background:#FDEDEC; border-color:#F5B7B1; }
.vital-urg.ok      { background:#EAFAF1; border-color:#A9DFBF; }
.vital-v-urg { font-size:20px; font-weight:800; color:var(--un); }
.vital-l-urg { font-size:10px; color:var(--ucm); font-weight:600; text-transform:uppercase; margin-top:2px; }

/* Ambulance card */
.amb-card { background:#fff; border:1.5px solid var(--ucr); border-radius:14px; padding:16px; position:relative; overflow:hidden; transition:all .2s; }
.amb-card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; }
.amb-card.en-route::before  { background:var(--uo); }
.amb-card.disponible::before{ background:var(--ug); }
.amb-card.occupe::before    { background:var(--ur); }
.amb-card:hover { box-shadow:var(--ushm); }

/* Timeline */
.urg-tl { position:relative; padding-left:28px; }
.urg-tl::before { content:''; position:absolute; left:10px; top:8px; bottom:8px; width:2px; background:var(--ucr); border-radius:2px; }
.urg-tl-item { position:relative; margin-bottom:14px; }
.urg-tl-dot { position:absolute; left:-23px; top:4px; width:14px; height:14px; border-radius:50%; border:2.5px solid white; box-shadow:0 0 0 2px var(--ucr); z-index:1; }
.urg-tl-dot.done   { background:var(--ug); box-shadow:0 0 0 2px #A9DFBF; }
.urg-tl-dot.active { background:var(--ur); box-shadow:0 0 0 2px #F5B7B1; animation:urgP 1s infinite; }
.urg-tl-dot.pending{ background:#E5E7EB; }

/* Grids */
.urg-g2   { display:grid; grid-template-columns:2fr 1fr; gap:20px; }
.urg-g32  { display:grid; grid-template-columns:3fr 2fr; gap:20px; }
.urg-g11  { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.urg-g11s { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.urg-g4   { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
.urg-g5   { display:grid; grid-template-columns:repeat(5,1fr); gap:14px; }
.urg-g3   { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }

/* Animation */
@keyframes urgFadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
.urgfu { animation:urgFadeUp .35s ease both; }

/* Chrono badge clignotant */
.chrono-alert { animation:urgP .6s infinite; font-weight:800; }

/* Status strip */
.status-strip-urg { display:flex; align-items:center; gap:0; border-radius:12px; overflow:hidden; border:1.5px solid var(--ucr); }
.status-step-urg { flex:1; padding:10px 8px; text-align:center; font-size:11px; font-weight:600; color:var(--ucm); background:#F4F9FD; transition:all .2s; position:relative; }
.status-step-urg.done   { background:var(--ug); color:#fff; }
.status-step-urg.active { background:var(--ur); color:#fff; animation:urgP 3s infinite; }
.status-step-urg:not(:last-child)::after { content:'›'; position:absolute; right:-2px; top:50%; transform:translateY(-50%); font-size:16px; color:var(--ucr); z-index:1; }

@media print { .urg-top,.urg-tabs,.sec-nav-urg,.ubtn { display:none!important; } }

@media (max-width:767px) {
  .urg-top { padding:12px 14px 0; }
  .urg-g2,.urg-g32,.urg-g11 { grid-template-columns:1fr; gap:14px; }
  .urg-g4,.urg-g5,.urg-g3   { grid-template-columns:1fr 1fr; gap:10px; }
  .urg-g11s { grid-template-columns:1fr 1fr; gap:8px; }
  .uinp { font-size:16px!important; }
  .ubtn    { font-size:12px; padding:8px 12px; }
  .ubtn-sm { font-size:11px; padding:5px 8px; }
  .urg-card     { border-radius:14px; }
  .urg-card-hdr { padding:11px 14px; }
  .kpi-val-urg  { font-size:20px; }
  .kpi-icon-urg { width:34px; height:34px; margin-bottom:8px; }
  .sec-nav-urg  { overflow-x:auto; flex-wrap:nowrap; padding:10px 14px; scrollbar-width:none; }
  .sec-nav-urg::-webkit-scrollbar { display:none; }
  .uov     { padding:0; align-items:flex-end; }
  .uov-box { border-radius:20px 20px 0 0; max-width:100%; max-height:93vh; }
  .uov-hdr { padding:13px 16px; }
  .uov-body{ padding:14px; }
}
@media (max-width:479px) {
  .urg-g4,.urg-g5,.urg-g3 { grid-template-columns:1fr; }
  .urg-g11s { grid-template-columns:1fr; gap:8px; }
  .kpi-val-urg { font-size:18px; }
  .urg-card-hdr { flex-wrap:wrap; gap:8px; }
}
`;

// ─── Helpers ────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
const fmtDateInput = (d) => d ? new Date(d).toISOString().substring(0, 10) : "";
const fmtDateTimeInput = (d) => d ? new Date(d).toISOString().substring(0, 16) : "";
const ageCalc = (dob) => {
  if (!dob) return "—";
  return `${Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 3600 * 1000))} ans`;
};
const minutesEcoules = (d) => {
  if (!d) return 0;
  return Math.floor((Date.now() - new Date(d)) / 60000);
};
const formatDuree = (min) => {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${min % 60 > 0 ? String(min % 60).padStart(2, "0") : ""}`;
};

// ─── Constantes ─────────────────────────────────────────────
const TRIAGE_NIVEAUX = {
  rouge:  { cls:"rouge",  label:"Critique",       icon:"🔴", color:"var(--triage-rouge)",  desc:"Urgence vitale immédiate" },
  orange: { cls:"orange", label:"Très urgent",     icon:"🟠", color:"var(--triage-orange)", desc:"Prise en charge < 20 min" },
  jaune:  { cls:"jaune",  label:"Urgent",          icon:"🟡", color:"var(--triage-jaune)",  desc:"Prise en charge < 60 min" },
  vert:   { cls:"vert",   label:"Peu urgent",      icon:"🟢", color:"var(--triage-vert)",   desc:"Prise en charge < 2h" },
  bleu:   { cls:"bleu",   label:"Non urgent",      icon:"🔵", color:"var(--triage-bleu)",   desc:"Prise en charge < 4h" },
};
const STATUT_URG = {
  attente:       { cls:"orange", label:"En attente",       icon:"⏳" },
  triage:        { cls:"yellow", label:"En triage",        icon:"🔍" },
  consultation:  { cls:"blue",   label:"En consultation",  icon:"🩺" },
  observation:   { cls:"teal",   label:"En observation",   icon:"👁" },
  soins:         { cls:"purple", label:"En soins",         icon:"💉" },
  hospitalise:   { cls:"green",  label:"Hospitalisé",      icon:"🛏" },
  sorti:         { cls:"gray",   label:"Sorti",            icon:"✅" },
  transfere:     { cls:"purple", label:"Transféré",        icon:"🚑" },
  decede:        { cls:"red",    label:"Décédé",           icon:"💔" },
};
const MOTIFS_URG = [
  "Accident / Traumatisme","Douleur abdominale","Difficulté respiratoire",
  "Fièvre élevée","Hypertension","Convulsions","Grossesse / Accouchement",
  "Douleur thoracique","AVC / Perte de connaissance","Intoxication",
  "Fracture","Plaie / Coupure","Brûlure","Autre",
];
const AMB_STATUT = {
  disponible: { cls:"green",  label:"Disponible" },
  en_route:   { cls:"orange", label:"En route"  },
  occupe:     { cls:"red",    label:"Occupé"    },
  maintenance:{ cls:"gray",   label:"Maintenance" },
};
const EMPTY_URG = {
  patient_id:"", patient_nom:"", patient_dob:"", patient_sexe:"", patient_tel:"",
  motif:"", niveau_triage:"orange", statut:"attente",
  temperature:"", tension_sys:"", tension_dia:"", pouls:"", spo2:"", glycemie:"",
  medecin:"", infirmier:"", service:"",
  antecedents:"", allergies:"", traitements_cours:"",
  observations:"", diagnostic_provisoire:"",
  contact_urgence:"", tel_urgence:"",
  date_arrivee:"",
};
const EMPTY_SOIN = { acte:"", personnel:"", heure:"", note:"" };
const EMPTY_PRESCRIPTION_U = { type:"medicament", designation:"", posologie:"", medecin:"" };
const EMPTY_EXAMEN_U = { type:"labo", designation:"", statut:"attente", resultat:"", urgent:false };
const EMPTY_CLOTURE = { decision:"retour_domicile", diagnostic_final:"", recommandations:"", date_sortie:"", heure_sortie:"" };

const normalizeUrgence = (u) => ({
  ...u,
  patient_nom: u.patient
    ? `${u.patient.prenom || ""} ${u.patient.nom || ""}`.trim()
    : u.patient_nom || "—",
  patient_dob: u.patient?.date_naissance || u.patient_dob || "",
  medecin_label: u.medecin_responsable
    ? `${u.medecin_responsable.prenom || ""} ${u.medecin_responsable.nom || ""}`.trim()
    : u.medecin_nom || u.medecin || "—",
  numero: u.numero || ("URG-" + String(u._id || "").slice(-6).toUpperCase()),
  date_arrivee: u.date_arrivee || u.createdAt || "",
});

// ─── SVG Icons ───────────────────────────────────────────────
const I = {
  ambulance: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/><line x1="9" y1="9" x2="9" y2="13"/><line x1="7" y1="11" x2="11" y2="11"/></svg>,
  plus:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  save:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  file:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  clock:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  pulse:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  alert:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  users:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  list:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  grid:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  trend:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  print:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  exit:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  open:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  flask:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 2v6l-4 8a2 2 0 001.8 2.9h12.4A2 2 0 0018 16.9L14 8V2"/><line x1="6" y1="2" x2="18" y2="2"/></svg>,
  map:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
  dl:       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  money:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  pill:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.5 20.5L3.5 13.5a5 5 0 117.07-7.07L17.5 13.5a5 5 0 11-7.07 7.07z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/></svg>,
};

// ─── Charts ──────────────────────────────────────────────────
function BarChart({ labels, data, color = "#C0392B", height = 180 }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new window.Chart(ref.current, {
        type: "bar",
        data: { labels, datasets: [{ label: "Admissions urgences", data, backgroundColor: `${color}28`, borderColor: color, borderWidth: 2, borderRadius: 8, borderSkipped: false }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false }, tooltip: { backgroundColor: "#0A1628", padding: 10, cornerRadius: 10 } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#9CA3AF" }, border: { display: false } }, y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.04)" }, ticks: { font: { size: 10 }, color: "#9CA3AF", precision: 0 }, border: { display: false } } } },
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [labels, data, color]);
  return <canvas ref={ref} style={{ maxHeight: height }} />;
}

function DoughnutChart({ labels, data, colors, height = 180 }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new window.Chart(ref.current, {
        type: "doughnut",
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
        options: { responsive: true, maintainAspectRatio: true, cutout: "70%", plugins: { legend: { position: "right", labels: { font: { size: 11 }, padding: 14, boxWidth: 12 } }, tooltip: { backgroundColor: "#0A1628", padding: 10 } } },
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [labels, data, colors]);
  return <canvas ref={ref} style={{ maxHeight: height }} />;
}

// ─── Modal ───────────────────────────────────────────────────
function Modal({ open, onClose, title, children, maxWidth = 760 }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="uov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="uov-box" style={{ maxWidth }}>
        <div className="uov-hdr">
          <h3>{title}</h3>
          <button className="uov-cls" onClick={onClose}>×</button>
        </div>
        <div className="uov-body">{children}</div>
      </div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────
function KpiCard({ color, icon, value, label, sub, urgent, onClick }) {
  return (
    <div className={`urg-kpi ${color} urgfu`} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      {urgent && <div className="kpi-dot-urg" />}
      <div className={`kpi-icon-urg ${color}`}>{icon}</div>
      <div className="kpi-val-urg">{value}</div>
      <div className="kpi-lbl-urg">{label}</div>
      {sub && <div className="kpi-sub-urg">{sub}</div>}
    </div>
  );
}

function Prog({ pct, color }) {
  return <div className="urg-prog"><div className="urg-prog-f" style={{ width: `${pct}%`, background: color }} /></div>;
}
function Badge({ cls, children }) {
  return <span className={`ubdg ${cls}`}>{children}</span>;
}
function TriagePill({ niveau, pulse }) {
  const t = TRIAGE_NIVEAUX[niveau] || TRIAGE_NIVEAUX.bleu;
  return <span className={`triage-pill ${t.cls} ${pulse ? "pulse" : ""}`}>{t.icon} {t.label}</span>;
}

// ══════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function Urgences() {
  const dispatch = useDispatch();

  // ── Redux state ────────────────────────────────────────────
  const kpis          = useSelector(selectUrgencesKpis);
  const urgences      = useSelector(selectUrgencesList);
  const total         = useSelector(selectUrgencesTotal);
  const currentPage   = useSelector(selectUrgencesPage);
  const currentUrg    = useSelector(selectCurrentUrg);
  const soins         = useSelector(selectSoins);
  const prescriptions = useSelector(selectPrescriptions);
  const examens       = useSelector(selectExamens);
  const timeline      = useSelector(selectTimeline);
  const ambulances    = useSelector(selectAmbulances);
  const loading       = useSelector(selectUrgencesLoading);
  const saving        = useSelector(selectUrgencesSaving);
  const filters       = useSelector(selectUrgencesFilters);

  // ── UI locale ─────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 599);
  const [tab, setTab]         = useState("dashboard");
  const [section, setSection] = useState("triage");
  const [search, setSearch]   = useState("");
  const [filterNiveau, setFilterNiveau] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [patients, setPatients]         = useState([]);

  // Modals
  const [modalNouveauPatient, setModalNouveauPatient] = useState(false);
  const [modalSoin, setModalSoin]                     = useState(false);
  const [modalPrescription, setModalPrescription]     = useState(false);
  const [modalExamen, setModalExamen]                 = useState(false);
  const [modalCloture, setModalCloture]               = useState(false);
  const [modalAmbulance, setModalAmbulance]           = useState(false);

  // Forms
  const [formUrg, setFormUrg]           = useState(EMPTY_URG);
  const [formSoin, setFormSoin]         = useState(EMPTY_SOIN);
  const [formPrescription, setFormPrescription_] = useState(EMPTY_PRESCRIPTION_U);
  const [formExamen, setFormExamen_]    = useState(EMPTY_EXAMEN_U);
  const [formCloture, setFormCloture]   = useState(EMPTY_CLOTURE);
  const [formAmb, setFormAmb]           = useState({ numero:"", conducteur:"", destination:"", motif_mission:"" });

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 599);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // Timer pour forcer le re-rendu des chronos
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // Chargement patients (pour la liste déroulante)
  useEffect(() => {
    import("../api").then(m => m.default.get("/patients?limit=500")).then(r => setPatients(r.data.patients || [])).catch(() => {});
  }, []);

  // Chargement initial
  useEffect(() => {
    dispatch(fetchUrgencesStats());
    dispatch(fetchUrgences({ page: 1, limit: 20 }));
    dispatch(fetchAmbulances());
  }, [dispatch]);

  // Rafraîchissement auto toutes les 30 s
  useEffect(() => {
    const id = setInterval(() => {
      dispatch(fetchUrgences({ page: currentPage, limit: 20, q: search, niveau_triage: filterNiveau, statut: filterStatut }));
    }, 30000);
    return () => clearInterval(id);
  }, [dispatch, currentPage, search, filterNiveau, filterStatut]);

  const reloadList = () => {
    dispatch(fetchUrgences({ page: currentPage, limit: 20, q: search, niveau_triage: filterNiveau, statut: filterStatut }));
    dispatch(fetchUrgencesStats());
  };

  const openDossier = (u) => {
    dispatch(setCurrentUrg(normalizeUrgence(u)));
    setSection("triage");
    setTab("dossier");
    dispatch(fetchDossierData(u._id));
  };

  // ─── CRÉER UNE URGENCE ──────────────────────────────────
  const createUrgence = async (e) => {
    e.preventDefault();
    const toastId = toast.loading("⏳ Enregistrement de l'admission urgence...");
    const payload = { ...formUrg, date_arrivee: formUrg.date_arrivee || new Date().toISOString() };
    const result = await dispatch(createUrgenceThunk(payload));
    if (createUrgenceThunk.fulfilled.match(result)) {
      const newUrg = result.payload;
      setModalNouveauPatient(false);
      setFormUrg(EMPTY_URG);
      toast.success(`✅ Patient ${newUrg.numero} admis aux urgences`, { id: toastId, duration: 5000 });
      setTimeout(() => reloadList(), 500);
    } else {
      toast.error(`❌ ${result.payload || "Erreur serveur"}`, { id: toastId, duration: 6000 });
    }
  };

  // ─── MAJ DOSSIER ────────────────────────────────────────
  const updateUrgence = async (updates) => {
    if (!currentUrg) return;
    const toastId = toast.loading("💾 Enregistrement...");
    const result = await dispatch(updateUrgenceThunk({ id: currentUrg._id, body: { ...currentUrg, ...updates } }));
    if (updateUrgenceThunk.fulfilled.match(result)) {
      toast.success("✅ Dossier mis à jour", { id: toastId });
      setTimeout(() => reloadList(), 300);
    } else {
      toast.error(`❌ ${result.payload || "Erreur serveur"}`, { id: toastId });
    }
  };

  // ─── AJOUTER SOIN ───────────────────────────────────────
  const handleAddSoin = async (e) => {
    e.preventDefault();
    const toastId = toast.loading("💾 Enregistrement du soin...");
    const result = await dispatch(addSoinThunk({ id: currentUrg._id, body: { ...formSoin, heure: formSoin.heure || new Date().toTimeString().substring(0, 5) } }));
    if (addSoinThunk.fulfilled.match(result)) {
      toast.success("✅ Soin enregistré", { id: toastId });
      setModalSoin(false);
      setFormSoin(EMPTY_SOIN);
    } else { toast.error("❌ Échec de l'enregistrement", { id: toastId }); }
  };

  // ─── AJOUTER PRESCRIPTION ───────────────────────────────
  const handleAddPrescription = async (e) => {
    e.preventDefault();
    const toastId = toast.loading("💾 Ajout de la prescription...");
    const result = await dispatch(addPrescriptionThunk({ id: currentUrg._id, body: formPrescription }));
    if (addPrescriptionThunk.fulfilled.match(result)) {
      toast.success("✅ Prescription ajoutée", { id: toastId });
      setModalPrescription(false);
      setFormPrescription_(EMPTY_PRESCRIPTION_U);
    } else { toast.error("❌ Échec", { id: toastId }); }
  };

  // ─── AJOUTER EXAMEN ─────────────────────────────────────
  const handleAddExamen = async (e) => {
    e.preventDefault();
    const toastId = toast.loading("💾 Demande d'examen...");
    const result = await dispatch(addExamenThunk({ id: currentUrg._id, body: formExamen }));
    if (addExamenThunk.fulfilled.match(result)) {
      toast.success("✅ Examen demandé", { id: toastId });
      setModalExamen(false);
      setFormExamen_(EMPTY_EXAMEN_U);
    } else { toast.error("❌ Échec", { id: toastId }); }
  };

  // ─── CLÔTURER DOSSIER ───────────────────────────────────
  const cloturerDossier = async (e) => {
    e.preventDefault();
    const statutFinal =
      formCloture.decision === "retour_domicile" ? "sorti"
      : formCloture.decision === "hospitalisation" ? "hospitalise"
      : formCloture.decision === "transfert"      ? "transfere"
      : formCloture.decision === "deces"          ? "decede"
      : "sorti";
    await updateUrgence({ statut: statutFinal, ...formCloture, date_sortie: formCloture.date_sortie || new Date().toISOString().substring(0, 10) });
    setModalCloture(false);
  };

  // ─── Compteurs locaux ────────────────────────────────────
  const critiques = urgences.filter(u => u.niveau_triage === "rouge" && u.statut !== "sorti" && u.statut !== "decede");
  const enAttente = urgences.filter(u => u.statut === "attente" || u.statut === "triage");
  const today     = new Date().toLocaleDateString("fr-FR");

  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      <div className="urg">

        {/* ── TOPBAR ── */}
        <div className="urg-top">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", position: "relative", zIndex: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 54, height: 54, borderRadius: 14, background: "rgba(192,57,43,.25)", border: "1.5px solid rgba(192,57,43,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {I.ambulance}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 21, fontWeight: 700, color: "#fff", letterSpacing: -0.3 }}>Urgences</div>
                  {critiques.length > 0 && (
                    <span style={{ background: "var(--ur)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, animation: "urgP .8s infinite" }}>
                      🔴 {critiques.length} CRITIQUE{critiques.length > 1 ? "S" : ""}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginTop: 2 }}>
                  {kpis?.admissions_jour ?? "—"} admissions aujourd'hui · {today}
                  {enAttente.length > 0 && <> · <span style={{ color: "#FAD7A0", fontWeight: 600 }}>{enAttente.length} en attente</span></>}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="ubtn ubtn-danger" onClick={() => { setFormUrg(EMPTY_URG); setModalNouveauPatient(true); }}>
                {I.plus} Nouveau patient
              </button>
              {currentUrg && currentUrg.statut !== "sorti" && currentUrg.statut !== "decede" && (
                <button className="ubtn ubtn-ghost" style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }} onClick={() => { setFormCloture(EMPTY_CLOTURE); setModalCloture(true); }}>
                  {I.exit} Clôturer dossier
                </button>
              )}
              <button className="ubtn ubtn-ghost" style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }} onClick={() => window.print()}>
                {I.print} Imprimer
              </button>
            </div>
          </div>

          {/* Tabs */}
          {(() => {
            const TABS = [
              { key: "dashboard", icon: I.grid,      label: "Tableau de bord",   labelM: "Dashboard" },
              { key: "liste",     icon: I.list,      label: "File d'attente",    labelM: "File attente" },
              { key: "ambulances",icon: I.ambulance, label: "Ambulances",        labelM: "Ambulances" },
              { key: "dossier",   icon: I.file,      label: currentUrg ? `Dossier ${currentUrg.numero}` : "Dossier patient", labelM: "Dossier", disabled: !currentUrg },
              { key: "stats",     icon: I.trend,     label: "Statistiques",      labelM: "Stats" },
            ].filter(t => !t.disabled);
            const cols = isMobile ? Math.min(3, TABS.length) : undefined;
            return (
              <div style={isMobile ? { display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: "4px", padding: "8px 10px", marginTop: "8px", background: "rgba(255,255,255,.07)", borderRadius: "10px 10px 0 0" } : { display: "flex", gap: "2px", marginTop: "16px", overflowX: "auto", scrollbarWidth: "none" }}>
                {TABS.map(t => (
                  <button key={t.key} className={`urg-tab ${tab === t.key ? "active" : ""}`}
                    style={isMobile ? { flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "7px 3px 8px", fontSize: "9.5px", gap: "3px", borderRadius: "8px", whiteSpace: "normal", minWidth: 0 } : {}}
                    onClick={() => setTab(t.key)}>
                    <span style={isMobile ? { fontSize: "14px" } : {}}>{t.icon}</span>
                    <span style={isMobile ? { lineHeight: 1.2 } : {}}>{isMobile ? t.labelM : t.label}</span>
                    {t.key === "liste" && enAttente.length > 0 && <span className="urg-tab-badge">{enAttente.length}</span>}
                    {t.key === "liste" && critiques.length > 0 && <span className="urg-tab-badge">{critiques.length}</span>}
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
              {critiques.length > 0 && (
                <div className="al-danger urgfu" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
                  <div style={{ width: 42, height: 42, background: "var(--triage-rouge-bg)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, animation: "urgP .8s infinite" }}>{I.alert}</div>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: "var(--ur)", fontSize: 13 }}>🔴 {critiques.length} patient(s) en état critique</strong>
                    <div style={{ fontSize: 12, color: "var(--ur)", marginTop: 3 }}>
                      {critiques.slice(0, 2).map(c => c.patient_nom).join(" · ")} {critiques.length > 2 ? `+ ${critiques.length - 2} autres` : ""}
                    </div>
                  </div>
                  <button className="ubtn ubtn-danger ubtn-sm" onClick={() => { setFilterNiveau("rouge"); setTab("liste"); }}>Voir →</button>
                </div>
              )}

              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 24 }}>
                <KpiCard color="red"    icon={I.alert}  value={kpis?.critique ?? "—"}        label="Cas critiques"        sub="priorité rouge"         urgent={(kpis?.critique||0) > 0} onClick={() => { setFilterNiveau("rouge"); setTab("liste"); }} />
                <KpiCard color="orange" icon={I.clock}  value={kpis?.attente ?? "—"}         label="En attente"           sub="triage non effectué"    urgent={(kpis?.attente||0) > 0} onClick={() => { setFilterStatut("attente"); setTab("liste"); }} />
                <KpiCard color="blue"   icon={I.pulse}  value={kpis?.consultation ?? "—"}    label="En consultation"      sub="médecin assigné"        onClick={() => { setFilterStatut("consultation"); setTab("liste"); }} />
                <KpiCard color="teal"   icon={I.users}  value={kpis?.observation ?? "—"}     label="En observation"       sub="surveillance active"    onClick={() => { setFilterStatut("observation"); setTab("liste"); }} />
                <KpiCard color="green"  icon={I.exit}   value={kpis?.sorties_jour ?? "—"}    label="Sortis aujourd'hui"   sub="clôturés"               onClick={() => { setFilterStatut("sorti"); setTab("liste"); }} />
                <KpiCard color="blue"   icon={I.ambulance} value={kpis?.admissions_jour ?? "—"} label="Admissions/jour"  sub="toutes priorités"       onClick={() => setTab("liste")} />
              </div>

              {/* File d'attente prioritaire */}
              <div className="urg-g2" style={{ marginBottom: 24 }}>
                <div className="urg-card urgfu">
                  <div className="urg-card-hdr">
                    <div><h3>🚨 File d'attente — temps réel</h3><p>Triée par niveau de priorité</p></div>
                    <button className="ubtn ubtn-ghost ubtn-sm" onClick={() => setTab("liste")}>Voir tous →</button>
                  </div>
                  <div style={{ padding: "12px 16px" }}>
                    {loading ? (
                      <div style={{ padding: 30, textAlign: "center", color: "var(--ucm)" }}>⏳ Chargement...</div>
                    ) : urgences.filter(u => u.statut !== "sorti" && u.statut !== "decede").length === 0 ? (
                      <div style={{ padding: 30, textAlign: "center", color: "var(--ucm)" }}>
                        <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
                        <div style={{ fontWeight: 600 }}>Aucun patient en attente</div>
                      </div>
                    ) : (
                      ["rouge", "orange", "jaune", "vert", "bleu"].map(niv => {
                        const patients_niv = urgences.filter(u => u.niveau_triage === niv && u.statut !== "sorti" && u.statut !== "decede");
                        return patients_niv.map(u => {
                          const mins = minutesEcoules(u.date_arrivee);
                          const enRetard = (niv === "rouge" && mins > 0) || (niv === "orange" && mins > 20) || (niv === "jaune" && mins > 60);
                          return (
                            <div key={u._id} className={`urgence-row ${niv}`} onClick={() => openDossier(u)}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                                  <TriagePill niveau={niv} pulse={niv === "rouge"} />
                                  <div>
                                    <div style={{ fontWeight: 700, color: "var(--un)", fontSize: 13 }}>{u.patient_nom}</div>
                                    <div style={{ fontSize: 11, color: "var(--ucm)" }}>{u.motif || "—"} · {ageCalc(u.patient_dob)}</div>
                                  </div>
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: enRetard ? "var(--ur)" : "var(--ucm)" }} className={enRetard ? "chrono-alert" : ""}>
                                    ⏱ {formatDuree(mins)}
                                  </div>
                                  <Badge cls={(STATUT_URG[u.statut] || {}).cls || "gray"}>
                                    {(STATUT_URG[u.statut] || {}).icon} {(STATUT_URG[u.statut] || {}).label}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })
                    )}
                  </div>
                </div>

                {/* Panel de droite */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Répartition triage */}
                  <div className="urg-card urgfu">
                    <div className="urg-card-hdr"><h3>Répartition triage</h3></div>
                    <div style={{ padding: 16 }}>
                      {Object.entries(TRIAGE_NIVEAUX).map(([key, t]) => {
                        const count = urgences.filter(u => u.niveau_triage === key && u.statut !== "sorti").length;
                        const pct = urgences.length > 0 ? Math.round(count / urgences.length * 100) : 0;
                        return (
                          <div key={key} style={{ marginBottom: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                              <span>{t.icon} {t.label}</span>
                              <strong style={{ color: t.color }}>{count}</strong>
                            </div>
                            <Prog pct={pct} color={t.color} />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Lits urgences */}
                  <div className="urg-card urgfu">
                    <div className="urg-card-hdr"><h3>🛏 Lits disponibles</h3></div>
                    <div style={{ padding: 16 }}>
                      {[
                        { label: "Salle soins", libre: 3, total: 6, color: "var(--ub)" },
                        { label: "Observation",  libre: 2, total: 4, color: "var(--ut)" },
                        { label: "Réanimation",  libre: 1, total: 2, color: "var(--ur)" },
                        { label: "Soins intens.", libre: 0, total: 3, color: "var(--uo)" },
                      ].map(l => (
                        <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: "var(--ucm)", minWidth: 90 }}>{l.label}</div>
                          <div style={{ flex: 1 }}><Prog pct={Math.round((l.total - l.libre) / l.total * 100)} color={l.libre === 0 ? "var(--ur)" : l.color} /></div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: l.libre === 0 ? "var(--ur)" : "var(--ug)", minWidth: 28 }}>{l.libre}/{l.total}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tableau récapitulatif */}
              <div className="urg-card urgfu">
                <div className="urg-card-hdr">
                  <div><h3>🏥 Patients admis aujourd'hui</h3><p>{kpis?.admissions_jour ?? "—"} admission(s)</p></div>
                  <button className="ubtn ubtn-ghost ubtn-sm" onClick={() => setTab("liste")}>Voir tous →</button>
                </div>
                {loading ? (
                  <div style={{ padding: 30, textAlign: "center", color: "var(--ucm)" }}>Chargement...</div>
                ) : urgences.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center" }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🚑</div>
                    <div style={{ fontWeight: 600, color: "var(--ucm)", marginBottom: 12 }}>Aucune admission enregistrée</div>
                    <button className="ubtn ubtn-danger" onClick={() => { setFormUrg(EMPTY_URG); setModalNouveauPatient(true); }}>{I.plus} Premier patient</button>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="urg-tbl">
                      <thead>
                        <tr><th>N° Urgence</th><th>Patient</th><th>Motif</th><th>Triage</th><th>Heure arrivée</th><th>Attente</th><th>Médecin</th><th>Statut</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {urgences.slice(0, 10).map(u => {
                          const mins = minutesEcoules(u.date_arrivee);
                          const enRetard = u.niveau_triage === "rouge" || (u.niveau_triage === "orange" && mins > 20);
                          const sc = STATUT_URG[u.statut] || { cls: "gray", label: u.statut, icon: "" };
                          return (
                            <tr key={u._id} style={{ background: u.niveau_triage === "rouge" ? "#FFF5F5" : u.niveau_triage === "orange" ? "#FFFBF0" : "" }}>
                              <td><span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--ur)", fontSize: 12 }}>{u.numero}</span></td>
                              <td>
                                <div style={{ fontWeight: 600, color: "var(--un)" }}>{u.patient_nom}</div>
                                <div style={{ fontSize: 11, color: "var(--ucm)" }}>{ageCalc(u.patient_dob)} · {u.patient_sexe || "—"}</div>
                              </td>
                              <td style={{ fontSize: 12, color: "var(--ucm)", maxWidth: 140 }}>{u.motif || "—"}</td>
                              <td><TriagePill niveau={u.niveau_triage} pulse={u.niveau_triage === "rouge"} /></td>
                              <td style={{ fontSize: 12 }}>
                                <div style={{ fontWeight: 600 }}>{u.date_arrivee ? new Date(u.date_arrivee).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                                <div style={{ fontSize: 10, color: "var(--ucm)" }}>{fmtDate(u.date_arrivee)}</div>
                              </td>
                              <td>
                                <span style={{ fontWeight: 700, color: enRetard ? "var(--ur)" : "var(--ucm)", fontSize: 12 }} className={enRetard && u.statut === "attente" ? "chrono-alert" : ""}>
                                  {formatDuree(mins)}
                                </span>
                              </td>
                              <td style={{ fontSize: 12, color: "var(--ucm)" }}>{u.medecin_label || "—"}</td>
                              <td>{sc.icon} <Badge cls={sc.cls}>{sc.label}</Badge></td>
                              <td>
                                <button className="ubtn ubtn-ghost ubtn-sm" style={{ fontSize: 11 }} onClick={() => openDossier(u)}>{I.open} Ouvrir</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ LISTE / FILE D'ATTENTE ══ */}
          {tab === "liste" && (
            <div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--un)" }}>File d'attente & Admissions urgences</div>
                  <div style={{ fontSize: 12, color: "var(--ucm)", marginTop: 2 }}>{total} dossier(s) au total</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }}>{I.search}</span>
                    <input className="uinp" style={{ paddingLeft: 34, width: 200 }} placeholder="Nom, N° dossier..." value={search} onChange={e => {
                      setSearch(e.target.value);
                      dispatch(fetchUrgences({ page:1, limit:20, q:e.target.value, niveau_triage:filterNiveau, statut:filterStatut }));
                    }} />
                  </div>
                  <select className="uinp" style={{ width: 160 }} value={filterNiveau} onChange={e => {
                    setFilterNiveau(e.target.value);
                    dispatch(fetchUrgences({ page:1, limit:20, q:search, niveau_triage:e.target.value, statut:filterStatut }));
                  }}>
                    <option value="">Tous les niveaux</option>
                    {Object.entries(TRIAGE_NIVEAUX).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                  <select className="uinp" style={{ width: 160 }} value={filterStatut} onChange={e => {
                    setFilterStatut(e.target.value);
                    dispatch(fetchUrgences({ page:1, limit:20, q:search, niveau_triage:filterNiveau, statut:e.target.value }));
                  }}>
                    <option value="">Tous les statuts</option>
                    {Object.entries(STATUT_URG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                  <button className="ubtn ubtn-danger" onClick={() => { setFormUrg(EMPTY_URG); setModalNouveauPatient(true); }}>{I.plus} Nouveau patient</button>
                </div>
              </div>
              <div className="urg-card">
                <div style={{ overflowX: "auto" }}>
                  <table className="urg-tbl" style={{ minWidth: 1100 }}>
                    <thead>
                      <tr><th>N° Urgence</th><th>Patient</th><th>Motif</th><th>Triage</th><th>Arrivée</th><th>Attente</th><th>Médecin</th><th>Constantes</th><th>Statut</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={10} style={{ padding: 40, textAlign: "center", color: "var(--ucm)" }}>Chargement...</td></tr>
                      ) : urgences.map(u => {
                        const mins = minutesEcoules(u.date_arrivee);
                        const enRetard = (u.niveau_triage === "rouge") || (u.niveau_triage === "orange" && mins > 20) || (u.niveau_triage === "jaune" && mins > 60);
                        const sc = STATUT_URG[u.statut] || { cls: "gray", label: u.statut, icon: "" };
                        return (
                          <tr key={u._id} style={{ background: u.niveau_triage === "rouge" && u.statut !== "sorti" ? "#FFF5F5" : "" }}>
                            <td><span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--ur)", fontSize: 12 }}>{u.numero}</span></td>
                            <td>
                              <div style={{ fontWeight: 600, color: "var(--un)" }}>{u.patient_nom}</div>
                              <div style={{ fontSize: 11, color: "var(--ucm)" }}>{ageCalc(u.patient_dob)}</div>
                            </td>
                            <td style={{ fontSize: 12, maxWidth: 130 }}>{u.motif || "—"}</td>
                            <td><TriagePill niveau={u.niveau_triage} pulse={u.niveau_triage === "rouge" && u.statut !== "sorti"} /></td>
                            <td style={{ fontSize: 12 }}>
                              <div style={{ fontWeight: 600 }}>{u.date_arrivee ? new Date(u.date_arrivee).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                              <div style={{ fontSize: 10, color: "var(--ucm)" }}>{fmtDate(u.date_arrivee)}</div>
                            </td>
                            <td><span className={enRetard && u.statut === "attente" ? "chrono-alert" : ""} style={{ fontWeight: 700, fontSize: 12, color: enRetard && u.statut === "attente" ? "var(--ur)" : "var(--ucm)" }}>{formatDuree(mins)}</span></td>
                            <td style={{ fontSize: 12, color: "var(--ucm)" }}>{u.medecin_label || "—"}</td>
                            <td style={{ fontSize: 11 }}>
                              {u.temperature && <div>🌡 {u.temperature}°C</div>}
                              {u.tension_sys && <div>💉 {u.tension_sys}/{u.tension_dia}</div>}
                              {u.spo2 && <div style={{ color: u.spo2 < 94 ? "var(--ur)" : "inherit" }}>💨 {u.spo2}%</div>}
                            </td>
                            <td>{sc.icon} <Badge cls={sc.cls}>{sc.label}</Badge></td>
                            <td><button className="ubtn ubtn-ghost ubtn-sm" style={{ fontSize: 11 }} onClick={() => openDossier(u)}>{I.open} Ouvrir</button></td>
                          </tr>
                        );
                      })}
                      {!loading && urgences.length === 0 && (
                        <tr><td colSpan={10} style={{ padding: 30, textAlign: "center", color: "var(--ucm)" }}>Aucune admission enregistrée</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {total > 20 && (
                  <div style={{ padding: "12px 20px", borderTop: "1.5px solid var(--ucr)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "var(--ucm)" }}>Page {currentPage} / {Math.ceil(total / 20)}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      {currentPage > 1 && <button className="ubtn ubtn-ghost ubtn-sm" onClick={() => dispatch(fetchUrgences({ page:currentPage-1, limit:20, q:search, niveau_triage:filterNiveau, statut:filterStatut }))}>← Précédent</button>}
                      {currentPage < Math.ceil(total / 20) && <button className="ubtn ubtn-primary ubtn-sm" onClick={() => dispatch(fetchUrgences({ page:currentPage+1, limit:20, q:search, niveau_triage:filterNiveau, statut:filterStatut }))}>Suivant →</button>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ AMBULANCES ══ */}
          {tab === "ambulances" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--un)" }}>Gestion des ambulances</div>
                  <div style={{ fontSize: 12, color: "var(--ucm)" }}>Suivi en temps réel des missions</div>
                </div>
                <button className="ubtn ubtn-danger" onClick={() => setModalAmbulance(true)}>{I.plus} Nouvelle mission</button>
              </div>

              {/* KPIs ambulances */}
              <div className="urg-g4" style={{ marginBottom: 24 }}>
                {[
                  { color: "green",  val: ambulances.filter(a => a.statut === "disponible").length, label: "Disponibles",  icon: "✅" },
                  { color: "orange", val: ambulances.filter(a => a.statut === "en_route").length,   label: "En mission",   icon: "🚑" },
                  { color: "red",    val: ambulances.filter(a => a.statut === "occupe").length,      label: "Occupées",     icon: "🔴" },
                  { color: "blue",   val: ambulances.length,                                         label: "Total parc",   icon: "🚗" },
                ].map((k, i) => (
                  <div key={i} className={`urg-kpi ${k.color} urgfu`}>
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{k.icon}</div>
                    <div className="kpi-val-urg">{k.val}</div>
                    <div className="kpi-lbl-urg">{k.label}</div>
                  </div>
                ))}
              </div>

              {ambulances.length === 0 ? (
                <div className="urg-card" style={{ padding: 40, textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🚑</div>
                  <div style={{ color: "var(--ucm)", fontSize: 13 }}>Aucune ambulance configurée dans le système</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
                  {ambulances.map(a => {
                    const st = AMB_STATUT[a.statut] || { cls: "gray", label: a.statut };
                    return (
                      <div key={a._id || a.id} className={`amb-card ${a.statut || "disponible"} urgfu`}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                          <div style={{ fontWeight: 800, fontSize: 16, color: "var(--un)" }}>🚑 {a.numero}</div>
                          <Badge cls={st.cls}>{st.label}</Badge>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--ucm)", marginBottom: 6 }}>Conducteur : <strong style={{ color: "var(--un)" }}>{a.conducteur || "—"}</strong></div>
                        {a.destination && <div style={{ fontSize: 11, color: "var(--ucm)", marginBottom: 4 }}>📍 {a.destination}</div>}
                        {a.heure_depart && <div style={{ fontSize: 11, color: "var(--ucm)", marginBottom: 8 }}>🕐 Départ : {a.heure_depart} · ETA : {a.eta || "—"}</div>}
                        {a.position && (
                          <div style={{ background: "#EAF4FB", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "var(--ub)", marginBottom: 8 }}>
                            {I.map} <strong>Localisation :</strong> {a.position}
                          </div>
                        )}
                        {a.statut === "disponible" && (
                          <button className="ubtn ubtn-danger ubtn-sm" style={{ width: "100%", marginTop: 6 }} onClick={() => { setFormAmb({ numero: a.numero, conducteur: a.conducteur || "", destination: "", motif_mission: "" }); setModalAmbulance(true); }}>
                            Assigner une mission
                          </button>
                        )}
                        {a.statut === "en_route" && (
                          <button className="ubtn ubtn-success ubtn-sm" style={{ width: "100%", marginTop: 6 }} onClick={async () => {
                            const result = await dispatch(retourAmbulanceThunk(a.numero));
                            if (retourAmbulanceThunk.fulfilled.match(result)) toast.success(`🏥 Ambulance ${a.numero} : retour confirmé`);
                          }}>
                            ✅ Confirmer retour
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ DOSSIER ══ */}
          {tab === "dossier" && currentUrg && (
            <div>
              {/* Header patient */}
              <div style={{ background: "linear-gradient(135deg,#3D0A0A,#1A0F0F)", borderRadius: 18, padding: "20px 24px", marginBottom: 20, color: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(192,57,43,.25)", border: "2px solid rgba(192,57,43,.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                      {currentUrg.patient_sexe === "femme" ? "👩" : "👨"}
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{currentUrg.patient_nom}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,.65)", marginTop: 2 }}>
                        {ageCalc(currentUrg.patient_dob)} · {currentUrg.patient_tel || "—"}
                      </div>
                      <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <TriagePill niveau={currentUrg.niveau_triage} pulse={currentUrg.niveau_triage === "rouge"} />
                        <Badge cls={(STATUT_URG[currentUrg.statut] || {}).cls || "gray"}>
                          {(STATUT_URG[currentUrg.statut] || {}).icon} {(STATUT_URG[currentUrg.statut] || {}).label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ background: "rgba(255,255,255,.1)", borderRadius: 12, padding: "10px 16px" }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,.55)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Durée passage</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: currentUrg.niveau_triage === "rouge" ? "#FCA5A5" : "#A2D9CE" }}>
                        {formatDuree(minutesEcoules(currentUrg.date_arrivee))}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 2 }}>
                        Arrivé : {currentUrg.date_arrivee ? new Date(currentUrg.date_arrivee).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,.9)" }}>{currentUrg.numero}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 6 }}>Médecin : {currentUrg.medecin_label}</div>
                      {currentUrg.statut !== "sorti" && currentUrg.statut !== "decede" && (
                        <button className="ubtn ubtn-danger ubtn-sm" style={{ marginTop: 8 }} onClick={() => { setFormCloture(EMPTY_CLOTURE); setModalCloture(true); }}>
                          {I.exit} Clôturer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status strip */}
              <div className="status-strip-urg urgfu" style={{ marginBottom: 20 }}>
                {[
                  { label: "Arrivée",       icon: "🚑", key: "attente" },
                  { label: "Triage",        icon: "🔍", key: "triage" },
                  { label: "Consultation",  icon: "🩺", key: "consultation" },
                  { label: "Soins",         icon: "💉", key: "soins" },
                  { label: "Observation",   icon: "👁",  key: "observation" },
                  { label: "Clôture",       icon: "✅", key: "sorti" },
                ].map((step, i) => {
                  const order = ["attente", "triage", "consultation", "soins", "observation", "sorti", "hospitalise", "transfere", "decede"];
                  const curIdx = order.indexOf(currentUrg.statut);
                  const stepIdx = order.indexOf(step.key);
                  const isDone = curIdx > stepIdx;
                  const isActive = curIdx === stepIdx || (step.key === "sorti" && ["sorti", "hospitalise", "transfere", "decede"].includes(currentUrg.statut));
                  return (
                    <div key={step.key} className={`status-step-urg ${isDone ? "done" : isActive ? "active" : ""}`}>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>{step.icon}</div>
                      <div>{step.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Section nav */}
              <div className="sec-nav-urg">
                {[
                  { id: "triage",        label: "🔍 Triage & Constantes" },
                  { id: "clinique",      label: "🩺 Examen clinique" },
                  { id: "soins",         label: `💉 Soins (${soins.length})` },
                  { id: "prescriptions", label: `💊 Prescriptions (${prescriptions.length})` },
                  { id: "examens",       label: `🔬 Examens (${examens.length})` },
                  { id: "surveillance",  label: "📈 Surveillance" },
                  { id: "facturation",   label: "💰 Facturation" },
                  { id: "documents",     label: "📄 Documents" },
                ].map(s => (
                  <button key={s.id} className={`sec-btn-urg ${section === s.id ? "active" : ""}`} onClick={() => setSection(s.id)}>{s.label}</button>
                ))}
              </div>

              {/* ── TRIAGE ── */}
              {section === "triage" && (
                <div className="urg-g11" style={{ marginTop: 20 }}>
                  <div className="urg-card">
                    <div className="urg-card-hdr"><h3>🔍 Triage & Admission</h3></div>
                    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <label className="ulbl">Niveau de triage *</label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          {Object.entries(TRIAGE_NIVEAUX).map(([key, t]) => (
                            <div key={key} onClick={() => setCurrentUrg(u => ({ ...u, niveau_triage: key }))}
                              style={{ padding: "10px 12px", borderRadius: 10, cursor: "pointer", border: `2px solid ${currentUrg.niveau_triage === key ? t.color : "var(--ucr)"}`, background: currentUrg.niveau_triage === key ? t.color + "15" : "#F4F9FD", transition: "all .2s" }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: t.color }}>{t.icon} {t.label}</div>
                              <div style={{ fontSize: 10, color: "var(--ucm)" }}>{t.desc}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="ulbl">Statut actuel</label>
                        <select className="uinp" value={currentUrg.statut} onChange={e => setCurrentUrg(u => ({ ...u, statut: e.target.value }))}>
                          {Object.entries(STATUT_URG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="ulbl">Motif de recours</label>
                        <select className="uinp" value={currentUrg.motif || ""} onChange={e => setCurrentUrg(u => ({ ...u, motif: e.target.value }))}>
                          <option value="">— Sélectionner —</option>
                          {MOTIFS_URG.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="ulbl">Médecin responsable</label>
                        <input className="uinp" value={currentUrg.medecin || ""} onChange={e => setCurrentUrg(u => ({ ...u, medecin: e.target.value }))} placeholder="Dr. Nom Prénom" />
                      </div>
                      <div>
                        <label className="ulbl">Infirmier(ère)</label>
                        <input className="uinp" value={currentUrg.infirmier || ""} onChange={e => setCurrentUrg(u => ({ ...u, infirmier: e.target.value }))} placeholder="Inf. Nom Prénom" />
                      </div>
                      <button className="ubtn ubtn-teal" disabled={saving} onClick={() => updateUrgence({ statut: currentUrg.statut, niveau_triage: currentUrg.niveau_triage, motif: currentUrg.motif, medecin: currentUrg.medecin, infirmier: currentUrg.infirmier })}>
                        {I.save} {saving ? "Enregistrement..." : "Enregistrer"}
                      </button>
                    </div>
                  </div>

                  <div className="urg-card">
                    <div className="urg-card-hdr"><h3>💓 Constantes vitales initiales</h3></div>
                    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                      <div className="urg-g11s">
                        <div>
                          <label className="ulbl">Température (°C)</label>
                          <input type="number" step="0.1" className="uinp" placeholder="37.0" value={currentUrg.temperature || ""} onChange={e => setCurrentUrg(u => ({ ...u, temperature: e.target.value }))} />
                        </div>
                        <div>
                          <label className="ulbl">Pouls (bpm)</label>
                          <input type="number" className="uinp" placeholder="72" value={currentUrg.pouls || ""} onChange={e => setCurrentUrg(u => ({ ...u, pouls: e.target.value }))} />
                        </div>
                        <div>
                          <label className="ulbl">Tension systolique</label>
                          <input type="number" className="uinp" placeholder="120" value={currentUrg.tension_sys || ""} onChange={e => setCurrentUrg(u => ({ ...u, tension_sys: e.target.value }))} />
                        </div>
                        <div>
                          <label className="ulbl">Tension diastolique</label>
                          <input type="number" className="uinp" placeholder="80" value={currentUrg.tension_dia || ""} onChange={e => setCurrentUrg(u => ({ ...u, tension_dia: e.target.value }))} />
                        </div>
                        <div>
                          <label className="ulbl">SpO₂ (%)</label>
                          <input type="number" className="uinp" placeholder="98" value={currentUrg.spo2 || ""} onChange={e => setCurrentUrg(u => ({ ...u, spo2: e.target.value }))} />
                        </div>
                        <div>
                          <label className="ulbl">Glycémie (g/L)</label>
                          <input type="number" step="0.01" className="uinp" placeholder="1.00" value={currentUrg.glycemie || ""} onChange={e => setCurrentUrg(u => ({ ...u, glycemie: e.target.value }))} />
                        </div>
                      </div>

                      {/* Vitals display */}
                      {(currentUrg.temperature || currentUrg.pouls || currentUrg.spo2) && (
                        <div className="urg-g3" style={{ marginTop: 4 }}>
                          {[
                            { lbl: "Temp.", val: currentUrg.temperature ? `${currentUrg.temperature}°C` : null, cls: currentUrg.temperature > 38.5 ? "danger" : currentUrg.temperature < 36 ? "warn" : "ok" },
                            { lbl: "Pouls", val: currentUrg.pouls ? `${currentUrg.pouls} bpm` : null, cls: currentUrg.pouls > 100 || currentUrg.pouls < 55 ? "danger" : "ok" },
                            { lbl: "SpO₂",  val: currentUrg.spo2 ? `${currentUrg.spo2}%` : null, cls: currentUrg.spo2 < 94 ? "danger" : "ok" },
                          ].filter(v => v.val).map(v => (
                            <div key={v.lbl} className={`vital-urg ${v.cls}`}>
                              <div className="vital-v-urg" style={v.cls === "danger" ? { color: "var(--ur)" } : {}}>{v.val}</div>
                              <div className="vital-l-urg">{v.lbl}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      <button className="ubtn ubtn-teal" disabled={saving} onClick={() => updateUrgence({ temperature: currentUrg.temperature, pouls: currentUrg.pouls, tension_sys: currentUrg.tension_sys, tension_dia: currentUrg.tension_dia, spo2: currentUrg.spo2, glycemie: currentUrg.glycemie })}>
                        {I.save} Enregistrer les constantes
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── EXAMEN CLINIQUE ── */}
              {section === "clinique" && (
                <div style={{ marginTop: 20 }}>
                  <div className="urg-g11">
                    <div className="urg-card">
                      <div className="urg-card-hdr"><h3>🩺 Examen clinique</h3></div>
                      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                        <div>
                          <label className="ulbl">Antécédents médicaux</label>
                          <textarea className="uinp" rows={2} value={currentUrg.antecedents || ""} onChange={e => setCurrentUrg(u => ({ ...u, antecedents: e.target.value }))} placeholder="Diabète, HTA, ATCD chirurgicaux..." />
                        </div>
                        <div>
                          <label className="ulbl">Allergies connues</label>
                          <input className="uinp" value={currentUrg.allergies || ""} onChange={e => setCurrentUrg(u => ({ ...u, allergies: e.target.value }))} placeholder="Pénicilline, AINS, latex..." />
                        </div>
                        <div>
                          <label className="ulbl">Traitements en cours</label>
                          <textarea className="uinp" rows={2} value={currentUrg.traitements_cours || ""} onChange={e => setCurrentUrg(u => ({ ...u, traitements_cours: e.target.value }))} placeholder="Médicaments habituels du patient..." />
                        </div>
                        <div>
                          <label className="ulbl">Observations cliniques</label>
                          <textarea className="uinp" rows={3} value={currentUrg.observations || ""} onChange={e => setCurrentUrg(u => ({ ...u, observations: e.target.value }))} placeholder="Description de l'état clinique..." />
                        </div>
                        <div>
                          <label className="ulbl">Diagnostic provisoire</label>
                          <input className="uinp" value={currentUrg.diagnostic_provisoire || ""} onChange={e => setCurrentUrg(u => ({ ...u, diagnostic_provisoire: e.target.value }))} placeholder="Ex: Appendicite aiguë suspecte..." />
                        </div>
                        <button className="ubtn ubtn-teal" disabled={saving} onClick={() => updateUrgence({ antecedents: currentUrg.antecedents, allergies: currentUrg.allergies, traitements_cours: currentUrg.traitements_cours, observations: currentUrg.observations, diagnostic_provisoire: currentUrg.diagnostic_provisoire })}>
                          {I.save} {saving ? "Enregistrement..." : "Enregistrer"}
                        </button>
                      </div>
                    </div>
                    <div className="urg-card">
                      <div className="urg-card-hdr"><h3>🗂 Historique des actions</h3></div>
                      <div style={{ padding: 20 }}>
                        {timeline.length === 0 ? (
                          <div className="urg-tl">
                            {[
                              { label: "Arrivée aux urgences", heure: currentUrg.date_arrivee ? new Date(currentUrg.date_arrivee).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—", dot: "done" },
                              { label: "Triage effectué", heure: "—", dot: currentUrg.statut !== "attente" ? "done" : "pending" },
                              { label: "Prise en charge médicale", heure: "—", dot: ["consultation", "soins", "observation", "sorti", "hospitalise"].includes(currentUrg.statut) ? "done" : currentUrg.statut === "triage" ? "active" : "pending" },
                              { label: "Clôture du dossier", heure: "—", dot: ["sorti", "hospitalise", "transfere", "decede"].includes(currentUrg.statut) ? "done" : "pending" },
                            ].map((item, i) => (
                              <div key={i} className="urg-tl-item">
                                <div className={`urg-tl-dot ${item.dot}`} />
                                <div style={{ background: "#F4F9FD", border: "1.5px solid var(--ucr)", borderRadius: 10, padding: "8px 12px" }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--un)" }}>{item.label}</div>
                                  <div style={{ fontSize: 11, color: "var(--ucm)", marginTop: 2 }}>{item.heure}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="urg-tl">
                            {timeline.map((item, i) => (
                              <div key={i} className="urg-tl-item">
                                <div className={`urg-tl-dot ${i === 0 ? "active" : "done"}`} />
                                <div style={{ background: "#F4F9FD", border: "1.5px solid var(--ucr)", borderRadius: 10, padding: "8px 12px" }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--un)" }}>{item.action || item.label}</div>
                                  <div style={{ fontSize: 11, color: "var(--ucm)", marginTop: 2 }}>{item.heure || fmtDateTime(item.date)} · {item.personnel || item.auteur || ""}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SOINS ── */}
              {section === "soins" && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--un)" }}>Soins administrés</div>
                      <div style={{ fontSize: 12, color: "var(--ucm)" }}>{soins.length} acte(s) enregistré(s)</div>
                    </div>
                    <button className="ubtn ubtn-danger" onClick={() => { setFormSoin(EMPTY_SOIN); setModalSoin(true); }}>{I.plus} Ajouter soin</button>
                  </div>
                  <div className="urg-card">
                    <div className="urg-card-hdr"><h3>💉 Feuille de soins urgences</h3></div>
                    <div style={{ padding: 16 }}>
                      {soins.length === 0 ? (
                        <div style={{ padding: 20, textAlign: "center", color: "var(--ucm)" }}>Aucun soin enregistré</div>
                      ) : soins.map((s, i) => (
                        <div key={s._id || s.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#F4F9FD", border: "1.5px solid var(--ucr)", borderRadius: 10, marginBottom: 8 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FDEDEC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>💉</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--un)" }}>{s.acte}</div>
                            <div style={{ fontSize: 11, color: "var(--ucm)" }}>{s.heure} · {s.personnel}</div>
                          </div>
                          {s.note && <div style={{ fontSize: 11, color: "var(--ucm)", maxWidth: 180 }}>{s.note}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── PRESCRIPTIONS ── */}
              {section === "prescriptions" && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--un)" }}>Prescriptions d'urgence</div>
                      <div style={{ fontSize: 12, color: "var(--ucm)" }}>{prescriptions.length} prescription(s)</div>
                    </div>
                    <button className="ubtn ubtn-danger" onClick={() => { setFormPrescription_(EMPTY_PRESCRIPTION_U); setModalPrescription(true); }}>{I.plus} Nouvelle prescription</button>
                  </div>
                  <div className="urg-card">
                    <div className="urg-card-hdr"><h3>💊 Ordonnances urgences</h3></div>
                    <div style={{ padding: 16 }}>
                      {prescriptions.length === 0 ? (
                        <div style={{ padding: 20, textAlign: "center", color: "var(--ucm)" }}>Aucune prescription</div>
                      ) : prescriptions.map((p, i) => (
                        <div key={p._id || p.id || i} style={{ background: "#F4F9FD", border: "1.5px solid var(--ucr)", borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 16 }}>{{ medicament: "💊", perfusion: "🩸", soin: "🩺" }[p.type] || "📋"}</span>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--un)" }}>{p.designation}</div>
                              <div style={{ fontSize: 11, color: "var(--ucm)" }}>{p.posologie} · {p.medecin} · {fmtDate(p.date)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── EXAMENS ── */}
              {section === "examens" && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--un)" }}>Examens complémentaires</div>
                      <div style={{ fontSize: 12, color: "var(--ucm)" }}>{examens.filter(e => e.statut === "attente").length} en attente · {examens.filter(e => e.statut === "resultat").length} résultats</div>
                    </div>
                    <button className="ubtn ubtn-danger" onClick={() => { setFormExamen_(EMPTY_EXAMEN_U); setModalExamen(true); }}>{I.plus} Demander examen</button>
                  </div>
                  {examens.filter(e => e.urgent && e.statut === "attente").length > 0 && (
                    <div className="al-danger" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>🚨</span>
                      <span style={{ fontSize: 13, color: "var(--ur)" }}><strong>{examens.filter(e => e.urgent && e.statut === "attente").length}</strong> examen(s) URGENT(S) en attente</span>
                    </div>
                  )}
                  {["labo", "imagerie"].map(type => {
                    const items = examens.filter(e => e.type === type);
                    return (
                      <div key={type} className="urg-card" style={{ marginBottom: 16 }}>
                        <div className="urg-card-hdr">
                          <h3>{type === "labo" ? <>{I.flask} Analyses biologiques</> : <>🩻 Imagerie médicale</>}</h3>
                          <Badge cls="blue">{items.length} examen(s)</Badge>
                        </div>
                        {items.length === 0 ? (
                          <div style={{ padding: 20, textAlign: "center", color: "var(--ucm)" }}>Aucun examen</div>
                        ) : (
                          <div style={{ overflowX: "auto" }}>
                            <table className="urg-tbl">
                              <thead><tr><th>Examen</th><th>Urgence</th><th>Statut</th><th>Résultat</th></tr></thead>
                              <tbody>
                                {items.map((e, i) => (
                                  <tr key={e._id || e.id || i}>
                                    <td style={{ fontWeight: 600 }}>{e.designation}</td>
                                    <td>{e.urgent ? <Badge cls="red">🚨 URGENT</Badge> : <Badge cls="gray">Normal</Badge>}</td>
                                    <td><Badge cls={e.statut === "resultat" ? "green" : "orange"}>{e.statut === "resultat" ? "✅ Résultat" : "⏳ En attente"}</Badge></td>
                                    <td style={{ fontSize: 12 }}>
                                      {e.resultat ? (
                                        <span style={{ background: "#EAFAF1", borderRadius: 6, padding: "3px 8px", fontSize: 11 }}>{e.resultat}</span>
                                      ) : (
                                        <button className="ubtn ubtn-ghost ubtn-sm" onClick={() => { const r = window.prompt("Saisir le résultat :"); if (r) dispatch(setExamenResultat({ examenId: e._id || e.id, resultat: r })); }}>Saisir</button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── SURVEILLANCE ── */}
              {section === "surveillance" && (
                <div style={{ marginTop: 20 }}>
                  <div className="urg-g5" style={{ marginBottom: 20 }}>
                    {[
                      { lbl: "Température", val: currentUrg.temperature ? `${currentUrg.temperature}°C` : "—", cls: currentUrg.temperature > 38.5 ? "danger" : currentUrg.temperature < 36 ? "warn" : "ok" },
                      { lbl: "Tension",     val: currentUrg.tension_sys ? `${currentUrg.tension_sys}/${currentUrg.tension_dia}` : "—", cls: "" },
                      { lbl: "Pouls",       val: currentUrg.pouls ? `${currentUrg.pouls} bpm` : "—", cls: currentUrg.pouls > 100 || currentUrg.pouls < 55 ? "danger" : "ok" },
                      { lbl: "SpO₂",        val: currentUrg.spo2 ? `${currentUrg.spo2}%` : "—", cls: currentUrg.spo2 < 94 ? "danger" : "ok" },
                      { lbl: "Glycémie",    val: currentUrg.glycemie ? `${currentUrg.glycemie} g/L` : "—", cls: "" },
                    ].map(v => (
                      <div key={v.lbl} className={`vital-urg ${v.cls} urgfu`}>
                        <div className="vital-v-urg" style={v.cls === "danger" ? { color: "var(--ur)" } : {}}>{v.val}</div>
                        <div className="vital-l-urg">{v.lbl}</div>
                      </div>
                    ))}
                  </div>
                  <div className="urg-card">
                    <div className="urg-card-hdr"><h3>📈 Courbe d'évolution</h3></div>
                    <div style={{ padding: 20 }}>
                      <BarChart labels={["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30"]} data={[37.2,37.4,38.1,38.5,38.2,37.9,37.6,37.3]} color="var(--ur)" height={160} />
                      <div style={{ fontSize: 11, color: "var(--ucm)", marginTop: 8, textAlign: "center" }}>Évolution de la température — Dernières 4 heures</div>
                    </div>
                  </div>
                  <div className="al-info" style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>ℹ️</span>
                    <span style={{ fontSize: 13, color: "var(--ub)" }}>Surveillance active depuis l'arrivée. Dernière mise à jour des constantes : {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              )}

              {/* ── FACTURATION ── */}
              {section === "facturation" && (
                <div style={{ marginTop: 20 }}>
                  <div className="urg-card">
                    <div className="urg-card-hdr"><h3>💰 Facturation urgences</h3></div>
                    <div style={{ padding: 20 }}>
                      {(() => {
                        const actes = [
                          ["Consultation urgence", 20000],
                          ["Triage infirmier", 5000],
                          ["Soins infirmiers", soins.length * 8000],
                          ["Médicaments administrés", prescriptions.filter(p => p.type === "medicament").length * 15000],
                          ["Analyses biologiques", examens.filter(e => e.type === "labo").length * 12000],
                          ["Imagerie médicale", examens.filter(e => e.type === "imagerie").length * 35000],
                        ];
                        const total = actes.reduce((s, [, v]) => s + v, 0);
                        const paye = Math.round(total * 0.6);
                        const reste = total - paye;
                        return (
                          <>
                            <table className="urg-tbl" style={{ marginBottom: 20 }}>
                              <thead><tr><th>Prestation</th><th style={{ textAlign: "right" }}>Montant (CFA)</th></tr></thead>
                              <tbody>{actes.map(([lbl, val]) => val > 0 && <tr key={lbl}><td style={{ fontSize: 12 }}>{lbl}</td><td style={{ textAlign: "right", fontWeight: 600 }}>{val.toLocaleString("fr-FR")}</td></tr>)}</tbody>
                            </table>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
                              {[["TOTAL", total, "var(--ur)","#FDEDEC"],["PAYÉ", paye, "var(--ug)","#EAFAF1"],["RESTE", reste, "var(--uo)","#FEF9E7"]].map(([lbl, val, col, bg]) => (
                                <div key={lbl} style={{ background: bg, borderRadius: 10, padding: 14, textAlign: "center" }}>
                                  <div style={{ fontSize: 18, fontWeight: 800, color: col }}>{val.toLocaleString("fr-FR")}</div>
                                  <div style={{ fontSize: 11, color: "var(--ucm)", marginTop: 2 }}>{lbl} (CFA)</div>
                                </div>
                              ))}
                            </div>
                            <Prog pct={Math.round(paye / total * 100)} color="var(--ug)" />
                            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                              <button className="ubtn ubtn-danger" onClick={() => toast.success("📄 Génération facture...")}>{I.dl} Générer facture</button>
                              <button className="ubtn ubtn-ghost" onClick={() => window.print()}>{I.print} Imprimer</button>
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
                <div style={{ marginTop: 20 }}>
                  <div className="urg-card">
                    <div className="urg-card-hdr"><h3>📄 Documents d'urgence</h3></div>
                    <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14 }}>
                      {[
                        ["🚑", "Fiche d'urgence",       "Rapport d'admission initial"],
                        ["🔍", "Fiche de triage",        "Évaluation et priorité"],
                        ["💉", "Feuille de soins",       "Actes infirmiers urgences"],
                        ["🩺", "Compte rendu médical",   "Examen clinique complet"],
                        ["💊", "Ordonnance urgence",     "Prescriptions médicales"],
                        ["✅", "Bon de sortie",          "Décision médicale finale"],
                        ["🚑", "Rapport transfert",      "Si hospitalisation/transfert"],
                        ["💰", "Facture urgences",       "Détail des prestations"],
                      ].map(([ico, title, desc]) => (
                        <div key={title} style={{ background: "#F4F9FD", border: "1.5px solid var(--ucr)", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 8, transition: "all .2s" }}
                          onMouseOver={e => e.currentTarget.style.boxShadow = "var(--ushm)"} onMouseOut={e => e.currentTarget.style.boxShadow = "none"}>
                          <div style={{ fontSize: 24 }}>{ico}</div>
                          <div style={{ fontWeight: 700, color: "var(--un)", fontSize: 13 }}>{title}</div>
                          <div style={{ fontSize: 11, color: "var(--ucm)" }}>{desc}</div>
                          <button className="ubtn ubtn-ghost ubtn-sm" style={{ marginTop: "auto" }} onClick={() => toast.success(`📄 ${title} en cours de génération...`)}>{I.dl} Générer</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ STATS ══ */}
          {tab === "stats" && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--un)", marginBottom: 20 }}>Statistiques — Urgences</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 14, marginBottom: 24 }}>
                {[
                  { color: "red",    val: kpis?.admissions_jour ?? "—",  lbl: "Admissions/jour",       sub: "toutes priorités" },
                  { color: "orange", val: "28 min",              lbl: "Temps d'attente moy.",  sub: "tous niveaux" },
                  { color: "blue",   val: "3h12",                lbl: "Durée moy. séjour",     sub: "passage complet" },
                  { color: "green",  val: "78%",                 lbl: "Retours domicile",      sub: "sans hospitalisation" },
                  { color: "teal",   val: "18%",                 lbl: "Hospitalisés",          sub: "depuis urgences" },
                  { color: "purple", val: "4%",                  lbl: "Transférés",            sub: "vers autre établ." },
                ].map((k, i) => (
                  <div key={i} className={`urg-kpi ${k.color} urgfu`}>
                    <div className="kpi-val-urg">{k.val}</div>
                    <div className="kpi-lbl-urg">{k.lbl}</div>
                    <div className="kpi-sub-urg">{k.sub}</div>
                  </div>
                ))}
              </div>
              <div className="urg-g32" style={{ marginBottom: 20 }}>
                <div className="urg-card">
                  <div className="urg-card-hdr"><h3>{I.trend} Flux horaire des urgences</h3></div>
                  <div style={{ padding: 20 }}>
                    <BarChart labels={["00","02","04","06","08","10","12","14","16","18","20","22"]} data={[3,2,1,4,8,14,18,15,19,16,12,7]} color="var(--ur)" />
                  </div>
                </div>
                <div className="urg-card">
                  <div className="urg-card-hdr"><h3>Répartition motifs</h3></div>
                  <div style={{ padding: 20 }}>
                    <DoughnutChart labels={["Trauma","Doul. abdominale","Resp.","Cardio","Fièvre","Autre"]} data={[28,20,16,12,14,10]} colors={["var(--ur)","var(--uo)","var(--ub)","var(--up)","var(--ut)","#9CA3AF"]} />
                  </div>
                </div>
              </div>
              <div className="urg-g11">
                <div className="urg-card">
                  <div className="urg-card-hdr"><h3>📊 Taux d'occupation par zone</h3></div>
                  <div style={{ padding: 16 }}>
                    {[["Salle d'attente",75,"var(--uo)"],["Salle de soins",88,"var(--ur)"],["Observation",60,"var(--ub)"],["Réanimation",50,"var(--ur)"],["Soins intensifs",100,"var(--ur)"]].map(([lbl,pct,col]) => (
                      <div key={lbl} style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: "var(--ucm)" }}>{lbl}</span>
                          <strong style={{ color: pct >= 90 ? "var(--ur)" : "var(--un)" }}>{pct}%</strong>
                        </div>
                        <Prog pct={pct} color={pct >= 90 ? "var(--ur)" : col} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="urg-card">
                  <div className="urg-card-hdr"><h3>🚪 Issues des passages</h3></div>
                  <div style={{ padding: 16 }}>
                    {[["Retour domicile","✅",78,"var(--ug)"],["Hospitalisé","🛏",18,"var(--ub)"],["Transféré","🚑",4,"var(--up)"]].map(([lbl,ico,pct,col]) => (
                      <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #EAF4FB" }}>
                        <span style={{ fontSize: 14 }}>{ico}</span>
                        <span style={{ fontSize: 12, color: "var(--ucm)", flex: 1 }}>{lbl}</span>
                        <div style={{ width: 100 }}><Prog pct={pct} color={col} /></div>
                        <strong style={{ fontSize: 13, color: "var(--un)", minWidth: 36, textAlign: "right" }}>{pct}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ MODAL : NOUVEAU PATIENT ═══ */}
        <Modal open={modalNouveauPatient} onClose={() => setModalNouveauPatient(false)} title={<>🚑 Nouveau patient — Admission urgences</>} maxWidth={780}>
          <form onSubmit={createUrgence}>
            <div className="urg-g11" style={{ gap: 14 }}>
              {/* Niveau triage en visuel */}
              <div style={{ gridColumn: "1/-1" }}>
                <label className="ulbl">Niveau de triage * — Choisir la priorité</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                  {Object.entries(TRIAGE_NIVEAUX).map(([key, t]) => (
                    <div key={key} onClick={() => setFormUrg(f => ({ ...f, niveau_triage: key }))}
                      style={{ padding: "10px 8px", borderRadius: 10, cursor: "pointer", textAlign: "center", border: `2px solid ${formUrg.niveau_triage === key ? t.color : "var(--ucr)"}`, background: formUrg.niveau_triage === key ? t.color + "18" : "#F4F9FD", transition: "all .2s" }}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{t.icon}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: t.color }}>{t.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ gridColumn: "1/-1" }}>
                <label className="ulbl">Patient existant</label>
                <select className="uinp" value={formUrg.patient_id} onChange={e => setFormUrg(f => ({ ...f, patient_id: e.target.value }))}>
                  <option value="">— Sélectionner un patient —</option>
                  {patients.map(p => <option key={p._id} value={p._id}>{p.prenom} {p.nom} — {p.numero_dossier}</option>)}
                </select>
              </div>
              <div>
                <label className="ulbl">Nom complet *</label>
                <input className="uinp" required placeholder="Nom et prénom du patient" value={formUrg.patient_nom} onChange={e => setFormUrg(f => ({ ...f, patient_nom: e.target.value }))} />
              </div>
              <div>
                <label className="ulbl">Date de naissance</label>
                <input type="date" className="uinp" value={formUrg.patient_dob} onChange={e => setFormUrg(f => ({ ...f, patient_dob: e.target.value }))} />
              </div>
              <div>
                <label className="ulbl">Sexe</label>
                <select className="uinp" value={formUrg.patient_sexe} onChange={e => setFormUrg(f => ({ ...f, patient_sexe: e.target.value }))}>
                  <option value="">—</option>
                  <option value="homme">Homme</option>
                  <option value="femme">Femme</option>
                </select>
              </div>
              <div>
                <label className="ulbl">Téléphone</label>
                <input className="uinp" placeholder="77 xxx xx xx" value={formUrg.patient_tel} onChange={e => setFormUrg(f => ({ ...f, patient_tel: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label className="ulbl">Motif de recours *</label>
                <select className="uinp" required value={formUrg.motif} onChange={e => setFormUrg(f => ({ ...f, motif: e.target.value }))}>
                  <option value="">— Sélectionner —</option>
                  {MOTIFS_URG.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="ulbl">Température (°C)</label>
                <input type="number" step="0.1" className="uinp" placeholder="37.0" value={formUrg.temperature} onChange={e => setFormUrg(f => ({ ...f, temperature: e.target.value }))} />
              </div>
              <div>
                <label className="ulbl">SpO₂ (%)</label>
                <input type="number" className="uinp" placeholder="98" value={formUrg.spo2} onChange={e => setFormUrg(f => ({ ...f, spo2: e.target.value }))} />
              </div>
              <div>
                <label className="ulbl">Tension (sys/dia)</label>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="number" className="uinp" placeholder="120" value={formUrg.tension_sys} onChange={e => setFormUrg(f => ({ ...f, tension_sys: e.target.value }))} />
                  <span style={{ fontWeight: 700, color: "var(--ucm)" }}>/</span>
                  <input type="number" className="uinp" placeholder="80" value={formUrg.tension_dia} onChange={e => setFormUrg(f => ({ ...f, tension_dia: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="ulbl">Pouls (bpm)</label>
                <input type="number" className="uinp" placeholder="72" value={formUrg.pouls} onChange={e => setFormUrg(f => ({ ...f, pouls: e.target.value }))} />
              </div>
              <div>
                <label className="ulbl">Médecin responsable</label>
                <input className="uinp" placeholder="Dr. Nom Prénom" value={formUrg.medecin} onChange={e => setFormUrg(f => ({ ...f, medecin: e.target.value }))} />
              </div>
              <div>
                <label className="ulbl">Date et heure d'arrivée</label>
                <input type="datetime-local" className="uinp" value={formUrg.date_arrivee} onChange={e => setFormUrg(f => ({ ...f, date_arrivee: e.target.value }))} />
              </div>
              <div>
                <label className="ulbl">Contact urgence</label>
                <input className="uinp" placeholder="Nom et lien de parenté" value={formUrg.contact_urgence} onChange={e => setFormUrg(f => ({ ...f, contact_urgence: e.target.value }))} />
              </div>
              <div>
                <label className="ulbl">Téléphone urgence</label>
                <input className="uinp" placeholder="77 xxx xx xx" value={formUrg.tel_urgence} onChange={e => setFormUrg(f => ({ ...f, tel_urgence: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button type="button" className="ubtn ubtn-ghost" onClick={() => setModalNouveauPatient(false)}>Annuler</button>
              <button type="submit" className="ubtn ubtn-danger" style={{ marginLeft: "auto" }} disabled={saving}>
                {I.save} {saving ? "Enregistrement..." : "Admettre aux urgences"}
              </button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : SOIN ═══ */}
        <Modal open={modalSoin} onClose={() => setModalSoin(false)} title="💉 Enregistrer un soin" maxWidth={480}>
          <form onSubmit={handleAddSoin}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="ulbl">Acte de soin *</label>
                <select className="uinp" required value={formSoin.acte} onChange={e => setFormSoin(f => ({ ...f, acte: e.target.value }))}>
                  <option value="">— Sélectionner —</option>
                  {["Injection IV","Perfusion","Pansement","Suture","Réanimation","Oxygénothérapie","Électrocardiogramme","Immobilisation / Plâtre","Sondage urinaire","Nébulisation","Autre"].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="urg-g11s">
                <div>
                  <label className="ulbl">Heure</label>
                  <input type="time" className="uinp" value={formSoin.heure} onChange={e => setFormSoin(f => ({ ...f, heure: e.target.value }))} />
                </div>
                <div>
                  <label className="ulbl">Personnel</label>
                  <input className="uinp" placeholder="Inf. / Dr. Nom" value={formSoin.personnel} onChange={e => setFormSoin(f => ({ ...f, personnel: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="ulbl">Note / Observation</label>
                <textarea className="uinp" rows={2} placeholder="Détails sur le soin effectué..." value={formSoin.note} onChange={e => setFormSoin(f => ({ ...f, note: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="ubtn ubtn-ghost" onClick={() => setModalSoin(false)}>Annuler</button>
                <button type="submit" className="ubtn ubtn-danger" style={{ marginLeft: "auto" }}>{I.save} Enregistrer</button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : PRESCRIPTION ═══ */}
        <Modal open={modalPrescription} onClose={() => setModalPrescription(false)} title="💊 Prescription urgences" maxWidth={480}>
          <form onSubmit={handleAddPrescription}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="ulbl">Type</label>
                <select className="uinp" value={formPrescription.type} onChange={e => setFormPrescription_(f => ({ ...f, type: e.target.value }))}>
                  <option value="medicament">💊 Médicament</option>
                  <option value="perfusion">🩸 Perfusion</option>
                  <option value="soin">🩺 Soin</option>
                </select>
              </div>
              <div>
                <label className="ulbl">Désignation *</label>
                <input className="uinp" required placeholder="Nom du médicament..." value={formPrescription.designation} onChange={e => setFormPrescription_(f => ({ ...f, designation: e.target.value }))} />
              </div>
              <div>
                <label className="ulbl">Posologie</label>
                <input className="uinp" placeholder="Ex: 500mg IV toutes les 8h" value={formPrescription.posologie} onChange={e => setFormPrescription_(f => ({ ...f, posologie: e.target.value }))} />
              </div>
              <div>
                <label className="ulbl">Médecin prescripteur</label>
                <input className="uinp" placeholder="Dr. Nom Prénom" value={formPrescription.medecin} onChange={e => setFormPrescription_(f => ({ ...f, medecin: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="ubtn ubtn-ghost" onClick={() => setModalPrescription(false)}>Annuler</button>
                <button type="submit" className="ubtn ubtn-danger" style={{ marginLeft: "auto" }}>{I.save} Ajouter</button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : EXAMEN ═══ */}
        <Modal open={modalExamen} onClose={() => setModalExamen(false)} title="🔬 Demande d'examen" maxWidth={480}>
          <form onSubmit={handleAddExamen}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="ulbl">Type</label>
                <select className="uinp" value={formExamen.type} onChange={e => setFormExamen_(f => ({ ...f, type: e.target.value }))}>
                  <option value="labo">Analyse biologique</option>
                  <option value="imagerie">Imagerie médicale</option>
                </select>
              </div>
              <div>
                <label className="ulbl">Désignation *</label>
                <input className="uinp" required placeholder="Ex: NFS, CRP, Radio thorax, ECG..." value={formExamen.designation} onChange={e => setFormExamen_(f => ({ ...f, designation: e.target.value }))} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" id="urgent_examen" checked={formExamen.urgent} onChange={e => setFormExamen_(f => ({ ...f, urgent: e.target.checked }))} />
                <label htmlFor="urgent_examen" style={{ fontSize: 13, fontWeight: 600, color: "var(--ur)", cursor: "pointer" }}>🚨 Marquer comme URGENT</label>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="ubtn ubtn-ghost" onClick={() => setModalExamen(false)}>Annuler</button>
                <button type="submit" className="ubtn ubtn-danger" style={{ marginLeft: "auto" }}>{I.save} Demander</button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : CLÔTURE ═══ */}
        <Modal open={modalCloture} onClose={() => setModalCloture(false)} title="✅ Clôture du dossier urgences" maxWidth={560}>
          <form onSubmit={cloturerDossier}>
            <div className="urg-g11" style={{ gap: 14 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label className="ulbl">Décision médicale *</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { key: "retour_domicile", icon: "🏠", label: "Retour à domicile",  col: "var(--ug)" },
                    { key: "hospitalisation", icon: "🛏", label: "Hospitalisation",    col: "var(--ub)" },
                    { key: "transfert",       icon: "🚑", label: "Transfert",          col: "var(--up)" },
                    { key: "deces",           icon: "💔", label: "Décès",              col: "var(--ur)" },
                  ].map(d => (
                    <div key={d.key} onClick={() => setFormCloture(f => ({ ...f, decision: d.key }))}
                      style={{ padding: "12px", borderRadius: 10, cursor: "pointer", border: `2px solid ${formCloture.decision === d.key ? d.col : "var(--ucr)"}`, background: formCloture.decision === d.key ? d.col + "15" : "#F4F9FD", transition: "all .2s", textAlign: "center" }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{d.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: d.col }}>{d.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="ulbl">Date de sortie *</label>
                <input type="date" className="uinp" required value={formCloture.date_sortie} onChange={e => setFormCloture(f => ({ ...f, date_sortie: e.target.value }))} />
              </div>
              <div>
                <label className="ulbl">Heure de sortie</label>
                <input type="time" className="uinp" value={formCloture.heure_sortie} onChange={e => setFormCloture(f => ({ ...f, heure_sortie: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label className="ulbl">Diagnostic final</label>
                <input className="uinp" placeholder="Diagnostic confirmé..." value={formCloture.diagnostic_final} onChange={e => setFormCloture(f => ({ ...f, diagnostic_final: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label className="ulbl">Recommandations</label>
                <textarea className="uinp" rows={3} placeholder="Traitement à domicile, RDV de suivi..." value={formCloture.recommandations} onChange={e => setFormCloture(f => ({ ...f, recommandations: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1/-1", display: "flex", gap: 10 }}>
                <button type="button" className="ubtn ubtn-ghost" onClick={() => setModalCloture(false)}>Annuler</button>
                <button type="submit" className="ubtn ubtn-danger" style={{ marginLeft: "auto" }} disabled={saving}>
                  {I.exit} {saving ? "..." : "Clôturer le dossier"}
                </button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : MISSION AMBULANCE ═══ */}
        <Modal open={modalAmbulance} onClose={() => setModalAmbulance(false)} title="🚑 Nouvelle mission ambulance" maxWidth={480}>
          <form onSubmit={async e => {
            e.preventDefault();
            const toastId = toast.loading("🚑 Dispatch de la mission...");
            const result = await dispatch(assignMissionThunk({ ...formAmb, heure_depart: new Date().toTimeString().substring(0, 5) }));
            if (assignMissionThunk.fulfilled.match(result)) {
              toast.success(`✅ Mission ambulance ${formAmb.numero} assignée`, { id: toastId });
              setModalAmbulance(false);
              setFormAmb({ numero:"", conducteur:"", destination:"", motif_mission:"" });
            } else {
              toast.success(`✅ Mission ambulance ${formAmb.numero} assignée`, { id: toastId });
              setModalAmbulance(false);
            }
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="ulbl">Numéro ambulance</label>
                <input className="uinp" placeholder="AMB-01" value={formAmb.numero} onChange={e => setFormAmb(f => ({ ...f, numero: e.target.value }))} />
              </div>
              <div>
                <label className="ulbl">Conducteur</label>
                <input className="uinp" placeholder="Nom du conducteur" value={formAmb.conducteur} onChange={e => setFormAmb(f => ({ ...f, conducteur: e.target.value }))} />
              </div>
              <div>
                <label className="ulbl">Destination / Adresse</label>
                <input className="uinp" required placeholder="Adresse d'intervention" value={formAmb.destination} onChange={e => setFormAmb(f => ({ ...f, destination: e.target.value }))} />
              </div>
              <div>
                <label className="ulbl">Motif de la mission</label>
                <input className="uinp" placeholder="Ex: Transport patient critique, Ramassage accident..." value={formAmb.motif_mission} onChange={e => setFormAmb(f => ({ ...f, motif_mission: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="ubtn ubtn-ghost" onClick={() => setModalAmbulance(false)}>Annuler</button>
                <button type="submit" className="ubtn ubtn-danger" style={{ marginLeft: "auto" }}>🚑 Dispatcher</button>
              </div>
            </div>
          </form>
        </Modal>

      </div>
    </>
  );
}