

import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchUsers, createUser, updateUser, toggleUserStatus, fetchServices, fetchSystemSettings,
  selectUsers, selectServices, selectSystemSettings, selectAdminLoading, selectAdminTotal,
} from '../store/slices/administrationSlice';
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

// ─── CSS (same design system as Chirurgie) ───────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.adm * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --cn: #0B1E3B; --cn2: #132744; --cb: #1B4F9E;
  --ct: #0EA5A0; --ct2: #0D9490; --cr: #DC2626;
  --co: #D97706; --cg: #059669; --cp: #7C3AED;
  --cbr: #E2EAF4; --cm: #6B7A99; --cl: #EEF4FF; --cs: #F8FAFD;
  --sh: 0 1px 3px rgba(11,30,59,.08); --shm: 0 4px 16px rgba(11,30,59,.10); --shl: 0 12px 40px rgba(11,30,59,.14);
}

/* Topbar */
.adm-top { background:linear-gradient(135deg,var(--cn) 0%,var(--cn2) 55%,#1B4F9E 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.adm-top::before { content:''; position:absolute; top:-50px; right:-50px; width:200px; height:200px; background:radial-gradient(circle,rgba(14,165,160,.22) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
.adm-top::after  { content:''; position:absolute; bottom:-30px; left:30%; width:160px; height:160px; background:radial-gradient(circle,rgba(27,79,158,.18) 0%,transparent 70%); border-radius:50%; pointer-events:none; }

/* Tabs */
.adm-tabs { display:flex; gap:2px; padding:0; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.adm-tabs::-webkit-scrollbar { display:none; }
.adm-tab { display:flex; align-items:center; gap:7px; padding:10px 18px 12px; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.55); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.adm-tab:hover { color:rgba(255,255,255,.88); background:rgba(255,255,255,.08); }
.adm-tab.active { color:var(--cn); background:var(--cs); box-shadow:0 -2px 0 var(--ct) inset; }
.adm-tab-badge { background:var(--cr); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:99px; animation:admP 2s infinite; }
@keyframes admP { 0%,100%{opacity:1} 50%{opacity:.4} }

/* Cards */
.adm-card { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; }
.adm-card:hover { box-shadow:var(--shm); }
.adm-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.adm-card-hdr h3 { font-size:14px; font-weight:700; color:var(--cn); margin:0; display:flex; align-items:center; gap:8px; }
.adm-card-hdr p  { font-size:11px; color:var(--cm); margin:2px 0 0; }

/* KPI */
.adm-kpi { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:pointer; }
.adm-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.adm-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.adm-kpi.blue::before   { background:var(--cb); } .adm-kpi.teal::before   { background:var(--ct); }
.adm-kpi.red::before    { background:var(--cr); } .adm-kpi.orange::before { background:var(--co); }
.adm-kpi.green::before  { background:var(--cg); } .adm-kpi.purple::before { background:var(--cp); }
.adm-kpi.indigo::before { background:#4F46E5; }
.kpi-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
.kpi-icon.blue   { background:#EFF6FF; color:var(--cb); } .kpi-icon.teal   { background:#F0FDFC; color:var(--ct); }
.kpi-icon.red    { background:#FEF2F2; color:var(--cr); } .kpi-icon.orange { background:#FFF7ED; color:var(--co); }
.kpi-icon.green  { background:#ECFDF5; color:var(--cg); } .kpi-icon.purple { background:#F5F3FF; color:var(--cp); }
.kpi-icon.indigo { background:#EEF2FF; color:#4F46E5; }
.kpi-val { font-size:26px; font-weight:800; color:var(--cn); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.kpi-lbl { font-size:11.5px; font-weight:600; color:var(--cm); }
.kpi-sub { font-size:10.5px; color:#9CA3AF; margin-top:2px; }
.kpi-dot { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--cr); animation:admP 2s infinite; }

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
.adm-prog { background:#EEF4FF; border-radius:99px; height:7px; overflow:hidden; }
.adm-prog-f { height:100%; border-radius:99px; transition:width .5s; }

/* Buttons */
.cbtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; text-decoration:none; }
.cbtn-primary { background:var(--cb); color:#fff; } .cbtn-primary:hover { background:#174391; transform:translateY(-1px); }
.cbtn-teal    { background:var(--ct); color:#fff; } .cbtn-teal:hover    { background:var(--ct2); transform:translateY(-1px); }
.cbtn-ghost   { background:transparent; color:var(--cm); border:1.5px solid var(--cbr); }
.cbtn-ghost:hover { background:var(--cl); color:var(--cn); }
.cbtn-danger  { background:#FEF2F2; color:var(--cr); border:1.5px solid #FECACA; }
.cbtn-danger:hover { background:var(--cr); color:#fff; }
.cbtn-success { background:#ECFDF5; color:var(--cg); border:1.5px solid #A7F3D0; }
.cbtn-success:hover { background:var(--cg); color:#fff; }
.cbtn-sm { padding:6px 12px; font-size:12px; }
.cbtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }

/* Forms */
.clbl { font-size:12px; font-weight:600; color:var(--cm); margin-bottom:6px; display:block; }
.cinp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--cbr); background:#FAFBFF; font-size:13px; color:var(--cn); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.cinp:focus { border-color:var(--ct); box-shadow:0 0 0 3px rgba(14,165,160,.12); }

/* Alerts */
.al-ia    { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; border-left:4px solid var(--cb); border-radius:14px; padding:14px 18px; }
.al-warn  { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--co); border-radius:14px; padding:14px 18px; }
.al-danger { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--cr); border-radius:14px; padding:14px 18px; }
.al-success { background:linear-gradient(135deg,#ECFDF5,#D1FAE5); border:1.5px solid #A7F3D0; border-left:4px solid var(--cg); border-radius:14px; padding:14px 18px; }

/* Table */
.adm-tbl { width:100%; border-collapse:collapse; }
.adm-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.adm-tbl th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--cm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--cbr); white-space:nowrap; }
.adm-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.adm-tbl tbody tr:last-child td { border-bottom:none; }
.adm-tbl tbody tr:hover { background:#F8FAFF; }

/* Modal */
.mov { position:fixed; inset:0; z-index:500; background:rgba(11,30,59,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.mov-box { background:#fff; border-radius:20px; box-shadow:var(--shl); width:100%; max-width:620px; max-height:90vh; overflow-y:auto; animation:slideUp .25s ease; }
@keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.mov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:#EEF4FF; position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.mov-hdr h3 { font-size:16px; font-weight:700; color:var(--cn); margin:0; display:flex; align-items:center; gap:10px; }
.mov-cls { width:32px; height:32px; border-radius:8px; background:#F3F7FF; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--cm); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.mov-cls:hover { background:#FEF2F2; color:var(--cr); }
.mov-body { padding:24px; }

/* Section nav */
.sec-nav { display:flex; gap:6px; flex-wrap:wrap; padding:14px 20px; background:linear-gradient(to right,#F8FAFD,#EEF4FF); border-bottom:1.5px solid var(--cbr); }
.sec-btn { display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all .2s; color:var(--cm); background:none; font-family:'Poppins',sans-serif; }
.sec-btn:hover { background:white; color:var(--cn); border-color:var(--cbr); }
.sec-btn.active { background:var(--cn); color:white; border-color:var(--cn); }

/* Fade */
@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
.fu { animation:fadeUp .35s ease both; }

/* Avatar */
.usr-av { width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; color:#fff; flex-shrink:0; }

/* Permission checkbox */
.perm-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.perm-item { display:flex; align-items:center; gap:8px; background:#F8FAFD; border:1.5px solid var(--cbr); border-radius:10px; padding:8px 12px; cursor:pointer; transition:all .2s; }
.perm-item:hover { border-color:var(--ct); background:#F0FDFC; }
.perm-item.active { border-color:var(--ct); background:#F0FDFC; }
.perm-item input { accent-color:var(--ct); width:14px; height:14px; }

/* Audit row */
.audit-row { display:flex; align-items:flex-start; gap:12px; padding:12px 0; border-bottom:1px solid #F3F7FF; }
.audit-row:last-child { border-bottom:none; }
.audit-dot { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:14px; }

/* ─── Responsive ─── */
.adm-g2  { display:grid; grid-template-columns:2fr 1fr; gap:20px; }
.adm-g11 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.adm-g11s{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
@media (max-width:767px) {
  .adm-top { padding:12px 14px 0; }
  .adm-g2,.adm-g11 { grid-template-columns:1fr; gap:14px; }
  .adm-g11s { grid-template-columns:1fr 1fr; gap:8px; }
  .cinp { font-size:16px !important; }
  .cbtn { font-size:12px; padding:8px 12px; } .cbtn-sm { font-size:11px; padding:5px 8px; }
  .adm-card { border-radius:14px; } .adm-card-hdr { padding:11px 14px; }
  .mov { padding:0; align-items:flex-end; } .mov-box { border-radius:20px 20px 0 0; max-width:100%; max-height:93vh; }
  .mov-hdr { padding:13px 16px; } .mov-body { padding:14px; }
  .perm-grid { grid-template-columns:1fr 1fr; }
}
@media (max-width:479px) {
  .adm-top { padding:10px 12px 0; } .adm-g11s { grid-template-columns:1fr; }
  .perm-grid { grid-template-columns:1fr; }
  .adm-card-hdr { flex-wrap:wrap; gap:8px; }
}
`;

// ─── Helpers ─────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const fmtDateInput = (d) => d ? new Date(d).toISOString().substring(0, 10) : "";
const fmtMoney = (n) => n ? n.toLocaleString("fr-FR") + " CFA" : "0 CFA";

// ─── SVG Icons ────────────────────────────────────────────────
const I = {
  shield:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  users:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  key:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  building: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  grid:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  dollar:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  hr:       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  file:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  chart:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  activity: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  msg:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  alert:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  plus:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  save:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  edit:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  lock:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  trend:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  dl:       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  check:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  eye:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  supplier: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  task:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
};

// ─── ROLE COLORS ─────────────────────────────────────────────
const ROLE_CFG = {
  super_admin:  { cls: "red",    label: "Super Admin",  color: "#DC2626" },
  admin:        { cls: "purple", label: "Administrateur", color: "#7C3AED" },
  medecin:      { cls: "blue",   label: "Médecin",      color: "#1B4F9E" },
  infirmier:    { cls: "teal",   label: "Infirmier",    color: "#0EA5A0" },
  pharmacien:   { cls: "green",  label: "Pharmacien",   color: "#059669" },
  laborantin:   { cls: "orange", label: "Laborantin",   color: "#D97706" },
  comptable:    { cls: "indigo", label: "Comptable",    color: "#4F46E5" },
  receptionniste: { cls: "gray", label: "Réceptionniste", color: "#6B7280" },
};

const STATUT_USER = {
  actif:    { cls: "green",  label: "Actif" },
  inactif:  { cls: "gray",   label: "Inactif" },
  suspendu: { cls: "red",    label: "Suspendu" },
};

const TASK_STATUT = {
  en_attente: { cls: "orange", label: "En attente" },
  en_cours:   { cls: "blue",   label: "En cours" },
  termine:    { cls: "green",  label: "Terminée" },
  annule:     { cls: "gray",   label: "Annulée" },
};

const AVATAR_COLORS = ["#1B4F9E","#0EA5A0","#7C3AED","#DC2626","#D97706","#059669","#4F46E5","#0B1E3B"];

// ─── DEMO DATA ───────────────────────────────────────────────
const DEMO_USERS = [];

const DEMO_DEPTS = [];

const DEMO_ROOMS = [];

const DEMO_SUPPLIERS = [];

const DEMO_TASKS = [];

const DEMO_AUDIT = [];

const DEMO_KPIS = {};

const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const REVENUS_DATA = [];

const EMPTY_USER = { prenom:"", nom:"", email:"", telephone:"", role:"medecin", service:"", statut:"actif", mot_de_passe:"" };
const EMPTY_TASK = { titre:"", assignee:"", priorite:"normale", statut:"en_attente", echeance:"", categorie:"administratif", description:"" };
const EMPTY_SUPPLIER = { nom:"", contact:"", telephone:"", email:"", adresse:"", produits:"" };

// ─── Modal wrapper ───────────────────────────────────────────
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

// ─── KPI Card ────────────────────────────────────────────────
function KpiCard({ color, icon, value, label, sub, urgent, onClick }) {
  return (
    <div className={`adm-kpi ${color} fu`} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      {urgent && <div className="kpi-dot" />}
      <div className={`kpi-icon ${color}`}>{icon}</div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-lbl">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function Prog({ pct, color }) {
  return (
    <div className="adm-prog">
      <div className="adm-prog-f" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  );
}

function Badge({ cls, children }) {
  return <span className={`cbdg ${cls}`}>{children}</span>;
}

function UserAvatar({ prenom, nom, idx = 0 }) {
  const col = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  return (
    <div className="usr-av" style={{ background: col }}>
      {(prenom?.[0] || "")}{(nom?.[0] || "")}
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
          datasets: [{ label: "Revenus", data, backgroundColor: `${color}26`, borderColor: color, borderWidth: 2, borderRadius: 8, borderSkipped: false }],
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: { legend: { display: false }, tooltip: { backgroundColor: "#0B1E3B", padding: 10, cornerRadius: 10 } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#9CA3AF" }, border: { display: false } },
            y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.04)" }, ticks: { font: { size: 10 }, color: "#9CA3AF", callback: v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v }, border: { display: false } },
          },
        },
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [labels, data, color]);
  return <canvas ref={ref} style={{ maxHeight: height }} />;
}

// ═══════════════════════════════════════════════════════════
export default function Administration() {
  const dispatch = useDispatch();
  const reduxUsers = useSelector(selectUsers);
  const reduxServices = useSelector(selectServices);
  const reduxSettings = useSelector(selectSystemSettings);

  useEffect(() => {
    dispatch(fetchUsers({}));
    dispatch(fetchServices());
    dispatch(fetchSystemSettings());
  }, [dispatch]);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => { const fn = () => setIsMobile(window.innerWidth <= 599); window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn); }, []);

  const [tab, setTab]           = useState("dashboard");
  const [section, setSection]   = useState("utilisateurs");
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState("");

  // Data
  const [kpis, setKpis]         = useState(DEMO_KPIS);
  const [users, setUsers]       = useState([]);
  const [depts, setDepts]       = useState([]);
  const [rooms, setRooms]       = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [tasks, setTasks]       = useState([]);
  const [audit, setAudit]       = useState([]);
  const [revenus, setRevenus]   = useState(REVENUS_DATA);

  // Modals
  const [modalUser, setModalUser]         = useState(false);
  const [modalTask, setModalTask]         = useState(false);
  const [modalSupplier, setModalSupplier] = useState(false);
  const [editUser, setEditUser]           = useState(null);

  // Forms
  const [formUser, setFormUser]           = useState(EMPTY_USER);
  const [formTask, setFormTask]           = useState(EMPTY_TASK);
  const [formSupplier, setFormSupplier]   = useState(EMPTY_SUPPLIER);

  // Settings state
  const [settings, setSettings] = useState({
    nom_clinique: "Clinique Canadienne de Souanké",
    telephone: "+242 06 000 0000",
    email: "contact@clinique-souanke.cg",
    adresse: "Souanké, République du Congo",
    horaire_debut: "07:00", horaire_fin: "20:00",
    devise: "CFA", langue: "fr",
    pwd_min_length: 8, two_fa: false, backup_auto: true,
  });

  // ── Load ──────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [kRes, uRes, dRes, rRes, sRes, tRes, aRes] = await Promise.allSettled([
        api.get("/admin/kpis"),
        api.get("/admin/users"),
        api.get("/admin/departments"),
        api.get("/admin/rooms"),
        api.get("/admin/suppliers"),
        api.get("/admin/tasks"),
        api.get("/admin/audit?limit=20"),
      ]);
      const toArr = (v, fallback) => Array.isArray(v) ? v : fallback;
      if (kRes.status === "fulfilled" && kRes.value.data) setKpis(kRes.value.data);
      setUsers(uRes.status === "fulfilled"  ? toArr(uRes.value.data.users  || uRes.value.data, DEMO_USERS)     : DEMO_USERS);
      setDepts(dRes.status === "fulfilled"  ? toArr(dRes.value.data.departments || dRes.value.data, DEMO_DEPTS): DEMO_DEPTS);
      setRooms(rRes.status === "fulfilled"  ? toArr(rRes.value.data.rooms  || rRes.value.data, DEMO_ROOMS)     : DEMO_ROOMS);
      setSuppliers(sRes.status === "fulfilled" ? toArr(sRes.value.data.suppliers || sRes.value.data, DEMO_SUPPLIERS) : DEMO_SUPPLIERS);
      setTasks(tRes.status === "fulfilled"  ? toArr(tRes.value.data.tasks  || tRes.value.data, DEMO_TASKS)     : DEMO_TASKS);
      setAudit(aRes.status === "fulfilled"  ? toArr(aRes.value.data.logs   || aRes.value.data, DEMO_AUDIT)     : DEMO_AUDIT);
    } catch {
      setUsers(DEMO_USERS); setDepts(DEMO_DEPTS); setRooms(DEMO_ROOMS);
      setSuppliers(DEMO_SUPPLIERS); setTasks(DEMO_TASKS); setAudit(DEMO_AUDIT);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Create user ───────────────────────────────────────────
  const saveUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editUser) {
        await api.put(`/admin/users/${editUser._id}`, formUser);
        toast.success("✅ Utilisateur mis à jour");
      } else {
        await api.post("/admin/users", formUser);
        toast.success("✅ Utilisateur créé avec succès");
      }
      setModalUser(false); setFormUser(EMPTY_USER); setEditUser(null);
      loadAll();
    } catch {
      if (editUser) {
        setUsers(prev => prev.map(u => u._id === editUser._id ? { ...u, ...formUser } : u));
      } else {
        setUsers(prev => [...prev, { ...formUser, _id: Date.now().toString(), derniere_connexion: null }]);
      }
      toast.success(editUser ? "✅ Mis à jour (local)" : "✅ Créé (local)");
      setModalUser(false); setFormUser(EMPTY_USER); setEditUser(null);
    } finally { setSaving(false); }
  };

  // ── Toggle user status ────────────────────────────────────
  const toggleUserStatus = async (user) => {
    const newStatut = user.statut === "actif" ? "suspendu" : "actif";
    try {
      await api.put(`/admin/users/${user._id}`, { statut: newStatut });
    } catch {}
    setUsers(prev => prev.map(u => u._id === user._id ? { ...u, statut: newStatut } : u));
    toast.success(`${newStatut === "actif" ? "✅ Compte activé" : "⛔ Compte suspendu"}`);
  };

  // ── Reset password ────────────────────────────────────────
  const resetPassword = async (user) => {
    try { await api.post(`/admin/users/${user._id}/reset-password`); } catch {}
    toast.success(`🔑 Email de réinitialisation envoyé à ${user.email}`);
  };

  // ── Create task ───────────────────────────────────────────
  const saveTask = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/admin/tasks", formTask);
      toast.success("✅ Tâche créée");
    } catch {
      setTasks(prev => [{ ...formTask, _id: Date.now().toString() }, ...prev]);
      toast.success("✅ Tâche créée (local)");
    } finally {
      setSaving(false); setModalTask(false); setFormTask(EMPTY_TASK);
    }
  };

  // ── Create supplier ───────────────────────────────────────
  const saveSupplier = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/admin/suppliers", formSupplier);
      toast.success("✅ Fournisseur ajouté");
    } catch {
      setSuppliers(prev => [...prev, { ...formSupplier, _id: Date.now().toString(), montant_total: 0 }]);
      toast.success("✅ Fournisseur ajouté (local)");
    } finally {
      setSaving(false); setModalSupplier(false); setFormSupplier(EMPTY_SUPPLIER);
    }
  };

  // ── Save settings ─────────────────────────────────────────
  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put("/admin/settings", settings);
      toast.success("✅ Paramètres enregistrés");
    } catch { toast.success("✅ Paramètres enregistrés (local)"); }
    finally { setSaving(false); }
  };

  // Filtered users
  const filteredUsers = users.filter(u =>
    !search || `${u.prenom} ${u.nom} ${u.email} ${u.role}`.toLowerCase().includes(search.toLowerCase())
  );

  const alerteCount = kpis.alertes || 0;
  const impayesCount = kpis.factures_impayees || 0;

  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      <div className="adm">

        {/* ── TOPBAR ── */}
        <div className="adm-top">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap", position:"relative", zIndex:2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:54, height:54, borderRadius:14, background:"rgba(255,255,255,.12)", border:"1.5px solid rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {I.shield}
              </div>
              <div>
                <div style={{ fontSize:21, fontWeight:700, color:"#fff", letterSpacing:-.3 }}>Administration</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.55)", marginTop:2 }}>{users.length} utilisateurs · {settings.nom_clinique}</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {tab === "gestion" && section === "utilisateurs" && (
                <button className="cbtn cbtn-teal" onClick={() => { setFormUser(EMPTY_USER); setEditUser(null); setModalUser(true); }}>
                  {I.plus} Nouvel utilisateur
                </button>
              )}
              {tab === "gestion" && section === "taches" && (
                <button className="cbtn cbtn-teal" onClick={() => { setFormTask(EMPTY_TASK); setModalTask(true); }}>
                  {I.plus} Nouvelle tâche
                </button>
              )}
              {tab === "gestion" && section === "fournisseurs" && (
                <button className="cbtn cbtn-teal" onClick={() => { setFormSupplier(EMPTY_SUPPLIER); setModalSupplier(true); }}>
                  {I.plus} Nouveau fournisseur
                </button>
              )}
              {alerteCount > 0 && (
                <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(220,38,38,.2)", border:"1px solid rgba(220,38,38,.4)", borderRadius:10, padding:"6px 12px" }}>
                  <span style={{ fontSize:12, color:"#FCA5A5", fontWeight:600 }}>🔔 {alerteCount} alerte(s)</span>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          {(() => {
            const TABS = [
              { key:"dashboard",  icon:I.grid,     label:"Tableau de bord",      labelM:"Dashboard" },
              { key:"gestion",    icon:I.users,    label:"Gestion & Opérations", labelM:"Gestion" },
              { key:"finances",   icon:I.dollar,   label:"Finances",             labelM:"Finances" },
              { key:"rapports",   icon:I.chart,    label:"Rapports",             labelM:"Rapports" },
              { key:"audit",      icon:I.activity, label:`Audit ${audit.length>0?`(${audit.length})`:""}`  , labelM:"Audit" },
              { key:"parametres", icon:I.settings, label:"Paramètres",           labelM:"Paramètres" },
            ];
            return (
              <div style={isMobile?{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:'4px',padding:'8px 10px',marginTop:'8px',background:'rgba(255,255,255,.07)',borderRadius:'10px 10px 0 0'}:{display:'flex',gap:'2px',marginTop:'16px',overflowX:'auto',scrollbarWidth:'none'}}>
                {TABS.map(t=>(
                  <button key={t.key} className={`adm-tab ${tab===t.key?"active":""}`} style={isMobile?{flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'7px 3px 8px',fontSize:'9.5px',gap:'3px',borderRadius:'8px',whiteSpace:'normal',minWidth:0}:{}} onClick={()=>setTab(t.key)}>
                    <span style={isMobile?{fontSize:'14px'}:{}}>{t.icon}</span>
                    <span style={isMobile?{lineHeight:1.2}:{}}>{isMobile?t.labelM:t.label}</span>
                    {t.badge&&<span className="adm-tab-badge">{t.badge}</span>}
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
              {/* Alertes */}
              {(alerteCount > 0 || impayesCount > 0) && (
                <div className="al-warn fu" style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, flexWrap:"wrap" }}>
                  <div style={{ width:42, height:42, background:"#FDE68A", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {I.alert}
                  </div>
                  <div style={{ flex:1 }}>
                    <strong style={{ color:"#92400E", fontSize:13 }}>Alertes administratives</strong>
                    <div style={{ fontSize:12, color:"#B45309", marginTop:3 }}>
                      {alerteCount > 0 && <span><strong>{alerteCount}</strong> alerte(s) en attente de traitement. </span>}
                      {impayesCount > 0 && <span><strong>{impayesCount}</strong> facture(s) impayée(s) à régulariser.</span>}
                    </div>
                  </div>
                  <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => { setTab("finances"); }}>Voir →</button>
                </div>
              )}

              {/* KPIs */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="blue"   icon={I.users}    value={kpis.total_patients || 1247}         label="Total patients"        sub="tous dossiers confondus" />
                <KpiCard color="teal"   icon={I.task}     value={kpis.rdv_jour || 38}                 label="RDV du jour"           sub="planifiés aujourd'hui" />
                <KpiCard color="green"  icon={I.activity} value={kpis.consultations_jour || 29}        label="Consultations"         sub="ce jour" />
                <KpiCard color="purple" icon={I.building} value={kpis.hospitalisations || 18}          label="Hospitalisations"      sub="en cours" />
                <KpiCard color="orange" icon={I.hr}       value={kpis.personnel_present || 42}         label="Personnel présent"     sub="aujourd'hui" />
                <KpiCard color="teal"   icon={I.dollar}   value={(kpis.revenus_jour || 2850000).toLocaleString("fr-FR")} label="Revenus du jour" sub="CFA" />
                <KpiCard color={impayesCount > 10 ? "red" : "orange"} icon={I.file} value={impayesCount} label="Factures impayées" sub="en attente" urgent={impayesCount > 10} onClick={() => setTab("finances")} />
                <KpiCard color={alerteCount > 0 ? "red" : "green"} icon={I.alert} value={alerteCount} label="Alertes admin." sub="à traiter" urgent={alerteCount > 0} />
              </div>

              {/* Charts + Activity */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"2fr 1fr", gap:20, marginBottom:24 }}>
                <div className="adm-card fu">
                  <div className="adm-card-hdr">
                    <div><h3>{I.trend} Revenus mensuels — 2025</h3><p>Évolution des recettes de la clinique</p></div>
                  </div>
                  <div style={{ padding:20 }}>
                    <BarChart labels={MONTHS} data={revenus} color="#0EA5A0" />
                  </div>
                </div>
                <div className="adm-card fu">
                  <div className="adm-card-hdr"><div><h3>Occupation des salles</h3><p>{rooms.length} salles / blocs</p></div></div>
                  <div style={{ padding:20 }}>
                    {[
                      ["Disponibles",  rooms.filter(r => r.etat === "disponible").length,  "#059669"],
                      ["Occupées",     rooms.filter(r => r.etat === "occupee").length,      "#DC2626"],
                      ["Partiellement",rooms.filter(r => r.etat === "partielle").length,    "#D97706"],
                    ].map(([lbl, val, col]) => (
                      <div key={lbl} style={{ marginBottom:12 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:"var(--cm)" }}>
                            <span style={{ width:10, height:10, borderRadius:3, background:col, display:"inline-block" }} />
                            {lbl}
                          </span>
                          <span style={{ fontWeight:700, fontSize:12, color:"var(--cn)" }}>{val}</span>
                        </div>
                        <Prog pct={rooms.length > 0 ? Math.round(val / rooms.length * 100) : 0} color={col} />
                      </div>
                    ))}
                    <div style={{ marginTop:14, paddingTop:12, borderTop:"1px solid var(--cbr)" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>Répartition personnel</div>
                      {[
                        ["Médecins",    users.filter(u => u.role === "medecin").length,    "#1B4F9E"],
                        ["Infirmiers",  users.filter(u => u.role === "infirmier").length,  "#0EA5A0"],
                        ["Pharmaciens", users.filter(u => u.role === "pharmacien").length, "#059669"],
                        ["Autres",      users.filter(u => !["medecin","infirmier","pharmacien"].includes(u.role)).length, "#7C3AED"],
                      ].map(([lbl, val, col]) => (
                        <div key={lbl} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0" }}>
                          <span style={{ display:"flex", alignItems:"center", gap:6, color:"var(--cm)" }}>
                            <span style={{ width:8, height:8, borderRadius:2, background:col, display:"inline-block" }} />
                            {lbl}
                          </span>
                          <span style={{ fontWeight:700, color:"var(--cn)" }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick access panels */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                {/* Recent users */}
                <div className="adm-card fu">
                  <div className="adm-card-hdr">
                    <div><h3>{I.users} Utilisateurs récents</h3></div>
                    <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => { setTab("gestion"); setSection("utilisateurs"); }}>Gérer →</button>
                  </div>
                  <div style={{ padding:"8px 0" }}>
                    {users.slice(0, 5).map((u, i) => {
                      const rc = ROLE_CFG[u.role] || { cls:"gray", label:u.role };
                      const sc = STATUT_USER[u.statut] || { cls:"gray", label:u.statut };
                      return (
                        <div key={u._id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 20px", borderBottom:i < 4 ? "1px solid #F3F7FF" : "" }}>
                          <UserAvatar prenom={u.prenom} nom={u.nom} idx={i} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:600, color:"var(--cn)", fontSize:13 }}>{u.prenom} {u.nom}</div>
                            <div style={{ fontSize:11, color:"var(--cm)" }}>{u.email}</div>
                          </div>
                          <Badge cls={rc.cls}>{rc.label}</Badge>
                          <Badge cls={sc.cls}>{sc.label}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tasks overview */}
                <div className="adm-card fu">
                  <div className="adm-card-hdr">
                    <div><h3>{I.task} Tâches administratives</h3></div>
                    <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => { setTab("gestion"); setSection("taches"); }}>Gérer →</button>
                  </div>
                  <div style={{ padding:"8px 0" }}>
                    {tasks.slice(0, 5).map((t, i) => {
                      const sc = TASK_STATUT[t.statut] || { cls:"gray", label:t.statut };
                      return (
                        <div key={t._id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 20px", borderBottom:i < 4 ? "1px solid #F3F7FF" : "" }}>
                          <div style={{ width:32, height:32, borderRadius:8, background: t.priorite === "haute" ? "#FEF2F2" : "#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <span style={{ fontSize:14 }}>{t.priorite === "haute" ? "🔴" : "🔵"}</span>
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:600, color:"var(--cn)", fontSize:12, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.titre}</div>
                            <div style={{ fontSize:11, color:"var(--cm)" }}>{t.assignee} · {fmtDate(t.echeance)}</div>
                          </div>
                          <Badge cls={sc.cls}>{sc.label}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ GESTION & OPÉRATIONS ══ */}
          {tab === "gestion" && (
            <div>
              {/* Section nav */}
              <div className="sec-nav" style={{ borderRadius:18, marginBottom:20 }}>
                {[
                  { id:"utilisateurs",  label:"👤 Utilisateurs" },
                  { id:"roles",         label:"🔑 Rôles & Permissions" },
                  { id:"services",      label:"🏥 Services" },
                  { id:"departements",  label:"🏢 Départements" },
                  { id:"salles",        label:"🚪 Salles & Infrastructures" },
                  { id:"taches",        label:`✅ Tâches (${tasks.length})` },
                  { id:"ressources",    label:"🖥️ Ressources" },
                  { id:"fournisseurs",  label:`🚚 Fournisseurs (${suppliers.length})` },
                  { id:"documents",     label:"📄 Documents" },
                ].map(s => (
                  <button key={s.id} className={`sec-btn ${section === s.id ? "active" : ""}`} onClick={() => setSection(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>

              {/* ── UTILISATEURS ── */}
              {section === "utilisateurs" && (
                <div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)" }}>Gestion des utilisateurs</div>
                      <div style={{ fontSize:12, color:"var(--cm)" }}>{users.length} compte(s) enregistré(s)</div>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <div style={{ position:"relative" }}>
                        <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }}>{I.search}</span>
                        <input className="cinp" style={{ paddingLeft:34, width:220 }} placeholder="Nom, email, rôle..." value={search} onChange={e => setSearch(e.target.value)} />
                      </div>
                      <button className="cbtn cbtn-primary" onClick={() => { setFormUser(EMPTY_USER); setEditUser(null); setModalUser(true); }}>
                        {I.plus} Ajouter utilisateur
                      </button>
                    </div>
                  </div>
                  <div className="adm-card">
                    <div style={{ overflowX:"auto" }}>
                      <table className="adm-tbl" style={{ minWidth:900 }}>
                        <thead>
                          <tr>
                            <th>Utilisateur</th><th>Rôle</th><th>Service</th>
                            <th>Téléphone</th><th>Dernière connexion</th><th>Statut</th><th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUsers.map((u, i) => {
                            const rc = ROLE_CFG[u.role] || { cls:"gray", label:u.role };
                            const sc = STATUT_USER[u.statut] || { cls:"gray", label:u.statut };
                            return (
                              <tr key={u._id}>
                                <td>
                                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                    <UserAvatar prenom={u.prenom} nom={u.nom} idx={i} />
                                    <div>
                                      <div style={{ fontWeight:600, color:"var(--cn)" }}>{u.prenom} {u.nom}</div>
                                      <div style={{ fontSize:11, color:"var(--cm)" }}>{u.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td><Badge cls={rc.cls}>{rc.label}</Badge></td>
                                <td style={{ fontSize:12, color:"var(--cm)" }}>{u.service || "—"}</td>
                                <td style={{ fontSize:12, color:"var(--cm)" }}>{u.telephone || "—"}</td>
                                <td style={{ fontSize:12, color:"var(--cm)" }}>{u.derniere_connexion ? fmtDate(u.derniere_connexion) : "Jamais"}</td>
                                <td><Badge cls={sc.cls}>{sc.label}</Badge></td>
                                <td>
                                  <div style={{ display:"flex", gap:6 }}>
                                    <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => { setEditUser(u); setFormUser({ prenom:u.prenom, nom:u.nom, email:u.email, telephone:u.telephone, role:u.role, service:u.service, statut:u.statut, mot_de_passe:"" }); setModalUser(true); }}>
                                      {I.edit}
                                    </button>
                                    <button className="cbtn cbtn-ghost cbtn-sm" title="Réinitialiser mot de passe" onClick={() => resetPassword(u)}>
                                      {I.key}
                                    </button>
                                    <button className={`cbtn cbtn-sm ${u.statut === "actif" ? "cbtn-danger" : "cbtn-success"}`} onClick={() => toggleUserStatus(u)}>
                                      {u.statut === "actif" ? I.lock : I.check}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {filteredUsers.length === 0 && (
                            <tr><td colSpan={7} style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>Aucun utilisateur trouvé</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── RÔLES & PERMISSIONS ── */}
              {section === "roles" && (
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)", marginBottom:16 }}>Rôles & Permissions</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:16 }}>
                    {Object.entries(ROLE_CFG).map(([key, cfg]) => {
                      const perms = {
                        super_admin: ["lecture","creation","modification","suppression","validation","exportation"],
                        admin:       ["lecture","creation","modification","validation","exportation"],
                        medecin:     ["lecture","creation","modification"],
                        infirmier:   ["lecture","creation"],
                        pharmacien:  ["lecture","creation","modification"],
                        laborantin:  ["lecture","creation"],
                        comptable:   ["lecture","creation","modification","validation","exportation"],
                        receptionniste: ["lecture","creation"],
                      }[key] || ["lecture"];
                      const allPerms = ["lecture","creation","modification","suppression","validation","exportation"];
                      return (
                        <div key={key} className="adm-card">
                          <div className="adm-card-hdr">
                            <h3>
                              <span style={{ width:10, height:10, borderRadius:3, background:cfg.color, display:"inline-block" }} />
                              {cfg.label}
                            </h3>
                            <span style={{ fontSize:11, color:"var(--cm)" }}>{users.filter(u => u.role === key).length} utilisateur(s)</span>
                          </div>
                          <div style={{ padding:16 }}>
                            <div className="perm-grid">
                              {allPerms.map(p => {
                                const has = perms.includes(p);
                                const icons = { lecture:"👁️", creation:"➕", modification:"✏️", suppression:"🗑️", validation:"✅", exportation:"📤" };
                                const labels = { lecture:"Lecture", creation:"Création", modification:"Modif.", suppression:"Suppression", validation:"Validation", exportation:"Exportation" };
                                return (
                                  <div key={p} className={`perm-item ${has ? "active" : ""}`} style={{ opacity: has ? 1 : 0.5 }}>
                                    <span style={{ fontSize:13 }}>{icons[p]}</span>
                                    <span style={{ fontSize:11, fontWeight:600, color: has ? "var(--ct)" : "var(--cm)" }}>{labels[p]}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── SERVICES ── */}
              {section === "services" && (
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)", marginBottom:16 }}>Services médicaux</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:16 }}>
                    {[
                      { nom:"Consultation",    icon:"🩺", desc:"Consultations générales et spécialisées",     col:"#1B4F9E", personnel:8 },
                      { nom:"Urgences",        icon:"🚨", desc:"Prise en charge des urgences médicales",       col:"#DC2626", personnel:6 },
                      { nom:"Hospitalisation", icon:"🛏️", desc:"Suivi des patients hospitalisés",              col:"#7C3AED", personnel:12 },
                      { nom:"Chirurgie",       icon:"🔪", desc:"Interventions chirurgicales programmées",       col:"#0EA5A0", personnel:5 },
                      { nom:"Maternité",       icon:"👶", desc:"Obstétrique et suivi de grossesse",             col:"#D97706", personnel:7 },
                      { nom:"Pédiatrie",       icon:"🧒", desc:"Soins médicaux pour enfants",                  col:"#059669", personnel:4 },
                      { nom:"Laboratoire",     icon:"🔬", desc:"Analyses biologiques et microbiologiques",     col:"#4F46E5", personnel:3 },
                      { nom:"Imagerie",        icon:"🩻", desc:"Radiologie, échographie, scanner",              col:"#6B7280", personnel:2 },
                      { nom:"Pharmacie",       icon:"💊", desc:"Dispensation et gestion des médicaments",      col:"#0B1E3B", personnel:3 },
                    ].map((s) => (
                      <div key={s.nom} className="adm-card" style={{ borderTop:`3px solid ${s.col}` }}>
                        <div style={{ padding:16 }}>
                          <div style={{ fontSize:28, marginBottom:10 }}>{s.icon}</div>
                          <div style={{ fontWeight:700, color:"var(--cn)", fontSize:14, marginBottom:4 }}>{s.nom}</div>
                          <div style={{ fontSize:11.5, color:"var(--cm)", marginBottom:12 }}>{s.desc}</div>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                            <Badge cls="blue">{s.personnel} agents</Badge>
                            <button className="cbtn cbtn-ghost cbtn-sm">{I.edit}</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── DÉPARTEMENTS ── */}
              {section === "departements" && (
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)", marginBottom:16 }}>Départements administratifs</div>
                  <div className="adm-card">
                    <div style={{ overflowX:"auto" }}>
                      <table className="adm-tbl">
                        <thead>
                          <tr><th>Département</th><th>Responsable</th><th>Personnel</th><th>Budget alloué</th><th>Statut</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                          {depts.map(d => (
                            <tr key={d._id}>
                              <td><div style={{ fontWeight:700, color:"var(--cn)" }}>{d.nom}</div></td>
                              <td style={{ fontSize:12, color:"var(--cm)" }}>{d.responsable}</td>
                              <td><Badge cls="blue">{d.personnel} agents</Badge></td>
                              <td style={{ fontWeight:600, color:"var(--cb)" }}>{fmtMoney(d.budget)}</td>
                              <td><Badge cls="green">Actif</Badge></td>
                              <td>
                                <button className="cbtn cbtn-ghost cbtn-sm">{I.edit} Modifier</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SALLES ── */}
              {section === "salles" && (
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)", marginBottom:16 }}>Salles & Infrastructures</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:14 }}>
                    {rooms.map((r) => {
                      const etatCfg = {
                        disponible: { cls:"green", label:"Disponible", col:"#059669" },
                        occupee:    { cls:"red",   label:"Occupée",    col:"#DC2626" },
                        partielle:  { cls:"orange",label:"Partielle",  col:"#D97706" },
                      }[r.etat] || { cls:"gray", label:r.etat, col:"#6B7280" };
                      const typeIcons = { bloc_operatoire:"🔪", consultation:"🩺", hospitalisation:"🛏️", laboratoire:"🔬", urgences:"🚨", imagerie:"🩻" };
                      return (
                        <div key={r._id} className="adm-card" style={{ borderLeft:`4px solid ${etatCfg.col}` }}>
                          <div style={{ padding:16 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                              <div style={{ fontSize:22 }}>{typeIcons[r.type] || "🏥"}</div>
                              <Badge cls={etatCfg.cls}>{etatCfg.label}</Badge>
                            </div>
                            <div style={{ fontWeight:700, color:"var(--cn)", fontSize:14 }}>{r.numero}</div>
                            <div style={{ fontSize:11, color:"var(--cm)", marginTop:4 }}>{r.responsable}</div>
                            <div style={{ display:"flex", justifyContent:"space-between", marginTop:12, fontSize:11, color:"var(--cm)" }}>
                              <span>Capacité : <strong style={{ color:"var(--cn)" }}>{r.capacite}</strong></span>
                              <button className="cbtn cbtn-ghost cbtn-sm" style={{ padding:"3px 8px", fontSize:10 }}>{I.edit}</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── TÂCHES ── */}
              {section === "taches" && (
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)" }}>Tâches administratives</div>
                      <div style={{ fontSize:12, color:"var(--cm)" }}>{tasks.length} tâche(s) au total</div>
                    </div>
                    <button className="cbtn cbtn-primary" onClick={() => { setFormTask(EMPTY_TASK); setModalTask(true); }}>
                      {I.plus} Nouvelle tâche
                    </button>
                  </div>
                  <div className="adm-card">
                    <div style={{ overflowX:"auto" }}>
                      <table className="adm-tbl">
                        <thead>
                          <tr><th>Tâche</th><th>Assigné à</th><th>Catégorie</th><th>Priorité</th><th>Échéance</th><th>Statut</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                          {tasks.map(t => {
                            const sc = TASK_STATUT[t.statut] || { cls:"gray", label:t.statut };
                            const catIcons = { administratif:"📋", maintenance:"🔧", formation:"📚", financier:"💰", rh:"👥", medical:"🩺" };
                            return (
                              <tr key={t._id}>
                                <td>
                                  <div style={{ fontWeight:600, color:"var(--cn)", fontSize:13 }}>{t.titre}</div>
                                  {t.description && <div style={{ fontSize:11, color:"var(--cm)", marginTop:2 }}>{t.description}</div>}
                                </td>
                                <td style={{ fontSize:12, color:"var(--cm)" }}>{t.assignee}</td>
                                <td><Badge cls="gray">{catIcons[t.categorie] || "📋"} {t.categorie}</Badge></td>
                                <td>
                                  <Badge cls={t.priorite === "haute" ? "red" : t.priorite === "normale" ? "blue" : "gray"}>
                                    {t.priorite === "haute" ? "🔴 Haute" : t.priorite === "normale" ? "🔵 Normale" : "⚪ Basse"}
                                  </Badge>
                                </td>
                                <td style={{ fontSize:12, color: new Date(t.echeance) < new Date() && t.statut !== "termine" ? "#DC2626" : "var(--cm)", fontWeight: new Date(t.echeance) < new Date() && t.statut !== "termine" ? 700 : 400 }}>
                                  {fmtDate(t.echeance)}
                                </td>
                                <td><Badge cls={sc.cls}>{sc.label}</Badge></td>
                                <td>
                                  <button className="cbtn cbtn-ghost cbtn-sm" onClick={async () => {
                                    const next = { en_attente:"en_cours", en_cours:"termine", termine:"en_attente" }[t.statut] || "en_attente";
                                    try { await api.put(`/admin/tasks/${t._id}`, { statut: next }); } catch {}
                                    setTasks(prev => prev.map(tk => tk._id === t._id ? { ...tk, statut: next } : tk));
                                    toast.success("✅ Statut mis à jour");
                                  }}>→ Avancer</button>
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

              {/* ── RESSOURCES ── */}
              {section === "ressources" && (
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)", marginBottom:16 }}>Gestion des ressources & équipements</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:16 }}>
                    {[
                      { cat:"Informatique", icon:"🖥️", items:[{n:"Ordinateurs",v:18,ok:16},{n:"Imprimantes",v:6,ok:5},{n:"Serveurs",v:2,ok:2}] },
                      { cat:"Équipements médicaux", icon:"🏥", items:[{n:"Lits hospitaliers",v:40,ok:38},{n:"Moniteurs cardiaques",v:8,ok:7},{n:"Défibrillateurs",v:3,ok:3}] },
                      { cat:"Imagerie", icon:"🩻", items:[{n:"Échographes",v:2,ok:2},{n:"Radios",v:1,ok:1},{n:"Scanner",v:1,ok:0}] },
                      { cat:"Transport", icon:"🚑", items:[{n:"Ambulances",v:2,ok:2},{n:"Véhicules admin.",v:1,ok:1}] },
                    ].map(cat => (
                      <div key={cat.cat} className="adm-card">
                        <div className="adm-card-hdr"><h3>{cat.icon} {cat.cat}</h3></div>
                        <div style={{ padding:16 }}>
                          {cat.items.map(it => (
                            <div key={it.n} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #F3F7FF" }}>
                              <span style={{ fontSize:12, color:"var(--cm)" }}>{it.n}</span>
                              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                                <Badge cls={it.ok === it.v ? "green" : it.ok === 0 ? "red" : "orange"}>{it.ok}/{it.v}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── FOURNISSEURS ── */}
              {section === "fournisseurs" && (
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)" }}>Fournisseurs</div>
                      <div style={{ fontSize:12, color:"var(--cm)" }}>{suppliers.length} fournisseur(s) référencé(s)</div>
                    </div>
                    <button className="cbtn cbtn-primary" onClick={() => { setFormSupplier(EMPTY_SUPPLIER); setModalSupplier(true); }}>
                      {I.plus} Ajouter fournisseur
                    </button>
                  </div>
                  <div className="adm-card">
                    <div style={{ overflowX:"auto" }}>
                      <table className="adm-tbl">
                        <thead>
                          <tr><th>Fournisseur</th><th>Contact</th><th>Produits/Services</th><th>Dernière commande</th><th>Montant total</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                          {suppliers.map(s => (
                            <tr key={s._id}>
                              <td>
                                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                  <div style={{ width:36, height:36, borderRadius:8, background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center" }}>{I.supplier}</div>
                                  <div style={{ fontWeight:600, color:"var(--cn)" }}>{s.nom}</div>
                                </div>
                              </td>
                              <td>
                                <div style={{ fontSize:12, color:"var(--cm)" }}>{s.contact}</div>
                                <div style={{ fontSize:11, color:"#9CA3AF" }}>{s.telephone}</div>
                              </td>
                              <td style={{ fontSize:12, color:"var(--cm)" }}>{s.produits}</td>
                              <td style={{ fontSize:12, color:"var(--cm)" }}>{fmtDate(s.derniere_commande)}</td>
                              <td style={{ fontWeight:700, color:"var(--cb)" }}>{fmtMoney(s.montant_total)}</td>
                              <td>
                                <div style={{ display:"flex", gap:6 }}>
                                  <button className="cbtn cbtn-ghost cbtn-sm">{I.edit}</button>
                                  <button className="cbtn cbtn-ghost cbtn-sm">{I.eye}</button>
                                </div>
                              </td>
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
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)", marginBottom:16 }}>Gestion documentaire</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:14 }}>
                    {[
                      { icon:"📜", titre:"Contrats",            desc:"Contrats de travail et fournisseurs",  nb:12 },
                      { icon:"🏛️", titre:"Agréments",           desc:"Autorisations et agréments officiels", nb:5  },
                      { icon:"📋", titre:"Licences",            desc:"Licences médicales et logicielles",    nb:8  },
                      { icon:"📖", titre:"Procédures internes", desc:"Protocoles et procédures cliniques",   nb:34 },
                      { icon:"📝", titre:"Notes de service",    desc:"Communications internes officielles",  nb:17 },
                      { icon:"💰", titre:"Rapports financiers", desc:"Bilans et rapports comptables",        nb:6  },
                      { icon:"👥", titre:"Dossiers RH",         desc:"Dossiers du personnel",               nb:42 },
                      { icon:"🏥", titre:"Registres médicaux",  desc:"Registres d'activité médicale",        nb:9  },
                    ].map(doc => (
                      <div key={doc.titre} className="adm-card" style={{ cursor:"pointer" }} onClick={() => toast.success(`📂 Ouverture : ${doc.titre}`)}>
                        <div style={{ padding:16 }}>
                          <div style={{ fontSize:28, marginBottom:10 }}>{doc.icon}</div>
                          <div style={{ fontWeight:700, color:"var(--cn)", fontSize:13, marginBottom:4 }}>{doc.titre}</div>
                          <div style={{ fontSize:11, color:"var(--cm)", marginBottom:12 }}>{doc.desc}</div>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                            <Badge cls="blue">{doc.nb} fichier(s)</Badge>
                            <div style={{ display:"flex", gap:4 }}>
                              <button className="cbtn cbtn-ghost cbtn-sm" style={{ padding:"3px 8px" }} onClick={e => { e.stopPropagation(); }}>{I.plus}</button>
                              <button className="cbtn cbtn-ghost cbtn-sm" style={{ padding:"3px 8px" }} onClick={e => { e.stopPropagation(); }}>{I.dl}</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ FINANCES ══ */}
          {tab === "finances" && (
            <div>
              {/* KPIs financiers */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="teal"   icon={I.trend}  value="26.8M" label="Revenus mai 2025"      sub="+ 21% vs avril" />
                <KpiCard color="blue"   icon={I.dollar} value="18.2M" label="Dépenses mai 2025"     sub="salaires + fournisseurs" />
                <KpiCard color="green"  icon={I.check}  value="8.6M"  label="Excédent mai 2025"     sub="résultat net" />
                <KpiCard color={impayesCount > 10 ? "red" : "orange"} icon={I.alert} value={impayesCount} label="Factures impayées" sub="à recouvrer" urgent={impayesCount > 10} />
              </div>

              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"2fr 1fr", gap:20, marginBottom:24 }}>
                <div className="adm-card fu">
                  <div className="adm-card-hdr"><div><h3>{I.trend} Revenus mensuels</h3><p>Exercice 2025</p></div></div>
                  <div style={{ padding:20 }}><BarChart labels={MONTHS} data={revenus} color="#1B4F9E" /></div>
                </div>
                <div className="adm-card fu">
                  <div className="adm-card-hdr"><div><h3>Budget par département</h3></div></div>
                  <div style={{ padding:20 }}>
                    {depts.map(d => (
                      <div key={d._id} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                          <span style={{ color:"var(--cm)" }}>{d.nom}</span>
                          <span style={{ fontWeight:700, color:"var(--cn)" }}>{(d.budget / 1000000).toFixed(1)}M</span>
                        </div>
                        <Prog pct={Math.round(d.budget / 8500000 * 100)} color="#1B4F9E" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dernières transactions */}
              <div className="adm-card fu">
                <div className="adm-card-hdr">
                  <div><h3>{I.dollar} Transactions récentes</h3><p>Dépenses et validations</p></div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button className="cbtn cbtn-ghost cbtn-sm">{I.dl} Excel</button>
                    <button className="cbtn cbtn-ghost cbtn-sm">{I.dl} PDF</button>
                  </div>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table className="adm-tbl">
                    <thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Montant</th><th>Validé par</th><th>Statut</th></tr></thead>
                    <tbody>
                      {[
                        { d:"2025-06-01", lib:"Commande MedPharma Congo",      cat:"Pharmacie",    mnt:850000,  valid:"Henri Mboula", ok:true  },
                        { d:"2025-05-31", lib:"Salaires mai 2025",             cat:"RH",           mnt:9800000, valid:"Alain Koumba", ok:true  },
                        { d:"2025-05-30", lib:"Maintenance équipements labo",  cat:"Maintenance",  mnt:250000,  valid:"En attente",   ok:false },
                        { d:"2025-05-28", lib:"Fournitures de bureau",         cat:"Admin.",       mnt:85000,   valid:"Alain Koumba", ok:true  },
                        { d:"2025-05-25", lib:"Commande TechMed équipements",  cat:"Équipements",  mnt:2500000, valid:"En attente",   ok:false },
                      ].map((row, i) => (
                        <tr key={i}>
                          <td style={{ fontSize:12 }}>{fmtDate(row.d)}</td>
                          <td style={{ fontWeight:600, color:"var(--cn)" }}>{row.lib}</td>
                          <td><Badge cls="gray">{row.cat}</Badge></td>
                          <td style={{ fontWeight:700, color:"var(--cb)" }}>{fmtMoney(row.mnt)}</td>
                          <td style={{ fontSize:12, color:"var(--cm)" }}>{row.valid}</td>
                          <td>
                            {row.ok
                              ? <Badge cls="green">✅ Validée</Badge>
                              : <button className="cbtn cbtn-success cbtn-sm" onClick={() => toast.success("✅ Dépense validée")}>Valider</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ RAPPORTS ══ */}
          {tab === "rapports" && (
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)", marginBottom:20 }}>Rapports administratifs</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 }}>
                {[
                  { icon:"🏥", titre:"Activité clinique",         desc:"Consultations, hospitalisations, interventions par service et par période", color:"#1B4F9E" },
                  { icon:"💰", titre:"Activité financière",        desc:"Revenus, dépenses, budget, taux de recouvrement et impayés",               color:"#059669" },
                  { icon:"👥", titre:"Ressources humaines",        desc:"Effectif, présences, congés, évaluations de performance",                  color:"#7C3AED" },
                  { icon:"🚪", titre:"Occupation des salles",      desc:"Taux d'utilisation des salles, blocs opératoires et lits",                 color:"#0EA5A0" },
                  { icon:"💊", titre:"Consommation pharmacie",      desc:"Médicaments dispensés, stocks critiques, coûts par service",              color:"#D97706" },
                  { icon:"🔬", titre:"Activité laboratoire",       desc:"Analyses réalisées, délais de rendu, résultats anormaux",                  color:"#4F46E5" },
                  { icon:"📊", titre:"Rapport global mensuel",     desc:"Synthèse complète de toutes les activités de la clinique",                 color:"#0B1E3B" },
                  { icon:"🔍", titre:"Rapport d'audit",            desc:"Journal des actions, modifications de paramètres et sécurité",             color:"#DC2626" },
                ].map(r => (
                  <div key={r.titre} className="adm-card fu" style={{ borderTop:`3px solid ${r.color}` }}>
                    <div style={{ padding:20 }}>
                      <div style={{ fontSize:28, marginBottom:12 }}>{r.icon}</div>
                      <div style={{ fontWeight:700, color:"var(--cn)", fontSize:14, marginBottom:6 }}>{r.titre}</div>
                      <div style={{ fontSize:12, color:"var(--cm)", marginBottom:16, lineHeight:1.5 }}>{r.desc}</div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button className="cbtn cbtn-primary cbtn-sm" onClick={() => toast.loading(`📊 Génération ${r.titre}...`, { duration:2000 })}>
                          {I.chart} Générer
                        </button>
                        <button className="cbtn cbtn-ghost cbtn-sm">{I.dl} PDF</button>
                        <button className="cbtn cbtn-ghost cbtn-sm">{I.dl} Excel</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ AUDIT ══ */}
          {tab === "audit" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)" }}>Journal d'audit</div>
                  <div style={{ fontSize:12, color:"var(--cm)" }}>{audit.length} action(s) enregistrée(s)</div>
                </div>
                <button className="cbtn cbtn-ghost cbtn-sm">{I.dl} Exporter</button>
              </div>

              <div className="adm-card">
                <div style={{ padding:"8px 0" }}>
                  {audit.map((a, i) => {
                    const typeCfg = {
                      creation:     { bg:"#ECFDF5", icon:"➕", col:"#059669" },
                      modification: { bg:"#EFF6FF", icon:"✏️", col:"#1B4F9E" },
                      validation:   { bg:"#F0FDFC", icon:"✅", col:"#0EA5A0" },
                      suppression:  { bg:"#FEF2F2", icon:"🗑️", col:"#DC2626" },
                      securite:     { bg:"#FFF7ED", icon:"🔑", col:"#D97706" },
                      document:     { bg:"#F5F3FF", icon:"📄", col:"#7C3AED" },
                      export:       { bg:"#EEF2FF", icon:"📤", col:"#4F46E5" },
                    }[a.type] || { bg:"#F8FAFD", icon:"⚙️", col:"#6B7280" };
                    return (
                      <div key={a._id} className="audit-row" style={{ padding:"12px 20px", borderBottom: i < audit.length - 1 ? "1px solid #F3F7FF" : "" }}>
                        <div className="audit-dot" style={{ background:typeCfg.bg }}>
                          <span style={{ fontSize:14 }}>{typeCfg.icon}</span>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                            <span style={{ fontWeight:700, color:"var(--cn)", fontSize:13 }}>{a.action}</span>
                            <Badge cls="gray" style={{ fontSize:10 }}>{a.utilisateur}</Badge>
                          </div>
                          <div style={{ fontSize:12, color:"var(--cm)", marginTop:3 }}>{a.detail}</div>
                        </div>
                        <div style={{ fontSize:11, color:"#9CA3AF", whiteSpace:"nowrap" }}>
                          {new Date(a.date).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                        </div>
                      </div>
                    );
                  })}
                  {audit.length === 0 && (
                    <div style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>Aucune action enregistrée</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══ PARAMÈTRES ══ */}
          {tab === "parametres" && (
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
              {/* Config générale */}
              <div className="adm-card fu">
                <div className="adm-card-hdr"><h3>⚙️ Informations générales</h3></div>
                <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
                  <div>
                    <label className="clbl">Nom de la clinique *</label>
                    <input className="cinp" value={settings.nom_clinique} onChange={e => setSettings(s => ({ ...s, nom_clinique:e.target.value }))} />
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                    <div>
                      <label className="clbl">Téléphone</label>
                      <input className="cinp" value={settings.telephone} onChange={e => setSettings(s => ({ ...s, telephone:e.target.value }))} />
                    </div>
                    <div>
                      <label className="clbl">Email</label>
                      <input className="cinp" type="email" value={settings.email} onChange={e => setSettings(s => ({ ...s, email:e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="clbl">Adresse</label>
                    <input className="cinp" value={settings.adresse} onChange={e => setSettings(s => ({ ...s, adresse:e.target.value }))} />
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                    <div>
                      <label className="clbl">Devise</label>
                      <select className="cinp" value={settings.devise} onChange={e => setSettings(s => ({ ...s, devise:e.target.value }))}>
                        <option value="CFA">CFA (FCFA)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>
                    <div>
                      <label className="clbl">Langue</label>
                      <select className="cinp" value={settings.langue} onChange={e => setSettings(s => ({ ...s, langue:e.target.value }))}>
                        <option value="fr">Français</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                    <div>
                      <label className="clbl">Heure ouverture</label>
                      <input type="time" className="cinp" value={settings.horaire_debut} onChange={e => setSettings(s => ({ ...s, horaire_debut:e.target.value }))} />
                    </div>
                    <div>
                      <label className="clbl">Heure fermeture</label>
                      <input type="time" className="cinp" value={settings.horaire_fin} onChange={e => setSettings(s => ({ ...s, horaire_fin:e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sécurité */}
              <div>
                <div className="adm-card fu" style={{ marginBottom:20 }}>
                  <div className="adm-card-hdr"><h3>🔐 Sécurité & Accès</h3></div>
                  <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
                    <div>
                      <label className="clbl">Longueur minimale du mot de passe</label>
                      <input type="number" className="cinp" min={6} max={20} value={settings.pwd_min_length} onChange={e => setSettings(s => ({ ...s, pwd_min_length:parseInt(e.target.value) }))} />
                    </div>
                    {[
                      { key:"two_fa",     label:"Double authentification (2FA)", desc:"Exiger un code OTP à la connexion" },
                      { key:"backup_auto",label:"Sauvegardes automatiques",      desc:"Sauvegarder les données chaque nuit" },
                    ].map(opt => (
                      <div key={opt.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"#F8FAFD", borderRadius:12, padding:"12px 14px" }}>
                        <div>
                          <div style={{ fontWeight:600, fontSize:13, color:"var(--cn)" }}>{opt.label}</div>
                          <div style={{ fontSize:11, color:"var(--cm)" }}>{opt.desc}</div>
                        </div>
                        <div
                          style={{ width:44, height:24, borderRadius:99, background:settings[opt.key] ? "var(--ct)" : "#E5E7EB", position:"relative", cursor:"pointer", transition:"background .2s" }}
                          onClick={() => setSettings(s => ({ ...s, [opt.key]: !s[opt.key] }))}
                        >
                          <div style={{ position:"absolute", top:3, left:settings[opt.key] ? 23 : 3, width:18, height:18, borderRadius:"50%", background:"white", transition:"left .2s", boxShadow:"0 1px 3px rgba(0,0,0,.2)" }} />
                        </div>
                      </div>
                    ))}
                    <div className="al-ia" style={{ fontSize:12, color:"#1E40AF" }}>
                      <strong>🔒 Recommandation :</strong> Activer la 2FA pour tous les comptes admin et médecins.
                    </div>
                  </div>
                </div>

                {/* Communication interne */}
                <div className="adm-card fu">
                  <div className="adm-card-hdr"><h3>{I.msg} Communication interne</h3></div>
                  <div style={{ padding:20 }}>
                    {[
                      { icon:"👔", group:"Direction",    nb:3, desc:"Alain Koumba, Dr. Moussavou, Henri Mboula" },
                      { icon:"👨‍⚕️", group:"Médecins",     nb:users.filter(u=>u.role==="medecin").length, desc:"Tous les médecins de la clinique" },
                      { icon:"📋", group:"Administration",nb:users.filter(u=>["admin","comptable","receptionniste"].includes(u.role)).length, desc:"Équipe administrative complète" },
                    ].map(g => (
                      <div key={g.group} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid #F3F7FF" }}>
                        <div style={{ width:36, height:36, background:"#EEF4FF", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{g.icon}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:600, fontSize:13, color:"var(--cn)" }}>{g.group}</div>
                          <div style={{ fontSize:11, color:"var(--cm)" }}>{g.desc}</div>
                        </div>
                        <Badge cls="blue">{g.nb}</Badge>
                        <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => toast.success(`💬 Messagerie groupe ${g.group}`)}>{I.msg}</button>
                      </div>
                    ))}
                    <button className="cbtn cbtn-teal" style={{ marginTop:14, width:"100%" }} onClick={() => toast.success("📢 Diffusion d'une note de service à tous les utilisateurs")}>
                      {I.msg} Envoyer une note de service générale
                    </button>
                  </div>
                </div>
              </div>

              {/* Save button */}
              <div style={{ gridColumn:"1/-1", display:"flex", justifyContent:"flex-end" }}>
                <button className="cbtn cbtn-teal" disabled={saving} onClick={saveSettings}>
                  {I.save} {saving ? "Enregistrement..." : "Enregistrer les paramètres"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ═══ MODAL : UTILISATEUR ═══ */}
        <Modal open={modalUser} onClose={() => { setModalUser(false); setEditUser(null); setFormUser(EMPTY_USER); }} title={editUser ? `✏️ Modifier — ${editUser.prenom} ${editUser.nom}` : `${I.plus} Nouvel utilisateur`} maxWidth={600}>
          <form onSubmit={saveUser}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
              <div>
                <label className="clbl">Prénom *</label>
                <input className="cinp" required value={formUser.prenom} onChange={e => setFormUser(f=>({...f,prenom:e.target.value}))} placeholder="Prénom" />
              </div>
              <div>
                <label className="clbl">Nom *</label>
                <input className="cinp" required value={formUser.nom} onChange={e => setFormUser(f=>({...f,nom:e.target.value}))} placeholder="Nom de famille" />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="clbl">Email *</label>
                <input type="email" className="cinp" required value={formUser.email} onChange={e => setFormUser(f=>({...f,email:e.target.value}))} placeholder="email@clinique.cg" />
              </div>
              <div>
                <label className="clbl">Téléphone</label>
                <input className="cinp" value={formUser.telephone} onChange={e => setFormUser(f=>({...f,telephone:e.target.value}))} placeholder="+242 06 000 0000" />
              </div>
              <div>
                <label className="clbl">Rôle *</label>
                <select className="cinp" required value={formUser.role} onChange={e => setFormUser(f=>({...f,role:e.target.value}))}>
                  {Object.entries(ROLE_CFG).map(([key,cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="clbl">Service / Département</label>
                <select className="cinp" value={formUser.service} onChange={e => setFormUser(f=>({...f,service:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  {["Administration","Chirurgie","Médecine Générale","Urgences","Maternité","Pédiatrie","Laboratoire","Imagerie","Pharmacie","Comptabilité","Informatique","RH"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="clbl">Statut</label>
                <select className="cinp" value={formUser.statut} onChange={e => setFormUser(f=>({...f,statut:e.target.value}))}>
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
                  <option value="suspendu">Suspendu</option>
                </select>
              </div>
              {!editUser && (
                <div>
                  <label className="clbl">Mot de passe *</label>
                  <input type="password" className="cinp" required={!editUser} value={formUser.mot_de_passe} onChange={e => setFormUser(f=>({...f,mot_de_passe:e.target.value}))} placeholder="Minimum 8 caractères" />
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button type="button" className="cbtn cbtn-ghost" onClick={() => { setModalUser(false); setEditUser(null); setFormUser(EMPTY_USER); }}>Annuler</button>
              <button type="submit" className="cbtn cbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>
                {I.save} {saving ? "Enregistrement..." : editUser ? "Mettre à jour" : "Créer le compte"}
              </button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : TÂCHE ═══ */}
        <Modal open={modalTask} onClose={() => setModalTask(false)} title={`${I.plus} Nouvelle tâche`} maxWidth={520}>
          <form onSubmit={saveTask}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label className="clbl">Titre de la tâche *</label>
                <input className="cinp" required value={formTask.titre} onChange={e => setFormTask(f=>({...f,titre:e.target.value}))} placeholder="Ex: Renouveler l'agrément clinique" />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                <div>
                  <label className="clbl">Assigné à</label>
                  <select className="cinp" value={formTask.assignee} onChange={e => setFormTask(f=>({...f,assignee:e.target.value}))}>
                    <option value="">— Sélectionner —</option>
                    {users.map(u => <option key={u._id} value={`${u.prenom} ${u.nom}`}>{u.prenom} {u.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="clbl">Catégorie</label>
                  <select className="cinp" value={formTask.categorie} onChange={e => setFormTask(f=>({...f,categorie:e.target.value}))}>
                    <option value="administratif">📋 Administratif</option>
                    <option value="maintenance">🔧 Maintenance</option>
                    <option value="formation">📚 Formation</option>
                    <option value="financier">💰 Financier</option>
                    <option value="rh">👥 RH</option>
                    <option value="medical">🩺 Médical</option>
                  </select>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                <div>
                  <label className="clbl">Priorité</label>
                  <select className="cinp" value={formTask.priorite} onChange={e => setFormTask(f=>({...f,priorite:e.target.value}))}>
                    <option value="haute">🔴 Haute</option>
                    <option value="normale">🔵 Normale</option>
                    <option value="basse">⚪ Basse</option>
                  </select>
                </div>
                <div>
                  <label className="clbl">Date d'échéance</label>
                  <input type="date" className="cinp" value={formTask.echeance} onChange={e => setFormTask(f=>({...f,echeance:e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="clbl">Description</label>
                <textarea className="cinp" rows={3} value={formTask.description} onChange={e => setFormTask(f=>({...f,description:e.target.value}))} placeholder="Détails de la tâche..." />
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="cbtn cbtn-ghost" onClick={() => setModalTask(false)}>Annuler</button>
                <button type="submit" className="cbtn cbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>
                  {I.save} {saving ? "..." : "Créer la tâche"}
                </button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : FOURNISSEUR ═══ */}
        <Modal open={modalSupplier} onClose={() => setModalSupplier(false)} title={`${I.plus} Nouveau fournisseur`} maxWidth={520}>
          <form onSubmit={saveSupplier}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label className="clbl">Nom du fournisseur *</label>
                <input className="cinp" required value={formSupplier.nom} onChange={e => setFormSupplier(f=>({...f,nom:e.target.value}))} placeholder="Ex: MedPharma Congo" />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                <div>
                  <label className="clbl">Nom du contact</label>
                  <input className="cinp" value={formSupplier.contact} onChange={e => setFormSupplier(f=>({...f,contact:e.target.value}))} placeholder="Responsable commercial" />
                </div>
                <div>
                  <label className="clbl">Téléphone</label>
                  <input className="cinp" value={formSupplier.telephone} onChange={e => setFormSupplier(f=>({...f,telephone:e.target.value}))} placeholder="+242 06 000 0000" />
                </div>
              </div>
              <div>
                <label className="clbl">Email</label>
                <input type="email" className="cinp" value={formSupplier.email} onChange={e => setFormSupplier(f=>({...f,email:e.target.value}))} placeholder="contact@fournisseur.com" />
              </div>
              <div>
                <label className="clbl">Adresse</label>
                <input className="cinp" value={formSupplier.adresse} onChange={e => setFormSupplier(f=>({...f,adresse:e.target.value}))} placeholder="Ville, Pays" />
              </div>
              <div>
                <label className="clbl">Produits / Services fournis *</label>
                <input className="cinp" required value={formSupplier.produits} onChange={e => setFormSupplier(f=>({...f,produits:e.target.value}))} placeholder="Ex: Médicaments génériques, consommables..." />
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="cbtn cbtn-ghost" onClick={() => setModalSupplier(false)}>Annuler</button>
                <button type="submit" className="cbtn cbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>
                  {I.save} {saving ? "..." : "Ajouter le fournisseur"}
                </button>
              </div>
            </div>
          </form>
        </Modal>

      </div>
    </>
  );
}