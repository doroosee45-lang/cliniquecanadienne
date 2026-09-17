


import { useState, useEffect, useRef, useCallback, useMemo, useId } from "react";
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchAIPredictions, fetchAIStats, runDiagnosis, checkDrugInteractions, fetchPatientSummary, fetchLabInsights,
  selectAIPredictions, selectAISuggestions, selectAIWarnings, selectAIStats, selectAILoading, selectAIAnalyzing,
  selectPatientSummary, selectPatientSummaryLoading, selectLabInsights, selectLabInsightsLoading,
} from '../store/slices/aiSlice';
import { fetchPatients, selectPatients } from '../store/slices/patientsSlice';
import api from '../api';
import toast from 'react-hot-toast';
import { CLINIC_NAME, CLINIC_SUBTITLE } from '../config/clinic';
import { BrainCircuit, Zap } from 'lucide-react';
import Hero from '../components/UI/Hero';
import Button from '../components/UI/Button';

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
const DEMO_ALERTS = [];

const DEMO_ANALYSES_IA = [];

const DEMO_KNOWLEDGE = [];

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
    <div className="mov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className="mov-box" style={{ maxWidth }} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="mov-hdr"><h3 id={titleId}>{title}</h3><button className="mov-cls" onClick={onClose} aria-label="Fermer">×</button></div>
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
  const reduxStats       = useSelector(selectAIStats);
  const reduxWarnings    = useSelector(selectAIWarnings);
  const reduxLoading     = useSelector(selectAILoading);
  const reduxAnalyzing   = useSelector(selectAIAnalyzing);
  const reduxPatientsList     = useSelector(selectPatients);
  const patientSummary        = useSelector(selectPatientSummary);
  const patientSummaryLoading = useSelector(selectPatientSummaryLoading);
  const labInsights           = useSelector(selectLabInsights);
  const labInsightsLoading    = useSelector(selectLabInsightsLoading);

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
  // CHAT-001 (rapport de clôture du 11 sept. 2026) — POST /ai/chat réutilise
  // utils/openai.js::generateReport(), déjà réel (déjà utilisé par le
  // rapport hebdomadaire Analytics), jamais une seconde intégration IA.
  const nowLabel = () => new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  const [chatMessages, setChatMessages] = useState([
    { role:"bot", content:"Bonjour, je suis l'assistant IA de MediSync. Posez-moi une question — mes réponses sont informatives uniquement, jamais un diagnostic validé.", time: nowLabel() },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);

  const sendChatMessage = async () => {
    const message = chatInput.trim();
    if (!message || chatSending) return;
    const history = chatMessages
      .filter(m => m.role === "user" || m.role === "bot")
      .slice(-6)
      .map(m => ({ role: m.role, content: m.content }));
    setChatMessages(prev => [...prev, { role:"user", content: message, time: nowLabel() }]);
    setChatInput("");
    setChatSending(true);
    try {
      const { data } = await api.post('/ai/chat', { message, history });
      if (data.success) {
        setChatMessages(prev => [...prev, { role:"bot", content: `${data.reply}\n\n${data.disclaimer}`, time: nowLabel() }]);
      } else {
        // Mode simulé (clé OpenAI absente) ou erreur métier (ex. message
        // trop long) — jamais une réponse IA fictive, le message réel du
        // serveur est affiché tel quel.
        setChatMessages(prev => [...prev, { role:"bot", content: `⚠️ ${data.message}`, time: nowLabel() }]);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Erreur réseau — impossible de contacter l'assistant IA.";
      setChatMessages(prev => [...prev, { role:"bot", content: `⚠️ ${msg}`, time: nowLabel() }]);
    } finally {
      setChatSending(false);
    }
  };
  const handleChatKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } };
  const [kbSearch, setKbSearch] = useState("");
  const chatEndRef = useRef(null);

  // Form états
  const [formSymptomes, setFormSymptomes] = useState("");
  const [formAntecedents, setFormAntecedents] = useState("");
  const [formSignesVitaux, setFormSignesVitaux] = useState("");
  const [formBioResults, setFormBioResults] = useState("");
  const [formMedicament, setFormMedicament] = useState("");
  const [formAllergiesPatient, setFormAllergiesPatient] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedLabPatientId, setSelectedLabPatientId] = useState("");

  // Settings
  const AI_SETTINGS_DEFAULTS = {
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
  };
  // AUDIT-11 (Vague 2, W3) — jusqu'ici jamais relu : localStorage.setItem
  // était appelé au clic sur "Enregistrer", mais l'état initial ignorait
  // systématiquement ce qui avait été sauvegardé, revenant aux valeurs par
  // défaut à chaque rechargement de page. Le toast de succès n'aurait
  // continué à mentir que sur un point différent (persistant mais jamais
  // effectif) si ceci n'était pas corrigé en même temps.
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('ai_settings');
      return saved ? { ...AI_SETTINGS_DEFAULTS, ...JSON.parse(saved) } : AI_SETTINGS_DEFAULTS;
    } catch { return AI_SETTINGS_DEFAULTS; }
  });

  // Alertes lues + données réelles
  const [alertesLues, setAlertesLues] = useState([]);
  const [realAlerts, setRealAlerts] = useState({ labo_critiques: [], imagerie_urgentes: [], predictions_en_attente: [] });
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const flatAlerts = useMemo(() => {
    const items = [];
    (realAlerts.labo_critiques || []).forEach(l => {
      const pat = l.patient;
      items.push({ id: String(l._id), icon: '🔬', title: `Résultat critique — ${pat ? `${pat.prenom} ${pat.nom}` : l.patient_nom || 'Patient'}`, detail: `Résultat biologique critique${l.ia_anomalie ? ' · Anomalie IA détectée' : ''}`, module: 'Laboratoire', priority: 'critique', time: fmtDate(l.createdAt) });
    });
    (realAlerts.imagerie_urgentes || []).forEach(i => {
      const pat = i.patient;
      items.push({ id: String(i._id), icon: '🩻', title: `Imagerie urgente — ${i.type_examen || 'Examen'}`, detail: `Patient: ${pat ? `${pat.prenom} ${pat.nom}` : '—'} · Priorité: ${i.priorite}`, module: 'Imagerie', priority: 'critique', time: fmtDate(i.createdAt) });
    });
    (realAlerts.predictions_en_attente || []).forEach(p => {
      const pat = p.patient;
      const typeLabel = { diagnostic: 'Diagnostic IA', interaction_medicament: 'Interaction médicament' }[p.type] || p.type;
      items.push({ id: String(p._id), icon: '🤖', title: `${typeLabel} en attente`, detail: `Patient: ${pat ? `${pat.prenom} ${pat.nom}` : 'Anonyme'} · Confiance: ${p.score_confiance}%`, module: 'IA', priority: 'eleve', time: fmtDate(p.createdAt) });
    });
    return items;
  }, [realAlerts]);

  const nbAlertesNonLues = reduxStats.alertes_risque ?? flatAlerts.filter(a => !alertesLues.includes(a.id) && a.priority === "critique").length;

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [chatMessages]);

  // Charger alertes réelles depuis l'API
  useEffect(() => {
    setAlertsLoading(true);
    api.get('/ai/alerts')
      .then(({ data }) => setRealAlerts(data.alerts || { labo_critiques: [], imagerie_urgentes: [], predictions_en_attente: [] }))
      .catch(() => {})
      .finally(() => setAlertsLoading(false));
  }, [tab]);

  // ── Helpers parsing ───────────────────────────────────────
  const normalizeSymptom = (s) => {
    const accents = { à:'a',â:'a',ä:'a',é:'e',è:'e',ê:'e',ë:'e',î:'i',ï:'i',ô:'o',ö:'o',ù:'u',û:'u',ü:'u',ÿ:'y',ç:'c' };
    return s.trim().toLowerCase().replace(/[àâäéèêëîïôöùûüÿç]/g, c => accents[c] || c).replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
  };

  const parseVitals = (text) => {
    const v = {};
    const t = text.match(/T°?\s*[:=]?\s*(\d+\.?\d*)/i);
    if (t) v.temperature = parseFloat(t[1]);
    const hr = text.match(/(?:Pouls|FC|HR)\s*[:=]?\s*(\d+)/i);
    if (hr) v.frequence_cardiaque = parseInt(hr[1]);
    const bp = text.match(/(?:TA|PA)\s*[:=]?\s*(\d+\/\d+)/i);
    if (bp) v.pression_arterielle = bp[1];
    const gl = text.match(/(?:glycemie|glyc.mie)\s*[:=]?\s*(\d+\.?\d*)/i);
    if (gl) v.glycemie = parseFloat(gl[1]);
    return v;
  };

  const URGENCE_MAP = { "elevée": "eleve", "eleve": "eleve", "modérée": "modere", "modere": "modere", "faible": "faible" };

  // ── Analyse clinique — connectée à POST /ai/diagnose ─────
  const lancerAnalyse = async () => {
    if (!formSymptomes.trim()) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const symptoms = formSymptomes.split(/[,;\n]+/).map(normalizeSymptom).filter(Boolean);
      const vitals = parseVitals(formSignesVitaux + ' ' + formBioResults);
      const result = await dispatch(runDiagnosis({ symptoms, vitals })).unwrap();
      const { suggestions = [], risks = {}, vitalAlerts = [] } = result;
      const mapUrgence = (u) => URGENCE_MAP[u] || "faible";
      const highestGravite = suggestions.length > 0 ? mapUrgence(suggestions[0].urgence) : "faible";
      const orientation = risks.cardiovasculaire > 70 ? "Cardiologie / Urgences" :
        risks.diagnostic > 70 ? "Urgences" : risks.diabetique > 60 ? "Endocrinologie" : "Consultation médicale";
      setAnalysisResult({
        diagnostics: suggestions.map(s => ({ label: s.condition, proba: s.probabilite, gravite: mapUrgence(s.urgence) })),
        examens: vitalAlerts.length > 0
          ? vitalAlerts.map(va => `Surveiller ${va.champ} (${va.valeur}) — ${va.message}`)
          : ["Bilan biologique complet", "Consultation médicale approfondie"],
        gravite: highestGravite,
        orientation,
        note: "Ces suggestions sont indicatives. La décision clinique appartient toujours au médecin.",
        risks,
        vitalAlerts,
      });
      dispatch(fetchAIStats());
    } catch (err) {
      toast.error(typeof err === 'string' ? err : "Erreur lors de l'analyse IA");
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Vérification ordonnance — connectée à POST /ai/interactions ─
  const [ordoResult, setOrdoResult] = useState(null);
  const [ordoLoading, setOrdoLoading] = useState(false);
  const verifierOrdonnance = async () => {
    if (!formMedicament.trim()) return;
    setOrdoLoading(true); setOrdoResult(null);
    try {
      const meds = [
        ...formMedicament.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean),
        ...formAllergiesPatient.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean),
      ];
      const warnings = await dispatch(checkDrugInteractions(meds)).unwrap();
      const ok = warnings.length === 0;
      const allergyWarn = warnings.filter(w => w.description?.includes('ALLERGIE'));
      setOrdoResult({
        ok,
        interactions: warnings.map(w => ({
          med1: w.medicaments[0] || '—',
          med2: w.medicaments.slice(1).join(' + ') || '—',
          risque: w.description,
          gravite: w.risque,
        })),
        posologie: ok ? "Posologie standard — cf. prescription médicale" : "⚠ Revoir la prescription avec le médecin prescripteur",
        alternatives: allergyWarn.length > 0
          ? ["Consulter le médecin pour une alternative adaptée", "Vérifier les antécédents allergiques complets"]
          : [],
      });
    } catch (err) {
      toast.error(typeof err === 'string' ? err : "Erreur lors de la vérification");
    } finally {
      setOrdoLoading(false);
    }
  };

  // ── Analyse patient (résumé IA réel) ──────────────────────
  useEffect(() => {
    if ((section === "patient" || section === "laboratoire") && reduxPatientsList.length === 0) {
      dispatch(fetchPatients({ limit: 100 }));
    }
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  const analyserDossierPatient = async () => {
    if (!selectedPatientId) return;
    try {
      await dispatch(fetchPatientSummary(selectedPatientId)).unwrap();
    } catch (err) {
      toast.error(typeof err === 'string' ? err : "Erreur lors de l'analyse du dossier");
    }
  };

  // ── Laboratoire IA (implémentation réelle — cf. AI.controller.js::
  // getLabInsights) ───────────────────────────────────────────
  const analyserLaboPatient = async () => {
    if (!selectedLabPatientId) return;
    try {
      await dispatch(fetchLabInsights(selectedLabPatientId)).unwrap();
    } catch (err) {
      toast.error(typeof err === 'string' ? err : "Erreur lors de l'analyse laboratoire");
    }
  };

  // ── Chat ──────────────────────────────────────────────────
  // A-1 (audit Phases 2-9) — neutralisé, pas implémenté : ce chat n'a jamais
  // été relié à un backend (aucune route /ai/chat n'existe — voir
  // backend/routes/ai.routes.js) et répondait avec des données patient et
  // des valeurs cliniques entièrement inventées (CHAT_RESPONSES, supprimé).
  // Pattern identique à AUDIT-03 (Settings.jsx) et AUDIT-07 (Messages.jsx
  // compose) : on neutralise plutôt que de construire un backend. L'onglet
  // reste visible ; l'input et le bouton d'envoi sont désactivés ci-dessous
  // et n'ont plus de handler d'envoi.

  // ── Export journal IA (PDF) ───────────────────────────────
  const exportHistoriqueIA = useCallback(async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(11, 30, 59);
    doc.rect(0, 0, W, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15); doc.setFont('helvetica', 'bold');
    doc.text('Journal des Analyses IA', 14, 11);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`${CLINIC_NAME} ${CLINIC_SUBTITLE}`, 14, 18);
    doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')}`, W - 14, 18, { align: 'right' });
    autoTable(doc, {
      startY: 32,
      head: [["Date", "Utilisateur", "Type d'analyse", "Patient", "Score", "Statut"]],
      body: reduxPredictions.map(p => {
        const pat = p.patient;
        const patName = pat ? `${pat.prenom || ''} ${pat.nom || ''}`.trim() || 'Anonyme' : 'Anonyme';
        const typeLabel = { diagnostic: 'Analyse diagnostique', interaction_medicament: 'Interaction médicament' }[p.type] || p.type;
        const score = p.resultat?.suggestions?.[0]?.probabilite ?? p.score_confiance ?? 0;
        const tracte = p.traite_par ? `${p.traite_par.prenom || ''} ${p.traite_par.nom || ''}`.trim() : '—';
        return [fmtDate(p.createdAt), tracte, typeLabel, patName, `${score}%`, p.statut === 'traite' ? 'Validé' : 'En attente'];
      }),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [14, 165, 160], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 255] },
    });
    doc.save(`journal-ia-${new Date().toISOString().split('T')[0]}.pdf`);
  }, [reduxPredictions]);

  const SECTIONS = [
    { id:"assistant",     label:"🩺 Assistant médical" },
    { id:"patient",       label:"👤 Analyse patient" },
    { id:"ordonnance",    label:"💊 Ordonnance IA" },
    { id:"laboratoire",   label:"🔬 Laboratoire IA" },
    { id:"imagerie",      label:"🩻 Imagerie IA" },
    { id:"rdv",           label:"📅 Rendez-vous" },
    { id:"administratif", label:"📋 Administratif" },
    { id:"finance",       label:"💰 Finance IA" },
    { id:"alertes",       label:`🔔 Alertes (${reduxStats.alertes_risque ?? flatAlerts.length})`, warn:true },
    { id:"chat",          label:"💬 Chat IA" },
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

        {/* ── HERO ── */}
        <Hero
          icon={BrainCircuit}
          pulseIcon
          title="Intelligence Artificielle"
          dateLabel={
            <span className="flex items-center gap-1.5">
              <span style={{ width:7, height:7, borderRadius:"50%", background:"#4ADE80", display:"inline-block", boxShadow:"0 0 0 3px rgba(74,222,128,.3)" }} className="animate-pulse" />
              IA active · {CLINIC_NAME} {CLINIC_SUBTITLE}
            </span>
          }
          right={
            <>
              {nbAlertesNonLues > 0 && (
                <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(220,38,38,.2)", border:"1px solid rgba(220,38,38,.4)", borderRadius:10, padding:"8px 14px" }}>
                  <span style={{ fontSize:14 }}>🔴</span>
                  <span style={{ fontSize:12, color:"#FCA5A5", fontWeight:700 }}>{nbAlertesNonLues} alerte{nbAlertesNonLues > 1?"s":""} critique{nbAlertesNonLues > 1?"s":""}</span>
                </div>
              )}
              <Button icon={Zap} onClick={() => setTab("modules") }>Lancer analyse</Button>
            </>
          }
        />

        {/* T9.4 (R-11) — placé juste sous le Hero, hors de tout onglet, pour
            rester visible quel que soit l'onglet sélectionné (contrairement à
            un placement dans le seul Dashboard) : la personne qui ouvre ce
            module doit voir cette précision avant même de choisir un onglet. */}
        <div style={{ padding: isMobile ? "14px 14px 0" : "20px 24px 0" }}>
          <div className="al-ia fu" style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
            <div style={{ width:36, height:36, background:"#DBEAFE", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:18 }}>ℹ️</div>
            <div>
              <strong style={{ color:"var(--cn)", fontSize:13.5 }}>À propos de ce module</strong>
              <div style={{ fontSize:12.5, color:"var(--cm)", marginTop:4, lineHeight:1.6 }}>
                Les analyses et alertes de cette page sont produites par un <strong>moteur de règles programmées à l'avance</strong> (par exemple : « température &gt; 38,5&nbsp;°C → suggérer un syndrome fébrile »), <strong>pas par un modèle d'intelligence artificielle entraîné sur des données</strong>. Aucun apprentissage automatique n'est utilisé ici : les résultats sont donc prévisibles et reproductibles, mais ils ne remplacent en aucun cas le jugement clinique d'un professionnel de santé.
              </div>
            </div>
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
              <div className="tab-bar" style={isMobile?{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}:{}}>
                {TABS.map(t=>(
                  <button key={t.key} className={`tab-bar-item ${tab===t.key?"active":""}`} style={isMobile?{flexDirection:'column',textAlign:'center',padding:'7px 3px 8px',fontSize:'9.5px',gap:'3px',whiteSpace:'normal',minWidth:0}:{}} onClick={()=>setTab(t.key)}>
                    <span style={isMobile?{fontSize:'14px'}:{}}>{t.icon}</span>
                    <span style={isMobile?{lineHeight:1.2}:{}}>{isMobile?t.labelM:t.label}</span>
                    {t.key==="alertes"&&nbAlertesNonLues>0&&<span className="tab-bar-item-count">{nbAlertesNonLues}</span>}
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
                <KpiCard color="blue"   icon={I.iaS}      value={reduxLoading ? "…" : (reduxStats.analyses_mois ?? 0)}   label="Analyses IA"          sub="ce mois" />
                <KpiCard color="red"    icon={I.alert}    value={reduxLoading ? "…" : (reduxStats.alertes_risque ?? 0)}   label="Alertes critiques"    sub="aujourd'hui" urgent />
                <KpiCard color="teal"   icon={I.pulse}    value={reduxLoading ? "…" : (reduxStats.diagnostics ?? 0)}      label="Diagnostics assistés" sub="ce mois" />
                <KpiCard color="purple" icon={I.pill}     value={reduxLoading ? "…" : (reduxStats.interactions ?? 0)}     label="Ordonnances vérifiées" sub={reduxStats.interactions > 0 ? `${reduxStats.interactions} vérif.` : "aucune interaction"} />
                <KpiCard color="green"  icon={I.calendar} value={reduxLoading ? "…" : (reduxStats.patients_analyses ?? 0)} label="Patients analysés"   sub="ce mois" />
                <KpiCard color="orange" icon={I.file}     value={reduxLoading ? "…" : (reduxStats.labo_anomalies_ia ?? 0)} label="Anomalies IA labo"   sub="détectées" />
              </div>

              {/* Charts + reco */}
              {/* POST5-011 (audit indépendant post-Phase 5, 14 sept. 2026) —
                  "Activité IA" affichait un tableau littéral codé en dur
                  ([12,18,9,24,16,7,4]), jamais issu d'une requête réelle,
                  juste à côté de vrais KPI Redux — désormais alimenté par
                  ai.controller.js::getStats (agrégation réelle sur
                  AIPrediction.createdAt, 7 derniers jours). "Modules actifs"
                  (pourcentages "Assistant médical 95%", etc.) est retiré :
                  aucune donnée ni définition réelle de ce que mesurerait un
                  tel pourcentage n'existe nulle part dans ce système (aucun
                  suivi d'usage par sous-module) — jamais remplacé par une
                  autre valeur inventée, même principe que Analytics.jsx
                  (onglet Performance, déjà corrigé). */}
              <div style={{ marginBottom:20 }}>
                <div className="ia-card fu">
                  <div className="ia-card-hdr">
                    <div><h3>{I.trend} Activité IA — 7 derniers jours</h3><p>Volume d'analyses et alertes générées</p></div>
                  </div>
                  <div style={{ padding:20 }}>
                    <BarChart labels={reduxStats.activite_7j?.labels?.length ? reduxStats.activite_7j.labels : ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"]} data={reduxStats.activite_7j?.data?.length ? reduxStats.activite_7j.data : [0,0,0,0,0,0,0]} color="#1B4F9E" />
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
                              {analysisResult.diagnostics.length === 0 && (
                                <div style={{ textAlign:"center", padding:"16px 0", color:"var(--cm)", fontSize:12 }}>Aucun diagnostic correspondant trouvé — vérifiez les termes saisis (ex: fievre, nausees, toux…)</div>
                              )}
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
                            {analysisResult.vitalAlerts?.length > 0 && (
                              <div style={{ background:"#FEF2F2", border:"1.5px solid #FECACA", borderRadius:12, padding:12 }}>
                                <div style={{ fontSize:11, fontWeight:700, color:"#B91C1C", marginBottom:6 }}>⚠ Alertes constantes vitales</div>
                                {analysisResult.vitalAlerts.map((va,i) => (
                                  <div key={i} style={{ fontSize:12, color:"#DC2626", marginBottom:2 }}>• {va.champ} {va.valeur} — {va.message}</div>
                                ))}
                              </div>
                            )}
                            <div style={{ fontSize:11, color:"var(--cm)", fontStyle:"italic", textAlign:"center" }}>{analysisResult.note}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ─ ANALYSE PATIENT ─ */}
                {/* Sous-phase 5.6 (module IA, relecture du 6 sept. 2026) — cette
                    section affichait un patient/dossier/risques entièrement
                    fabriqués (Jean Dupont, scores de risque inventés, résumé
                    médical inventé), présentés comme un vrai résumé IA. Aucun
                    moteur de règles réel n'existe pour ce sous-module (en
                    construire un est explicitement hors périmètre de cette
                    correction — décision produit distincte). Désactivé
                    honnêtement, même pattern que Chat IA (ligne ~1290) :
                    aucune donnée fabriquée ne peut plus s'afficher ici. */}
                {section === "patient" && (
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                    <div className="ia-card fu">
                      <div className="ia-card-hdr"><h3>👤 Sélectionner un patient</h3></div>
                      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:12 }}>
                        <select className="iinp" value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}>
                          <option value="">— Choisir un patient —</option>
                          {reduxPatientsList.map(p => (
                            <option key={p._id} value={p._id}>{p.prenom} {p.nom} — {p.numero_dossier || p._id}</option>
                          ))}
                        </select>
                        <button className="ibtn ibtn-teal" disabled={!selectedPatientId || patientSummaryLoading} onClick={analyserDossierPatient}>
                          {patientSummaryLoading ? <><span className="spin" style={{ display:"inline-block" }}>{I.iaS}</span> Analyse en cours...</> : <>{I.iaS} Analyser le dossier</>}
                        </button>
                        {!patientSummaryLoading && !patientSummary && (
                          <div style={{ textAlign:"center", padding:20, color:"var(--cm)", fontSize:12 }}>Sélectionnez un patient puis lancez l'analyse pour voir les scores de risque calculés sur ses données réelles.</div>
                        )}
                        {patientSummary && !patientSummaryLoading && (
                          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                            {[
                              ["Risque cardiovasculaire", patientSummary.risks?.cardiovasculaire ?? 0, "#DC2626"],
                              ["Risque diabétique",       patientSummary.risks?.diabetique ?? 0,       "#D97706"],
                              ["Risque global",           patientSummary.risks?.diagnostic ?? 0,        "#CA8A04"],
                              ["Risque obstétrical",      patientSummary.risks?.obstetrical ?? 0,        "#059669"],
                            ].map(([lbl,val,col]) => (
                              <div key={lbl}>
                                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                                  <span style={{ color:"var(--cm)" }}>{lbl}</span>
                                  <span style={{ fontWeight:700, color:col }}>{val}/100</span>
                                </div>
                                <Prog pct={val} color={col} />
                              </div>
                            ))}
                            <div style={{ fontSize:10, color:"var(--cm)", fontStyle:"italic", marginTop:4 }}>Scores calculés à partir des constantes vitales de la dernière consultation et des antécédents — pas de plainte active saisie.</div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="ia-card fu">
                      <div className="ia-card-hdr"><h3>📋 Résumé du dossier</h3></div>
                      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:10 }}>
                        {!patientSummary && !patientSummaryLoading && (
                          <div style={{ textAlign:"center", padding:20, color:"var(--cm)" }}>
                            <div style={{ fontSize:40, marginBottom:12, opacity:.4 }}>👤</div>
                            <div style={{ fontSize:13 }}>Aucune analyse en cours — sélectionnez un patient à gauche.</div>
                          </div>
                        )}
                        {patientSummaryLoading && (
                          <div style={{ textAlign:"center", padding:40 }}>
                            <div style={{ fontSize:36, animation:"iaPulse 1s infinite", marginBottom:10 }}>👤</div>
                            <div style={{ fontSize:13, color:"var(--cm)" }}>Chargement du dossier…</div>
                          </div>
                        )}
                        {patientSummary && !patientSummaryLoading && (
                          <>
                            {[
                              { icon:"🩺", label:"Antécédents",          value: patientSummary.patient_context?.antecedents?.join(', ') || 'Aucun renseigné' },
                              { icon:"💊", label:"Prescriptions actives", value: patientSummary.active_prescriptions?.flatMap(p => p.medicaments).join(', ') || 'Aucune' },
                              { icon:"⚠️", label:"Allergies",             value: patientSummary.patient_context?.allergies?.join(', ') || 'Aucune renseignée', warn: (patientSummary.patient_context?.allergies?.length || 0) > 0 },
                              { icon:"📅", label:"Dernière consultation", value: patientSummary.last_consultation ? `${fmtDate(patientSummary.last_consultation.date)} — ${patientSummary.last_consultation.diagnostic || 'diagnostic non renseigné'}` : 'Aucune' },
                              { icon:"🔬", label:"Résultats labo récents", value: patientSummary.recent_labs?.length ? `${patientSummary.recent_labs.length} résultat(s)${patientSummary.lab_critiques_count > 0 ? ` · ${patientSummary.lab_critiques_count} critique(s)` : ''}` : 'Aucun', warn: patientSummary.lab_critiques_count > 0 },
                              { icon:"🏥", label:"Hospitalisations",     value: `${patientSummary.hospitalisations_count ?? 0} séjour(s)` },
                            ].map(r => (
                              <div key={r.label} style={{ display:"flex", gap:10, background:r.warn?"#FEF2F2":"#F8FAFD", border:`1.5px solid ${r.warn?"#FECACA":"var(--cbr)"}`, borderRadius:10, padding:"10px 12px" }}>
                                <span style={{ fontSize:16, flexShrink:0 }}>{r.icon}</span>
                                <div>
                                  <div style={{ fontSize:10, fontWeight:700, color:r.warn?"#B91C1C":"var(--cm)", textTransform:"uppercase" }}>{r.label}</div>
                                  <div style={{ fontSize:12, color:r.warn?"#DC2626":"var(--cn)", marginTop:2, fontWeight:r.warn?700:400 }}>{r.value}</div>
                                </div>
                              </div>
                            ))}
                            {patientSummary.simulated && (
                              <div className="al-warn">
                                <div style={{ fontSize:12, color:"#92400E" }}>⚠ Synthèse narrative indisponible (assistant IA non configuré) — seules les données brutes ci-dessus sont affichées.</div>
                              </div>
                            )}
                            {patientSummary.synthese && (
                              <div style={{ background:"#F0FDFC", border:"1.5px solid #99F6E4", borderRadius:12, padding:14 }}>
                                <div style={{ fontSize:11, fontWeight:700, color:"var(--ct)", marginBottom:6 }}>🤖 SYNTHÈSE IA</div>
                                <div style={{ fontSize:12, color:"var(--cn)", whiteSpace:"pre-line" }}>{patientSummary.synthese}</div>
                              </div>
                            )}
                          </>
                        )}
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

                {/* Laboratoire IA — implémentation réelle (remplace le
                    placeholder posé en Sous-phase 5.6 à la place
                    d'interprétations et d'une tendance entièrement
                    fabriquées). Aucun diagnostic inventé : statut_res
                    (normal/anormal/critique), valeurs et références sont
                    déjà saisis et classifiés réellement par le laborantin
                    (LabResult.resultats[], voir ai.controller.js::
                    getLabInsights) — ce panneau consolide et trace
                    l'historique réel, il n'en invente aucun. */}
                {section === "laboratoire" && (
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                    <div className="ia-card fu">
                      <div className="ia-card-hdr"><h3>👤 Sélectionner un patient</h3></div>
                      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:12 }}>
                        <select className="iinp" value={selectedLabPatientId} onChange={e => setSelectedLabPatientId(e.target.value)}>
                          <option value="">— Choisir un patient —</option>
                          {reduxPatientsList.map(p => (
                            <option key={p._id} value={p._id}>{p.prenom} {p.nom} — {p.numero_dossier || p._id}</option>
                          ))}
                        </select>
                        <button className="ibtn ibtn-teal" disabled={!selectedLabPatientId || labInsightsLoading} onClick={analyserLaboPatient}>
                          {labInsightsLoading ? <><span className="spin" style={{ display:"inline-block" }}>{I.iaS}</span> Analyse en cours...</> : <>{I.iaS} Analyser les résultats labo</>}
                        </button>
                        {!labInsightsLoading && !labInsights && (
                          <div style={{ textAlign:"center", padding:20, color:"var(--cm)", fontSize:12 }}>Sélectionnez un patient puis lancez l'analyse pour consulter ses résultats de laboratoire.</div>
                        )}
                        {labInsights && !labInsightsLoading && (
                          <div style={{ fontSize:11, color:"var(--cm)", fontStyle:"italic" }}>{labInsights.historique_count} résultat(s) complété(s) trouvé(s) pour {labInsights.patient_context?.nom}.</div>
                        )}
                      </div>
                    </div>
                    <div className="ia-card fu">
                      <div className="ia-card-hdr"><h3>🔬 Interprétation — dernière analyse</h3></div>
                      <div style={{ padding:20 }}>
                        {!labInsights && !labInsightsLoading && (
                          <div style={{ textAlign:"center", padding:20, color:"var(--cm)" }}>
                            <div style={{ fontSize:40, marginBottom:12, opacity:.4 }}>🔬</div>
                            <div style={{ fontSize:13 }}>Aucune analyse en cours — sélectionnez un patient à gauche.</div>
                          </div>
                        )}
                        {labInsightsLoading && (
                          <div style={{ textAlign:"center", padding:40 }}>
                            <div style={{ fontSize:36, animation:"iaPulse 1s infinite", marginBottom:10 }}>🔬</div>
                            <div style={{ fontSize:13, color:"var(--cm)" }}>Chargement des résultats…</div>
                          </div>
                        )}
                        {labInsights && !labInsightsLoading && !labInsights.derniere_analyse && (
                          <div style={{ textAlign:"center", padding:20, color:"var(--cm)", fontSize:13 }}>Aucun résultat de laboratoire complété pour ce patient.</div>
                        )}
                        {labInsights?.derniere_analyse && (
                          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                            <div style={{ fontSize:11, color:"var(--cm)" }}>📅 {fmtDate(labInsights.derniere_analyse.date)}</div>
                            {labInsights.derniere_analyse.interpretation.map((r,i) => {
                              const cls = r.statut === "critique" ? "red" : r.statut === "anormal" ? "orange" : "green";
                              return (
                                <div key={i} style={{ background:"#F8FAFD", borderRadius:12, padding:"12px 14px", border:"1.5px solid var(--cbr)" }}>
                                  <div style={{ fontWeight:700, fontSize:13, color:"var(--cn)" }}>{r.exam}</div>
                                  <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>{r.valeur}{r.reference ? ` · normale : ${r.reference}` : ""}</div>
                                  <div style={{ marginTop:6 }}><Badge cls={cls}>{r.statut === "critique" ? "Critique" : r.statut === "anormal" ? "Anormal" : "Normal"}</Badge></div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    {labInsights?.trend && (
                      <div className="ia-card fu" style={{ gridColumn:isMobile?"auto":"1 / -1" }}>
                        <div className="ia-card-hdr"><h3>📈 Comparaison historique</h3><p>{labInsights.trend.analyte} — {labInsights.trend.labels.length} mesures réelles{labInsights.trend.reference ? ` (normale : ${labInsights.trend.reference})` : ""}</p></div>
                        <div style={{ padding:20 }}>
                          <LineChart labels={labInsights.trend.labels} data={labInsights.trend.data} color="#1B4F9E" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sous-phase 5.6 — POINT LE PLUS SENSIBLE DE L'AUDIT : cette
                    section affichait un contenu clinique entièrement inventé
                    et présenté comme un résultat réel ("Appendicite aiguë
                    confirmée"), sur un examen fictif. Désactivé en priorité
                    absolue — aucun contenu médical fabriqué ne doit plus
                    pouvoir s'afficher ici. */}
                {section === "imagerie" && (
                  <div className="ia-card fu">
                    <div style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>
                      <div style={{ fontSize:40, marginBottom:12, opacity:.4 }}>🩻</div>
                      <div style={{ fontSize:13 }}>🚧 Fonctionnalité en cours de développement — aucune donnée réelle n'est utilisée dans cette démonstration.</div>
                    </div>
                  </div>
                )}

                {/* Sous-phase 5.6 (module IA) — prévisions d'affluence et
                    charge par médecin entièrement fabriquées (aucun modèle
                    prédictif réel). Désactivé honnêtement. */}
                {section === "rdv" && (
                  <div className="ia-card fu">
                    <div style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>
                      <div style={{ fontSize:40, marginBottom:12, opacity:.4 }}>📅</div>
                      <div style={{ fontSize:13 }}>🚧 Fonctionnalité en cours de développement — aucune donnée réelle n'est utilisée dans cette démonstration.</div>
                    </div>
                  </div>
                )}

                {/* Sous-phase 5.6 — boutons "Générer" purement décoratifs
                    (aucun onClick, aucune génération réelle). Désactivé
                    honnêtement plutôt que de laisser un bouton qui ne fait
                    rien. */}
                {section === "administratif" && (
                  <div className="ia-card fu">
                    <div style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>
                      <div style={{ fontSize:40, marginBottom:12, opacity:.4 }}>📋</div>
                      <div style={{ fontSize:13 }}>🚧 Fonctionnalité en cours de développement — aucune donnée réelle n'est utilisée dans cette démonstration.</div>
                    </div>
                  </div>
                )}

                {/* Sous-phase 5.6 — prévisions financières et détection
                    d'anomalies entièrement fabriquées (aucun calcul réel sur
                    les vraies factures/dépenses). Désactivé honnêtement —
                    les vrais chiffres financiers existent déjà et sont
                    exposés ailleurs (Finance.jsx), pas ici sous forme
                    inventée. */}
                {section === "finance" && (
                  <div className="ia-card fu">
                    <div style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>
                      <div style={{ fontSize:40, marginBottom:12, opacity:.4 }}>💰</div>
                      <div style={{ fontSize:13 }}>🚧 Fonctionnalité en cours de développement — aucune donnée réelle n'est utilisée dans cette démonstration.</div>
                    </div>
                  </div>
                )}

                {/* ─ ALERTES ─ */}
                {section === "alertes" && (
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)" }}>Centre d'alertes intelligentes <span style={{ fontSize:13, fontWeight:400, color:"var(--cm)" }}>({flatAlerts.length} alertes)</span></div>
                      <button className="ibtn ibtn-ghost ibtn-sm" onClick={() => setAlertesLues(flatAlerts.map(a=>a.id))}>✓ Tout marquer comme lu</button>
                    </div>
                    {alertsLoading && <div style={{ textAlign:"center", padding:30, color:"var(--cm)" }}>Chargement des alertes…</div>}
                    {!alertsLoading && flatAlerts.length === 0 && (
                      <div style={{ textAlign:"center", padding:40, color:"var(--cm)" }}><div style={{ fontSize:32, marginBottom:12, opacity:.4 }}>🔔</div><div style={{ fontSize:13 }}>Aucune alerte active pour le moment</div></div>
                    )}
                    {["critique","eleve","modere","faible"].map(niveau => {
                      const items = flatAlerts.filter(a => a.priority === niveau);
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
                        <div ref={chatEndRef} />
                      </div>
                      <div className="chat-input-row">
                        <input className="chat-input" placeholder="Posez votre question…" aria-label="Message pour l'assistant IA" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={handleChatKeyDown} disabled={chatSending} />
                        <button className="ibtn ibtn-teal ibtn-sm" onClick={sendChatMessage} disabled={chatSending || !chatInput.trim()} title="Envoyer">{chatSending ? "…" : I.send}</button>
                      </div>
                    </div>
                    <div style={{ padding:"10px 16px 16px", fontSize:12, color:"var(--cm)" }}>
                      ℹ️ Réponses générées par IA — à titre informatif, jamais un diagnostic validé.
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
                    <div ref={chatEndRef} />
                  </div>
                  <div className="chat-input-row">
                    <input className="chat-input" placeholder="Posez votre question…" aria-label="Message pour l'assistant IA" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={handleChatKeyDown} disabled={chatSending} />
                    <button className="ibtn ibtn-teal" onClick={sendChatMessage} disabled={chatSending || !chatInput.trim()}>{chatSending ? "Envoi…" : <>{I.send} Envoyer</>}</button>
                  </div>
                </div>
                <div style={{ padding:"10px 16px 16px", fontSize:12, color:"var(--cm)" }}>
                  ℹ️ Réponses générées par IA — à titre informatif, jamais un diagnostic validé.
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
                  <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>{flatAlerts.length} alertes · {nbAlertesNonLues} critique(s) non traitée(s)</div>
                </div>
                <button className="ibtn ibtn-ghost ibtn-sm" onClick={() => setAlertesLues(flatAlerts.map(a=>a.id))}>✓ Tout marquer comme lu</button>
              </div>
              {/* Stats alertes */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:24 }}>
                {[
                  ["🔴","Critiques",   flatAlerts.filter(a=>a.priority==="critique").length, "red"],
                  ["🟠","Élevées",     flatAlerts.filter(a=>a.priority==="eleve").length, "orange"],
                  ["🟡","Modérées",    flatAlerts.filter(a=>a.priority==="modere").length, "yellow"],
                  ["🟢","Informatives",flatAlerts.filter(a=>a.priority==="faible").length, "green"],
                ].map(([ico,lbl,nb,cls]) => (
                  <div key={lbl} className={`ia-kpi ${cls==="yellow"?"orange":cls} fu`}>
                    <div style={{ fontSize:24, marginBottom:6 }}>{ico}</div>
                    <div className="kpi-val">{alertsLoading ? "…" : nb}</div>
                    <div className="kpi-lbl">{lbl}</div>
                  </div>
                ))}
              </div>
              {alertsLoading && <div style={{ textAlign:"center", padding:30, color:"var(--cm)" }}>Chargement des alertes…</div>}
              {!alertsLoading && flatAlerts.length === 0 && (
                <div style={{ textAlign:"center", padding:50, color:"var(--cm)" }}>
                  <div style={{ fontSize:36, marginBottom:12, opacity:.4 }}>✅</div>
                  <div style={{ fontSize:14, fontWeight:600 }}>Aucune alerte active</div>
                  <div style={{ fontSize:12, marginTop:6 }}>Tous les modules fonctionnent normalement</div>
                </div>
              )}
              {flatAlerts.map(a => {
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
                    <button className="ibtn ibtn-ghost ibtn-sm" style={{ fontSize:10, flexShrink:0 }} onClick={() => setAlertesLues(p => [...p, a.id])}>
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
                      {reduxLoading && <tr><td colSpan={6} style={{ textAlign:"center", padding:24, color:"var(--cm)" }}>Chargement…</td></tr>}
                      {!reduxLoading && reduxPredictions.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign:"center", padding:30, color:"var(--cm)" }}>Aucune analyse IA enregistrée</td></tr>
                      )}
                      {reduxPredictions.map(p => {
                        const pat = p.patient;
                        const patName = pat ? `${pat.prenom || ''} ${pat.nom || ''}`.trim() || 'Anonyme' : 'Anonyme';
                        const typeLabel = { diagnostic:"Analyse diagnostique", interaction_medicament:"Interaction médicament" }[p.type] || p.type;
                        const score = p.resultat?.suggestions?.[0]?.probabilite ?? p.score_confiance ?? 0;
                        const tracte = p.traite_par ? `${p.traite_par.prenom || ''} ${p.traite_par.nom || ''}`.trim() : '—';
                        return (
                          <tr key={p._id}>
                            <td style={{ fontSize:12, fontFamily:"monospace", color:"var(--cb)" }}>{fmtDate(p.createdAt)}</td>
                            <td style={{ fontSize:12 }}>{tracte}</td>
                            <td><div style={{ display:"flex", alignItems:"center", gap:6 }}>{I.iaS}<span style={{ fontSize:12, fontWeight:600 }}>{typeLabel}</span></div></td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{patName}</td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>Confiance {score}%</td>
                            <td><Badge cls={p.statut === 'traite' ? "green" : "orange"}>{p.statut === 'traite' ? "✅ Validé" : "⏳ En attente"}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding:"10px 20px", borderTop:"1.5px solid var(--cbr)", display:"flex", gap:8 }}>
                  <button className="ibtn ibtn-ghost ibtn-sm" onClick={exportHistoriqueIA} disabled={reduxPredictions.length === 0}>{I.dl} Exporter journal IA (PDF)</button>
                </div>
              </div>
            </div>
          )}

          {/* ══ BASE DE CONNAISSANCES ══ */}
          {/* Sous-phase 5.6 (module IA, relecture du 6 sept. 2026) — les
              articles affichés (kbFiltered) sont des données fabriquées ;
              "Consulter"/"Résumé IA" n'ont aucun handler réel. Aucune vraie
              base de connaissances médicale n'existe dans ce système.
              Désactivé honnêtement, même pattern que Chat IA. */}
          {tab === "knowledge" && (
            <div className="ia-card fu">
              <div style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>
                <div style={{ fontSize:40, marginBottom:12, opacity:.4 }}>📚</div>
                <div style={{ fontSize:13 }}>🚧 Fonctionnalité en cours de développement — aucune donnée réelle n'est utilisée dans cette démonstration.</div>
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

              {/* AI-FAKE-CHECKLIST-004 (audit métier du 13 sept. 2026, Phase
                  4) — ces 4 lignes sont un tableau littéral câblé en dur,
                  jamais dérivé d'un état réel vérifié dynamiquement (aucun
                  appel API, aucune valeur de configuration lue) : présenter
                  ce panneau sans le dire créait un faux sentiment de
                  conformité (RGPD/sécurité) si quelqu'un s'y fiait comme
                  preuve d'audit. Les affirmations elles-mêmes restent
                  correctes en pratique (logAction trace bien
                  systématiquement les analyses IA, AuditLog est bien
                  alimenté, TLS est bien actif en production ; seule
                  l'anonymisation pour la recherche n'existe pas, déjà
                  honnêtement affichée ⬜) — mais aucune n'est vérifiable
                  depuis ce composant, qui n'a accès à aucun de ces états
                  d'infrastructure. Retirer entièrement le panneau
                  masquerait une information utile (bon contre-exemple :
                  HR.jsx::Présences retire un panneau qui n'affirme RIEN de
                  vrai) ; ici, le libeller explicitement "déclaratif, non
                  vérifié automatiquement" est le correctif minimal fidèle à
                  la recommandation de l'audit. */}
              {/* Sécurité */}
              <div className="ia-card fu">
                <div className="ia-card-hdr">
                  <h3>🔒 Sécurité & Protection des données</h3>
                  <p style={{ fontSize:11, color:"var(--cm)", marginTop:2 }}>Déclaratif — non vérifié automatiquement à l'exécution</p>
                </div>
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
                  {/* AUDIT-11 (Vague 2, W3) — appelait PUT /ai/settings, une
                      route qui n'a jamais existé côté backend (ai.routes.js) ;
                      l'erreur était avalée (.catch(() => {})) et le toast de
                      succès s'affichait quand même. La persistance
                      localStorage, elle, est réelle — retiré uniquement
                      l'appel serveur mort, gardé l'enregistrement local et
                      son toast, qui reflète désormais un succès véritable. */}
                  <button className="ibtn ibtn-teal ibtn-sm" style={{ marginTop:4 }} disabled={savingSettings} onClick={async () => {
                    setSavingSettings(true);
                    try {
                      localStorage.setItem('ai_settings', JSON.stringify(settings));
                      toast.success('✅ Paramètres IA enregistrés (sur cet appareil)');
                    } finally { setSavingSettings(false); }
                  }}>
                    {savingSettings ? <><span className="spin" style={{ display:"inline-block" }}>{I.iaS}</span> Enregistrement…</> : <>{I.check} Enregistrer les paramètres</>}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}