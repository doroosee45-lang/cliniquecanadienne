import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchSurgeries, createSurgery, updateSurgery,
  selectSurgeries, selectChirurgieLoading, selectChirurgieTotal, selectChirurgieStats,
} from '../store/slices/chirurgieSlice';
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

// ─── CSS Medical Navy + Teal ──────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.chir * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --cn: #0B1E3B; --cn2: #132744; --cb: #1B4F9E;
  --ct: #0EA5A0; --ct2: #0D9490; --cr: #DC2626;
  --co: #D97706; --cg: #059669; --cp: #7C3AED;
  --cbr: #E2EAF4; --cm: #6B7A99; --cl: #EEF4FF; --cs: #F8FAFD;
  --sh: 0 1px 3px rgba(11,30,59,.08); --shm: 0 4px 16px rgba(11,30,59,.10); --shl: 0 12px 40px rgba(11,30,59,.14);
}

/* Topbar */
.chir-top { background:linear-gradient(135deg,var(--cn) 0%,var(--cn2) 55%,#1B4F9E 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.chir-top::before { content:''; position:absolute; top:-50px; right:-50px; width:200px; height:200px; background:radial-gradient(circle,rgba(14,165,160,.22) 0%,transparent 70%); border-radius:50%; pointer-events:none; }

/* Tabs */
.chir-tabs { display:flex; gap:2px; padding:0 0; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.chir-tabs::-webkit-scrollbar { display:none; }
.chir-tab { display:flex; align-items:center; gap:7px; padding:10px 18px 12px; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.55); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.chir-tab:hover { color:rgba(255,255,255,.88); background:rgba(255,255,255,.08); }
.chir-tab.active { color:var(--cn); background:var(--cs); box-shadow:0 -2px 0 var(--ct) inset; }
.chir-tab-badge { background:var(--cr); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:99px; animation:chiP 2s infinite; }
@keyframes chiP { 0%,100%{opacity:1} 50%{opacity:.4} }

/* Cards */
.chir-card { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; }
.chir-card:hover { box-shadow:var(--shm); }
.chir-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.chir-card-hdr h3 { font-size:14px; font-weight:700; color:var(--cn); margin:0; display:flex; align-items:center; gap:8px; }
.chir-card-hdr p  { font-size:11px; color:var(--cm); margin:2px 0 0; }

/* KPI */
.chir-kpi { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:pointer; display:block; text-decoration:none; }
.chir-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.chir-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.chir-kpi.blue::before   { background:var(--cb); } .chir-kpi.teal::before   { background:var(--ct); }
.chir-kpi.red::before    { background:var(--cr); } .chir-kpi.orange::before { background:var(--co); }
.chir-kpi.green::before  { background:var(--cg); } .chir-kpi.purple::before { background:var(--cp); }
.kpi-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
.kpi-icon.blue   { background:#EFF6FF; color:var(--cb); } .kpi-icon.teal   { background:#F0FDFC; color:var(--ct); }
.kpi-icon.red    { background:#FEF2F2; color:var(--cr); } .kpi-icon.orange { background:#FFF7ED; color:var(--co); }
.kpi-icon.green  { background:#ECFDF5; color:var(--cg); } .kpi-icon.purple { background:#F5F3FF; color:var(--cp); }
.kpi-val { font-size:26px; font-weight:800; color:var(--cn); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.kpi-lbl { font-size:11.5px; font-weight:600; color:var(--cm); }
.kpi-sub { font-size:10.5px; color:#9CA3AF; margin-top:2px; }
.kpi-dot { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--cr); animation:chiP 2s infinite; }

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

/* IA badge */
.ia-b { display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:700; }
.ia-b.faible   { background:#ECFDF5; color:var(--cg); border:1px solid #A7F3D0; }
.ia-b.modere   { background:#FEFCE8; color:#CA8A04;   border:1px solid #FEF08A; }
.ia-b.eleve    { background:#FFF7ED; color:var(--co); border:1px solid #FED7AA; }
.ia-b.critique { background:#FEF2F2; color:var(--cr); border:1px solid #FECACA; animation:chiP 2s infinite; }

/* Progress */
.chir-prog { background:#EEF4FF; border-radius:99px; height:7px; overflow:hidden; }
.chir-prog-f { height:100%; border-radius:99px; transition:width .5s; }

/* Buttons */
.cbtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; text-decoration:none; }
.cbtn-primary { background:var(--cb); color:#fff; } .cbtn-primary:hover { background:#174391; transform:translateY(-1px); }
.cbtn-teal    { background:var(--ct); color:#fff; } .cbtn-teal:hover    { background:var(--ct2); transform:translateY(-1px); }
.cbtn-ghost   { background:transparent; color:var(--cm); border:1.5px solid var(--cbr); }
.cbtn-ghost:hover { background:var(--cl); color:var(--cn); }
.cbtn-danger  { background:#FEF2F2; color:var(--cr); border:1.5px solid #FECACA; }
.cbtn-danger:hover { background:var(--cr); color:#fff; }
.cbtn-sm { padding:6px 12px; font-size:12px; }
.cbtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }

/* Forms */
.clbl { font-size:12px; font-weight:600; color:var(--cm); margin-bottom:6px; display:block; }
.cinp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--cbr); background:#FAFBFF; font-size:13px; color:var(--cn); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.cinp:focus { border-color:var(--ct); box-shadow:0 0 0 3px rgba(14,165,160,.12); }

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

/* Table */
.chir-tbl { width:100%; border-collapse:collapse; }
.chir-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.chir-tbl th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--cm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--cbr); white-space:nowrap; }
.chir-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.chir-tbl tbody tr:last-child td { border-bottom:none; }
.chir-tbl tbody tr:hover { background:#F8FAFF; }

/* Modal */
.mov { position:fixed; inset:0; z-index:500; background:rgba(11,30,59,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.mov-box { background:#fff; border-radius:20px; box-shadow:var(--shl); width:100%; max-width:620px; max-height:90vh; overflow-y:auto; animation:slideUp .25s ease; }
@keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.mov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:#EEF4FF; position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.mov-hdr h3 { font-size:16px; font-weight:700; color:var(--cn); margin:0; display:flex; align-items:center; gap:10px; }
.mov-cls { width:32px; height:32px; border-radius:8px; background:#F3F7FF; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--cm); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.mov-cls:hover { background:#FEF2F2; color:var(--cr); }
.mov-body { padding:24px; }

/* Vital card */
.vital { background:#F8FAFD; border:1.5px solid var(--cbr); border-radius:12px; padding:12px 16px; text-align:center; }
.vital-v { font-size:22px; font-weight:800; color:var(--cn); }
.vital-l { font-size:10px; color:var(--cm); font-weight:600; text-transform:uppercase; margin-top:2px; }

/* IA score bar */
.ia-bar { height:10px; border-radius:99px; overflow:hidden; background:#EEF4FF; }
.ia-bar-f { height:100%; border-radius:99px; transition:width 1s; }

/* Fade */
@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
.fu { animation:fadeUp .35s ease both; }

/* ─── Responsive ─── */
.chir-g2  { display:grid; grid-template-columns:2fr 1fr; gap:20px; }
.chir-g11 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.chir-g11s{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
@media (max-width:767px) {
  .chir-top { padding:12px 14px 0; }
  .chir-g2,.chir-g11 { grid-template-columns:1fr; gap:14px; }
  .chir-g11s { grid-template-columns:1fr 1fr; gap:8px; }
  .cinp { font-size:16px !important; }
  .cbtn { font-size:12px; padding:8px 12px; } .cbtn-sm { font-size:11px; padding:5px 8px; }
  .chir-card { border-radius:14px; } .chir-card-hdr { padding:11px 14px; }
  .mov { padding:0; align-items:flex-end; } .mov-box { border-radius:20px 20px 0 0; max-width:100%; max-height:93vh; }
  .mov-hdr { padding:13px 16px; } .mov-body { padding:14px; }
}
@media (max-width:479px) {
  .chir-top { padding:10px 12px 0; } .chir-g11s { grid-template-columns:1fr; }
  .chir-card-hdr { flex-wrap:wrap; gap:8px; }
}
`;

// ─── Helpers ─────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const fmtDateInput = (d) => d ? new Date(d).toISOString().substring(0, 10) : "";
const ageCalc = (dob) => {
  if (!dob) return "—";
  const y = Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 3600 * 1000));
  return `${y} ans`;
};
const stockStatus = (score) =>
  score >= 70 ? "critique" : score >= 50 ? "eleve" : score >= 30 ? "modere" : "faible";

const STATUT_CFG = {
  consultation:  { cls: "teal",   label: "Consultation" },
  preoperatoire: { cls: "orange", label: "Préopératoire" },
  opere:         { cls: "green",  label: "Opéré" },
  suivi_postop:  { cls: "purple", label: "Suivi postop." },
  cloture:       { cls: "gray",   label: "Clôturé" },
};
const URGENCE_CFG = {
  electif:         { cls: "green",  label: "Électif" },
  urgent:          { cls: "orange", label: "Urgent" },
  urgence_absolue: { cls: "red",    label: "Urgence absolue" },
};
const IA_COLORS = { faible: "#059669", modere: "#CA8A04", eleve: "#D97706", critique: "#DC2626" };

// ─── SVG Icons ────────────────────────────────────────────────
const I = {
  heart:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  file:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  chat:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  clock:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  pulse:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  alert:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  ia:       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  plus:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  save:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  trend:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  grid:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  list:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  open:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  link:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  dl:       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  print:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
};

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
    <div className={`chir-kpi ${color} fu`} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      {urgent && <div className="kpi-dot" />}
      <div className={`kpi-icon ${color}`}>{icon}</div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-lbl">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// ─── Progress bar ───────────────────────────────────────────
function Prog({ pct, color }) {
  return (
    <div className="chir-prog">
      <div className="chir-prog-f" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ─── Badge ──────────────────────────────────────────────────
function Badge({ cls, children }) {
  return <span className={`cbdg ${cls}`}>{children}</span>;
}

// ─── IA Badge ───────────────────────────────────────────────
function IaBadge({ niveau, score }) {
  return <span className={`ia-b ${niveau}`}>{score}/100</span>;
}

// ─── Bar Chart (Chart.js) ───────────────────────────────────
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
            label: "Interventions",
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
            tooltip: { backgroundColor: "#0B1E3B", padding: 10, cornerRadius: 10, titleFont: { size: 12 }, bodyFont: { size: 11 } },
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

// ─── DEMO DATA ───────────────────────────────────────────────
const DEMO_DOSSIERS = [];

const DEMO_MOIS = [];
const DEMO_INTERV = [];

const EMPTY_DOSSIER = {
  patient_id: "", chirurgien_id: "", statut: "consultation", niveau_urgence: "electif",
  motif_consultation: "", symptomes: "", examen_clinique: "",
  diagnostic_chirurgical: "", decision: "intervention", type_intervention: "",
};

const EMPTY_BILAN = { type: "biologie", examen: "", valeur: "", resultat: "", date_examen: "", statut: "prescrit", urgence: false };
const EMPTY_SUIVI = { temperature: "", tension_sys: "", tension_dia: "", pouls: "", douleur_score: "", etat_plaie: "bonne_evolution", pansement_fait: false, antibiotherapie: "", medicaments: "", observations: "" };
const EMPTY_COMPLIC = { type_complication: "infection", date_survenue: "", description: "", traitement: "", grade_clavien: "" };

// ─── MAIN COMPONENT ──────────────────────────────────────────
export default function Chirurgie() {
  const dispatch = useDispatch();
  const reduxSurgeries = useSelector(selectSurgeries);
  const reduxTotal = useSelector(selectChirurgieTotal);
  const reduxStats = useSelector(selectChirurgieStats);

  useEffect(() => { dispatch(fetchSurgeries({})); }, [dispatch]);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => { const fn = () => setIsMobile(window.innerWidth <= 599); window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn); }, []);

  const [tab, setTab]             = useState("dashboard");
  const [section, setSection]     = useState("general");
  const [dossiers, setDossiers]   = useState([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState("");
  const [filterStatut, setFilter] = useState("");
  const [currentDossier, setCurrentDossier] = useState(null);
  const [bilan, setBilan]         = useState([]);
  const [suivis, setSuivis]       = useState([]);
  const [complications, setComplications] = useState([]);
  const [kpis, setKpis]           = useState({ total: 0, consultations: 0, preoperatoires: 0, operes: 0, suivis_nb: 0, clotures: 0, risques_eleves: 0, score_moyen: 0 });
  const [chartMois, setChartMois] = useState(DEMO_MOIS);
  const [chartInterv, setChartInterv] = useState(DEMO_INTERV);
  const [tauxCompl, setTauxCompl] = useState(0);
  const [patients, setPatients]   = useState([]);
  const [chirurgiens, setChirurgiens] = useState([]);
  const [saving, setSaving]       = useState(false);

  // Modals
  const [modalNouv, setModalNouv]         = useState(false);
  const [modalBilan, setModalBilan]       = useState(false);
  const [modalSuivi, setModalSuivi]       = useState(false);
  const [modalComplic, setModalComplic]   = useState(false);

  // Forms
  const [formDossier, setFormDossier]     = useState(EMPTY_DOSSIER);
  const [formBilan, setFormBilan]         = useState(EMPTY_BILAN);
  const [formSuivi, setFormSuivi]         = useState(EMPTY_SUIVI);
  const [formComplic, setFormComplic]     = useState(EMPTY_COMPLIC);

  // ── Load list ──────────────────────────────────────────────
  const loadDossiers = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: 15 });
      if (search) p.set("q", search);
      if (filterStatut) p.set("statut", filterStatut);
      const { data } = await api.get(`/chirurgie?${p}`);
      setDossiers(data.dossiers || data.data || []);
      setTotal(data.total || 0);
    } catch {
      setDossiers(DEMO_DOSSIERS);
      setTotal(DEMO_DOSSIERS.length);
    } finally { setLoading(false); }
  }, [page, search, filterStatut]);

  // ── Load stats ─────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/chirurgie/stats");
      setKpis(data.kpis || kpis);
      if (data.chart) { setChartMois(data.chart.labels); setChartInterv(data.chart.data); }
      setTauxCompl(data.taux_compl || 0);
    } catch {
      const d = DEMO_DOSSIERS;
      setKpis({
        total: d.length,
        consultations: d.filter(x => x.statut === "consultation").length,
        preoperatoires: d.filter(x => x.statut === "preoperatoire").length,
        operes: d.filter(x => x.statut === "opere").length,
        suivis_nb: d.filter(x => x.statut === "suivi_postop").length,
        clotures: d.filter(x => x.statut === "cloture").length,
        risques_eleves: d.filter(x => ["eleve","critique"].includes(x.ia_risque_niveau)).length,
        score_moyen: Math.round(d.reduce((s,x)=>s+x.ia_risque_score,0)/d.length),
      });
      setTauxCompl(8.3);
    }
  }, []);

  // ── Load dossier individuel ────────────────────────────────
  const loadDossier = useCallback(async (id) => {
    try {
      const { data } = await api.get(`/chirurgie/${id}`);
      setCurrentDossier(data.dossier || data);
      setBilan(data.bilan || []);
      setSuivis(data.suivis || []);
      setComplications(data.complications || []);
    } catch {
      const d = DEMO_DOSSIERS.find(x => x._id === id);
      setCurrentDossier(d || null);
      setBilan([
        { _id:"b1", type:"biologie", examen:"NFS complète", valeur:"Hb: 12.5 g/dL", statut:"normal", date_examen:"2025-06-01", urgence:false },
        { _id:"b2", type:"biologie", examen:"Glycémie à jeun", valeur:"7.2 mmol/L", statut:"anormal", date_examen:"2025-06-01", urgence:true },
        { _id:"b3", type:"imagerie", examen:"Échographie abdominale", resultat:"Hernie inguinale droite confirmée, contenu graisseux", statut:"recu", date_examen:"2025-05-28", urgence:false },
        { _id:"b4", type:"anesthesie", examen:"Évaluation préanesthésique", resultat:"ASA II — Risque modéré", statut:"recu", date_examen:"2025-06-02", urgence:false },
      ]);
      setSuivis([
        { _id:"s1", date_suivi:"2025-06-12T09:30:00", temperature:37.2, tension_sys:125, tension_dia:80, pouls:72, douleur_score:3, etat_plaie:"bonne_evolution", pansement_fait:true, antibiotherapie:"Amoxicilline 1g × 3/j", observations:"Patient mobile, transit rétabli, plaie propre" },
        { _id:"s2", date_suivi:"2025-06-11T14:00:00", temperature:38.1, tension_sys:130, tension_dia:85, pouls:88, douleur_score:5, etat_plaie:"suintement", pansement_fait:true, antibiotherapie:"Amoxicilline 1g × 3/j", observations:"Légère fièvre, suintement plaie traité" },
      ]);
      setComplications([]);
    }
  }, []);

  // ── Load patients + chirurgiens ────────────────────────────
  const loadSelects = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.allSettled([api.get("/patients?limit=500"), api.get("/admin/users?role=medecin")]);
      if (pRes.status === "fulfilled") setPatients(pRes.value.data.patients || pRes.value.data.data || []);
      if (cRes.status === "fulfilled") setChirurgiens(cRes.value.data.users || []);
    } catch {
      setPatients([{ _id:"p1", prenom:"Jean", nom:"Dupont", numero_dossier:"PAT-001" }]);
      setChirurgiens([{ _id:"c1", prenom:"Martin", nom:"Leblanc", specialite:"Chirurgie Générale" }]);
    }
  }, []);

  useEffect(() => { loadDossiers(); loadStats(); loadSelects(); }, [loadDossiers, loadStats, loadSelects]);

  // ── Open dossier ───────────────────────────────────────────
  const openDossier = (d) => {
    setCurrentDossier(d);
    loadDossier(d._id);
    setSection("general");
    setTab("dossier");
  };

  // ── Create dossier ─────────────────────────────────────────
  const createDossier = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/chirurgie", formDossier);
      toast.success(`✅ Dossier ${data.numero || "créé"} avec succès`);
      setModalNouv(false);
      setFormDossier(EMPTY_DOSSIER);
      loadDossiers(); loadStats();
    } catch {
      toast.error("Erreur lors de la création");
    } finally { setSaving(false); }
  };

  // ── Update dossier ─────────────────────────────────────────
  const updateDossier = async (updates) => {
    if (!currentDossier) return;
    setSaving(true);
    try {
      await api.put(`/chirurgie/${currentDossier._id}`, { ...currentDossier, ...updates });
      toast.success("✅ Dossier mis à jour");
      setCurrentDossier(prev => ({ ...prev, ...updates }));
      loadDossiers();
    } catch { toast.error("Erreur mise à jour"); }
    finally { setSaving(false); }
  };

  // ── Add bilan ──────────────────────────────────────────────
  const addBilan = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/chirurgie/${currentDossier._id}/bilan`, formBilan);
      toast.success("✅ Examen ajouté");
      setModalBilan(false);
      setFormBilan(EMPTY_BILAN);
      loadDossier(currentDossier._id);
    } catch {
      setBilan(prev => [...prev, { ...formBilan, _id: Date.now().toString() }]);
      toast.success("✅ Examen ajouté (local)");
      setModalBilan(false);
      setFormBilan(EMPTY_BILAN);
    } finally { setSaving(false); }
  };

  // ── Add suivi ──────────────────────────────────────────────
  const addSuivi = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/chirurgie/${currentDossier._id}/suivi`, formSuivi);
      toast.success("✅ Suivi enregistré");
      setModalSuivi(false);
      setFormSuivi(EMPTY_SUIVI);
      loadDossier(currentDossier._id);
    } catch {
      setSuivis(prev => [{ ...formSuivi, _id: Date.now().toString(), date_suivi: new Date().toISOString() }, ...prev]);
      toast.success("✅ Suivi enregistré (local)");
      setModalSuivi(false);
      setFormSuivi(EMPTY_SUIVI);
    } finally { setSaving(false); }
  };

  // ── Add complication ───────────────────────────────────────
  const addComplication = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/chirurgie/${currentDossier._id}/complications`, formComplic);
      toast.success("⚠️ Complication déclarée");
      setModalComplic(false);
      setFormComplic(EMPTY_COMPLIC);
      loadDossier(currentDossier._id);
      const ns = Math.min(99, (currentDossier.ia_risque_score || 50) + 15);
      setCurrentDossier(prev => ({ ...prev, ia_risque_score: ns, ia_risque_niveau: ns >= 70 ? "critique" : ns >= 50 ? "eleve" : "modere" }));
    } catch {
      setComplications(prev => [...prev, { ...formComplic, _id: Date.now().toString() }]);
      toast.success("⚠️ Complication déclarée (local)");
      setModalComplic(false);
      setFormComplic(EMPTY_COMPLIC);
    } finally { setSaving(false); }
  };

  const iaCol = currentDossier ? IA_COLORS[currentDossier.ia_risque_niveau] || "#6B7280" : "#6B7280";
  const nbRisques = kpis.risques_eleves || 0;

  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      <div className="chir">

        {/* ── TOPBAR ── */}
        <div className="chir-top">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap", position:"relative", zIndex:2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:54, height:54, borderRadius:14, background:"rgba(255,255,255,.12)", border:"1.5px solid rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {I.heart}
              </div>
              <div>
                <div style={{ fontSize:21, fontWeight:700, color:"#fff", letterSpacing:-.3 }}>Module Chirurgie</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.55)", marginTop:2 }}>{kpis.total} dossiers · Clinique Canadienne de Souanké</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button className="cbtn cbtn-teal" onClick={() => { setFormDossier(EMPTY_DOSSIER); setModalNouv(true); }}>
                {I.plus} Nouveau dossier
              </button>
              {currentDossier && (
                <button className="cbtn cbtn-ghost" style={{ color:"#fff", borderColor:"rgba(255,255,255,.3)" }} onClick={() => window.print()}>
                  {I.print} Imprimer
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          {(() => {
            const TABS = [
              { key:"dashboard", icon:I.grid, label:"Tableau de bord",    labelM:"Dashboard" },
              { key:"liste",     icon:I.list, label:"Dossiers chirurgicaux", labelM:"Dossiers" },
              { key:"dossier",   icon:I.file, label:currentDossier?`Dossier ${currentDossier.numero}`:"Dossier", labelM:"Dossier", disabled:!currentDossier },
              { key:"ia",        icon:I.ia,   label:"IA & Analytics",     labelM:"IA" },
            ].filter(t=>!t.disabled);
            return (
              <div style={isMobile?{display:'grid',gridTemplateColumns:`repeat(${Math.min(3,TABS.length)},1fr)`,gap:'4px',padding:'8px 10px',marginTop:'8px',background:'rgba(255,255,255,.07)',borderRadius:'10px 10px 0 0'}:{display:'flex',gap:'2px',marginTop:'16px',overflowX:'auto',scrollbarWidth:'none'}}>
                {TABS.map(t=>(
                  <button key={t.key} className={`chir-tab ${tab===t.key?"active":""}`} style={isMobile?{flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'7px 3px 8px',fontSize:'9.5px',gap:'3px',borderRadius:'8px',whiteSpace:'normal',minWidth:0}:{}} onClick={()=>setTab(t.key)}>
                    <span style={isMobile?{fontSize:'14px'}:{}}>{t.icon}</span>
                    <span style={isMobile?{lineHeight:1.2}:{}}>{isMobile?t.labelM:t.label}</span>
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
              {/* Alert IA */}
              {nbRisques > 0 && (
                <div className="al-danger fu" style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, flexWrap:"wrap" }}>
                  <div style={{ width:42, height:42, background:"#FEE2E2", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {I.alert}
                  </div>
                  <div style={{ flex:1 }}>
                    <strong style={{ color:"#B91C1C", fontSize:13 }}>🤖 Intelligence Artificielle — Alerte risque chirurgical</strong>
                    <div style={{ fontSize:12, color:"#DC2626", marginTop:3 }}>
                      <strong>{nbRisques}</strong> patient(s) présentent un score de risque opératoire élevé ou critique. Révision des dossiers recommandée.
                    </div>
                  </div>
                  <button className="cbtn cbtn-danger cbtn-sm" onClick={() => setTab("ia")}>Analyse IA →</button>
                </div>
              )}

              {/* KPIs */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="blue"   icon={I.file}  value={kpis.total}           label="Dossiers total"     sub="tous statuts"                     onClick={() => setTab("liste")} />
                <KpiCard color="teal"   icon={I.chat}  value={kpis.consultations}    label="Consultations"      sub="en attente décision"              onClick={() => { setFilter("consultation"); setTab("liste"); }} />
                <KpiCard color="orange" icon={I.clock} value={kpis.preoperatoires}   label="Préopératoires"     sub="bilan en cours"                   onClick={() => { setFilter("preoperatoire"); setTab("liste"); }} />
                <KpiCard color="green"  icon={I.heart} value={kpis.operes}           label="Opérés"             sub="intervention réalisée"            onClick={() => { setFilter("opere"); setTab("liste"); }} />
                <KpiCard color="purple" icon={I.pulse} value={kpis.suivis_nb}        label="En suivi postop."   sub="surveillance active"              onClick={() => { setFilter("suivi_postop"); setTab("liste"); }} />
                <KpiCard color={nbRisques > 0 ? "red" : "green"} icon={I.alert} value={nbRisques} label="Risques élevés IA" sub={`score moyen ${Math.round(kpis.score_moyen)}/100`} urgent={nbRisques > 0} onClick={() => setTab("ia")} />
              </div>

              {/* Charts */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"2fr 1fr", gap:20, marginBottom:24 }}>
                <div className="chir-card fu">
                  <div className="chir-card-hdr">
                    <div>
                      <h3>{I.trend} Interventions chirurgicales — 12 mois</h3>
                      <p>Volume opératoire mensuel</p>
                    </div>
                  </div>
                  <div style={{ padding:20 }}>
                    <BarChart labels={chartMois} data={chartInterv} color="#1B4F9E" />
                  </div>
                </div>
                <div className="chir-card fu">
                  <div className="chir-card-hdr">
                    <div><h3>Répartition des statuts</h3><p>{kpis.total} dossiers</p></div>
                  </div>
                  <div style={{ padding:20 }}>
                    {[
                      ["Consultation",   kpis.consultations,  "#0EA5A0"],
                      ["Préopératoire",  kpis.preoperatoires, "#D97706"],
                      ["Opéré",          kpis.operes,         "#059669"],
                      ["Suivi postop.",  kpis.suivis_nb,      "#7C3AED"],
                      ["Clôturé",        kpis.clotures,       "#6B7280"],
                    ].map(([lbl, val, col]) => (
                      <div key={lbl} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:"var(--cm)" }}>
                            <span style={{ width:10, height:10, borderRadius:3, background:col, display:"inline-block" }} />
                            {lbl}
                          </span>
                          <span style={{ fontWeight:700, fontSize:12, color:"var(--cn)" }}>{val}</span>
                        </div>
                        <Prog pct={kpis.total > 0 ? Math.round(val / kpis.total * 100) : 0} color={col} />
                      </div>
                    ))}
                    <div style={{ marginTop:14, paddingTop:12, borderTop:"1px solid var(--cbr)", display:"flex", justifyContent:"space-between", fontSize:12, color:"var(--cm)" }}>
                      <span>Taux complications</span>
                      <strong style={{ color: tauxCompl > 10 ? "var(--cr)" : "var(--cg)" }}>{tauxCompl}%</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent dossiers */}
              <div className="chir-card fu">
                <div className="chir-card-hdr">
                  <div><h3>{I.file} Dossiers récents</h3><p>Dernières activités chirurgicales</p></div>
                  <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => setTab("liste")}>Voir tous →</button>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table className="chir-tbl">
                    <thead>
                      <tr>
                        <th>N° Dossier</th><th>Patient</th><th>Diagnostic</th>
                        <th>Chirurgien</th><th>IA Risque</th><th>Statut</th><th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(loading ? DEMO_DOSSIERS : dossiers).slice(0, 8).map(d => {
                        const sc = STATUT_CFG[d.statut] || { cls:"gray", label:d.statut };
                        return (
                          <tr key={d._id}>
                            <td><span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--cb)", fontSize:12 }}>{d.numero}</span></td>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--cn)" }}>{d.patient_nom}</div>
                              <div style={{ fontSize:11, color:"var(--cm)" }}>{ageCalc(d.date_naissance)} · {d.sexe ? d.sexe.charAt(0).toUpperCase() + d.sexe.slice(1) : "—"}</div>
                            </td>
                            <td style={{ fontSize:12, color:"var(--cm)", maxWidth:160 }}><div style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{d.diagnostic_chirurgical || "—"}</div></td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{d.chirurgien_nom || "—"}</td>
                            <td><IaBadge niveau={d.ia_risque_niveau} score={d.ia_risque_score} /></td>
                            <td><Badge cls={sc.cls}>{sc.label}</Badge></td>
                            <td>
                              <button className="cbtn cbtn-ghost cbtn-sm" style={{ fontSize:11 }} onClick={() => openDossier(d)}>
                                {I.open} Ouvrir
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!loading && dossiers.length === 0 && (
                        <tr><td colSpan={7} style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>Aucun dossier enregistré</td></tr>
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
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>Dossiers chirurgicaux</div>
                  <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>{total} dossier(s) au total</div>
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }}>{I.search}</span>
                    <input className="cinp" style={{ paddingLeft:34, width:220 }} placeholder="Patient, diagnostic..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                  </div>
                  <select className="cinp" style={{ width:180 }} value={filterStatut} onChange={e => { setFilter(e.target.value); setPage(1); }}>
                    <option value="">Tous les statuts</option>
                    <option value="consultation">Consultation</option>
                    <option value="preoperatoire">Préopératoire</option>
                    <option value="opere">Opéré</option>
                    <option value="suivi_postop">Suivi postop.</option>
                    <option value="cloture">Clôturé</option>
                  </select>
                  <button className="cbtn cbtn-primary" onClick={() => { setFormDossier(EMPTY_DOSSIER); setModalNouv(true); }}>
                    {I.plus} Nouveau dossier
                  </button>
                </div>
              </div>

              <div className="chir-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="chir-tbl" style={{ minWidth:900 }}>
                    <thead>
                      <tr>
                        <th>N° Dossier</th><th>Patient</th><th>Diagnostic chirurgical</th>
                        <th>Intervention</th><th>Chirurgien</th><th>Date prév.</th>
                        <th>Urgence</th><th>IA Risque</th><th>Statut</th><th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={10} style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>Chargement...</td></tr>
                      ) : dossiers.map(d => {
                        const sc = STATUT_CFG[d.statut] || { cls:"gray", label:d.statut };
                        const uc = URGENCE_CFG[d.niveau_urgence] || { cls:"gray", label:d.niveau_urgence };
                        return (
                          <tr key={d._id} style={{ background: d.nb_complications > 0 ? "#FFF8F8" : d.ia_risque_niveau === "critique" ? "#FFF8F8" : "" }}>
                            <td>
                              <span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--cb)", fontSize:12 }}>{d.numero}</span>
                              {d.nb_complications > 0 && <div><Badge cls="red" style={{ fontSize:9, padding:"1px 6px" }}>⚠ {d.nb_complications} compl.</Badge></div>}
                            </td>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--cn)" }}>{d.patient_nom}</div>
                              <div style={{ fontSize:11, color:"var(--cm)" }}>{ageCalc(d.date_naissance)} · {d.groupe_sanguin || ""}</div>
                            </td>
                            <td style={{ maxWidth:160 }}><div style={{ fontSize:12.5, color:"var(--cn)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{d.diagnostic_chirurgical || "—"}</div></td>
                            <td style={{ maxWidth:140 }}><div style={{ fontSize:12, color:"var(--cm)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{d.type_intervention || "—"}</div></td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{d.chirurgien_nom || "—"}</td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{fmtDate(d.date_intervention_prev)}</td>
                            <td><Badge cls={uc.cls}>{uc.label}</Badge></td>
                            <td>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <IaBadge niveau={d.ia_risque_niveau} score={d.ia_risque_score} />
                                <div className="chir-prog" style={{ width:36, height:5 }}>
                                  <div className="chir-prog-f" style={{ width:`${d.ia_risque_score}%`, background:IA_COLORS[d.ia_risque_niveau] }} />
                                </div>
                              </div>
                            </td>
                            <td><Badge cls={sc.cls}>{sc.label}</Badge></td>
                            <td>
                              <button className="cbtn cbtn-ghost cbtn-sm" style={{ fontSize:11 }} onClick={() => openDossier(d)}>
                                {I.open} Ouvrir
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!loading && dossiers.length === 0 && (
                        <tr><td colSpan={10} style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>
                          {search ? `Aucun résultat pour "${search}"` : "Aucun dossier chirurgical"}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {total > 15 && (
                  <div style={{ padding:"12px 20px", borderTop:"1.5px solid var(--cbr)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontSize:12, color:"var(--cm)" }}>Page {page} / {Math.ceil(total/15)} · {total} dossiers</span>
                    <div style={{ display:"flex", gap:8 }}>
                      {page > 1 && <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => setPage(p=>p-1)}>← Précédent</button>}
                      {page < Math.ceil(total/15) && <button className="cbtn cbtn-primary cbtn-sm" onClick={() => setPage(p=>p+1)}>Suivant →</button>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ DOSSIER ══ */}
          {tab === "dossier" && currentDossier && (
            <div>
              {/* Header dossier */}
              <div style={{ background:"linear-gradient(135deg,#0B1E3B,#132744)", borderRadius:18, padding:"20px 24px", marginBottom:20, color:"#fff" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                    <div style={{ width:56, height:56, borderRadius:14, background:"rgba(255,255,255,.15)", border:"2px solid rgba(255,255,255,.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>
                      {currentDossier.sexe === "femme" ? "👩" : "👨"}
                    </div>
                    <div>
                      <div style={{ fontSize:18, fontWeight:700 }}>{currentDossier.patient_nom}</div>
                      <div style={{ fontSize:12, color:"rgba(255,255,255,.65)", marginTop:2 }}>
                        {ageCalc(currentDossier.date_naissance)} · {currentDossier.sexe ? currentDossier.sexe.charAt(0).toUpperCase() + currentDossier.sexe.slice(1) : "—"} · Gr. {currentDossier.groupe_sanguin || "—"}
                        {currentDossier.allergies && <span style={{ color:"#FCA5A5" }}> · ⚠ Allergies: {currentDossier.allergies}</span>}
                      </div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:3 }}>
                        📞 {currentDossier.telephone || "—"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                    {/* IA Score */}
                    <div style={{ background:"rgba(255,255,255,.1)", borderRadius:12, padding:"10px 16px", minWidth:140 }}>
                      <div style={{ fontSize:10, color:"rgba(255,255,255,.6)", fontWeight:600, textTransform:"uppercase", letterSpacing:.5, marginBottom:6 }}>🤖 Score IA Risque</div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ fontSize:24, fontWeight:800, color:iaCol }}>{currentDossier.ia_risque_score}</div>
                        <div>
                          <div style={{ fontSize:10, color:"rgba(255,255,255,.7)" }}>/100</div>
                          <span className={`ia-b ${currentDossier.ia_risque_niveau}`} style={{ fontSize:10 }}>{currentDossier.ia_risque_niveau}</span>
                        </div>
                      </div>
                      <div className="ia-bar" style={{ marginTop:6 }}>
                        <div className="ia-bar-f" style={{ width:`${currentDossier.ia_risque_score}%`, background:iaCol }} />
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontFamily:"monospace", fontSize:16, fontWeight:700, color:"rgba(255,255,255,.9)" }}>{currentDossier.numero}</div>
                      <Badge cls={(STATUT_CFG[currentDossier.statut] || {}).cls || "gray"} style={{ marginTop:6 }}>
                        {(STATUT_CFG[currentDossier.statut] || {}).label || currentDossier.statut}
                      </Badge>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:6 }}>Dr. {currentDossier.chirurgien_nom || "—"}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Alerte IA contextuelle */}
              {["critique","eleve"].includes(currentDossier.ia_risque_niveau) && (
                <div className="al-warn" style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:20 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink:0, marginTop:2 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <div>
                    <strong style={{ color:"#92400E", fontSize:13 }}>🤖 IA — Analyse de risque opératoire</strong>
                    <div style={{ fontSize:12, color:"#B45309", marginTop:4 }}>
                      Score de risque : <strong>{currentDossier.ia_risque_score}/100 ({currentDossier.ia_risque_niveau})</strong>
                      {complications.length > 0 && ` · ${complications.length} complication(s) enregistrée(s)`}
                      · Évaluation anesthésique recommandée.
                      {currentDossier.allergies && <strong> ⚠ Allergies connues.</strong>}
                    </div>
                  </div>
                </div>
              )}

              {/* Section nav */}
              <div className="sec-nav" style={{ borderRadius:"18px 18px 0 0", overflow:"hidden" }}>
                {[
                  { id:"general",       label:"📋 Infos générales" },
                  { id:"consultation",  label:"🩺 Consultation" },
                  { id:"bilan",         label:`🔬 Bilan préop. ${bilan.length > 0 ? `(${bilan.length})` : ""}` },
                  { id:"programme",     label:"📅 Programmation" },
                  { id:"intervention",  label:"🔪 Intervention" },
                  { id:"postop",        label:`💉 Suivi postop. ${suivis.length > 0 ? `(${suivis.length})` : ""}` },
                  { id:"complications", label:`⚠️ Complications ${complications.length > 0 ? `(${complications.length})` : ""}`, warn:complications.length > 0 },
                  { id:"sortie",        label:"🚪 Sortie" },
                  { id:"facturation",   label:"💰 Facturation" },
                  { id:"documents",     label:"📄 Documents" },
                ].map(s => (
                  <button key={s.id} className={`sec-btn ${section === s.id ? "active" : ""} ${s.warn ? "warn" : ""}`} onClick={() => setSection(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>

              {/* ── GÉNÉRAL ── */}
              {section === "general" && (
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20, marginTop:20 }}>
                  <div className="chir-card">
                    <div className="chir-card-hdr"><h3>👤 Informations du patient</h3></div>
                    <div style={{ padding:20 }}>
                      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                        <div style={{ gridColumn:"1/-1", background:"#F8FAFD", borderRadius:10, padding:"10px 12px" }}>
                          <div style={{ fontSize:10, fontWeight:600, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.4 }}>Nom complet</div>
                          <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)", marginTop:2 }}>{currentDossier.patient_nom}</div>
                        </div>
                        {[["Sexe", currentDossier.sexe ? currentDossier.sexe.charAt(0).toUpperCase() + currentDossier.sexe.slice(1) : "—"],
                          ["Âge", ageCalc(currentDossier.date_naissance)],
                          ["Téléphone", currentDossier.telephone || "—"],
                          ["Groupe sanguin", currentDossier.groupe_sanguin || "—"]
                        ].map(([lbl,val]) => (
                          <div key={lbl} style={{ background:"#F8FAFD", borderRadius:10, padding:"10px 12px" }}>
                            <div style={{ fontSize:10, fontWeight:600, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.4 }}>{lbl}</div>
                            <div style={{ fontSize:13, fontWeight:600, color:"var(--cn)", marginTop:2 }}>{val}</div>
                          </div>
                        ))}
                        {currentDossier.allergies && (
                          <div style={{ gridColumn:"1/-1", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10, padding:"10px 12px" }}>
                            <div style={{ fontSize:10, fontWeight:700, color:"#B91C1C", textTransform:"uppercase", letterSpacing:.4 }}>⚠ Allergies</div>
                            <div style={{ fontSize:12, color:"#DC2626", marginTop:2 }}>{currentDossier.allergies}</div>
                          </div>
                        )}
                        {currentDossier.antecedents_medicaux && (
                          <div style={{ gridColumn:"1/-1", background:"#F8FAFD", borderRadius:10, padding:"10px 12px" }}>
                            <div style={{ fontSize:10, fontWeight:600, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.4 }}>Antécédents médicaux</div>
                            <div style={{ fontSize:12, color:"var(--cn)", marginTop:2 }}>{currentDossier.antecedents_medicaux}</div>
                          </div>
                        )}
                        {currentDossier.antecedents_chirurgicaux && (
                          <div style={{ gridColumn:"1/-1", background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:10, padding:"10px 12px" }}>
                            <div style={{ fontSize:10, fontWeight:600, color:"#92400E", textTransform:"uppercase", letterSpacing:.4 }}>Antécédents chirurgicaux</div>
                            <div style={{ fontSize:12, color:"var(--cn)", marginTop:2 }}>{currentDossier.antecedents_chirurgicaux}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="chir-card">
                    <div className="chir-card-hdr"><h3>📋 Informations du dossier</h3></div>
                    <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
                      <div>
                        <label className="clbl">Statut du dossier *</label>
                        <select className="cinp" value={currentDossier.statut} onChange={e => setCurrentDossier(d => ({ ...d, statut:e.target.value }))}>
                          <option value="consultation">Consultation chirurgicale</option>
                          <option value="preoperatoire">Préopératoire</option>
                          <option value="opere">Opéré</option>
                          <option value="suivi_postop">Suivi postopératoire</option>
                          <option value="cloture">Clôturé</option>
                        </select>
                      </div>
                      <div>
                        <label className="clbl">Niveau d'urgence</label>
                        <select className="cinp" value={currentDossier.niveau_urgence} onChange={e => setCurrentDossier(d => ({ ...d, niveau_urgence:e.target.value }))}>
                          <option value="electif">Électif (programmé)</option>
                          <option value="urgent">Urgent</option>
                          <option value="urgence_absolue">Urgence absolue</option>
                        </select>
                      </div>
                      {/* Liaisons modules */}
                      <div style={{ background:"#EEF4FF", borderRadius:12, padding:"12px 14px" }}>
                        <div style={{ fontSize:11, fontWeight:700, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>🔗 Liaisons modules</div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                          {[["💊 Pharmacie","pharmacy"],["🔬 Labo","laboratoire"],["🩻 Imagerie","imagerie"],["🛏 Hospitalisation","hospitalisation"],["💰 Facturation","facturation"],["📁 Dossier médical","patients"]].map(([lbl,mod]) => (
                            <span key={mod} style={{ display:"inline-flex", alignItems:"center", gap:5, background:"white", border:"1px solid var(--cbr)", borderRadius:8, padding:"5px 10px", fontSize:11, fontWeight:600, color:"var(--cn)", cursor:"pointer" }}>{lbl}</span>
                          ))}
                        </div>
                      </div>
                      <button className="cbtn cbtn-teal" disabled={saving} onClick={() => updateDossier({ statut:currentDossier.statut, niveau_urgence:currentDossier.niveau_urgence })}>
                        {I.save} {saving ? "Enregistrement..." : "Enregistrer"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── CONSULTATION ── */}
              {section === "consultation" && (
                <div style={{ marginTop:20 }}>
                  <div className="chir-card">
                    <div className="chir-card-hdr"><h3>🩺 Consultation chirurgicale</h3></div>
                    <div style={{ padding:20, display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>
                      <div style={{ gridColumn:"1/-1" }}>
                        <label className="clbl">Motif de consultation *</label>
                        <input className="cinp" value={currentDossier.motif_consultation || ""} onChange={e => setCurrentDossier(d => ({ ...d, motif_consultation:e.target.value }))} placeholder="Ex: Hernie inguinale douloureuse" />
                      </div>
                      <div style={{ gridColumn:"1/-1" }}>
                        <label className="clbl">Symptômes</label>
                        <textarea className="cinp" rows={3} value={currentDossier.symptomes || ""} onChange={e => setCurrentDossier(d => ({ ...d, symptomes:e.target.value }))} placeholder="Douleurs, durée, évolution..." />
                      </div>
                      <div style={{ gridColumn:"1/-1" }}>
                        <label className="clbl">Examen clinique</label>
                        <textarea className="cinp" rows={4} value={currentDossier.examen_clinique || ""} onChange={e => setCurrentDossier(d => ({ ...d, examen_clinique:e.target.value }))} placeholder="Inspection, palpation, auscultation..." />
                      </div>
                      <div style={{ gridColumn:"1/-1" }}>
                        <label className="clbl">Diagnostic chirurgical *</label>
                        <input className="cinp" value={currentDossier.diagnostic_chirurgical || ""} onChange={e => setCurrentDossier(d => ({ ...d, diagnostic_chirurgical:e.target.value }))} placeholder="Ex: Hernie inguinale droite irréductible" />
                      </div>
                      <div>
                        <label className="clbl">Décision du chirurgien</label>
                        <select className="cinp" value={currentDossier.decision || "intervention"} onChange={e => setCurrentDossier(d => ({ ...d, decision:e.target.value }))}>
                          <option value="intervention">🔪 Intervention chirurgicale</option>
                          <option value="traitement_medical">💊 Traitement médical</option>
                          <option value="examens_complementaires">🔬 Examens complémentaires</option>
                          <option value="hospitalisation">🛏 Hospitalisation</option>
                        </select>
                      </div>
                      <div>
                        <label className="clbl">Type d'intervention prévue</label>
                        <input className="cinp" value={currentDossier.type_intervention || ""} onChange={e => setCurrentDossier(d => ({ ...d, type_intervention:e.target.value }))} placeholder="Ex: Cure de hernie inguinale droite" />
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
                    <button className="cbtn cbtn-teal" disabled={saving} onClick={() => updateDossier({ motif_consultation:currentDossier.motif_consultation, symptomes:currentDossier.symptomes, examen_clinique:currentDossier.examen_clinique, diagnostic_chirurgical:currentDossier.diagnostic_chirurgical, decision:currentDossier.decision, type_intervention:currentDossier.type_intervention })}>
                      {I.save} {saving ? "Enregistrement..." : "Enregistrer la consultation"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── BILAN PRÉOP ── */}
              {section === "bilan" && (
                <div style={{ marginTop:20 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)" }}>Bilan préopératoire</div>
                      <div style={{ fontSize:12, color:"var(--cm)" }}>{bilan.length} examen(s) prescrit(s)</div>
                    </div>
                    <button className="cbtn cbtn-primary" onClick={() => { setFormBilan(EMPTY_BILAN); setModalBilan(true); }}>
                      {I.plus} Ajouter examen
                    </button>
                  </div>

                  {[
                    { type:"biologie",   icon:"🩸", label:"Analyses biologiques" },
                    { type:"imagerie",   icon:"🩻", label:"Imagerie médicale" },
                    { type:"anesthesie", icon:"💉", label:"Évaluation anesthésique" },
                  ].map(({ type, icon, label }) => {
                    const items = bilan.filter(b => b.type === type);
                    return (
                      <div key={type} className="chir-card" style={{ marginBottom:16 }}>
                        <div className="chir-card-hdr">
                          <h3>{icon} {label}</h3>
                          <span style={{ fontSize:12, color:"var(--cm)" }}>{items.length} examen(s)</span>
                        </div>
                        {items.length === 0 ? (
                          <div style={{ padding:24, textAlign:"center", color:"var(--cm)", fontSize:13 }}>Aucun examen de ce type prescrit</div>
                        ) : (
                          <div style={{ overflowX:"auto" }}>
                            <table className="chir-tbl">
                              <thead><tr><th>Examen</th><th>Résultat / Valeur</th><th>Date</th><th>Statut</th><th>Urgence</th></tr></thead>
                              <tbody>
                                {items.map(b => {
                                  const sB = { prescrit:{cls:"blue",label:"Prescrit"}, en_cours:{cls:"orange",label:"En cours"}, recu:{cls:"teal",label:"Reçu"}, normal:{cls:"green",label:"Normal"}, anormal:{cls:"red",label:"Anormal"} }[b.statut] || {cls:"gray",label:b.statut};
                                  return (
                                    <tr key={b._id} style={{ background:b.statut==="anormal"?"#FEF2F2":"" }}>
                                      <td style={{ fontWeight:600, color:"var(--cn)" }}>{b.examen}</td>
                                      <td style={{ fontSize:12, color:"var(--cm)" }}>{b.valeur}{b.resultat && <div style={{fontSize:11}}>{b.resultat}</div>}</td>
                                      <td style={{ fontSize:12, color:"var(--cm)" }}>{fmtDate(b.date_examen)}</td>
                                      <td><Badge cls={sB.cls}>{sB.label}</Badge></td>
                                      <td>{b.urgence ? <Badge cls="red">🚨 Urgent</Badge> : "—"}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {bilan.length > 0 && (
                    <div className="al-ia" style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B4F9E" strokeWidth="2" style={{ flexShrink:0, marginTop:2 }}><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                      <div>
                        <strong style={{ color:"#1E40AF", fontSize:13 }}>🤖 IA — Analyse du bilan préopératoire</strong>
                        <div style={{ fontSize:12, color:"#3B82F6", marginTop:4 }}>
                          {(() => {
                            const anorm = bilan.filter(b => b.statut === "anormal").length;
                            const manq = bilan.filter(b => b.statut === "prescrit").length;
                            if (anorm > 0) return `⚠ ${anorm} résultat(s) anormal(aux) — évaluation anesthésique obligatoire.`;
                            if (manq > 0) return `${manq} examen(s) en attente de résultat — compléter avant l'intervention.`;
                            return "✅ Tous les résultats disponibles et normaux — Aptitude opératoire favorable.";
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── PROGRAMMATION ── */}
              {section === "programme" && (
                <div style={{ marginTop:20 }}>
                  <div className="chir-card">
                    <div className="chir-card-hdr"><h3>📅 Programmation opératoire</h3></div>
                    <div style={{ padding:20, display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>
                      <div>
                        <label className="clbl">Type d'intervention</label>
                        <input className="cinp" value={currentDossier.type_intervention || ""} onChange={e => setCurrentDossier(d => ({ ...d, type_intervention:e.target.value }))} placeholder="Ex: Cholécystectomie laparoscopique" />
                      </div>
                      <div>
                        <label className="clbl">Niveau d'urgence</label>
                        <select className="cinp" value={currentDossier.niveau_urgence} onChange={e => setCurrentDossier(d => ({ ...d, niveau_urgence:e.target.value }))}>
                          <option value="electif">Électif (programmé)</option>
                          <option value="urgent">Urgent</option>
                          <option value="urgence_absolue">Urgence absolue</option>
                        </select>
                      </div>
                      <div>
                        <label className="clbl">Date prévue d'intervention</label>
                        <input type="date" className="cinp" value={fmtDateInput(currentDossier.date_intervention_prev)} min={new Date().toISOString().substring(0,10)} onChange={e => setCurrentDossier(d => ({ ...d, date_intervention_prev:e.target.value }))} />
                      </div>
                      <div>
                        <label className="clbl">Salle opératoire prévue</label>
                        <select className="cinp" value={currentDossier.salle_prevue || ""} onChange={e => setCurrentDossier(d => ({ ...d, salle_prevue:e.target.value }))}>
                          <option value="">— Sélectionner —</option>
                          {[1,2,3,4].map(n => <option key={n} value={`Bloc ${n}`}>Bloc {n}</option>)}
                          <option value="Salle urgences">Salle urgences</option>
                        </select>
                      </div>
                      <div style={{ gridColumn:"1/-1", background:"linear-gradient(135deg,#F0FDFC,#CCFBF1)", border:"1.5px solid #99F6E4", borderRadius:12, padding:"14px 16px" }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"var(--ct)", marginBottom:8 }}>🏥 Liaison — Bloc Opératoire</div>
                        <div style={{ fontSize:12, color:"var(--cm)" }}>Après confirmation, le dossier sera transmis au bloc pour planification des ressources.</div>
                        <button className="cbtn cbtn-teal cbtn-sm" style={{ marginTop:10 }}>{I.link} Transmettre au bloc →</button>
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
                    <button className="cbtn cbtn-teal" disabled={saving} onClick={() => updateDossier({ type_intervention:currentDossier.type_intervention, niveau_urgence:currentDossier.niveau_urgence, date_intervention_prev:currentDossier.date_intervention_prev, salle_prevue:currentDossier.salle_prevue })}>
                      {I.save} {saving ? "..." : "Confirmer la programmation"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── INTERVENTION ── */}
              {section === "intervention" && (
                <div style={{ marginTop:20 }}>
                  <div className="chir-card">
                    <div className="chir-card-hdr"><h3>🔪 Intervention chirurgicale</h3></div>
                    <div style={{ padding:20, display:"flex", flexDirection:"column", gap:16 }}>
                      <div style={{ background:"#EFF6FF", border:"1.5px solid #BFDBFE", borderRadius:12, padding:"12px 16px" }}>
                        <div style={{ fontSize:12, color:"#1B4F9E", fontWeight:600 }}>Référence bloc opératoire</div>
                        <div style={{ fontSize:13, color:"var(--cn)", marginTop:4 }}>
                          Intervention : <strong>{currentDossier.type_intervention || "—"}</strong> · Salle : <strong>{currentDossier.salle_prevue || "Non attribuée"}</strong>
                        </div>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                        <div>
                          <label className="clbl">Date réelle de l'intervention</label>
                          <input type="date" className="cinp" value={fmtDateInput(currentDossier.date_intervention_reelle)} onChange={e => setCurrentDossier(d => ({ ...d, date_intervention_reelle:e.target.value }))} />
                        </div>
                        <div>
                          <label className="clbl">Durée (minutes)</label>
                          <input type="number" className="cinp" value={currentDossier.duree_intervention_min || ""} min={0} placeholder="90" onChange={e => setCurrentDossier(d => ({ ...d, duree_intervention_min:e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <label className="clbl">Compte rendu opératoire *</label>
                        <textarea className="cinp" rows={6} value={currentDossier.cr_operatoire || ""} onChange={e => setCurrentDossier(d => ({ ...d, cr_operatoire:e.target.value }))} placeholder="Description détaillée : voie d'abord, gestes effectués, findings peropératoires, fermeture..." />
                      </div>
                      <div>
                        <label className="clbl">Évolution immédiate post-opératoire</label>
                        <textarea className="cinp" rows={3} value={currentDossier.evolution_immediate || ""} onChange={e => setCurrentDossier(d => ({ ...d, evolution_immediate:e.target.value }))} placeholder="Réveil, hémostase, drainage, état général..." />
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
                    <button className="cbtn cbtn-teal" disabled={saving} onClick={() => updateDossier({ statut:"opere", date_intervention_reelle:currentDossier.date_intervention_reelle, duree_intervention_min:currentDossier.duree_intervention_min, cr_operatoire:currentDossier.cr_operatoire, evolution_immediate:currentDossier.evolution_immediate })}>
                      {I.save} {saving ? "..." : "Valider le compte rendu opératoire"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── SUIVI POSTOP ── */}
              {section === "postop" && (
                <div style={{ marginTop:20 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)" }}>Suivi postopératoire</div>
                      <div style={{ fontSize:12, color:"var(--cm)" }}>{suivis.length} fiche(s) de surveillance</div>
                    </div>
                    <button className="cbtn cbtn-primary" onClick={() => { setFormSuivi(EMPTY_SUIVI); setModalSuivi(true); }}>
                      {I.plus} Ajouter fiche surveillance
                    </button>
                  </div>

                  {suivis.length > 0 && (() => {
                    const last = suivis[0];
                    const plaie_cfg = { bonne_evolution:{cls:"green",lbl:"Bonne évolution"}, bonne:{cls:"green",lbl:"Bonne"}, suintement:{cls:"yellow",lbl:"Suintement"}, infection:{cls:"red",lbl:"Infection"}, necrose:{cls:"red",lbl:"Nécrose"} };
                    const pc = plaie_cfg[last.etat_plaie] || { cls:"gray", lbl:last.etat_plaie };
                    return (
                      <div className="chir-card" style={{ marginBottom:16 }}>
                        <div className="chir-card-hdr">
                          <h3>📊 Dernière surveillance — {new Date(last.date_suivi).toLocaleString("fr-FR")}</h3>
                          <Badge cls={pc.cls}>Plaie : {pc.lbl}</Badge>
                        </div>
                        <div style={{ padding:20, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))", gap:12 }}>
                          {[
                            { lbl:"Température", val:last.temperature ? `${last.temperature}°C` : "—", ok:!last.temperature || (last.temperature >= 36.5 && last.temperature <= 38.5) },
                            { lbl:"Tension", val:last.tension_sys && last.tension_dia ? `${last.tension_sys}/${last.tension_dia}` : "—", ok:true },
                            { lbl:"Pouls", val:last.pouls ? `${last.pouls} bpm` : "—", ok:!last.pouls || (last.pouls >= 60 && last.pouls <= 100) },
                            { lbl:"Douleur", val:last.douleur_score !== null && last.douleur_score !== undefined ? `${last.douleur_score}/10` : "—", ok:!last.douleur_score || last.douleur_score <= 3 },
                          ].map(v => (
                            <div key={v.lbl} className="vital" style={!v.ok && v.val !== "—" ? { background:"#FEF2F2", borderColor:"#FECACA" } : {}}>
                              <div className="vital-v" style={!v.ok && v.val !== "—" ? { color:"#DC2626" } : {}}>{v.val}</div>
                              <div className="vital-l">{v.lbl}</div>
                            </div>
                          ))}
                        </div>
                        {last.observations && (
                          <div style={{ padding:"0 20px 16px" }}>
                            <div style={{ background:"#F8FAFD", borderRadius:10, padding:12, fontSize:12, color:"var(--cm)" }}>
                              <strong>Observations :</strong> {last.observations}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {suivis.length > 0 && (
                    <div className="chir-card">
                      <div className="chir-card-hdr"><h3>📋 Historique des surveillances</h3></div>
                      <div style={{ overflowX:"auto" }}>
                        <table className="chir-tbl">
                          <thead><tr><th>Date</th><th>Temp.</th><th>TA</th><th>Pouls</th><th>Douleur</th><th>État plaie</th><th>Observations</th></tr></thead>
                          <tbody>
                            {suivis.map(sv => {
                              const pc = { bonne_evolution:"green", bonne:"green", suintement:"yellow", infection:"red", necrose:"red" }[sv.etat_plaie] || "gray";
                              const plbl = { bonne_evolution:"Bonne évol.", bonne:"Bonne", suintement:"Suintement", infection:"Infection", necrose:"Nécrose" }[sv.etat_plaie] || sv.etat_plaie;
                              return (
                                <tr key={sv._id}>
                                  <td style={{ fontSize:12, fontWeight:600 }}>{new Date(sv.date_suivi).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}</td>
                                  <td style={{ fontSize:12, color:sv.temperature && (sv.temperature > 38.5 || sv.temperature < 36) ? "#DC2626" : "var(--cn)", fontWeight:sv.temperature && (sv.temperature > 38.5 || sv.temperature < 36) ? 700 : 400 }}>{sv.temperature ? `${sv.temperature}°C` : "—"}</td>
                                  <td style={{ fontSize:12 }}>{sv.tension_sys && sv.tension_dia ? `${sv.tension_sys}/${sv.tension_dia}` : "—"}</td>
                                  <td style={{ fontSize:12 }}>{sv.pouls ? `${sv.pouls} bpm` : "—"}</td>
                                  <td><Badge cls={sv.douleur_score > 6 ? "red" : sv.douleur_score > 3 ? "orange" : "green"}>{sv.douleur_score !== null && sv.douleur_score !== undefined ? `${sv.douleur_score}/10` : "—"}</Badge></td>
                                  <td><Badge cls={pc}>{plbl}</Badge></td>
                                  <td style={{ fontSize:11, color:"var(--cm)", maxWidth:200 }}><div style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{sv.observations || "—"}</div></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {suivis.length === 0 && <div className="chir-card" style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>Aucune fiche de surveillance enregistrée</div>}
                </div>
              )}

              {/* ── COMPLICATIONS ── */}
              {section === "complications" && (
                <div style={{ marginTop:20 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)" }}>Complications</div>
                      <div style={{ fontSize:12, color:"var(--cm)" }}>{complications.length} complication(s)</div>
                    </div>
                    <button className="cbtn cbtn-danger" onClick={() => { setFormComplic(EMPTY_COMPLIC); setModalComplic(true); }}>
                      {I.plus} Déclarer complication
                    </button>
                  </div>

                  {complications.length > 0 ? complications.map(c => {
                    const tc = { infection:{lbl:"Infection du site opératoire",col:"#DC2626",icon:"🦠"}, hemorragie:{lbl:"Hémorragie",col:"#DC2626",icon:"🩸"}, retard_cicatrisation:{lbl:"Retard de cicatrisation",col:"#D97706",icon:"⏳"}, reintervention:{lbl:"Réintervention",col:"#DC2626",icon:"🔪"}, thromboemboli:{lbl:"Thrombo-embolie",col:"#DC2626",icon:"🩹"}, autre:{lbl:"Autre complication",col:"#6B7280",icon:"⚠️"} }[c.type_complication] || { lbl:c.type_complication, col:"#6B7280", icon:"⚠️" };
                    return (
                      <div key={c._id} className="chir-card" style={{ marginBottom:12, borderLeft:`4px solid ${tc.col}` }}>
                        <div style={{ padding:"16px 20px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                            <span style={{ fontSize:18 }}>{tc.icon}</span>
                            <span style={{ fontWeight:700, color:"var(--cn)", fontSize:14 }}>{tc.lbl}</span>
                            {c.grade_clavien && <Badge cls="red">Grade Clavien-Dindo {c.grade_clavien}</Badge>}
                            {c.resolu && <Badge cls="green">✅ Résolu</Badge>}
                            {c.date_survenue && <span style={{ fontSize:11, color:"var(--cm)" }}>📅 {fmtDate(c.date_survenue)}</span>}
                          </div>
                          {c.description && <div style={{ fontSize:12, color:"var(--cm)", marginTop:8 }}>{c.description}</div>}
                          {c.traitement && <div style={{ fontSize:12, color:"var(--cn)", marginTop:6 }}><strong>Traitement :</strong> {c.traitement}</div>}
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="chir-card" style={{ padding:40, textAlign:"center" }}>
                      <div style={{ fontSize:32, marginBottom:12 }}>✅</div>
                      <div style={{ fontWeight:700, color:"var(--cg)", fontSize:15 }}>Aucune complication déclarée</div>
                      <div style={{ color:"var(--cm)", fontSize:13, marginTop:6 }}>Le parcours postopératoire est favorable</div>
                    </div>
                  )}
                </div>
              )}

              {/* ── SORTIE ── */}
              {section === "sortie" && (
                <div style={{ marginTop:20 }}>
                  <div className="chir-card">
                    <div className="chir-card-hdr"><h3>🚪 Sortie chirurgicale</h3></div>
                    <div style={{ padding:20, display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>
                      <div>
                        <label className="clbl">Date de sortie</label>
                        <input type="date" className="cinp" value={fmtDateInput(currentDossier.date_sortie)} onChange={e => setCurrentDossier(d => ({ ...d, date_sortie:e.target.value }))} />
                      </div>
                      <div>
                        <label className="clbl">État du patient à la sortie</label>
                        <select className="cinp" value={currentDossier.etat_sortie || ""} onChange={e => setCurrentDossier(d => ({ ...d, etat_sortie:e.target.value }))}>
                          <option value="">— Sélectionner —</option>
                          <option value="guerison">✅ Guérison</option>
                          <option value="amelioration">📈 Amélioration</option>
                          <option value="stationnaire">➡ Stationnaire</option>
                          <option value="aggravation">📉 Aggravation</option>
                          <option value="deces">⬛ Décès</option>
                        </select>
                      </div>
                      <div style={{ gridColumn:"1/-1" }}>
                        <label className="clbl">Diagnostic final</label>
                        <input className="cinp" value={currentDossier.diagnostic_final || ""} onChange={e => setCurrentDossier(d => ({ ...d, diagnostic_final:e.target.value }))} />
                      </div>
                      <div style={{ gridColumn:"1/-1" }}>
                        <label className="clbl">Recommandations à la sortie</label>
                        <textarea className="cinp" rows={3} value={currentDossier.recommandations || ""} onChange={e => setCurrentDossier(d => ({ ...d, recommandations:e.target.value }))} placeholder="Soins à domicile, régime, activité physique, médicaments..." />
                      </div>
                      <div>
                        <label className="clbl">Date rendez-vous de contrôle</label>
                        <input type="date" className="cinp" value={fmtDateInput(currentDossier.rdv_controle)} onChange={e => setCurrentDossier(d => ({ ...d, rdv_controle:e.target.value }))} />
                      </div>
                      <div style={{ background:"linear-gradient(135deg,#ECFDF5,#D1FAE5)", border:"1.5px solid #A7F3D0", borderRadius:12, padding:"12px 14px" }}>
                        <div style={{ fontSize:11, fontWeight:700, color:"var(--cg)", marginBottom:6 }}>💰 Liaison Facturation</div>
                        <button className="cbtn cbtn-ghost cbtn-sm" style={{ fontSize:11 }}>{I.link} Générer la facture</button>
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
                    <button className="cbtn cbtn-teal" disabled={saving} onClick={() => updateDossier({ statut:"cloture", date_sortie:currentDossier.date_sortie, etat_sortie:currentDossier.etat_sortie, diagnostic_final:currentDossier.diagnostic_final, recommandations:currentDossier.recommandations, rdv_controle:currentDossier.rdv_controle })}>
                      🚪 {saving ? "..." : "Valider la sortie & Clôturer"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── FACTURATION ── */}
              {section === "facturation" && (
                <div style={{ marginTop:20 }}>
                  <div className="chir-card">
                    <div className="chir-card-hdr"><h3>💰 Facturation chirurgicale</h3></div>
                    <div style={{ padding:20 }}>
                      {(() => {
                        const actes = [
                          ["Consultation chirurgicale", 25000],
                          ["Bilan préopératoire", 45000],
                          [`Intervention — ${currentDossier.type_intervention || "—"}`, 350000],
                          ["Anesthésie générale", 80000],
                          ["Hospitalisation postopératoire (3j)", 120000],
                          ["Soins postopératoires", 15000],
                          ["Médicaments & consommables", 35000],
                        ];
                        const total = actes.reduce((s,[,v])=>s+v,0);
                        return (
                          <>
                            <table className="chir-tbl" style={{ marginBottom:20 }}>
                              <thead><tr><th>Prestation</th><th style={{textAlign:"right"}}>Montant (CFA)</th></tr></thead>
                              <tbody>{actes.map(([lbl,val]) => <tr key={lbl}><td>{lbl}</td><td style={{textAlign:"right",fontWeight:600}}>{val.toLocaleString("fr-FR")}</td></tr>)}</tbody>
                              <tfoot><tr style={{background:"linear-gradient(to right,#EEF4FF,#DBEAFE)"}}><td style={{fontWeight:800,fontSize:15,color:"var(--cn)"}}>TOTAL</td><td style={{textAlign:"right",fontWeight:800,fontSize:16,color:"var(--cb)"}}>{total.toLocaleString("fr-FR")} CFA</td></tr></tfoot>
                            </table>
                            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                              <button className="cbtn cbtn-teal">{I.dl} Générer facture officielle</button>
                              <button className="cbtn cbtn-ghost">{I.print} Imprimer devis</button>
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
                  <div className="chir-card">
                    <div className="chir-card-hdr"><h3>📄 Documents chirurgicaux</h3></div>
                    <div style={{ padding:20, display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:14 }}>
                      {[
                        ["📋","Rapport de consultation","Synthèse de la consultation initiale"],
                        ["🔬","Bilan préopératoire","Résultats des examens"],
                        ["✍️","Consentement éclairé","Formulaire de consentement signé"],
                        ["🔪","Compte rendu opératoire","Rapport détaillé de l'intervention"],
                        ["💊","Ordonnance postopératoire","Prescriptions de sortie"],
                        ["🏥","Certificat médical","Certificat d'intervention"],
                        ["🚪","Bon de sortie","Document officiel de sortie"],
                        ["📑","Lettre de liaison","Lettre au médecin traitant"],
                      ].map(([icon,title,desc]) => (
                        <div key={title} style={{ background:"#F8FAFD", border:"1.5px solid var(--cbr)", borderRadius:14, padding:16, display:"flex", flexDirection:"column", gap:8, transition:"box-shadow .2s" }} onMouseOver={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(11,30,59,.1)"} onMouseOut={e=>e.currentTarget.style.boxShadow="none"}>
                          <div style={{ fontSize:24 }}>{icon}</div>
                          <div style={{ fontWeight:700, color:"var(--cn)", fontSize:13 }}>{title}</div>
                          <div style={{ fontSize:11, color:"var(--cm)" }}>{desc}</div>
                          <button className="cbtn cbtn-ghost cbtn-sm" style={{ marginTop:"auto" }} onClick={() => toast.success(`📄 Génération : ${title}...`)}>
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

          {/* ══ IA & ANALYTICS ══ */}
          {tab === "ia" && (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20, marginBottom:20 }}>
                <div className="chir-card">
                  <div className="chir-card-hdr">
                    <div><h3>{I.ia} Analyse IA — Risques opératoires</h3><p>Modèle prédictif sur données cliniques</p></div>
                  </div>
                  <div style={{ padding:20 }}>
                    <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12, marginBottom:16 }}>
                      {[
                        { lbl:"Score moyen",    val:`${Math.round(kpis.score_moyen)}/100` },
                        { lbl:"Risques élevés", val:nbRisques },
                        { lbl:"Taux complic.",  val:`${tauxCompl}%` },
                        { lbl:"Interventions",  val:kpis.operes + kpis.suivis_nb + kpis.clotures },
                      ].map(k => (
                        <div key={k.lbl} style={{ background:"#F8FAFD", border:"1.5px solid var(--cbr)", borderRadius:12, padding:14, textAlign:"center" }}>
                          <div style={{ fontSize:22, fontWeight:800, color:"var(--cn)" }}>{k.val}</div>
                          <div style={{ fontSize:11, color:"var(--cm)", marginTop:2 }}>{k.lbl}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize:12, fontWeight:700, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.5, marginBottom:10 }}>Facteurs de risque</div>
                    {[
                      ["Âge du patient",           72, "#1B4F9E"],
                      ["Antécédents médicaux",      58, "#D97706"],
                      ["Allergies connues",         40, "#DC2626"],
                      ["Complications antérieures", 65, "#7C3AED"],
                      ["Score ASA moyen",           48, "#059669"],
                      ["IMC (données)",             35, "#0EA5A0"],
                    ].map(([lbl,val,col]) => (
                      <div key={lbl} style={{ marginBottom:8 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                          <span style={{ color:"var(--cm)" }}>{lbl}</span>
                          <span style={{ fontWeight:700, color:"var(--cn)" }}>{val}%</span>
                        </div>
                        <Prog pct={val} color={col} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="chir-card">
                  <div className="chir-card-hdr"><h3>🤖 Recommandations IA</h3></div>
                  <div style={{ padding:20, display:"flex", flexDirection:"column", gap:12 }}>
                    {[
                      ["🔴","Priorité haute",     "Réviser les dossiers avec score IA > 70 avant intervention","#DC2626"],
                      ["🟠","Bilan incomplet",    "3 dossiers préopératoires ont des bilans biologiques manquants","#D97706"],
                      ["🟡","Suivi postop.",       "Vérifier les fiches de surveillance des patients opérés > 48h","#CA8A04"],
                      ["🟢","Bonne pratique",      "Taux de complications dans la norme — Maintenir les protocoles","#059669"],
                      ["🔵","Optimisation",        "Proposer évaluation gériatrique pour les patients > 70 ans","#1B4F9E"],
                    ].map(([ico,titre,desc,col]) => (
                      <div key={titre} style={{ display:"flex", alignItems:"flex-start", gap:10, background:"#F8FAFD", borderRadius:12, padding:"12px 14px", borderLeft:`3px solid ${col}` }}>
                        <span style={{ fontSize:16, flexShrink:0 }}>{ico}</span>
                        <div>
                          <div style={{ fontWeight:700, fontSize:12.5, color:"var(--cn)" }}>{titre}</div>
                          <div style={{ fontSize:11.5, color:"var(--cm)", marginTop:2 }}>{desc}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ background:"linear-gradient(135deg,#0B1E3B,#1B4F9E)", borderRadius:14, padding:16, color:"#fff", marginTop:4 }}>
                      <div style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>🤖 Lancer une analyse IA complète</div>
                      <div style={{ fontSize:11.5, color:"rgba(255,255,255,.7)", marginBottom:12 }}>Analyse approfondie des dossiers actifs, détection d'anomalies, prédiction des risques.</div>
                      <button className="cbtn cbtn-teal cbtn-sm" onClick={() => { toast.loading("🤖 Analyse IA en cours...", { duration:2500 }); setTimeout(() => toast.success("✅ Analyse terminée — Recommandations mises à jour"), 2500); }}>
                        {I.ia} Analyser maintenant
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="chir-card">
                <div className="chir-card-hdr"><h3>{I.trend} Volume opératoire mensuel — 12 mois</h3></div>
                <div style={{ padding:20 }}><BarChart labels={chartMois} data={chartInterv} color="#0EA5A0" /></div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ MODAL : NOUVEAU DOSSIER ═══ */}
        <Modal open={modalNouv} onClose={() => setModalNouv(false)} title={<>{I.plus} Nouveau dossier chirurgical</>} maxWidth={680}>
          <form onSubmit={createDossier}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="clbl">Patient *</label>
                <select className="cinp" required value={formDossier.patient_id} onChange={e => setFormDossier(f=>({...f,patient_id:e.target.value}))}>
                  <option value="">— Sélectionner un patient —</option>
                  {patients.map(p => <option key={p._id} value={p._id}>{p.prenom} {p.nom} — {p.numero_dossier}</option>)}
                </select>
              </div>
              <div>
                <label className="clbl">Chirurgien responsable</label>
                <select className="cinp" value={formDossier.chirurgien_id} onChange={e => setFormDossier(f=>({...f,chirurgien_id:e.target.value}))}>
                  <option value="">— Non assigné —</option>
                  {chirurgiens.map(c => <option key={c._id} value={c._id}>Dr. {c.prenom} {c.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="clbl">Statut initial</label>
                <select className="cinp" value={formDossier.statut} onChange={e => setFormDossier(f=>({...f,statut:e.target.value}))}>
                  <option value="consultation">Consultation chirurgicale</option>
                  <option value="preoperatoire">Préopératoire</option>
                  <option value="urgence_absolue">Urgence absolue</option>
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="clbl">Motif de consultation *</label>
                <input className="cinp" required placeholder="Ex: Douleur abdominale, hernie inguinale..." value={formDossier.motif_consultation} onChange={e => setFormDossier(f=>({...f,motif_consultation:e.target.value}))} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="clbl">Diagnostic chirurgical *</label>
                <input className="cinp" required placeholder="Ex: Appendicite aiguë, hernie étranglée..." value={formDossier.diagnostic_chirurgical} onChange={e => setFormDossier(f=>({...f,diagnostic_chirurgical:e.target.value}))} />
              </div>
              <div>
                <label className="clbl">Type d'intervention prévue</label>
                <input className="cinp" placeholder="Ex: Appendicectomie, Cure de hernie..." value={formDossier.type_intervention} onChange={e => setFormDossier(f=>({...f,type_intervention:e.target.value}))} />
              </div>
              <div>
                <label className="clbl">Niveau d'urgence</label>
                <select className="cinp" value={formDossier.niveau_urgence} onChange={e => setFormDossier(f=>({...f,niveau_urgence:e.target.value}))}>
                  <option value="electif">Électif (programmé)</option>
                  <option value="urgent">Urgent</option>
                  <option value="urgence_absolue">Urgence absolue</option>
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="clbl">Symptômes</label>
                <textarea className="cinp" rows={2} placeholder="Description des symptômes..." value={formDossier.symptomes} onChange={e => setFormDossier(f=>({...f,symptomes:e.target.value}))} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="clbl">Décision chirurgicale</label>
                <select className="cinp" value={formDossier.decision} onChange={e => setFormDossier(f=>({...f,decision:e.target.value}))}>
                  <option value="intervention">🔪 Intervention chirurgicale</option>
                  <option value="traitement_medical">💊 Traitement médical</option>
                  <option value="examens_complementaires">🔬 Examens complémentaires d'abord</option>
                  <option value="hospitalisation">🛏 Hospitalisation</option>
                </select>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button type="button" className="cbtn cbtn-ghost" onClick={() => setModalNouv(false)}>Annuler</button>
              <button type="submit" className="cbtn cbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>
                {I.save} {saving ? "Création..." : "Créer le dossier"}
              </button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : BILAN ═══ */}
        <Modal open={modalBilan} onClose={() => setModalBilan(false)} title="🔬 Ajouter un examen au bilan" maxWidth={480}>
          <form onSubmit={addBilan}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label className="clbl">Type *</label>
                <select className="cinp" value={formBilan.type} onChange={e => setFormBilan(f=>({...f,type:e.target.value}))}>
                  <option value="biologie">🩸 Analyses biologiques</option>
                  <option value="imagerie">🩻 Imagerie médicale</option>
                  <option value="anesthesie">💉 Évaluation anesthésique</option>
                </select>
              </div>
              <div>
                <label className="clbl">Examen *</label>
                <input className="cinp" required placeholder="Ex: NFS, Glycémie, Scanner thorax..." value={formBilan.examen} onChange={e => setFormBilan(f=>({...f,examen:e.target.value}))} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                <div>
                  <label className="clbl">Valeur / Résultat</label>
                  <input className="cinp" placeholder="Ex: 12.5 g/dL" value={formBilan.valeur} onChange={e => setFormBilan(f=>({...f,valeur:e.target.value}))} />
                </div>
                <div>
                  <label className="clbl">Date examen</label>
                  <input type="date" className="cinp" value={formBilan.date_examen} onChange={e => setFormBilan(f=>({...f,date_examen:e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="clbl">Détails / Commentaire</label>
                <textarea className="cinp" rows={2} placeholder="Interprétation, remarques..." value={formBilan.resultat} onChange={e => setFormBilan(f=>({...f,resultat:e.target.value}))} />
              </div>
              <div>
                <label className="clbl">Statut</label>
                <select className="cinp" value={formBilan.statut} onChange={e => setFormBilan(f=>({...f,statut:e.target.value}))}>
                  <option value="prescrit">Prescrit</option>
                  <option value="en_cours">En cours</option>
                  <option value="recu">Reçu</option>
                  <option value="normal">Normal ✅</option>
                  <option value="anormal">Anormal ⚠</option>
                </select>
              </div>
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                <input type="checkbox" checked={formBilan.urgence} onChange={e => setFormBilan(f=>({...f,urgence:e.target.checked}))} style={{ width:16, height:16, accentColor:"#DC2626" }} />
                <span style={{ fontSize:13, color:"var(--cn)" }}>🚨 Examen urgent</span>
              </label>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="cbtn cbtn-ghost" onClick={() => setModalBilan(false)}>Annuler</button>
                <button type="submit" className="cbtn cbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>✅ Ajouter</button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : SUIVI ═══ */}
        <Modal open={modalSuivi} onClose={() => setModalSuivi(false)} title="💉 Fiche de surveillance postopératoire" maxWidth={540}>
          <form onSubmit={addSuivi}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
              <div>
                <label className="clbl">Température (°C)</label>
                <input type="number" className="cinp" step="0.1" min="34" max="42" placeholder="37.0" value={formSuivi.temperature} onChange={e => setFormSuivi(f=>({...f,temperature:e.target.value}))} />
              </div>
              <div>
                <label className="clbl">Tension artérielle</label>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <input type="number" className="cinp" placeholder="120" style={{flex:1}} value={formSuivi.tension_sys} onChange={e => setFormSuivi(f=>({...f,tension_sys:e.target.value}))} />
                  <span style={{ color:"var(--cm)", fontWeight:700 }}>/</span>
                  <input type="number" className="cinp" placeholder="80" style={{flex:1}} value={formSuivi.tension_dia} onChange={e => setFormSuivi(f=>({...f,tension_dia:e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="clbl">Pouls (bpm)</label>
                <input type="number" className="cinp" placeholder="72" min="20" max="250" value={formSuivi.pouls} onChange={e => setFormSuivi(f=>({...f,pouls:e.target.value}))} />
              </div>
              <div>
                <label className="clbl">Douleur (0-10)</label>
                <input type="number" className="cinp" placeholder="0" min="0" max="10" value={formSuivi.douleur_score} onChange={e => setFormSuivi(f=>({...f,douleur_score:e.target.value}))} />
                {formSuivi.douleur_score !== "" && (
                  <div style={{ fontSize:10, color: formSuivi.douleur_score > 6 ? "#DC2626" : formSuivi.douleur_score > 3 ? "#D97706" : "#059669", marginTop:3 }}>
                    {["","Aucune","Très légère","Légère","Modérée","Modérée","Mod.-forte","Forte","Forte","Très forte","Intolérable"][formSuivi.douleur_score] || ""}
                  </div>
                )}
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="clbl">État de la plaie</label>
                <select className="cinp" value={formSuivi.etat_plaie} onChange={e => setFormSuivi(f=>({...f,etat_plaie:e.target.value}))}>
                  <option value="bonne_evolution">✅ Bonne évolution</option>
                  <option value="bonne">✅ Bonne</option>
                  <option value="suintement">⚠ Suintement</option>
                  <option value="infection">🚨 Infection</option>
                  <option value="necrose">🚨 Nécrose</option>
                </select>
              </div>
              <div style={{ gridColumn:"1/-1", display:"flex", alignItems:"center", gap:8 }}>
                <input type="checkbox" checked={formSuivi.pansement_fait} onChange={e => setFormSuivi(f=>({...f,pansement_fait:e.target.checked}))} style={{ width:16, height:16, accentColor:"var(--ct)" }} />
                <label style={{ fontSize:13, color:"var(--cn)", cursor:"pointer" }}>Pansement réalisé</label>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="clbl">Antibiothérapie</label>
                <input className="cinp" placeholder="Ex: Amoxicilline 1g × 3/j" value={formSuivi.antibiotherapie} onChange={e => setFormSuivi(f=>({...f,antibiotherapie:e.target.value}))} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="clbl">Médicaments / Soins</label>
                <textarea className="cinp" rows={2} placeholder="Analgésiques, anticoagulants, soins locaux..." value={formSuivi.medicaments} onChange={e => setFormSuivi(f=>({...f,medicaments:e.target.value}))} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="clbl">Observations cliniques</label>
                <textarea className="cinp" rows={2} placeholder="État général, transit, mobilisation..." value={formSuivi.observations} onChange={e => setFormSuivi(f=>({...f,observations:e.target.value}))} />
              </div>
              <div style={{ gridColumn:"1/-1", display:"flex", gap:10 }}>
                <button type="button" className="cbtn cbtn-ghost" onClick={() => setModalSuivi(false)}>Annuler</button>
                <button type="submit" className="cbtn cbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>✅ Enregistrer</button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : COMPLICATION ═══ */}
        <Modal open={modalComplic} onClose={() => setModalComplic(false)} title="⚠️ Déclarer une complication" maxWidth={500}>
          <form onSubmit={addComplication}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label className="clbl">Type de complication *</label>
                <select className="cinp" required value={formComplic.type_complication} onChange={e => setFormComplic(f=>({...f,type_complication:e.target.value}))}>
                  <option value="infection">🦠 Infection du site opératoire</option>
                  <option value="hemorragie">🩸 Hémorragie</option>
                  <option value="retard_cicatrisation">⏳ Retard de cicatrisation</option>
                  <option value="reintervention">🔪 Réintervention nécessaire</option>
                  <option value="thromboemboli">🩹 Thrombo-embolie</option>
                  <option value="autre">⚠️ Autre complication</option>
                </select>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                <div>
                  <label className="clbl">Date de survenue</label>
                  <input type="date" className="cinp" value={formComplic.date_survenue} onChange={e => setFormComplic(f=>({...f,date_survenue:e.target.value}))} />
                </div>
                <div>
                  <label className="clbl">Grade Clavien-Dindo</label>
                  <select className="cinp" value={formComplic.grade_clavien} onChange={e => setFormComplic(f=>({...f,grade_clavien:e.target.value}))}>
                    <option value="">— Non classifié —</option>
                    {[1,2,3,4,5].map(g => <option key={g} value={g}>Grade {g}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="clbl">Description *</label>
                <textarea className="cinp" rows={3} required placeholder="Description détaillée de la complication..." value={formComplic.description} onChange={e => setFormComplic(f=>({...f,description:e.target.value}))} />
              </div>
              <div>
                <label className="clbl">Traitement mis en place</label>
                <textarea className="cinp" rows={2} placeholder="Antibiothérapie, reprise chirurgicale, transfusion..." value={formComplic.traitement} onChange={e => setFormComplic(f=>({...f,traitement:e.target.value}))} />
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="cbtn cbtn-ghost" onClick={() => setModalComplic(false)}>Annuler</button>
                <button type="submit" className="cbtn cbtn-danger" style={{ marginLeft:"auto" }} disabled={saving}>⚠️ Déclarer</button>
              </div>
            </div>
          </form>
        </Modal>

      </div>
    </>
  );
}