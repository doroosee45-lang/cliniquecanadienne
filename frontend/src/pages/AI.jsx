


import { useState, useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchAIPredictions, fetchAIStats, runDiagnosis, checkDrugInteractions,
  selectAIPredictions, selectAISuggestions, selectAIWarnings, selectAIStats, selectAILoading,
} from '../store/slices/aiSlice';

// ─── Chart.js loader ─────────────────────────────────────────
function loadChartJs(cb) {
  if (window.Chart) { cb(); return; }
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
  s.onload = cb;
  document.head.appendChild(s);
}

// ─── CSS — même système que Patient / Chirurgie ───────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.ia * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --cn:#0B1E3B; --cn2:#132744; --cb:#1B4F9E;
  --ct:#0EA5A0; --ct2:#0D9490; --cr:#DC2626;
  --co:#D97706; --cg:#059669; --cp:#7C3AED;
  --cbr:#E2EAF4; --cm:#6B7A99; --cl:#EEF4FF; --cs:#F8FAFD;
  --sh:0 1px 3px rgba(11,30,59,.08); --shm:0 4px 16px rgba(11,30,59,.10); --shl:0 12px 40px rgba(11,30,59,.14);
}

/* Topbar */
.ia-top { background:linear-gradient(135deg,var(--cn) 0%,var(--cn2) 55%,#1B4F9E 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.ia-top::before { content:''; position:absolute; top:-50px; right:-50px; width:200px; height:200px; background:radial-gradient(circle,rgba(14,165,160,.22) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
.ia-top::after  { content:''; position:absolute; bottom:-30px; left:80px; width:140px; height:140px; background:radial-gradient(circle,rgba(124,58,237,.18) 0%,transparent 70%); border-radius:50%; pointer-events:none; }

/* Tabs */
.ia-tabs { display:flex; gap:2px; padding:0; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.ia-tabs::-webkit-scrollbar { display:none; }
.ia-tab { display:flex; align-items:center; gap:7px; padding:10px 18px 12px; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.55); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.ia-tab:hover { color:rgba(255,255,255,.88); background:rgba(255,255,255,.08); }
.ia-tab.active { color:var(--cn); background:var(--cs); box-shadow:0 -2px 0 var(--ct) inset; }
.ia-tab-badge { background:var(--cr); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:99px; animation:iaP 2s infinite; }
@keyframes iaP { 0%,100%{opacity:1} 50%{opacity:.4} }
@keyframes iaPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.08);opacity:.8} }
@keyframes iaSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
@keyframes iaTyping { 0%,80%,100%{opacity:0;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }
@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
.fu { animation:fadeUp .35s ease both; }

/* Cards */
.ia-card { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; }
.ia-card:hover { box-shadow:var(--shm); }
.ia-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.ia-card-hdr h3 { font-size:14px; font-weight:700; color:var(--cn); margin:0; display:flex; align-items:center; gap:8px; }
.ia-card-hdr p  { font-size:11px; color:var(--cm); margin:2px 0 0; }

/* KPI */
.ia-kpi { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:pointer; }
.ia-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.ia-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.ia-kpi.blue::before   { background:var(--cb); } .ia-kpi.teal::before   { background:var(--ct); }
.ia-kpi.red::before    { background:var(--cr); } .ia-kpi.orange::before { background:var(--co); }
.ia-kpi.green::before  { background:var(--cg); } .ia-kpi.purple::before { background:var(--cp); }
.kpi-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
.kpi-icon.blue   { background:#EFF6FF; color:var(--cb); } .kpi-icon.teal   { background:#F0FDFC; color:var(--ct); }
.kpi-icon.red    { background:#FEF2F2; color:var(--cr); } .kpi-icon.orange { background:#FFF7ED; color:var(--co); }
.kpi-icon.green  { background:#ECFDF5; color:var(--cg); } .kpi-icon.purple { background:#F5F3FF; color:var(--cp); }
.kpi-val { font-size:26px; font-weight:800; color:var(--cn); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.kpi-lbl { font-size:11.5px; font-weight:600; color:var(--cm); }
.kpi-sub { font-size:10.5px; color:#9CA3AF; margin-top:2px; }
.kpi-dot { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--cr); animation:iaP 2s infinite; }

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
.ia-prog { background:#EEF4FF; border-radius:99px; height:7px; overflow:hidden; }
.ia-prog-f { height:100%; border-radius:99px; transition:width .8s ease; }

/* Buttons */
.ibtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; }
.ibtn-primary { background:var(--cb); color:#fff; } .ibtn-primary:hover { background:#174391; transform:translateY(-1px); }
.ibtn-teal    { background:var(--ct); color:#fff; } .ibtn-teal:hover    { background:var(--ct2); transform:translateY(-1px); }
.ibtn-purple  { background:var(--cp); color:#fff; } .ibtn-purple:hover  { background:#6D28D9; transform:translateY(-1px); }
.ibtn-ghost   { background:transparent; color:var(--cm); border:1.5px solid var(--cbr); }
.ibtn-ghost:hover { background:var(--cl); color:var(--cn); }
.ibtn-danger  { background:#FEF2F2; color:var(--cr); border:1.5px solid #FECACA; }
.ibtn-sm { padding:6px 12px; font-size:12px; }
.ibtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }

/* Forms */
.ilbl { font-size:12px; font-weight:600; color:var(--cm); margin-bottom:6px; display:block; }
.iinp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--cbr); background:#FAFBFF; font-size:13px; color:var(--cn); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; resize:vertical; }
.iinp:focus { border-color:var(--ct); box-shadow:0 0 0 3px rgba(14,165,160,.12); }

/* Section nav */
.sec-nav { display:flex; gap:6px; flex-wrap:wrap; padding:14px 20px; background:linear-gradient(to right,#F8FAFD,#EEF4FF); border-bottom:1.5px solid var(--cbr); }
.sec-btn { display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all .2s; color:var(--cm); background:none; font-family:'Poppins',sans-serif; }
.sec-btn:hover { background:white; color:var(--cn); border-color:var(--cbr); }
.sec-btn.active { background:var(--cn); color:white; border-color:var(--cn); }
.sec-btn.warn { border-color:#FECACA; color:var(--cr); }

/* Alerts */
.al-ia   { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; border-left:4px solid var(--cb); border-radius:14px; padding:14px 18px; }
.al-warn { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--co); border-radius:14px; padding:14px 18px; }
.al-danger { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--cr); border-radius:14px; padding:14px 18px; }
.al-success { background:linear-gradient(135deg,#ECFDF5,#D1FAE5); border:1.5px solid #A7F3D0; border-left:4px solid var(--cg); border-radius:14px; padding:14px 18px; }
.al-purple { background:linear-gradient(135deg,#F5F3FF,#EDE9FE); border:1.5px solid #DDD6FE; border-left:4px solid var(--cp); border-radius:14px; padding:14px 18px; }

/* Table */
.ia-tbl { width:100%; border-collapse:collapse; }
.ia-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.ia-tbl th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--cm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--cbr); white-space:nowrap; }
.ia-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.ia-tbl tbody tr:last-child td { border-bottom:none; }
.ia-tbl tbody tr:hover { background:#F8FAFF; }

/* Modal */
.mov { position:fixed; inset:0; z-index:500; background:rgba(11,30,59,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.mov-box { background:#fff; border-radius:20px; box-shadow:var(--shl); width:100%; max-width:620px; max-height:90vh; overflow-y:auto; animation:slideUp .25s ease; }
@keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.mov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:#EEF4FF; position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.mov-hdr h3 { font-size:16px; font-weight:700; color:var(--cn); margin:0; display:flex; align-items:center; gap:10px; }
.mov-cls { width:32px; height:32px; border-radius:8px; background:#F3F7FF; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--cm); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.mov-cls:hover { background:#FEF2F2; color:var(--cr); }
.mov-body { padding:24px; }

/* Chat */
.chat-wrap { display:flex; flex-direction:column; height:480px; }
.chat-msgs { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px; scrollbar-width:thin; scrollbar-color:var(--cbr) transparent; }
.chat-msg { display:flex; gap:10px; animation:fadeUp .2s ease; }
.chat-msg.user { flex-direction:row-reverse; }
.chat-bubble { max-width:72%; padding:10px 14px; border-radius:14px; font-size:13px; line-height:1.55; }
.chat-msg.bot .chat-bubble  { background:#F8FAFD; border:1.5px solid var(--cbr); color:var(--cn); border-radius:4px 14px 14px 14px; }
.chat-msg.user .chat-bubble { background:var(--cb); color:#fff; border-radius:14px 4px 14px 14px; }
.chat-avatar { width:32px; height:32px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
.chat-msg.bot .chat-avatar  { background:linear-gradient(135deg,var(--cb),var(--ct)); }
.chat-msg.user .chat-avatar { background:linear-gradient(135deg,#4B5563,#6B7280); }
.chat-time { font-size:10px; color:var(--cm); margin-top:4px; }
.chat-input-row { padding:12px 16px; border-top:1.5px solid var(--cbr); display:flex; gap:8px; background:#F8FAFD; }
.chat-input { flex:1; padding:10px 14px; border-radius:12px; border:1.5px solid var(--cbr); background:#fff; font-size:13px; font-family:'Poppins',sans-serif; outline:none; color:var(--cn); }
.chat-input:focus { border-color:var(--ct); box-shadow:0 0 0 3px rgba(14,165,160,.1); }
.typing-dot { width:7px; height:7px; border-radius:50%; background:var(--cm); display:inline-block; animation:iaTyping 1.2s infinite; }
.typing-dot:nth-child(2){animation-delay:.2s}
.typing-dot:nth-child(3){animation-delay:.4s}

/* IA Score ring */
.score-ring { position:relative; display:inline-flex; align-items:center; justify-content:center; }
.score-ring svg { transform:rotate(-90deg); }
.score-ring-val { position:absolute; text-align:center; }

/* Suggestion chip */
.chip { display:inline-flex; align-items:center; gap:5px; padding:5px 12px; border-radius:99px; font-size:11.5px; font-weight:600; cursor:pointer; border:1.5px solid var(--cbr); color:var(--cn); background:#fff; transition:all .15s; font-family:'Poppins',sans-serif; }
.chip:hover { background:var(--cl); border-color:var(--ct); color:var(--ct); }

/* Toggle */
.tog { position:relative; width:40px; height:22px; flex-shrink:0; }
.tog input { opacity:0; width:0; height:0; }
.tog-sl { position:absolute; cursor:pointer; inset:0; background:#D1D5DB; border-radius:99px; transition:.3s; }
.tog-sl::before { content:''; position:absolute; width:16px; height:16px; left:3px; bottom:3px; background:#fff; border-radius:50%; transition:.3s; }
.tog input:checked + .tog-sl { background:var(--ct); }
.tog input:checked + .tog-sl::before { transform:translateX(18px); }

/* Risk bar */
.risk-bar { height:12px; border-radius:99px; overflow:hidden; background:#EEF4FF; position:relative; }
.risk-bar-f { height:100%; border-radius:99px; position:absolute; left:0; top:0; transition:width 1s ease; }

/* Spinning loader */
.spin { animation:iaSpin 1s linear infinite; }

/* ─── Responsive ─── */
.ia-g2  { display:grid; grid-template-columns:2fr 1fr; gap:20px; }
.ia-g11 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.ia-g11s{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
@media (max-width:767px) {
  .ia-top { padding:12px 14px 0; }
  .ia-g2,.ia-g11 { grid-template-columns:1fr; gap:14px; }
  .ia-g11s { grid-template-columns:1fr 1fr; gap:8px; }
  .iinp { font-size:16px !important; }
  .ibtn { font-size:12px; padding:8px 12px; } .ibtn-sm { font-size:11px; padding:5px 8px; }
  .ia-card { border-radius:14px; } .ia-card-hdr { padding:11px 14px; }
  .mov { padding:0; align-items:flex-end; } .mov-box { border-radius:20px 20px 0 0; max-width:100%; max-height:93vh; }
  .mov-hdr { padding:13px 16px; } .mov-body { padding:14px; }
}
@media (max-width:479px) {
  .ia-top { padding:10px 12px 0; } .ia-g11s { grid-template-columns:1fr; }
  .ia-card-hdr { flex-wrap:wrap; gap:8px; }
}
`;

// ─── Helpers ─────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const fmtTime = () => new Date().toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
const now = () => new Date().toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });

// ─── Icons ────────────────────────────────────────────────────
const I = {
  ia:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  iaS:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  alert:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  chat:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  file:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  pulse:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  flask:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3h6M9 3v8L5.5 17A2 2 0 007.3 20h9.4a2 2 0 001.8-3L15 11V3"/></svg>,
  scan:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>,
  calendar:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  dollar:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  trend:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  send:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  settings:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  book:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
  clock:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  user:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  pill:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.5 20H4a2 2 0 01-2-2V6a2 2 0 012-2h16a2 2 0 012 2v7"/><path d="M16 19h6M19 16v6"/></svg>,
  check:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  dl:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  grid:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
};

// ─── Demo data ────────────────────────────────────────────────
const DEMO_ALERTS = [
  { id:"a1", type:"medical",  priority:"critique", icon:"🚨", title:"Allergie critique détectée", detail:"Patient Paul Nguema — Prescription Aspirine en cours. Allergie connue.", time:"Il y a 3 min", module:"Pharmacie" },
  { id:"a2", type:"medical",  priority:"eleve",    icon:"⚠️", title:"Résultat labo anormal",      detail:"Glycémie 7.8 mmol/L — Patient Jean Dupont. Valeur critique.", time:"Il y a 12 min", module:"Laboratoire" },
  { id:"a3", type:"medical",  priority:"eleve",    icon:"🔴", title:"Patient à risque cardiaque",  detail:"Score risque cardiovasculaire 78/100 — André Mboula. Suivi urgent.", time:"Il y a 28 min", module:"Patients" },
  { id:"a4", type:"admin",    priority:"modere",   icon:"💊", title:"Stock médicament faible",     detail:"Amoxicilline 1g — 12 boîtes restantes. Seuil critique à 10.", time:"Il y a 1h", module:"Pharmacie" },
  { id:"a5", type:"admin",    priority:"modere",   icon:"📅", title:"Rendez-vous manqués",         detail:"4 patients n'ont pas honoré leur rendez-vous aujourd'hui.", time:"Il y a 2h", module:"Rendez-vous" },
  { id:"a6", type:"finance",  priority:"modere",   icon:"💰", title:"Factures impayées",           detail:"3 factures > 30 jours non réglées. Total : 510 000 CFA.", time:"Il y a 3h", module:"Finance" },
  { id:"a7", type:"medical",  priority:"faible",   icon:"💉", title:"Vaccin en retard",             detail:"Jean Dupont — Rappel COVID-19 prévu le 15/10/2024.", time:"Hier", module:"Vaccination" },
];

const DEMO_ANALYSES_IA = [
  { id:"h1", date:"2025-06-02 10:34", user:"Dr. Leblanc", action:"Analyse clinique", patient:"Jean Dupont", resultat:"2 diagnostics suggérés", valide:true },
  { id:"h2", date:"2025-06-02 09:12", user:"Dr. Pierre",  action:"Ordonnance IA",   patient:"Marie Paul",  resultat:"Interactions vérifiées OK", valide:true },
  { id:"h3", date:"2025-06-01 16:45", user:"Lab. Tech",   action:"Analyse labo",    patient:"Paul Nguema", resultat:"3 valeurs anormales détectées", valide:true },
  { id:"h4", date:"2025-06-01 14:20", user:"Dr. Leblanc", action:"Risque patient",  patient:"André Mboula", resultat:"Risque cardiovasculaire élevé", valide:false },
  { id:"h5", date:"2025-06-01 11:05", user:"Admin",       action:"Rapport mensuel", patient:"—",            resultat:"Rapport PDF généré", valide:true },
];

const DEMO_KNOWLEDGE = [
  { id:"k1", categorie:"Protocole",          titre:"Prise en charge appendicite aiguë",   tags:["chirurgie","urgence","abdomen"] },
  { id:"k2", categorie:"Recommandation",     titre:"HTA — Cibles tensionnelles 2024",      tags:["cardiologie","HTA","médecine"] },
  { id:"k3", categorie:"Guide thérapeutique",titre:"Diabète type 2 — Algorithme insuline", tags:["diabète","insuline","endocrinologie"] },
  { id:"k4", categorie:"Protocole",          titre:"Antibiothérapie post-opératoire",       tags:["chirurgie","antibiotiques","infection"] },
  { id:"k5", categorie:"Recommandation",     titre:"Dépistage cancer colorectal",           tags:["oncologie","coloscopie","dépistage"] },
];

// ─── Score Ring SVG ───────────────────────────────────────────
function ScoreRing({ score, size = 80, color = "#1B4F9E" }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="score-ring" style={{ width:size, height:size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#EEF4FF" strokeWidth="8"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition:"stroke-dasharray 1s ease" }}/>
      </svg>
      <div className="score-ring-val">
        <div style={{ fontSize:size*0.22, fontWeight:800, color, lineHeight:1 }}>{score}</div>
        <div style={{ fontSize:size*0.12, color:"var(--cm)", fontWeight:600 }}>/100</div>
      </div>
    </div>
  );
}

// ─── Badge ───────────────────────────────────────────────────
function Badge({ cls, children }) {
  return <span className={`ibdg ${cls}`}>{children}</span>;
}

// ─── KPI Card ────────────────────────────────────────────────
function KpiCard({ color, icon, value, label, sub, urgent, onClick }) {
  return (
    <div className={`ia-kpi ${color} fu`} onClick={onClick} style={{ cursor:onClick?"pointer":"default" }}>
      {urgent && <div className="kpi-dot"/>}
      <div className={`kpi-icon ${color}`}>{icon}</div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-lbl">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────
function Modal({ open, onClose, title, children, maxWidth=620 }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="mov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mov-box" style={{ maxWidth }}>
        <div className="mov-hdr"><h3>{title}</h3><button className="mov-cls" onClick={onClose}>×</button></div>
        <div className="mov-body">{children}</div>
      </div>
    </div>
  );
}

// ─── Prog bar ────────────────────────────────────────────────
function Prog({ pct, color }) {
  return (
    <div className="ia-prog">
      <div className="ia-prog-f" style={{ width:`${pct}%`, background:color }} />
    </div>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────
function BarChart({ labels, data, color="#1B4F9E", height=180 }) {
  const ref = useRef(null); const chartRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new window.Chart(ref.current, {
        type:"bar",
        data:{ labels, datasets:[{ data, backgroundColor:`${color}22`, borderColor:color, borderWidth:2, borderRadius:8, borderSkipped:false }] },
        options:{ responsive:true, maintainAspectRatio:true, plugins:{ legend:{display:false}, tooltip:{backgroundColor:"#0B1E3B",padding:10,cornerRadius:10} }, scales:{ x:{grid:{display:false},ticks:{font:{size:10},color:"#9CA3AF"},border:{display:false}}, y:{beginAtZero:true,grid:{color:"rgba(0,0,0,.04)"},ticks:{font:{size:10},color:"#9CA3AF",precision:0},border:{display:false}} } }
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [labels, data, color]);
  return <canvas ref={ref} style={{ maxHeight:height }} />;
}

function LineChart({ labels, data, color="#0EA5A0", height=160 }) {
  const ref = useRef(null); const chartRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new window.Chart(ref.current, {
        type:"line",
        data:{ labels, datasets:[{ data, borderColor:color, backgroundColor:`${color}15`, fill:true, tension:0.4, pointBackgroundColor:color, pointRadius:3, borderWidth:2 }] },
        options:{ responsive:true, maintainAspectRatio:true, plugins:{ legend:{display:false}, tooltip:{backgroundColor:"#0B1E3B",padding:10,cornerRadius:10} }, scales:{ x:{grid:{display:false},ticks:{font:{size:10},color:"#9CA3AF"},border:{display:false}}, y:{beginAtZero:true,grid:{color:"rgba(0,0,0,.04)"},ticks:{font:{size:10},color:"#9CA3AF"},border:{display:false}} } }
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [labels, data, color]);
  return <canvas ref={ref} style={{ maxHeight:height }} />;
}

// ═════════════════════════════════════════════════════════════
export default function IntelligenceArtificielle() {
  const dispatch = useDispatch();
  const reduxPredictions = useSelector(selectAIPredictions);
  const reduxStats = useSelector(selectAIStats);
  const reduxWarnings = useSelector(selectAIWarnings);

  useEffect(() => {
    dispatch(fetchAIPredictions({}));
    dispatch(fetchAIStats());
  }, [dispatch]);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => { const fn = () => setIsMobile(window.innerWidth <= 599); window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn); }, []);

  const [tab, setTab] = useState("dashboard");
  const [section, setSection] = useState("assistant");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [chatMessages, setChatMessages] = useState([
    { role:"bot", content:"Bonjour ! Je suis votre assistant IA médical. Posez-moi des questions sur les patients, analyses, rapports ou la gestion de la clinique.", time:"09:00" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [kbSearch, setKbSearch] = useState("");
  const chatEndRef = useRef(null);

  // Form états
  const [formSymptomes, setFormSymptomes] = useState("");
  const [formAntecedents, setFormAntecedents] = useState("");
  const [formSignesVitaux, setFormSignesVitaux] = useState("");
  const [formBioResults, setFormBioResults] = useState("");
  const [formMedicament, setFormMedicament] = useState("");
  const [formAllergiesPatient, setFormAllergiesPatient] = useState("");

  // Settings
  const [settings, setSettings] = useState({
    assistant_medical: true,
    analyse_labo: true,
    analyse_imagerie: true,
    ordonnance_ia: true,
    alertes_auto: true,
    rapports_auto: false,
    gestion_rdv: true,
    analyse_financiere: false,
    langue: "fr",
    niveau_assistance: "standard",
  });

  // Alertes lues
  const [alertesLues, setAlertesLues] = useState([]);
  const nbAlertesNonLues = DEMO_ALERTS.filter(a => !alertesLues.includes(a.id) && a.priority === "critique").length;

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [chatMessages]);

  // ── Analyse clinique simulée ──────────────────────────────
  const lancerAnalyse = async () => {
    if (!formSymptomes.trim()) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    await new Promise(r => setTimeout(r, 2200));
    setAnalysisResult({
      diagnostics: [
        { label:"Appendicite aiguë", proba:82, gravite:"eleve" },
        { label:"Colique hépatique", proba:61, gravite:"modere" },
        { label:"Gastroentérite aiguë", proba:44, gravite:"faible" },
      ],
      examens: ["NFS + CRP en urgence","Échographie abdominale","Bilan hépatique complet","ECBU"],
      gravite: "eleve",
      orientation: "Chirurgie ou Urgences",
      note: "Ces suggestions sont indicatives. La décision clinique appartient au médecin.",
    });
    setAnalyzing(false);
  };

  // ── Vérification ordonnance simulée ──────────────────────
  const [ordoResult, setOrdoResult] = useState(null);
  const [ordoLoading, setOrdoLoading] = useState(false);
  const verifierOrdonnance = async () => {
    if (!formMedicament.trim()) return;
    setOrdoLoading(true); setOrdoResult(null);
    await new Promise(r => setTimeout(r, 1800));
    const hasAllergie = formAllergiesPatient.toLowerCase().includes("pénicilline") && formMedicament.toLowerCase().includes("amoxicilline");
    setOrdoResult({
      ok: !hasAllergie,
      interactions: hasAllergie ? [{ med1:"Amoxicilline", med2:"Allergie Pénicilline", risque:"CONTRE-INDICATION ABSOLUE", gravite:"critique" }] : [],
      posologie: "500 mg - 1 g × 3/j pendant 7-10 jours",
      alternatives: hasAllergie ? ["Azithromycine 500 mg/j × 3j", "Clarithromycine 500 mg × 2/j"] : [],
    });
    setOrdoLoading(false);
  };

  // ── Chat ──────────────────────────────────────────────────
  const CHAT_RESPONSES = {
    "patient":  "Voici un résumé rapide :\n• **24 patients actifs** suivis cette semaine\n• 3 patients avec alertes médicales actives\n• Prochains RDV : 8 aujourd'hui\n\nVoulez-vous accéder au dossier d'un patient spécifique ?",
    "labo":     "Derniers résultats biologiques :\n• Jean Dupont — Glycémie anormale (7.8 mmol/L)\n• Paul Nguema — NFS : anémie légère (Hb 10.2 g/dL)\n• Marie Paul — Bilan hormonal en attente\n\n2 résultats urgents à traiter.",
    "facture":  "Factures impayées :\n• 3 factures non réglées depuis > 30 jours\n• Total : **510 000 CFA**\n• Dont : chirurgie Dupont (225 000 CFA)\n\nSouhaitez-vous générer les relances automatiques ?",
    "rapport":  "Génération du rapport mensuel en cours…\n\n📊 Le rapport Mai 2025 comprend :\n• 48 consultations · 12 hospitalisations\n• 6 interventions chirurgicales\n• CA : 4 850 000 CFA\n\n✅ Rapport PDF prêt à télécharger.",
    "hospit":   "Patients hospitalisés aujourd'hui :\n• Paul Nguema — Service Chirurgie, Chambre 102A\n• Fatou Bongo — Service Pédiatrie, Chambre 205B\n\n2 entrées prévues cet après-midi.",
    "default":  "Je traite votre demande… Pouvez-vous préciser davantage ? Je peux vous aider avec :\n• Analyse d'un dossier patient\n• Résultats biologiques\n• Gestion des rendez-vous\n• Rapports et statistiques\n• Factures et finances",
  };
  const getResponse = (msg) => {
    const m = msg.toLowerCase();
    if (m.includes("patient") || m.includes("dossier")) return CHAT_RESPONSES["patient"];
    if (m.includes("labo") || m.includes("résultat") || m.includes("analyse")) return CHAT_RESPONSES["labo"];
    if (m.includes("facture") || m.includes("payé") || m.includes("finance")) return CHAT_RESPONSES["facture"];
    if (m.includes("rapport") || m.includes("mensuel") || m.includes("statistique")) return CHAT_RESPONSES["rapport"];
    if (m.includes("hospit") || m.includes("hospitalisé")) return CHAT_RESPONSES["hospit"];
    return CHAT_RESPONSES["default"];
  };
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatMessages(p => [...p, { role:"user", content:msg, time:now() }]);
    setChatInput("");
    setChatLoading(true);
    await new Promise(r => setTimeout(r, 1400 + Math.random()*600));
    setChatMessages(p => [...p, { role:"bot", content:getResponse(msg), time:now() }]);
    setChatLoading(false);
  };

  const SECTIONS = [
    { id:"assistant",     label:"🩺 Assistant médical" },
    { id:"patient",       label:"👤 Analyse patient" },
    { id:"ordonnance",    label:"💊 Ordonnance IA" },
    { id:"laboratoire",   label:"🔬 Laboratoire IA" },
    { id:"imagerie",      label:"🩻 Imagerie IA" },
    { id:"rdv",           label:"📅 Rendez-vous" },
    { id:"administratif", label:"📋 Administratif" },
    { id:"finance",       label:"💰 Finance IA" },
    { id:"alertes",       label:`🔔 Alertes (${DEMO_ALERTS.filter(a=>a.priority==="critique").length})`, warn:true },
    { id:"chat",          label:"💬 Chat IA" },
    { id:"knowledge",     label:"📚 Base de connaissances" },
    { id:"historique",    label:"📊 Historique" },
    { id:"parametres",    label:"⚙️ Paramètres" },
  ];

  const GRAVITE_CFG = { critique:{cls:"red",label:"Critique"}, eleve:{cls:"orange",label:"Élevé"}, modere:{cls:"yellow",label:"Modéré"}, faible:{cls:"green",label:"Faible"} };
  const GRAVITE_COLORS = { critique:"#DC2626", eleve:"#D97706", modere:"#CA8A04", faible:"#059669" };

  const kbFiltered = DEMO_KNOWLEDGE.filter(k =>
    !kbSearch || k.titre.toLowerCase().includes(kbSearch.toLowerCase()) || k.tags.some(t => t.includes(kbSearch.toLowerCase()))
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="ia">

        {/* ── TOPBAR ── */}
        <div className="ia-top">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap", position:"relative", zIndex:2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:54, height:54, borderRadius:14, background:"rgba(255,255,255,.12)", border:"1.5px solid rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center", animation:"iaPulse 3s infinite" }}>
                {I.ia}
              </div>
              <div>
                <div style={{ fontSize:21, fontWeight:700, color:"#fff", letterSpacing:-.3 }}>Intelligence Artificielle</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.55)", marginTop:2, display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ width:7, height:7, borderRadius:"50%", background:"#4ADE80", display:"inline-block", boxShadow:"0 0 0 3px rgba(74,222,128,.3)", animation:"iaP 2s infinite" }}/>
                  IA active · Clinique Canadienne de Souanké
                </div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {nbAlertesNonLues > 0 && (
                <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(220,38,38,.2)", border:"1px solid rgba(220,38,38,.4)", borderRadius:10, padding:"8px 14px" }}>
                  <span style={{ fontSize:14 }}>🔴</span>
                  <span style={{ fontSize:12, color:"#FCA5A5", fontWeight:700 }}>{nbAlertesNonLues} alerte{nbAlertesNonLues > 1?"s":""} critique{nbAlertesNonLues > 1?"s":""}</span>
                </div>
              )}
              <button className="ibtn ibtn-teal ibtn-sm" onClick={() => setTab("modules") }>
                {I.iaS} Lancer analyse
              </button>
            </div>
          </div>

          {/* Tabs */}
          {(() => {
            const TABS = [
              { key:"dashboard", icon:I.grid,    label:"Tableau de bord",        labelM:"Dashboard" },
              { key:"modules",   icon:I.iaS,     label:"Modules IA",             labelM:"Modules" },
              { key:"chat",      icon:I.chat,    label:"Chat IA",                labelM:"Chat" },
              { key:"alertes",   icon:I.alert,   label:`Alertes${nbAlertesNonLues>0?" ("+nbAlertesNonLues+")":""}`, labelM:"Alertes" },
              { key:"historique",icon:I.clock,   label:"Historique",             labelM:"Historique" },
              { key:"knowledge", icon:I.book,    label:"Base de connaissances",  labelM:"Base" },
              { key:"settings",  icon:I.settings,label:"Paramètres",             labelM:"Paramètres" },
            ];
            return (
              <div style={isMobile?{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'4px',padding:'8px 10px',marginTop:'8px',background:'rgba(255,255,255,.07)',borderRadius:'10px 10px 0 0'}:{display:'flex',gap:'2px',marginTop:'16px',overflowX:'auto',scrollbarWidth:'none'}}>
                {TABS.map(t=>(
                  <button key={t.key} className={`ia-tab ${tab===t.key?"active":""}`} style={isMobile?{flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'7px 3px 8px',fontSize:'9.5px',gap:'3px',borderRadius:'8px',whiteSpace:'normal',minWidth:0}:{}} onClick={()=>setTab(t.key)}>
                    <span style={isMobile?{fontSize:'14px'}:{}}>{t.icon}</span>
                    <span style={isMobile?{lineHeight:1.2}:{}}>{isMobile?t.labelM:t.label}</span>
                    {t.key==="alertes"&&nbAlertesNonLues>0&&<span className="ia-tab-badge">{nbAlertesNonLues}</span>}
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
              {/* Alerte critique */}
              {nbAlertesNonLues > 0 && (
                <div className="al-danger fu" style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, flexWrap:"wrap" }}>
                  <div style={{ width:42, height:42, background:"#FEE2E2", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{I.alert}</div>
                  <div style={{ flex:1 }}>
                    <strong style={{ color:"#B91C1C", fontSize:13 }}>🤖 IA — {nbAlertesNonLues} alerte(s) critique(s) détectée(s) ce jour</strong>
                    <div style={{ fontSize:12, color:"#DC2626", marginTop:3 }}>Allergie critique, résultats biologiques anormaux et patient à haut risque cardiovasculaire signalés.</div>
                  </div>
                  <button className="ibtn ibtn-danger ibtn-sm" onClick={() => setTab("alertes")}>Voir les alertes →</button>
                </div>
              )}

              {/* KPIs */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="blue"   icon={I.iaS}      value="248"  label="Analyses IA"        sub="ce mois" />
                <KpiCard color="red"    icon={I.alert}    value={DEMO_ALERTS.filter(a=>a.priority==="critique").length} label="Alertes critiques" sub="aujourd'hui" urgent />
                <KpiCard color="teal"   icon={I.pulse}    value="31"   label="Diagnostics assistés" sub="ce mois" />
                <KpiCard color="purple" icon={I.pill}     value="94"   label="Ordonnances vérifiées" sub="0 interaction grave" />
                <KpiCard color="green"  icon={I.calendar} value="67"   label="RDV optimisés"      sub="réduction attente 24%" />
                <KpiCard color="orange" icon={I.file}     value="18"   label="Rapports générés"    sub="automatiquement" />
              </div>

              {/* Charts + reco */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"2fr 1fr", gap:20, marginBottom:20 }}>
                <div className="ia-card fu">
                  <div className="ia-card-hdr">
                    <div><h3>{I.trend} Activité IA — 7 derniers jours</h3><p>Volume d'analyses et alertes générées</p></div>
                  </div>
                  <div style={{ padding:20 }}>
                    <BarChart labels={["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"]} data={[12,18,9,24,16,7,4]} color="#1B4F9E" />
                  </div>
                </div>
                <div className="ia-card fu">
                  <div className="ia-card-hdr"><h3>📊 Modules actifs</h3></div>
                  <div style={{ padding:20 }}>
                    {[
                      ["Assistant médical", 95, "#1B4F9E"],
                      ["Analyse labo",      88, "#0EA5A0"],
                      ["Ordonnance IA",     76, "#7C3AED"],
                      ["Alertes auto",      100,"#DC2626"],
                      ["Gestion RDV",       62, "#D97706"],
                      ["Finance IA",        0,  "#9CA3AF"],
                    ].map(([lbl, pct, col]) => (
                      <div key={lbl} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ fontSize:12, color:"var(--cm)", display:"flex", alignItems:"center", gap:6 }}>
                            <span style={{ width:8, height:8, borderRadius:3, background:col, display:"inline-block" }}/>
                            {lbl}
                          </span>
                          <span style={{ fontSize:12, fontWeight:700, color:pct===0?"#9CA3AF":"var(--cn)" }}>
                            {pct === 0 ? "Inactif" : `${pct}%`}
                          </span>
                        </div>
                        <Prog pct={pct} color={col} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scores risque patients + recommandations */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                <div className="ia-card fu">
                  <div className="ia-card-hdr"><div><h3>👤 Scores de risque patients</h3><p>Calculés par l'IA aujourd'hui</p></div></div>
                  <div style={{ padding:20, display:"flex", flexDirection:"column", gap:12 }}>
                    {[
                      { nom:"André Mboula",  score:82, niveau:"critique", motif:"Cardiopathie + BPCO + âge > 70 ans" },
                      { nom:"Paul Nguema",   score:68, niveau:"eleve",    motif:"Diabète + Insuffisance rénale" },
                      { nom:"Jean Dupont",   score:45, niveau:"modere",   motif:"HTA + surpoids" },
                      { nom:"Marie Paul",    score:22, niveau:"faible",   motif:"Aucun facteur de risque majeur" },
                    ].map(p => {
                      const gc = GRAVITE_CFG[p.niveau] || { cls:"gray", label:"—" };
                      const col = GRAVITE_COLORS[p.niveau] || "#9CA3AF";
                      return (
                        <div key={p.nom} style={{ display:"flex", alignItems:"center", gap:12, background:"#F8FAFD", borderRadius:12, padding:"10px 14px", border:"1.5px solid var(--cbr)" }}>
                          <ScoreRing score={p.score} size={52} color={col} />
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:700, fontSize:13, color:"var(--cn)" }}>{p.nom}</div>
                            <div style={{ fontSize:11, color:"var(--cm)", marginTop:2 }}>{p.motif}</div>
                          </div>
                          <Badge cls={gc.cls}>{gc.label}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="ia-card fu">
                  <div className="ia-card-hdr"><h3>🤖 Recommandations IA du jour</h3></div>
                  <div style={{ padding:20, display:"flex", flexDirection:"column", gap:10 }}>
                    {[
                      { p:"🔴", t:"Urgence",        d:"Revoir André Mboula avant toute intervention — risque critique 82/100", col:"#DC2626" },
                      { p:"🟠", t:"Labo",           d:"3 résultats biologiques anormaux en attente de validation médicale", col:"#D97706" },
                      { p:"🟡", t:"Pharmacie",      d:"Stock Amoxicilline sous le seuil critique — commander avant 48h", col:"#CA8A04" },
                      { p:"🟢", t:"Vaccination",    d:"2 patients ont un rappel vaccinal en retard cette semaine", col:"#059669" },
                      { p:"🔵", t:"Optimisation",   d:"Répartir 4 RDV du Dr. Leblanc sur jeudi — prévision surcharge", col:"#1B4F9E" },
                      { p:"🟣", t:"Finance",        d:"510 000 CFA de créances > 30 jours — relance automatique possible", col:"#7C3AED" },
                    ].map(r => (
                      <div key={r.t} style={{ display:"flex", alignItems:"flex-start", gap:10, background:"#F8FAFD", borderRadius:12, padding:"10px 14px", borderLeft:`3px solid ${r.col}` }}>
                        <span style={{ fontSize:14, flexShrink:0 }}>{r.p}</span>
                        <div>
                          <div style={{ fontWeight:700, fontSize:12, color:"var(--cn)" }}>{r.t}</div>
                          <div style={{ fontSize:11, color:"var(--cm)", marginTop:2 }}>{r.d}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ background:"linear-gradient(135deg,#0B1E3B,#1B4F9E)", borderRadius:14, padding:14, color:"#fff", marginTop:4 }}>
                      <div style={{ fontSize:13, fontWeight:700, marginBottom:6 }}>🤖 Analyse complète du jour</div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.7)", marginBottom:10 }}>Lancer une analyse approfondie de tous les modules actifs.</div>
                      <button className="ibtn ibtn-teal ibtn-sm" onClick={() => setTab("modules")}>
                        {I.iaS} Analyser maintenant
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ MODULES IA ══ */}
          {tab === "modules" && (
            <div>
              {/* Sec nav */}
              <div className="sec-nav" style={{ borderRadius:"18px 18px 0 0" }}>
                {SECTIONS.map(s => (
                  <button key={s.id} className={`sec-btn ${section===s.id?"active":""} ${s.warn?"warn":""}`} onClick={() => setSection(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>

              <div style={{ marginTop:20 }}>

                {/* ─ ASSISTANT MÉDICAL ─ */}
                {section === "assistant" && (
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                    <div className="ia-card fu">
                      <div className="ia-card-hdr"><h3>🩺 Analyse clinique IA</h3><p>Saisie des données patient</p></div>
                      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
                        <div>
                          <label className="ilbl">Symptômes du patient *</label>
                          <textarea className="iinp" rows={3} placeholder="Ex: Douleur abdominale droite intense, nausées, fièvre 38.5°C depuis 24h..." value={formSymptomes} onChange={e => setFormSymptomes(e.target.value)} />
                        </div>
                        <div>
                          <label className="ilbl">Signes vitaux</label>
                          <input className="iinp" placeholder="TA: 130/85, Pouls: 96 bpm, SpO2: 98%, T°: 38.5°C" value={formSignesVitaux} onChange={e => setFormSignesVitaux(e.target.value)} />
                        </div>
                        <div>
                          <label className="ilbl">Antécédents médicaux</label>
                          <textarea className="iinp" rows={2} placeholder="HTA, Diabète type 2, Allergie Pénicilline..." value={formAntecedents} onChange={e => setFormAntecedents(e.target.value)} />
                        </div>
                        <div>
                          <label className="ilbl">Résultats biologiques récents</label>
                          <textarea className="iinp" rows={2} placeholder="NFS : GB 14000, CRP 48 mg/L, Glycémie 7.2..." value={formBioResults} onChange={e => setFormBioResults(e.target.value)} />
                        </div>
                        <button className="ibtn ibtn-teal" disabled={analyzing || !formSymptomes.trim()} onClick={lancerAnalyse}>
                          {analyzing ? <><span className="spin" style={{ display:"inline-block" }}>{I.iaS}</span> Analyse en cours...</> : <>{I.iaS} Lancer l'analyse IA</>}
                        </button>
                        <div style={{ background:"#F8FAFD", borderRadius:10, padding:10, fontSize:11, color:"var(--cm)", borderLeft:"3px solid var(--cb)" }}>
                          ⚠ L'IA assiste le médecin. La décision finale appartient toujours au professionnel de santé.
                        </div>
                      </div>
                    </div>

                    <div className="ia-card fu">
                      <div className="ia-card-hdr"><h3>📊 Résultats de l'analyse</h3></div>
                      <div style={{ padding:20 }}>
                        {analyzing && (
                          <div style={{ textAlign:"center", padding:40 }}>
                            <div style={{ fontSize:40, animation:"iaPulse 1s infinite", marginBottom:12 }}>🤖</div>
                            <div style={{ fontSize:14, color:"var(--cm)" }}>Analyse en cours…</div>
                            <div style={{ fontSize:12, color:"#9CA3AF", marginTop:4 }}>Consultation de la base de connaissances médicale</div>
                          </div>
                        )}
                        {!analyzing && !analysisResult && (
                          <div style={{ textAlign:"center", padding:40, color:"var(--cm)" }}>
                            <div style={{ fontSize:40, marginBottom:12, opacity:.4 }}>🩺</div>
                            <div style={{ fontSize:13 }}>Saisissez les symptômes et lancez l'analyse pour voir les suggestions IA</div>
                          </div>
                        )}
                        {analysisResult && !analyzing && (
                          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                            <div>
                              <div style={{ fontSize:12, fontWeight:700, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.5, marginBottom:10 }}>Diagnostics possibles</div>
                              {analysisResult.diagnostics.map((d,i) => {
                                const gc = GRAVITE_CFG[d.gravite] || { cls:"gray" };
                                const col = GRAVITE_COLORS[d.gravite] || "#9CA3AF";
                                return (
                                  <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, background:"#F8FAFD", borderRadius:10, padding:"10px 12px", border:"1.5px solid var(--cbr)" }}>
                                    <div style={{ width:36, height:36, borderRadius:8, background:`${col}18`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:13, color:col, flexShrink:0 }}>
                                      {i+1}
                                    </div>
                                    <div style={{ flex:1 }}>
                                      <div style={{ fontWeight:700, fontSize:13, color:"var(--cn)" }}>{d.label}</div>
                                      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4 }}>
                                        <Prog pct={d.proba} color={col} />
                                        <span style={{ fontSize:11, fontWeight:700, color:col, minWidth:35 }}>{d.proba}%</span>
                                      </div>
                                    </div>
                                    <Badge cls={gc.cls}>{gc.label}</Badge>
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{ background:"#F0FDFC", border:"1.5px solid #99F6E4", borderRadius:12, padding:14 }}>
                              <div style={{ fontSize:11, fontWeight:700, color:"var(--ct)", marginBottom:6 }}>🔬 Examens recommandés</div>
                              {analysisResult.examens.map((e,i) => (
                                <div key={i} style={{ fontSize:12, color:"var(--cn)", marginBottom:3 }}>• {e}</div>
                              ))}
                            </div>
                            <div style={{ display:"flex", gap:8 }}>
                              <div style={{ flex:1, background:"#EEF4FF", borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
                                <div style={{ fontSize:11, color:"var(--cm)", fontWeight:600 }}>Gravité estimée</div>
                                <Badge cls={GRAVITE_CFG[analysisResult.gravite]?.cls || "gray"} style={{ marginTop:4 }}>
                                  {GRAVITE_CFG[analysisResult.gravite]?.label || "—"}
                                </Badge>
                              </div>
                              <div style={{ flex:1, background:"#EEF4FF", borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
                                <div style={{ fontSize:11, color:"var(--cm)", fontWeight:600 }}>Orientation</div>
                                <div style={{ fontSize:12, fontWeight:700, color:"var(--cn)", marginTop:4 }}>{analysisResult.orientation}</div>
                              </div>
                            </div>
                            <div style={{ fontSize:11, color:"var(--cm)", fontStyle:"italic", textAlign:"center" }}>{analysisResult.note}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ─ ANALYSE PATIENT ─ */}
                {section === "patient" && (
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                    <div className="ia-card fu">
                      <div className="ia-card-hdr"><h3>👤 Sélectionner un patient</h3></div>
                      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:12 }}>
                        <select className="iinp">
                          <option>Jean Dupont — PAT-2025-0001</option>
                          <option>Marie Paul — PAT-2025-0002</option>
                          <option>Paul Nguema — PAT-2025-0003</option>
                          <option>André Mboula — PAT-2025-0005</option>
                        </select>
                        <button className="ibtn ibtn-teal">{I.iaS} Analyser le dossier</button>
                        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                          {[["Risque cardiovasculaire",78,"#DC2626"],["Risque diabétique",62,"#D97706"],["Risque infectieux",35,"#CA8A04"],["Risque obstétrical",12,"#059669"]].map(([lbl,val,col]) => (
                            <div key={lbl}>
                              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                                <span style={{ color:"var(--cm)" }}>{lbl}</span>
                                <span style={{ fontWeight:700, color:col }}>{val}/100</span>
                              </div>
                              <Prog pct={val} color={col} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="ia-card fu">
                      <div className="ia-card-hdr"><h3>📋 Résumé automatique IA</h3></div>
                      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:10 }}>
                        {[
                          { icon:"🩺", label:"Historique médical",  value:"HTA depuis 2018 · Diabète T2 depuis 2020" },
                          { icon:"💊", label:"Traitements en cours", value:"Metformine 500mg · Amlodipine 5mg" },
                          { icon:"⚠️", label:"Allergies",            value:"Pénicilline — ALERTE ACTIVE", warn:true },
                          { icon:"📅", label:"Dernière consultation", value:"28/05/2025 · Dr. Leblanc" },
                          { icon:"🔬", label:"Résultat labo récent", value:"Glycémie 7.8 mmol/L — Anormal" },
                          { icon:"🏥", label:"Hospitalisations",     value:"1 séjour · Service Chirurgie" },
                        ].map(r => (
                          <div key={r.label} style={{ display:"flex", gap:10, background:r.warn?"#FEF2F2":"#F8FAFD", border:`1.5px solid ${r.warn?"#FECACA":"var(--cbr)"}`, borderRadius:10, padding:"10px 12px" }}>
                            <span style={{ fontSize:16, flexShrink:0 }}>{r.icon}</span>
                            <div>
                              <div style={{ fontSize:10, fontWeight:700, color:r.warn?"#B91C1C":"var(--cm)", textTransform:"uppercase" }}>{r.label}</div>
                              <div style={{ fontSize:12, color:r.warn?"#DC2626":"var(--cn)", marginTop:2, fontWeight:r.warn?700:400 }}>{r.value}</div>
                            </div>
                          </div>
                        ))}
                        <div style={{ display:"flex", gap:8 }}>
                          <button className="ibtn ibtn-ghost ibtn-sm">{I.dl} Télécharger résumé</button>
                          <button className="ibtn ibtn-teal ibtn-sm">{I.file} Générer rapport</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─ ORDONNANCE IA ─ */}
                {section === "ordonnance" && (
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                    <div className="ia-card fu">
                      <div className="ia-card-hdr"><h3>💊 Assistant Ordonnance IA</h3></div>
                      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
                        <div>
                          <label className="ilbl">Médicament prescrit *</label>
                          <input className="iinp" placeholder="Ex: Amoxicilline 1g" value={formMedicament} onChange={e => setFormMedicament(e.target.value)} />
                        </div>
                        <div>
                          <label className="ilbl">Allergies du patient</label>
                          <input className="iinp" placeholder="Ex: Pénicilline, Aspirine..." value={formAllergiesPatient} onChange={e => setFormAllergiesPatient(e.target.value)} />
                        </div>
                        <div>
                          <label className="ilbl">Autres médicaments en cours</label>
                          <textarea className="iinp" rows={2} placeholder="Metformine 500mg, Amlodipine 5mg..." />
                        </div>
                        <button className="ibtn ibtn-purple" disabled={ordoLoading || !formMedicament.trim()} onClick={verifierOrdonnance}>
                          {ordoLoading ? <><span className="spin" style={{ display:"inline-block" }}>{I.iaS}</span> Vérification...</> : <>{I.check} Vérifier l'ordonnance</>}
                        </button>
                      </div>
                    </div>
                    <div className="ia-card fu">
                      <div className="ia-card-hdr"><h3>📊 Résultat de la vérification</h3></div>
                      <div style={{ padding:20 }}>
                        {ordoLoading && (
                          <div style={{ textAlign:"center", padding:40 }}>
                            <div style={{ fontSize:36, animation:"iaPulse 1s infinite", marginBottom:10 }}>💊</div>
                            <div style={{ fontSize:13, color:"var(--cm)" }}>Vérification des interactions…</div>
                          </div>
                        )}
                        {!ordoLoading && !ordoResult && (
                          <div style={{ textAlign:"center", padding:40, color:"var(--cm)" }}>
                            <div style={{ fontSize:40, marginBottom:12, opacity:.4 }}>💊</div>
                            <div style={{ fontSize:13 }}>Saisissez un médicament pour lancer la vérification</div>
                          </div>
                        )}
                        {ordoResult && !ordoLoading && (
                          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                            <div className={ordoResult.ok ? "al-success" : "al-danger"} style={{ display:"flex", alignItems:"center", gap:10 }}>
                              <span style={{ fontSize:22 }}>{ordoResult.ok ? "✅" : "🚨"}</span>
                              <div>
                                <strong style={{ fontSize:13, color:ordoResult.ok?"#065F46":"#B91C1C" }}>
                                  {ordoResult.ok ? "Ordonnance valide — Aucune interaction détectée" : "ALERTE — Contre-indication détectée !"}
                                </strong>
                              </div>
                            </div>
                            {ordoResult.interactions.length > 0 && ordoResult.interactions.map((inter,i) => (
                              <div key={i} style={{ background:"#FEF2F2", border:"1.5px solid #FECACA", borderRadius:12, padding:14 }}>
                                <div style={{ fontSize:12, fontWeight:700, color:"#B91C1C" }}>⚠ {inter.risque}</div>
                                <div style={{ fontSize:12, color:"#DC2626", marginTop:4 }}>{inter.med1} × {inter.med2}</div>
                              </div>
                            ))}
                            <div style={{ background:"#F8FAFD", border:"1.5px solid var(--cbr)", borderRadius:12, padding:14 }}>
                              <div style={{ fontSize:11, fontWeight:700, color:"var(--cm)", marginBottom:6 }}>💡 POSOLOGIE SUGGÉRÉE</div>
                              <div style={{ fontSize:13, color:"var(--cn)", fontWeight:600 }}>{ordoResult.posologie}</div>
                            </div>
                            {ordoResult.alternatives.length > 0 && (
                              <div style={{ background:"#F0FDFC", border:"1.5px solid #99F6E4", borderRadius:12, padding:14 }}>
                                <div style={{ fontSize:11, fontWeight:700, color:"var(--ct)", marginBottom:8 }}>🔄 Alternatives proposées</div>
                                {ordoResult.alternatives.map((a,i) => <div key={i} style={{ fontSize:12, color:"var(--cn)", marginBottom:4 }}>• {a}</div>)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ─ LABORATOIRE IA ─ */}
                {section === "laboratoire" && (
                  <div>
                    <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20, marginBottom:20 }}>
                      <div className="ia-card fu">
                        <div className="ia-card-hdr"><h3>🔬 Interprétation automatique</h3></div>
                        <div style={{ padding:20 }}>
                          {[
                            { exam:"Numération sanguine (NFS)", val:"Hb 10.2 g/dL · GB 14 200/µL", interp:"Anémie légère + hyperleucocytose → suspect infectieux", cls:"orange" },
                            { exam:"Glycémie à jeun",           val:"7.8 mmol/L",                    interp:"Hyperglycémie — Diabète non équilibré (seuil > 7 mmol/L)", cls:"red" },
                            { exam:"Fonction rénale",           val:"Créatinine 145 µmol/L",         interp:"Insuffisance rénale légère (N < 97 µmol/L)", cls:"orange" },
                            { exam:"Bilan hépatique (ALAT)",    val:"28 UI/L",                       interp:"Normal — Pas d'atteinte hépatique", cls:"green" },
                          ].map(r => (
                            <div key={r.exam} style={{ marginBottom:12, background:"#F8FAFD", borderRadius:12, padding:"12px 14px", border:"1.5px solid var(--cbr)" }}>
                              <div style={{ fontWeight:700, fontSize:13, color:"var(--cn)" }}>{r.exam}</div>
                              <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>{r.val}</div>
                              <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:8 }}>
                                <Badge cls={r.cls}>{r.interp}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="ia-card fu">
                        <div className="ia-card-hdr"><h3>📈 Comparaison historique</h3><p>Évolution sur 6 mois</p></div>
                        <div style={{ padding:20 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"var(--cm)", marginBottom:8 }}>GLYCÉMIE (mmol/L) — 6 derniers mois</div>
                          <LineChart labels={["Jan","Fév","Mar","Avr","Mai","Jun"]} data={[6.8,7.1,7.4,7.2,7.8,7.6]} color="#DC2626" />
                          <div className="al-warn" style={{ marginTop:12 }}>
                            <div style={{ fontSize:12, color:"#92400E" }}>📈 Tendance à la hausse — réévaluation du traitement recommandée</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─ IMAGERIE IA ─ */}
                {section === "imagerie" && (
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                    {[
                      { type:"Échographie abdominale", date:"28/05/2025", anomalie:true,  resume:"Appendice mesurant 9mm non compressible — Appendicite aiguë confirmée. Épanchement péri-appendiculaire localisé.", comparaison:"Examen initial — pas de référence antérieure." },
                      { type:"Radiographie thorax",    date:"14/02/2025", anomalie:false, resume:"Pas d'opacité parenchymateuse. Sinus costophréniques libres. Silhouette cardiaque normale.", comparaison:"Stable par rapport à l'examen de 2023." },
                    ].map(ex => (
                      <div key={ex.type} className="ia-card fu">
                        <div className="ia-card-hdr">
                          <h3>🩻 {ex.type}</h3>
                          <Badge cls={ex.anomalie ? "red":"green"}>{ex.anomalie ? "Anomalie détectée":"Normal"}</Badge>
                        </div>
                        <div style={{ padding:20, display:"flex", flexDirection:"column", gap:12 }}>
                          <div style={{ background:ex.anomalie?"#FEF2F2":"#ECFDF5", border:`1.5px solid ${ex.anomalie?"#FECACA":"#A7F3D0"}`, borderRadius:12, padding:14 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:ex.anomalie?"#B91C1C":"#065F46", marginBottom:6 }}>🤖 RÉSUMÉ IA</div>
                            <div style={{ fontSize:12, color:"var(--cn)" }}>{ex.resume}</div>
                          </div>
                          <div style={{ background:"#F8FAFD", borderRadius:12, padding:14 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:"var(--cm)", marginBottom:4 }}>📊 COMPARAISON</div>
                            <div style={{ fontSize:12, color:"var(--cn)" }}>{ex.comparaison}</div>
                          </div>
                          <div style={{ fontSize:11, color:"var(--cm)", fontStyle:"italic" }}>📅 {ex.date} · Analyse IA préliminaire — à valider par un radiologue.</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ─ RENDEZ-VOUS IA ─ */}
                {section === "rdv" && (
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                    <div className="ia-card fu">
                      <div className="ia-card-hdr"><h3>📅 Optimisation des RDV</h3></div>
                      <div style={{ padding:20 }}>
                        <div style={{ marginBottom:16 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:"var(--cm)", textTransform:"uppercase", marginBottom:10 }}>Prévision affluence — cette semaine</div>
                          <BarChart labels={["Lun","Mar","Mer","Jeu","Ven","Sam"]} data={[14,18,12,22,16,8]} color="#0EA5A0" height={140} />
                        </div>
                        <div className="al-warn">
                          <div style={{ fontSize:12, color:"#92400E" }}>⚠ Surcharge prévue jeudi — 22 patients · Répartition recommandée</div>
                        </div>
                      </div>
                    </div>
                    <div className="ia-card fu">
                      <div className="ia-card-hdr"><h3>👨‍⚕️ Charge par médecin</h3></div>
                      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:12 }}>
                        {[
                          { med:"Dr. Leblanc",        nb:24, cap:20, col:"#DC2626" },
                          { med:"Dr. Sophie Pierre",  nb:16, cap:20, col:"#0EA5A0" },
                          { med:"Dr. Médecin 3",      nb:11, cap:20, col:"#059669" },
                        ].map(m => (
                          <div key={m.med} style={{ background:"#F8FAFD", borderRadius:12, padding:"12px 14px" }}>
                            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                              <span style={{ fontSize:13, fontWeight:600, color:"var(--cn)" }}>{m.med}</span>
                              <Badge cls={m.nb > m.cap ? "red" : "green"}>{m.nb}/{m.cap} RDV</Badge>
                            </div>
                            <Prog pct={Math.min(100, Math.round(m.nb/m.cap*100))} color={m.col} />
                          </div>
                        ))}
                        <div className="al-ia" style={{ marginTop:4 }}>
                          <div style={{ fontSize:12, color:"#1E40AF" }}>💡 Suggestion : Transférer 4 RDV du Dr. Leblanc vers Dr. Médecin 3 cette semaine.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─ ADMINISTRATIF IA ─ */}
                {section === "administratif" && (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:16 }}>
                    {[
                      { icon:"📋", titre:"Compte rendu consultation", desc:"Génération automatique à partir des notes du médecin" },
                      { icon:"🏥", titre:"Rapport d'hospitalisation", desc:"Résumé complet du séjour avec traitements et observations" },
                      { icon:"🔪", titre:"Compte rendu opératoire", desc:"Rapport structuré de l'intervention chirurgicale" },
                      { icon:"📄", titre:"Certificat médical", desc:"Certificat de repos ou d'aptitude médicale" },
                      { icon:"✉️", titre:"Courrier de liaison", desc:"Lettre au médecin traitant ou spécialiste" },
                      { icon:"📊", titre:"Rapport mensuel clinique", desc:"Statistiques, KPIs et analyses de la période" },
                      { icon:"💰", titre:"Rapport financier IA", desc:"Revenus, dépenses et projections automatiques" },
                      { icon:"🩺", titre:"Résumé de consultation", desc:"Synthèse structurée de la consultation médicale" },
                    ].map(doc => (
                      <div key={doc.titre} className="ia-card fu" style={{ cursor:"pointer" }}>
                        <div style={{ padding:18, display:"flex", flexDirection:"column", gap:8 }}>
                          <div style={{ fontSize:28 }}>{doc.icon}</div>
                          <div style={{ fontWeight:700, fontSize:13, color:"var(--cn)" }}>{doc.titre}</div>
                          <div style={{ fontSize:11, color:"var(--cm)" }}>{doc.desc}</div>
                          <button className="ibtn ibtn-teal ibtn-sm" style={{ marginTop:4 }}>
                            {I.iaS} Générer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ─ FINANCE IA ─ */}
                {section === "finance" && (
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                    <div className="ia-card fu">
                      <div className="ia-card-hdr"><h3>💰 Prévisions financières</h3><p>Modèle IA — 30 jours</p></div>
                      <div style={{ padding:20 }}>
                        <LineChart labels={["S1","S2","S3","S4","S5","S6","S7","S8"]} data={[820,950,880,1100,970,1050,1200,1150]} color="#059669" />
                        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:10, marginTop:16 }}>
                          {[["CA prévu","4 850 000","green"],["Dépenses","2 340 000","orange"],["Solde prévu","2 510 000","blue"]].map(([lbl,val,col]) => (
                            <div key={lbl} style={{ background:"#F8FAFD", borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
                              <div style={{ fontSize:11, color:"var(--cm)", fontWeight:600 }}>{lbl}</div>
                              <div style={{ fontSize:13, fontWeight:800, color:`var(--c${col[0]})`, marginTop:4 }}>{val}</div>
                              <div style={{ fontSize:10, color:"#9CA3AF" }}>CFA</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="ia-card fu">
                      <div className="ia-card-hdr"><h3>🔍 Détection d'anomalies</h3></div>
                      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:10 }}>
                        {[
                          { icon:"💸", titre:"Factures impayées > 30j", val:"510 000 CFA · 3 dossiers", cls:"red" },
                          { icon:"📉", titre:"Baisse CA Laboratoire", val:"-18% vs mois précédent", cls:"orange" },
                          { icon:"⚠️", titre:"Dépense inhabituelle", val:"Matériel médical +45% mars", cls:"yellow" },
                          { icon:"✅", titre:"Recettes chirurgie", val:"+22% — tendance positive", cls:"green" },
                        ].map(a => (
                          <div key={a.titre} style={{ display:"flex", alignItems:"center", gap:10, background:"#F8FAFD", borderRadius:12, padding:"10px 14px", border:"1.5px solid var(--cbr)" }}>
                            <span style={{ fontSize:18 }}>{a.icon}</span>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:12, fontWeight:600, color:"var(--cn)" }}>{a.titre}</div>
                              <div style={{ fontSize:11, color:"var(--cm)" }}>{a.val}</div>
                            </div>
                            <Badge cls={a.cls}>{a.cls === "red" || a.cls === "orange" ? "Alerte" : a.cls === "yellow" ? "Attention" : "OK"}</Badge>
                          </div>
                        ))}
                        <button className="ibtn ibtn-teal ibtn-sm" style={{ marginTop:4 }}>{I.dl} Rapport financier IA complet</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─ ALERTES ─ */}
                {section === "alertes" && (
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)" }}>Centre d'alertes intelligentes <span style={{ fontSize:13, fontWeight:400, color:"var(--cm)" }}>({DEMO_ALERTS.length} alertes)</span></div>
                      <button className="ibtn ibtn-ghost ibtn-sm" onClick={() => setAlertesLues(DEMO_ALERTS.map(a=>a.id))}>✓ Tout marquer comme lu</button>
                    </div>
                    {["critique","eleve","modere","faible"].map(niveau => {
                      const items = DEMO_ALERTS.filter(a => a.priority === niveau);
                      if (!items.length) return null;
                      const cfg = { critique:{cls:"red",label:"🔴 Critiques",bg:"#FEF2F2",border:"#FECACA"}, eleve:{cls:"orange",label:"🟠 Élevées",bg:"#FFF7ED",border:"#FED7AA"}, modere:{cls:"yellow",label:"🟡 Modérées",bg:"#FEFCE8",border:"#FDE68A"}, faible:{cls:"green",label:"🟢 Informatives",bg:"#ECFDF5",border:"#A7F3D0"} }[niveau];
                      return (
                        <div key={niveau} style={{ marginBottom:20 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.5, marginBottom:10 }}>{cfg.label}</div>
                          {items.map(a => (
                            <div key={a.id} style={{ background:alertesLues.includes(a.id)?"#F9FAFB":cfg.bg, border:`1.5px solid ${alertesLues.includes(a.id)?"var(--cbr)":cfg.border}`, borderRadius:14, padding:"12px 16px", marginBottom:10, display:"flex", alignItems:"flex-start", gap:12, opacity:alertesLues.includes(a.id)?.6:1, transition:"all .2s" }}>
                              <span style={{ fontSize:22, flexShrink:0 }}>{a.icon}</span>
                              <div style={{ flex:1 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                                  <span style={{ fontWeight:700, fontSize:13, color:"var(--cn)" }}>{a.title}</span>
                                  <Badge cls="gray">{a.module}</Badge>
                                  {!alertesLues.includes(a.id) && <Badge cls={cfg.cls}>Nouveau</Badge>}
                                </div>
                                <div style={{ fontSize:12, color:"var(--cm)", marginTop:4 }}>{a.detail}</div>
                                <div style={{ fontSize:11, color:"#9CA3AF", marginTop:4 }}>{a.time}</div>
                              </div>
                              <button className="ibtn ibtn-ghost ibtn-sm" style={{ fontSize:10, flexShrink:0 }} onClick={() => setAlertesLues(p => [...p, a.id])}>
                                {I.check} Lu
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ─ CHAT (section) ─ */}
                {section === "chat" && (
                  <div className="ia-card fu">
                    <div className="ia-card-hdr"><h3>{I.chat} Chat Assistant IA</h3><p>Posez vos questions à l'IA médicale</p></div>
                    <div className="chat-wrap">
                      <div className="chat-msgs">
                        {chatMessages.map((m,i) => (
                          <div key={i} className={`chat-msg ${m.role}`}>
                            <div className="chat-avatar">{m.role==="bot"?"🤖":"👤"}</div>
                            <div>
                              <div className="chat-bubble" style={{ whiteSpace:"pre-line" }}>{m.content}</div>
                              <div className={`chat-time`} style={{ textAlign:m.role==="user"?"right":"left" }}>{m.time}</div>
                            </div>
                          </div>
                        ))}
                        {chatLoading && (
                          <div className="chat-msg bot">
                            <div className="chat-avatar">🤖</div>
                            <div className="chat-bubble" style={{ display:"flex", alignItems:"center", gap:5, padding:"12px 16px" }}>
                              <span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/>
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>
                      <div className="chat-input-row">
                        <input className="chat-input" placeholder="Posez votre question à l'IA…" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} />
                        <button className="ibtn ibtn-teal ibtn-sm" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>{I.send}</button>
                      </div>
                    </div>
                    <div style={{ padding:"10px 16px 16px", display:"flex", flexWrap:"wrap", gap:6 }}>
                      {["Résume le dossier de Jean Dupont","Derniers résultats labo ?","Patients hospitalisés aujourd'hui ?","Génère le rapport mensuel","Factures impayées ?"].map(s => (
                        <button key={s} className="chip" onClick={() => { setChatInput(s); }}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ══ CHAT IA (tab principal) ══ */}
          {tab === "chat" && (
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--cn)", marginBottom:16 }}>💬 Chat Assistant IA — Clinique</div>
              <div className="ia-card fu">
                <div className="ia-card-hdr"><h3>{I.chat} Chat IA médical</h3><p>Interrogez tous les modules de la clinique</p></div>
                <div className="chat-wrap" style={{ height:520 }}>
                  <div className="chat-msgs">
                    {chatMessages.map((m,i) => (
                      <div key={i} className={`chat-msg ${m.role}`}>
                        <div className="chat-avatar">{m.role==="bot"?"🤖":"👤"}</div>
                        <div>
                          <div className="chat-bubble" style={{ whiteSpace:"pre-line" }}>{m.content}</div>
                          <div className="chat-time" style={{ textAlign:m.role==="user"?"right":"left" }}>{m.time}</div>
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="chat-msg bot">
                        <div className="chat-avatar">🤖</div>
                        <div className="chat-bubble" style={{ display:"flex", alignItems:"center", gap:5, padding:"12px 16px" }}>
                          <span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="chat-input-row">
                    <input className="chat-input" placeholder="Posez votre question à l'IA médicale…" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} />
                    <button className="ibtn ibtn-teal" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>{I.send} Envoyer</button>
                  </div>
                </div>
                <div style={{ padding:"10px 16px 16px", display:"flex", flexWrap:"wrap", gap:6 }}>
                  {["Résume le dossier de Jean Dupont","Derniers résultats labo anormaux","Patients hospitalisés aujourd'hui","Génère le rapport mensuel mai 2025","Montre les factures impayées","Prévisions d'affluence cette semaine"].map(s => (
                    <button key={s} className="chip" onClick={() => setChatInput(s)}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ ALERTES (tab principal) ══ */}
          {tab === "alertes" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>🔔 Centre d'alertes intelligentes</div>
                  <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>{DEMO_ALERTS.length} alertes · {nbAlertesNonLues} critique(s) non traitée(s)</div>
                </div>
                <button className="ibtn ibtn-ghost ibtn-sm" onClick={() => setAlertesLues(DEMO_ALERTS.map(a=>a.id))}>✓ Tout marquer comme lu</button>
              </div>
              {/* Stats alertes */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:24 }}>
                {[
                  ["🔴","Critiques",  DEMO_ALERTS.filter(a=>a.priority==="critique").length, "red"],
                  ["🟠","Élevées",    DEMO_ALERTS.filter(a=>a.priority==="eleve").length, "orange"],
                  ["🟡","Modérées",   DEMO_ALERTS.filter(a=>a.priority==="modere").length, "yellow"],
                  ["🟢","Informatives",DEMO_ALERTS.filter(a=>a.priority==="faible").length, "green"],
                ].map(([ico,lbl,nb,cls]) => (
                  <div key={lbl} className={`ia-kpi ${cls==="yellow"?"orange":cls} fu`}>
                    <div style={{ fontSize:24, marginBottom:6 }}>{ico}</div>
                    <div className="kpi-val">{nb}</div>
                    <div className="kpi-lbl">{lbl}</div>
                  </div>
                ))}
              </div>
              {DEMO_ALERTS.map(a => {
                const cfg = { critique:{bg:"#FEF2F2",border:"#FECACA",col:"#DC2626"}, eleve:{bg:"#FFF7ED",border:"#FED7AA",col:"#D97706"}, modere:{bg:"#FEFCE8",border:"#FDE68A",col:"#CA8A04"}, faible:{bg:"#ECFDF5",border:"#A7F3D0",col:"#059669"} }[a.priority] || {bg:"#F9FAFB",border:"var(--cbr)",col:"#6B7280"};
                return (
                  <div key={a.id} style={{ background:alertesLues.includes(a.id)?"#F9FAFB":cfg.bg, border:`1.5px solid ${alertesLues.includes(a.id)?"var(--cbr)":cfg.border}`, borderLeft:`4px solid ${alertesLues.includes(a.id)?"var(--cbr)":cfg.col}`, borderRadius:14, padding:"14px 18px", marginBottom:10, display:"flex", alignItems:"flex-start", gap:12, opacity:alertesLues.includes(a.id)?.5:1, transition:"all .2s" }}>
                    <span style={{ fontSize:22, flexShrink:0 }}>{a.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        <span style={{ fontWeight:700, fontSize:13, color:"var(--cn)" }}>{a.title}</span>
                        <Badge cls="gray">{a.module}</Badge>
                        {!alertesLues.includes(a.id) && <span style={{ fontSize:10, fontWeight:700, color:cfg.col }}>● Nouveau</span>}
                      </div>
                      <div style={{ fontSize:12, color:"var(--cm)", marginTop:4 }}>{a.detail}</div>
                      <div style={{ fontSize:11, color:"#9CA3AF", marginTop:4 }}>{a.time}</div>
                    </div>
                    <button className="ibtn ibtn-ghost ibtn-sm" style={{ fontSize:10, flexShrink:0 }} onClick={() => setAlertesLues(p=>[...p,a.id])}>
                      {I.check} Traité
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ HISTORIQUE ══ */}
          {tab === "historique" && (
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--cn)", marginBottom:20 }}>📊 Historique des analyses IA</div>
              <div className="ia-card fu">
                <div style={{ overflowX:"auto" }}>
                  <table className="ia-tbl">
                    <thead><tr><th>Date & Heure</th><th>Utilisateur</th><th>Action IA</th><th>Patient</th><th>Résultat</th><th>Validé</th></tr></thead>
                    <tbody>
                      {DEMO_ANALYSES_IA.map(a => (
                        <tr key={a.id}>
                          <td style={{ fontSize:12, fontFamily:"monospace", color:"var(--cb)" }}>{a.date}</td>
                          <td style={{ fontSize:12 }}>{a.user}</td>
                          <td>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              {I.iaS}
                              <span style={{ fontSize:12, fontWeight:600 }}>{a.action}</span>
                            </div>
                          </td>
                          <td style={{ fontSize:12, color:"var(--cm)" }}>{a.patient}</td>
                          <td style={{ fontSize:12, color:"var(--cm)" }}>{a.resultat}</td>
                          <td>
                            <Badge cls={a.valide?"green":"orange"}>{a.valide?"✅ Validé":"⏳ En attente"}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding:"10px 20px", borderTop:"1.5px solid var(--cbr)", display:"flex", gap:8 }}>
                  <button className="ibtn ibtn-ghost ibtn-sm">{I.dl} Exporter journal IA</button>
                </div>
              </div>
            </div>
          )}

          {/* ══ BASE DE CONNAISSANCES ══ */}
          {tab === "knowledge" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
                <div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>📚 Base de connaissances médicale</div>
                <div style={{ position:"relative" }}>
                  <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }}>{I.iaS}</span>
                  <input className="iinp" style={{ paddingLeft:32, width:260 }} placeholder="Recherche intelligente…" value={kbSearch} onChange={e => setKbSearch(e.target.value)} />
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
                {kbFiltered.map(k => (
                  <div key={k.id} className="ia-card fu" style={{ cursor:"pointer" }}>
                    <div style={{ padding:18 }}>
                      <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:12 }}>
                        <div style={{ width:36, height:36, background:"#EEF4FF", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>📖</div>
                        <div>
                          <div style={{ fontWeight:700, fontSize:13, color:"var(--cn)" }}>{k.titre}</div>
                          <Badge cls="blue" style={{ marginTop:4 }}>{k.categorie}</Badge>
                        </div>
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                        {k.tags.map(t => <span key={t} className="chip" style={{ fontSize:10, padding:"2px 8px" }}>#{t}</span>)}
                      </div>
                      <div style={{ display:"flex", gap:6, marginTop:12 }}>
                        <button className="ibtn ibtn-ghost ibtn-sm" style={{ fontSize:10 }}>👁 Consulter</button>
                        <button className="ibtn ibtn-teal ibtn-sm" style={{ fontSize:10 }}>{I.iaS} Résumé IA</button>
                      </div>
                    </div>
                  </div>
                ))}
                {kbFiltered.length === 0 && (
                  <div style={{ gridColumn:"1/-1", padding:40, textAlign:"center", color:"var(--cm)" }}>
                    Aucun résultat pour « {kbSearch} »
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ PARAMÈTRES ══ */}
          {tab === "settings" && (
            <div style={{ maxWidth:720 }}>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--cn)", marginBottom:20 }}>⚙️ Paramètres Intelligence Artificielle</div>

              {/* Activation modules */}
              <div className="ia-card fu" style={{ marginBottom:20 }}>
                <div className="ia-card-hdr"><h3>🤖 Activation des modules IA</h3></div>
                <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
                  {[
                    ["assistant_medical",  "Assistant Médical IA",      "Analyse clinique et suggestions diagnostiques"],
                    ["analyse_labo",       "Analyse Laboratoire IA",    "Interprétation automatique des résultats biologiques"],
                    ["analyse_imagerie",   "Analyse Imagerie IA",       "Résumé préliminaire des examens radiologiques"],
                    ["ordonnance_ia",      "Ordonnance IA",             "Vérification interactions et contre-indications"],
                    ["alertes_auto",       "Alertes automatiques",      "Détection et notification en temps réel"],
                    ["rapports_auto",      "Rapports automatiques",     "Génération automatique de comptes rendus"],
                    ["gestion_rdv",        "Optimisation RDV",          "Répartition intelligente des rendez-vous"],
                    ["analyse_financiere", "Analyse Financière IA",     "Prévisions et détection d'anomalies financières"],
                  ].map(([key, label, desc]) => (
                    <div key={key} style={{ display:"flex", alignItems:"center", gap:14, padding:"10px 14px", background:"#F8FAFD", borderRadius:12, border:"1.5px solid var(--cbr)" }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:"var(--cn)" }}>{label}</div>
                        <div style={{ fontSize:11, color:"var(--cm)", marginTop:2 }}>{desc}</div>
                      </div>
                      <label className="tog">
                        <input type="checkbox" checked={settings[key]} onChange={e => setSettings(s => ({ ...s, [key]:e.target.checked }))} />
                        <span className="tog-sl" />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Config */}
              <div className="ia-card fu" style={{ marginBottom:20 }}>
                <div className="ia-card-hdr"><h3>⚙️ Configuration</h3></div>
                <div style={{ padding:20, display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
                  <div>
                    <label className="ilbl">Langue de l'IA</label>
                    <select className="iinp" value={settings.langue} onChange={e => setSettings(s=>({...s,langue:e.target.value}))}>
                      <option value="fr">Français</option>
                      <option value="en">English</option>
                      <option value="ar">العربية</option>
                    </select>
                  </div>
                  <div>
                    <label className="ilbl">Niveau d'assistance</label>
                    <select className="iinp" value={settings.niveau_assistance} onChange={e => setSettings(s=>({...s,niveau_assistance:e.target.value}))}>
                      <option value="basique">Basique — Suggestions simples</option>
                      <option value="standard">Standard — Analyse complète</option>
                      <option value="avance">Avancé — Analyse approfondie</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sécurité */}
              <div className="ia-card fu">
                <div className="ia-card-hdr"><h3>🔒 Sécurité & Protection des données</h3></div>
                <div style={{ padding:20, display:"flex", flexDirection:"column", gap:10 }}>
                  {[
                    ["Journalisation complète des analyses IA", true],
                    ["Anonymisation des données pour la recherche", false],
                    ["Audit trail activé", true],
                    ["Chiffrement des échanges IA", true],
                  ].map(([lbl, val]) => (
                    <div key={lbl} style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:14 }}>{val ? "✅" : "⬜"}</span>
                      <span style={{ fontSize:13, color:"var(--cn)" }}>{lbl}</span>
                    </div>
                  ))}
                  <div className="al-ia" style={{ marginTop:8 }}>
                    <div style={{ fontSize:12, color:"#1E40AF" }}>🔒 Toutes les analyses IA sont tracées et archivées conformément aux normes RGPD et aux exigences médicales.</div>
                  </div>
                  <button className="ibtn ibtn-teal ibtn-sm" style={{ marginTop:4 }}>{I.check} Enregistrer les paramètres</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}