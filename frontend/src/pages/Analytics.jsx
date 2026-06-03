import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchAnalyticsReport, fetchFinancialReport, fetchPatientStats,
  selectAnalyticsChartData, selectFinancialData, selectPatientStats, selectAnalyticsLoading,
} from '../store/slices/analyticsSlice';
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
.anl * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --an:#0B1E3B; --an2:#132744; --ab:#1B4F9E;
  --at:#0EA5A0; --at2:#0D9490; --ar:#DC2626;
  --ao:#D97706; --ag:#059669; --ap:#7C3AED;
  --abr:#E2EAF4; --am:#6B7A99; --al:#EEF4FF; --as:#F8FAFD;
  --sh:0 1px 3px rgba(11,30,59,.08); --shm:0 4px 16px rgba(11,30,59,.10); --shl:0 12px 40px rgba(11,30,59,.14);
}
/* Topbar */
.anl-top { background:linear-gradient(135deg,var(--an) 0%,var(--an2) 55%,#1B4F9E 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.anl-top::before { content:''; position:absolute; top:-60px; right:-60px; width:260px; height:260px; background:radial-gradient(circle,rgba(14,165,160,.18) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
.anl-top::after  { content:''; position:absolute; bottom:-80px; left:30%; width:200px; height:200px; background:radial-gradient(circle,rgba(27,79,158,.12) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
/* Tabs */
.anl-tabs { display:flex; gap:2px; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.anl-tabs::-webkit-scrollbar { display:none; }
.anl-tab { display:flex; align-items:center; gap:7px; padding:10px 18px 12px; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.55); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.anl-tab:hover { color:rgba(255,255,255,.88); background:rgba(255,255,255,.08); }
.anl-tab.active { color:var(--an); background:var(--as); box-shadow:0 -2px 0 var(--at) inset; }
/* Cards */
.anl-card { background:#fff; border:1.5px solid var(--abr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; }
.anl-card:hover { box-shadow:var(--shm); }
.anl-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--abr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.anl-card-hdr h3 { font-size:14px; font-weight:700; color:var(--an); margin:0; display:flex; align-items:center; gap:8px; }
.anl-card-hdr p { font-size:11px; color:var(--am); margin:2px 0 0; }
/* KPI grande */
.anl-kpi { background:#fff; border:1.5px solid var(--abr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:default; }
.anl-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.anl-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.anl-kpi.blue::before   { background:var(--ab); } .anl-kpi.teal::before  { background:var(--at); }
.anl-kpi.red::before    { background:var(--ar); } .anl-kpi.orange::before{ background:var(--ao); }
.anl-kpi.green::before  { background:var(--ag); } .anl-kpi.purple::before{ background:var(--ap); }
.anl-kpi.cyan::before   { background:#06B6D4; }
.akpi-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; flex-shrink:0; }
.akpi-icon.blue   { background:#EFF6FF; color:var(--ab); } .akpi-icon.teal  { background:#F0FDFC; color:var(--at); }
.akpi-icon.red    { background:#FEF2F2; color:var(--ar); } .akpi-icon.orange{ background:#FFF7ED; color:var(--ao); }
.akpi-icon.green  { background:#ECFDF5; color:var(--ag); } .akpi-icon.purple{ background:#F5F3FF; color:var(--ap); }
.akpi-icon.cyan   { background:#ECFEFF; color:#06B6D4; }
.akpi-val { font-size:28px; font-weight:800; color:var(--an); line-height:1; margin-bottom:4px; letter-spacing:-1.5px; }
.akpi-lbl { font-size:12px; font-weight:600; color:var(--am); }
.akpi-sub { font-size:11px; color:#9CA3AF; margin-top:3px; display:flex; align-items:center; gap:4px; }
.akpi-trend-up   { color:var(--ag); font-weight:700; font-size:11px; }
.akpi-trend-down { color:var(--ar); font-weight:700; font-size:11px; }
.akpi-dot { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--ar); animation:anlP 2s infinite; }
@keyframes anlP { 0%,100%{opacity:1} 50%{opacity:.3} }
/* Mini KPI dans groupe */
.mini-kpi { background:#F8FAFD; border:1.5px solid var(--abr); border-radius:12px; padding:12px 14px; }
.mini-kpi-val { font-size:20px; font-weight:800; color:var(--an); letter-spacing:-1px; }
.mini-kpi-lbl { font-size:11px; font-weight:600; color:var(--am); margin-top:2px; }
/* Filtres */
.filter-bar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; padding:16px 0 20px; }
.filter-btn { padding:7px 16px; border-radius:99px; font-size:12px; font-weight:600; border:1.5px solid var(--abr); background:white; color:var(--am); cursor:pointer; transition:all .2s; font-family:'Poppins',sans-serif; }
.filter-btn:hover { border-color:var(--at); color:var(--at); }
.filter-btn.active { background:var(--an); color:white; border-color:var(--an); }
.filter-select { padding:7px 12px; border-radius:10px; border:1.5px solid var(--abr); background:white; font-size:12px; font-weight:600; color:var(--am); font-family:'Poppins',sans-serif; outline:none; cursor:pointer; }
.filter-select:focus { border-color:var(--at); }
/* Progress */
.anl-prog { background:#EEF4FF; border-radius:99px; height:8px; overflow:hidden; }
.anl-prog-f { height:100%; border-radius:99px; transition:width .8s cubic-bezier(.34,1.56,.64,1); }
/* Badges */
.abdg { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.abdg.red    { background:#FEF2F2; color:var(--ar); border:1px solid #FECACA; }
.abdg.orange { background:#FFF7ED; color:var(--ao); border:1px solid #FED7AA; }
.abdg.green  { background:#ECFDF5; color:var(--ag); border:1px solid #A7F3D0; }
.abdg.blue   { background:#EFF6FF; color:var(--ab); border:1px solid #BFDBFE; }
.abdg.teal   { background:#F0FDFC; color:var(--at); border:1px solid #99F6E4; }
.abdg.purple { background:#F5F3FF; color:var(--ap); border:1px solid #DDD6FE; }
.abdg.gray   { background:#F9FAFB; color:#4B5563;   border:1px solid #E5E7EB; }
/* Alert boxes */
.al-danger { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--ar); border-radius:14px; padding:14px 18px; }
.al-warn   { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--ao); border-radius:14px; padding:14px 18px; }
.al-info   { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; border-left:4px solid var(--ab); border-radius:14px; padding:14px 18px; }
.al-success{ background:linear-gradient(135deg,#ECFDF5,#D1FAE5); border:1.5px solid #A7F3D0; border-left:4px solid var(--ag); border-radius:14px; padding:14px 18px; }
/* Boutons */
.abtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; }
.abtn-primary { background:var(--ab); color:#fff; } .abtn-primary:hover { background:#174391; transform:translateY(-1px); }
.abtn-teal    { background:var(--at); color:#fff; } .abtn-teal:hover    { background:var(--at2); transform:translateY(-1px); }
.abtn-ghost   { background:transparent; color:var(--am); border:1.5px solid var(--abr); }
.abtn-ghost:hover { background:var(--al); color:var(--an); }
.abtn-sm { padding:6px 13px; font-size:12px; }
/* Table */
.anl-tbl { width:100%; border-collapse:collapse; }
.anl-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.anl-tbl th { padding:10px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--am); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--abr); white-space:nowrap; }
.anl-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.anl-tbl tbody tr:last-child td { border-bottom:none; }
.anl-tbl tbody tr:hover { background:#F8FAFF; }
/* Occupancy gauge */
.gauge-wrap { position:relative; width:120px; height:60px; overflow:hidden; margin:0 auto; }
.gauge-bg { width:120px; height:60px; border-radius:60px 60px 0 0; background:#EEF4FF; position:absolute; }
.gauge-fill { width:120px; height:60px; border-radius:60px 60px 0 0; position:absolute; transform-origin:center bottom; transition:transform 1s cubic-bezier(.34,1.56,.64,1); }
/* Alerte item */
.alert-item { display:flex; align-items:flex-start; gap:12px; padding:12px 14px; border-radius:12px; margin-bottom:8px; transition:all .2s; cursor:pointer; }
.alert-item:hover { transform:translateX(4px); }
.alert-icon { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
/* Rank medal */
.rank-medal { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; flex-shrink:0; }
/* Satisfaction circle */
.sat-circle { width:80px; height:80px; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; }
/* Fade */
@keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
.fu { animation:fadeUp .4s ease both; }
.d1{animation-delay:.05s}.d2{animation-delay:.1s}.d3{animation-delay:.15s}
.d4{animation-delay:.2s}.d5{animation-delay:.25s}.d6{animation-delay:.3s}
.d7{animation-delay:.35s}.d8{animation-delay:.4s}
/* Scrollbar nickel */
.nice-scroll::-webkit-scrollbar { width:5px; height:5px; }
.nice-scroll::-webkit-scrollbar-thumb { background:var(--abr); border-radius:99px; }
@media print { .anl-top,.filter-bar,.abtn { display:none!important; } }

/* ─── Responsive ─── */
.anl-g2  { display:grid; grid-template-columns:2fr 1fr; gap:20px; }
.anl-g11 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.anl-g11s{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
@media (max-width:767px) {
  .anl-top { padding:12px 14px 0; }
  .anl-g2,.anl-g11 { grid-template-columns:1fr; gap:14px; }
  .anl-g11s { grid-template-columns:1fr 1fr; gap:8px; }
  .abtn { font-size:12px; padding:8px 12px; } .abtn-sm { font-size:11px; padding:5px 8px; }
  .anl-card { border-radius:14px; } .anl-card-hdr { padding:11px 14px; }
  .filter-bar { overflow-x:auto; flex-wrap:nowrap; scrollbar-width:none; }
  .filter-bar::-webkit-scrollbar { display:none; }
}
@media (max-width:479px) {
  .anl-top { padding:10px 12px 0; } .anl-g11s { grid-template-columns:1fr; }
  .anl-card-hdr { flex-wrap:wrap; gap:8px; }
}
`;

// ─── Helpers ─────────────────────────────────────────────────
const fmtNum = (n) => n >= 1000000 ? `${(n/1000000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(0)}k` : String(n);
const fmtCFA = (n) => n.toLocaleString("fr-FR") + " CFA";

// ─── SVG Icons ─────────────────────────────────────────────
const I = {
  analytics:<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  patients: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  consult:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  money:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  bed:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16M2 8h18a2 2 0 012 2v10M2 16h20"/><circle cx="7" cy="12" r="1" fill="currentColor"/></svg>,
  lab:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5h0c-1.4 0-2.5-1.1-2.5-2.5V2"/><path d="M8.5 2h7"/><path d="M14.5 16h-5s-1.5 0-1.5 1.5"/></svg>,
  scan:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>,
  surgery:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  trend:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  alert:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  dl:       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  print:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  send:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  refresh:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
  grid:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  ia:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  star:     <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  up:       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>,
  down:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>,
  filter:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  calendar: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
};

// ─── Chart components ──────────────────────────────────────
function LineChart({ labels, datasets, height = 200 }) {
  const ref = useRef(null);
  const cRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (cRef.current) cRef.current.destroy();
      cRef.current = new window.Chart(ref.current, {
        type: "line",
        data: { labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: true,
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { display: true, position:"top", labels:{ font:{size:11,family:"'Poppins',sans-serif"}, usePointStyle:true, boxWidth:8 } }, tooltip: { backgroundColor:"#0B1E3B", padding:12, cornerRadius:10 } },
          scales: {
            x: { grid:{ display:false }, ticks:{ font:{size:10}, color:"#9CA3AF" }, border:{display:false} },
            y: { beginAtZero:true, grid:{ color:"rgba(0,0,0,.04)" }, ticks:{ font:{size:10}, color:"#9CA3AF", precision:0 }, border:{display:false} },
          },
        },
      });
    });
    return () => { if (cRef.current) cRef.current.destroy(); };
  }, [labels, datasets]);
  return <canvas ref={ref} style={{ maxHeight: height }} />;
}

function BarChart({ labels, data, colors, height = 180 }) {
  const ref = useRef(null);
  const cRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (cRef.current) cRef.current.destroy();
      cRef.current = new window.Chart(ref.current, {
        type: "bar",
        data: {
          labels,
          datasets: [{ data, backgroundColor: colors || data.map((_,i)=>`hsl(${200+i*25},65%,55%)`), borderRadius:8, borderSkipped:false }],
        },
        options: {
          responsive:true, maintainAspectRatio:true,
          plugins:{ legend:{display:false}, tooltip:{ backgroundColor:"#0B1E3B", padding:10, cornerRadius:10, callbacks:{ label:(c)=> `${c.parsed.y.toLocaleString("fr-FR")} CFA` } } },
          scales:{ x:{ grid:{display:false}, ticks:{font:{size:10},color:"#9CA3AF"}, border:{display:false} }, y:{ beginAtZero:true, grid:{color:"rgba(0,0,0,.04)"}, ticks:{font:{size:10},color:"#9CA3AF",precision:0,callback:(v)=>v>=1000?`${v/1000}k`:v}, border:{display:false} } },
        },
      });
    });
    return () => { if (cRef.current) cRef.current.destroy(); };
  }, [labels, data, colors]);
  return <canvas ref={ref} style={{ maxHeight: height }} />;
}

function DonutChart({ labels, data, colors, height = 200 }) {
  const ref = useRef(null);
  const cRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (cRef.current) cRef.current.destroy();
      cRef.current = new window.Chart(ref.current, {
        type: "doughnut",
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 3, borderColor:"#fff", hoverOffset:8 }] },
        options: {
          responsive:true, maintainAspectRatio:true, cutout:"68%",
          plugins:{ legend:{ position:"right", labels:{ font:{size:11,family:"'Poppins',sans-serif"}, usePointStyle:true, boxWidth:8, padding:12 } }, tooltip:{ backgroundColor:"#0B1E3B", padding:10, cornerRadius:10 } },
        },
      });
    });
    return () => { if (cRef.current) cRef.current.destroy(); };
  }, [labels, data, colors]);
  return <canvas ref={ref} style={{ maxHeight: height }} />;
}

// ─── KPI Card composant ──────────────────────────────────
function KpiCard({ color, icon, value, label, sub, trend, trendUp, urgent, children }) {
  return (
    <div className={`anl-kpi ${color} fu`}>
      {urgent && <div className="akpi-dot" />}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
        <div className={`akpi-icon ${color}`}>{icon}</div>
        {trend !== undefined && (
          <div className={trendUp ? "akpi-trend-up" : "akpi-trend-down"} style={{ display:"flex", alignItems:"center", gap:3 }}>
            {trendUp ? I.up : I.down} {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="akpi-val">{value}</div>
      <div className="akpi-lbl">{label}</div>
      {sub && <div className="akpi-sub">{sub}</div>}
      {children}
    </div>
  );
}

function Prog({ pct, color, h = 8 }) {
  return (
    <div className="anl-prog" style={{ height:h }}>
      <div className="anl-prog-f" style={{ width:`${Math.min(100, pct)}%`, background:color }} />
    </div>
  );
}

function Badge({ cls, children }) { return <span className={`abdg ${cls}`}>{children}</span>; }

// ─── DEMO DATA ────────────────────────────────────────────
const MOIS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

const DEMO_KPI = {
  patients_total: 4820, patients_nouveaux: 143, patients_actifs: 612, patients_hospitalises: 34,
  consultations_total: 892, consultations_terminees: 810, consultations_annulees: 52, temps_moyen_consult: 24,
  labo_demandes: 342, labo_realises: 298, labo_attente: 44,
  imagerie_demandes: 124, imagerie_realises: 108, imagerie_attente: 16,
  hospit_admissions: 78, hospit_sorties: 44, taux_occupation: 72,
  chirurgie_programmees: 28, chirurgie_realisees: 22, chirurgie_annulees: 3,
  ca_total: 38450000, depenses: 14200000, benefice: 24250000, factures_impayees: 5800000,
};

const DEMO_CONSULT_LINE = {
  labels: ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"],
  datasets: [
    { label:"Cette semaine", data:[42,58,50,65,72,38,15], borderColor:"#0EA5A0", backgroundColor:"rgba(14,165,160,.1)", tension:.4, fill:true, pointRadius:5, pointBackgroundColor:"#0EA5A0" },
    { label:"Semaine précédente", data:[38,45,43,55,60,30,12], borderColor:"#1B4F9E", backgroundColor:"rgba(27,79,158,.06)", tension:.4, fill:true, borderDash:[5,5], pointRadius:3, pointBackgroundColor:"#1B4F9E" },
  ],
};

const DEMO_REVENUS_BAR = {
  labels:["Consultations","Laboratoire","Imagerie","Hospitalisation","Pharmacie","Chirurgie"],
  data:[12500000, 6800000, 4200000, 7900000, 3200000, 3850000],
  colors:["#1B4F9E","#0EA5A0","#7C3AED","#D97706","#059669","#DC2626"],
};

const DEMO_GENDER = {
  labels:["Hommes","Femmes","Enfants (< 15 ans)"],
  data:[1842, 2210, 768],
  colors:["#1B4F9E","#0EA5A0","#D97706"],
};

const DEMO_PATHOLOGIES = [
  { maladie:"Paludisme",          nb:320, pct:100, color:"#DC2626" },
  { maladie:"Hypertension",       nb:210, pct:66,  color:"#D97706" },
  { maladie:"Diabète",            nb:145, pct:45,  color:"#0EA5A0" },
  { maladie:"Infections respiratoires", nb:128, pct:40, color:"#1B4F9E" },
  { maladie:"Diarrhées",          nb:98,  pct:31,  color:"#059669" },
  { maladie:"Typhoïde",           nb:87,  pct:27,  color:"#7C3AED" },
  { maladie:"Anémie",             nb:74,  pct:23,  color:"#F59E0B" },
  { maladie:"VIH/SIDA",           nb:62,  pct:19,  color:"#EC4899" },
  { maladie:"Tuberculose",        nb:45,  pct:14,  color:"#06B6D4" },
  { maladie:"Insuffisance cardiaque",nb:38, pct:12, color:"#6366F1" },
];

const DEMO_MEDECINS = [
  { nom:"Dr. Martin Leblanc",  specialite:"Chirurgie",      consultations:120, taux:96, color:"#1B4F9E" },
  { nom:"Dr. Sophie Pierre",   specialite:"Gynécologie",    consultations:98,  taux:94, color:"#0EA5A0" },
  { nom:"Dr. Amina Diallo",    specialite:"Médecine interne",consultations:76, taux:91, color:"#7C3AED" },
  { nom:"Dr. Pierre Mouanda",  specialite:"Radiologie",     consultations:65,  taux:88, color:"#D97706" },
  { nom:"Dr. Carine Bakounga", specialite:"Pédiatrie",      consultations:52,  taux:97, color:"#059669" },
];

const DEMO_ALERTES_MED = [
  { type:"danger",  icon:"🔬", titre:"44 examens labo en attente",   detail:"Dont 8 urgents depuis plus de 24h",            heure:"Il y a 30 min" },
  { type:"danger",  icon:"🛏️",  titre:"Lit réanimation critique",    detail:"Patient Paul N. — Unité soins intensifs",       heure:"Il y a 1h" },
  { type:"warn",    icon:"💊",  titre:"Stock Amoxicilline faible",   detail:"Seuil minimum atteint — 48h restantes",         heure:"Il y a 2h" },
  { type:"warn",    icon:"📅",  titre:"3 rendez-vous non honorés",   detail:"Patients sans confirmation pour demain",        heure:"Il y a 3h" },
  { type:"info",    icon:"🤖",  titre:"IA : Anomalie détectée",      detail:"Scanner patient CHIR-003 — Révision recommandée",heure:"Il y a 4h" },
];

const DEMO_ALERTES_ADM = [
  { type:"danger",  icon:"💰", titre:"5 800 000 CFA impayés",        detail:"23 factures en attente de règlement",            heure:"Aujourd'hui" },
  { type:"warn",    icon:"💊", titre:"8 médicaments en rupture",     detail:"Réapprovisionnement urgent requis",               heure:"Aujourd'hui" },
  { type:"danger",  icon:"⏰", titre:"2 médicaments expirés",        detail:"Ciprofloxacine lot A2024 — À retirer immédiatement",heure:"Hier" },
  { type:"warn",    icon:"📋", titre:"12 dossiers incomplets",       detail:"Patients sans bilan préopératoire complet",       heure:"Cette semaine" },
];

const DEMO_PERF = [
  { label:"Taux de satisfaction patient",  val:87, unit:"%", color:"#059669", icon:"😊", good:true },
  { label:"Temps moyen d'attente",         val:22,  unit:"min", color:"#D97706", icon:"⏳", good:false },
  { label:"Temps moyen de prise en charge",val:35,  unit:"min", color:"#1B4F9E", icon:"🏥", good:null },
  { label:"Taux de retour patients",       val:68,  unit:"%",   color:"#0EA5A0", icon:"🔄", good:true },
  { label:"Taux d'occupation des lits",    val:72,  unit:"%",   color:"#7C3AED", icon:"🛏️", good:null },
  { label:"Taux de complications chir.",   val:4.2, unit:"%",   color:"#DC2626", icon:"⚠️", good:false },
];

// ─── MAIN ───────────────────────────────────────────────────
export default function Analytics() {
  const dispatch = useDispatch();
  const reduxChartData = useSelector(selectAnalyticsChartData);
  const reduxFinancialData = useSelector(selectFinancialData);

  useEffect(() => {
    dispatch(fetchAnalyticsReport({ type: 'global', period: '30d' }));
    dispatch(fetchFinancialReport({ period: '30d' }));
    dispatch(fetchPatientStats({ period: '30d' }));
  }, [dispatch]);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => { const fn = () => setIsMobile(window.innerWidth <= 599); window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn); }, []);

  const [tab, setTab]           = useState("vue_globale");
  const [periode, setPeriode]   = useState("mois");
  const [filterService, setFilterSvc]  = useState("");
  const [filterMedecin, setFilterMed]  = useState("");
  const [loading, setLoading]   = useState(false);
  const [kpi, setKpi]           = useState(DEMO_KPI);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Simulation refresh
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/analytics/stats?periode=${periode}&service=${filterService}&medecin=${filterMedecin}`);
      setKpi(data.kpi || DEMO_KPI);
    } catch {
      // Légère variation démo
      setKpi(prev => ({ ...prev, patients_nouveaux: prev.patients_nouveaux + Math.floor(Math.random()*3)-1 }));
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  }, [periode, filterService, filterMedecin]);

  useEffect(() => { refresh(); }, [refresh]);

  const periodes = [
    { key:"aujourd_hui", label:"Aujourd'hui" },
    { key:"semaine",     label:"Cette semaine" },
    { key:"mois",        label:"Ce mois" },
    { key:"annee",       label:"Cette année" },
    { key:"custom",      label:"Personnalisée" },
  ];

  const beneficePct = kpi.ca_total > 0 ? Math.round(kpi.benefice/kpi.ca_total*100) : 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="anl">

        {/* ── TOPBAR ── */}
        <div className="anl-top">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap", position:"relative", zIndex:2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:54, height:54, borderRadius:14, background:"rgba(255,255,255,.12)", border:"1.5px solid rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {I.analytics}
              </div>
              <div>
                <div style={{ fontSize:21, fontWeight:700, color:"#fff", letterSpacing:-.3 }}>Analytics — Tableau de Bord</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.55)", marginTop:2 }}>
                  Mis à jour : {lastUpdate.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})} · Clinique Canadienne de Souanké
                </div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button className="abtn abtn-ghost" style={{ color:"#fff", borderColor:"rgba(255,255,255,.3)", fontSize:12 }} onClick={refresh} title="Actualiser">
                {I.refresh} Actualiser
              </button>
              <button className="abtn abtn-ghost" style={{ color:"#fff", borderColor:"rgba(255,255,255,.3)", fontSize:12 }} onClick={() => window.print()}>
                {I.print} Imprimer
              </button>
              <button className="abtn abtn-teal" style={{ fontSize:12 }} onClick={() => toast.success("📄 PDF exporté — Rapport Analytics")}>
                {I.dl} Export PDF
              </button>
            </div>
          </div>

          {/* Tabs */}
          {(() => {
            const TABS = [
              { key:"vue_globale", icon:I.grid,    label:"Vue globale",       labelM:"Globale" },
              { key:"medical",     icon:I.consult, label:"Activité médicale", labelM:"Médical" },
              { key:"financier",   icon:I.money,   label:"Finance",           labelM:"Finance" },
              { key:"performance", icon:I.star,    label:"Performance",       labelM:"Perfor." },
              { key:"alertes",     icon:I.alert,   label:"Alertes",           labelM:"Alertes", badge:DEMO_ALERTES_MED.filter(a=>a.type==="danger").length+DEMO_ALERTES_ADM.filter(a=>a.type==="danger").length },
            ];
            return (
              <div style={isMobile?{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'4px',padding:'8px 10px',marginTop:'8px',background:'rgba(255,255,255,.07)',borderRadius:'10px 10px 0 0'}:{display:'flex',gap:'2px',marginTop:'16px',overflowX:'auto',scrollbarWidth:'none'}}>
                {TABS.map(t=>(
                  <button key={t.key} className={`anl-tab ${tab===t.key?"active":""}`} style={isMobile?{flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'7px 3px 8px',fontSize:'9.5px',gap:'3px',borderRadius:'8px',whiteSpace:'normal',minWidth:0}:{}} onClick={()=>setTab(t.key)}>
                    <span style={isMobile?{fontSize:'14px'}:{}}>{t.icon}</span>
                    <span style={isMobile?{lineHeight:1.2}:{}}>{isMobile?t.labelM:t.label}</span>
                    {(t.badge??0)>0&&<span style={{background:"#DC2626",color:"#fff",fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:99}}>{t.badge}</span>}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

        {/* ── CONTENT ── */}
        <div style={{ padding: isMobile ? 14 : 24 }}>

          {/* ── FILTRES ── */}
          <div className="filter-bar">
            <span style={{ fontSize:12, fontWeight:700, color:"var(--am)", display:"flex", alignItems:"center", gap:6 }}>{I.filter} Période :</span>
            {periodes.map(p => (
              <button key={p.key} className={`filter-btn ${periode===p.key?"active":""}`} onClick={() => setPeriode(p.key)}>
                {p.label}
              </button>
            ))}
            {periode === "custom" && (
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <input type="date" className="filter-select" style={{ width:140 }} />
                <span style={{ color:"var(--am)", fontSize:12 }}>→</span>
                <input type="date" className="filter-select" style={{ width:140 }} />
              </div>
            )}
            <span style={{ fontSize:12, fontWeight:700, color:"var(--am)", marginLeft:8 }}>{I.filter} Filtres :</span>
            <select className="filter-select" value={filterService} onChange={e=>setFilterSvc(e.target.value)}>
              <option value="">Tous les services</option>
              {["Chirurgie","Médecine générale","Gynécologie","Urgences","Pédiatrie","Laboratoire","Radiologie","Pharmacie"].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <select className="filter-select" value={filterMedecin} onChange={e=>setFilterMed(e.target.value)}>
              <option value="">Tous les médecins</option>
              {DEMO_MEDECINS.map(m=><option key={m.nom} value={m.nom}>{m.nom}</option>)}
            </select>
            {loading && <span style={{ fontSize:11, color:"var(--at)", fontWeight:600 }}>⏳ Mise à jour...</span>}
          </div>

          {/* ══════════ VUE GLOBALE ══════════ */}
          {tab === "vue_globale" && (
            <div>
              {/* ── SECTION PATIENTS ── */}
              <div style={{ marginBottom:8 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--am)", textTransform:"uppercase", letterSpacing:.6, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ width:20, height:20, borderRadius:4, background:"#EFF6FF", display:"flex", alignItems:"center", justifyContent:"center" }}>{I.patients}</span>
                  Patients
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:14, marginBottom:24 }}>
                  <KpiCard color="blue" icon={I.patients} value={fmtNum(kpi.patients_total)} label="Total patients" trend={5.2} trendUp sub="depuis le début">
                    <div className="akpi-sub" style={{ marginTop:6 }}>{kpi.patients_actifs} actifs ce mois</div>
                  </KpiCard>
                  <div className="anl-kpi blue fu d1">
                    <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
                      {[["Nouveaux",kpi.patients_nouveaux,"var(--ab)"],["Actifs",kpi.patients_actifs,"var(--ag)"],["Hospitalisés",kpi.patients_hospitalises,"var(--ao)"],["Sortis",44,"var(--at)"]].map(([lbl,val,col])=>(
                        <div key={lbl} className="mini-kpi">
                          <div className="mini-kpi-val" style={{ color:col }}>{val}</div>
                          <div className="mini-kpi-lbl">{lbl}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── SECTION CONSULTATIONS ── */}
              <div style={{ marginBottom:8 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--am)", textTransform:"uppercase", letterSpacing:.6, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ width:20, height:20, borderRadius:4, background:"#F0FDFC", display:"flex", alignItems:"center", justifyContent:"center" }}>{I.consult}</span>
                  Consultations
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
                  <KpiCard color="teal" icon={I.consult} value={kpi.consultations_total} label="Total consultations" trend={8.4} trendUp />
                  <KpiCard color="green" icon={I.consult} value={kpi.consultations_terminees} label="Terminées" sub={`${Math.round(kpi.consultations_terminees/kpi.consultations_total*100)}% de taux de complétion`} />
                  <KpiCard color="orange" icon={I.consult} value={kpi.consultations_annulees} label="Annulées" trend={2.1} trendUp={false} urgent />
                  <KpiCard color="blue" icon={I.consult} value={`${kpi.temps_moyen_consult}min`} label="Durée moyenne" sub="Par consultation" />
                </div>
              </div>

              {/* ── KPI MULTI-MODULE ── */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:14, marginBottom:24 }}>
                {/* Laboratoire */}
                <div className="anl-card fu">
                  <div className="anl-card-hdr"><h3>{I.lab} Laboratoire</h3></div>
                  <div style={{ padding:16, display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:10 }}>
                    {[["Demandés",kpi.labo_demandes,"var(--ab)"],["Réalisés",kpi.labo_realises,"var(--ag)"],["En attente",kpi.labo_attente,"var(--ao)"]].map(([lbl,val,col])=>(
                      <div key={lbl} className="mini-kpi" style={{ textAlign:"center" }}>
                        <div className="mini-kpi-val" style={{ color:col, fontSize:22 }}>{val}</div>
                        <div className="mini-kpi-lbl">{lbl}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding:"0 16px 14px" }}>
                    <Prog pct={Math.round(kpi.labo_realises/kpi.labo_demandes*100)} color="#059669" />
                    <div style={{ fontSize:11, color:"var(--am)", marginTop:4, textAlign:"right" }}>{Math.round(kpi.labo_realises/kpi.labo_demandes*100)}% réalisés</div>
                  </div>
                </div>

                {/* Imagerie */}
                <div className="anl-card fu d1">
                  <div className="anl-card-hdr"><h3>{I.scan} Imagerie</h3></div>
                  <div style={{ padding:16, display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:10 }}>
                    {[["Demandés",kpi.imagerie_demandes,"var(--ap)"],["Réalisés",kpi.imagerie_realises,"var(--ag)"],["En attente",kpi.imagerie_attente,"var(--ao)"]].map(([lbl,val,col])=>(
                      <div key={lbl} className="mini-kpi" style={{ textAlign:"center" }}>
                        <div className="mini-kpi-val" style={{ color:col, fontSize:22 }}>{val}</div>
                        <div className="mini-kpi-lbl">{lbl}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding:"0 16px 14px" }}>
                    <Prog pct={Math.round(kpi.imagerie_realises/kpi.imagerie_demandes*100)} color="#7C3AED" />
                    <div style={{ fontSize:11, color:"var(--am)", marginTop:4, textAlign:"right" }}>{Math.round(kpi.imagerie_realises/kpi.imagerie_demandes*100)}% réalisés</div>
                  </div>
                </div>

                {/* Hospitalisation */}
                <div className="anl-card fu d2">
                  <div className="anl-card-hdr"><h3>{I.bed} Hospitalisation</h3></div>
                  <div style={{ padding:16 }}>
                    <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginBottom:12 }}>
                      {[["Admissions",kpi.hospit_admissions,"var(--ao)"],["Sorties",kpi.hospit_sorties,"var(--ag)"]].map(([lbl,val,col])=>(
                        <div key={lbl} className="mini-kpi" style={{ textAlign:"center" }}>
                          <div className="mini-kpi-val" style={{ color:col, fontSize:22 }}>{val}</div>
                          <div className="mini-kpi-lbl">{lbl}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:11, fontWeight:600, color:"var(--am)", marginBottom:6 }}>Taux d'occupation</div>
                      <div style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
                        <div style={{ fontSize:28, fontWeight:800, color: kpi.taux_occupation > 85?"var(--ar)":kpi.taux_occupation > 70?"var(--ao)":"var(--ag)" }}>{kpi.taux_occupation}%</div>
                      </div>
                      <Prog pct={kpi.taux_occupation} color={kpi.taux_occupation>85?"#DC2626":kpi.taux_occupation>70?"#D97706":"#059669"} />
                    </div>
                  </div>
                </div>

                {/* Chirurgie */}
                <div className="anl-card fu d3">
                  <div className="anl-card-hdr"><h3>{I.surgery} Chirurgie</h3></div>
                  <div style={{ padding:16, display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:10 }}>
                    {[["Programmées",kpi.chirurgie_programmees,"var(--ab)"],["Réalisées",kpi.chirurgie_realisees,"var(--ag)"],["Annulées",kpi.chirurgie_annulees,"var(--ar)"]].map(([lbl,val,col])=>(
                      <div key={lbl} className="mini-kpi" style={{ textAlign:"center" }}>
                        <div className="mini-kpi-val" style={{ color:col, fontSize:22 }}>{val}</div>
                        <div className="mini-kpi-lbl">{lbl}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding:"0 16px 14px" }}>
                    <Prog pct={Math.round(kpi.chirurgie_realisees/kpi.chirurgie_programmees*100)} color="#059669" />
                    <div style={{ fontSize:11, color:"var(--am)", marginTop:4, textAlign:"right" }}>{Math.round(kpi.chirurgie_realisees/kpi.chirurgie_programmees*100)}% réalisées</div>
                  </div>
                </div>
              </div>

              {/* ── KPIs FINANCE RÉSUMÉ ── */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14, marginBottom:28 }}>
                {[
                  { color:"green",  icon:I.money, label:"Chiffre d'affaires",  val:fmtNum(kpi.ca_total)+" CFA",    sub:`${periode==="mois"?"Ce mois":"Cette période"}`, trend:12.5, up:true },
                  { color:"blue",   icon:I.money, label:"Dépenses totales",     val:fmtNum(kpi.depenses)+" CFA",    sub:"Charges opérationnelles",      trend:3.2,  up:true },
                  { color:"teal",   icon:I.money, label:"Bénéfice net",         val:fmtNum(kpi.benefice)+" CFA",    sub:`Marge ${beneficePct}%`,        trend:18.7, up:true },
                  { color:"red",    icon:I.money, label:"Factures impayées",    val:fmtNum(kpi.factures_impayees)+" CFA", sub:"23 factures",             urgent:true },
                ].map((k,i) => (
                  <KpiCard key={i} color={k.color} icon={k.icon} value={k.val} label={k.label} sub={k.sub} trend={k.trend} trendUp={k.up} urgent={k.urgent} />
                ))}
              </div>

              {/* ── GRAPHIQUES LIGNE ── */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"2fr 1fr", gap:20, marginBottom:20 }}>
                <div className="anl-card fu">
                  <div className="anl-card-hdr">
                    <div><h3>{I.trend} Évolution des consultations</h3><p>Comparaison avec la période précédente</p></div>
                  </div>
                  <div style={{ padding:20 }}>
                    <LineChart labels={DEMO_CONSULT_LINE.labels} datasets={DEMO_CONSULT_LINE.datasets} height={200} />
                  </div>
                </div>
                <div className="anl-card fu">
                  <div className="anl-card-hdr">
                    <div><h3>👫 Répartition des patients</h3><p>{fmtNum(kpi.patients_total)} patients</p></div>
                  </div>
                  <div style={{ padding:20 }}>
                    <DonutChart labels={DEMO_GENDER.labels} data={DEMO_GENDER.data} colors={DEMO_GENDER.colors} height={200} />
                  </div>
                </div>
              </div>

              {/* ── PATHOLOGIES + MÉDECINS ── */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20, marginBottom:20 }}>
                {/* Top 10 pathologies */}
                <div className="anl-card fu">
                  <div className="anl-card-hdr">
                    <div><h3>🦠 Top 10 pathologies fréquentes</h3><p>Ce mois — tous services</p></div>
                  </div>
                  <div style={{ padding:"4px 0 0" }}>
                    {DEMO_PATHOLOGIES.map((p, i) => (
                      <div key={p.maladie} style={{ padding:"10px 20px", display:"flex", alignItems:"center", gap:14, borderBottom: i<9?"1px solid #F3F7FF":"" }}>
                        <div style={{ width:24, height:24, borderRadius:6, background:`${p.color}22`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:12, color:p.color, flexShrink:0 }}>
                          {i+1}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                            <span style={{ fontSize:12.5, fontWeight:600, color:"var(--an)" }}>{p.maladie}</span>
                            <span style={{ fontWeight:800, fontSize:13, color:p.color }}>{p.nb}</span>
                          </div>
                          <Prog pct={p.pct} color={p.color} h={5} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activité médecins */}
                <div className="anl-card fu">
                  <div className="anl-card-hdr">
                    <div><h3>👨‍⚕️ Activité des médecins</h3><p>Top prescripteurs ce mois</p></div>
                  </div>
                  <div style={{ padding:16, display:"flex", flexDirection:"column", gap:14 }}>
                    {DEMO_MEDECINS.map((m, i) => (
                      <div key={m.nom} style={{ display:"flex", alignItems:"center", gap:14 }}>
                        <div className="rank-medal" style={{ background:`${m.color}22`, color:m.color, border:`1.5px solid ${m.color}44`, fontSize:13 }}>
                          {i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, alignItems:"center" }}>
                            <div>
                              <div style={{ fontSize:13, fontWeight:700, color:"var(--an)" }}>{m.nom}</div>
                              <div style={{ fontSize:11, color:"var(--am)" }}>{m.specialite}</div>
                            </div>
                            <div style={{ textAlign:"right", flexShrink:0 }}>
                              <div style={{ fontWeight:800, fontSize:16, color:m.color }}>{m.consultations}</div>
                              <div style={{ fontSize:10, color:"var(--am)" }}>consultations</div>
                            </div>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <Prog pct={m.taux} color={m.color} h={5} />
                            <span style={{ fontSize:11, fontWeight:700, color:m.color, flexShrink:0 }}>{m.taux}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Alertes résumé ── */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                <div className="anl-card fu">
                  <div className="anl-card-hdr">
                    <h3>🏥 Alertes médicales</h3>
                    <span style={{ fontSize:12, color:"var(--ar)", fontWeight:700 }}>{DEMO_ALERTES_MED.filter(a=>a.type==="danger").length} critiques</span>
                  </div>
                  <div style={{ padding:14 }}>
                    {DEMO_ALERTES_MED.slice(0,4).map((al,i)=>(
                      <div key={i} className={`alert-item al-${al.type}`} style={{ marginBottom:8 }}>
                        <div className="alert-icon" style={{ background: al.type==="danger"?"#FEE2E2":al.type==="warn"?"#FEF3C7":"#DBEAFE", fontSize:18 }}>{al.icon}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12.5, fontWeight:700, color:"var(--an)" }}>{al.titre}</div>
                          <div style={{ fontSize:11, color:"var(--am)", marginTop:2 }}>{al.detail}</div>
                        </div>
                        <div style={{ fontSize:10, color:"var(--am)", flexShrink:0, whiteSpace:"nowrap" }}>{al.heure}</div>
                      </div>
                    ))}
                    <button className="abtn abtn-ghost abtn-sm" style={{ width:"100%", justifyContent:"center", marginTop:4 }} onClick={() => setTab("alertes")}>
                      Voir toutes les alertes →
                    </button>
                  </div>
                </div>

                <div className="anl-card fu">
                  <div className="anl-card-hdr">
                    <h3>⚙️ Alertes administratives</h3>
                    <span style={{ fontSize:12, color:"var(--ar)", fontWeight:700 }}>{DEMO_ALERTES_ADM.filter(a=>a.type==="danger").length} critiques</span>
                  </div>
                  <div style={{ padding:14 }}>
                    {DEMO_ALERTES_ADM.map((al,i)=>(
                      <div key={i} className={`alert-item al-${al.type}`} style={{ marginBottom:8 }}>
                        <div className="alert-icon" style={{ background: al.type==="danger"?"#FEE2E2":"#FEF3C7", fontSize:18 }}>{al.icon}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12.5, fontWeight:700, color:"var(--an)" }}>{al.titre}</div>
                          <div style={{ fontSize:11, color:"var(--am)", marginTop:2 }}>{al.detail}</div>
                        </div>
                        <div style={{ fontSize:10, color:"var(--am)", flexShrink:0, whiteSpace:"nowrap" }}>{al.heure}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ ACTIVITÉ MÉDICALE ══════════ */}
          {tab === "medical" && (
            <div>
              {/* Graphe revenus par source */}
              <div className="anl-card fu" style={{ marginBottom:20 }}>
                <div className="anl-card-hdr">
                  <div><h3>{I.money} Revenus par source médicale</h3><p>Répartition du chiffre d'affaires</p></div>
                  <div style={{ display:"flex", gap:6 }}>
                    <button className="abtn abtn-ghost abtn-sm" onClick={() => toast.success("📊 Export Excel")}>📊 Excel</button>
                    <button className="abtn abtn-ghost abtn-sm" onClick={() => toast.success("📄 Export PDF")}>{I.dl} PDF</button>
                  </div>
                </div>
                <div style={{ padding:20 }}>
                  <BarChart labels={DEMO_REVENUS_BAR.labels} data={DEMO_REVENUS_BAR.data} colors={DEMO_REVENUS_BAR.colors} height={220} />
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20, marginBottom:20 }}>
                {/* Évolution mensuelle */}
                <div className="anl-card fu">
                  <div className="anl-card-hdr"><div><h3>{I.trend} Évolution mensuelle</h3><p>Consultations sur 12 mois</p></div></div>
                  <div style={{ padding:20 }}>
                    <LineChart
                      labels={MOIS}
                      datasets={[{
                        label:"Consultations",
                        data:[420,510,480,562,620,580,440,320,500,610,560,680],
                        borderColor:"#0EA5A0", backgroundColor:"rgba(14,165,160,.1)", tension:.4, fill:true, pointRadius:4, pointBackgroundColor:"#0EA5A0",
                      },{
                        label:"Hospitalisations",
                        data:[65,78,70,82,90,75,62,48,71,88,80,96],
                        borderColor:"#D97706", backgroundColor:"rgba(215,119,6,.06)", tension:.4, fill:true, borderDash:[5,5], pointRadius:3, pointBackgroundColor:"#D97706",
                      }]}
                      height={200}
                    />
                  </div>
                </div>

                {/* Pathologies */}
                <div className="anl-card fu">
                  <div className="anl-card-hdr"><div><h3>🦠 Top 5 pathologies</h3></div></div>
                  <div style={{ padding:16 }}>
                    {DEMO_PATHOLOGIES.slice(0,5).map((p,i)=>(
                      <div key={p.maladie} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 4px", borderBottom:i<4?"1px solid #F3F7FF":"" }}>
                        <div style={{ width:32, height:32, borderRadius:8, background:`${p.color}18`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:13, color:p.color, flexShrink:0 }}>{i+1}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                            <span style={{ fontSize:13, fontWeight:600, color:"var(--an)" }}>{p.maladie}</span>
                            <span style={{ fontWeight:800, fontSize:14, color:p.color }}>{p.nb}</span>
                          </div>
                          <Prog pct={p.pct} color={p.color} h={6} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tableau détaillé médecins */}
              <div className="anl-card fu">
                <div className="anl-card-hdr">
                  <div><h3>👨‍⚕️ Activité détaillée des médecins</h3><p>Performance individuelle</p></div>
                  <button className="abtn abtn-ghost abtn-sm" onClick={() => toast.success("📊 Export Excel — Activité médecins")}>📊 Exporter</button>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table className="anl-tbl">
                    <thead><tr><th>Rang</th><th>Médecin</th><th>Spécialité</th><th>Consultations</th><th>Hospitalisations</th><th>Chirurgies</th><th>Ordonnances</th><th>Taux satisfaction</th><th>Performance</th></tr></thead>
                    <tbody>
                      {DEMO_MEDECINS.map((m,i)=>(
                        <tr key={m.nom}>
                          <td style={{ fontWeight:800, fontSize:16, color:m.color }}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</td>
                          <td>
                            <div style={{ fontWeight:600, color:"var(--an)" }}>{m.nom}</div>
                          </td>
                          <td style={{ fontSize:12, color:"var(--am)" }}>{m.specialite}</td>
                          <td style={{ fontWeight:800, color:"var(--ab)", fontSize:15 }}>{m.consultations}</td>
                          <td style={{ fontWeight:700, color:"var(--ao)" }}>{Math.floor(m.consultations*0.15)}</td>
                          <td style={{ fontWeight:700, color:"var(--ap)" }}>{i<3 ? Math.floor(m.consultations*0.08) : 0}</td>
                          <td style={{ fontWeight:700, color:"var(--at)" }}>{Math.floor(m.consultations*0.7)}</td>
                          <td>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <div style={{ width:40, height:6, background:"#EEF4FF", borderRadius:99, overflow:"hidden" }}>
                                <div style={{ height:"100%", width:`${m.taux}%`, background:m.taux>=95?"#059669":m.taux>=85?"#D97706":"#DC2626", borderRadius:99, transition:"width .8s" }} />
                              </div>
                              <span style={{ fontSize:12, fontWeight:700, color:m.taux>=95?"var(--ag)":m.taux>=85?"var(--ao)":"var(--ar)" }}>{m.taux}%</span>
                            </div>
                          </td>
                          <td><Badge cls={m.taux>=95?"green":m.taux>=85?"orange":"red"}>{m.taux>=95?"Excellent":m.taux>=85?"Bien":"À améliorer"}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ FINANCE ══════════ */}
          {tab === "financier" && (
            <div>
              {/* Grandes KPI finance */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14, marginBottom:24 }}>
                {[
                  { color:"green",  icon:I.money, label:"Chiffre d'affaires",  val:fmtCFA(kpi.ca_total),          trend:12.5, up:true,  sub:"vs période précédente" },
                  { color:"orange", icon:I.money, label:"Dépenses totales",     val:fmtCFA(kpi.depenses),          trend:3.2,  up:true,  sub:"Charges opérationnelles" },
                  { color:"teal",   icon:I.money, label:"Bénéfice net",         val:fmtCFA(kpi.benefice),          trend:18.7, up:true,  sub:`Marge nette : ${beneficePct}%` },
                  { color:"red",    icon:I.money, label:"Factures impayées",    val:fmtCFA(kpi.factures_impayees), trend:5.1,  up:true,  sub:"23 factures en attente", urgent:true },
                ].map((k,i) => (
                  <KpiCard key={i} color={k.color} icon={k.icon} value={k.val} label={k.label} sub={k.sub} trend={k.trend} trendUp={k.up} urgent={k.urgent} />
                ))}
              </div>

              {/* Graphes finance */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"2fr 1fr", gap:20, marginBottom:20 }}>
                <div className="anl-card fu">
                  <div className="anl-card-hdr">
                    <div><h3>{I.trend} Évolution financière mensuelle</h3><p>CA vs Dépenses vs Bénéfice</p></div>
                    <button className="abtn abtn-ghost abtn-sm" onClick={() => toast.success("📊 Export Excel")}>{I.dl} Excel</button>
                  </div>
                  <div style={{ padding:20 }}>
                    <LineChart
                      labels={MOIS}
                      datasets={[
                        { label:"Chiffre d'affaires", data:[28,32,30,35,38,36,31,25,33,37,34,40].map(v=>v*1000000), borderColor:"#059669", backgroundColor:"rgba(5,150,105,.1)", tension:.4, fill:false, pointRadius:4, pointBackgroundColor:"#059669" },
                        { label:"Dépenses",           data:[11,13,12,13,14,13,12,10,12,14,13,15].map(v=>v*1000000), borderColor:"#DC2626", backgroundColor:"rgba(220,38,38,.08)", tension:.4, fill:false, borderDash:[4,4], pointRadius:3, pointBackgroundColor:"#DC2626" },
                        { label:"Bénéfice",           data:[17,19,18,22,24,23,19,15,21,23,21,25].map(v=>v*1000000), borderColor:"#0EA5A0", backgroundColor:"rgba(14,165,160,.12)", tension:.4, fill:true, pointRadius:4, pointBackgroundColor:"#0EA5A0" },
                      ]}
                      height={220}
                    />
                  </div>
                </div>

                <div className="anl-card fu">
                  <div className="anl-card-hdr"><div><h3>Répartition du CA</h3></div></div>
                  <div style={{ padding:20 }}>
                    <DonutChart
                      labels={DEMO_REVENUS_BAR.labels}
                      data={DEMO_REVENUS_BAR.data}
                      colors={DEMO_REVENUS_BAR.colors}
                      height={200}
                    />
                  </div>
                </div>
              </div>

              {/* Revenus par service barchart */}
              <div className="anl-card fu" style={{ marginBottom:20 }}>
                <div className="anl-card-hdr"><div><h3>{I.money} Revenus détaillés par source</h3><p>En CFA — {periode==="mois"?"Ce mois":"Cette période"}</p></div></div>
                <div style={{ padding:20 }}>
                  <BarChart labels={DEMO_REVENUS_BAR.labels} data={DEMO_REVENUS_BAR.data} colors={DEMO_REVENUS_BAR.colors} height={200} />
                </div>
              </div>

              {/* Tableau revenus */}
              <div className="anl-card fu">
                <div className="anl-card-hdr">
                  <div><h3>💹 Tableau financier détaillé</h3></div>
                  <div style={{ display:"flex", gap:6 }}>
                    <button className="abtn abtn-ghost abtn-sm" onClick={() => toast.success("📊 Export Excel")}>{I.dl} Excel</button>
                    <button className="abtn abtn-ghost abtn-sm" onClick={() => toast.success("📁 Export CSV")}>📁 CSV</button>
                  </div>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table className="anl-tbl">
                    <thead><tr><th>Service</th><th style={{textAlign:"right"}}>Revenus (CFA)</th><th style={{textAlign:"right"}}>Part (%)</th><th style={{textAlign:"right"}}>vs Mois préc.</th><th>Tendance</th><th>Statut</th></tr></thead>
                    <tbody>
                      {DEMO_REVENUS_BAR.labels.map((lbl,i) => {
                        const val = DEMO_REVENUS_BAR.data[i];
                        const total = DEMO_REVENUS_BAR.data.reduce((a,b)=>a+b,0);
                        const pct = Math.round(val/total*100);
                        const trend = [12,8,-2,15,6,22][i];
                        return (
                          <tr key={lbl}>
                            <td>
                              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                <div style={{ width:10, height:10, borderRadius:3, background:DEMO_REVENUS_BAR.colors[i] }} />
                                <span style={{ fontWeight:600, color:"var(--an)" }}>{lbl}</span>
                              </div>
                            </td>
                            <td style={{ textAlign:"right", fontWeight:700, color:"var(--an)" }}>{val.toLocaleString("fr-FR")}</td>
                            <td style={{ textAlign:"right" }}><Badge cls="blue">{pct}%</Badge></td>
                            <td style={{ textAlign:"right", color: trend>0?"var(--ag)":"var(--ar)", fontWeight:700, display:"flex", alignItems:"center", justifyContent:"flex-end", gap:3 }}>
                              {trend>0?I.up:I.down} {Math.abs(trend)}%
                            </td>
                            <td>
                              <div style={{ width:80, height:5, background:"#EEF4FF", borderRadius:99, overflow:"hidden" }}>
                                <div style={{ height:"100%", width:`${pct*2}%`, background:DEMO_REVENUS_BAR.colors[i], borderRadius:99, transition:"width .8s" }} />
                              </div>
                            </td>
                            <td><Badge cls={trend>10?"green":trend>0?"teal":"orange"}>{trend>10?"⬆ Excellent":trend>0?"⬆ En hausse":"⬇ Stable"}</Badge></td>
                          </tr>
                        );
                      })}
                      <tr style={{ background:"linear-gradient(to right,#EEF4FF,#DBEAFE)", fontWeight:800 }}>
                        <td style={{ color:"var(--an)" }}>TOTAL</td>
                        <td style={{ textAlign:"right", color:"var(--ab)", fontSize:15 }}>{DEMO_REVENUS_BAR.data.reduce((a,b)=>a+b,0).toLocaleString("fr-FR")}</td>
                        <td style={{ textAlign:"right" }}><Badge cls="blue">100%</Badge></td>
                        <td style={{ textAlign:"right", color:"var(--ag)", fontWeight:700, display:"flex", alignItems:"center", justifyContent:"flex-end", gap:3 }}>{I.up} 12.5%</td>
                        <td></td>
                        <td><Badge cls="green">⬆ Excellent</Badge></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ PERFORMANCE ══════════ */}
          {tab === "performance" && (
            <div>
              {/* Indicateurs performance */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:16, marginBottom:24 }}>
                {DEMO_PERF.map((p,i) => (
                  <div key={p.label} className={`anl-card fu d${i+1}`}>
                    <div style={{ padding:20, textAlign:"center" }}>
                      <div style={{ fontSize:28, marginBottom:10 }}>{p.icon}</div>
                      <div style={{ fontSize:32, fontWeight:800, color:p.color, letterSpacing:-1, marginBottom:4 }}>
                        {p.val}{p.unit}
                      </div>
                      <div style={{ fontSize:12, fontWeight:600, color:"var(--am)", marginBottom:12 }}>{p.label}</div>
                      <Prog pct={typeof p.val==="number"&&p.unit==="%"?p.val:Math.min(100,p.val*2)} color={p.color} h={8} />
                      <div style={{ marginTop:10 }}>
                        <Badge cls={p.good===true?"green":p.good===false?"orange":"blue"}>
                          {p.good===true?"✅ Objectif atteint":p.good===false?"⚠ À améliorer":"ℹ Dans les normes"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Satisfaction détaillée */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20, marginBottom:20 }}>
                <div className="anl-card fu">
                  <div className="anl-card-hdr"><div><h3>😊 Satisfaction patient détaillée</h3><p>Score global : 87/100</p></div></div>
                  <div style={{ padding:20 }}>
                    {[
                      ["Accueil & réception",      92, "#059669"],
                      ["Qualité des soins",         89, "#0EA5A0"],
                      ["Temps d'attente",           71, "#D97706"],
                      ["Communication médecin",     88, "#1B4F9E"],
                      ["Propreté & confort",        94, "#059669"],
                      ["Rapport qualité/prix",      82, "#7C3AED"],
                      ["Suivi post-consultation",   79, "#D97706"],
                    ].map(([lbl,val,col])=>(
                      <div key={lbl} style={{ marginBottom:12 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, fontSize:12 }}>
                          <span style={{ color:"var(--am)", fontWeight:600 }}>{lbl}</span>
                          <span style={{ fontWeight:800, color:col }}>{val}%</span>
                        </div>
                        <Prog pct={val} color={col} h={6} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="anl-card fu">
                  <div className="anl-card-hdr"><div><h3>⏱ Temps de prise en charge</h3><p>Analyse des délais</p></div></div>
                  <div style={{ padding:20 }}>
                    <LineChart
                      labels={["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"]}
                      datasets={[
                        { label:"Temps attente (min)", data:[18,22,35,28,25,15,10], borderColor:"#D97706", backgroundColor:"rgba(215,119,6,.1)", tension:.4, fill:true, pointRadius:4, pointBackgroundColor:"#D97706" },
                        { label:"Temps consultation (min)", data:[22,24,26,25,24,20,18], borderColor:"#1B4F9E", backgroundColor:"rgba(27,79,158,.06)", tension:.4, fill:false, borderDash:[5,5], pointRadius:3, pointBackgroundColor:"#1B4F9E" },
                      ]}
                      height={200}
                    />
                    <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:10, marginTop:16 }}>
                      {[["Attente moy.","22 min","var(--ao)"],["Consultation moy.","24 min","var(--ab)"],["Prise charge totale","46 min","var(--at)"]].map(([lbl,val,col])=>(
                        <div key={lbl} className="mini-kpi" style={{ textAlign:"center" }}>
                          <div className="mini-kpi-val" style={{ color:`${col}`, fontSize:16 }}>{val}</div>
                          <div className="mini-kpi-lbl" style={{ fontSize:10 }}>{lbl}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* IA Recommandations performance */}
              <div className="anl-card fu">
                <div className="anl-card-hdr"><h3>{I.ia} Recommandations IA — Amélioration de la performance</h3></div>
                <div style={{ padding:20, display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                  {[
                    { col:"#DC2626", ico:"🔴", titre:"Priorité haute", desc:"Réduire le temps d'attente urgences > 30 min — Impact : 23% des patients insatisfaits" },
                    { col:"#D97706", ico:"🟠", titre:"Suivi recommandé", desc:"Taux de retour patients 68% — Mettre en place système de rappel automatique" },
                    { col:"#059669", ico:"🟢", titre:"Bonne pratique",   desc:"Taux de satisfaction soins 89% — Maintenir les protocoles actuels" },
                    { col:"#1B4F9E", ico:"🔵", titre:"Optimisation",     desc:"Rotation des lits optimisable : 72% d'occupation — Planifier sortie H+4" },
                    { col:"#7C3AED", ico:"🟣", titre:"Analyse IA",       desc:"Pic de consultations mardi-vendredi — Renforcer le personnel ces jours" },
                    { col:"#0EA5A0", ico:"💡", titre:"Innovation",        desc:"Téléconsultation : réduire délais de 40% pour consultations de suivi chronique" },
                  ].map((r,i)=>(
                    <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:12, background:"#F8FAFD", borderRadius:12, padding:"12px 14px", borderLeft:`3px solid ${r.col}` }}>
                      <span style={{ fontSize:18, flexShrink:0 }}>{r.ico}</span>
                      <div>
                        <div style={{ fontWeight:700, fontSize:12.5, color:"var(--an)" }}>{r.titre}</div>
                        <div style={{ fontSize:11.5, color:"var(--am)", marginTop:2, lineHeight:1.5 }}>{r.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════════ ALERTES ══════════ */}
          {tab === "alertes" && (
            <div>
              {/* Stats alertes */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
                {[
                  { color:"red",    val:DEMO_ALERTES_MED.filter(a=>a.type==="danger").length + DEMO_ALERTES_ADM.filter(a=>a.type==="danger").length, label:"Critiques", urgent:true },
                  { color:"orange", val:DEMO_ALERTES_MED.filter(a=>a.type==="warn").length + DEMO_ALERTES_ADM.filter(a=>a.type==="warn").length, label:"Avertissements" },
                  { color:"blue",   val:DEMO_ALERTES_MED.filter(a=>a.type==="info").length, label:"Informations" },
                  { color:"green",  val:12, label:"Résolues ce mois" },
                ].map((k,i) => (
                  <div key={i} className={`anl-kpi ${k.color} fu`}>
                    {k.urgent && <div className="akpi-dot" />}
                    <div className="akpi-val">{k.val}</div>
                    <div className="akpi-lbl">{k.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                {/* Alertes médicales */}
                <div className="anl-card fu">
                  <div className="anl-card-hdr">
                    <h3>🏥 Alertes médicales</h3>
                    <Badge cls="red">{DEMO_ALERTES_MED.filter(a=>a.type==="danger").length} critiques</Badge>
                  </div>
                  <div style={{ padding:14 }}>
                    {DEMO_ALERTES_MED.map((al,i)=>(
                      <div key={i} className={`alert-item al-${al.type}`} style={{ marginBottom:10, borderRadius:12 }}>
                        <div className="alert-icon" style={{ background: al.type==="danger"?"#FEE2E2":al.type==="warn"?"#FEF3C7":"#DBEAFE", fontSize:20 }}>{al.icon}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:"var(--an)" }}>{al.titre}</div>
                          <div style={{ fontSize:11.5, color:"var(--am)", marginTop:3, lineHeight:1.4 }}>{al.detail}</div>
                          <div style={{ fontSize:10, color:"var(--am)", marginTop:4 }}>🕐 {al.heure}</div>
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
                          <Badge cls={al.type==="danger"?"red":al.type==="warn"?"orange":"blue"}>{al.type==="danger"?"🚨 Critique":al.type==="warn"?"⚠ Alerte":"ℹ Info"}</Badge>
                          <button className="abtn abtn-ghost abtn-sm" style={{ fontSize:10, padding:"3px 8px" }} onClick={() => toast.success("✅ Alerte marquée comme traitée")}>Traiter</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alertes administratives */}
                <div className="anl-card fu">
                  <div className="anl-card-hdr">
                    <h3>⚙️ Alertes administratives</h3>
                    <Badge cls="red">{DEMO_ALERTES_ADM.filter(a=>a.type==="danger").length} critiques</Badge>
                  </div>
                  <div style={{ padding:14 }}>
                    {DEMO_ALERTES_ADM.map((al,i)=>(
                      <div key={i} className={`alert-item al-${al.type}`} style={{ marginBottom:10, borderRadius:12 }}>
                        <div className="alert-icon" style={{ background: al.type==="danger"?"#FEE2E2":"#FEF3C7", fontSize:20 }}>{al.icon}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:"var(--an)" }}>{al.titre}</div>
                          <div style={{ fontSize:11.5, color:"var(--am)", marginTop:3, lineHeight:1.4 }}>{al.detail}</div>
                          <div style={{ fontSize:10, color:"var(--am)", marginTop:4 }}>🕐 {al.heure}</div>
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
                          <Badge cls={al.type==="danger"?"red":"orange"}>{al.type==="danger"?"🚨 Critique":"⚠ Alerte"}</Badge>
                          <button className="abtn abtn-ghost abtn-sm" style={{ fontSize:10, padding:"3px 8px" }} onClick={() => toast.success("✅ Alerte traitée")}>Traiter</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section export */}
              <div className="anl-card fu" style={{ marginTop:20 }}>
                <div className="anl-card-hdr"><h3>📤 Exportation des rapports</h3></div>
                <div style={{ padding:20, display:"flex", gap:12, flexWrap:"wrap" }}>
                  {[
                    { icon:"📄", label:"Rapport complet PDF",  fn:()=>toast.success("📄 Rapport PDF généré"), cls:"abtn-teal" },
                    { icon:"📊", label:"Export Excel",          fn:()=>toast.success("📊 Export Excel généré"), cls:"abtn-primary" },
                    { icon:"📁", label:"Export CSV",            fn:()=>toast.success("📁 Export CSV généré"),  cls:"abtn-ghost" },
                    { icon:"🖨",  label:"Impression",            fn:()=>window.print(),                         cls:"abtn-ghost" },
                    { icon:"📧", label:"Envoyer par e-mail",    fn:()=>toast.success("📧 Rapport envoyé par email"), cls:"abtn-ghost" },
                  ].map((b,i)=>(
                    <button key={i} className={`abtn ${b.cls}`} onClick={b.fn}>
                      <span>{b.icon}</span> {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}