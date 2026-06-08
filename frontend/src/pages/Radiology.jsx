


import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchRadiologyExams,
  selectRadiologyExams, selectRadiologyLoading, selectRadiologyTotal,
} from '../store/slices/radiologySlice';
import api from "../api";
import toast from "react-hot-toast";
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

// ─── Chart.js loader ─────────────────────────────────────────
function loadChartJs(cb) {
  if (window.Chart) { cb(); return; }
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
  s.onload = cb;
  document.head.appendChild(s);
}

// ─── CSS Medical Navy + Teal (identique Chirurgie) ────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.img * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --cn: #0B1E3B; --cn2: #132744; --cb: #1B4F9E;
  --ct: #0EA5A0; --ct2: #0D9490; --cr: #DC2626;
  --co: #D97706; --cg: #059669; --cp: #7C3AED;
  --cbr: #E2EAF4; --cm: #6B7A99; --cl: #EEF4FF; --cs: #F8FAFD;
  --sh: 0 1px 3px rgba(11,30,59,.08); --shm: 0 4px 16px rgba(11,30,59,.10); --shl: 0 12px 40px rgba(11,30,59,.14);
}
/* Topbar */
.img-top { background:linear-gradient(135deg,var(--cn) 0%,var(--cn2) 55%,#1B4F9E 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.img-top::before { content:''; position:absolute; top:-50px; right:-50px; width:200px; height:200px; background:radial-gradient(circle,rgba(14,165,160,.22) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
/* Tabs */
.img-tabs { display:flex; gap:2px; padding:0; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.img-tabs::-webkit-scrollbar { display:none; }
.img-tab { display:flex; align-items:center; gap:7px; padding:10px 18px 12px; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.55); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.img-tab:hover { color:rgba(255,255,255,.88); background:rgba(255,255,255,.08); }
.img-tab.active { color:var(--cn); background:var(--cs); box-shadow:0 -2px 0 var(--ct) inset; }
.img-tab-badge { background:var(--cr); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:99px; animation:imgP 2s infinite; }
@keyframes imgP { 0%,100%{opacity:1} 50%{opacity:.4} }
/* Cards */
.img-card { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; }
.img-card:hover { box-shadow:var(--shm); }
.img-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.img-card-hdr h3 { font-size:14px; font-weight:700; color:var(--cn); margin:0; display:flex; align-items:center; gap:8px; }
.img-card-hdr p  { font-size:11px; color:var(--cm); margin:2px 0 0; }
/* KPI */
.img-kpi { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:pointer; }
.img-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.img-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.img-kpi.blue::before   { background:var(--cb); } .img-kpi.teal::before   { background:var(--ct); }
.img-kpi.red::before    { background:var(--cr); } .img-kpi.orange::before { background:var(--co); }
.img-kpi.green::before  { background:var(--cg); } .img-kpi.purple::before { background:var(--cp); }
.kpi-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
.kpi-icon.blue   { background:#EFF6FF; color:var(--cb); } .kpi-icon.teal   { background:#F0FDFC; color:var(--ct); }
.kpi-icon.red    { background:#FEF2F2; color:var(--cr); } .kpi-icon.orange { background:#FFF7ED; color:var(--co); }
.kpi-icon.green  { background:#ECFDF5; color:var(--cg); } .kpi-icon.purple { background:#F5F3FF; color:var(--cp); }
.kpi-val { font-size:26px; font-weight:800; color:var(--cn); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.kpi-lbl { font-size:11.5px; font-weight:600; color:var(--cm); }
.kpi-sub { font-size:10.5px; color:#9CA3AF; margin-top:2px; }
.kpi-dot { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--cr); animation:imgP 2s infinite; }
/* Badges */
.ibdg { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.ibdg.red    { background:#FEF2F2; color:var(--cr); border:1px solid #FECACA; }
.ibdg.orange { background:#FFF7ED; color:var(--co); border:1px solid #FED7AA; }
.ibdg.yellow { background:#FEFCE8; color:#CA8A04;   border:1px solid #FEF08A; }
.ibdg.green  { background:#ECFDF5; color:var(--cg); border:1px solid #A7F3D0; }
.ibdg.blue   { background:#EFF6FF; color:var(--cb); border:1px solid #BFDBFE; }
.ibdg.teal   { background:#F0FDFC; color:var(--ct); border:1px solid #99F6E4; }
.ibdg.purple { background:#F5F3FF; color:var(--cp); border:1px solid #DDD6FE; }
.ibdg.gray   { background:#F9FAFB; color:#4B5563;   border:1px solid #E5E7EB; }
/* Progress */
.img-prog { background:#EEF4FF; border-radius:99px; height:7px; overflow:hidden; }
.img-prog-f { height:100%; border-radius:99px; transition:width .5s; }
/* Buttons */
.ibtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; text-decoration:none; }
.ibtn-primary { background:var(--cb); color:#fff; } .ibtn-primary:hover { background:#174391; transform:translateY(-1px); }
.ibtn-teal    { background:var(--ct); color:#fff; } .ibtn-teal:hover    { background:var(--ct2); transform:translateY(-1px); }
.ibtn-ghost   { background:transparent; color:var(--cm); border:1.5px solid var(--cbr); }
.ibtn-ghost:hover { background:var(--cl); color:var(--cn); }
.ibtn-danger  { background:#FEF2F2; color:var(--cr); border:1.5px solid #FECACA; }
.ibtn-danger:hover { background:var(--cr); color:#fff; }
.ibtn-sm { padding:6px 12px; font-size:12px; }
.ibtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }
/* Forms */
.ilbl { font-size:12px; font-weight:600; color:var(--cm); margin-bottom:6px; display:block; }
.iinp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--cbr); background:#FAFBFF; font-size:13px; color:var(--cn); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.iinp:focus { border-color:var(--ct); box-shadow:0 0 0 3px rgba(14,165,160,.12); }
/* Section nav */
.sec-nav { display:flex; gap:6px; flex-wrap:wrap; padding:14px 20px; background:linear-gradient(to right,#F8FAFD,#EEF4FF); border-bottom:1.5px solid var(--cbr); }
.sec-btn { display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all .2s; color:var(--cm); background:none; font-family:'Poppins',sans-serif; }
.sec-btn:hover { background:white; color:var(--cn); border-color:var(--cbr); }
.sec-btn.active { background:var(--cn); color:white; border-color:var(--cn); }
/* Alerts */
.al-ia    { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; border-left:4px solid var(--cb); border-radius:14px; padding:14px 18px; }
.al-warn  { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--co); border-radius:14px; padding:14px 18px; }
.al-danger{ background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--cr); border-radius:14px; padding:14px 18px; }
/* Table */
.img-tbl { width:100%; border-collapse:collapse; }
.img-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.img-tbl th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--cm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--cbr); white-space:nowrap; }
.img-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.img-tbl tbody tr:last-child td { border-bottom:none; }
.img-tbl tbody tr:hover { background:#F8FAFF; }
/* Modal */
.mov { position:fixed; inset:0; z-index:500; background:rgba(11,30,59,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.mov-box { background:#fff; border-radius:20px; box-shadow:var(--shl); width:100%; max-width:620px; max-height:90vh; overflow-y:auto; animation:slideUp .25s ease; }
@keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.mov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:#EEF4FF; position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.mov-hdr h3 { font-size:16px; font-weight:700; color:var(--cn); margin:0; display:flex; align-items:center; gap:10px; }
.mov-cls { width:32px; height:32px; border-radius:8px; background:#F3F7FF; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--cm); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.mov-cls:hover { background:#FEF2F2; color:var(--cr); }
.mov-body { padding:24px; }
/* Image viewer */
.img-viewer { background:#0B1E3B; border-radius:14px; overflow:hidden; min-height:200px; display:flex; align-items:center; justify-content:center; position:relative; }
.img-viewer-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:40px; color:rgba(255,255,255,.4); }
/* Priority badge */
.prio-normale   { background:#ECFDF5; color:var(--cg); border:1px solid #A7F3D0; }
.prio-urgente   { background:#FFF7ED; color:var(--co); border:1px solid #FED7AA; }
.prio-tres_urgente { background:#FEF2F2; color:var(--cr); border:1px solid #FECACA; animation:imgP 2s infinite; }
/* Type badge */
.type-echo   { background:#F0FDFC; color:var(--ct); border:1px solid #99F6E4; }
.type-radio  { background:#EFF6FF; color:var(--cb); border:1px solid #BFDBFE; }
.type-scanner{ background:#FFF7ED; color:var(--co); border:1px solid #FED7AA; }
.type-irm    { background:#F5F3FF; color:var(--cp); border:1px solid #DDD6FE; }
/* Upload zone */
.upload-zone { border:2px dashed var(--cbr); border-radius:14px; padding:32px; text-align:center; cursor:pointer; transition:all .2s; background:#FAFBFF; }
.upload-zone:hover { border-color:var(--ct); background:#F0FDFC; }
/* Fade */
@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
.fu { animation:fadeUp .35s ease both; }

/* ─── Responsive ─── */
.img-g2  { display:grid; grid-template-columns:2fr 1fr; gap:20px; }
.img-g11 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.img-g11s{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
@media (max-width:767px) {
  .img-top { padding:12px 14px 0; }
  .img-g2,.img-g11 { grid-template-columns:1fr; gap:14px; }
  .img-g11s { grid-template-columns:1fr 1fr; gap:8px; }
  .iinp { font-size:16px !important; }
  .ibtn { font-size:12px; padding:8px 12px; } .ibtn-sm { font-size:11px; padding:5px 8px; }
  .img-card { border-radius:14px; } .img-card-hdr { padding:11px 14px; }
  .mov { padding:0; align-items:flex-end; } .mov-box { border-radius:20px 20px 0 0; max-width:100%; max-height:93vh; }
  .mov-hdr { padding:13px 16px; } .mov-body { padding:14px; }
}
@media (max-width:479px) {
  .img-top { padding:10px 12px 0; } .img-g11s { grid-template-columns:1fr; }
  .img-card-hdr { flex-wrap:wrap; gap:8px; }
}
`;

// ─── Helpers ─────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const fmtDateInput = (d) => d ? new Date(d).toISOString().substring(0, 10) : "";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
const ageCalc = (dob) => {
  if (!dob) return "—";
  const y = Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 3600 * 1000));
  return `${y} ans`;
};

const STATUT_CFG = {
  programme:  { cls:"blue",   label:"Programmé",   icon:"📅" },
  en_attente: { cls:"orange", label:"En attente",  icon:"⏳" },
  realise:    { cls:"teal",   label:"Réalisé",     icon:"✅" },
  valide:     { cls:"green",  label:"Validé",      icon:"🏅" },
  annule:     { cls:"red",    label:"Annulé",      icon:"❌" },
};

const PRIORITE_CFG = {
  normale:      { cls:"green",  label:"Normale" },
  urgente:      { cls:"orange", label:"Urgente" },
  tres_urgente: { cls:"red",    label:"Très urgente" },
};

const TYPE_EXAMENS = {
  echographie: {
    label: "Échographie", icon: "🔵", color: "#0EA5A0",
    sous_types: ["Échographie abdominale","Échographie pelvienne","Échographie obstétricale","Échographie rénale","Échographie cardiaque","Échographie thyroïdienne"],
  },
  radiologie: {
    label: "Radiologie", icon: "⚪", color: "#1B4F9E",
    sous_types: ["Radio thorax","Radio crâne","Radio bassin","Radio membre supérieur","Radio membre inférieur","Radio colonne vertébrale"],
  },
  scanner: {
    label: "Scanner", icon: "🟠", color: "#D97706",
    sous_types: ["Scanner cérébral","Scanner thoracique","Scanner abdominal","Scanner pelvien"],
  },
  irm: {
    label: "IRM", icon: "🟣", color: "#7C3AED",
    sous_types: ["IRM cérébrale","IRM rachidienne","IRM articulaire","IRM abdominale"],
  },
};

const TARIFS = {
  "Échographie abdominale": 20000, "Échographie pelvienne": 20000, "Échographie obstétricale": 22000,
  "Échographie rénale": 20000, "Échographie cardiaque": 25000, "Échographie thyroïdienne": 20000,
  "Radio thorax": 15000, "Radio crâne": 15000, "Radio bassin": 15000,
  "Radio membre supérieur": 12000, "Radio membre inférieur": 12000, "Radio colonne vertébrale": 18000,
  "Scanner cérébral": 80000, "Scanner thoracique": 85000, "Scanner abdominal": 85000, "Scanner pelvien": 80000,
  "IRM cérébrale": 120000, "IRM rachidienne": 120000, "IRM articulaire": 110000, "IRM abdominale": 120000,
};

// ─── SVG Icons ─────────────────────────────────────────────
const I = {
  scan:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>,
  file:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  clock:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  pulse:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  alert:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  plus:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  save:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  dl:      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  print:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  grid:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  list:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  open:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  link:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  img:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  upload:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  check:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  trend:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  send:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
};

// ─── Modal wrapper ─────────────────────────────────────────
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

// ─── Badge ─────────────────────────────────────────────────
function Badge({ cls, children }) {
  return <span className={`ibdg ${cls}`}>{children}</span>;
}

// ─── KPI Card ──────────────────────────────────────────────
function KpiCard({ color, icon, value, label, sub, urgent, onClick }) {
  return (
    <div className={`img-kpi ${color} fu`} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      {urgent && <div className="kpi-dot" />}
      <div className={`kpi-icon ${color}`}>{icon}</div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-lbl">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// ─── Prog bar ──────────────────────────────────────────────
function Prog({ pct, color }) {
  return (
    <div className="img-prog">
      <div className="img-prog-f" style={{ width:`${pct}%`, background:color }} />
    </div>
  );
}

// ─── Bar Chart ─────────────────────────────────────────────
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
            label: "Examens",
            data,
            backgroundColor: `${color}26`,
            borderColor: color,
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: "#0B1E3B", padding: 10, cornerRadius: 10 },
          },
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

// ─── DEMO DATA ─────────────────────────────────────────────
const DEMO_EXAMENS = [];

const DEMO_MOIS = [];
const DEMO_DATA  = [];

const EMPTY_EXAMEN = {
  patient_id:"", medecin_prescripteur:"", service_demandeur:"", priorite:"normale",
  motif:"", type_categorie:"echographie", type_examen:"", date_rdv:"", heure_rdv:"",
  salle:"", operateur:"", statut:"programme",
};
const EMPTY_CR = {
  date_realisation:"", operateur:"", observations:"", incidents:"",
  conclusion:"", recommandations:"", radiologue:"", date_validation:"",
};
const EMPTY_FACT = { reduction:0, assurance:0 };

// ─── MAIN COMPONENT ────────────────────────────────────────
export default function Imagerie() {
  const dispatch = useDispatch();
  const reduxExamens = useSelector(selectRadiologyExams);
  const reduxTotal = useSelector(selectRadiologyTotal);

  useEffect(() => { dispatch(fetchRadiologyExams({})); }, [dispatch]);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => { const fn = () => setIsMobile(window.innerWidth <= 599); window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn); }, []);

  const [tab, setTab]               = useState("dashboard");
  const [section, setSection]       = useState("demande");
  const [examens, setExamens]       = useState([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState("");
  const [filterStatut, setFilter]   = useState("");
  const [filterType, setFilterType] = useState("");
  const [currentExamen, setCurrent] = useState(null);
  const [patients, setPatients]     = useState([]);
  const [saving, setSaving]         = useState(false);
  const [kpis, setKpis]             = useState({ total:0, programme:0, en_attente:0, realise:0, valide:0, tres_urgents:0 });
  const [chartData, setChartData]   = useState({ labels:DEMO_MOIS, data:DEMO_DATA });

  // Modals
  const [modalNouv, setModalNouv]   = useState(false);
  const [modalCR, setModalCR]       = useState(false);
  const [modalImages, setModalImg]  = useState(false);
  const [modalValid, setModalValid] = useState(false);
  const [modalFact, setModalFact]   = useState(false);

  // Forms
  const [formExamen, setFormExamen] = useState(EMPTY_EXAMEN);
  const [formCR, setFormCR]         = useState(EMPTY_CR);
  const [formValid, setFormValid]   = useState({ radiologue:"", date_validation:"", signature:"" });
  const [formFact, setFormFact]     = useState(EMPTY_FACT);
  const [uploadedImages, setUploaded] = useState([]);

  // ── Load list ─────────────────────────────────────────────
  const loadExamens = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit:15 });
      if (search) p.set("q", search);
      if (filterStatut) p.set("statut", filterStatut);
      if (filterType)   p.set("type_categorie", filterType);
      const { data } = await api.get(`/imagerie?${p}`);
      setExamens(data.examens || data.results || data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Erreur chargement imagerie:", err?.response?.data || err.message);
      toast.error("Erreur chargement des examens");
      setExamens([]);
      setTotal(0);
    } finally { setLoading(false); }
  }, [page, search, filterStatut, filterType]);

  // ── Load stats ────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/imagerie/stats");
      setKpis(data.kpis || kpis);
      if (data.chart) setChartData(data.chart);
    } catch {
      const d = DEMO_EXAMENS;
      setKpis({
        total: d.length,
        programme: d.filter(x=>x.statut==="programme").length,
        en_attente: d.filter(x=>x.statut==="en_attente").length,
        realise: d.filter(x=>x.statut==="realise").length,
        valide: d.filter(x=>x.statut==="valide").length,
        tres_urgents: d.filter(x=>x.priorite==="tres_urgente").length,
      });
    }
  }, []);

  const loadExamen = useCallback(async (id) => {
    try {
      const { data } = await api.get(`/imagerie/${id}`);
      setCurrent(data.examen || data);
    } catch {
      setCurrent(DEMO_EXAMENS.find(x=>x._id===id) || null);
    }
  }, []);

  const loadPatients = useCallback(async () => {
    try {
      const { data } = await api.get("/patients?limit=500");
      setPatients(data.patients || data.data || []);
    } catch {
      setPatients([
        { _id:"p1", prenom:"Jean", nom:"Dupont", numero_dossier:"PAT-001", date_naissance:"1975-04-12" },
        { _id:"p2", prenom:"Marie", nom:"Paul", numero_dossier:"PAT-002", date_naissance:"1988-11-03" },
      ]);
    }
  }, []);

  useEffect(() => { loadExamens(); loadStats(); loadPatients(); }, [loadExamens, loadStats, loadPatients]);
  useRealtimeRefresh(loadExamens);

  const openExamen = (e) => {
    setCurrent(e);
    loadExamen(e._id);
    setSection("demande");
    setTab("examen");
  };

  // ── Create ────────────────────────────────────────────────
  const createExamen = async (ev) => {
    ev.preventDefault();
    setSaving(true);
    try {
      // Enrichir avec patient_nom pour affichage immédiat
      const selectedPatient = patients.find(p => p._id === formExamen.patient_id);
      const payload = {
        ...formExamen,
        patient_nom: selectedPatient ? `${selectedPatient.prenom} ${selectedPatient.nom}`.trim() : "",
        medecin_prescripteur_nom: formExamen.medecin_prescripteur,
      };
      const { data } = await api.post("/imagerie", payload);
      toast.success(`✅ Examen ${data.examen?.numero || data.result?.numero || "créé"} avec succès`);
      setModalNouv(false);
      setFormExamen(EMPTY_EXAMEN);
      loadExamens(); loadStats();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Erreur lors de la création");
    } finally { setSaving(false); }
  };

  // ── Upload images vers le serveur ────────────────────────
  const archiveImages = async () => {
    if (!currentExamen || uploadedImages.length === 0) return;
    setSaving(true);
    try {
      const fd = new FormData();
      uploadedImages.forEach(f => fd.append('images', f));
      const { data } = await api.post(`/imagerie/${currentExamen._id}/images`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCurrent(prev => ({ ...prev, images: data.images || [] }));
      setUploaded([]);
      setModalImg(false);
      toast.success(`✅ ${uploadedImages.length} image(s) archivée(s)`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Erreur lors de l'archivage des images");
    } finally { setSaving(false); }
  };

  // ── Save CR ───────────────────────────────────────────────
  const saveCR = async (ev) => {
    ev.preventDefault();
    if (!currentExamen) return;
    setSaving(true);
    try {
      await api.put(`/imagerie/${currentExamen._id}/cr`, formCR);
      toast.success("✅ Compte rendu enregistré");
      setCurrent(prev => ({ ...prev, ...formCR, statut:"realise" }));
      setModalCR(false);
      loadExamens();
    } catch {
      setCurrent(prev => ({ ...prev, ...formCR, statut:"realise" }));
      toast.success("✅ Compte rendu enregistré (local)");
      setModalCR(false);
    } finally { setSaving(false); }
  };

  // ── Validate ──────────────────────────────────────────────
  const validateExamen = async (ev) => {
    ev.preventDefault();
    if (!currentExamen) return;
    setSaving(true);
    try {
      await api.put(`/imagerie/${currentExamen._id}/validation`, formValid);
      toast.success("🏅 Examen validé par le radiologue");
      setCurrent(prev => ({ ...prev, ...formValid, statut:"valide" }));
      setModalValid(false);
      loadExamens();
    } catch {
      setCurrent(prev => ({ ...prev, ...formValid, statut:"valide" }));
      toast.success("🏅 Examen validé (local)");
      setModalValid(false);
    } finally { setSaving(false); }
  };

  // ── Update champ ──────────────────────────────────────────
  const updateExamen = async (updates) => {
    if (!currentExamen) return;
    setSaving(true);
    try {
      await api.put(`/imagerie/${currentExamen._id}`, { ...currentExamen, ...updates });
      toast.success("✅ Enregistré");
      setCurrent(prev => ({ ...prev, ...updates }));
      loadExamens();
    } catch {
      setCurrent(prev => ({ ...prev, ...updates }));
      toast.success("✅ Enregistré (local)");
    } finally { setSaving(false); }
  };

  const urgents = kpis.tres_urgents || 0;

  // Facturation helpers
  const getPrix = (ex) => TARIFS[ex?.type_examen] || 0;
  const getTotal = (ex) => {
    if (!ex) return 0;
    return Math.max(0, getPrix(ex) - (ex.reduction || 0) - (ex.assurance || 0));
  };

  // ════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      <div className="img">

        {/* ── TOPBAR ── */}
        <div className="img-top">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap", position:"relative", zIndex:2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:54, height:54, borderRadius:14, background:"rgba(255,255,255,.12)", border:"1.5px solid rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {I.scan}
              </div>
              <div>
                <div style={{ fontSize:21, fontWeight:700, color:"#fff", letterSpacing:-.3 }}>Module Imagerie Médicale</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.55)", marginTop:2 }}>{kpis.total} examens · Radiologie / Échographie / Scanner / IRM</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button className="ibtn ibtn-teal" onClick={() => { setFormExamen(EMPTY_EXAMEN); setModalNouv(true); }}>
                {I.plus} Nouvelle demande
              </button>
              {currentExamen && (
                <button className="ibtn ibtn-ghost" style={{ color:"#fff", borderColor:"rgba(255,255,255,.3)" }} onClick={() => window.print()}>
                  {I.print} Imprimer
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          {(() => {
            const TABS = [
              { key:"dashboard", icon:I.grid,  label:"Tableau de bord",  labelM:"Dashboard" },
              { key:"liste",     icon:I.list,  label:"Liste des examens", labelM:"Examens" },
              { key:"examen",    icon:I.file,  label:currentExamen?`${currentExamen.numero}`:"Examen", labelM:"Examen", disabled:!currentExamen },
              { key:"planning",  icon:I.clock, label:"Planning",          labelM:"Planning" },
            ].filter(t=>!t.disabled);
            return (
              <div style={isMobile?{display:'grid',gridTemplateColumns:`repeat(${Math.min(3,TABS.length)},1fr)`,gap:'4px',padding:'8px 10px',marginTop:'8px',background:'rgba(255,255,255,.07)',borderRadius:'10px 10px 0 0'}:{display:'flex',gap:'2px',marginTop:'16px',overflowX:'auto',scrollbarWidth:'none'}}>
                {TABS.map(t=>(
                  <button key={t.key} className={`img-tab ${tab===t.key?"active":""}`} style={isMobile?{flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'7px 3px 8px',fontSize:'9.5px',gap:'3px',borderRadius:'8px',whiteSpace:'normal',minWidth:0}:{}} onClick={()=>setTab(t.key)}>
                    <span style={isMobile?{fontSize:'14px'}:{}}>{t.icon}</span>
                    <span style={isMobile?{lineHeight:1.2}:{}}>{isMobile?t.labelM:t.label}</span>
                    {t.key==="liste"&&urgents>0&&<span className="img-tab-badge">{urgents}</span>}
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
              {urgents > 0 && (
                <div className="al-danger fu" style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, flexWrap:"wrap" }}>
                  <div style={{ width:42, height:42, background:"#FEE2E2", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {I.alert}
                  </div>
                  <div style={{ flex:1 }}>
                    <strong style={{ color:"#B91C1C", fontSize:13 }}>🚨 Examens très urgents en attente</strong>
                    <div style={{ fontSize:12, color:"#DC2626", marginTop:3 }}>
                      <strong>{urgents}</strong> examen(s) marqué(s) très urgent(s) nécessite(nt) une prise en charge immédiate.
                    </div>
                  </div>
                  <button className="ibtn ibtn-danger ibtn-sm" onClick={() => { setFilter("en_attente"); setTab("liste"); }}>Voir urgents →</button>
                </div>
              )}

              {/* KPIs */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="blue"   icon={I.file}  value={kpis.total}      label="Examens total"    sub="tous statuts"              onClick={() => setTab("liste")} />
                <KpiCard color="teal"   icon={I.clock} value={kpis.programme}   label="Programmés"       sub="RDV confirmé"              onClick={() => { setFilter("programme"); setTab("liste"); }} />
                <KpiCard color="orange" icon={I.pulse} value={kpis.en_attente}  label="En attente"       sub="résultats attendus"        onClick={() => { setFilter("en_attente"); setTab("liste"); }} />
                <KpiCard color="green"  icon={I.check} value={kpis.realise}     label="Réalisés"         sub="CR en attente validation"  onClick={() => { setFilter("realise"); setTab("liste"); }} />
                <KpiCard color="purple" icon={I.scan}  value={kpis.valide}      label="Validés"          sub="CR signé radiologue"       onClick={() => { setFilter("valide"); setTab("liste"); }} />
                <KpiCard color={urgents>0?"red":"green"} icon={I.alert} value={urgents} label="Très urgents" sub="intervention rapide" urgent={urgents>0} onClick={() => setTab("liste")} />
              </div>

              {/* Charts + répartition */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"2fr 1fr", gap:20, marginBottom:24 }}>
                <div className="img-card fu">
                  <div className="img-card-hdr">
                    <div><h3>{I.trend} Volume d'examens — 12 mois</h3><p>Activité du service d'imagerie</p></div>
                  </div>
                  <div style={{ padding:20 }}>
                    <BarChart labels={chartData.labels} data={chartData.data} color="#0EA5A0" />
                  </div>
                </div>
                <div className="img-card fu">
                  <div className="img-card-hdr">
                    <div><h3>Répartition par type</h3><p>{kpis.total} examens</p></div>
                  </div>
                  <div style={{ padding:20 }}>
                    {Object.entries(TYPE_EXAMENS).map(([key, cfg]) => {
                      const cnt = (loading ? DEMO_EXAMENS : examens).filter(x=>x.type_categorie===key).length;
                      const pct = kpis.total > 0 ? Math.round(cnt/kpis.total*100) : 0;
                      return (
                        <div key={key} style={{ marginBottom:12 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                            <span style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:"var(--cm)" }}>
                              <span style={{ fontSize:14 }}>{cfg.icon}</span>{cfg.label}
                            </span>
                            <span style={{ fontWeight:700, fontSize:12, color:"var(--cn)" }}>{cnt}</span>
                          </div>
                          <Prog pct={pct} color={cfg.color} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Recent */}
              <div className="img-card fu">
                <div className="img-card-hdr">
                  <div><h3>{I.file} Examens récents</h3><p>Dernières demandes d'imagerie</p></div>
                  <button className="ibtn ibtn-ghost ibtn-sm" onClick={() => setTab("liste")}>Voir tous →</button>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table className="img-tbl">
                    <thead>
                      <tr><th>N° Examen</th><th>Patient</th><th>Type d'examen</th><th>Prescripteur</th><th>Date RDV</th><th>Priorité</th><th>Statut</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {(loading ? DEMO_EXAMENS : examens).slice(0,8).map(e => {
                        const sc = STATUT_CFG[e.statut] || { cls:"gray", label:e.statut };
                        const pc = PRIORITE_CFG[e.priorite] || { cls:"gray", label:e.priorite };
                        const tc = TYPE_EXAMENS[e.type_categorie];
                        return (
                          <tr key={e._id} style={{ background: e.priorite==="tres_urgente" ? "#FFF8F8" : "" }}>
                            <td><span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--cb)", fontSize:12 }}>{e.numero}</span></td>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--cn)" }}>{e.patient_nom}</div>
                              <div style={{ fontSize:11, color:"var(--cm)" }}>{ageCalc(e.patient_dob)}</div>
                            </td>
                            <td>
                              <div style={{ fontSize:12, fontWeight:600, color:"var(--cn)" }}>{e.type_examen}</div>
                              <div style={{ fontSize:11, color:"var(--cm)" }}>{tc?.label || e.type_categorie}</div>
                            </td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{e.medecin_prescripteur_nom || "—"}</td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{fmtDate(e.date_rdv)}{e.heure_rdv && ` ${e.heure_rdv}`}</td>
                            <td><Badge cls={pc.cls}>{pc.label}</Badge></td>
                            <td><Badge cls={sc.cls}>{sc.icon} {sc.label}</Badge></td>
                            <td>
                              <button className="ibtn ibtn-ghost ibtn-sm" style={{ fontSize:11 }} onClick={() => openExamen(e)}>
                                {I.open} Ouvrir
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!loading && examens.length===0 && (
                        <tr><td colSpan={8} style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>Aucun examen enregistré</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ LISTE ══ */}
          {tab === "liste" && (
            <div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>Liste des examens d'imagerie</div>
                  <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>{total} examen(s)</div>
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }}>{I.search}</span>
                    <input className="iinp" style={{ paddingLeft:34, width:200 }} placeholder="Patient, examen..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                  </div>
                  <select className="iinp" style={{ width:160 }} value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
                    <option value="">Tous types</option>
                    {Object.entries(TYPE_EXAMENS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                  <select className="iinp" style={{ width:150 }} value={filterStatut} onChange={e => { setFilter(e.target.value); setPage(1); }}>
                    <option value="">Tous statuts</option>
                    {Object.entries(STATUT_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <button className="ibtn ibtn-primary" onClick={() => { setFormExamen(EMPTY_EXAMEN); setModalNouv(true); }}>
                    {I.plus} Nouvelle demande
                  </button>
                </div>
              </div>

              <div className="img-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="img-tbl" style={{ minWidth:950 }}>
                    <thead>
                      <tr><th>N° Examen</th><th>Patient</th><th>Type</th><th>Examen</th><th>Prescripteur</th><th>Service</th><th>Date RDV</th><th>Priorité</th><th>Statut</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={10} style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>Chargement...</td></tr>
                      ) : examens.length === 0 ? (
                        <tr><td colSpan={10} style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>Aucun examen enregistré</td></tr>
                      ) : examens.map(e => {
                        const sc = STATUT_CFG[e.statut] || { cls:"gray", label:e.statut };
                        const pc = PRIORITE_CFG[e.priorite] || { cls:"gray", label:e.priorite };
                        const tc = TYPE_EXAMENS[e.type_categorie];
                        return (
                          <tr key={e._id} style={{ background: e.priorite==="tres_urgente" ? "#FFF8F8" : "" }}>
                            <td><span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--cb)", fontSize:12 }}>{e.numero}</span></td>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--cn)" }}>{e.patient_nom}</div>
                              <div style={{ fontSize:11, color:"var(--cm)" }}>{ageCalc(e.patient_dob)} · {e.sexe ? e.sexe.charAt(0).toUpperCase()+e.sexe.slice(1) : "—"}</div>
                            </td>
                            <td>
                              <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600, color: tc?.color || "var(--cm)" }}>
                                {tc?.icon} {tc?.label}
                              </span>
                            </td>
                            <td style={{ fontSize:12, color:"var(--cn)", maxWidth:160 }}><div style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{e.type_examen}</div></td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{e.medecin_prescripteur_nom || "—"}</td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{e.service_demandeur || "—"}</td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{fmtDate(e.date_rdv)}{e.heure_rdv && <div style={{fontSize:11}}>{e.heure_rdv}</div>}</td>
                            <td><Badge cls={pc.cls}>{pc.label}</Badge></td>
                            <td><Badge cls={sc.cls}>{sc.icon} {sc.label}</Badge></td>
                            <td>
                              <button className="ibtn ibtn-ghost ibtn-sm" style={{ fontSize:11 }} onClick={() => openExamen(e)}>{I.open} Ouvrir</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {total > 15 && (
                  <div style={{ padding:"12px 20px", borderTop:"1.5px solid var(--cbr)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontSize:12, color:"var(--cm)" }}>Page {page} / {Math.ceil(total/15)} · {total} examens</span>
                    <div style={{ display:"flex", gap:8 }}>
                      {page > 1 && <button className="ibtn ibtn-ghost ibtn-sm" onClick={() => setPage(p=>p-1)}>← Précédent</button>}
                      {page < Math.ceil(total/15) && <button className="ibtn ibtn-primary ibtn-sm" onClick={() => setPage(p=>p+1)}>Suivant →</button>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ PLANNING ══ */}
          {tab === "planning" && (
            <div>
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>Planning des examens</div>
                <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>Vue chronologique des rendez-vous programmés</div>
              </div>
              {["Salle 1 — Échographie","Salle Radiologie","Salle Scanner","Salle IRM"].map(salle => {
                const items = (loading ? DEMO_EXAMENS : examens.length===0 ? DEMO_EXAMENS : examens)
                  .filter(x=>x.salle===salle && ["programme","en_attente"].includes(x.statut));
                return (
                  <div key={salle} className="img-card" style={{ marginBottom:16 }}>
                    <div className="img-card-hdr">
                      <h3>🏥 {salle}</h3>
                      <span style={{ fontSize:12, color:"var(--cm)" }}>{items.length} rendez-vous</span>
                    </div>
                    <div style={{ padding:16 }}>
                      {items.length === 0 ? (
                        <div style={{ padding:20, textAlign:"center", color:"var(--cm)", fontSize:13 }}>Aucun rendez-vous prévu</div>
                      ) : (
                        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                          {items.map(e => {
                            const pc = PRIORITE_CFG[e.priorite] || { cls:"gray", label:e.priorite };
                            return (
                              <div key={e._id} style={{ display:"flex", alignItems:"center", gap:14, background:"#F8FAFD", borderRadius:10, padding:"12px 14px", borderLeft:`3px solid ${e.priorite==="tres_urgente"?"#DC2626":e.priorite==="urgente"?"#D97706":"#059669"}` }}>
                                <div style={{ fontWeight:800, color:"var(--cn)", fontSize:13, minWidth:48 }}>{e.heure_rdv || "—"}</div>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontWeight:600, color:"var(--cn)", fontSize:13 }}>{e.patient_nom}</div>
                                  <div style={{ fontSize:12, color:"var(--cm)" }}>{e.type_examen} · {e.medecin_prescripteur_nom || "—"}</div>
                                </div>
                                <Badge cls={pc.cls}>{pc.label}</Badge>
                                <button className="ibtn ibtn-ghost ibtn-sm" style={{ fontSize:11 }} onClick={() => openExamen(e)}>{I.open}</button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ EXAMEN INDIVIDUEL ══ */}
          {tab === "examen" && currentExamen && (
            <div>
              {/* Header */}
              <div style={{ background:"linear-gradient(135deg,#0B1E3B,#132744)", borderRadius:18, padding:"20px 24px", marginBottom:20, color:"#fff" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                    <div style={{ width:56, height:56, borderRadius:14, background:"rgba(255,255,255,.15)", border:"2px solid rgba(255,255,255,.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0 }}>
                      {TYPE_EXAMENS[currentExamen.type_categorie]?.icon || "🔬"}
                    </div>
                    <div>
                      <div style={{ fontSize:18, fontWeight:700 }}>{currentExamen.patient_nom}</div>
                      <div style={{ fontSize:12, color:"rgba(255,255,255,.65)", marginTop:2 }}>
                        {ageCalc(currentExamen.patient_dob)} · {currentExamen.sexe ? currentExamen.sexe.charAt(0).toUpperCase()+currentExamen.sexe.slice(1) : "—"}
                      </div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:3 }}>📞 {currentExamen.telephone || "—"}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                    <div style={{ background:"rgba(255,255,255,.1)", borderRadius:12, padding:"10px 16px" }}>
                      <div style={{ fontSize:10, color:"rgba(255,255,255,.6)", fontWeight:600, textTransform:"uppercase", marginBottom:4 }}>Type d'examen</div>
                      <div style={{ fontSize:14, fontWeight:700, color:"#fff" }}>{currentExamen.type_examen}</div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.6)", marginTop:2 }}>{TYPE_EXAMENS[currentExamen.type_categorie]?.label}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontFamily:"monospace", fontSize:15, fontWeight:700, color:"rgba(255,255,255,.9)" }}>{currentExamen.numero}</div>
                      <div style={{ marginTop:6 }}>
                        <Badge cls={(STATUT_CFG[currentExamen.statut]||{}).cls||"gray"}>
                          {(STATUT_CFG[currentExamen.statut]||{}).icon} {(STATUT_CFG[currentExamen.statut]||{}).label}
                        </Badge>
                      </div>
                      <div style={{ marginTop:6 }}>
                        <Badge cls={(PRIORITE_CFG[currentExamen.priorite]||{}).cls||"gray"}>
                          {(PRIORITE_CFG[currentExamen.priorite]||{}).label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Alerte très urgente */}
              {currentExamen.priorite === "tres_urgente" && currentExamen.statut !== "valide" && (
                <div className="al-danger" style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
                  {I.alert}
                  <div>
                    <strong style={{ color:"#B91C1C", fontSize:13 }}>🚨 Examen très urgent</strong>
                    <div style={{ fontSize:12, color:"#DC2626", marginTop:3 }}>Cet examen nécessite une réalisation et une lecture prioritaires. Motif : <strong>{currentExamen.motif}</strong></div>
                  </div>
                </div>
              )}

              {/* Section nav */}
              <div className="sec-nav" style={{ borderRadius:"18px 18px 0 0", overflow:"hidden" }}>
                {[
                  { id:"demande",      label:"📋 Demande" },
                  { id:"patient",      label:"👤 Patient" },
                  { id:"planification",label:"📅 Planification" },
                  { id:"realisation",  label:"🔬 Réalisation" },
                  { id:"cr",           label:"📝 Compte rendu" },
                  { id:"images",       label:"🖼 Images" },
                  { id:"validation",   label:"✅ Validation" },
                  { id:"facturation",  label:"💰 Facturation" },
                  { id:"documents",    label:"📄 Documents" },
                ].map(s => (
                  <button key={s.id} className={`sec-btn ${section===s.id?"active":""}`} onClick={() => setSection(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>

              {/* ── DEMANDE ── */}
              {section === "demande" && (
                <div style={{ marginTop:20 }}>
                  <div className="img-card">
                    <div className="img-card-hdr"><h3>📋 Informations de la demande</h3></div>
                    <div style={{ padding:20, display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>
                      <div>
                        <label className="ilbl">Numéro d'examen</label>
                        <div style={{ background:"#F8FAFD", border:"1.5px solid var(--cbr)", borderRadius:10, padding:"9px 13px", fontFamily:"monospace", fontWeight:700, color:"var(--cb)", fontSize:14 }}>{currentExamen.numero}</div>
                      </div>
                      <div>
                        <label className="ilbl">Date de la demande</label>
                        <div style={{ background:"#F8FAFD", border:"1.5px solid var(--cbr)", borderRadius:10, padding:"9px 13px", fontSize:13, color:"var(--cn)" }}>{fmtDate(currentExamen.date_demande)}</div>
                      </div>
                      <div>
                        <label className="ilbl">Médecin prescripteur</label>
                        <input className="iinp" value={currentExamen.medecin_prescripteur || ""} onChange={e => setCurrent(d=>({...d, medecin_prescripteur:e.target.value}))} placeholder="Dr. Nom Prénom" />
                      </div>
                      <div>
                        <label className="ilbl">Service demandeur</label>
                        <select className="iinp" value={currentExamen.service_demandeur || ""} onChange={e => setCurrent(d=>({...d, service_demandeur:e.target.value}))}>
                          <option value="">— Sélectionner —</option>
                          {["Chirurgie","Médecine interne","Gynécologie","Urgences","Pédiatrie","Cardiologie","Neurologie","Orthopédie"].map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="ilbl">Priorité</label>
                        <select className="iinp" value={currentExamen.priorite} onChange={e => setCurrent(d=>({...d, priorite:e.target.value}))}>
                          <option value="normale">🟢 Normale</option>
                          <option value="urgente">🟠 Urgente</option>
                          <option value="tres_urgente">🔴 Très urgente</option>
                        </select>
                      </div>
                      <div>
                        <label className="ilbl">Statut</label>
                        <select className="iinp" value={currentExamen.statut} onChange={e => setCurrent(d=>({...d, statut:e.target.value}))}>
                          {Object.entries(STATUT_CFG).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                        </select>
                      </div>
                      <div style={{ gridColumn:"1/-1" }}>
                        <label className="ilbl">Motif de l'examen *</label>
                        <textarea className="iinp" rows={3} value={currentExamen.motif || ""} onChange={e => setCurrent(d=>({...d, motif:e.target.value}))} placeholder="Indication clinique, contexte..." />
                      </div>
                      <div style={{ gridColumn:"1/-1", background:"#EEF4FF", borderRadius:12, padding:"12px 14px" }}>
                        <div style={{ fontSize:11, fontWeight:700, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>🔗 Liaisons modules</div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                          {[["🩺 Consultation","consultation"],["📁 Dossier patient","patients"],["🔪 Chirurgie","chirurgie"],["💉 Hospitalisation","hospitalisation"],["💰 Facturation","facturation"]].map(([lbl,mod]) => (
                            <span key={mod} style={{ display:"inline-flex", alignItems:"center", gap:5, background:"white", border:"1px solid var(--cbr)", borderRadius:8, padding:"5px 10px", fontSize:11, fontWeight:600, color:"var(--cn)", cursor:"pointer" }}>{lbl}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
                    <button className="ibtn ibtn-teal" disabled={saving} onClick={() => updateExamen({ medecin_prescripteur:currentExamen.medecin_prescripteur, service_demandeur:currentExamen.service_demandeur, priorite:currentExamen.priorite, statut:currentExamen.statut, motif:currentExamen.motif })}>
                      {I.save} {saving?"Enregistrement...":"Enregistrer"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── PATIENT ── */}
              {section === "patient" && (
                <div style={{ marginTop:20 }}>
                  <div className="img-card">
                    <div className="img-card-hdr"><h3>👤 Informations du patient</h3></div>
                    <div style={{ padding:20 }}>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:14 }}>
                        {[
                          ["Nom complet", currentExamen.patient_nom, true],
                          ["Sexe", currentExamen.sexe ? currentExamen.sexe.charAt(0).toUpperCase()+currentExamen.sexe.slice(1) : "—", false],
                          ["Âge", ageCalc(currentExamen.patient_dob), false],
                          ["Téléphone", currentExamen.telephone || "—", false],
                          ["Adresse", currentExamen.adresse || "—", false],
                        ].map(([lbl, val, wide]) => (
                          <div key={lbl} style={{ background:"#F8FAFD", borderRadius:12, padding:"12px 14px", gridColumn: wide ? "1/-1" : undefined }}>
                            <div style={{ fontSize:10, fontWeight:600, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.4 }}>{lbl}</div>
                            <div style={{ fontSize:wide ? 16 : 13, fontWeight:wide ? 700 : 600, color:"var(--cn)", marginTop:4 }}>{val}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop:14, display:"flex", gap:8 }}>
                        <button className="ibtn ibtn-ghost ibtn-sm" style={{ fontSize:11 }}>{I.link} Voir dossier complet</button>
                        <button className="ibtn ibtn-ghost ibtn-sm" style={{ fontSize:11 }}>📋 Historique imagerie</button>
                      </div>
                    </div>
                  </div>
                  {/* Historique */}
                  <div className="img-card" style={{ marginTop:16 }}>
                    <div className="img-card-hdr"><h3>🕐 Historique des examens du patient</h3></div>
                    <div style={{ overflowX:"auto" }}>
                      <table className="img-tbl">
                        <thead><tr><th>N°</th><th>Examen</th><th>Date</th><th>Statut</th><th>Radiologue</th></tr></thead>
                        <tbody>
                          {DEMO_EXAMENS.filter(x=>x.patient_nom===currentExamen.patient_nom).map(x => {
                            const sc = STATUT_CFG[x.statut]||{cls:"gray",label:x.statut};
                            return (
                              <tr key={x._id}>
                                <td style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:"var(--cb)" }}>{x.numero}</td>
                                <td style={{ fontSize:12 }}>{x.type_examen}</td>
                                <td style={{ fontSize:12, color:"var(--cm)" }}>{fmtDate(x.date_realisation||x.date_rdv)}</td>
                                <td><Badge cls={sc.cls}>{sc.label}</Badge></td>
                                <td style={{ fontSize:12, color:"var(--cm)" }}>{x.radiologue||"—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── PLANIFICATION ── */}
              {section === "planification" && (
                <div style={{ marginTop:20 }}>
                  <div className="img-card">
                    <div className="img-card-hdr"><h3>📅 Planification du rendez-vous</h3></div>
                    <div style={{ padding:20, display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>
                      <div>
                        <label className="ilbl">Type d'examen</label>
                        <div style={{ background:"#F8FAFD", border:"1.5px solid var(--cbr)", borderRadius:10, padding:"9px 13px", fontSize:13, fontWeight:600, color:"var(--cn)" }}>
                          {TYPE_EXAMENS[currentExamen.type_categorie]?.icon} {currentExamen.type_examen}
                        </div>
                      </div>
                      <div>
                        <label className="ilbl">Salle d'examen</label>
                        <select className="iinp" value={currentExamen.salle||""} onChange={e => setCurrent(d=>({...d,salle:e.target.value}))}>
                          <option value="">— Sélectionner —</option>
                          <option value="Salle 1 — Échographie">Salle 1 — Échographie</option>
                          <option value="Salle 2 — Échographie">Salle 2 — Échographie</option>
                          <option value="Salle Radiologie">Salle Radiologie</option>
                          <option value="Salle Scanner">Salle Scanner</option>
                          <option value="Salle IRM">Salle IRM</option>
                        </select>
                      </div>
                      <div>
                        <label className="ilbl">Date du rendez-vous</label>
                        <input type="date" className="iinp" value={fmtDateInput(currentExamen.date_rdv)} onChange={e => setCurrent(d=>({...d,date_rdv:e.target.value}))} />
                      </div>
                      <div>
                        <label className="ilbl">Heure</label>
                        <input type="time" className="iinp" value={currentExamen.heure_rdv||""} onChange={e => setCurrent(d=>({...d,heure_rdv:e.target.value}))} />
                      </div>
                      <div style={{ gridColumn:"1/-1" }}>
                        <label className="ilbl">Technicien / Radiologue assigné</label>
                        <input className="iinp" value={currentExamen.operateur||""} onChange={e => setCurrent(d=>({...d,operateur:e.target.value}))} placeholder="Dr. ou Tech. Nom Prénom" />
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
                    <button className="ibtn ibtn-teal" disabled={saving} onClick={() => updateExamen({ salle:currentExamen.salle, date_rdv:currentExamen.date_rdv, heure_rdv:currentExamen.heure_rdv, operateur:currentExamen.operateur, statut:"programme" })}>
                      {I.save} {saving?"...":"Confirmer le rendez-vous"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── RÉALISATION ── */}
              {section === "realisation" && (
                <div style={{ marginTop:20 }}>
                  <div className="img-card">
                    <div className="img-card-hdr"><h3>🔬 Réalisation de l'examen</h3></div>
                    <div style={{ padding:20, display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>
                      <div>
                        <label className="ilbl">Date réelle de réalisation</label>
                        <input type="date" className="iinp" value={fmtDateInput(currentExamen.date_realisation)} onChange={e => setCurrent(d=>({...d,date_realisation:e.target.value}))} />
                      </div>
                      <div>
                        <label className="ilbl">Opérateur</label>
                        <input className="iinp" value={currentExamen.operateur||""} onChange={e => setCurrent(d=>({...d,operateur:e.target.value}))} placeholder="Nom du technicien / radiologue" />
                      </div>
                      <div style={{ gridColumn:"1/-1" }}>
                        <label className="ilbl">Observations techniques</label>
                        <textarea className="iinp" rows={4} value={currentExamen.observations_techniques||""} onChange={e => setCurrent(d=>({...d,observations_techniques:e.target.value}))} placeholder="Conditions de réalisation, qualité de l'image, coopération du patient..." />
                      </div>
                      <div style={{ gridColumn:"1/-1" }}>
                        <label className="ilbl">Incidents éventuels</label>
                        <textarea className="iinp" rows={2} value={currentExamen.incidents||""} onChange={e => setCurrent(d=>({...d,incidents:e.target.value}))} placeholder="Réaction au produit de contraste, difficultés techniques..." />
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
                    <button className="ibtn ibtn-teal" disabled={saving} onClick={() => updateExamen({ date_realisation:currentExamen.date_realisation, operateur:currentExamen.operateur, observations_techniques:currentExamen.observations_techniques, incidents:currentExamen.incidents, statut:"realise" })}>
                      {I.save} {saving?"...":"Valider la réalisation"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── COMPTE RENDU ── */}
              {section === "cr" && (
                <div style={{ marginTop:20 }}>
                  {/* Info header */}
                  <div style={{ background:"linear-gradient(135deg,#EFF6FF,#DBEAFE)", border:"1.5px solid #BFDBFE", borderRadius:14, padding:"14px 18px", marginBottom:16, display:"flex", gap:14, alignItems:"flex-start" }}>
                    <div style={{ fontSize:20 }}>📝</div>
                    <div>
                      <strong style={{ color:"#1E40AF", fontSize:13 }}>Compte rendu — {currentExamen.type_examen}</strong>
                      <div style={{ fontSize:12, color:"#3B82F6", marginTop:3 }}>
                        Patient : <strong>{currentExamen.patient_nom}</strong> · Prescripteur : <strong>{currentExamen.medecin_prescripteur_nom || "—"}</strong>
                        {currentExamen.date_realisation && ` · Réalisé le ${fmtDate(currentExamen.date_realisation)}`}
                      </div>
                    </div>
                    <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
                      <button className="ibtn ibtn-primary ibtn-sm" onClick={() => { setFormCR({ date_realisation:fmtDateInput(currentExamen.date_realisation)||"", operateur:currentExamen.operateur||"", observations:currentExamen.observations||"", incidents:currentExamen.incidents||"", conclusion:currentExamen.conclusion||"", recommandations:currentExamen.recommandations||"", radiologue:currentExamen.radiologue||"", date_validation:"" }); setModalCR(true); }}>
                        ✏️ Rédiger / Modifier
                      </button>
                    </div>
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>
                    <div className="img-card" style={{ gridColumn:"1/-1" }}>
                      <div className="img-card-hdr"><h3>🔭 Observations</h3></div>
                      <div style={{ padding:20 }}>
                        {currentExamen.observations ? (
                          <div style={{ fontSize:13, color:"var(--cn)", lineHeight:1.7, whiteSpace:"pre-wrap" }}>{currentExamen.observations}</div>
                        ) : (
                          <div style={{ textAlign:"center", padding:24, color:"var(--cm)" }}>Aucune observation saisie — Cliquez sur "Rédiger / Modifier"</div>
                        )}
                      </div>
                    </div>
                    <div className="img-card">
                      <div className="img-card-hdr"><h3>🎯 Conclusion</h3></div>
                      <div style={{ padding:20 }}>
                        {currentExamen.conclusion ? (
                          <div style={{ fontSize:13, color:"var(--cn)", lineHeight:1.7 }}>{currentExamen.conclusion}</div>
                        ) : (
                          <div style={{ textAlign:"center", padding:24, color:"var(--cm)", fontSize:13 }}>Conclusion non saisie</div>
                        )}
                      </div>
                    </div>
                    <div className="img-card">
                      <div className="img-card-hdr"><h3>💡 Recommandations</h3></div>
                      <div style={{ padding:20 }}>
                        {currentExamen.recommandations ? (
                          <div style={{ fontSize:13, color:"var(--cn)", lineHeight:1.7 }}>{currentExamen.recommandations}</div>
                        ) : (
                          <div style={{ textAlign:"center", padding:24, color:"var(--cm)", fontSize:13 }}>Recommandations non saisies</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── IMAGES ── */}
              {section === "images" && (
                <div style={{ marginTop:20 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)" }}>Gestion des images médicales</div>
                      <div style={{ fontSize:12, color:"var(--cm)" }}>{(currentExamen.images||[]).length} cliché(s) archivé(s){uploadedImages.length > 0 ? ` · ${uploadedImages.length} en attente d'envoi` : ""}</div>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button className="ibtn ibtn-primary" onClick={() => setModalImg(true)}>{I.upload} Importer images</button>
                      {(currentExamen.images?.length > 0 || uploadedImages.length > 0) && (
                        <button className="ibtn ibtn-ghost">{I.dl} Télécharger tout</button>
                      )}
                    </div>
                  </div>

                  {/* Viewer placeholder */}
                  <div className="img-card" style={{ marginBottom:16 }}>
                    <div className="img-card-hdr"><h3>{I.img} Visionneuse DICOM / Clichés</h3></div>
                    <div style={{ padding:16 }}>
                      <div className="img-viewer" style={{ minHeight:280 }}>
                        {(currentExamen.images?.length > 0 || uploadedImages.length > 0) ? (
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, padding:16, width:"100%" }}>
                            {[
                              ...(currentExamen.images||[]).map(img => ({
                                name: img.filename || img.name,
                                src: img.path,
                                isImage: /\.(jpe?g|png|bmp|tiff?)$/i.test(img.filename || img.path || ''),
                              })),
                              ...uploadedImages.map(f => ({
                                name: f.name,
                                src: URL.createObjectURL(f),
                                isImage: /\.(jpe?g|png|bmp|tiff?)$/i.test(f.name),
                                pending: true,
                              })),
                            ].map((img, i) => (
                              <div key={i} style={{ background:"rgba(255,255,255,.08)", borderRadius:10, overflow:"hidden", cursor:"pointer", border:`1.5px solid ${img.pending ? "rgba(14,165,160,.5)" : "rgba(255,255,255,.15)"}`, transition:"all .2s" }}
                                onMouseOver={e=>e.currentTarget.style.borderColor="rgba(14,165,160,.6)"}
                                onMouseOut={e=>e.currentTarget.style.borderColor=img.pending?"rgba(14,165,160,.5)":"rgba(255,255,255,.15)"}
                                onClick={() => window.open(img.src, '_blank')}
                              >
                                {img.isImage ? (
                                  <img src={img.src} alt={img.name} style={{ width:"100%", height:120, objectFit:"cover" }} />
                                ) : (
                                  <div style={{ height:120, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,.4)", gap:6 }}>
                                    <span style={{ fontSize:36 }}>{/\.pdf$/i.test(img.name) ? "📄" : "🖼"}</span>
                                    <span style={{ fontSize:10 }}>{img.name?.split('.').pop()?.toUpperCase()}</span>
                                  </div>
                                )}
                                <div style={{ padding:"8px 10px", display:"flex", alignItems:"center", gap:4 }}>
                                  {img.pending && <span style={{ fontSize:9, color:"rgba(14,165,160,.9)", fontWeight:700 }}>EN ATTENTE</span>}
                                  <div style={{ fontSize:11, color:"rgba(255,255,255,.7)", fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", flex:1 }}>{img.name || `Cliché ${i+1}`}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="img-viewer-empty">
                            <div style={{ fontSize:48 }}>🖼</div>
                            <div style={{ fontWeight:600, fontSize:14 }}>Aucune image importée</div>
                            <div style={{ fontSize:12 }}>Formats supportés : DICOM, JPEG, PNG, PDF</div>
                            <button className="ibtn ibtn-teal ibtn-sm" style={{ marginTop:8 }} onClick={() => setModalImg(true)}>{I.upload} Importer maintenant</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Archivage info */}
                  <div className="al-ia" style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                    <div style={{ fontSize:20 }}>💾</div>
                    <div>
                      <strong style={{ color:"#1E40AF", fontSize:13 }}>Archivage numérique PACS</strong>
                      <div style={{ fontSize:12, color:"#3B82F6", marginTop:4 }}>
                        Les images sont archivées automatiquement dans le système PACS de la clinique. Durée de conservation : 10 ans. Accessibles depuis n'importe quel poste autorisé.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── VALIDATION ── */}
              {section === "validation" && (
                <div style={{ marginTop:20 }}>
                  <div className="img-card">
                    <div className="img-card-hdr"><h3>✅ Validation médicale du compte rendu</h3></div>
                    <div style={{ padding:20 }}>
                      {currentExamen.statut === "valide" ? (
                        <div style={{ textAlign:"center", padding:32 }}>
                          <div style={{ fontSize:48, marginBottom:12 }}>🏅</div>
                          <div style={{ fontWeight:700, color:"var(--cg)", fontSize:16 }}>Examen validé</div>
                          <div style={{ fontSize:13, color:"var(--cm)", marginTop:6 }}>
                            Par <strong>{currentExamen.radiologue}</strong> · {fmtDate(currentExamen.date_validation)}
                          </div>
                          {currentExamen.signature && (
                            <div style={{ marginTop:12, background:"#ECFDF5", border:"1.5px solid #A7F3D0", borderRadius:10, padding:"10px 16px", display:"inline-block" }}>
                              <div style={{ fontSize:11, color:"var(--cg)", fontWeight:600 }}>Signature électronique</div>
                              <div style={{ fontSize:12, fontFamily:"monospace", color:"var(--cn)", marginTop:4 }}>{currentExamen.signature}</div>
                            </div>
                          )}
                          <div style={{ marginTop:16, display:"flex", gap:10, justifyContent:"center" }}>
                            <button className="ibtn ibtn-ghost" onClick={() => toast.success("📨 Résultats transmis au médecin prescripteur")}>{I.send} Envoyer au médecin</button>
                            <button className="ibtn ibtn-ghost" onClick={() => toast.success("📨 Résultats envoyés au patient")}>{I.send} Envoyer au patient</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ background:"#FFF7ED", border:"1.5px solid #FED7AA", borderRadius:12, padding:"14px 16px", marginBottom:20 }}>
                            <div style={{ fontSize:13, color:"#92400E", fontWeight:600 }}>⏳ En attente de validation par le radiologue</div>
                            <div style={{ fontSize:12, color:"#B45309", marginTop:4 }}>Le compte rendu doit être rédigé avant d'être validé.</div>
                          </div>
                          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
                            <div>
                              <label className="ilbl">Nom du radiologue *</label>
                              <input className="iinp" value={formValid.radiologue} onChange={e => setFormValid(f=>({...f,radiologue:e.target.value}))} placeholder="Dr. Nom Prénom" />
                            </div>
                            <div>
                              <label className="ilbl">Date de validation</label>
                              <input type="date" className="iinp" value={formValid.date_validation} onChange={e => setFormValid(f=>({...f,date_validation:e.target.value}))} />
                            </div>
                            <div style={{ gridColumn:"1/-1" }}>
                              <label className="ilbl">Signature électronique</label>
                              <input className="iinp" value={formValid.signature||""} onChange={e => setFormValid(f=>({...f,signature:e.target.value}))} placeholder="Code de signature (ex: DR-DIALLO-2025)" />
                            </div>
                          </div>
                          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16 }}>
                            <button className="ibtn ibtn-teal" disabled={saving||!formValid.radiologue} onClick={(ev) => validateExamen(ev)}>
                              {I.check} {saving?"Validation...":"Valider et signer le compte rendu"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── FACTURATION ── */}
              {section === "facturation" && (
                <div style={{ marginTop:20 }}>
                  <div className="img-card">
                    <div className="img-card-hdr"><h3>💰 Facturation de l'examen</h3></div>
                    <div style={{ padding:20 }}>
                      <table className="img-tbl" style={{ marginBottom:20 }}>
                        <thead><tr><th>Prestation</th><th style={{textAlign:"right"}}>Prix (CFA)</th></tr></thead>
                        <tbody>
                          <tr>
                            <td style={{ fontWeight:600 }}>{currentExamen.type_examen}</td>
                            <td style={{ textAlign:"right", fontWeight:700 }}>{getPrix(currentExamen).toLocaleString("fr-FR")}</td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr style={{ background:"#F8FAFD" }}>
                            <td style={{ color:"var(--cm)", fontSize:13 }}>Réduction</td>
                            <td style={{ textAlign:"right" }}>
                              <input type="number" className="iinp" style={{ width:120, textAlign:"right", marginLeft:"auto" }} value={currentExamen.reduction||0} min={0} onChange={e => setCurrent(d=>({...d,reduction:Number(e.target.value)}))} />
                            </td>
                          </tr>
                          <tr style={{ background:"#F8FAFD" }}>
                            <td style={{ color:"var(--cm)", fontSize:13 }}>Prise en charge assurance</td>
                            <td style={{ textAlign:"right" }}>
                              <input type="number" className="iinp" style={{ width:120, textAlign:"right", marginLeft:"auto" }} value={currentExamen.assurance||0} min={0} onChange={e => setCurrent(d=>({...d,assurance:Number(e.target.value)}))} />
                            </td>
                          </tr>
                          <tr style={{ background:"linear-gradient(to right,#EEF4FF,#DBEAFE)" }}>
                            <td style={{ fontWeight:800, fontSize:15, color:"var(--cn)" }}>Montant à payer</td>
                            <td style={{ textAlign:"right", fontWeight:800, fontSize:18, color:"var(--cb)" }}>{getTotal(currentExamen).toLocaleString("fr-FR")} CFA</td>
                          </tr>
                        </tfoot>
                      </table>
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                        <button className="ibtn ibtn-teal" disabled={saving} onClick={() => updateExamen({ reduction:currentExamen.reduction, assurance:currentExamen.assurance })}>
                          {I.save} Enregistrer
                        </button>
                        <button className="ibtn ibtn-ghost" onClick={() => toast.success("📄 Facture générée")}>{I.dl} Générer facture</button>
                        <button className="ibtn ibtn-ghost" onClick={() => window.print()}>{I.print} Imprimer</button>
                        <button className="ibtn ibtn-ghost" onClick={() => toast.success("💰 Transmis à la caisse")}>{I.link} Transmettre à la caisse</button>
                      </div>
                    </div>
                  </div>

                  {/* Tarifs de référence */}
                  <div className="img-card" style={{ marginTop:16 }}>
                    <div className="img-card-hdr"><h3>📋 Tarifs de référence</h3></div>
                    <div style={{ overflowX:"auto" }}>
                      <table className="img-tbl">
                        <thead><tr><th>Examen</th><th style={{textAlign:"right"}}>Prix (CFA)</th></tr></thead>
                        <tbody>
                          {Object.entries(TARIFS).map(([ex,prix]) => (
                            <tr key={ex} style={{ background: ex===currentExamen.type_examen ? "#EEF4FF" : "" }}>
                              <td style={{ fontWeight: ex===currentExamen.type_examen ? 700 : 400, color: ex===currentExamen.type_examen ? "var(--cb)" : "var(--cn)" }}>
                                {ex===currentExamen.type_examen && "→ "}{ex}
                              </td>
                              <td style={{ textAlign:"right", fontWeight:600 }}>{prix.toLocaleString("fr-FR")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── DOCUMENTS ── */}
              {section === "documents" && (
                <div style={{ marginTop:20 }}>
                  <div className="img-card">
                    <div className="img-card-hdr"><h3>📄 Documents d'imagerie</h3></div>
                    <div style={{ padding:20, display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:14 }}>
                      {[
                        ["📋","Bon de demande","Demande d'examen signée"],
                        ["📝","Compte rendu","Rapport du radiologue"],
                        ["🖼","Clichés numérisés","Images médicales (PDF/DICOM)"],
                        ["✍️","Consentement","Accord d'irradiation / produit de contraste"],
                        ["💰","Facture","Facture de l'examen"],
                        ["📨","Lettre de transmission","Résultats pour le médecin prescripteur"],
                        ["📱","Résultats patient","Compte rendu simplifié patient"],
                        ["📑","Certificat médical","Attestation d'examen réalisé"],
                      ].map(([icon,title,desc]) => (
                        <div key={title} style={{ background:"#F8FAFD", border:"1.5px solid var(--cbr)", borderRadius:14, padding:16, display:"flex", flexDirection:"column", gap:8, transition:"box-shadow .2s" }}
                          onMouseOver={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(11,30,59,.1)"}
                          onMouseOut={e=>e.currentTarget.style.boxShadow="none"}
                        >
                          <div style={{ fontSize:24 }}>{icon}</div>
                          <div style={{ fontWeight:700, color:"var(--cn)", fontSize:13 }}>{title}</div>
                          <div style={{ fontSize:11, color:"var(--cm)" }}>{desc}</div>
                          <div style={{ display:"flex", gap:6, marginTop:"auto", flexWrap:"wrap" }}>
                            <button className="ibtn ibtn-ghost ibtn-sm" style={{ fontSize:11 }} onClick={() => toast.success(`📄 Génération : ${title}...`)}>{I.dl} Générer</button>
                            {title !== "Clichés numérisés" && (
                              <button className="ibtn ibtn-ghost ibtn-sm" style={{ fontSize:11 }} onClick={() => toast.success(`📨 Envoi : ${title}...`)}>{I.send} Envoyer</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ MODAL : NOUVELLE DEMANDE ═══ */}
        <Modal open={modalNouv} onClose={() => setModalNouv(false)} title={<>{I.plus} Nouvelle demande d'imagerie</>} maxWidth={700}>
          <form onSubmit={createExamen}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="ilbl">Patient *</label>
                <select className="iinp" required value={formExamen.patient_id} onChange={e => setFormExamen(f=>({...f,patient_id:e.target.value}))}>
                  <option value="">— Sélectionner un patient —</option>
                  {patients.map(p => <option key={p._id} value={p._id}>{p.prenom} {p.nom} — {p.numero_dossier}</option>)}
                </select>
              </div>
              <div>
                <label className="ilbl">Médecin prescripteur *</label>
                <input className="iinp" required value={formExamen.medecin_prescripteur} onChange={e => setFormExamen(f=>({...f,medecin_prescripteur:e.target.value}))} placeholder="Dr. Nom Prénom" />
              </div>
              <div>
                <label className="ilbl">Service demandeur</label>
                <select className="iinp" value={formExamen.service_demandeur} onChange={e => setFormExamen(f=>({...f,service_demandeur:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  {["Chirurgie","Médecine interne","Gynécologie","Urgences","Pédiatrie","Cardiologie","Neurologie","Orthopédie"].map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="ilbl">Priorité *</label>
                <select className="iinp" value={formExamen.priorite} onChange={e => setFormExamen(f=>({...f,priorite:e.target.value}))}>
                  <option value="normale">🟢 Normale</option>
                  <option value="urgente">🟠 Urgente</option>
                  <option value="tres_urgente">🔴 Très urgente</option>
                </select>
              </div>
              <div>
                <label className="ilbl">Catégorie d'examen *</label>
                <select className="iinp" value={formExamen.type_categorie} onChange={e => setFormExamen(f=>({...f,type_categorie:e.target.value,type_examen:""}))}>
                  {Object.entries(TYPE_EXAMENS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="ilbl">Type d'examen *</label>
                <select className="iinp" required value={formExamen.type_examen} onChange={e => setFormExamen(f=>({...f,type_examen:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  {TYPE_EXAMENS[formExamen.type_categorie]?.sous_types.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {formExamen.type_examen && (
                <div style={{ gridColumn:"1/-1", background:"#EEF4FF", borderRadius:10, padding:"10px 14px", display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:12, color:"var(--cm)" }}>Tarif de référence</span>
                  <span style={{ fontWeight:700, fontSize:14, color:"var(--cb)" }}>{(TARIFS[formExamen.type_examen]||0).toLocaleString("fr-FR")} CFA</span>
                </div>
              )}
              <div>
                <label className="ilbl">Date du RDV</label>
                <input type="date" className="iinp" value={formExamen.date_rdv} onChange={e => setFormExamen(f=>({...f,date_rdv:e.target.value}))} />
              </div>
              <div>
                <label className="ilbl">Heure</label>
                <input type="time" className="iinp" value={formExamen.heure_rdv} onChange={e => setFormExamen(f=>({...f,heure_rdv:e.target.value}))} />
              </div>
              <div>
                <label className="ilbl">Salle d'examen</label>
                <select className="iinp" value={formExamen.salle||""} onChange={e => setFormExamen(f=>({...f,salle:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  <option value="Salle 1 — Échographie">Salle 1 — Échographie</option>
                  <option value="Salle 2 — Échographie">Salle 2 — Échographie</option>
                  <option value="Salle Radiologie">Salle Radiologie</option>
                  <option value="Salle Scanner">Salle Scanner</option>
                  <option value="Salle IRM">Salle IRM</option>
                </select>
              </div>
              <div>
                <label className="ilbl">Opérateur / Radiologue</label>
                <input className="iinp" value={formExamen.operateur||""} onChange={e => setFormExamen(f=>({...f,operateur:e.target.value}))} placeholder="Dr. ou Tech. assigné" />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="ilbl">Motif de l'examen *</label>
                <textarea className="iinp" rows={3} required value={formExamen.motif} onChange={e => setFormExamen(f=>({...f,motif:e.target.value}))} placeholder="Indication clinique, contexte de la demande..." />
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button type="button" className="ibtn ibtn-ghost" onClick={() => setModalNouv(false)}>Annuler</button>
              <button type="submit" className="ibtn ibtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>
                {I.save} {saving?"Création...":"Créer la demande"}
              </button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : COMPTE RENDU ═══ */}
        <Modal open={modalCR} onClose={() => setModalCR(false)} title="📝 Rédiger le compte rendu" maxWidth={660}>
          <form onSubmit={saveCR}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                <div>
                  <label className="ilbl">Date de réalisation</label>
                  <input type="date" className="iinp" value={formCR.date_realisation} onChange={e => setFormCR(f=>({...f,date_realisation:e.target.value}))} />
                </div>
                <div>
                  <label className="ilbl">Opérateur</label>
                  <input className="iinp" value={formCR.operateur} onChange={e => setFormCR(f=>({...f,operateur:e.target.value}))} placeholder="Dr. / Tech. Nom Prénom" />
                </div>
              </div>
              <div>
                <label className="ilbl">Observations *</label>
                <textarea className="iinp" rows={5} required value={formCR.observations} onChange={e => setFormCR(f=>({...f,observations:e.target.value}))} placeholder="Description détaillée des images, structures observées, anomalies éventuelles..." />
              </div>
              <div>
                <label className="ilbl">Incidents techniques</label>
                <input className="iinp" value={formCR.incidents} onChange={e => setFormCR(f=>({...f,incidents:e.target.value}))} placeholder="Artefacts, limitations, réactions..." />
              </div>
              <div>
                <label className="ilbl">Conclusion / Diagnostic *</label>
                <textarea className="iinp" rows={3} required value={formCR.conclusion} onChange={e => setFormCR(f=>({...f,conclusion:e.target.value}))} placeholder="Diagnostic radiologique, conclusion principale..." />
              </div>
              <div>
                <label className="ilbl">Recommandations</label>
                <textarea className="iinp" rows={2} value={formCR.recommandations} onChange={e => setFormCR(f=>({...f,recommandations:e.target.value}))} placeholder="Examens complémentaires, suivi, corrélation clinique..." />
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="ibtn ibtn-ghost" onClick={() => setModalCR(false)}>Annuler</button>
                <button type="submit" className="ibtn ibtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>
                  {I.save} {saving?"Enregistrement...":"Enregistrer le compte rendu"}
                </button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : IMPORT IMAGES ═══ */}
        <Modal open={modalImages} onClose={() => setModalImg(false)} title={<>{I.upload} Importer des images médicales</>} maxWidth={500}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div className="upload-zone" onClick={() => document.getElementById("img-upload-input").click()}>
              <div style={{ fontSize:40, marginBottom:12 }}>🖼</div>
              <div style={{ fontWeight:700, color:"var(--cn)", fontSize:14 }}>Cliquez pour sélectionner des fichiers</div>
              <div style={{ fontSize:12, color:"var(--cm)", marginTop:6 }}>DICOM (.dcm), JPEG, PNG, PDF · Taille max 50 Mo</div>
              <input id="img-upload-input" type="file" multiple accept=".dcm,.jpg,.jpeg,.png,.pdf" style={{ display:"none" }}
                onChange={e => {
                  const files = Array.from(e.target.files);
                  setUploaded(prev => [...prev, ...files]);
                  toast.success(`✅ ${files.length} image(s) importée(s)`);
                  setModalImg(false);
                }}
              />
            </div>
            {uploadedImages.length > 0 && (
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:"var(--cm)", marginBottom:8 }}>Images importées</div>
                {uploadedImages.map((f,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"#F8FAFD", borderRadius:8, marginBottom:6 }}>
                    <span style={{ fontSize:16 }}>📄</span>
                    <span style={{ flex:1, fontSize:12, color:"var(--cn)" }}>{f.name}</span>
                    <span style={{ fontSize:11, color:"var(--cm)" }}>{(f.size/1024).toFixed(0)} Ko</span>
                    <button style={{ background:"none", border:"none", cursor:"pointer", color:"var(--cr)", fontSize:16 }} onClick={() => setUploaded(prev => prev.filter((_,j)=>j!==i))}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:"flex", gap:10 }}>
              <button className="ibtn ibtn-ghost" onClick={() => setModalImg(false)}>Fermer</button>
              {uploadedImages.length > 0 && (
                <button className="ibtn ibtn-teal" style={{ marginLeft:"auto" }} disabled={saving} onClick={archiveImages}>
                  {I.save} {saving ? "Envoi..." : `Archiver (${uploadedImages.length})`}
                </button>
              )}
            </div>
          </div>
        </Modal>

      </div>
    </>
  );
}