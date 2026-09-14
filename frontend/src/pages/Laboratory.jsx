import { useState, useEffect, useCallback, useMemo, useRef, useId } from "react";
import { useNavigate } from 'react-router-dom';
import api from "../api";
import toast from "react-hot-toast";
import { FlaskConical, Plus, Printer } from 'lucide-react';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { useAuthSafe } from '../contexts/AuthContext';
import Hero from '../components/UI/Hero';
import Button from '../components/UI/Button';
import { REF_VALUES, deriveCriticalPayload } from '../utils/labResultats';

// ─── Chart.js loader ─────────────────────────────────────────
function loadChartJs(cb) {
  if (window.Chart) { cb(); return; }
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
  s.onload = cb;
  document.head.appendChild(s);
}

// ─── CSS Medical Navy + Teal ──────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.lab * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --ln: #0B1E3B; --ln2: #132744; --lb: #1B4F9E;
  --lt: #0EA5A0; --lt2: #0D9490; --lr: #DC2626;
  --lo: #D97706; --lg: #059669; --lp: #7C3AED;
  --lbr: #E2EAF4; --lm: #6B7A99; --ll: #EEF4FF; --ls: #F8FAFD;
  --sh: 0 1px 3px rgba(11,30,59,.08); --shm: 0 4px 16px rgba(11,30,59,.10); --shl: 0 12px 40px rgba(11,30,59,.14);
}

/* Topbar */
.lab-top { background:linear-gradient(135deg,var(--ln) 0%,var(--ln2) 55%,#1B4F9E 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.lab-top::before { content:''; position:absolute; top:-50px; right:-50px; width:200px; height:200px; background:radial-gradient(circle,rgba(14,165,160,.22) 0%,transparent 70%); border-radius:50%; pointer-events:none; }

/* Tabs */
.lab-tabs { display:flex; gap:2px; padding:0; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.lab-tabs::-webkit-scrollbar { display:none; }
.lab-tab { display:flex; align-items:center; gap:7px; padding:10px 18px 12px; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.55); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.lab-tab:hover { color:rgba(255,255,255,.88); background:rgba(255,255,255,.08); }
.lab-tab.active { color:var(--ln); background:var(--ls); box-shadow:0 -2px 0 var(--lt) inset; }
.lab-tab-badge { background:var(--lr); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:99px; animation:labP 2s infinite; }
@keyframes labP { 0%,100%{opacity:1} 50%{opacity:.4} }

/* Cards */
.lab-card { background:#fff; border:1.5px solid var(--lbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; }
.lab-card:hover { box-shadow:var(--shm); }
.lab-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--lbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.lab-card-hdr h3 { font-size:14px; font-weight:700; color:var(--ln); margin:0; display:flex; align-items:center; gap:8px; }
.lab-card-hdr p  { font-size:11px; color:var(--lm); margin:2px 0 0; }

/* KPI */
.lab-kpi { background:#fff; border:1.5px solid var(--lbr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:pointer; }
.lab-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.lab-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.lab-kpi.blue::before   { background:var(--lb); } .lab-kpi.teal::before   { background:var(--lt); }
.lab-kpi.red::before    { background:var(--lr); } .lab-kpi.orange::before { background:var(--lo); }
.lab-kpi.green::before  { background:var(--lg); } .lab-kpi.purple::before { background:var(--lp); }
.kpi-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
.kpi-icon.blue   { background:#EFF6FF; color:var(--lb); } .kpi-icon.teal   { background:#F0FDFC; color:var(--lt); }
.kpi-icon.red    { background:#FEF2F2; color:var(--lr); } .kpi-icon.orange { background:#FFF7ED; color:var(--lo); }
.kpi-icon.green  { background:#ECFDF5; color:var(--lg); } .kpi-icon.purple { background:#F5F3FF; color:var(--lp); }
.kpi-val { font-size:26px; font-weight:800; color:var(--ln); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.kpi-lbl { font-size:11.5px; font-weight:600; color:var(--lm); }
.kpi-sub { font-size:10.5px; color:#9CA3AF; margin-top:2px; }
.kpi-dot { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--lr); animation:labP 2s infinite; }

/* Badges */
.lbdg { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.lbdg.red    { background:#FEF2F2; color:var(--lr); border:1px solid #FECACA; }
.lbdg.orange { background:#FFF7ED; color:var(--lo); border:1px solid #FED7AA; }
.lbdg.yellow { background:#FEFCE8; color:#CA8A04;   border:1px solid #FEF08A; }
.lbdg.green  { background:#ECFDF5; color:var(--lg); border:1px solid #A7F3D0; }
.lbdg.blue   { background:#EFF6FF; color:var(--lb); border:1px solid #BFDBFE; }
.lbdg.teal   { background:#F0FDFC; color:var(--lt); border:1px solid #99F6E4; }
.lbdg.purple { background:#F5F3FF; color:var(--lp); border:1px solid #DDD6FE; }
.lbdg.gray   { background:#F9FAFB; color:#4B5563;   border:1px solid #E5E7EB; }
.lbdg.critical { background:#FEF2F2; color:var(--lr); border:1px solid #FECACA; animation:labP 1.5s infinite; font-weight:800; }

/* Progress */
.lab-prog { background:#EEF4FF; border-radius:99px; height:7px; overflow:hidden; }
.lab-prog-f { height:100%; border-radius:99px; transition:width .5s; }

/* Buttons */
.lbtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; text-decoration:none; }
.lbtn-primary { background:var(--lb); color:#fff; } .lbtn-primary:hover { background:#174391; transform:translateY(-1px); }
.lbtn-teal    { background:var(--lt); color:#fff; } .lbtn-teal:hover    { background:var(--lt2); transform:translateY(-1px); }
.lbtn-green   { background:var(--lg); color:#fff; } .lbtn-green:hover   { background:#047857; transform:translateY(-1px); }
.lbtn-ghost   { background:transparent; color:var(--lm); border:1.5px solid var(--lbr); }
.lbtn-ghost:hover { background:var(--ll); color:var(--ln); }
.lbtn-danger  { background:#FEF2F2; color:var(--lr); border:1.5px solid #FECACA; }
.lbtn-danger:hover { background:var(--lr); color:#fff; }
.lbtn-sm { padding:6px 12px; font-size:12px; }
.lbtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }

/* Forms */
.llbl { font-size:12px; font-weight:600; color:var(--lm); margin-bottom:6px; display:block; }
.linp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--lbr); background:#FAFBFF; font-size:13px; color:var(--ln); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.linp:focus { border-color:var(--lt); box-shadow:0 0 0 3px rgba(14,165,160,.12); }

/* Section nav */
.sec-nav { display:flex; gap:6px; flex-wrap:wrap; padding:14px 20px; background:linear-gradient(to right,#F8FAFD,#EEF4FF); border-bottom:1.5px solid var(--lbr); }
.sec-btn { display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all .2s; color:var(--lm); background:none; font-family:'Poppins',sans-serif; }
.sec-btn:hover { background:white; color:var(--ln); border-color:var(--lbr); }
.sec-btn.active { background:var(--ln); color:white; border-color:var(--ln); }
.sec-btn.warn { border-color:#FECACA; color:var(--lr); }

/* Alerts */
.al-ia   { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; border-left:4px solid var(--lb); border-radius:14px; padding:14px 18px; }
.al-warn { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--lo); border-radius:14px; padding:14px 18px; }
.al-danger { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--lr); border-radius:14px; padding:14px 18px; }
.al-success { background:linear-gradient(135deg,#ECFDF5,#D1FAE5); border:1.5px solid #A7F3D0; border-left:4px solid var(--lg); border-radius:14px; padding:14px 18px; }

/* Table */
.lab-tbl { width:100%; border-collapse:collapse; }
.lab-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.lab-tbl th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--lm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--lbr); white-space:nowrap; }
.lab-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.lab-tbl tbody tr:last-child td { border-bottom:none; }
.lab-tbl tbody tr:hover { background:#F8FAFF; }

/* Result table */
.res-tbl { width:100%; border-collapse:collapse; }
.res-tbl th { padding:9px 12px; text-align:left; font-size:11px; font-weight:700; color:var(--lm); text-transform:uppercase; letter-spacing:.5px; border-bottom:2px solid var(--lbr); background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.res-tbl td { padding:10px 12px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.res-tbl tr.anormal td { background:#FEF2F2; }
.res-tbl tr.critique td { background:#FFF0F0; border-left:3px solid var(--lr); animation:labP 2s infinite; }
.res-tbl tr.normal td { background:#fff; }

/* Checkbox group */
.chk-group { display:flex; flex-direction:column; gap:6px; }
.chk-item { display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:8px; cursor:pointer; transition:background .15s; }
.chk-item:hover { background:#F0F9FF; }
.chk-item input[type=checkbox] { width:15px; height:15px; accent-color:var(--lt); cursor:pointer; }
.chk-item label { font-size:12.5px; color:var(--ln); cursor:pointer; font-weight:500; }

/* Modal */
.mov { position:fixed; inset:0; z-index:500; background:rgba(11,30,59,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.mov-box { background:#fff; border-radius:20px; box-shadow:var(--shl); width:100%; max-width:700px; max-height:92vh; overflow-y:auto; animation:slideUp .25s ease; }
@keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.mov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--lbr); display:flex; align-items:center; justify-content:space-between; background:#EEF4FF; position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.mov-hdr h3 { font-size:16px; font-weight:700; color:var(--ln); margin:0; display:flex; align-items:center; gap:10px; }
.mov-cls { width:32px; height:32px; border-radius:8px; background:#F3F7FF; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--lm); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.mov-cls:hover { background:#FEF2F2; color:var(--lr); }
.mov-body { padding:24px; }

/* Status pill */
.stat-pill { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:99px; font-size:11.5px; font-weight:700; }

/* Fade */
@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
.fu { animation:fadeUp .35s ease both; }

/* Quick actions */
.qa-btn { display:flex; flex-direction:column; align-items:center; gap:6px; padding:14px 10px; border-radius:14px; cursor:pointer; border:1.5px solid var(--lbr); background:#fff; transition:all .2s; font-family:'Poppins',sans-serif; min-width:90px; }
.qa-btn:hover { border-color:var(--lt); background:#F0FDFC; transform:translateY(-2px); box-shadow:var(--shm); }
.qa-btn span { font-size:11px; font-weight:600; color:var(--lm); text-align:center; line-height:1.3; }
.qa-btn .qa-icon { width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:18px; }

/* Category section */
.cat-hdr { font-size:11px; font-weight:800; color:var(--lm); text-transform:uppercase; letter-spacing:.8px; padding:8px 4px 4px; display:flex; align-items:center; gap:6px; }
.cat-hdr::after { content:''; flex:1; height:1px; background:var(--lbr); }

/* ─── Responsive ─── */
.lab-g2  { display:grid; grid-template-columns:2fr 1fr; gap:20px; }
.lab-g11 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.lab-g11s{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
@media (max-width:767px) {
  .lab-top { padding:12px 14px 0; }
  .lab-g2,.lab-g11 { grid-template-columns:1fr; gap:14px; }
  .lab-g11s { grid-template-columns:1fr 1fr; gap:8px; }
  .linp { font-size:16px !important; }
  .lbtn { font-size:12px; padding:8px 12px; } .lbtn-sm { font-size:11px; padding:5px 8px; }
  .lab-card { border-radius:14px; } .lab-card-hdr { padding:11px 14px; }
  .mov { padding:0; align-items:flex-end; } .mov-box { border-radius:20px 20px 0 0; max-width:100%; max-height:93vh; }
  .mov-hdr { padding:13px 16px; } .mov-body { padding:14px; }
}
@media (max-width:479px) {
  .lab-top { padding:10px 12px 0; } .lab-g11s { grid-template-columns:1fr; }
  .lab-card-hdr { flex-wrap:wrap; gap:8px; }
}
`;

// ─── Helpers ─────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
const fmtDateInput = (d) => d ? new Date(d).toISOString().substring(0, 10) : "";
// LAB-03 — nom réel d'un User peuplé (technicien/validateur/authUser),
// jamais un champ texte libre fabriqué côté client.
const fmtUser = (u) => (u && (u.prenom || u.nom)) ? `${u.prenom || ""} ${u.nom || ""}`.trim() : null;
const ageCalc = (dob) => {
  if (!dob) return "—";
  const y = Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 3600 * 1000));
  return `${y} ans`;
};

const STATUT_CFG = {
  prescrit:           { cls: "orange", label: "En attente",           icon: "⏳" },
  en_attente:         { cls: "orange", label: "En attente",           icon: "⏳" },
  preleve:            { cls: "blue",   label: "Échantillon prélevé",  icon: "🩺" },
  en_cours:           { cls: "purple", label: "En cours d'analyse",   icon: "🔬" },
  termine:            { cls: "teal",   label: "Terminé",              icon: "✅" },
  valide:             { cls: "green",  label: "Validé",               icon: "🏷️" },
  annule:             { cls: "gray",   label: "Annulé",               icon: "❌" },
};

const RESULTATS_CFG = {
  normal:   { cls: "green",  label: "Normal" },
  anormal:  { cls: "orange", label: "Anormal" },
  critique: { cls: "red",    label: "⚡ Critique" },
};

// ─── SVG Icons ────────────────────────────────────────────────
const I = {
  microscope: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/></svg>,
  flask:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6l1 9H8z"/><path d="M8 12c0 3.3 2.7 6 6 6s6-2.7 6-6"/><path d="M6 12H2"/></svg>,
  file:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  chart:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  clock:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  alert:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  check:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  plus:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  save:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  trend:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  grid:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  list:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  open:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  dl:      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  print:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  send:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  user:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  droplet: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>,
  link:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  star:    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
};

// ─── Modal wrapper ───────────────────────────────────────────
function Modal({ open, onClose, title, children, maxWidth = 700 }) {
  const boxRef = useRef(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    if (open) boxRef.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="mov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className="mov-box" style={{ maxWidth }} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="mov-hdr">
          <h3 id={titleId}>{title}</h3>
          <button className="mov-cls" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="mov-body">{children}</div>
      </div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────
function KpiCard({ color, icon, value, label, sub, urgent, onClick }) {
  return (
    <div className={`lab-kpi ${color} fu`} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      {urgent && <div className="kpi-dot" />}
      <div className={`kpi-icon ${color}`}>{icon}</div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-lbl">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// ─── Badge ──────────────────────────────────────────────────
function Badge({ cls, children }) {
  return <span className={`lbdg ${cls}`}>{children}</span>;
}

// ─── Progress bar ───────────────────────────────────────────
function Prog({ pct, color }) {
  return (
    <div className="lab-prog">
      <div className="lab-prog-f" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ─── Bar Chart ───────────────────────────────────────────────
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
            label: "Analyses",
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

// Correction 1 (relecture du 6 sept. 2026) — EXAM_CATALOGUE codé en dur
// supprimé : remplacé partout par le vrai catalogue chargé depuis
// GET /laboratory/catalogue (état `catalogue`, ci-dessous dans le
// composant) — voir catalogueById/examLabel/examPrix/examRef/examUnite.

// REF_VALUES et deriveCriticalPayload importés de ../utils/labResultats —
// extraits pour être réellement testables côté backend (voir
// auditP6-1CriticalNotificationE2E.test.js), au lieu de rester une logique
// purement locale à cette page qu'aucun test ne pouvait exercer.

// ─── DEMO DATA ───────────────────────────────────────────────
const DEMO_ANALYSES = [];

// Sous-phase 5.1 (relecture du 6 sept. 2026) — l'onglet Statistiques
// affichait un graphique 12 mois toujours vide (DEMO_MOIS/DEMO_VOLUMES),
// une liste "examens les plus prescrits" et un "délai moyen de rendu" tous
// deux codés en dur, sans rapport avec les analyses réellement chargées.
// Remplacés par de vraies agrégations sur `analyses` (déjà chargées) et
// `catalogue` (GET /laboratory/catalogue, déjà réel).
const PALETTE_5_1 = ["#1B4F9E","#0EA5A0","#D97706","#7C3AED","#059669","#DC2626"];

const buildAnalysesParMois = (analyses) => {
  const now = new Date();
  const labels = [], data = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleString('fr-FR', { month: 'short' }));
    const count = analyses.filter(a => {
      const ad = new Date(a.date_prescription || a.date_demande);
      return ad.getFullYear() === d.getFullYear() && ad.getMonth() === d.getMonth();
    }).length;
    data.push(count);
  }
  return { labels, data };
};

// Résout un ObjectId d'examen vers son nom réel au catalogue — jamais un
// libellé fabriqué ; un ID non résolu (catalogue non chargé, id local
// hérité d'un ancien format) est simplement exclu de l'agrégation.
const resolveExamenNom = (id, catalogue) => {
  if (!id) return null;
  const found = catalogue.find(c => c._id === String(id));
  return found ? found.nom : null;
};

const buildExamensPlusPrescrits = (analyses, catalogue) => {
  const counts = {};
  let total = 0;
  analyses.forEach(a => {
    (a.examens_demandes || []).forEach(id => {
      const nom = resolveExamenNom(id, catalogue);
      if (!nom) return;
      counts[nom] = (counts[nom] || 0) + 1;
      total += 1;
    });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([nom, n], i) => [nom, total ? Math.round((n / total) * 100) : 0, PALETTE_5_1[i % PALETTE_5_1.length]]);
};

const formatDelaiMs = (ms) => {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  if (h <= 0) return `${m}min`;
  return m > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${h}h00`;
};

// Délai réel = date_resultat - date_prescription (saisirResultats() pose
// date_resultat au moment où le résultat est réellement rendu). Exclut les
// analyses encore en attente (aucune des deux dates fabriquée si absente).
const buildDelaisMoyens = (analyses, catalogue) => {
  const groups = {};
  let globalSumMs = 0, globalCount = 0;
  analyses.forEach(a => {
    if (!a.date_resultat || !a.date_prescription) return;
    const delayMs = new Date(a.date_resultat) - new Date(a.date_prescription);
    if (!(delayMs > 0)) return;
    globalSumMs += delayMs; globalCount += 1;
    const nom = resolveExamenNom(a.examen, catalogue);
    if (!nom) return;
    if (!groups[nom]) groups[nom] = { sum: 0, count: 0 };
    groups[nom].sum += delayMs; groups[nom].count += 1;
  });
  const rows = Object.entries(groups)
    .map(([nom, { sum, count }], i) => [nom, formatDelaiMs(sum / count), PALETTE_5_1[i % PALETTE_5_1.length]])
    .sort((a, b) => a[0].localeCompare(b[0]));
  return { rows, globalLabel: globalCount ? formatDelaiMs(globalSumMs / globalCount) : null };
};

// Garantit que `resultats` est toujours un tableau, quel que soit le type retourné par l'API
const asArr = v => (Array.isArray(v) ? v : []);

const EMPTY_FORM = {
  patient_id: "", patient_nom: "", patient_dossier: "", date_naissance: "", sexe: "", telephone: "",
  service_demandeur: "", medecin_prescripteur: "",
  examens_demandes: [],
  type_echantillon: "sang", preleveur: "", observations_prelevement: "",
  autres_examens: "",
  niveau_urgence: "normal",
  consultation: "",
};

// LAB-03 — technicien/biologiste retirés : c'étaient des champs texte
// libre requis dans le formulaire mais jamais persistés (technicien est
// un ObjectId ref User côté schéma, biologiste n'existait pas du tout).
// L'identité réelle est désormais dérivée côté serveur (voir
// saisirResultats/validate dans laboratory.controller.js) et affichée
// depuis authUser / currentAnalyse.technicien / currentAnalyse.validateur.
const EMPTY_RESULTAT_FORM = {
  commentaire_biologiste: "", est_critique_confirme: false,
};

// ─── MAIN COMPONENT ──────────────────────────────────────────
export default function Laboratoire() {
  const navigate = useNavigate();
  // LAB-03 — identité réelle de l'utilisateur connecté, affichée à la
  // place des anciens champs "Technicien"/"Biologiste" en texte libre
  // requis mais jamais persistés (voir validerAnalyse plus bas).
  // LAB-HOOKS-001 (audit métier du 13 sept. 2026, Phase 4) — useAuth()
  // était appelé dans un try/catch pour tolérer un rendu isolé sans
  // <AuthProvider>, en violation de react-hooks/rules-of-hooks. useAuthSafe
  // (contexts/AuthContext.jsx) appelle le hook natif sans jamais le
  // conditionner, et renvoie null en l'absence de provider au lieu de lever.
  const authData = useAuthSafe();
  const authUser = authData?.user || null;
  // NEW-006 (rapport de correction du 11 sept. 2026) — dispatch(fetchLabResults({}))
  // + dispatch(fetchCriticalResults()) dupliquaient à chaque montage la
  // même requête que loadAnalyses() (api.get direct, plus bas), sans que
  // reduxAnalyses/reduxCritical/reduxTotal ne soient jamais lus nulle
  // part — vérifié par recherche projet-wide, aucun autre fichier ne
  // consomme fetchLabResults/fetchCriticalResults/selectLabResults/
  // selectCriticalLabResults/selectLabLoading/selectLabTotal.
  // useRealtimeRefresh(loadAnalyses), plus bas, rafraîchit déjà
  // correctement la vraie source — les deux dispatches Redux orphelins
  // sont simplement retirés.

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => { const fn = () => setIsMobile(window.innerWidth <= 599); window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn); }, []);

  const [tab, setTab]             = useState("dashboard");
  const [section, setSection]     = useState("patient");
  const [analyses, setAnalyses]   = useState([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState("");
  const [filterStatut, setFilter] = useState("");
  const [currentAnalyse, setCurrentAnalyse] = useState(null);
  // Correction 5 (relecture du 5 sept. 2026) — vraie facture liée à cette
  // analyse (laboratory.controller.js::validate, créée depuis le vrai
  // catalogue ExamCatalogue), jamais un recalcul côté client. null tant que
  // l'analyse n'est pas validée ou n'a donné lieu à aucune facture réelle.
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [kpis, setKpis]           = useState({ total: 0, en_attente: 0, en_cours: 0, termines: 0, valides: 0, critiques: 0 });

  // Modals
  const [modalNouv,    setModalNouv]    = useState(false);
  const [modalPrelevement, setModalPrelevement] = useState(false);
  const [modalResultats,   setModalResultats]   = useState(false);
  const [modalValider,     setModalValider]      = useState(false);

  // Forms
  const [formNouv,  setFormNouv]  = useState(EMPTY_FORM);
  const [formRes,   setFormRes]   = useState({});
  const [formResStatut, setFormResStatut] = useState({});
  const [formValid, setFormValid] = useState(EMPTY_RESULTAT_FORM);
  const [formPrelev,setFormPrelev]= useState({ type_echantillon:"sang", preleveur:"", observations_prelevement:"" });
  const [patients, setPatients]   = useState([]);
  // Correction 12 (relecture du 6 sept. 2026, FLOW-003) — consultations
  // réelles du patient sélectionné, pour permettre un lien volontaire (et
  // vérifié côté serveur) vers la consultation à l'origine de la demande.
  const [consultationsPatient, setConsultationsPatient] = useState([]);
  // Correction 1 (relecture du 6 sept. 2026) — remplace EXAM_CATALOGUE codé
  // en dur : vrai catalogue chargé depuis GET /laboratory/catalogue (déjà
  // réel, déjà utilisé par la facturation branchée la session précédente).
  // Les examens sélectionnés référencent désormais ce vrai _id, jamais un
  // libellé texte inventé — la facturation cesse d'être inerte en pratique.
  const [catalogue, setCatalogue] = useState([]);

  // Sous-phase 5.1 — agrégations réelles pour l'onglet Statistiques,
  // recalculées uniquement quand les analyses/le catalogue changent.
  const analysesParMois = useMemo(() => buildAnalysesParMois(analyses), [analyses]);
  const examensPlusPrescrits = useMemo(() => buildExamensPlusPrescrits(analyses, catalogue), [analyses, catalogue]);
  const delaisMoyens = useMemo(() => buildDelaisMoyens(analyses, catalogue), [analyses, catalogue]);

  // Ré-ouverture de P6-1 : est_critique n'est plus une pure dérivation
  // silencieuse — la case à cocher est pré-cochée depuis la détection
  // automatique (rien n'est manqué par défaut), mais c'est son état au
  // moment de la signature qui compte, pas le calcul en lui-même. Lu au
  // moment où la modale s'ouvre (pas à l'ouverture du dossier) pour
  // refléter les résultats réellement enregistrés à cet instant, y compris
  // s'ils ont été modifiés depuis l'ouverture initiale du dossier.
  useEffect(() => {
    if (!modalValider) return;
    const { est_critique } = deriveCriticalPayload(asArr(currentAnalyse?.resultats), REF_VALUES);
    setFormValid(f => ({ ...f, est_critique_confirme: est_critique }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalValider]);

  // ── Load analyses ─────────────────────────────────────────
  const loadAnalyses = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: 15 });
      if (search) p.set("q", search);
      if (filterStatut) p.set("statut", filterStatut);
      const { data } = await api.get(`/laboratory?${p}`);
      setAnalyses(data.results || data.data || []);
      setTotal(data.total || 0);
    } catch {
      setAnalyses(DEMO_ANALYSES);
      setTotal(DEMO_ANALYSES.length);
    } finally { setLoading(false); }
  }, [page, search, filterStatut]);

  // ── Load stats ────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/laboratory/stats");
      setKpis(prev => data.kpis || prev);
    } catch {
      const d = DEMO_ANALYSES;
      setKpis({
        total:      d.length,
        en_attente: d.filter(x => x.statut === "en_attente").length,
        en_cours:   d.filter(x => x.statut === "en_cours").length,
        termines:   d.filter(x => x.statut === "termine").length,
        valides:    d.filter(x => x.statut === "valide").length,
        critiques:  d.filter(x => asArr(x.resultats).some(r => r.statut_res === "critique")).length,
      });
    }
  }, []);

  // Correction 1 — vrai catalogue d'examens (jamais de repli fabriqué : une
  // liste vide honnête si l'appel échoue, pas des examens inventés).
  const loadCatalogue = useCallback(async () => {
    try {
      const { data } = await api.get("/laboratory/catalogue");
      setCatalogue(data.examens || []);
    } catch {
      setCatalogue([]);
    }
  }, []);

  // LAB-02 (correction du 12 sept. 2026, audit indépendant) — un échec de
  // /patients injectait silencieusement 2 patients fictifs ("Jean Dupont",
  // "Marie Paul"), sélectionnables comme s'ils étaient réels dans la
  // "Nouvelle demande" — une analyse aurait pu être créée pour l'un de ces
  // faux patients sans que personne ne s'en aperçoive. Même correction déjà
  // appliquée à Prescriptions.jsx/Radiology.jsx : repli honnête (liste vide,
  // erreur explicite), jamais une donnée inventée présentée comme réelle.
  const loadPatients = useCallback(async () => {
    try {
      const { data } = await api.get("/patients?limit=500");
      setPatients(data.patients || data.data || []);
    } catch {
      setPatients([]);
      toast.error("Impossible de charger la liste des patients — réessayez ou contactez le support.");
    }
  }, []);

  useEffect(() => { loadAnalyses(); loadStats(); loadPatients(); loadCatalogue(); }, [loadAnalyses, loadStats, loadPatients, loadCatalogue]);
  useRealtimeRefresh(loadAnalyses);

  // Correction 12 (FLOW-003) — dès qu'un patient est choisi dans "Nouvelle
  // demande", recherche réelle de ses consultations (aucune invention :
  // liste vide si le patient n'a aucune consultation réelle).
  useEffect(() => {
    if (!modalNouv || !formNouv.patient_id) { setConsultationsPatient([]); return; }
    let cancelled = false;
    api.get("/consultations", { params: { patient: formNouv.patient_id, limit: 20 } })
      .then(({ data }) => { if (!cancelled) setConsultationsPatient(data.consultations || []); })
      .catch(() => { if (!cancelled) setConsultationsPatient([]); });
    return () => { cancelled = true; };
  }, [modalNouv, formNouv.patient_id]);

  // ── Open analyse ──────────────────────────────────────────
  const openAnalyse = (a) => {
    setCurrentAnalyse(a);
    setCurrentInvoice(null);
    // Correction 5 — charge la vraie facture liée (si l'analyse est déjà
    // validée), jamais un calcul recomposé côté client.
    api.get(`/laboratory/${a._id}`)
      .then(({ data }) => setCurrentInvoice(data.invoice || null))
      .catch(() => setCurrentInvoice(null));
    setSection("patient");
    setTab("dossier");
    // Init résultats form
    const rf = {};
    const rs = {};
    (a.examens_demandes || []).forEach(eid => {
      const existant = asArr(a.resultats).find(r => r.exam_id === eid);
      rf[eid] = existant?.valeur || "";
      rs[eid] = existant?.statut_res || "normal";
    });
    setFormRes(rf);
    setFormResStatut(rs);
    setFormValid({ commentaire_biologiste: a.commentaire_biologiste || "", est_critique_confirme: false });
  };

  // ── Create analyse ────────────────────────────────────────
  const createAnalyse = async (e) => {
    e.preventDefault();
    if (formNouv.examens_demandes.length === 0) { toast.error("Veuillez sélectionner au moins un examen"); return; }
    setSaving(true);
    try {
      const { data } = await api.post("/laboratory", formNouv);
      toast.success(`✅ Analyse ${data.numero || "créée"} avec succès`);
      setModalNouv(false);
      setFormNouv(EMPTY_FORM);
      loadAnalyses(); loadStats();
    } catch (err) {
      toast.error(err?.response?.data?.message || "❌ Échec de la création de l'analyse");
    } finally { setSaving(false); }
  };

  // ── Enregistrer prélèvement ───────────────────────────────
  const savePrelevement = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put(`/laboratory/${currentAnalyse._id}/prelevement`, formPrelev);
      toast.success("✅ Prélèvement enregistré");
      setCurrentAnalyse(prev => ({ ...prev, ...(data.result || {}) }));
      setAnalyses(prev => prev.map(a => a._id === currentAnalyse._id ? { ...a, statut: "preleve" } : a));
      setModalPrelevement(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || "❌ Échec de l'enregistrement du prélèvement");
    } finally {
      setSaving(false);
    }
  };

  // ── Saisir résultats ──────────────────────────────────────
  const saveResultats = async (e) => {
    e.preventDefault();
    setSaving(true);
    const resultats = (currentAnalyse.examens_demandes || []).map(eid => {
      const valeur = formRes[eid] || "";
      // Correction 1 — exam_nom porte le vrai nom (catalogue réel ou
      // libellé hérité) pour que le récapitulatif de résultat critique
      // (deriveCriticalPayload, utils/labResultats.js) reste lisible même
      // quand eid est un vrai ObjectId, sans dépendre de REF_VALUES qui ne
      // connaît que les anciens ids texte.
      return { exam_id: eid, exam_nom: examLabel(eid), valeur, ref: examRef(eid), unite: examUnite(eid), statut_res: formResStatut[eid] || "normal" };
    });
    try {
      const { data } = await api.put(`/laboratory/${currentAnalyse._id}/resultats`, { resultats });
      toast.success("✅ Résultats enregistrés");
      setCurrentAnalyse(prev => ({ ...prev, ...(data.result || {}) }));
      setAnalyses(prev => prev.map(a => a._id === currentAnalyse._id ? { ...a, statut: "termine" } : a));
      setModalResultats(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || "❌ Échec de l'enregistrement des résultats");
    } finally {
      setSaving(false);
    }
  };

  // ── Valider ───────────────────────────────────────────────
  // Ré-ouverture de P6-1 (décision explicite) : est_critique n'est plus la
  // dérivation brute des statut_res — c'est une confirmation clinique
  // explicite du biologiste (formValid.est_critique_confirme, une vraie
  // case à cocher, pré-cochée par la détection automatique au moment où
  // la modale s'ouvre mais modifiable dans les deux sens avant signature).
  // valeurs_critiques reste dérivé : c'est un texte descriptif informatif
  // pour le médecin notifié, pas la décision elle-même.
  const validerAnalyse = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { valeurs_critiques } = deriveCriticalPayload(asArr(currentAnalyse.resultats), REF_VALUES);
    const est_critique = formValid.est_critique_confirme;
    // LAB-03 (correction du 12 sept. 2026) — technicien/biologiste ne sont
    // plus des champs de formulaire texte libre : le vrai technicien a déjà
    // été dérivé côté serveur à la saisie des résultats (saisirResultats),
    // et le vrai biologiste signataire est req.user._id, dérivé ici même
    // par laboratory.controller.js::validate (validateur). Aucun des deux
    // n'est envoyé par le client — l'identité ne peut pas être fabriquée.
    const payload = {
      resultats: currentAnalyse.resultats,
      commentaires: formValid.commentaire_biologiste,
      est_critique,
      valeurs_critiques: est_critique ? valeurs_critiques : "",
    };
    try {
      const { data } = await api.put(`/laboratory/${currentAnalyse._id}/validate`, payload);
      toast.success(est_critique ? "🏷️ Analyse validée — résultat critique, médecin notifié" : "🏷️ Analyse validée avec succès");
      setCurrentAnalyse(prev => ({ ...prev, ...payload, ...(data.result || {}) }));
      setCurrentInvoice(data.invoice || null);
      setAnalyses(prev => prev.map(a => a._id === currentAnalyse._id ? { ...a, statut: "valide" } : a));
      setModalValider(false);
      loadStats();
    } catch (err) {
      toast.error(err?.response?.data?.message || "❌ Échec de la validation de l'analyse");
    } finally {
      setSaving(false);
    }
  };

  // ── Acquitter un résultat critique ────────────────────────
  const acquitterResultat = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/laboratory/${currentAnalyse._id}/acquit`);
      toast.success("✅ Résultat critique acquitté");
      setCurrentAnalyse(prev => ({ ...prev, ...(data.result || {}) }));
      setAnalyses(prev => prev.map(a => a._id === currentAnalyse._id ? { ...a, acquitte_par: data.result?.acquitte_par, acquitte_at: data.result?.acquitte_at } : a));
    } catch (err) {
      toast.error(err?.response?.data?.message || "❌ Échec de l'acquittement du résultat critique");
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle examen ─────────────────────────────────────────
  const toggleExamen = (eid) => {
    setFormNouv(f => ({
      ...f,
      examens_demandes: f.examens_demandes.includes(eid)
        ? f.examens_demandes.filter(x => x !== eid)
        : [...f.examens_demandes, eid],
    }));
  };

  // Correction 1 — index du vrai catalogue par _id, pour résoudre nom/prix
  // réels partout où un examen n'est identifié que par son id.
  const catalogueById = useMemo(() => Object.fromEntries(catalogue.map(ex => [ex._id, ex])), [catalogue]);
  // Nom réel si l'id référence le vrai catalogue ; sinon libellé humain
  // hérité (analyses créées avant ce correctif, ids texte type "glycemie") ;
  // jamais un nom inventé.
  const examLabel = (eid) => catalogueById[eid]?.nom || REF_VALUES[eid]?.label || eid;
  // Prix réel UNIQUEMENT si l'id référence le vrai catalogue — jamais de
  // tarif inventé pour un ancien id texte (cohérent avec le filtre
  // isObjectId déjà appliqué côté facturation, laboratory.controller.js).
  const examPrix  = (eid) => Number(catalogueById[eid]?.prix) || 0;
  // Valeur normale/unité : seules les anciennes analyses (REF_VALUES) en
  // portent une aujourd'hui — le vrai catalogue n'a pas ce champ, "—" plutôt
  // que d'inventer une plage de référence.
  const examRef   = (eid) => REF_VALUES[eid]?.ref || "—";
  const examUnite = (eid) => REF_VALUES[eid]?.unite || "";

  // ── Get prix total ────────────────────────────────────────
  const getPrixTotal = (examens) => (examens || []).reduce((total, eid) => total + examPrix(eid), 0);

  const nbCritiques = kpis.critiques || 0;

  // ── Résultat statut auto ──────────────────────────────────
  const getStatutRes = (r) => {
    const statut = r.statut_res || "normal";
    return RESULTATS_CFG[statut] || RESULTATS_CFG.normal;
  };

  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      <div className="lab">

        {/* ── HERO ── */}
        <Hero
          icon={FlaskConical}
          title="Module Laboratoire"
          dateLabel={`${kpis.total} analyses · Clinique Canadienne de Souanké`}
          right={
            <>
              {currentAnalyse && (
                <button className="hero-btn-ghost" onClick={() => window.print()}>
                  <Printer size={14} /> Imprimer
                </button>
              )}
              <Button icon={Plus} onClick={() => { setFormNouv(EMPTY_FORM); setModalNouv(true); }}>Nouvelle demande</Button>
            </>
          }
        />

        {/* Tabs */}
        {(() => {
            const TABS = [
              { key:"dashboard", icon:I.grid,  label:"Tableau de bord",     labelM:"Dashboard" },
              { key:"liste",     icon:I.list,  label:"Liste des analyses",   labelM:"Analyses" },
              { key:"dossier",   icon:I.file,  label:currentAnalyse?`Analyse ${currentAnalyse.numero}`:"Analyse", labelM:"Analyse", disabled:!currentAnalyse },
              { key:"stats",     icon:I.chart, label:"Statistiques",         labelM:"Stats" },
            ].filter(t=>!t.disabled);
            return (
              <div className="tab-bar" style={isMobile?{display:'grid',gridTemplateColumns:`repeat(${Math.min(3,TABS.length)},1fr)`,gap:4}:{}}>
                {TABS.map(t=>(
                  <button key={t.key} className={`tab-bar-item ${tab===t.key?"active":""}`} style={isMobile?{flexDirection:'column',textAlign:'center',padding:'7px 3px 8px',fontSize:'9.5px',gap:'3px',whiteSpace:'normal',minWidth:0}:{}} onClick={()=>setTab(t.key)}>
                    <span style={isMobile?{fontSize:'14px'}:{}}>{t.icon}</span>
                    <span style={isMobile?{lineHeight:1.2}:{}}>{isMobile?t.labelM:t.label}</span>
                    {t.key==="dossier"&&asArr(currentAnalyse?.resultats).some(r=>r.statut_res==="critique")&&<span className="tab-bar-item-count">⚡</span>}
                  </button>
                ))}
              </div>
            );
          })()}

        {/* ── CONTENT ── */}
        <div style={{ padding: isMobile ? 14 : 24 }}>

          {/* ══ DASHBOARD ══ */}
          {tab === "dashboard" && (
            <div>
              {/* Alert critiques */}
              {nbCritiques > 0 && (
                <div className="al-danger fu" style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, flexWrap:"wrap" }}>
                  <div style={{ width:42, height:42, background:"#FEE2E2", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {I.alert}
                  </div>
                  <div style={{ flex:1 }}>
                    <strong style={{ color:"#B91C1C", fontSize:13 }}>⚡ Alerte — Valeurs biologiques critiques</strong>
                    <div style={{ fontSize:12, color:"#DC2626", marginTop:3 }}>
                      <strong>{nbCritiques}</strong> résultat(s) avec valeurs critiques nécessitent une attention immédiate du médecin prescripteur.
                    </div>
                  </div>
                  <button className="lbtn lbtn-danger lbtn-sm" onClick={() => { setFilter(""); setTab("liste"); }}>Voir les critiques →</button>
                </div>
              )}

              {/* KPIs */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="blue"   icon={I.file}    value={kpis.total}       label="Total analyses"     sub="tous statuts"              onClick={() => setTab("liste")} />
                <KpiCard color="orange" icon={I.clock}   value={kpis.en_attente}  label="En attente"         sub="prélèvement requis"        onClick={() => { setFilter("en_attente"); setTab("liste"); }} />
                <KpiCard color="purple" icon={I.flask}   value={kpis.en_cours}    label="En cours"           sub="analyse en laboratoire"    onClick={() => { setFilter("en_cours"); setTab("liste"); }} />
                <KpiCard color="teal"   icon={I.check}   value={kpis.termines}    label="Terminés"           sub="résultats disponibles"     onClick={() => { setFilter("termine"); setTab("liste"); }} />
                <KpiCard color="green"  icon={I.star}    value={kpis.valides}     label="Validés"            sub="par biologiste"            onClick={() => { setFilter("valide"); setTab("liste"); }} />
                <KpiCard color={nbCritiques > 0 ? "red" : "green"} icon={I.alert} value={nbCritiques} label="Valeurs critiques" sub="alerte immédiate" urgent={nbCritiques > 0} />
              </div>

              {/* Quick actions */}
              <div className="lab-card fu" style={{ marginBottom:24 }}>
                <div className="lab-card-hdr"><h3>⚡ Actions rapides</h3></div>
                <div style={{ padding:"16px 20px", display:"flex", gap:12, flexWrap:"wrap" }}>
                  {[
                    { icon:"🆕", label:"Nouvelle demande",         color:"#EFF6FF", action:() => { setFormNouv(EMPTY_FORM); setModalNouv(true); } },
                    { icon:"🩸", label:"Enregistrer prélèvement",  color:"#FFF0F0", action:() => { if(currentAnalyse) { setModalPrelevement(true); setTab("dossier"); } else toast.error("Ouvrez d'abord un dossier"); } },
                    { icon:"🔬", label:"Saisir résultats",         color:"#F0FFF4", action:() => { if(currentAnalyse) { setModalResultats(true); setTab("dossier"); } else toast.error("Ouvrez d'abord un dossier"); } },
                    { icon:"🏷️", label:"Valider résultats",        color:"#F5F3FF", action:() => { if(currentAnalyse) { setModalValider(true); setTab("dossier"); } else toast.error("Ouvrez d'abord un dossier"); } },
                    { icon:"📋", label:"Imprimer rapport",         color:"#F8FAFD", action:() => window.print() },
                  ].map(qa => (
                    <button key={qa.label} className="qa-btn" onClick={qa.action}>
                      <div className="qa-icon" style={{ background:qa.color }}>{qa.icon}</div>
                      <span>{qa.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent + Répartition */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"2fr 1fr", gap:20, marginBottom:24 }}>
                <div className="lab-card fu">
                  <div className="lab-card-hdr">
                    <div><h3>{I.list} Analyses récentes</h3><p>Dernières demandes</p></div>
                    <button className="lbtn lbtn-ghost lbtn-sm" onClick={() => setTab("liste")}>Voir toutes →</button>
                  </div>
                  <div style={{ overflowX:"auto" }}>
                    <table className="lab-tbl">
                      <thead>
                        <tr><th>N°</th><th>Patient</th><th>Examens</th><th>Date</th><th>Statut</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {(loading ? DEMO_ANALYSES : analyses).slice(0, 6).map(a => {
                          const sc = STATUT_CFG[a.statut] || { cls:"gray", label:a.statut, icon:"" };
                          const hasCritique = asArr(a.resultats).some(r => r.statut_res === "critique");
                          return (
                            <tr key={a._id} style={{ background:hasCritique ? "#FFF8F8" : "" }}>
                              <td>
                                <span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--lb)", fontSize:12 }}>{a.numero}</span>
                                {hasCritique && <div><Badge cls="critical">⚡ Critique</Badge></div>}
                              </td>
                              <td>
                                <div style={{ fontWeight:600, color:"var(--ln)", cursor: a.patient ? 'pointer' : 'default', textDecoration: a.patient ? 'underline dotted' : 'none', textUnderlineOffset:2 }} onClick={() => a.patient && navigate(`/patients/${a.patient}`)} title={a.patient ? "Ouvrir le dossier patient" : ""}>{a.patient_nom}</div>
                                {a.patient_dossier && <span style={{ fontFamily:'monospace', fontSize:10, fontWeight:700, color:'#1B4F9E', background:'#EFF6FF', padding:'1px 6px', borderRadius:4, display:'inline-block', marginTop:2 }}>{a.patient_dossier}</span>}
                                <div style={{ fontSize:11, color:"var(--lm)" }}>{a.service_demandeur}</div>
                              </td>
                              <td>
                                <div style={{ fontSize:11.5, color:"var(--lm)" }}>
                                  {(a.examens_demandes || []).slice(0,3).map(eid => {
                                    const ref = REF_VALUES[eid];
                                    return ref ? ref.label : eid;
                                  }).join(", ")}
                                  {a.examens_demandes?.length > 3 && ` +${a.examens_demandes.length - 3}`}
                                </div>
                              </td>
                              <td style={{ fontSize:12, color:"var(--lm)" }}>{fmtDate(a.date_demande)}</td>
                              <td><Badge cls={sc.cls}>{sc.icon} {sc.label}</Badge></td>
                              <td>
                                <button className="lbtn lbtn-ghost lbtn-sm" style={{ fontSize:11 }} onClick={() => openAnalyse(a)}>
                                  {I.open} Ouvrir
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {!loading && analyses.length === 0 && (
                          <tr><td colSpan={6} style={{ padding:40, textAlign:"center", color:"var(--lm)" }}>Aucune analyse enregistrée</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="lab-card fu">
                  <div className="lab-card-hdr"><div><h3>Répartition statuts</h3><p>{kpis.total} analyses</p></div></div>
                  <div style={{ padding:20 }}>
                    {[
                      ["En attente",   kpis.en_attente, "#D97706"],
                      ["En cours",     kpis.en_cours,   "#7C3AED"],
                      ["Terminés",     kpis.termines,   "#0EA5A0"],
                      ["Validés",      kpis.valides,    "#059669"],
                    ].map(([lbl, val, col]) => (
                      <div key={lbl} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:"var(--lm)" }}>
                            <span style={{ width:10, height:10, borderRadius:3, background:col, display:"inline-block" }} />
                            {lbl}
                          </span>
                          <span style={{ fontWeight:700, fontSize:12, color:"var(--ln)" }}>{val}</span>
                        </div>
                        <Prog pct={kpis.total > 0 ? Math.round(val / kpis.total * 100) : 0} color={col} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ LISTE ══ */}
          {tab === "liste" && (
            <div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--ln)" }}>Liste des analyses biologiques</div>
                  <div style={{ fontSize:12, color:"var(--lm)", marginTop:2 }}>{total} analyse(s) au total</div>
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }}>{I.search}</span>
                    <input className="linp" style={{ paddingLeft:34, width:220 }} placeholder="Patient, numéro, examen..." aria-label="Patient, numéro, examen" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                  </div>
                  <select className="linp" style={{ width:180 }} value={filterStatut} onChange={e => { setFilter(e.target.value); setPage(1); }}>
                    <option value="">Tous les statuts</option>
                    <option value="en_attente">En attente</option>
                    <option value="preleve">Prélevé</option>
                    <option value="en_cours">En cours</option>
                    <option value="termine">Terminé</option>
                    <option value="valide">Validé</option>
                  </select>
                  <button className="lbtn lbtn-primary" onClick={() => { setFormNouv(EMPTY_FORM); setModalNouv(true); }}>
                    {I.plus} Nouvelle demande
                  </button>
                </div>
              </div>

              <div className="lab-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="lab-tbl" style={{ minWidth:960 }}>
                    <thead>
                      <tr>
                        <th>N° Analyse</th><th>Patient</th><th>Examens demandés</th>
                        <th>Prescripteur</th><th>Date demande</th><th>Prélèvement</th>
                        <th>Résultat</th><th>Paiement</th><th>Statut</th><th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={10} style={{ padding:40, textAlign:"center", color:"var(--lm)" }}>Chargement...</td></tr>
                      ) : analyses.map(a => {
                        const sc = STATUT_CFG[a.statut] || { cls:"gray", label:a.statut, icon:"" };
                        const hasCritique = asArr(a.resultats).some(r => r.statut_res === "critique");
                        const hasAnormal  = asArr(a.resultats).some(r => r.statut_res === "anormal");
                        return (
                          <tr key={a._id} style={{ background:hasCritique ? "#FFF5F5" : hasAnormal ? "#FFFBF0" : "" }}>
                            <td>
                              <span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--lb)", fontSize:12 }}>{a.numero}</span>
                              {hasCritique && <div><Badge cls="critical">⚡ Critique</Badge></div>}
                              {!hasCritique && hasAnormal && <div><Badge cls="orange">⚠ Anormal</Badge></div>}
                            </td>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--ln)", cursor: a.patient ? 'pointer' : 'default', textDecoration: a.patient ? 'underline dotted' : 'none', textUnderlineOffset:2 }} onClick={() => a.patient && navigate(`/patients/${a.patient}`)} title={a.patient ? "Ouvrir le dossier patient" : ""}>{a.patient_nom}</div>
                              {a.patient_dossier && <span style={{ fontFamily:'monospace', fontSize:10, fontWeight:700, color:'#1B4F9E', background:'#EFF6FF', padding:'1px 6px', borderRadius:4, display:'inline-block', marginBottom:2 }}>{a.patient_dossier}</span>}
                              <div style={{ fontSize:11, color:"var(--lm)" }}>{a.sexe?.charAt(0).toUpperCase()}{a.sexe?.slice(1) || "—"}</div>
                            </td>
                            <td>
                              <div style={{ fontSize:11.5, color:"var(--lm)", maxWidth:180 }}>
                                {(a.examens_demandes || []).slice(0,3).map(eid => REF_VALUES[eid]?.label || eid).join(", ")}
                                {a.examens_demandes?.length > 3 && <span style={{ color:"var(--lb)", fontWeight:600 }}> +{a.examens_demandes.length - 3}</span>}
                              </div>
                            </td>
                            <td style={{ fontSize:12, color:"var(--lm)" }}>{a.medecin_prescripteur_nom || "—"}</td>
                            <td style={{ fontSize:12, color:"var(--lm)" }}>{fmtDateTime(a.date_demande)}</td>
                            <td style={{ fontSize:12 }}>{a.date_prelevement ? <span style={{ color:"var(--lg)", fontWeight:600 }}>✅ {fmtDate(a.date_prelevement)}</span> : <span style={{ color:"var(--lo)" }}>En attente</span>}</td>
                            <td style={{ fontSize:12 }}>{a.date_resultat ? <span style={{ color:"var(--lt)", fontWeight:600 }}>✅ {fmtDate(a.date_resultat)}</span> : "—"}</td>
                            <td>{a.paye ? <Badge cls="green">✅ Payé</Badge> : <Badge cls="orange">En attente</Badge>}</td>
                            <td><Badge cls={sc.cls}>{sc.icon} {sc.label}</Badge></td>
                            <td>
                              <button className="lbtn lbtn-ghost lbtn-sm" style={{ fontSize:11 }} onClick={() => openAnalyse(a)}>
                                {I.open} Ouvrir
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!loading && analyses.length === 0 && (
                        <tr><td colSpan={10} style={{ padding:40, textAlign:"center", color:"var(--lm)" }}>
                          {search ? `Aucun résultat pour "${search}"` : "Aucune analyse enregistrée"}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {total > 15 && (
                  <div style={{ padding:"12px 20px", borderTop:"1.5px solid var(--lbr)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontSize:12, color:"var(--lm)" }}>Page {page} / {Math.ceil(total/15)} · {total} analyses</span>
                    <div style={{ display:"flex", gap:8 }}>
                      {page > 1 && <button className="lbtn lbtn-ghost lbtn-sm" onClick={() => setPage(p=>p-1)}>← Précédent</button>}
                      {page < Math.ceil(total/15) && <button className="lbtn lbtn-primary lbtn-sm" onClick={() => setPage(p=>p+1)}>Suivant →</button>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ DOSSIER ANALYSE ══ */}
          {tab === "dossier" && currentAnalyse && (() => {
            const sc = STATUT_CFG[currentAnalyse.statut] || { cls:"gray", label:currentAnalyse.statut, icon:"" };
            const hasCritique = asArr(currentAnalyse.resultats).some(r => r.statut_res === "critique");
            const iaCol = hasCritique ? "#DC2626" : "#059669";

            return (
              <div>
                {/* Header dossier */}
                <div style={{ background:"linear-gradient(135deg,#0B1E3B,#132744)", borderRadius:18, padding:"20px 24px", marginBottom:20, color:"#fff" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                      <div style={{ width:56, height:56, borderRadius:14, background:"rgba(255,255,255,.15)", border:"2px solid rgba(255,255,255,.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>
                        {currentAnalyse.sexe === "femme" ? "👩" : "👨"}
                      </div>
                      <div>
                        <div style={{ fontSize:18, fontWeight:700 }}>{currentAnalyse.patient_nom}</div>
                        <div style={{ fontSize:12, color:"rgba(255,255,255,.65)", marginTop:2 }}>
                          {ageCalc(currentAnalyse.date_naissance)} · {currentAnalyse.sexe ? currentAnalyse.sexe.charAt(0).toUpperCase() + currentAnalyse.sexe.slice(1) : "—"} · {currentAnalyse.patient_dossier}
                        </div>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:3 }}>
                          📞 {currentAnalyse.telephone || "—"} · Service : {currentAnalyse.service_demandeur || "—"}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                      <div style={{ background:"rgba(255,255,255,.1)", borderRadius:12, padding:"10px 16px" }}>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,.6)", fontWeight:600, textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>Statut analyse</div>
                        <Badge cls={sc.cls}>{sc.icon} {sc.label}</Badge>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:6 }}>{currentAnalyse.examens_demandes?.length || 0} examen(s)</div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontFamily:"monospace", fontSize:16, fontWeight:700, color:"rgba(255,255,255,.9)" }}>{currentAnalyse.numero}</div>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,.55)", marginTop:4 }}>📅 {fmtDateTime(currentAnalyse.date_demande)}</div>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:2 }}>{currentAnalyse.medecin_prescripteur_nom || "—"}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alerte critique */}
                {(hasCritique || currentAnalyse.est_critique) && (
                  <div className="al-danger" style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:20 }}>
                    {I.alert}
                    <div style={{ flex:1 }}>
                      <strong style={{ color:"#B91C1C", fontSize:13 }}>⚡ VALEURS CRITIQUES DÉTECTÉES</strong>
                      <div style={{ fontSize:12, color:"#DC2626", marginTop:4 }}>
                        Résultats hors valeurs de référence critiques — Contacter le médecin prescripteur immédiatement.
                        {currentAnalyse.commentaire_biologiste && <div style={{ marginTop:4, fontStyle:"italic" }}>{currentAnalyse.commentaire_biologiste}</div>}
                      </div>
                      {currentAnalyse.est_critique && (
                        currentAnalyse.acquitte_par ? (
                          <div style={{ fontSize:11, color:"#059669", fontWeight:600, marginTop:8 }}>
                            ✅ Résultat critique acquitté{currentAnalyse.acquitte_at ? ` le ${fmtDateTime(currentAnalyse.acquitte_at)}` : ""}
                          </div>
                        ) : (
                          <button className="lbtn lbtn-danger lbtn-sm" style={{ marginTop:8 }} disabled={saving} onClick={acquitterResultat}>
                            ⚠️ {saving ? "Acquittement..." : "Acquitter le résultat critique"}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Actions rapides dossier */}
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
                  {currentAnalyse.statut === "en_attente" && (
                    <button className="lbtn lbtn-primary" onClick={() => setModalPrelevement(true)}>
                      🩸 Enregistrer prélèvement
                    </button>
                  )}
                  {["preleve","en_cours"].includes(currentAnalyse.statut) && (
                    <button className="lbtn lbtn-teal" onClick={() => setModalResultats(true)}>
                      🔬 Saisir les résultats
                    </button>
                  )}
                  {currentAnalyse.statut === "termine" && (
                    <button className="lbtn lbtn-green" onClick={() => setModalValider(true)}>
                      🏷️ Valider les résultats
                    </button>
                  )}
                  {/* Sous-phase 5.2 — les 4 boutons ci-dessous affichaient
                      chacun un faux succès (toast.success) sans la moindre
                      action réelle. "Imprimer bulletin" câblé sur
                      window.print(), même mécanisme réel déjà utilisé
                      ailleurs dans ce fichier (hero, "Imprimer rapport").
                      "Télécharger PDF" (aucun moteur de génération PDF
                      distinct de l'impression) et "Envoyer médecin"/
                      "Envoyer patient" (aucun mécanisme réel de
                      notification/envoi de résultat n'existe dans
                      laboratory.controller.js) désactivés honnêtement. */}
                  <button className="lbtn lbtn-ghost" onClick={() => window.print()}>{I.print} Imprimer bulletin</button>
                  <button className="lbtn lbtn-ghost" disabled title="Fonctionnalité en cours de développement — utilisez « Imprimer bulletin » (impression/export PDF via le navigateur)." onClick={() => toast("🚧 Téléchargement PDF non disponible — utilisez « Imprimer bulletin ».")}>{I.dl} Télécharger PDF</button>
                  <button className="lbtn lbtn-ghost" disabled title="Fonctionnalité en cours de développement — aucun envoi réel au médecin n'existe dans ce système." onClick={() => toast("🚧 Envoi non disponible — fonctionnalité en cours de développement.")}>{I.send} Envoyer médecin</button>
                  <button className="lbtn lbtn-ghost" disabled title="Fonctionnalité en cours de développement — aucun envoi réel au patient n'existe dans ce système." onClick={() => toast("🚧 Envoi non disponible — fonctionnalité en cours de développement.")}>{I.send} Envoyer patient</button>
                </div>

                {/* Section nav */}
                <div className="sec-nav" style={{ borderRadius:"18px 18px 0 0", overflow:"hidden" }}>
                  {[
                    { id:"patient",       label:"👤 Informations" },
                    { id:"demande",       label:`🔬 Examens (${currentAnalyse.examens_demandes?.length || 0})` },
                    { id:"prelevement",   label:"🩸 Prélèvement" },
                    { id:"resultats",     label:`📊 Résultats ${hasCritique ? "⚡" : ""}`, warn:hasCritique },
                    { id:"validation",    label:"✅ Validation" },
                    { id:"facturation",   label:"💰 Facturation" },
                    { id:"documents",     label:"📄 Documents" },
                  ].map(s => (
                    <button key={s.id} className={`sec-btn ${section === s.id ? "active" : ""} ${s.warn ? "warn" : ""}`} onClick={() => setSection(s.id)}>
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* ── PATIENT INFO ── */}
                {section === "patient" && (
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20, marginTop:20 }}>
                    <div className="lab-card">
                      <div className="lab-card-hdr"><h3>👤 Patient</h3></div>
                      <div style={{ padding:20 }}>
                        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
                          {[
                            ["N° Dossier",   currentAnalyse.patient_dossier || "—"],
                            ["Sexe",         currentAnalyse.sexe ? currentAnalyse.sexe.charAt(0).toUpperCase()+currentAnalyse.sexe.slice(1) : "—"],
                            ["Âge",          ageCalc(currentAnalyse.date_naissance)],
                            ["Téléphone",    currentAnalyse.telephone || "—"],
                            ["Service",      currentAnalyse.service_demandeur || "—"],
                            ["Prescripteur", currentAnalyse.medecin_prescripteur || "—"],
                          ].map(([lbl,val]) => (
                            <div key={lbl} style={{ background:"#F8FAFD", borderRadius:10, padding:"10px 12px" }}>
                              <div style={{ fontSize:10, fontWeight:600, color:"var(--lm)", textTransform:"uppercase", letterSpacing:.4 }}>{lbl}</div>
                              <div style={{ fontSize:13, fontWeight:600, color:"var(--ln)", marginTop:2 }}>{val}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="lab-card">
                      <div className="lab-card-hdr"><h3>📋 Informations de l'analyse</h3></div>
                      <div style={{ padding:20 }}>
                        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                          {[
                            ["N° Analyse",       currentAnalyse.numero],
                            ["Date demande",     fmtDateTime(currentAnalyse.date_demande)],
                            ["Date prélèvement", fmtDateTime(currentAnalyse.date_prelevement)],
                            ["Date résultat",    fmtDateTime(currentAnalyse.date_resultat)],
                            ["Date validation",  fmtDateTime(currentAnalyse.date_validation)],
                          ].map(([lbl,val]) => (
                            <div key={lbl} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:"#F8FAFD", borderRadius:8 }}>
                              <span style={{ fontSize:11, fontWeight:600, color:"var(--lm)", textTransform:"uppercase", letterSpacing:.3 }}>{lbl}</span>
                              <span style={{ fontSize:12, fontWeight:600, color:"var(--ln)" }}>{val}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop:12, padding:"10px 12px", background:"#EEF4FF", borderRadius:10 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"var(--lm)", textTransform:"uppercase", marginBottom:6 }}>🔗 Liaisons modules</div>
                          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                            {["📋 Consultation","🏥 Hospitalisation","💊 Pharmacie","💰 Facturation"].map(lbl => (
                              <span key={lbl} style={{ background:"white", border:"1px solid var(--lbr)", borderRadius:8, padding:"4px 10px", fontSize:11, fontWeight:600, color:"var(--ln)", cursor:"pointer" }}>{lbl}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── EXAMENS DEMANDÉS ── */}
                {section === "demande" && (
                  <div style={{ marginTop:20 }}>
                    <div className="lab-card">
                      <div className="lab-card-hdr">
                        <h3>🔬 Examens prescrits</h3>
                        <span style={{ fontSize:12, color:"var(--lm)" }}>{currentAnalyse.examens_demandes?.length || 0} examen(s)</span>
                      </div>
                      <div style={{ padding:20 }}>
                        {/* Correction 1 — groupé par la vraie catégorie du
                            catalogue (ExamCatalogue.categorie) ; les analyses
                            créées avant ce correctif (ids texte hérités, non
                            présents dans le vrai catalogue) restent listées
                            sous un groupe distinct, honnêtement nommé. */}
                        {Object.entries(
                          (currentAnalyse.examens_demandes || []).reduce((groups, eid) => {
                            const cat = catalogueById[eid]?.categorie || "Analyses antérieures (catalogue historique)";
                            (groups[cat] = groups[cat] || []).push(eid);
                            return groups;
                          }, {})
                        ).map(([catLabel, ids]) => (
                          <div key={catLabel} style={{ marginBottom:16 }}>
                            <div className="cat-hdr">{catLabel}</div>
                            {ids.map(eid => (
                              <div key={eid} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", background:"#F8FAFD", borderRadius:8, marginBottom:4 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                  <div style={{ width:8, height:8, borderRadius:50, background:"var(--lt)" }} />
                                  <span style={{ fontSize:13, color:"var(--ln)", fontWeight:500 }}>{examLabel(eid)}</span>
                                </div>
                                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                  <span style={{ fontSize:12, color:"var(--lm)" }}>{examRef(eid)}</span>
                                  <span style={{ fontSize:12, fontWeight:700, color:"var(--lb)" }}>{examPrix(eid).toLocaleString("fr-FR")} CFA</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                        {currentAnalyse.autres_examens && (
                          <div style={{ marginTop:10, padding:"10px 12px", background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:10 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:"var(--lo)", textTransform:"uppercase", marginBottom:4 }}>Autres examens spécifiques</div>
                            <div style={{ fontSize:13, color:"var(--ln)" }}>{currentAnalyse.autres_examens}</div>
                          </div>
                        )}
                        <div style={{ marginTop:16, paddingTop:14, borderTop:"1.5px solid var(--lbr)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ fontSize:13, color:"var(--lm)" }}>Total à facturer</span>
                          <span style={{ fontSize:18, fontWeight:800, color:"var(--lb)" }}>
                            {getPrixTotal(currentAnalyse.examens_demandes || []).toLocaleString("fr-FR")} CFA
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── PRÉLÈVEMENT ── */}
                {section === "prelevement" && (
                  <div style={{ marginTop:20 }}>
                    <div className="lab-card">
                      <div className="lab-card-hdr"><h3>🩸 Informations du prélèvement</h3></div>
                      <div style={{ padding:20 }}>
                        {currentAnalyse.date_prelevement ? (
                          <div>
                            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:12, marginBottom:16 }}>
                              {[
                                ["Type d'échantillon", currentAnalyse.type_echantillon || "—"],
                                ["Date & heure",        fmtDateTime(currentAnalyse.date_prelevement)],
                                ["Préleveur",           currentAnalyse.preleveur || "—"],
                              ].map(([lbl,val]) => (
                                <div key={lbl} style={{ background:"#F8FAFD", borderRadius:12, padding:"12px 16px", textAlign:"center" }}>
                                  <div style={{ fontSize:10, fontWeight:600, color:"var(--lm)", textTransform:"uppercase", letterSpacing:.4 }}>{lbl}</div>
                                  <div style={{ fontSize:14, fontWeight:700, color:"var(--ln)", marginTop:6 }}>{val}</div>
                                </div>
                              ))}
                            </div>
                            {currentAnalyse.observations_prelevement && (
                              <div style={{ background:"#F8FAFD", borderRadius:10, padding:14 }}>
                                <div style={{ fontSize:11, fontWeight:600, color:"var(--lm)", textTransform:"uppercase", marginBottom:6 }}>Observations</div>
                                <div style={{ fontSize:13, color:"var(--ln)" }}>{currentAnalyse.observations_prelevement}</div>
                              </div>
                            )}
                            <div className="al-success" style={{ marginTop:12, display:"flex", alignItems:"center", gap:10 }}>
                              {I.check}
                              <span style={{ fontSize:13, color:"#065F46", fontWeight:600 }}>Prélèvement enregistré avec succès</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign:"center", padding:40 }}>
                            <div style={{ fontSize:40, marginBottom:16 }}>🩸</div>
                            <div style={{ fontWeight:700, color:"var(--lo)", fontSize:15 }}>Prélèvement non encore effectué</div>
                            <div style={{ color:"var(--lm)", fontSize:13, marginTop:8 }}>Enregistrez le prélèvement pour passer à l'analyse.</div>
                            <button className="lbtn lbtn-primary" style={{ marginTop:16 }} onClick={() => setModalPrelevement(true)}>
                              🩸 Enregistrer le prélèvement
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── RÉSULTATS ── */}
                {section === "resultats" && (
                  <div style={{ marginTop:20 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                      <div>
                        <div style={{ fontSize:15, fontWeight:700, color:"var(--ln)" }}>Résultats biologiques</div>
                        <div style={{ fontSize:12, color:"var(--lm)" }}>{asArr(currentAnalyse.resultats).length || 0} résultat(s) saisi(s)</div>
                      </div>
                      {["preleve","en_cours"].includes(currentAnalyse.statut) && (
                        <button className="lbtn lbtn-teal" onClick={() => setModalResultats(true)}>
                          🔬 Saisir / Mettre à jour résultats
                        </button>
                      )}
                    </div>

                    {asArr(currentAnalyse.resultats).length > 0 ? (
                      <div className="lab-card">
                        <div style={{ overflowX:"auto" }}>
                          <table className="res-tbl">
                            <thead>
                              <tr>
                                <th>Analyse</th>
                                <th>Résultat</th>
                                <th>Valeur normale</th>
                                <th>Unité</th>
                                <th>Statut</th>
                              </tr>
                            </thead>
                            <tbody>
                              {asArr(currentAnalyse.resultats).map(r => {
                                const statut = getStatutRes(r);
                                return (
                                  <tr key={r.exam_id} className={r.statut_res || "normal"}>
                                    <td style={{ fontWeight:600, color:"var(--ln)" }}>{r.exam_nom || examLabel(r.exam_id)}</td>
                                    <td style={{ fontWeight:r.statut_res !== "normal" ? 700 : 400, color:r.statut_res === "critique" ? "#DC2626" : r.statut_res === "anormal" ? "#D97706" : "var(--ln)", fontSize:14 }}>
                                      {r.valeur || "—"}
                                      {r.statut_res === "critique" && " ⚡"}
                                    </td>
                                    <td style={{ fontSize:12, color:"var(--lm)" }}>{r.ref || examRef(r.exam_id)}</td>
                                    <td style={{ fontSize:12, color:"var(--lm)" }}>{r.unite || examUnite(r.exam_id)}</td>
                                    <td><Badge cls={statut.cls}>{statut.label}</Badge></td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {currentAnalyse.commentaire_biologiste && (
                          <div style={{ padding:"0 20px 20px" }}>
                            <div style={{ background:hasCritique ? "#FEF2F2" : "#EFF6FF", border:`1.5px solid ${hasCritique ? "#FECACA" : "#BFDBFE"}`, borderRadius:12, padding:14, marginTop:16 }}>
                              <div style={{ fontSize:11, fontWeight:700, color:hasCritique ? "#B91C1C" : "#1E40AF", textTransform:"uppercase", marginBottom:6 }}>💬 Commentaire du biologiste</div>
                              <div style={{ fontSize:13, color:hasCritique ? "#DC2626" : "var(--ln)" }}>{currentAnalyse.commentaire_biologiste}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="lab-card" style={{ padding:40, textAlign:"center" }}>
                        <div style={{ fontSize:36, marginBottom:12 }}>🔬</div>
                        <div style={{ fontWeight:700, color:"var(--lm)", fontSize:15 }}>Résultats non encore saisis</div>
                        <div style={{ color:"var(--lm)", fontSize:13, marginTop:6 }}>Effectuez d'abord le prélèvement, puis saisissez les résultats.</div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── VALIDATION ── */}
                {section === "validation" && (
                  <div style={{ marginTop:20 }}>
                    <div className="lab-card">
                      <div className="lab-card-hdr"><h3>✅ Validation des résultats</h3></div>
                      <div style={{ padding:20 }}>
                        {currentAnalyse.statut === "valide" ? (
                          <div>
                            <div className="al-success" style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:20 }}>
                              {I.check}
                              <div>
                                <strong style={{ color:"#065F46", fontSize:13 }}>Analyse validée et signée</strong>
                                <div style={{ fontSize:12, color:"#047857", marginTop:4 }}>
                                  Validé le {fmtDateTime(currentAnalyse.date_validation)}
                                </div>
                              </div>
                            </div>
                            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                              {[
                                ["Technicien de laboratoire", currentAnalyse.technicien_nom || fmtUser(currentAnalyse.technicien) || "—"],
                                ["Biologiste responsable",    currentAnalyse.validateur_nom || fmtUser(currentAnalyse.validateur) || "—"],
                                ["Date de validation",        fmtDateTime(currentAnalyse.date_validation)],
                              ].map(([lbl,val]) => (
                                <div key={lbl} style={{ background:"#F8FAFD", borderRadius:10, padding:"12px 14px" }}>
                                  <div style={{ fontSize:10, fontWeight:600, color:"var(--lm)", textTransform:"uppercase", letterSpacing:.4 }}>{lbl}</div>
                                  <div style={{ fontSize:13, fontWeight:600, color:"var(--ln)", marginTop:4 }}>{val}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : currentAnalyse.statut === "termine" ? (
                          <div>
                            <div className="al-warn" style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                              {I.alert}
                              <span style={{ fontSize:13, color:"#92400E" }}>Résultats saisis — En attente de validation biologiste</span>
                            </div>
                            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                              {/* LAB-03 — technicien/biologiste ne sont plus des champs texte
                                  requis mais jamais persistés. Le technicien réel a déjà été
                                  enregistré à la saisie des résultats ; le biologiste signataire
                                  réel est l'utilisateur actuellement connecté (dérivé côté
                                  serveur à la signature, jamais fabriqué côté client). */}
                              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                                <div style={{ background:"#F8FAFD", borderRadius:10, padding:"12px 14px" }}>
                                  <div style={{ fontSize:10, fontWeight:600, color:"var(--lm)", textTransform:"uppercase", letterSpacing:.4 }}>Technicien de laboratoire</div>
                                  <div style={{ fontSize:13, fontWeight:600, color:"var(--ln)", marginTop:4 }}>{currentAnalyse.technicien_nom || fmtUser(currentAnalyse.technicien) || "—"}</div>
                                </div>
                                <div style={{ background:"#F8FAFD", borderRadius:10, padding:"12px 14px" }}>
                                  <div style={{ fontSize:10, fontWeight:600, color:"var(--lm)", textTransform:"uppercase", letterSpacing:.4 }}>Biologiste responsable (vous)</div>
                                  <div style={{ fontSize:13, fontWeight:600, color:"var(--ln)", marginTop:4 }}>{fmtUser(authUser) || "—"}</div>
                                </div>
                              </div>
                              <div>
                                <label className="llbl">Commentaire du biologiste</label>
                                <textarea className="linp" rows={3} value={formValid.commentaire_biologiste} onChange={e => setFormValid(f=>({...f,commentaire_biologiste:e.target.value}))} placeholder="Interprétation, commentaires cliniques..." />
                              </div>
                              <div style={{ background:"#EEF4FF", borderRadius:12, padding:"12px 14px", fontSize:12, color:"var(--lm)" }}>
                                ✍️ La validation engage la responsabilité du biologiste signataire ({fmtUser(authUser) || "vous"}).
                              </div>
                              <button className="lbtn lbtn-green" style={{ alignSelf:"flex-start" }} disabled={saving} onClick={async (e) => { await validerAnalyse(e); }}>
                                🏷️ {saving ? "Validation..." : "Valider et signer les résultats"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign:"center", padding:40 }}>
                            <div style={{ fontSize:36, marginBottom:12 }}>⏳</div>
                            <div style={{ fontWeight:700, color:"var(--lm)", fontSize:15 }}>Saisie des résultats requise</div>
                            <div style={{ color:"var(--lm)", fontSize:13, marginTop:6 }}>La validation est disponible après la saisie complète des résultats.</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── FACTURATION ── */}
                {/* Correction 5 (relecture du 5 sept. 2026) — affichait un
                    calcul recomposé côté client depuis EXAM_CATALOGUE (tarifs
                    fixes codés en dur), sans aucun lien réel avec le module
                    Finance — le pattern déjà dénoncé par l'audit (FLOW-002,
                    Phase 0). Affiche désormais la VRAIE facture (créée par
                    laboratory.controller.js::validate à partir du vrai
                    catalogue ExamCatalogue), ou un état honnête d'absence de
                    facture — jamais un montant recalculé localement. */}
                {section === "facturation" && (
                  <div style={{ marginTop:20 }}>
                    <div className="lab-card">
                      <div className="lab-card-hdr"><h3>💰 Facturation des analyses</h3></div>
                      <div style={{ padding:20 }}>
                        {currentInvoice ? (
                          <>
                            <table className="lab-tbl" style={{ marginBottom:20 }}>
                              <thead>
                                <tr><th>Analyse</th><th>Prix unitaire (CFA)</th></tr>
                              </thead>
                              <tbody>
                                {currentInvoice.lignes.map((l, i) => (
                                  <tr key={i}>
                                    <td>{l.libelle}</td>
                                    <td style={{ fontWeight:600 }}>{l.montant.toLocaleString("fr-FR")}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr style={{ background:"linear-gradient(to right,#EEF4FF,#DBEAFE)" }}>
                                  <td style={{ fontWeight:800, fontSize:15, color:"var(--ln)" }}>TOTAL — {currentInvoice.numero_facture}</td>
                                  <td style={{ fontWeight:800, fontSize:16, color:"var(--lb)" }}>
                                    {currentInvoice.montant_ttc.toLocaleString("fr-FR")} CFA
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                            <Badge cls={currentInvoice.statut === "payee" ? "green" : "orange"}>
                              {currentInvoice.statut === "payee" ? "✅ Payée" : "⏳ En attente de paiement"} — voir module Finance pour encaisser
                            </Badge>
                          </>
                        ) : (
                          <div style={{ padding:"24px 4px", color:"var(--lm)", fontSize:13, lineHeight:1.6 }}>
                            {currentAnalyse.statut === "valide"
                              ? "Aucune facture réelle n'a été générée pour cette analyse : les examens demandés ne référencent pas d'entrée réelle du catalogue (saisie antérieure à ce correctif, ou examens en texte libre)."
                              : "Aucune facture pour l'instant — une vraie facture est générée automatiquement, à partir du catalogue réel des examens, au moment de la validation de l'analyse."}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── DOCUMENTS ── */}
                {section === "documents" && (
                  <div style={{ marginTop:20 }}>
                    <div className="lab-card">
                      <div className="lab-card-hdr"><h3>📄 Documents et rapports</h3></div>
                      <div style={{ padding:20, display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:14 }}>
                        {[
                          ["📋","Bon de demande",        "Formulaire de prescription"],
                          ["📊","Bulletin d'analyse",    "Résultats complets"],
                          ["🏷️","Rapport validé",        "Document signé biologiste"],
                          ["💰","Facture laboratoire",   "Détail des actes facturés"],
                          ["📨","Lettre au médecin",     "Transmission résultats"],
                          ["📱","Résumé patient",        "Version simplifiée résultats"],
                        ].map(([icon,title,desc]) => (
                          <div key={title} style={{ background:"#F8FAFD", border:"1.5px solid var(--lbr)", borderRadius:14, padding:16, display:"flex", flexDirection:"column", gap:8 }} onMouseOver={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(11,30,59,.1)"} onMouseOut={e=>e.currentTarget.style.boxShadow="none"}>
                            <div style={{ fontSize:24 }}>{icon}</div>
                            <div style={{ fontWeight:700, color:"var(--ln)", fontSize:13 }}>{title}</div>
                            <div style={{ fontSize:11, color:"var(--lm)" }}>{desc}</div>
                            {/* Sous-phase 5.2 — faux succès (toast.success)
                                sans génération réelle. Aucun moteur de
                                génération de documents n'existe pour ces
                                types dans ce système. */}
                            <button className="lbtn lbtn-ghost lbtn-sm" style={{ marginTop:"auto" }} disabled title="Fonctionnalité en cours de développement — aucune génération réelle de document n'existe pour ce type." onClick={() => toast("🚧 Génération de documents non disponible — fonctionnalité en cours de développement.")}>
                              {I.dl} Générer
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ══ STATISTIQUES ══ */}
          {tab === "stats" && (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"2fr 1fr", gap:20, marginBottom:24 }}>
                <div className="lab-card fu">
                  <div className="lab-card-hdr">
                    <div><h3>{I.trend} Volume d'analyses — 12 mois</h3><p>Nombre d'analyses biologiques mensuelles</p></div>
                  </div>
                  <div style={{ padding:20 }}>
                    <BarChart labels={analysesParMois.labels} data={analysesParMois.data} color="#0EA5A0" />
                  </div>
                </div>
                <div className="lab-card fu">
                  <div className="lab-card-hdr"><div><h3>Examens les plus prescrits</h3></div></div>
                  <div style={{ padding:20 }}>
                    {examensPlusPrescrits.length === 0 && (
                      <div style={{ textAlign:"center", color:"var(--lm)", fontSize:12, padding:12 }}>Aucun examen réel du catalogue prescrit pour l'instant.</div>
                    )}
                    {examensPlusPrescrits.map(([lbl,val,col]) => (
                      <div key={lbl} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:"var(--lm)" }}>
                            <span style={{ width:10, height:10, borderRadius:3, background:col, display:"inline-block" }} />
                            {lbl}
                          </span>
                          <span style={{ fontWeight:700, fontSize:12, color:"var(--ln)" }}>{val}%</span>
                        </div>
                        <Prog pct={val} color={col} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                {/* Sous-phase 5.1 (relecture du 6 sept. 2026) — LIMITE
                    DOCUMENTÉE : aucune taxonomie de catégorie biologique
                    (Biochimie/Hématologie/Parasitologie/Sérologie/Urines)
                    n'existe réellement dans ce système (ni sur LabResult, ni
                    sur ExamCatalogue — vérifié champ par champ). Plutôt que
                    d'inventer une catégorisation ou de fabriquer des taux,
                    ce widget est désactivé honnêtement (option B). */}
                <div className="lab-card fu">
                  <div className="lab-card-hdr"><h3>📊 Taux d'anomalies par catégorie</h3></div>
                  <div style={{ padding:40, textAlign:"center", color:"var(--lm)" }}>
                    <div style={{ fontSize:36, marginBottom:10, opacity:.4 }}>📊</div>
                    <div style={{ fontSize:12 }}>🚧 Indicateur non disponible — aucune catégorie biologique réelle n'est enregistrée sur les analyses dans ce système.</div>
                  </div>
                </div>
                <div className="lab-card fu">
                  <div className="lab-card-hdr"><h3>⏱ Délais moyens de rendu</h3></div>
                  <div style={{ padding:20 }}>
                    {delaisMoyens.rows.length === 0 && (
                      <div style={{ textAlign:"center", color:"var(--lm)", fontSize:12, padding:12 }}>Aucune analyse réellement rendue pour l'instant (date_resultat non renseignée).</div>
                    )}
                    {delaisMoyens.rows.map(([lbl,delai,col]) => (
                      <div key={lbl} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px", background:"#F8FAFD", borderRadius:8, marginBottom:6 }}>
                        <span style={{ fontSize:12, color:"var(--ln)", fontWeight:500 }}>{lbl}</span>
                        <span style={{ fontSize:14, fontWeight:800, color:col }}>{delai}</span>
                      </div>
                    ))}
                    {delaisMoyens.globalLabel && (
                      <div style={{ marginTop:12, background:"linear-gradient(135deg,#EEF4FF,#DBEAFE)", borderRadius:12, padding:"12px 14px" }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"var(--lb)" }}>📈 Délai moyen global</div>
                        <div style={{ fontSize:24, fontWeight:800, color:"var(--ln)", marginTop:4 }}>{delaisMoyens.globalLabel}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ═══ MODAL : NOUVELLE DEMANDE ═══ */}
        <Modal open={modalNouv} onClose={() => setModalNouv(false)} title={<>{I.plus} Nouvelle demande d'analyse</>} maxWidth={760}>
          <form onSubmit={createAnalyse}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14, marginBottom:20 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="llbl">Patient *</label>
                <select className="linp" required value={formNouv.patient_id} onChange={e => {
                  const p = patients.find(x => x._id === e.target.value);
                  setFormNouv(f => ({ ...f, patient_id:e.target.value, patient_nom:p ? `${p.prenom} ${p.nom}` : "", patient_dossier:p?.numero_dossier || "", date_naissance:p?.date_naissance || "", sexe:p?.sexe || "", telephone:p?.telephone || "", consultation:"" }));
                }}>
                  <option value="">— Sélectionner un patient —</option>
                  {patients.map(p => <option key={p._id} value={p._id}>{p.prenom} {p.nom} — {p.numero_dossier}</option>)}
                </select>
              </div>
              {formNouv.patient_id && consultationsPatient.length > 0 && (
                <div style={{ gridColumn:"1/-1" }}>
                  <label className="llbl">Lier à une consultation (FLOW-003, optionnel)</label>
                  <select className="linp" value={formNouv.consultation} onChange={e => setFormNouv(f=>({...f,consultation:e.target.value}))}>
                    <option value="">— Ne pas lier —</option>
                    {consultationsPatient.map(c => <option key={c._id} value={c._id}>{new Date(c.date_consultation).toLocaleDateString('fr-FR')} — {c.diagnostic || 'diagnostic non renseigné'}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="llbl">Service demandeur</label>
                <select className="linp" value={formNouv.service_demandeur} onChange={e => setFormNouv(f=>({...f,service_demandeur:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  {["Consultation","Urgences","Chirurgie","Hospitalisation","Pédiatrie","Maternité","Médecine interne"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="llbl">Médecin prescripteur</label>
                <input className="linp" placeholder="Dr. Nom Prénom" value={formNouv.medecin_prescripteur} onChange={e => setFormNouv(f=>({...f,medecin_prescripteur:e.target.value}))} />
              </div>
              <div>
                <label className="llbl">Niveau d'urgence</label>
                <select className="linp" value={formNouv.niveau_urgence} onChange={e => setFormNouv(f=>({...f,niveau_urgence:e.target.value}))}>
                  <option value="normal">Normal</option>
                  <option value="urgent">🚨 Urgent</option>
                </select>
              </div>
            </div>

            {/* Catalogue d'examens — Correction 1 (relecture du 6 sept. 2026) :
                remplace EXAM_CATALOGUE codé en dur par le vrai catalogue
                (GET /laboratory/catalogue, chargé au montage — loadCatalogue).
                Chaque case coche désormais un vrai _id ExamCatalogue, jamais
                un libellé texte inventé : la facturation automatique posée à
                la validation (laboratory.controller.js) cesse d'être inerte. */}
            <div style={{ marginBottom:16 }}>
              <label className="llbl" style={{ fontSize:13, fontWeight:700, color:"var(--ln)", marginBottom:12, display:"block" }}>
                Examens à prescrire * ({formNouv.examens_demandes.length} sélectionné(s))
              </label>
              {catalogue.length === 0 ? (
                <div style={{ padding:16, textAlign:"center", color:"var(--lm)", fontSize:13, background:"#F8FAFD", borderRadius:12 }}>
                  Aucun examen disponible — le catalogue réel (ExamCatalogue) est vide ou n'a pas pu être chargé.
                </div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>
                  {Object.entries(
                    catalogue.reduce((groups, ex) => {
                      const cat = ex.categorie || "Autres";
                      (groups[cat] = groups[cat] || []).push(ex);
                      return groups;
                    }, {})
                  ).map(([catLabel, examens]) => (
                    <div key={catLabel} style={{ background:"#F8FAFD", borderRadius:12, padding:"12px 14px", border:"1.5px solid var(--lbr)" }}>
                      <div style={{ fontSize:12, fontWeight:700, color:"var(--ln)", marginBottom:8 }}>{catLabel}</div>
                      <div className="chk-group">
                        {examens.map(ex => (
                          <div key={ex._id} className="chk-item" onClick={() => toggleExamen(ex._id)}>
                            <input type="checkbox" readOnly checked={formNouv.examens_demandes.includes(ex._id)} />
                            <label style={{ flex:1 }}>{ex.nom}</label>
                            <span style={{ fontSize:11, color:"var(--lm)", fontWeight:600 }}>{Number(ex.prix || 0).toLocaleString("fr-FR")} CFA</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom:14 }}>
              <label className="llbl">Autres examens spécifiques</label>
              <input className="linp" placeholder="Précisez ici tout autre examen particulier..." value={formNouv.autres_examens || ""} onChange={e => setFormNouv(f=>({...f,autres_examens:e.target.value}))} />
            </div>

            {formNouv.examens_demandes.length > 0 && (
              <div style={{ background:"linear-gradient(135deg,#EEF4FF,#DBEAFE)", borderRadius:12, padding:"12px 16px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:13, color:"var(--lb)", fontWeight:600 }}>Total estimé :</span>
                <span style={{ fontSize:18, fontWeight:800, color:"var(--lb)" }}>
                  {getPrixTotal(formNouv.examens_demandes).toLocaleString("fr-FR")} CFA
                </span>
              </div>
            )}

            <div style={{ display:"flex", gap:10 }}>
              <button type="button" className="lbtn lbtn-ghost" onClick={() => setModalNouv(false)}>Annuler</button>
              <button type="submit" className="lbtn lbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>
                {I.save} {saving ? "Création..." : "Créer la demande d'analyse"}
              </button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : PRÉLÈVEMENT ═══ */}
        <Modal open={modalPrelevement} onClose={() => setModalPrelevement(false)} title="🩸 Enregistrement du prélèvement" maxWidth={480}>
          <form onSubmit={savePrelevement}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label className="llbl">Type d'échantillon *</label>
                <select className="linp" required value={formPrelev.type_echantillon} onChange={e => setFormPrelev(f=>({...f,type_echantillon:e.target.value}))}>
                  <option value="sang">🩸 Sang</option>
                  <option value="urine">🧪 Urine</option>
                  <option value="selles">💩 Selles</option>
                  <option value="crachat">🫁 Crachat / LBA</option>
                  <option value="lba">🫁 Liquide de ponction</option>
                  <option value="autre">📦 Autre</option>
                </select>
              </div>
              <div>
                <label className="llbl">Nom du préleveur *</label>
                <input className="linp" required placeholder="Infirmier(ère) / Technicien(ne)" value={formPrelev.preleveur} onChange={e => setFormPrelev(f=>({...f,preleveur:e.target.value}))} />
              </div>
              <div>
                <label className="llbl">Observations / Conditions de prélèvement</label>
                <textarea className="linp" rows={3} placeholder="Ex: À jeun depuis 12h, patient agité, veine difficile..." value={formPrelev.observations_prelevement} onChange={e => setFormPrelev(f=>({...f,observations_prelevement:e.target.value}))} />
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="lbtn lbtn-ghost" onClick={() => setModalPrelevement(false)}>Annuler</button>
                <button type="submit" className="lbtn lbtn-primary" style={{ marginLeft:"auto" }} disabled={saving}>
                  🩸 {saving ? "Enregistrement..." : "Enregistrer le prélèvement"}
                </button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : SAISIE RÉSULTATS ═══ */}
        <Modal open={modalResultats} onClose={() => setModalResultats(false)} title="🔬 Saisie des résultats" maxWidth={640}>
          <form onSubmit={saveResultats}>
            {currentAnalyse && (
              <div>
                <div style={{ background:"#EEF4FF", borderRadius:12, padding:"12px 14px", marginBottom:16, fontSize:13, color:"var(--lb)" }}>
                  Patient : <strong>{currentAnalyse.patient_nom}</strong> · {currentAnalyse.examens_demandes?.length} examen(s) à saisir
                </div>
                <div style={{ marginBottom:16 }}>
                  <table className="res-tbl">
                    <thead><tr><th>Analyse</th><th>Résultat saisi</th><th>Valeurs normales</th><th>Unité</th><th>Statut</th></tr></thead>
                    <tbody>
                      {(currentAnalyse.examens_demandes || []).map(eid => {
                        const statutRes = formResStatut[eid] || "normal";
                        return (
                          <tr key={eid}>
                            <td style={{ fontWeight:600, color:"var(--ln)", whiteSpace:"nowrap" }}>{examLabel(eid)}</td>
                            <td>
                              <input
                                className="linp"
                                style={{ padding:"6px 10px", fontSize:13 }}
                                placeholder="Ex: 1.05"
                                value={formRes[eid] || ""}
                                onChange={e => setFormRes(f => ({ ...f, [eid]:e.target.value }))}
                              />
                            </td>
                            <td style={{ fontSize:12, color:"var(--lm)", whiteSpace:"nowrap" }}>{examRef(eid)}</td>
                            <td style={{ fontSize:12, color:"var(--lm)" }}>{examUnite(eid)}</td>
                            <td>
                              <select
                                className="linp"
                                style={{ padding:"6px 8px", fontSize:12, fontWeight:600, color: statutRes==="critique" ? "#DC2626" : statutRes==="anormal" ? "#D97706" : "var(--ln)" }}
                                value={statutRes}
                                onChange={e => setFormResStatut(s => ({ ...s, [eid]:e.target.value }))}
                              >
                                <option value="normal">Normal</option>
                                <option value="anormal">Anormal</option>
                                <option value="critique">⚡ Critique</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginBottom:16 }}>
                  <label className="llbl">Commentaire préliminaire</label>
                  <textarea className="linp" rows={2} placeholder="Commentaire du technicien..." value={formValid.commentaire_biologiste} onChange={e => setFormValid(f=>({...f,commentaire_biologiste:e.target.value}))} />
                </div>
                <div style={{ display:"flex", gap:10 }}>
                  <button type="button" className="lbtn lbtn-ghost" onClick={() => setModalResultats(false)}>Annuler</button>
                  <button type="submit" className="lbtn lbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>
                    {I.save} {saving ? "Enregistrement..." : "Enregistrer les résultats"}
                  </button>
                </div>
              </div>
            )}
          </form>
        </Modal>

        {/* ═══ MODAL : VALIDATION ═══ */}
        <Modal open={modalValider} onClose={() => setModalValider(false)} title="🏷️ Validation des résultats" maxWidth={500}>
          <form onSubmit={validerAnalyse}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div className="al-ia" style={{ fontSize:13, color:"var(--lb)" }}>
                <strong>Confirmation requise :</strong> La validation engage la responsabilité médicale du biologiste signataire.
              </div>
              {(() => {
                const critiques = asArr(currentAnalyse?.resultats).filter(r => r.statut_res === "critique");
                if (critiques.length === 0) return null;
                return (
                  <div style={{ background:"#FEF2F2", border:"1px solid #FCA5A5", borderRadius:10, padding:"10px 14px", fontSize:12.5, color:"#991B1B" }}>
                    ⚡ <strong>{critiques.length} résultat(s) marqué(s) critique</strong> à l'étape de saisie :
                    <ul style={{ margin:"6px 0 0", paddingLeft:18 }}>
                      {critiques.map(r => <li key={r.exam_id}>{r.exam_nom || examLabel(r.exam_id)} : {r.valeur} {r.unite || examUnite(r.exam_id)}</li>)}
                    </ul>
                  </div>
                );
              })()}
              <label style={{ display:"flex", alignItems:"flex-start", gap:10, background:formValid.est_critique_confirme ? "#FEF2F2" : "#F8FAFC", border:`1.5px solid ${formValid.est_critique_confirme ? "#FCA5A5" : "#E2E8F0"}`, borderRadius:10, padding:"10px 14px", cursor:"pointer" }}>
                <input
                  type="checkbox"
                  checked={formValid.est_critique_confirme}
                  onChange={e => setFormValid(f => ({ ...f, est_critique_confirme: e.target.checked }))}
                  style={{ marginTop:2 }}
                />
                <span style={{ fontSize:12.5, color:formValid.est_critique_confirme ? "#991B1B" : "var(--ln)" }}>
                  <strong>Résultat critique — notifier le médecin prescripteur.</strong>{" "}
                  {asArr(currentAnalyse?.resultats).some(r => r.statut_res === "critique")
                    ? "Pré-cochée d'après les résultats marqués critiques à la saisie — décochez si vous jugez, après relecture, qu'aucune notification n'est nécessaire."
                    : "Aucun résultat n'a été marqué critique à la saisie — cochez ici si votre relecture clinique justifie tout de même une notification."}
                </span>
              </label>
              {/* LAB-03 — mêmes champs texte requis mais jamais persistés retirés
                  qu'au-dessus, remplacés par l'identité réelle (voir plus haut). */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                <div style={{ background:"#F8FAFD", borderRadius:10, padding:"12px 14px" }}>
                  <div style={{ fontSize:10, fontWeight:600, color:"var(--lm)", textTransform:"uppercase", letterSpacing:.4 }}>Technicien de laboratoire</div>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--ln)", marginTop:4 }}>{currentAnalyse?.technicien_nom || fmtUser(currentAnalyse?.technicien) || "—"}</div>
                </div>
                <div style={{ background:"#F8FAFD", borderRadius:10, padding:"12px 14px" }}>
                  <div style={{ fontSize:10, fontWeight:600, color:"var(--lm)", textTransform:"uppercase", letterSpacing:.4 }}>Biologiste responsable (vous)</div>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--ln)", marginTop:4 }}>{fmtUser(authUser) || "—"}</div>
                </div>
              </div>
              <div>
                <label className="llbl">Commentaire / Interprétation clinique</label>
                <textarea className="linp" rows={3} placeholder="Analyse globale des résultats, conduite à tenir recommandée..." value={formValid.commentaire_biologiste} onChange={e => setFormValid(f=>({...f,commentaire_biologiste:e.target.value}))} />
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="lbtn lbtn-ghost" onClick={() => setModalValider(false)}>Annuler</button>
                <button type="submit" className="lbtn lbtn-green" style={{ marginLeft:"auto" }} disabled={saving}>
                  🏷️ {saving ? "Validation..." : "Valider et signer"}
                </button>
              </div>
            </div>
          </form>
        </Modal>

      </div>
    </>
  );
}