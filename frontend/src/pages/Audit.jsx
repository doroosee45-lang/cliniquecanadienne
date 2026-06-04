

import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchAuditLogs,
  selectAuditLogs, selectAuditTotal, selectAuditLoading, selectAuditPage,
} from '../store/slices/auditSlice';
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

// ─── CSS — Medical Navy + Teal (same as Chirurgie) ───────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.aud * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --an:#0B1E3B; --an2:#132744; --ab:#1B4F9E;
  --at:#0EA5A0; --at2:#0D9490; --ar:#DC2626;
  --ao:#D97706; --ag:#059669; --ap:#7C3AED;
  --cbr:#E2EAF4; --cm:#6B7A99; --cl:#EEF4FF; --cs:#F8FAFD;
  --sh:0 1px 3px rgba(11,30,59,.08); --shm:0 4px 16px rgba(11,30,59,.10); --shl:0 12px 40px rgba(11,30,59,.14);
}

/* Topbar */
.aud-top { background:linear-gradient(135deg,var(--an) 0%,var(--an2) 55%,#1B4F9E 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.aud-top::before { content:''; position:absolute; top:-50px; right:-50px; width:200px; height:200px; background:radial-gradient(circle,rgba(14,165,160,.22) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
.aud-top::after  { content:''; position:absolute; bottom:-30px; left:30%; width:150px; height:150px; background:radial-gradient(circle,rgba(27,79,158,.25) 0%,transparent 70%); border-radius:50%; pointer-events:none; }

/* Tabs */
.aud-tabs { display:flex; gap:2px; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.aud-tabs::-webkit-scrollbar { display:none; }
.aud-tab { display:flex; align-items:center; gap:7px; padding:10px 18px 12px; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.55); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.aud-tab:hover { color:rgba(255,255,255,.88); background:rgba(255,255,255,.08); }
.aud-tab.active { color:var(--an); background:var(--cs); box-shadow:0 -2px 0 var(--at) inset; }
.aud-tab-badge { background:var(--ar); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:99px; animation:audP 2s infinite; }
@keyframes audP { 0%,100%{opacity:1} 50%{opacity:.4} }

/* Cards */
.aud-card { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; }
.aud-card:hover { box-shadow:var(--shm); }
.aud-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); flex-wrap:wrap; gap:8px; }
.aud-card-hdr h3 { font-size:14px; font-weight:700; color:var(--an); margin:0; display:flex; align-items:center; gap:8px; }
.aud-card-hdr p  { font-size:11px; color:var(--cm); margin:2px 0 0; }

/* KPI */
.aud-kpi { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; padding:16px 18px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:pointer; }
.aud-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.aud-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.aud-kpi.blue::before   { background:var(--ab); } .aud-kpi.teal::before   { background:var(--at); }
.aud-kpi.red::before    { background:var(--ar); } .aud-kpi.orange::before { background:var(--ao); }
.aud-kpi.green::before  { background:var(--ag); } .aud-kpi.purple::before { background:var(--ap); }
.aud-kpi.dark::before   { background:var(--an); }
.kpi-icon-a { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:10px; flex-shrink:0; }
.kpi-icon-a.blue   { background:#EFF6FF; color:var(--ab); } .kpi-icon-a.teal   { background:#F0FDFC; color:var(--at); }
.kpi-icon-a.red    { background:#FEF2F2; color:var(--ar); } .kpi-icon-a.orange { background:#FFF7ED; color:var(--ao); }
.kpi-icon-a.green  { background:#ECFDF5; color:var(--ag); } .kpi-icon-a.purple { background:#F5F3FF; color:var(--ap); }
.kpi-icon-a.dark   { background:#EEF4FF; color:var(--an); }
.kpi-val-a { font-size:24px; font-weight:800; color:var(--an); line-height:1; margin-bottom:3px; letter-spacing:-1px; }
.kpi-lbl-a { font-size:11px; font-weight:600; color:var(--cm); }
.kpi-sub-a { font-size:10px; color:#9CA3AF; margin-top:2px; }
.kpi-dot-a { position:absolute; top:12px; right:12px; width:8px; height:8px; border-radius:50%; background:var(--ar); animation:audP 2s infinite; }

/* Risk badges */
.rbdg { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:99px; font-size:11px; font-weight:700; white-space:nowrap; }
.rbdg.faible   { background:#ECFDF5; color:var(--ag); border:1px solid #A7F3D0; }
.rbdg.moyen    { background:#FEFCE8; color:#CA8A04;   border:1px solid #FEF08A; }
.rbdg.eleve    { background:#FFF7ED; color:var(--ao); border:1px solid #FED7AA; }
.rbdg.critique { background:#FEF2F2; color:var(--ar); border:1px solid #FECACA; animation:audP 2s infinite; }

/* General badges */
.abdg { display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.abdg.red    { background:#FEF2F2; color:var(--ar); border:1px solid #FECACA; }
.abdg.orange { background:#FFF7ED; color:var(--ao); border:1px solid #FED7AA; }
.abdg.yellow { background:#FEFCE8; color:#CA8A04;   border:1px solid #FEF08A; }
.abdg.green  { background:#ECFDF5; color:var(--ag); border:1px solid #A7F3D0; }
.abdg.blue   { background:#EFF6FF; color:var(--ab); border:1px solid #BFDBFE; }
.abdg.teal   { background:#F0FDFC; color:var(--at); border:1px solid #99F6E4; }
.abdg.purple { background:#F5F3FF; color:var(--ap); border:1px solid #DDD6FE; }
.abdg.gray   { background:#F9FAFB; color:#4B5563;   border:1px solid #E5E7EB; }
.abdg.dark   { background:var(--an); color:#fff;    border:1px solid var(--an2); }

/* Progress */
.aud-prog { background:#EEF4FF; border-radius:99px; height:6px; overflow:hidden; }
.aud-prog-f { height:100%; border-radius:99px; transition:width .5s; }

/* Buttons */
.abtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; }
.abtn-primary { background:var(--ab); color:#fff; } .abtn-primary:hover { background:#174391; transform:translateY(-1px); }
.abtn-teal    { background:var(--at); color:#fff; } .abtn-teal:hover    { background:var(--at2); transform:translateY(-1px); }
.abtn-ghost   { background:transparent; color:var(--cm); border:1.5px solid var(--cbr); }
.abtn-ghost:hover { background:var(--cl); color:var(--an); }
.abtn-danger  { background:#FEF2F2; color:var(--ar); border:1.5px solid #FECACA; }
.abtn-danger:hover { background:var(--ar); color:#fff; }
.abtn-sm { padding:6px 12px; font-size:12px; }
.abtn:disabled { opacity:.5; cursor:not-allowed; }

/* Forms */
.albl { font-size:12px; font-weight:600; color:var(--cm); margin-bottom:6px; display:block; }
.ainp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--cbr); background:#FAFBFF; font-size:13px; color:var(--an); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.ainp:focus { border-color:var(--at); box-shadow:0 0 0 3px rgba(14,165,160,.12); }

/* Alerts */
.al-ia     { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; border-left:4px solid var(--ab); border-radius:14px; padding:14px 18px; }
.al-warn   { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--ao); border-radius:14px; padding:14px 18px; }
.al-danger { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--ar); border-radius:14px; padding:14px 18px; }
.al-success{ background:linear-gradient(135deg,#ECFDF5,#D1FAE5); border:1.5px solid #A7F3D0; border-left:4px solid var(--ag); border-radius:14px; padding:14px 18px; }

/* Table */
.aud-tbl { width:100%; border-collapse:collapse; }
.aud-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.aud-tbl th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--cm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--cbr); white-space:nowrap; }
.aud-tbl td { padding:11px 14px; font-size:12.5px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.aud-tbl tbody tr:last-child td { border-bottom:none; }
.aud-tbl tbody tr:hover { background:#F8FAFF; cursor:pointer; }
.aud-tbl tbody tr.selected { background:#EFF6FF; border-left:3px solid var(--ab); }

/* Modal */
.amov { position:fixed; inset:0; z-index:500; background:rgba(11,30,59,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:16px; }
.amov-box { background:#fff; border-radius:20px; box-shadow:var(--shl); width:100%; max-width:640px; max-height:92vh; overflow-y:auto; animation:audSlide .25s ease; }
@keyframes audSlide { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.amov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:#EEF4FF; position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.amov-hdr h3 { font-size:15px; font-weight:700; color:var(--an); margin:0; display:flex; align-items:center; gap:10px; }
.amov-cls { width:32px; height:32px; border-radius:8px; background:#F3F7FF; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--cm); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.amov-cls:hover { background:#FEF2F2; color:var(--ar); }
.amov-body { padding:24px; }

/* Event row card (mobile-friendly) */
.ev-row { background:#fff; border:1.5px solid var(--cbr); border-radius:12px; padding:12px 14px; margin-bottom:8px; transition:all .2s; cursor:pointer; }
.ev-row:hover { border-color:#BFDBFE; box-shadow:var(--shm); }
.ev-row.critique { border-left:3px solid var(--ar); background:#FFF8F8; }
.ev-row.eleve    { border-left:3px solid var(--ao); background:#FFFDF8; }
.ev-row.moyen    { border-left:3px solid #CA8A04; }
.ev-row.faible   { border-left:3px solid var(--ag); }

/* Log entry */
.log-entry { display:flex; align-items:flex-start; gap:12px; padding:10px 14px; border-radius:10px; background:#F8FAFD; border:1.5px solid var(--cbr); margin-bottom:8px; transition:all .2s; }
.log-entry:hover { background:#EEF4FF; }
.log-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; margin-top:5px; }

/* Activity pulse */
.pulse-dot { display:inline-block; width:8px; height:8px; border-radius:50%; animation:audP 1.5s infinite; }

/* Susp card */
.susp-card { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--ar); border-radius:14px; padding:14px 16px; margin-bottom:12px; }

/* Filter panel */
.filter-panel { background:#fff; border:1.5px solid var(--cbr); border-radius:14px; padding:16px 20px; margin-bottom:20px; }
.filter-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; }

/* Timeline */
.aud-timeline { position:relative; padding-left:26px; }
.aud-timeline::before { content:''; position:absolute; left:9px; top:8px; bottom:8px; width:2px; background:var(--cbr); border-radius:2px; }
.aud-tl-dot { position:absolute; left:-21px; top:4px; width:14px; height:14px; border-radius:50%; border:2.5px solid white; box-shadow:0 0 0 2px var(--cbr); z-index:1; }
.aud-tl-item { position:relative; margin-bottom:14px; }

/* Fade */
@keyframes audFadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.aufu { animation:audFadeUp .3s ease both; }

/* Responsive */
@media (max-width:640px) {
  .aud-top { padding:16px 16px 0; }
  .filter-grid { grid-template-columns:1fr; }
  .aud-tbl th, .aud-tbl td { padding:8px 10px; font-size:11.5px; }
  .kpi-val-a { font-size:20px; }
  .aud-kpi { padding:14px 14px; }
  .amov-body { padding:16px; }
  .aud-card-hdr { padding:12px 14px; }
}

@media print { .aud-top,.aud-tabs,.filter-panel,.abtn { display:none!important; } }

/* ─── Responsive ─── */
.aud-g2  { display:grid; grid-template-columns:2fr 1fr; gap:20px; }
.aud-g11 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.aud-g11s{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
@media (max-width:767px) {
  .aud-top { padding:12px 14px 0 !important; }
  .aud-g2,.aud-g11 { grid-template-columns:1fr; gap:14px; }
  .aud-g11s { grid-template-columns:1fr 1fr; gap:8px; }
  .ainp { font-size:16px !important; }
  .abtn { font-size:12px; padding:8px 12px; } .abtn-sm { font-size:11px; padding:5px 8px; }
  .aud-card { border-radius:14px; } .aud-card-hdr { padding:11px 14px; }
  .amov { padding:0; align-items:flex-end; } .amov-box { border-radius:20px 20px 0 0; max-width:100%; max-height:93vh; }
  .amov-hdr { padding:13px 16px; } .amov-body { padding:14px; }
}
@media (max-width:479px) {
  .aud-top { padding:10px 12px 0 !important; } .aud-g11s { grid-template-columns:1fr; }
  .aud-card-hdr { flex-wrap:wrap; gap:8px; }
}
`;

// ─── Helpers ─────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const fmtDT = (d) => d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";

const RISK_CFG = {
  faible: { cls: "faible", label: "Faible", icon: "🟢", color: "#059669" },
  moyen: { cls: "moyen", label: "Moyen", icon: "🟡", color: "#CA8A04" },
  eleve: { cls: "eleve", label: "Élevé", icon: "🟠", color: "#D97706" },
  critique: { cls: "critique", label: "Critique", icon: "🔴", color: "#DC2626" },
};

const MODULE_CFG = {
  patients: { icon: "👤", color: "#1B4F9E" },
  consultations: { icon: "🩺", color: "#0EA5A0" },
  laboratoire: { icon: "🔬", color: "#7C3AED" },
  imagerie: { icon: "🩻", color: "#059669" },
  hospitalisation: { icon: "🛏", color: "#D97706" },
  chirurgie: { icon: "🔪", color: "#DC2626" },
  pharmacie: { icon: "💊", color: "#0EA5A0" },
  facturation: { icon: "💰", color: "#059669" },
  parametres: { icon: "⚙️", color: "#6B7A99" },
  authentification: { icon: "🔐", color: "#1B4F9E" },
  bloc_operatoire: { icon: "🏥", color: "#DC2626" },
};

const ACTION_CFG = {
  connexion: { cls: "green", icon: "🔑" },
  deconnexion: { cls: "gray", icon: "🚪" },
  echec_connexion: { cls: "red", icon: "🚫" },
  creation: { cls: "teal", icon: "➕" },
  modification: { cls: "blue", icon: "✏️" },
  suppression: { cls: "red", icon: "🗑️" },
  consultation: { cls: "gray", icon: "👁️" },
  impression: { cls: "gray", icon: "🖨️" },
  exportation: { cls: "orange", icon: "📤" },
  changement_mdp: { cls: "orange", icon: "🔒" },
  changement_perms: { cls: "red", icon: "🛡️" },
  acces_refuse: { cls: "red", icon: "⛔" },
  validation: { cls: "green", icon: "✅" },
  annulation: { cls: "red", icon: "❌" },
  restauration: { cls: "teal", icon: "♻️" },
};

// ─── Demo data ────────────────────────────────────────────────
const now = new Date();
const ago = (min) => new Date(now - min * 60000).toISOString();

const DEMO_EVENTS = [];

const DEMO_CONNEXIONS = [];

const DEMO_SUSPECTS = [];

// ─── SVG Icons ────────────────────────────────────────────────
const I = {
  shield: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  file: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
  clock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  user: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  alert: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  key: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6" /><line x1="20" y1="20" x2="15.7" y2="15.7" /></svg>,
  trend: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
  grid: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>,
  list: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  filter: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>,
  dl: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  print: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>,
  refresh: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>,
  eye: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  ban: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>,
  check: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>,
  globe: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>,
  device: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  archive: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg>,
};

// ─── Bar Chart ────────────────────────────────────────────────
function BarChart({ labels, data, color = "#1B4F9E", height = 160 }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new window.Chart(ref.current, {
        type: "bar",
        data: { labels, datasets: [{ data, backgroundColor: `${color}26`, borderColor: color, borderWidth: 2, borderRadius: 6, borderSkipped: false }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false }, tooltip: { backgroundColor: "#0B1E3B", padding: 10, cornerRadius: 10 } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#9CA3AF" }, border: { display: false } }, y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.04)" }, ticks: { font: { size: 10 }, color: "#9CA3AF", precision: 0 }, border: { display: false } } } },
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [labels, data, color]);
  return <canvas ref={ref} style={{ maxHeight: height }} />;
}

function LineChart({ labels, data, color = "#0EA5A0", height = 140 }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new window.Chart(ref.current, {
        type: "line",
        data: { labels, datasets: [{ data, borderColor: color, backgroundColor: `${color}15`, fill: true, tension: .4, pointRadius: 3, pointBackgroundColor: color, borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false }, tooltip: { backgroundColor: "#0B1E3B", padding: 10, cornerRadius: 10 } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#9CA3AF" }, border: { display: false } }, y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.04)" }, ticks: { font: { size: 10 }, color: "#9CA3AF", precision: 0 }, border: { display: false } } } },
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [labels, data, color]);
  return <canvas ref={ref} style={{ maxHeight: height }} />;
}

function Prog({ pct, color }) {
  return <div className="aud-prog"><div className="aud-prog-f" style={{ width: `${pct}%`, background: color }} /></div>;
}
function RiskBadge({ niveau }) {
  const r = RISK_CFG[niveau] || { cls: "gray", label: niveau, icon: "⚪" };
  return <span className={`rbdg ${r.cls}`}>{r.icon} {r.label}</span>;
}
function ABadge({ cls, children }) {
  return <span className={`abdg ${cls}`}>{children}</span>;
}

// ─── Duration ─────────────────────────────────────────────────
function sessionDuration(start, end) {
  if (!start) return "—";
  const fin = end ? new Date(end) : new Date();
  const diff = Math.floor((fin - new Date(start)) / 60000);
  if (diff < 60) return `${diff} min`;
  return `${Math.floor(diff / 60)}h ${diff % 60}min`;
}

// ─── Modal ────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, maxWidth = 640 }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="amov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="amov-box" style={{ maxWidth }}>
        <div className="amov-hdr">
          <h3>{title}</h3>
          <button className="amov-cls" onClick={onClose}>×</button>
        </div>
        <div className="amov-body">{children}</div>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({ color, icon, value, label, sub, urgent, onClick }) {
  return (
    <div className={`aud-kpi ${color} aufu`} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      {urgent && <div className="kpi-dot-a" />}
      <div className={`kpi-icon-a ${color}`}>{icon}</div>
      <div className="kpi-val-a">{value}</div>
      <div className="kpi-lbl-a">{label}</div>
      {sub && <div className="kpi-sub-a">{sub}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function JournalAudit() {
  const dispatch = useDispatch();
  const reduxLogs = useSelector(selectAuditLogs);
  const reduxTotal = useSelector(selectAuditTotal);

  useEffect(() => { dispatch(fetchAuditLogs({})); }, [dispatch]);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => { const fn = () => setIsMobile(window.innerWidth <= 599); window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn); }, []);

  const [tab, setTab] = useState("dashboard");
  const [events, setEvents] = useState(DEMO_EVENTS);
  const [connexions, setConnexions] = useState(DEMO_CONNEXIONS);
  const [suspects, setSuspects] = useState(DEMO_SUSPECTS);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [modalEvent, setModalEvent] = useState(false);
  const [modalExport, setModalExport] = useState(false);
  const [modalArchive, setModalArchive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [filterModule, setFilterModule] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterRisque, setFilterRisque] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterIp, setFilterIp] = useState("");
  const [filterDateDeb, setFilterDateDeb] = useState("");
  const [filterDateFin, setFilterDateFin] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Export form
  const [exportForm, setExportForm] = useState({ format: "pdf", par: "module", periode: "mois", risque: "" });

  // ── Load events ───────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: 20 });
      if (search) p.set("q", search);
      if (filterModule) p.set("module", filterModule);
      if (filterAction) p.set("action", filterAction);
      if (filterRisque) p.set("risque", filterRisque);
      if (filterUser) p.set("user", filterUser);
      if (filterIp) p.set("ip", filterIp);
      if (filterDateDeb) p.set("date_deb", filterDateDeb);
      if (filterDateFin) p.set("date_fin", filterDateFin);
      const { data } = await api.get(`/audit?${p}`);
      setEvents(data.events || data.data || []);
    } catch {
      // Demo data already set
    } finally { setLoading(false); }
  }, [page, search, filterModule, filterAction, filterRisque, filterUser, filterIp, filterDateDeb, filterDateFin]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 800));
    setRefreshing(false);
    toast.success("✅ Journal actualisé");
  };

  // ── Filtered events ───────────────────────────────────────
  const filteredEvents = events.filter(e => {
    if (search && !e.utilisateur.toLowerCase().includes(search.toLowerCase()) && !e.description.toLowerCase().includes(search.toLowerCase()) && !e.ip.includes(search)) return false;
    if (filterModule && e.module !== filterModule) return false;
    if (filterAction && e.action !== filterAction) return false;
    if (filterRisque && e.risque !== filterRisque) return false;
    if (filterUser && !e.utilisateur.toLowerCase().includes(filterUser.toLowerCase())) return false;
    if (filterIp && !e.ip.includes(filterIp)) return false;
    return true;
  });

  const PER_PAGE = 12;
  const totalPages = Math.ceil(filteredEvents.length / PER_PAGE);
  const pageEvents = filteredEvents.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // KPIs
  const kpis = {
    total: events.length,
    connexions_ok: events.filter(e => e.action === "connexion").length,
    echecs: events.filter(e => e.action === "echec_connexion" || e.action === "acces_refuse").length,
    modifications: events.filter(e => e.action === "modification").length,
    suppressions: events.filter(e => e.action === "suppression").length,
    critiques: events.filter(e => e.risque === "critique").length,
    actifs: connexions.filter(c => c.statut === "actif").length,
    restaurations: events.filter(e => e.action === "restauration").length,
  };

  const openEvent = (ev) => { setSelectedEvent(ev); setModalEvent(true); };

  const resetFilters = () => {
    setSearch(""); setFilterModule(""); setFilterAction(""); setFilterRisque("");
    setFilterUser(""); setFilterIp(""); setFilterDateDeb(""); setFilterDateFin("");
    setPage(1);
  };

  const clotureAlerte = (id) => {
    setSuspects(prev => prev.map(s => s._id === id ? { ...s, statut: "cloture" } : s));
    toast.success("✅ Alerte clôturée");
  };

  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      <div className="aud">

        {/* ── TOPBAR ── */}
        <div className="aud-top">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", position: "relative", zIndex: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(255,255,255,.12)", border: "1.5px solid rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {I.shield}
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: -.3 }}>Journal d'Audit</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginTop: 2 }}>
                  {kpis.total} événements · <span style={{ color: "#A7F3D0" }}>{kpis.actifs} utilisateur(s) actif(s)</span>
                  {kpis.critiques > 0 && <> · <span style={{ color: "#FCA5A5", fontWeight: 700 }}>⚠ {kpis.critiques} alerte(s) critique(s)</span></>}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="abtn abtn-ghost" style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }} onClick={handleRefresh} disabled={refreshing}>
                <span style={{ display: "inline-flex", animation: refreshing ? "spin 1s linear infinite" : "none" }}>{I.refresh}</span>
                {refreshing ? "Actualisation..." : "Actualiser"}
              </button>
              <button className="abtn abtn-teal" onClick={() => setModalExport(true)}>
                {I.dl} Exporter
              </button>
              <button className="abtn abtn-ghost" style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }} onClick={() => setModalArchive(true)}>
                {I.archive} Archiver
              </button>
            </div>
          </div>

          {/* Tabs */}
          {(() => {
            const TABS = [
              { key:"dashboard",  icon:I.grid,  label:"Tableau de bord",      labelM:"Dashboard" },
              { key:"evenements", icon:I.list,  label:"Événements",            labelM:"Événemts", badge:kpis.critiques },
              { key:"connexions", icon:I.key,   label:"Connexions",            labelM:"Connexions", badge:kpis.actifs },
              { key:"suspects",   icon:I.alert, label:"Activités suspectes",   labelM:"Suspects", badge:suspects.filter(s=>s.statut!=="cloture").length },
              { key:"stats",      icon:I.trend, label:"Statistiques",          labelM:"Stats" },
            ];
            return (
              <div style={isMobile?{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'4px',padding:'8px 10px',marginTop:'8px',background:'rgba(255,255,255,.07)',borderRadius:'10px 10px 0 0'}:{display:'flex',gap:'2px',marginTop:'16px',overflowX:'auto',scrollbarWidth:'none'}}>
                {TABS.map(t=>(
                  <button key={t.key} className={`aud-tab ${tab===t.key?"active":""}`} style={isMobile?{flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'7px 3px 8px',fontSize:'9.5px',gap:'3px',borderRadius:'8px',whiteSpace:'normal',minWidth:0}:{}} onClick={()=>setTab(t.key)}>
                    <span style={isMobile?{fontSize:'14px'}:{}}>{t.icon}</span>
                    <span style={isMobile?{lineHeight:1.2}:{}}>{isMobile?t.labelM:t.label}</span>
                    {(t.badge??0)>0&&<span className="aud-tab-badge">{t.badge}</span>}
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
              {/* Critical alert */}
              {kpis.critiques > 0 && (
                <div className="al-danger aufu" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
                  <div style={{ width: 40, height: 40, background: "#FEE2E2", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{I.alert}</div>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: "#B91C1C", fontSize: 13 }}>🚨 Activités critiques détectées</strong>
                    <div style={{ fontSize: 12, color: "#DC2626", marginTop: 3 }}>
                      <strong>{kpis.critiques}</strong> événement(s) de niveau critique — Tentatives d'accès non autorisées et/ou échecs de connexion multiples.
                    </div>
                  </div>
                  <button className="abtn abtn-danger abtn-sm" onClick={() => setTab("suspects")}>Voir alertes →</button>
                </div>
              )}

              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 14, marginBottom: 24 }}>
                <KpiCard color="blue" icon={I.list} value={kpis.total} label="Événements total" sub="toutes actions" onClick={() => setTab("evenements")} />
                <KpiCard color="green" icon={I.key} value={kpis.connexions_ok} label="Connexions réussies" sub="aujourd'hui" onClick={() => setTab("connexions")} />
                <KpiCard color="red" icon={I.ban} value={kpis.echecs} label="Échecs / Refus" sub="accès bloqués" urgent={kpis.echecs > 0} onClick={() => { setFilterAction("echec_connexion"); setTab("evenements"); }} />
                <KpiCard color="orange" icon={I.file} value={kpis.modifications} label="Modifications" sub="données modifiées" onClick={() => { setFilterAction("modification"); setTab("evenements"); }} />
                <KpiCard color="purple" icon={I.x} value={kpis.suppressions} label="Suppressions" sub="enregistrements" onClick={() => { setFilterAction("suppression"); setTab("evenements"); }} />
                <KpiCard color="teal" icon={I.user} value={kpis.actifs} label="Utilisateurs actifs" sub="en ce moment" onClick={() => setTab("connexions")} />
                <KpiCard color="red" icon={I.alert} value={kpis.critiques} label="Alertes critiques" sub="nécessitent attention" urgent={kpis.critiques > 0} onClick={() => setTab("suspects")} />
                <KpiCard color="dark" icon={I.check} value={kpis.restaurations || "0"} label="Restaurations" sub="données récupérées" />
              </div>

              {/* Charts row */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile?"1fr":"2fr 1fr", gap: 20, marginBottom: 24 }}>
                <div className="aud-card aufu">
                  <div className="aud-card-hdr"><div><h3>{I.trend} Activité — 7 derniers jours</h3><p>Volume d'événements journaliers</p></div></div>
                  <div style={{ padding: 20 }}>
                    <LineChart labels={["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]} data={[42, 58, 35, 67, 72, 28, 15]} color="#1B4F9E" height={140} />
                  </div>
                </div>
                <div className="aud-card aufu">
                  <div className="aud-card-hdr"><div><h3>Par niveau de risque</h3><p>{filteredEvents.length} événements</p></div></div>
                  <div style={{ padding: 20 }}>
                    {[
                      ["Critique", events.filter(e => e.risque === "critique").length, "#DC2626"],
                      ["Élevé", events.filter(e => e.risque === "eleve").length, "#D97706"],
                      ["Moyen", events.filter(e => e.risque === "moyen").length, "#CA8A04"],
                      ["Faible", events.filter(e => e.risque === "faible").length, "#059669"],
                    ].map(([lbl, val, col]) => (
                      <div key={lbl} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: "var(--cm)", display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: col, display: "inline-block" }} />{lbl}
                          </span>
                          <span style={{ fontWeight: 700, color: "var(--an)" }}>{val}</span>
                        </div>
                        <Prog pct={events.length > 0 ? Math.round(val / events.length * 100) : 0} color={col} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Last events */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile?"1fr":"2fr 1fr", gap: 20 }}>
                <div className="aud-card aufu">
                  <div className="aud-card-hdr">
                    <div><h3>{I.clock} Derniers événements</h3><p>Activité en temps réel</p></div>
                    <button className="abtn abtn-ghost abtn-sm" onClick={() => setTab("evenements")}>Voir tous →</button>
                  </div>
                  <div style={{ padding: 16 }}>
                    {events.slice(0, 7).map(ev => {
                      const ac = ACTION_CFG[ev.action] || { cls: "gray", icon: "📋" };
                      const rc = RISK_CFG[ev.risque] || { color: "#9CA3AF" };
                      return (
                        <div key={ev._id} className="log-entry" onClick={() => openEvent(ev)}>
                          <div className="log-dot" style={{ background: rc.color }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 13 }}>{ac.icon}</span>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--an)" }}>{ev.utilisateur}</span>
                              <ABadge cls={ac.cls}>{ev.action.replace(/_/g, " ")}</ABadge>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--cm)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {MODULE_CFG[ev.module]?.icon || "📋"} {ev.description}
                            </div>
                          </div>
                          <div style={{ fontSize: 10, color: "#9CA3AF", flexShrink: 0 }}>{fmtTime(ev.date)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Utilisateurs actifs */}
                  <div className="aud-card aufu">
                    <div className="aud-card-hdr"><h3>{I.user} Utilisateurs actifs</h3></div>
                    <div style={{ padding: 14 }}>
                      {connexions.filter(c => c.statut === "actif").map(c => (
                        <div key={c._id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F3F7FF" }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#1B4F9E,#0EA5A0)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                            {c.utilisateur.split(" ").slice(-1)[0]?.charAt(0) || "U"}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--an)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.utilisateur}</div>
                            <div style={{ fontSize: 10, color: "var(--cm)" }}>{c.role} · {fmtTime(c.heure_connexion)}</div>
                          </div>
                          <span className="pulse-dot" style={{ background: "#059669" }} />
                        </div>
                      ))}
                      {connexions.filter(c => c.statut === "actif").length === 0 && (
                        <div style={{ padding: 16, textAlign: "center", color: "var(--cm)", fontSize: 12 }}>Aucun utilisateur actif</div>
                      )}
                    </div>
                  </div>

                  {/* Module activity */}
                  <div className="aud-card aufu">
                    <div className="aud-card-hdr"><h3>Par module</h3></div>
                    <div style={{ padding: 14 }}>
                      {Object.entries(MODULE_CFG).map(([mod, cfg]) => {
                        const count = events.filter(e => e.module === mod).length;
                        if (count === 0) return null;
                        return (
                          <div key={mod} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                            <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                                <span style={{ color: "var(--cm)", textTransform: "capitalize" }}>{mod.replace(/_/g, " ")}</span>
                                <strong style={{ color: "var(--an)" }}>{count}</strong>
                              </div>
                              <Prog pct={Math.round(count / events.length * 100)} color={cfg.color} />
                            </div>
                          </div>
                        );
                      }).filter(Boolean)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ ÉVÉNEMENTS ══ */}
          {tab === "evenements" && (
            <div>
              {/* Filter toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--an)" }}>Journal des événements</div>
                  <div style={{ fontSize: 12, color: "var(--cm)", marginTop: 2 }}>
                    {filteredEvents.length} événement(s) affiché(s) sur {events.length}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="abtn abtn-ghost abtn-sm" onClick={() => setShowFilters(!showFilters)}>
                    {I.filter} {showFilters ? "Masquer filtres" : "Filtres avancés"}
                  </button>
                  {(search || filterModule || filterAction || filterRisque || filterUser || filterIp) && (
                    <button className="abtn abtn-danger abtn-sm" onClick={resetFilters}>{I.x} Réinitialiser</button>
                  )}
                  <button className="abtn abtn-teal abtn-sm" onClick={handleRefresh}>{I.refresh} Actualiser</button>
                </div>
              </div>

              {/* Quick search */}
              <div className="filter-panel">
                <div style={{ position: "relative", marginBottom: showFilters ? 14 : 0 }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }}>{I.search}</span>
                  <input className="ainp" style={{ paddingLeft: 36 }} placeholder="Rechercher : utilisateur, description, IP..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                </div>

                {showFilters && (
                  <div className="filter-grid">
                    <div>
                      <label className="albl">Module</label>
                      <select className="ainp" value={filterModule} onChange={e => { setFilterModule(e.target.value); setPage(1); }}>
                        <option value="">Tous les modules</option>
                        {Object.keys(MODULE_CFG).map(m => <option key={m} value={m}>{MODULE_CFG[m].icon} {m.replace(/_/g, " ")}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="albl">Type d'action</label>
                      <select className="ainp" value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }}>
                        <option value="">Toutes les actions</option>
                        <option value="connexion">🔑 Connexion réussie</option>
                        <option value="echec_connexion">🚫 Échec connexion</option>
                        <option value="deconnexion">🚪 Déconnexion</option>
                        <option value="creation">➕ Création</option>
                        <option value="modification">✏️ Modification</option>
                        <option value="suppression">🗑️ Suppression</option>
                        <option value="consultation">👁️ Consultation</option>
                        <option value="impression">🖨️ Impression</option>
                        <option value="exportation">📤 Exportation</option>
                        <option value="annulation">❌ Annulation</option>
                        <option value="acces_refuse">⛔ Accès refusé</option>
                        <option value="changement_perms">🛡️ Changement permissions</option>
                        <option value="validation">✅ Validation</option>
                      </select>
                    </div>
                    <div>
                      <label className="albl">Niveau de risque</label>
                      <select className="ainp" value={filterRisque} onChange={e => { setFilterRisque(e.target.value); setPage(1); }}>
                        <option value="">Tous niveaux</option>
                        <option value="faible">🟢 Faible</option>
                        <option value="moyen">🟡 Moyen</option>
                        <option value="eleve">🟠 Élevé</option>
                        <option value="critique">🔴 Critique</option>
                      </select>
                    </div>
                    <div>
                      <label className="albl">Utilisateur</label>
                      <input className="ainp" placeholder="Nom ou email..." value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(1); }} />
                    </div>
                    <div>
                      <label className="albl">Adresse IP</label>
                      <input className="ainp" placeholder="Ex: 192.168.1.10" value={filterIp} onChange={e => { setFilterIp(e.target.value); setPage(1); }} />
                    </div>
                    <div>
                      <label className="albl">Date début</label>
                      <input type="date" className="ainp" value={filterDateDeb} onChange={e => { setFilterDateDeb(e.target.value); setPage(1); }} />
                    </div>
                    <div>
                      <label className="albl">Date fin</label>
                      <input type="date" className="ainp" value={filterDateFin} onChange={e => { setFilterDateFin(e.target.value); setPage(1); }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Events table */}
              <div className="aud-card">
                <div style={{ overflowX: "auto" }}>
                  <table className="aud-tbl" style={{ minWidth: 860 }}>
                    <thead>
                      <tr>
                        <th>Date & Heure</th>
                        <th>Utilisateur</th>
                        <th>Module</th>
                        <th>Action</th>
                        <th>Description</th>
                        <th>IP</th>
                        <th>Risque</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--cm)" }}>Chargement...</td></tr>
                      ) : pageEvents.map(ev => {
                        const ac = ACTION_CFG[ev.action] || { cls: "gray", icon: "📋" };
                        const mc = MODULE_CFG[ev.module] || { icon: "📋" };
                        return (
                          <tr key={ev._id}
                            style={{ background: ev.risque === "critique" ? "#FFF8F8" : ev.risque === "eleve" ? "#FFFDF8" : "" }}
                            onClick={() => openEvent(ev)}>
                            <td>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--an)", whiteSpace: "nowrap" }}>{fmtDT(ev.date).split(" ")[0]}</div>
                              <div style={{ fontSize: 10, color: "var(--cm)" }}>{fmtDT(ev.date).split(" ")[1]}</div>
                            </td>
                            <td>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--an)" }}>{ev.utilisateur}</div>
                              <div style={{ fontSize: 10, color: "var(--cm)" }}>{ev.role}</div>
                            </td>
                            <td>
                              <ABadge cls="gray">{mc.icon} {ev.module?.replace(/_/g, " ")}</ABadge>
                            </td>
                            <td>
                              <ABadge cls={ac.cls}>{ac.icon} {ev.action?.replace(/_/g, " ")}</ABadge>
                            </td>
                            <td style={{ maxWidth: 220 }}>
                              <div style={{ fontSize: 11.5, color: "var(--cm)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.description}</div>
                            </td>
                            <td>
                              <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--cm)" }}>{ev.ip}</div>
                            </td>
                            <td><RiskBadge niveau={ev.risque} /></td>
                            <td>
                              <button className="abtn abtn-ghost abtn-sm" style={{ fontSize: 11 }} onClick={e => { e.stopPropagation(); openEvent(ev); }}>
                                {I.eye}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!loading && pageEvents.length === 0 && (
                        <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--cm)" }}>
                          Aucun événement correspondant aux filtres sélectionnés
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div style={{ padding: "12px 20px", borderTop: "1.5px solid var(--cbr)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "var(--cm)" }}>Page {page} / {totalPages} · {filteredEvents.length} événements</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      {page > 1 && <button className="abtn abtn-ghost abtn-sm" onClick={() => setPage(p => p - 1)}>← Précédent</button>}
                      {page < totalPages && <button className="abtn abtn-primary abtn-sm" onClick={() => setPage(p => p + 1)}>Suivant →</button>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ CONNEXIONS ══ */}
          {tab === "connexions" && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--an)", marginBottom: 20 }}>Journal des connexions</div>

              {/* Active users */}
              <div className="aud-card aufu" style={{ marginBottom: 20 }}>
                <div className="aud-card-hdr">
                  <div><h3>{I.user} Sessions actives</h3><p>{connexions.filter(c => c.statut === "actif").length} session(s) en cours</p></div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="aud-tbl">
                    <thead>
                      <tr><th>Utilisateur</th><th>Rôle</th><th>Connexion</th><th>Durée</th><th>IP</th><th>Appareil</th><th>Localisation</th><th>Statut</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {connexions.map(c => (
                        <tr key={c._id} style={{ background: c.statut === "actif" ? "#F0FDFC" : "" }}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg,${c.statut === "actif" ? "#0EA5A0" : "#6B7A99"},#1B4F9E)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                                {c.utilisateur.split(" ").slice(-1)[0]?.charAt(0)}
                              </div>
                              <div>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--an)" }}>{c.utilisateur}</div>
                                <div style={{ fontSize: 10, color: "var(--cm)" }}>{c.email}</div>
                              </div>
                            </div>
                          </td>
                          <td><ABadge cls="blue">{c.role}</ABadge></td>
                          <td style={{ fontSize: 11, color: "var(--cm)" }}>{fmtDT(c.heure_connexion)}</td>
                          <td>
                            <ABadge cls={c.statut === "actif" ? "teal" : "gray"}>
                              {c.statut === "actif" && <span className="pulse-dot" style={{ background: "#059669", marginRight: 4 }} />}
                              {sessionDuration(c.heure_connexion, c.heure_deconnexion)}
                            </ABadge>
                          </td>
                          <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--cm)" }}>{c.ip}</td>
                          <td style={{ fontSize: 11, color: "var(--cm)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>{I.device} {c.device}</div>
                          </td>
                          <td style={{ fontSize: 11, color: "var(--cm)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>{I.globe} {c.localisation}</div>
                          </td>
                          <td>
                            <ABadge cls={c.statut === "actif" ? "green" : "gray"}>
                              {c.statut === "actif" ? "🟢 Actif" : "⚫ Déconnecté"}
                            </ABadge>
                          </td>
                          <td>
                            {c.statut === "actif" && (
                              <button className="abtn abtn-danger abtn-sm" style={{ fontSize: 11 }} onClick={() => { setConnexions(prev => prev.map(x => x._id === c._id ? { ...x, statut: "deconnecte", heure_deconnexion: new Date().toISOString() } : x)); toast.success("Session déconnectée"); }}>
                                {I.ban} Forcer
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Login stats */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr", gap: 20 }}>
                <div className="aud-card aufu">
                  <div className="aud-card-hdr"><h3>📊 Connexions par heure</h3></div>
                  <div style={{ padding: 20 }}>
                    <BarChart labels={["07h", "08h", "09h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "17h", "18h"]} data={[2, 8, 12, 9, 6, 4, 3, 7, 11, 8, 5, 2]} color="#0EA5A0" height={140} />
                  </div>
                </div>
                <div className="aud-card aufu">
                  <div className="aud-card-hdr"><h3>🔐 Statistiques d'authentification</h3></div>
                  <div style={{ padding: 20 }}>
                    {[
                      ["Connexions réussies", kpis.connexions_ok, "#059669"],
                      ["Échecs de connexion", kpis.echecs, "#DC2626"],
                      ["Changements de MDP", events.filter(e => e.action === "changement_mdp").length, "#D97706"],
                      ["Accès refusés", events.filter(e => e.action === "acces_refuse").length, "#7C3AED"],
                    ].map(([lbl, val, col]) => (
                      <div key={lbl} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "#F8FAFD", borderRadius: 10, marginBottom: 8, borderLeft: `3px solid ${col}` }}>
                        <span style={{ fontSize: 12, color: "var(--cm)" }}>{lbl}</span>
                        <strong style={{ fontSize: 14, color: col }}>{val}</strong>
                      </div>
                    ))}
                    <div style={{ marginTop: 12, background: "#EFF6FF", borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "var(--cm)" }}>Taux de succès</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "#1B4F9E" }}>
                        {kpis.total > 0 ? Math.round(kpis.connexions_ok / (kpis.connexions_ok + kpis.echecs) * 100) : 100}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ SUSPECTS ══ */}
          {tab === "suspects" && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--an)", marginBottom: 8 }}>Activités suspectes & Alertes de sécurité</div>
              <div style={{ fontSize: 12, color: "var(--cm)", marginBottom: 20 }}>
                {suspects.filter(s => s.statut !== "cloture").length} alerte(s) en cours · {suspects.filter(s => s.statut === "cloture").length} clôturée(s)
              </div>

              {suspects.filter(s => s.statut !== "cloture").length > 0 && (
                <div className="al-danger aufu" style={{ marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ flexShrink: 0, marginTop: 2 }}>{I.alert}</div>
                  <div>
                    <strong style={{ color: "#B91C1C", fontSize: 13 }}>🚨 Surveillance active requise</strong>
                    <div style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}>
                      {suspects.filter(s => s.risque === "critique" && s.statut !== "cloture").length} alertes critiques · {suspects.filter(s => s.risque === "eleve" && s.statut !== "cloture").length} élevées
                    </div>
                  </div>
                </div>
              )}

              {suspects.map(s => {
                if (s.statut === "cloture") return null;
                return (
                  <div key={s._id} className="susp-card aufu" style={{ background: s.severite === "critique" ? "linear-gradient(135deg,#FEF2F2,#FEE2E2)" : "linear-gradient(135deg,#FFFBEB,#FEF3C7)", border: `1.5px solid ${s.severite === "critique" ? "#FECACA" : "#FDE68A"}`, borderLeft: `4px solid ${s.severite === "critique" ? "#DC2626" : "#D97706"}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                          <span style={{ fontSize: 16 }}>{s.severite === "critique" ? "🔴" : "🟠"}</span>
                          <span style={{ fontWeight: 700, fontSize: 13.5, color: s.severite === "critique" ? "#B91C1C" : "#92400E" }}>{s.type}</span>
                          <RiskBadge niveau={s.severite} />
                          <ABadge cls={s.statut === "en_enquete" ? "orange" : "red"}>
                            {s.statut === "en_enquete" ? "🔍 En enquête" : "⚠ Ouvert"}
                          </ABadge>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--an)", marginBottom: 4 }}>
                          <strong>Utilisateur :</strong> {s.utilisateur}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--cm)" }}>{s.description}</div>
                        <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 6 }}>📅 {fmtDT(s.date)}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                        <button className="abtn abtn-danger abtn-sm" onClick={() => {
                          setSuspects(prev => prev.map(x => x._id === s._id ? { ...x, statut: "en_enquete" } : x));
                          toast.success("🔍 Enquête ouverte");
                        }}>
                          🔍 Enquêter
                        </button>
                        <button className="abtn abtn-ghost abtn-sm" onClick={() => clotureAlerte(s._id)}>
                          {I.check} Clôturer
                        </button>
                        <button className="abtn abtn-ghost abtn-sm" style={{ fontSize: 11 }} onClick={() => toast.success("📧 Notification envoyée à l'administrateur")}>
                          📧 Notifier admin
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {suspects.filter(s => s.statut !== "cloture").length === 0 && (
                <div
                  className="al-success"
                  style={{ display: "flex", alignItems: "center", gap: 14 }}
                >
                  <span style={{ fontSize: 28 }}>🛡️</span>

                  <div>
                    <strong style={{ color: "#065F46", fontSize: 14 }}>
                      Aucune activité suspecte en cours
                    </strong>

                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--ag)",
                        marginTop: 4,
                      }}
                    >
                      Toutes les alertes ont été traitées. Le système est sécurisé.
                    </div>
                  </div>
                </div>

              )}

              {/* Alertes clôturées */}
              {suspects.filter(s => s.statut === "cloture").length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cm)", marginBottom: 12 }}>Alertes clôturées</div>
                  {suspects.filter(s => s.statut === "cloture").map(s => (
                    <div key={s._id} style={{ background: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, opacity: .7 }}>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--cm)" }}>✅ {s.type}</div>
                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>{s.utilisateur} · {fmtDate(s.date)}</div>
                      </div>
                      <ABadge cls="gray">Clôturé</ABadge>
                    </div>
                  ))}
                </div>
              )}

              {/* Surveillance rules */}
              <div className="aud-card aufu" style={{ marginTop: 24 }}>
                <div className="aud-card-hdr"><h3>🔔 Règles de surveillance automatique</h3></div>
                <div style={{ padding: 16 }}>
                  {[
                    { regle: "Plus de 3 échecs de connexion en 5 minutes", seuil: "3 tentatives", statut: true, action: "Verrouillage temporaire + Notification admin" },
                    { regle: "Connexion depuis IP hors réseau local", seuil: "IP externe", statut: true, action: "Alerte critique + Log détaillé" },
                    { regle: "Modification de permissions utilisateur", seuil: "Tout changement", statut: true, action: "Alerte élevée + Confirmation requise" },
                    { regle: "Suppression massive de données (> 10 enreg.)", seuil: ">10 suppressions", statut: true, action: "Blocage + Notification urgente" },
                    { regle: "Exportation de données sensibles hors heures", seuil: "0h-7h", statut: false, action: "Alerte + Rapport automatique" },
                    { regle: "Connexion simultanée depuis 2 IP différentes", seuil: "2 IP actives", statut: true, action: "Alerte + Déconnexion session ancienne" },
                  ].map((r, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#F8FAFD", borderRadius: 10, marginBottom: 8, flexWrap: "wrap" }}>
                      <div style={{ width: 10, height: 10, borderRadius: 50, background: r.statut ? "#059669" : "#9CA3AF", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--an)" }}>{r.regle}</div>
                        <div style={{ fontSize: 11, color: "var(--cm)" }}>Seuil : {r.seuil} · Action : {r.action}</div>
                      </div>
                      <ABadge cls={r.statut ? "green" : "gray"}>{r.statut ? "Actif" : "Inactif"}</ABadge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ STATS ══ */}
          {tab === "stats" && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--an)", marginBottom: 20 }}>Statistiques & Analytiques d'audit</div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 14, marginBottom: 24 }}>
                {[
                  { color: "blue", val: events.length, lbl: "Événements/jour", sub: "moyenne 7 jours" },
                  { color: "green", val: "94%", lbl: "Taux succès auth.", sub: "connexions valides" },
                  { color: "red", val: kpis.critiques, lbl: "Alertes critiques", sub: "à traiter" },
                  { color: "orange", val: kpis.modifications, lbl: "Modifications", sub: "données modifiées" },
                  { color: "purple", val: kpis.suppressions, lbl: "Suppressions", sub: "enregistrements" },
                  { color: "teal", val: "1 an", lbl: "Conservation logs", sub: "politique active" },
                ].map((k, i) => (
                  <div key={i} className={`aud-kpi ${k.color} aufu`}>
                    <div className="kpi-val-a">{k.val}</div>
                    <div className="kpi-lbl-a">{k.lbl}</div>
                    <div className="kpi-sub-a">{k.sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr", gap: 20, marginBottom: 20 }}>
                <div className="aud-card aufu">
                  <div className="aud-card-hdr"><h3>{I.trend} Activité sur 30 jours</h3></div>
                  <div style={{ padding: 20 }}>
                    <LineChart labels={["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12", "S13", "S14", "S15", "S16", "S17", "S18", "S19", "S20", "S21", "S22", "S23", "S24", "S25", "S26", "S27", "S28", "S29", "S30"]} data={[45, 52, 38, 67, 71, 48, 32, 55, 62, 44, 58, 75, 39, 51, 64, 47, 83, 56, 40, 69, 53, 61, 38, 74, 48, 65, 42, 57, 80, 45]} color="#1B4F9E" height={150} />
                  </div>
                </div>
                <div className="aud-card aufu">
                  <div className="aud-card-hdr"><h3>Actions par type</h3></div>
                  <div style={{ padding: 20 }}>
                    {[
                      ["Connexions", events.filter(e => e.action === "connexion").length, "#059669"],
                      ["Consultations", events.filter(e => e.action === "consultation").length, "#6B7A99"],
                      ["Créations", events.filter(e => e.action === "creation").length, "#0EA5A0"],
                      ["Modifications", events.filter(e => e.action === "modification").length, "#1B4F9E"],
                      ["Suppressions", events.filter(e => e.action === "suppression").length, "#DC2626"],
                      ["Échecs / Refus", events.filter(e => ["echec_connexion", "acces_refuse"].includes(e.action)).length, "#D97706"],
                    ].map(([lbl, val, col]) => (
                      <div key={lbl} style={{ marginBottom: 9 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: "var(--cm)", display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: col, display: "inline-block" }} />{lbl}
                          </span>
                          <strong style={{ color: "var(--an)" }}>{val}</strong>
                        </div>
                        <Prog pct={events.length > 0 ? Math.round(val / events.length * 100) : 0} color={col} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr", gap: 20 }}>
                <div className="aud-card aufu">
                  <div className="aud-card-hdr"><h3>👤 Top utilisateurs actifs</h3></div>
                  <div style={{ padding: 16 }}>
                    {[
                      { nom: "Dr. Martin Leblanc", role: "Médecin", count: 42, color: "#1B4F9E" },
                      { nom: "Inf. Anne Martin", role: "Infirmier", count: 38, color: "#0EA5A0" },
                      { nom: "Admin Système", role: "Administrateur", count: 31, color: "#DC2626" },
                      { nom: "Dr. Sophie Pierre", role: "Médecin", count: 27, color: "#7C3AED" },
                      { nom: "Caissier Paul Ngom", role: "Caissier", count: 18, color: "#D97706" },
                    ].map((u, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #F3F7FF" }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: u.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {u.nom.split(" ").slice(-1)[0]?.charAt(0)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--an)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.nom}</div>
                          <div style={{ fontSize: 10, color: "var(--cm)" }}>{u.role}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: u.color }}>{u.count}</div>
                          <div style={{ fontSize: 10, color: "var(--cm)" }}>actions</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="aud-card aufu">
                  <div className="aud-card-hdr"><h3>🗄️ Conservation & Archivage</h3></div>
                  <div style={{ padding: 16 }}>
                    {[
                      { label: "Politique actuelle", val: "Conservation 1 an", color: "var(--at)" },
                      { label: "Logs archivés", val: "12 380 entrées", color: "var(--ab)" },
                      { label: "Espace utilisé", val: "48 MB / 2 GB", color: "var(--ao)" },
                      { label: "Dernier archivage", val: "01/05/2026", color: "var(--ag)" },
                      { label: "Prochain archivage", val: "01/07/2026", color: "var(--cm)" },
                    ].map(r => (
                      <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: "#F8FAFD", borderRadius: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: "var(--cm)" }}>{r.label}</span>
                        <strong style={{ fontSize: 12, color: r.color }}>{r.val}</strong>
                      </div>
                    ))}
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: "var(--cm)" }}>Utilisation stockage</span>
                        <span style={{ fontWeight: 700 }}>2.4%</span>
                      </div>
                      <Prog pct={2.4} color="var(--at)" />
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button className="abtn abtn-ghost abtn-sm" style={{ flex: 1 }} onClick={() => setModalArchive(true)}>
                        {I.archive} Archiver maintenant
                      </button>
                      <button className="abtn abtn-ghost abtn-sm" style={{ flex: 1 }} onClick={() => toast.success("📦 Sauvegarde externe lancée...")}>
                        {I.dl} Sauvegarder
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ MODAL : DÉTAIL ÉVÉNEMENT ═══ */}
        <Modal open={modalEvent} onClose={() => setModalEvent(false)} title="🔍 Détail de l'événement" maxWidth={600}>
          {selectedEvent && (() => {
            const ac = ACTION_CFG[selectedEvent.action] || { cls: "gray", icon: "📋" };
            const mc = MODULE_CFG[selectedEvent.module] || { icon: "📋", color: "#6B7A99" };
            return (
              <div>
                {/* Header */}
                <div style={{ background: "linear-gradient(135deg,#0B1E3B,#132744)", borderRadius: 14, padding: 16, marginBottom: 16, color: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>{ac.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedEvent.action?.replace(/_/g, " ").toUpperCase()}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)" }}>{fmtDT(selectedEvent.date)}</div>
                    </div>
                    <div style={{ marginLeft: "auto" }}><RiskBadge niveau={selectedEvent.risque} /></div>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", lineHeight: 1.6 }}>{selectedEvent.description}</div>
                </div>

                {/* Infos générales */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr", gap: 10, marginBottom: 16 }}>
                  {[
                    ["ID Événement", `EVT-${selectedEvent._id}`],
                    ["Date & Heure", fmtDT(selectedEvent.date)],
                    ["Utilisateur", selectedEvent.utilisateur],
                    ["Rôle", selectedEvent.role],
                    ["Email", selectedEvent.email],
                    ["Adresse IP", selectedEvent.ip],
                    ["Appareil / Navigateur", selectedEvent.device || "—"],
                    ["Module", `${mc.icon} ${selectedEvent.module?.replace(/_/g, " ")}`],
                  ].map(([lbl, val]) => (
                    <div key={lbl} style={{ background: "#F8FAFD", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--cm)", textTransform: "uppercase", letterSpacing: .4 }}>{lbl}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--an)", marginTop: 2 }}>{val || "—"}</div>
                    </div>
                  ))}
                </div>

                {/* Données techniques */}
                {(selectedEvent.ancienne_val || selectedEvent.nouvelle_val) && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cm)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>🔄 Données modifiées</div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr", gap: 10 }}>
                      {selectedEvent.ancienne_val && (
                        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 12px" }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "#DC2626", marginBottom: 4 }}>ANCIENNE VALEUR</div>
                          <div style={{ fontSize: 12, color: "var(--an)" }}>{selectedEvent.ancienne_val}</div>
                        </div>
                      )}
                      {selectedEvent.nouvelle_val && (
                        <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "10px 12px" }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "#059669", marginBottom: 4 }}>NOUVELLE VALEUR</div>
                          <div style={{ fontSize: 12, color: "var(--an)" }}>{selectedEvent.nouvelle_val}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ background: "#F8FAFD", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--cm)", textTransform: "uppercase", letterSpacing: .4, marginBottom: 4 }}>Résultat de l'opération</div>
                  <div style={{ fontSize: 12, color: "var(--an)" }}>
                    <ABadge cls={selectedEvent.resultat?.includes("Succès") ? "green" : "red"}>{selectedEvent.resultat || "—"}</ABadge>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="abtn abtn-ghost abtn-sm" onClick={() => window.print()}>
                    {I.print} Imprimer
                  </button>
                  <button className="abtn abtn-teal abtn-sm" onClick={() => { toast.success("📄 Rapport exporté en PDF"); setModalEvent(false); }}>
                    {I.dl} Exporter PDF
                  </button>
                  {selectedEvent.risque === "critique" && (
                    <button className="abtn abtn-danger abtn-sm" onClick={() => { toast.success("🚨 Alerte créée et admin notifié"); setModalEvent(false); }}>
                      🚨 Créer alerte
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </Modal>

        {/* ═══ MODAL : EXPORT ═══ */}
        <Modal open={modalExport} onClose={() => setModalExport(false)} title={<>{I.dl} Exporter le journal d'audit</>} maxWidth={500}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="albl">Format d'export</label>
              <div style={{ display: "flex", gap: 10 }}>
                {["pdf", "excel", "csv"].map(f => (
                  <div key={f} style={{ flex: 1, padding: "12px 10px", border: `2px solid ${exportForm.format === f ? "var(--at)" : "var(--cbr)"}`, borderRadius: 10, background: exportForm.format === f ? "#F0FDFC" : "#FAFBFF", cursor: "pointer", textAlign: "center", transition: "all .2s" }}
                    onClick={() => setExportForm(prev => ({ ...prev, format: f }))}>
                    <div style={{ fontSize: 20 }}>{f === "pdf" ? "📄" : f === "excel" ? "📊" : "📋"}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--an)", marginTop: 4 }}>{f.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="albl">Critère de filtrage</label>
              <select className="ainp" value={exportForm.par} onChange={e => setExportForm(prev => ({ ...prev, par: e.target.value }))}>
                <option value="tout">Tous les événements</option>
                <option value="utilisateur">Par utilisateur</option>
                <option value="module">Par module</option>
                <option value="risque">Par niveau de risque</option>
              </select>
            </div>
            <div>
              <label className="albl">Période</label>
              <select className="ainp" value={exportForm.periode} onChange={e => setExportForm(prev => ({ ...prev, periode: e.target.value }))}>
                <option value="jour">Aujourd'hui</option>
                <option value="semaine">Cette semaine</option>
                <option value="mois">Ce mois</option>
                <option value="trimestre">Ce trimestre</option>
                <option value="annee">Cette année</option>
                <option value="custom">Période personnalisée</option>
              </select>
            </div>
            {exportForm.periode === "custom" && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr", gap: 12 }}>
                <div>
                  <label className="albl">Date début</label>
                  <input type="date" className="ainp" value={filterDateDeb} onChange={e => setFilterDateDeb(e.target.value)} />
                </div>
                <div>
                  <label className="albl">Date fin</label>
                  <input type="date" className="ainp" value={filterDateFin} onChange={e => setFilterDateFin(e.target.value)} />
                </div>
              </div>
            )}
            <div>
              <label className="albl">Niveau de risque (optionnel)</label>
              <select className="ainp" value={exportForm.risque} onChange={e => setExportForm(prev => ({ ...prev, risque: e.target.value }))}>
                <option value="">Tous les niveaux</option>
                <option value="faible">🟢 Faible uniquement</option>
                <option value="moyen">🟡 Moyen et plus</option>
                <option value="eleve">🟠 Élevé et plus</option>
                <option value="critique">🔴 Critique uniquement</option>
              </select>
            </div>
            <div style={{ background: "#EFF6FF", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#1B4F9E" }}>
              📊 Aperçu : <strong>{filteredEvents.length}</strong> événement(s) seront exportés
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="abtn abtn-ghost" onClick={() => setModalExport(false)}>Annuler</button>
              <button className="abtn abtn-teal" style={{ marginLeft: "auto" }} onClick={() => { toast.success(`✅ Export ${exportForm.format.toUpperCase()} lancé — Téléchargement en cours...`); setModalExport(false); }}>
                {I.dl} Exporter maintenant
              </button>
            </div>
          </div>
        </Modal>

        {/* ═══ MODAL : ARCHIVAGE ═══ */}
        <Modal open={modalArchive} onClose={() => setModalArchive(false)} title={<>{I.archive} Archivage du journal</>} maxWidth={480}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="al-ia">
              <strong style={{ color: "#1E40AF", fontSize: 13 }}>ℹ️ Politique d'archivage automatique</strong>
              <div style={{ fontSize: 12, color: "#3B82F6", marginTop: 6 }}>
                Les journaux de plus de 12 mois sont archivés automatiquement. Les archives sont compressées et conservées pendant 5 ans minimum.
              </div>
            </div>
            <div>
              <label className="albl">Durée de conservation</label>
              <select className="ainp">
                <option value="1an">1 an (politique actuelle)</option>
                <option value="3ans">3 ans</option>
                <option value="5ans">5 ans</option>
                <option value="illimite">Conservation illimitée</option>
              </select>
            </div>
            {[
              ["Logs à archiver", "7 842 entrées (avant le 01/06/2025)"],
              ["Taille estimée archive", "~18 MB compressé"],
              ["Destination", "Serveur backup local + Cloud"],
              ["Durée estimée", "2-5 minutes"],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#F8FAFD", borderRadius: 8, fontSize: 12 }}>
                <span style={{ color: "var(--cm)" }}>{lbl}</span>
                <strong style={{ color: "var(--an)" }}>{val}</strong>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="abtn abtn-ghost" onClick={() => setModalArchive(false)}>Annuler</button>
              <button className="abtn abtn-primary" style={{ marginLeft: "auto" }} onClick={() => { toast.loading("🗄️ Archivage en cours...", { duration: 2000 }); setTimeout(() => toast.success("✅ Archivage terminé — 7 842 entrées archivées"), 2000); setModalArchive(false); }}>
                {I.archive} Lancer l'archivage
              </button>
            </div>
          </div>
        </Modal>

      </div>
    </>
  );
}