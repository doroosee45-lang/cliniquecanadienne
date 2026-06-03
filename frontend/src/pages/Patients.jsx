
import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from 'react-redux';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchPatients, createPatient, updatePatient, deletePatient,
  selectPatients, selectPatientsTotal, selectPatientsLoading, selectPatientsSaving,
  selectPatientsPage, setPage as setReduxPage,
} from '../store/slices/patientsSlice';

// ─── Chart.js loader ─────────────────────────────────────────
function loadChartJs(cb) {
  if (window.Chart) { cb(); return; }
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
  s.onload = cb;
  document.head.appendChild(s);
}

// ─── SAME CSS as Chirurgie (Medical Navy + Teal) ──────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.pat * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --cn: #0B1E3B; --cn2: #132744; --cb: #1B4F9E;
  --ct: #0EA5A0; --ct2: #0D9490; --cr: #DC2626;
  --co: #D97706; --cg: #059669; --cp: #7C3AED;
  --cbr: #E2EAF4; --cm: #6B7A99; --cl: #EEF4FF; --cs: #F8FAFD;
  --sh: 0 1px 3px rgba(11,30,59,.08); --shm: 0 4px 16px rgba(11,30,59,.10); --shl: 0 12px 40px rgba(11,30,59,.14);
}

/* Topbar */
.pat-top { background:linear-gradient(135deg,var(--cn) 0%,var(--cn2) 55%,#1B4F9E 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.pat-top::before { content:''; position:absolute; top:-50px; right:-50px; width:200px; height:200px; background:radial-gradient(circle,rgba(14,165,160,.22) 0%,transparent 70%); border-radius:50%; pointer-events:none; }

/* Tabs */
.pat-tabs { display:flex; gap:2px; padding:0; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.pat-tabs::-webkit-scrollbar { display:none; }
.pat-tab { display:flex; align-items:center; gap:7px; padding:10px 18px 12px; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.55); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.pat-tab:hover { color:rgba(255,255,255,.88); background:rgba(255,255,255,.08); }
.pat-tab.active { color:var(--cn); background:var(--cs); box-shadow:0 -2px 0 var(--ct) inset; }
.pat-tab-badge { background:var(--cr); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:99px; animation:patP 2s infinite; }
@keyframes patP { 0%,100%{opacity:1} 50%{opacity:.4} }

/* Cards */
.pat-card { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; }
.pat-card:hover { box-shadow:var(--shm); }
.pat-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.pat-card-hdr h3 { font-size:14px; font-weight:700; color:var(--cn); margin:0; display:flex; align-items:center; gap:8px; }
.pat-card-hdr p  { font-size:11px; color:var(--cm); margin:2px 0 0; }

/* KPI */
.pat-kpi { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:pointer; }
.pat-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.pat-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.pat-kpi.blue::before   { background:var(--cb); } .pat-kpi.teal::before   { background:var(--ct); }
.pat-kpi.red::before    { background:var(--cr); } .pat-kpi.orange::before { background:var(--co); }
.pat-kpi.green::before  { background:var(--cg); } .pat-kpi.purple::before { background:var(--cp); }
.kpi-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
.kpi-icon.blue   { background:#EFF6FF; color:var(--cb); } .kpi-icon.teal   { background:#F0FDFC; color:var(--ct); }
.kpi-icon.red    { background:#FEF2F2; color:var(--cr); } .kpi-icon.orange { background:#FFF7ED; color:var(--co); }
.kpi-icon.green  { background:#ECFDF5; color:var(--cg); } .kpi-icon.purple { background:#F5F3FF; color:var(--cp); }
.kpi-val { font-size:26px; font-weight:800; color:var(--cn); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.kpi-lbl { font-size:11.5px; font-weight:600; color:var(--cm); }
.kpi-sub { font-size:10.5px; color:#9CA3AF; margin-top:2px; }
.kpi-dot { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--cr); animation:patP 2s infinite; }

/* Badges */
.pbdg { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.pbdg.red    { background:#FEF2F2; color:var(--cr); border:1px solid #FECACA; }
.pbdg.orange { background:#FFF7ED; color:var(--co); border:1px solid #FED7AA; }
.pbdg.yellow { background:#FEFCE8; color:#CA8A04;   border:1px solid #FEF08A; }
.pbdg.green  { background:#ECFDF5; color:var(--cg); border:1px solid #A7F3D0; }
.pbdg.blue   { background:#EFF6FF; color:var(--cb); border:1px solid #BFDBFE; }
.pbdg.teal   { background:#F0FDFC; color:var(--ct); border:1px solid #99F6E4; }
.pbdg.purple { background:#F5F3FF; color:var(--cp); border:1px solid #DDD6FE; }
.pbdg.gray   { background:#F9FAFB; color:#4B5563;   border:1px solid #E5E7EB; }

/* Progress */
.pat-prog { background:#EEF4FF; border-radius:99px; height:7px; overflow:hidden; }
.pat-prog-f { height:100%; border-radius:99px; transition:width .5s; }

/* Buttons */
.pbtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; text-decoration:none; }
.pbtn-primary { background:var(--cb); color:#fff; } .pbtn-primary:hover { background:#174391; transform:translateY(-1px); }
.pbtn-teal    { background:var(--ct); color:#fff; } .pbtn-teal:hover    { background:var(--ct2); transform:translateY(-1px); }
.pbtn-ghost   { background:transparent; color:var(--cm); border:1.5px solid var(--cbr); }
.pbtn-ghost:hover { background:var(--cl); color:var(--cn); }
.pbtn-danger  { background:#FEF2F2; color:var(--cr); border:1.5px solid #FECACA; }
.pbtn-danger:hover { background:var(--cr); color:#fff; }
.pbtn-sm { padding:6px 12px; font-size:12px; }
.pbtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }

/* Forms */
.plbl { font-size:12px; font-weight:600; color:var(--cm); margin-bottom:6px; display:block; }
.pinp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--cbr); background:#FAFBFF; font-size:13px; color:var(--cn); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.pinp:focus { border-color:var(--ct); box-shadow:0 0 0 3px rgba(14,165,160,.12); }

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

/* Table */
.pat-tbl { width:100%; border-collapse:collapse; }
.pat-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.pat-tbl th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--cm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--cbr); white-space:nowrap; }
.pat-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.pat-tbl tbody tr:last-child td { border-bottom:none; }
.pat-tbl tbody tr:hover { background:#F8FAFF; }

/* Modal */
.mov { position:fixed; inset:0; z-index:500; background:rgba(11,30,59,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.mov-box { background:#fff; border-radius:20px; box-shadow:var(--shl); width:100%; max-width:620px; max-height:90vh; overflow-y:auto; animation:slideUp .25s ease; }
@keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.mov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:#EEF4FF; position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.mov-hdr h3 { font-size:16px; font-weight:700; color:var(--cn); margin:0; display:flex; align-items:center; gap:10px; }
.mov-cls { width:32px; height:32px; border-radius:8px; background:#F3F7FF; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--cm); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.mov-cls:hover { background:#FEF2F2; color:var(--cr); }
.mov-body { padding:24px; }

/* Vital */
.vital { background:#F8FAFD; border:1.5px solid var(--cbr); border-radius:12px; padding:12px 16px; text-align:center; }
.vital-v { font-size:22px; font-weight:800; color:var(--cn); }
.vital-l { font-size:10px; color:var(--cm); font-weight:600; text-transform:uppercase; margin-top:2px; }

/* Timeline */
.tl-line { position:relative; padding-left:28px; }
.tl-line::before { content:''; position:absolute; left:9px; top:0; bottom:0; width:2px; background:var(--cbr); }
.tl-dot { position:absolute; left:0; width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; border:2px solid white; box-shadow:var(--sh); }

/* Fade */
@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
.fu { animation:fadeUp .35s ease both; }

/* Avatar */
.pat-avatar { width:72px; height:72px; border-radius:18px; background:rgba(255,255,255,.15); border:2px solid rgba(255,255,255,.25); display:flex; align-items:center; justify-content:center; font-size:32px; flex-shrink:0; }

/* Status dot */
.stat-dot { width:10px; height:10px; border-radius:50%; display:inline-block; }
.stat-dot.active { background:var(--cg); box-shadow:0 0 0 3px rgba(5,150,105,.2); animation:patP 2s infinite; }
.stat-dot.inactive { background:var(--cm); }
.stat-dot.deceased { background:var(--cr); }

/* Info grid */
.info-cell { background:#F8FAFD; border-radius:10px; padding:10px 14px; }
.info-cell .ic-lbl { font-size:10px; font-weight:600; color:var(--cm); text-transform:uppercase; letter-spacing:.4px; }
.info-cell .ic-val { font-size:13px; font-weight:600; color:var(--cn); margin-top:3px; }

/* Metric card */
.metric-row { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:10px; background:#F8FAFD; border:1.5px solid var(--cbr); margin-bottom:8px; }
`;

// ─── SVG Icons ────────────────────────────────────────────────
const I = {
  user:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  plus:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  save:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  file:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  calendar:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  flask:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 3h6M9 3v8L5.5 17A2 2 0 007.3 20h9.4a2 2 0 001.8-3L15 11V3"/></svg>,
  scan:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>,
  heart:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  pill:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.5 20H4a2 2 0 01-2-2V6a2 2 0 012-2h16a2 2 0 012 2v7"/><path d="M16 19h6M19 16v6"/></svg>,
  dollar:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  folder:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  shield:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  clock:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  alert:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  syringe: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 2l4 4-1.5 1.5-4-4L18 2zM14 6l4 4M5 15l-3 3 1 1 3-3M2 20l2-2M9 9l6 6M7 11l-2 2 4 4 2-2"/></svg>,
  bed:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 4v16M2 8h20v12H2M2 8c0-2.2 1.8-4 4-4h12c2.2 0 4 1.8 4 4"/><circle cx="8" cy="12" r="1.5"/></svg>,
  scalpel: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.5 4l5.5 5.5-14 14L2 20l3-3.5 14-12.5z"/><path d="M11.5 6.5L16 11"/></svg>,
  qr:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/><path d="M21 16h-3a2 2 0 00-2 2v3M16 11h5M11 21v-5h-5"/><rect x="7" y="7" width="3" height="3"/><rect x="14" y="14" width="3" height="3"/></svg>,
  print:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  dl:      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  search:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  grid:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  list:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  open:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
};

// ─── Helpers ──────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const fmtDateInput = (d) => d ? new Date(d).toISOString().substring(0, 10) : "";
const ageCalc = (dob) => {
  if (!dob) return "—";
  const y = Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 3600 * 1000));
  return `${y} ans`;
};

// ─── DEMO DATA ────────────────────────────────────────────────
const DEMO_PATIENTS = [
  { _id:"1", numero:"PAT-2025-0001", nom:"Dupont", prenom:"Jean", date_naissance:"1975-04-12", sexe:"homme", groupe_sanguin:"O+", telephone:"06 12 34 56 78", email:"jean.dupont@email.com", adresse:"12 Rue de la Paix, Paris", statut:"actif", nationalite:"Française", situation_mat:"marié", allergies:"Pénicilline", maladies_chroniques:["Hypertension","Diabète type 2"], nb_consultations:8, nb_hospitalisations:1, nb_analyses:12, nb_imageries:3, nb_chirurgies:1, solde:45000, date_inscription:"2023-01-15" },
  { _id:"2", numero:"PAT-2025-0002", nom:"Paul", prenom:"Marie", date_naissance:"1988-11-03", sexe:"femme", groupe_sanguin:"A+", telephone:"05 98 76 54 32", email:"marie.paul@email.com", adresse:"8 Avenue Lumumba, Brazzaville", statut:"actif", nationalite:"Congolaise", situation_mat:"célibataire", allergies:null, maladies_chroniques:["Fibrome utérin"], nb_consultations:4, nb_hospitalisations:0, nb_analyses:6, nb_imageries:2, nb_chirurgies:0, solde:12000, date_inscription:"2024-03-20" },
  { _id:"3", numero:"PAT-2025-0003", nom:"Nguema", prenom:"Paul", date_naissance:"1962-07-22", sexe:"homme", groupe_sanguin:"B+", telephone:"06 55 00 11 22", email:"paul.nguema@email.com", adresse:"45 Bd du 30 Juin, Kinshasa", statut:"inactif", nationalite:"Gabonaise", situation_mat:"veuf", allergies:"Aspirine, Latex", maladies_chroniques:["Diabète","Insuffisance rénale","Cardiopathie"], nb_consultations:15, nb_hospitalisations:3, nb_analyses:28, nb_imageries:7, nb_chirurgies:2, solde:0, date_inscription:"2022-06-10" },
  { _id:"4", numero:"PAT-2025-0004", nom:"Bongo", prenom:"Fatou", date_naissance:"1995-02-14", sexe:"femme", groupe_sanguin:"AB+", telephone:"05 22 33 44 55", email:"fatou.bongo@email.com", adresse:"3 Rue Pointe-Noire, Souanké", statut:"actif", nationalite:"Gabonaise", situation_mat:"mariée", allergies:null, maladies_chroniques:[], nb_consultations:2, nb_hospitalisations:0, nb_analyses:3, nb_imageries:1, nb_chirurgies:0, solde:8000, date_inscription:"2025-01-10" },
];

const DEMO_CONSULTATIONS = [
  { _id:"c1", date:"2025-05-28", medecin:"Dr. Leblanc", motif:"Douleurs abdominales", diagnostic:"Appendicite aiguë", statut:"terminé" },
  { _id:"c2", date:"2025-04-10", medecin:"Dr. Sophie Pierre", motif:"Contrôle tension artérielle", diagnostic:"HTA équilibrée", statut:"terminé" },
  { _id:"c3", date:"2025-02-14", medecin:"Dr. Martin Leblanc", motif:"Bilan diabétique annuel", diagnostic:"Diabète type 2 — HbA1c 7.2%", statut:"terminé" },
];

const DEMO_RDV = [
  { _id:"r1", date:"2025-07-15", heure:"09:30", medecin:"Dr. Leblanc", service:"Chirurgie", statut:"planifié" },
  { _id:"r2", date:"2025-07-22", heure:"11:00", medecin:"Dr. Pierre", service:"Gynécologie", statut:"planifié" },
  { _id:"r3", date:"2025-06-01", heure:"14:00", medecin:"Dr. Leblanc", service:"Médecine générale", statut:"honoré" },
];

const DEMO_ANALYSES = [
  { _id:"a1", type:"NFS complète", date:"2025-06-01", prescripteur:"Dr. Leblanc", statut:"normal", valeur:"Hb: 12.5 g/dL", val_norm:"12-16 g/dL" },
  { _id:"a2", type:"Glycémie à jeun", date:"2025-06-01", prescripteur:"Dr. Leblanc", statut:"anormal", valeur:"7.2 mmol/L", val_norm:"3.9-5.5 mmol/L" },
  { _id:"a3", type:"Créatinine", date:"2025-05-28", prescripteur:"Dr. Pierre", statut:"normal", valeur:"85 µmol/L", val_norm:"44-97 µmol/L" },
  { _id:"a4", type:"HbA1c", date:"2025-04-10", prescripteur:"Dr. Leblanc", statut:"anormal", valeur:"7.8%", val_norm:"< 6.5%" },
];

const DEMO_IMAGERIE = [
  { _id:"i1", type:"Échographie abdominale", date:"2025-05-28", resultat:"Appendicite aiguë confirmée", compte_rendu:"Appendice mesurant 9mm, non compressible. Pas d'épanchement." },
  { _id:"i2", type:"Radiographie thorax", date:"2025-02-14", resultat:"Normal", compte_rendu:"Pas d'opacité ni de cardiomégalie. Sinus libres." },
];

const DEMO_HOSPIT = [
  { _id:"h1", date_entree:"2025-05-28", date_sortie:"2025-06-02", service:"Chirurgie", chambre:"102A", medecin:"Dr. Leblanc", statut:"terminé" },
];

const DEMO_VACCINS = [
  { _id:"v1", vaccin:"COVID-19 (dose 3)", date:"2023-10-15", prochaine_dose:"2024-10-15", statut:"en_retard" },
  { _id:"v2", vaccin:"Grippe saisonnière", date:"2024-11-01", prochaine_dose:"2025-11-01", statut:"ok" },
  { _id:"v3", vaccin:"Tétanos-Diphtérie", date:"2020-06-10", prochaine_dose:"2030-06-10", statut:"ok" },
  { _id:"v4", vaccin:"Fièvre jaune", date:"2018-03-22", prochaine_dose:null, statut:"ok" },
];

const DEMO_FACTURES = [
  { _id:"f1", type:"Consultation", date:"2025-05-28", montant:25000, paye:25000, mode:"Espèces", statut:"payé" },
  { _id:"f2", type:"Chirurgie — Appendicectomie", date:"2025-06-01", montant:450000, paye:405000, mode:"Assurance", statut:"partiel" },
  { _id:"f3", type:"Laboratoire", date:"2025-06-01", montant:35000, paye:0, mode:"—", statut:"impayé" },
];

const DEMO_DOCS = [
  { _id:"d1", type:"Ordonnance", nom:"Ordonnance postopératoire", date:"2025-06-02", format:"PDF" },
  { _id:"d2", type:"Résultat", nom:"NFS + Glycémie 01/06/2025", date:"2025-06-01", format:"PDF" },
  { _id:"d3", type:"Rapport", nom:"Compte rendu opératoire", date:"2025-06-01", format:"PDF" },
  { _id:"d4", type:"Administratif", nom:"Carte nationale identité", date:"2025-01-10", format:"Image" },
  { _id:"d5", type:"Certificat", nom:"Certificat médical repos", date:"2025-06-02", format:"PDF" },
];

const DEMO_AUDIT = [
  { _id:"au1", action:"Consultation du dossier", utilisateur:"Dr. Leblanc", date:"2025-06-02", heure:"10:34", details:"Vue d'ensemble" },
  { _id:"au2", action:"Ajout compte rendu opératoire", utilisateur:"Dr. Leblanc", date:"2025-06-01", heure:"16:20", details:"Section Chirurgie" },
  { _id:"au3", action:"Téléchargement résultats labo", utilisateur:"Mme. Infirmière", date:"2025-06-01", heure:"14:05", details:"NFS + Glycémie" },
  { _id:"au4", action:"Création du dossier", utilisateur:"Admin", date:"2023-01-15", heure:"09:00", details:"Inscription initiale" },
];

// ─── Sub-components ───────────────────────────────────────────
function Badge({ cls, children }) {
  return <span className={`pbdg ${cls}`}>{children}</span>;
}

function KpiCard({ color, icon, value, label, sub, urgent, onClick }) {
  return (
    <div className={`pat-kpi ${color} fu`} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      {urgent && <div className="kpi-dot" />}
      <div className={`kpi-icon ${color}`}>{icon}</div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-lbl">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

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

function InfoCell({ label, value, full, warn }) {
  return (
    <div className="info-cell" style={full ? { gridColumn:"1/-1" } : {}}>
      {warn
        ? <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, padding:"8px 12px" }}>
            <div className="ic-lbl" style={{ color:"#B91C1C" }}>⚠ {label}</div>
            <div className="ic-val" style={{ color:"#DC2626" }}>{value}</div>
          </div>
        : <>
            <div className="ic-lbl">{label}</div>
            <div className="ic-val">{value}</div>
          </>
      }
    </div>
  );
}

// ─── LINE CHART ───────────────────────────────────────────────
function LineChart({ labels, data, color = "#0EA5A0", height = 160 }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new window.Chart(ref.current, {
        type: "line",
        data: {
          labels,
          datasets: [{ label: "", data, borderColor: color, backgroundColor: `${color}18`, fill: true, tension: 0.4, pointBackgroundColor: color, pointRadius: 3, borderWidth: 2 }],
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: { legend: { display: false }, tooltip: { backgroundColor: "#0B1E3B", padding: 10, cornerRadius: 10 } },
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

// ═════════════════════════════════════════════════════════════
export default function Patient() {
  const dispatch = useDispatch();
  const reduxPatients = useSelector(selectPatients);
  const reduxLoading = useSelector(selectPatientsLoading);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => { const fn = () => setIsMobile(window.innerWidth <= 599); window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn); }, []);
  const [tab, setTab] = useState("liste");
  const [section, setSection] = useState("overview");
  const [currentPatient, setCurrentPatient] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [modalNouv, setModalNouv] = useState(false);
  const [modalRdv, setModalRdv] = useState(false);
  const [saving, setSaving] = useState(false);

  const FORM_INIT = {
    nom:"", prenom:"", date_naissance:"", sexe:"",
    telephone:"", email:"", groupe_sanguin:"", nationalite:"", situation_mat:"",
    allergies:"", photo:"",
    adresse:{ rue:"", ville:"", pays:"Congo", code_postal:"" },
    assurances:[],
    contact_urgence:{ nom:"", relation:"", telephone:"" },
  };
  const [formPatient, setFormPatient] = useState(FORM_INIT);
  const [formError,   setFormError]   = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [patientExistant, setPatientExistant] = useState(null);

  useEffect(() => {
    dispatch(fetchPatients({ page: 1, limit: 100, search, statut: filterStatut }));
  }, [dispatch, search, filterStatut]);

  const patients = reduxPatients.length > 0 ? reduxPatients : DEMO_PATIENTS;
  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${p.prenom} ${p.nom} ${p.numero}`.toLowerCase().includes(q);
    const matchStatut = !filterStatut || p.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const openPatient = (p) => {
    setCurrentPatient(p);
    setSection("overview");
    setTab("dossier");
  };

  const kpis = {
    total: patients.length,
    actifs: patients.filter(p => p.statut === "actif").length,
    inactifs: patients.filter(p => p.statut === "inactif").length,
    allergies: patients.filter(p => Array.isArray(p.allergies) ? p.allergies.length > 0 : !!p.allergies).length,
    chroniques: patients.filter(p => p.maladies_chroniques && p.maladies_chroniques.length > 0).length,
  };

  const STATUT_CFG = {
    actif:{ cls:"green", label:"Actif" }, inactif:{ cls:"gray", label:"Inactif" },
    décédé:{ cls:"red", label:"Décédé" }, decede:{ cls:"red", label:"Décédé" },
  };
  const SEXE_ICON = { M:"👨", F:"👩", homme:"👨", femme:"👩" };

  // ── Sections nav for dossier
  const SECTIONS = [
    { id:"overview",      label:"📊 Vue d'ensemble" },
    { id:"infos",         label:"👤 Informations" },
    { id:"medical",       label:"🩺 Dossier médical" },
    { id:"consultations", label:`💬 Consultations (${DEMO_CONSULTATIONS.length})` },
    { id:"rdv",           label:`📅 Rendez-vous (${DEMO_RDV.length})` },
    { id:"laboratoire",   label:`🔬 Laboratoire (${DEMO_ANALYSES.length})` },
    { id:"imagerie",      label:`🩻 Imagerie (${DEMO_IMAGERIE.length})` },
    { id:"hospitalisation",label:`🛏 Hospitalisation (${DEMO_HOSPIT.length})` },
    { id:"chirurgie",     label:"🔪 Chirurgie" },
    { id:"vaccination",   label:`💉 Vaccination (${DEMO_VACCINS.length})` },
    { id:"finance",       label:"💰 Finance" },
    { id:"documents",     label:`📄 Documents (${DEMO_DOCS.length})` },
    { id:"audit",         label:"📋 Audit" },
  ];

  // ─── Helpers formulaire ───────────────────────────────────────
  const resetForm = () => { setFormPatient(FORM_INIT); setFormError(""); setFormSuccess(""); setPatientExistant(null); };

  const addAssurance = () => {
    if (formPatient.assurances.length < 2)
      setFormPatient(f => ({ ...f, assurances:[...f.assurances, { compagnie:"", numero_police:"", taux:0 }] }));
  };
  const removeAssurance = (idx) =>
    setFormPatient(f => ({ ...f, assurances: f.assurances.filter((_, i) => i !== idx) }));
  const updateAssurance = (idx, field, value) =>
    setFormPatient(f => ({ ...f, assurances: f.assurances.map((a, i) => i === idx ? { ...a, [field]: value } : a) }));

  const handleCreatePatient = async () => {
    setFormError(""); setFormSuccess(""); setPatientExistant(null);

    // Validation email
    if (formPatient.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formPatient.email)) {
      setFormError("L'adresse email saisie est invalide. Veuillez la corriger avant de continuer.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formPatient,
        allergies: formPatient.allergies
          ? formPatient.allergies.split(',').map(a => a.trim()).filter(Boolean)
          : [],
      };
      const result = await dispatch(createPatient(payload)).unwrap();
      setFormSuccess(result.message || "Dossier créé avec succès.");
      dispatch(fetchPatients({ page: 1, limit: 100 }));
      setTimeout(() => { setModalNouv(false); resetForm(); }, 3500);
    } catch (errData) {
      if (errData?.redirect === 'update') {
        setPatientExistant(errData);
      } else {
        setFormError(errData?.message || "Erreur lors de la création du dossier.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="pat">

        {/* ── TOPBAR ── */}
        <div className="pat-top">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap", position:"relative", zIndex:2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div className="pat-avatar">{I.user}</div>
              <div>
                <div style={{ fontSize:21, fontWeight:700, color:"#fff", letterSpacing:-.3 }}>Gestion des Patients</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.55)", marginTop:2 }}>{kpis.total} patients · Clinique Canadienne de Souanké</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button className="pbtn pbtn-teal" onClick={() => setModalNouv(true)}>
                {I.plus} Nouveau patient
              </button>
              {currentPatient && (
                <button className="pbtn pbtn-ghost" style={{ color:"#fff", borderColor:"rgba(255,255,255,.3)" }} onClick={() => window.print()}>
                  {I.print} Imprimer
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="pat-tabs">
            {[
              { key:"liste",   icon:I.list,     label:"Patients" },
              { key:"dossier", icon:I.file,     label: currentPatient ? `${currentPatient.prenom} ${currentPatient.nom}` : "Dossier patient", disabled:!currentPatient },
            ].filter(t => !t.disabled).map(t => (
              <button key={t.key} className={`pat-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
                {t.icon} <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div style={{ padding:24 }}>

          {/* ══ LISTE PATIENTS ══ */}
          {tab === "liste" && (
            <div>
              {/* KPIs */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="blue"   icon={I.user}    value={kpis.total}    label="Total patients"     sub="inscrits" />
                <KpiCard color="green"  icon={I.heart}   value={kpis.actifs}   label="Patients actifs"    sub="en suivi" />
                <KpiCard color="gray"   icon={I.clock}   value={kpis.inactifs} label="Inactifs"           sub="sans activité récente" />
                <KpiCard color="red"    icon={I.alert}   value={kpis.allergies} label="Avec allergies"    sub="alerte médicale" urgent={kpis.allergies > 0} />
                <KpiCard color="orange" icon={I.flask}   value={kpis.chroniques} label="Maladies chron."  sub="suivi long terme" />
              </div>

              {/* Filters */}
              <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                <div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>Tous les patients <span style={{ color:"var(--cm)", fontWeight:400, fontSize:13 }}>({filtered.length})</span></div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }}>{I.search}</span>
                    <input className="pinp" style={{ paddingLeft:34, width:220 }} placeholder="Nom, prénom, n° dossier..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <select className="pinp" style={{ width:160 }} value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
                    <option value="">Tous les statuts</option>
                    <option value="actif">Actif</option>
                    <option value="inactif">Inactif</option>
                    <option value="décédé">Décédé</option>
                  </select>
                  <button className="pbtn pbtn-primary" onClick={() => setModalNouv(true)}>{I.plus} Ajouter</button>
                </div>
              </div>

              <div className="pat-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="pat-tbl" style={{ minWidth:900 }}>
                    <thead>
                      <tr>
                        <th>N° Dossier</th><th>Patient</th><th>Âge / Sexe</th>
                        <th>Gr. sanguin</th><th>Téléphone</th><th>Allergies</th>
                        <th>Maladies chron.</th><th>Statut</th><th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(p => {
                        const sc = STATUT_CFG[p.statut] || { cls:"gray", label:p.statut };
                        return (
                          <tr key={p._id} style={{ background:p.allergies ? "#FFFBF8":"" }}>
                            <td><span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--cb)", fontSize:12 }}>{p.numero_dossier || p.numero}</span></td>
                            <td>
                              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                <div style={{ width:32, height:32, borderRadius:8, background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                                  {SEXE_ICON[p.sexe] || "👤"}
                                </div>
                                <div>
                                  <div style={{ fontWeight:700, color:"var(--cn)" }}>{p.prenom} {p.nom}</div>
                                  <div style={{ fontSize:10, color:"var(--cm)" }}>{p.email || "—"}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ fontSize:12 }}>{ageCalc(p.date_naissance)} · {p.sexe ? p.sexe.charAt(0).toUpperCase() + p.sexe.slice(1) : "—"}</td>
                            <td><Badge cls={p.groupe_sanguin?.includes("O-") ? "red" : "blue"}>{p.groupe_sanguin || "—"}</Badge></td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{p.telephone || "—"}</td>
                            <td>
                              {(Array.isArray(p.allergies) ? p.allergies.length > 0 : !!p.allergies)
                                ? <span style={{ fontSize:11, color:"#DC2626", fontWeight:600 }}>⚠ {Array.isArray(p.allergies) ? p.allergies.join(', ') : p.allergies}</span>
                                : <span style={{ fontSize:11, color:"#9CA3AF" }}>Aucune</span>}
                            </td>
                            <td>
                              {p.maladies_chroniques && p.maladies_chroniques.length > 0
                                ? <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>{p.maladies_chroniques.slice(0,2).map(m => <Badge key={m} cls="orange">{m}</Badge>)}{p.maladies_chroniques.length > 2 && <Badge cls="gray">+{p.maladies_chroniques.length-2}</Badge>}</div>
                                : <span style={{ fontSize:11, color:"#9CA3AF" }}>Aucune</span>}
                            </td>
                            <td>
                              <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
                                <span className={`stat-dot ${p.statut}`} />
                                <Badge cls={sc.cls}>{sc.label}</Badge>
                                {p.actif === false && <Badge cls="orange">Non activé</Badge>}
                              </div>
                            </td>
                            <td>
                              <button className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:11 }} onClick={() => openPatient(p)}>
                                {I.open} Ouvrir
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filtered.length === 0 && (
                        <tr><td colSpan={9} style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>
                          {search ? `Aucun patient trouvé pour "${search}"` : "Aucun patient enregistré"}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ DOSSIER PATIENT ══ */}
          {tab === "dossier" && currentPatient && (
            <div>
              {/* ── Alertes médicales critiques ── */}
              {(currentPatient.allergies || (currentPatient.maladies_chroniques && currentPatient.maladies_chroniques.length > 0)) && (
                <div className="al-danger fu" style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:20 }}>
                  <div style={{ width:42, height:42, background:"#FEE2E2", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {I.alert}
                  </div>
                  <div style={{ flex:1 }}>
                    <strong style={{ color:"#B91C1C", fontSize:13 }}>⚠ Alertes médicales importantes — Visible dans tout le dossier</strong>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:6 }}>
                      {currentPatient.allergies && <span style={{ fontSize:12, color:"#DC2626", fontWeight:600 }}>🚨 Allergies : {currentPatient.allergies}</span>}
                      {currentPatient.maladies_chroniques && currentPatient.maladies_chroniques.map(m => (
                        <Badge key={m} cls="red">{m}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Header patient ── */}
              <div style={{ background:"linear-gradient(135deg,#0B1E3B,#132744)", borderRadius:18, padding:"20px 24px", marginBottom:20, color:"#fff" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                    <div style={{ width:64, height:64, borderRadius:16, background:"rgba(255,255,255,.15)", border:"2px solid rgba(255,255,255,.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, flexShrink:0 }}>
                      {currentPatient.sexe === "femme" ? "👩" : "👨"}
                    </div>
                    <div>
                      <div style={{ fontSize:20, fontWeight:700 }}>{currentPatient.prenom} {currentPatient.nom}</div>
                      <div style={{ fontSize:12, color:"rgba(255,255,255,.65)", marginTop:2 }}>
                        {ageCalc(currentPatient.date_naissance)} · {currentPatient.sexe ? currentPatient.sexe.charAt(0).toUpperCase() + currentPatient.sexe.slice(1) : "—"} · Gr. {currentPatient.groupe_sanguin || "—"}
                        {currentPatient.allergies && <span style={{ color:"#FCA5A5" }}> · ⚠ {currentPatient.allergies}</span>}
                      </div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:3 }}>📞 {currentPatient.telephone || "—"} · ✉ {currentPatient.email || "—"}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
                    {/* Stats rapides */}
                    {[
                      ["💬", currentPatient.nb_consultations, "Consult."],
                      ["🛏", currentPatient.nb_hospitalisations, "Hospit."],
                      ["🔬", currentPatient.nb_analyses, "Analyses"],
                      ["🔪", currentPatient.nb_chirurgies, "Chir."],
                    ].map(([ico, val, lbl]) => (
                      <div key={lbl} style={{ background:"rgba(255,255,255,.1)", borderRadius:10, padding:"8px 14px", textAlign:"center", minWidth:64 }}>
                        <div style={{ fontSize:18, lineHeight:1 }}>{ico}</div>
                        <div style={{ fontSize:18, fontWeight:800, color:"#fff", marginTop:2 }}>{val}</div>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,.55)" }}>{lbl}</div>
                      </div>
                    ))}
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontFamily:"monospace", fontSize:15, fontWeight:700, color:"rgba(255,255,255,.9)" }}>{currentPatient.numero}</div>
                      <Badge cls={(STATUT_CFG[currentPatient.statut] || {}).cls || "gray"}>
                        {(STATUT_CFG[currentPatient.statut] || {}).label || currentPatient.statut}
                      </Badge>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:4 }}>
                        Inscrit le {fmtDate(currentPatient.date_inscription)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section nav */}
              <div className="sec-nav" style={{ borderRadius:"18px 18px 0 0", overflowX:"auto" }}>
                {SECTIONS.map(s => (
                  <button key={s.id} className={`sec-btn ${section === s.id ? "active" : ""}`} onClick={() => setSection(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>

              <div style={{ marginTop:20 }}>

                {/* ── VUE D'ENSEMBLE ── */}
                {section === "overview" && (
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                    {/* Résumé général */}
                    <div className="pat-card fu">
                      <div className="pat-card-hdr"><h3>📊 Résumé du dossier</h3></div>
                      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:10 }}>
                        {[
                          ["💬", "Consultations", currentPatient.nb_consultations, "#1B4F9E"],
                          ["🛏", "Hospitalisations", currentPatient.nb_hospitalisations, "#D97706"],
                          ["🔬", "Analyses labo", currentPatient.nb_analyses, "#0EA5A0"],
                          ["🩻", "Examens imagerie", currentPatient.nb_imageries, "#7C3AED"],
                          ["🔪", "Interventions chirurg.", currentPatient.nb_chirurgies, "#DC2626"],
                        ].map(([ico, lbl, val, col]) => (
                          <div key={lbl} className="metric-row">
                            <span style={{ fontSize:18 }}>{ico}</span>
                            <span style={{ flex:1, fontSize:13, color:"var(--cn)" }}>{lbl}</span>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <div className="pat-prog" style={{ width:60 }}>
                                <div className="pat-prog-f" style={{ width:`${Math.min(100, val * 10)}%`, background:col }} />
                              </div>
                              <span style={{ fontWeight:700, fontSize:13, color:"var(--cn)", minWidth:20 }}>{val}</span>
                            </div>
                          </div>
                        ))}
                        <div style={{ marginTop:8, paddingTop:12, borderTop:"1px solid var(--cbr)", display:"flex", justifyContent:"space-between", fontSize:12 }}>
                          <span style={{ color:"var(--cm)" }}>Solde financier</span>
                          <strong style={{ color: currentPatient.solde > 0 ? "#DC2626" : "#059669" }}>
                            {currentPatient.solde > 0 ? `${currentPatient.solde.toLocaleString("fr-FR")} CFA restant` : "✅ Soldé"}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Timeline médicale */}
                    <div className="pat-card fu">
                      <div className="pat-card-hdr"><h3>📅 Timeline médicale</h3><p>Chronologie des soins</p></div>
                      <div style={{ padding:20 }}>
                        <div className="tl-line">
                          {[
                            { date:"02/06/2025", label:"Sortie d'hospitalisation", icon:"🚪", col:"#059669" },
                            { date:"28/05/2025", label:"Intervention chirurgicale — Appendicectomie", icon:"🔪", col:"#DC2626" },
                            { date:"28/05/2025", label:"Hospitalisation — Service Chirurgie", icon:"🛏", col:"#D97706" },
                            { date:"28/05/2025", label:"Consultation urgences — Appendicite aiguë", icon:"💬", col:"#1B4F9E" },
                            { date:"01/06/2025", label:"Résultats labo — NFS + Glycémie", icon:"🔬", col:"#0EA5A0" },
                          ].map((e, i) => (
                            <div key={i} style={{ position:"relative", marginBottom:16, paddingBottom:4 }}>
                              <div className="tl-dot" style={{ background:e.col, top:2 }}>{e.icon}</div>
                              <div style={{ marginLeft:12 }}>
                                <div style={{ fontSize:12, fontWeight:600, color:"var(--cn)" }}>{e.label}</div>
                                <div style={{ fontSize:11, color:"var(--cm)", marginTop:2 }}>{e.date}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Prochains RDV */}
                    <div className="pat-card fu">
                      <div className="pat-card-hdr">
                        <h3>📅 Prochains rendez-vous</h3>
                        <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => { setModalRdv(true); }}>+ Planifier</button>
                      </div>
                      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:10 }}>
                        {DEMO_RDV.filter(r => r.statut === "planifié").map(r => (
                          <div key={r._id} style={{ display:"flex", alignItems:"center", gap:12, background:"#F8FAFD", borderRadius:10, padding:"10px 14px", border:"1.5px solid var(--cbr)" }}>
                            <div style={{ width:40, height:40, background:"#EEF4FF", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>📅</div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:13, fontWeight:600, color:"var(--cn)" }}>{r.medecin}</div>
                              <div style={{ fontSize:11, color:"var(--cm)" }}>{r.service} · {fmtDate(r.date)} à {r.heure}</div>
                            </div>
                            <Badge cls="teal">Planifié</Badge>
                          </div>
                        ))}
                        {DEMO_RDV.filter(r => r.statut === "planifié").length === 0 && (
                          <div style={{ textAlign:"center", color:"var(--cm)", fontSize:13, padding:12 }}>Aucun rendez-vous à venir</div>
                        )}
                      </div>
                    </div>

                    {/* Dernières analyses */}
                    <div className="pat-card fu">
                      <div className="pat-card-hdr"><h3>🔬 Dernières analyses</h3></div>
                      <div style={{ overflowX:"auto" }}>
                        <table className="pat-tbl">
                          <thead><tr><th>Analyse</th><th>Résultat</th><th>Statut</th></tr></thead>
                          <tbody>
                            {DEMO_ANALYSES.slice(0, 4).map(a => (
                              <tr key={a._id}>
                                <td style={{ fontWeight:600, fontSize:12 }}>{a.type}</td>
                                <td style={{ fontSize:12, color:"var(--cm)" }}>{a.valeur}</td>
                                <td><Badge cls={a.statut === "normal" ? "green" : "red"}>{a.statut}</Badge></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── INFORMATIONS PERSONNELLES ── */}
                {section === "infos" && (
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                    <div className="pat-card fu">
                      <div className="pat-card-hdr"><h3>👤 Identité</h3></div>
                      <div style={{ padding:20, display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
                        <InfoCell label="Numéro dossier" value={currentPatient.numero} />
                        <InfoCell label="Nom" value={currentPatient.nom} />
                        <InfoCell label="Prénom" value={currentPatient.prenom} />
                        <InfoCell label="Date de naissance" value={fmtDate(currentPatient.date_naissance)} />
                        <InfoCell label="Âge" value={ageCalc(currentPatient.date_naissance)} />
                        <InfoCell label="Sexe" value={currentPatient.sexe ? currentPatient.sexe.charAt(0).toUpperCase() + currentPatient.sexe.slice(1) : "—"} />
                        <InfoCell label="Nationalité" value={currentPatient.nationalite || "—"} />
                        <InfoCell label="Situation maritale" value={currentPatient.situation_mat || "—"} />
                        <InfoCell label="Groupe sanguin" value={currentPatient.groupe_sanguin || "—"} />
                        <InfoCell label="Statut" value={(STATUT_CFG[currentPatient.statut] || {}).label || currentPatient.statut} />
                        {currentPatient.allergies && <InfoCell label="Allergies" value={currentPatient.allergies} full warn />}
                      </div>
                    </div>
                    <div className="pat-card fu">
                      <div className="pat-card-hdr"><h3>📞 Coordonnées</h3></div>
                      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:10 }}>
                        {[["Téléphone principal", currentPatient.telephone], ["E-mail", currentPatient.email], ["Adresse", currentPatient.adresse]].map(([lbl, val]) => (
                          <div key={lbl} className="info-cell" style={{ gridColumn:"1/-1" }}>
                            <div className="ic-lbl">{lbl}</div>
                            <div className="ic-val">{val || "—"}</div>
                          </div>
                        ))}
                        <div style={{ marginTop:8 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>Personne à contacter en urgence</div>
                          <div style={{ background:"#FFF7ED", border:"1.5px solid #FED7AA", borderRadius:12, padding:14, display:"flex", flexDirection:"column", gap:8 }}>
                            {[["Nom", "Claire Dupont"], ["Lien de parenté", "Épouse"], ["Téléphone", "06 98 76 54 32"]].map(([lbl, val]) => (
                              <div key={lbl}>
                                <div style={{ fontSize:10, fontWeight:600, color:"#92400E", textTransform:"uppercase", letterSpacing:.4 }}>{lbl}</div>
                                <div style={{ fontSize:13, fontWeight:600, color:"var(--cn)", marginTop:1 }}>{val}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <button className="pbtn pbtn-teal" style={{ marginTop:8 }}>{I.edit} Modifier les informations</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── DOSSIER MÉDICAL ── */}
                {section === "medical" && (
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                    <div className="pat-card fu">
                      <div className="pat-card-hdr"><h3>📋 Données médicales</h3></div>
                      <div style={{ padding:20, display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
                        <InfoCell label="Groupe sanguin" value={currentPatient.groupe_sanguin || "—"} />
                        <InfoCell label="Taille" value="175 cm" />
                        <InfoCell label="Poids" value="78 kg" />
                        <InfoCell label="IMC" value="25.5 — Normal" />
                        {currentPatient.allergies && <InfoCell label="Allergies" value={currentPatient.allergies} full warn />}
                        <div className="info-cell" style={{ gridColumn:"1/-1" }}>
                          <div className="ic-lbl">Handicap éventuel</div>
                          <div className="ic-val">Aucun</div>
                        </div>
                      </div>
                    </div>
                    <div className="pat-card fu">
                      <div className="pat-card-hdr"><h3>📖 Antécédents & maladies chroniques</h3></div>
                      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:12 }}>
                        <div style={{ background:"#F8FAFD", borderRadius:12, padding:14 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"var(--cm)", textTransform:"uppercase", marginBottom:8 }}>Antécédents médicaux</div>
                          <div style={{ fontSize:13, color:"var(--cn)" }}>HTA diagnostiquée en 2018, Diabète type 2 depuis 2020</div>
                        </div>
                        <div style={{ background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:12, padding:14 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"#92400E", textTransform:"uppercase", marginBottom:8 }}>Antécédents chirurgicaux</div>
                          <div style={{ fontSize:13, color:"var(--cn)" }}>Appendicectomie — 05/2025</div>
                        </div>
                        <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:12, padding:14 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"#B91C1C", textTransform:"uppercase", marginBottom:8 }}>Maladies chroniques</div>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                            {currentPatient.maladies_chroniques && currentPatient.maladies_chroniques.length > 0
                              ? currentPatient.maladies_chroniques.map(m => <Badge key={m} cls="red">{m}</Badge>)
                              : <span style={{ fontSize:13, color:"var(--cm)" }}>Aucune</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── CONSULTATIONS ── */}
                {section === "consultations" && (
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)" }}>Historique des consultations</div>
                      <button className="pbtn pbtn-primary">{I.plus} Nouvelle consultation</button>
                    </div>
                    <div className="pat-card fu">
                      <div style={{ overflowX:"auto" }}>
                        <table className="pat-tbl">
                          <thead><tr><th>Date</th><th>Médecin</th><th>Motif</th><th>Diagnostic</th><th>Statut</th><th>Actions</th></tr></thead>
                          <tbody>
                            {DEMO_CONSULTATIONS.map(c => (
                              <tr key={c._id}>
                                <td style={{ fontSize:12, fontWeight:600 }}>{fmtDate(c.date)}</td>
                                <td style={{ fontSize:12, color:"var(--cm)" }}>{c.medecin}</td>
                                <td style={{ fontSize:12 }}>{c.motif}</td>
                                <td style={{ fontSize:12, color:"var(--cm)" }}>{c.diagnostic}</td>
                                <td><Badge cls="green">{c.statut}</Badge></td>
                                <td>
                                  <div style={{ display:"flex", gap:4 }}>
                                    <button className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:10 }}>👁 Voir</button>
                                    <button className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:10 }}>{I.dl} PDF</button>
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

                {/* ── RENDEZ-VOUS ── */}
                {section === "rdv" && (
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)" }}>Rendez-vous</div>
                      <button className="pbtn pbtn-primary" onClick={() => setModalRdv(true)}>{I.plus} Planifier RDV</button>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                      <div className="pat-card fu">
                        <div className="pat-card-hdr"><h3>📅 Prochains rendez-vous</h3></div>
                        <div style={{ padding:20, display:"flex", flexDirection:"column", gap:10 }}>
                          {DEMO_RDV.filter(r => r.statut === "planifié").map(r => (
                            <div key={r._id} style={{ display:"flex", alignItems:"center", gap:12, background:"#F0FDFC", border:"1.5px solid #99F6E4", borderRadius:12, padding:"12px 14px" }}>
                              <div style={{ fontSize:24 }}>📅</div>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:13, fontWeight:600, color:"var(--cn)" }}>{r.medecin}</div>
                                <div style={{ fontSize:11, color:"var(--cm)" }}>{r.service}</div>
                                <div style={{ fontSize:12, color:"var(--ct)", fontWeight:600, marginTop:2 }}>{fmtDate(r.date)} à {r.heure}</div>
                              </div>
                              <Badge cls="teal">Planifié</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="pat-card fu">
                        <div className="pat-card-hdr"><h3>📋 Historique</h3></div>
                        <div style={{ overflowX:"auto" }}>
                          <table className="pat-tbl">
                            <thead><tr><th>Date</th><th>Médecin</th><th>Service</th><th>Statut</th></tr></thead>
                            <tbody>
                              {DEMO_RDV.map(r => {
                                const sc = { planifié:"teal", honoré:"green", annulé:"red", manqué:"orange" }[r.statut] || "gray";
                                return (
                                  <tr key={r._id}>
                                    <td style={{ fontSize:12 }}>{fmtDate(r.date)} {r.heure}</td>
                                    <td style={{ fontSize:12, color:"var(--cm)" }}>{r.medecin}</td>
                                    <td style={{ fontSize:12, color:"var(--cm)" }}>{r.service}</td>
                                    <td><Badge cls={sc}>{r.statut}</Badge></td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── LABORATOIRE ── */}
                {section === "laboratoire" && (
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)" }}>Analyses biologiques</div>
                      <button className="pbtn pbtn-primary">{I.plus} Prescrire analyse</button>
                    </div>
                    <div className="pat-card fu">
                      <div style={{ overflowX:"auto" }}>
                        <table className="pat-tbl">
                          <thead><tr><th>Type d'analyse</th><th>Date</th><th>Prescripteur</th><th>Valeur obtenue</th><th>Valeur normale</th><th>Statut</th><th>Rapport</th></tr></thead>
                          <tbody>
                            {DEMO_ANALYSES.map(a => (
                              <tr key={a._id} style={{ background:a.statut === "anormal" ? "#FEF2F2":"" }}>
                                <td style={{ fontWeight:600, color:"var(--cn)" }}>{a.type}</td>
                                <td style={{ fontSize:12, color:"var(--cm)" }}>{fmtDate(a.date)}</td>
                                <td style={{ fontSize:12, color:"var(--cm)" }}>{a.prescripteur}</td>
                                <td style={{ fontSize:12, fontWeight:600, color:a.statut === "anormal" ? "#DC2626":"var(--cn)" }}>{a.valeur}</td>
                                <td style={{ fontSize:11, color:"var(--cm)" }}>{a.val_norm}</td>
                                <td><Badge cls={a.statut === "normal" ? "green" : "red"}>{a.statut}</Badge></td>
                                <td><button className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:10 }}>{I.dl} PDF</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {DEMO_ANALYSES.some(a => a.statut === "anormal") && (
                      <div className="al-warn" style={{ marginTop:16, display:"flex", alignItems:"flex-start", gap:12 }}>
                        <span style={{ fontSize:20, flexShrink:0 }}>⚠️</span>
                        <div>
                          <strong style={{ color:"#92400E", fontSize:13 }}>Résultats anormaux détectés</strong>
                          <div style={{ fontSize:12, color:"#B45309", marginTop:3 }}>
                            {DEMO_ANALYSES.filter(a => a.statut === "anormal").length} analyse(s) présentent des valeurs hors normes. Réévaluation médicale recommandée.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── IMAGERIE ── */}
                {section === "imagerie" && (
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)" }}>Examens d'imagerie médicale</div>
                      <button className="pbtn pbtn-primary">{I.plus} Prescrire examen</button>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 }}>
                      {DEMO_IMAGERIE.map(img => (
                        <div key={img._id} className="pat-card fu">
                          <div style={{ padding:20 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                              <div style={{ width:40, height:40, background:"#EEF4FF", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🩻</div>
                              <div>
                                <div style={{ fontWeight:700, fontSize:13, color:"var(--cn)" }}>{img.type}</div>
                                <div style={{ fontSize:11, color:"var(--cm)" }}>{fmtDate(img.date)}</div>
                              </div>
                            </div>
                            <div style={{ background:"#F8FAFD", borderRadius:8, padding:10, fontSize:12, color:"var(--cm)", marginBottom:10 }}>
                              <strong>Résultat :</strong> {img.resultat}
                            </div>
                            <div style={{ fontSize:11, color:"var(--cm)" }}>{img.compte_rendu}</div>
                            <div style={{ display:"flex", gap:6, marginTop:12 }}>
                              <button className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:10 }}>👁 Voir images</button>
                              <button className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:10 }}>{I.dl} Rapport</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── HOSPITALISATION ── */}
                {section === "hospitalisation" && (
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)", marginBottom:16 }}>Séjours hospitaliers</div>
                    {DEMO_HOSPIT.map(h => (
                      <div key={h._id} className="pat-card fu" style={{ marginBottom:16 }}>
                        <div className="pat-card-hdr">
                          <h3>🛏 Hospitalisation — {fmtDate(h.date_entree)}</h3>
                          <Badge cls={h.statut === "terminé" ? "green":"orange"}>{h.statut}</Badge>
                        </div>
                        <div style={{ padding:20, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12 }}>
                          <InfoCell label="Date d'entrée" value={fmtDate(h.date_entree)} />
                          <InfoCell label="Date de sortie" value={fmtDate(h.date_sortie)} />
                          <InfoCell label="Service" value={h.service} />
                          <InfoCell label="Chambre" value={h.chambre} />
                          <InfoCell label="Médecin responsable" value={h.medecin} />
                          <InfoCell label="Durée" value={`${Math.round((new Date(h.date_sortie)-new Date(h.date_entree))/(86400*1000))} jours`} />
                        </div>
                        <div style={{ padding:"0 20px 20px", display:"flex", gap:8 }}>
                          <button className="pbtn pbtn-ghost pbtn-sm">{I.file} Compte rendu</button>
                          <button className="pbtn pbtn-ghost pbtn-sm">{I.dl} Rapport</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── CHIRURGIE ── */}
                {section === "chirurgie" && (
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)", marginBottom:16 }}>Interventions chirurgicales</div>
                    <div className="pat-card fu">
                      <div style={{ overflowX:"auto" }}>
                        <table className="pat-tbl">
                          <thead><tr><th>Date</th><th>Chirurgien</th><th>Intervention</th><th>Résultat</th><th>Documents</th></tr></thead>
                          <tbody>
                            <tr>
                              <td style={{ fontSize:12 }}>28/05/2025</td>
                              <td style={{ fontSize:12 }}>Dr. Martin Leblanc</td>
                              <td style={{ fontWeight:600 }}>Appendicectomie cœlioscopique</td>
                              <td><Badge cls="green">✅ Succès</Badge></td>
                              <td>
                                <div style={{ display:"flex", gap:4 }}>
                                  <button className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:10 }}>{I.file} CR opér.</button>
                                  <button className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:10 }}>{I.dl} PDF</button>
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="al-ia" style={{ marginTop:16, display:"flex", alignItems:"flex-start", gap:12 }}>
                      <span style={{ fontSize:20, flexShrink:0 }}>🔗</span>
                      <div style={{ flex:1 }}>
                        <strong style={{ color:"#1E40AF", fontSize:13 }}>Module Chirurgie — Dossier complet disponible</strong>
                        <div style={{ fontSize:12, color:"#3B82F6", marginTop:3 }}>1 dossier chirurgical actif · Score IA risque : 22/100 (faible)</div>
                      </div>
                      <button className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:11 }}>Ouvrir module →</button>
                    </div>
                  </div>
                )}

                {/* ── VACCINATION ── */}
                {section === "vaccination" && (
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)" }}>Carnet vaccinal</div>
                      <button className="pbtn pbtn-primary">{I.plus} Ajouter vaccin</button>
                    </div>
                    {DEMO_VACCINS.some(v => v.statut === "en_retard") && (
                      <div className="al-warn" style={{ marginBottom:16, display:"flex", alignItems:"flex-start", gap:12 }}>
                        <span style={{ fontSize:20 }}>⏰</span>
                        <div>
                          <strong style={{ color:"#92400E", fontSize:13 }}>Vaccins en retard</strong>
                          <div style={{ fontSize:12, color:"#B45309", marginTop:3 }}>
                            {DEMO_VACCINS.filter(v => v.statut === "en_retard").map(v => v.vaccin).join(", ")}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="pat-card fu">
                      <div style={{ overflowX:"auto" }}>
                        <table className="pat-tbl">
                          <thead><tr><th>Vaccin</th><th>Date</th><th>Prochaine dose</th><th>Statut</th></tr></thead>
                          <tbody>
                            {DEMO_VACCINS.map(v => (
                              <tr key={v._id}>
                                <td style={{ fontWeight:600 }}>{v.vaccin}</td>
                                <td style={{ fontSize:12, color:"var(--cm)" }}>{fmtDate(v.date)}</td>
                                <td style={{ fontSize:12, color:v.statut === "en_retard" ? "#DC2626":"var(--cm)" }}>{v.prochaine_dose ? fmtDate(v.prochaine_dose) : "Dose unique"}</td>
                                <td><Badge cls={v.statut === "ok" ? "green" : "orange"}>{v.statut === "ok" ? "✅ À jour" : "⏰ En retard"}</Badge></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── FINANCE ── */}
                {section === "finance" && (
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"2fr 1fr", gap:20 }}>
                    <div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                        <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)" }}>Factures</div>
                        <button className="pbtn pbtn-primary">{I.plus} Nouvelle facture</button>
                      </div>
                      <div className="pat-card fu">
                        <div style={{ overflowX:"auto" }}>
                          <table className="pat-tbl">
                            <thead><tr><th>Type</th><th>Date</th><th>Montant</th><th>Payé</th><th>Reste</th><th>Mode</th><th>Statut</th></tr></thead>
                            <tbody>
                              {DEMO_FACTURES.map(f => {
                                const reste = f.montant - f.paye;
                                const sc = { payé:"green", partiel:"orange", impayé:"red" }[f.statut] || "gray";
                                return (
                                  <tr key={f._id}>
                                    <td style={{ fontWeight:600, fontSize:12 }}>{f.type}</td>
                                    <td style={{ fontSize:12, color:"var(--cm)" }}>{fmtDate(f.date)}</td>
                                    <td style={{ fontSize:12, fontWeight:700 }}>{f.montant.toLocaleString("fr-FR")} CFA</td>
                                    <td style={{ fontSize:12, color:"#059669" }}>{f.paye.toLocaleString("fr-FR")}</td>
                                    <td style={{ fontSize:12, color: reste > 0 ? "#DC2626":"#059669", fontWeight:600 }}>{reste > 0 ? `${reste.toLocaleString("fr-FR")}` : "—"}</td>
                                    <td style={{ fontSize:12, color:"var(--cm)" }}>{f.mode}</td>
                                    <td><Badge cls={sc}>{f.statut}</Badge></td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div style={{ padding:"12px 20px", borderTop:"1.5px solid var(--cbr)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ fontSize:13, color:"var(--cm)" }}>Solde total restant</span>
                          <strong style={{ fontSize:16, color: currentPatient.solde > 0 ? "#DC2626":"#059669" }}>
                            {currentPatient.solde > 0 ? `${currentPatient.solde.toLocaleString("fr-FR")} CFA` : "✅ Tout payé"}
                          </strong>
                        </div>
                      </div>
                    </div>
                    <div className="pat-card fu">
                      <div className="pat-card-hdr"><h3>🛡 Assurance</h3></div>
                      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:10 }}>
                        {[["Compagnie", "CNSS Congo"], ["N° adhérent", "CNS-2025-7734"], ["Taux prise en charge", "90%"], ["Validité", "31/12/2025"]].map(([lbl, val]) => (
                          <div key={lbl} className="info-cell">
                            <div className="ic-lbl">{lbl}</div>
                            <div className="ic-val">{val}</div>
                          </div>
                        ))}
                        <Badge cls="green" style={{ marginTop:8, alignSelf:"flex-start" }}>✅ Assurance active</Badge>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── DOCUMENTS ── */}
                {section === "documents" && (
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)" }}>Documents du dossier</div>
                      <button className="pbtn pbtn-primary">{I.plus} Ajouter document</button>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:14 }}>
                      {DEMO_DOCS.map(d => {
                        const typeIco = { Ordonnance:"📋", Résultat:"🔬", Rapport:"📄", Administratif:"🪪", Certificat:"🏅" }[d.type] || "📄";
                        return (
                          <div key={d._id} className="pat-card fu" style={{ cursor:"pointer" }} onMouseOver={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(11,30,59,.1)"} onMouseOut={e=>e.currentTarget.style.boxShadow=""}>
                            <div style={{ padding:16 }}>
                              <div style={{ fontSize:28, marginBottom:8 }}>{typeIco}</div>
                              <div style={{ fontWeight:700, fontSize:13, color:"var(--cn)" }}>{d.nom}</div>
                              <div style={{ fontSize:11, color:"var(--cm)", marginTop:4 }}>{d.type} · {fmtDate(d.date)}</div>
                              <div style={{ display:"flex", gap:6, marginTop:12 }}>
                                <button className="pbtn pbtn-teal pbtn-sm" style={{ fontSize:10 }}>{I.dl} Télécharger</button>
                                <button className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:10 }}>{I.print} Imprimer</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── AUDIT ── */}
                {section === "audit" && (
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:"var(--cn)", marginBottom:16 }}>Journal des activités & Traçabilité</div>
                    <div className="pat-card fu">
                      <div style={{ overflowX:"auto" }}>
                        <table className="pat-tbl">
                          <thead><tr><th>Action</th><th>Utilisateur</th><th>Date</th><th>Heure</th><th>Détails</th></tr></thead>
                          <tbody>
                            {DEMO_AUDIT.map(a => (
                              <tr key={a._id}>
                                <td style={{ fontWeight:600, fontSize:12 }}>{a.action}</td>
                                <td style={{ fontSize:12, color:"var(--cm)" }}>{a.utilisateur}</td>
                                <td style={{ fontSize:12, color:"var(--cm)" }}>{a.date}</td>
                                <td style={{ fontSize:12, color:"var(--cm)" }}>{a.heure}</td>
                                <td style={{ fontSize:11, color:"var(--cm)" }}>{a.details}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div style={{ marginTop:16, display:"flex", gap:10 }}>
                      <button className="pbtn pbtn-ghost pbtn-sm">{I.dl} Exporter journal</button>
                      <button className="pbtn pbtn-ghost pbtn-sm">{I.qr} Générer QR code dossier</button>
                      <button className="pbtn pbtn-ghost pbtn-sm">{I.print} Carte patient imprimable</button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>

        {/* ═══ MODAL : NOUVEAU PATIENT ═══ */}
        <Modal open={modalNouv} onClose={() => { setModalNouv(false); resetForm(); }} title={<>{I.plus} Nouveau dossier patient</>} maxWidth={720}>

          {/* ── Section 1 : Identité ── */}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.6, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ width:24, height:24, background:"var(--cb)", borderRadius:6, display:"inline-flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:11 }}>1</span>
              Identité du patient
            </div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
              {[["Nom *","nom","text","Ex: Dupont"],["Prénom *","prenom","text","Ex: Jean"],["Date de naissance *","date_naissance","date",""],["Téléphone","telephone","tel","+242 06 xxx"],["E-mail (activation compte)","email","email","patient@email.com"],["Nationalité","nationalite","text","Ex: Congolaise"]].map(([lbl,key,type,ph]) => (
                <div key={key}>
                  <label className="plbl">{lbl}</label>
                  <input type={type} className="pinp" placeholder={ph} value={formPatient[key]||""} onChange={e => setFormPatient(f => ({...f,[key]:e.target.value}))} />
                </div>
              ))}
              <div>
                <label className="plbl">Sexe *</label>
                <select className="pinp" value={formPatient.sexe} onChange={e => setFormPatient(f => ({...f,sexe:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </div>
              <div>
                <label className="plbl">Groupe sanguin</label>
                <select className="pinp" value={formPatient.groupe_sanguin} onChange={e => setFormPatient(f => ({...f,groupe_sanguin:e.target.value}))}>
                  <option value="">— Inconnu —</option>
                  {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="plbl">Situation maritale</label>
                <select className="pinp" value={formPatient.situation_mat} onChange={e => setFormPatient(f => ({...f,situation_mat:e.target.value}))}>
                  <option value="">—</option>
                  <option value="célibataire">Célibataire</option><option value="marié">Marié(e)</option>
                  <option value="divorcé">Divorcé(e)</option><option value="veuf">Veuf(ve)</option>
                </select>
              </div>
              <div>
                <label className="plbl">Photo (URL ou chemin)</label>
                <input className="pinp" placeholder="https://... ou laisser vide" value={formPatient.photo} onChange={e => setFormPatient(f => ({...f,photo:e.target.value}))} />
              </div>
              <div style={{ gridColumn:"1/-1", display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:10 }}>
                <div>
                  <label className="plbl">Rue / Adresse</label>
                  <input className="pinp" placeholder="123 Rue de l'Hôpital" value={formPatient.adresse.rue} onChange={e => setFormPatient(f => ({...f,adresse:{...f.adresse,rue:e.target.value}}))} />
                </div>
                <div>
                  <label className="plbl">Ville</label>
                  <input className="pinp" placeholder="Souanké" value={formPatient.adresse.ville} onChange={e => setFormPatient(f => ({...f,adresse:{...f.adresse,ville:e.target.value}}))} />
                </div>
                <div>
                  <label className="plbl">Pays</label>
                  <input className="pinp" value={formPatient.adresse.pays} onChange={e => setFormPatient(f => ({...f,adresse:{...f.adresse,pays:e.target.value}}))} />
                </div>
                <div>
                  <label className="plbl">Code postal</label>
                  <input className="pinp" placeholder="00000" value={formPatient.adresse.code_postal} onChange={e => setFormPatient(f => ({...f,adresse:{...f.adresse,code_postal:e.target.value}}))} />
                </div>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="plbl">Allergies connues (séparées par des virgules)</label>
                <input className="pinp" placeholder="Ex: Pénicilline, Aspirine, Latex..." value={formPatient.allergies} onChange={e => setFormPatient(f => ({...f,allergies:e.target.value}))} />
              </div>
            </div>
          </div>

          {/* ── Section 2 : Assurances (max 2) ── */}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.6, marginBottom:10, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ width:24, height:24, background:"var(--ct)", borderRadius:6, display:"inline-flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:11 }}>2</span>
                Assurance(s) — max. 2
              </span>
              {formPatient.assurances.length < 2 && (
                <button className="pbtn pbtn-ghost pbtn-sm" onClick={addAssurance}>{I.plus} Ajouter une assurance</button>
              )}
            </div>
            {formPatient.assurances.length === 0 && (
              <div style={{ textAlign:"center", padding:"12px 0", color:"var(--cm)", fontSize:12, background:"#F8FAFD", borderRadius:10, border:"1.5px dashed var(--cbr)" }}>
                Aucune assurance — cliquez "Ajouter" pour en saisir une
              </div>
            )}
            {formPatient.assurances.map((a, idx) => (
              <div key={idx} style={{ background:"#F0FDFC", border:"1.5px solid #99F6E4", borderRadius:12, padding:"12px 14px", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"var(--ct)" }}>Assurance {idx+1}</span>
                  <button className="pbtn pbtn-danger pbtn-sm" onClick={() => removeAssurance(idx)}>✕ Retirer</button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:10 }}>
                  <div>
                    <label className="plbl">Compagnie</label>
                    <input className="pinp" placeholder="Ex: CNAMSS, FSDPS..." value={a.compagnie} onChange={e => updateAssurance(idx,"compagnie",e.target.value)} />
                  </div>
                  <div>
                    <label className="plbl">N° Police</label>
                    <input className="pinp" placeholder="POL-XXXXX" value={a.numero_police} onChange={e => updateAssurance(idx,"numero_police",e.target.value)} />
                  </div>
                  <div>
                    <label className="plbl">Taux (%)</label>
                    <input type="number" className="pinp" min="0" max="100" placeholder="80" value={a.taux} onChange={e => updateAssurance(idx,"taux",Number(e.target.value))} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Section 3 : Contact d'urgence ── */}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.6, marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ width:24, height:24, background:"var(--co)", borderRadius:6, display:"inline-flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:11 }}>3</span>
              Contact d'urgence
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:10, background:"#FFF7ED", border:"1.5px solid #FED7AA", borderRadius:12, padding:"14px" }}>
              <div>
                <label className="plbl">Nom complet</label>
                <input className="pinp" placeholder="Ex: Claire Dupont" value={formPatient.contact_urgence.nom} onChange={e => setFormPatient(f => ({...f,contact_urgence:{...f.contact_urgence,nom:e.target.value}}))} />
              </div>
              <div>
                <label className="plbl">Lien de parenté</label>
                <select className="pinp" value={formPatient.contact_urgence.relation} onChange={e => setFormPatient(f => ({...f,contact_urgence:{...f.contact_urgence,relation:e.target.value}}))}>
                  <option value="">—</option>
                  <option>Époux/Épouse</option><option>Père</option><option>Mère</option>
                  <option>Frère/Sœur</option><option>Enfant</option><option>Ami(e)</option><option>Autre</option>
                </select>
              </div>
              <div>
                <label className="plbl">Téléphone</label>
                <input className="pinp" placeholder="+242 06 xxx" value={formPatient.contact_urgence.telephone} onChange={e => setFormPatient(f => ({...f,contact_urgence:{...f.contact_urgence,telephone:e.target.value}}))} />
              </div>
            </div>
          </div>

          {/* ── Messages retour ── */}
          {patientExistant && (
            <div className="al-warn" style={{ marginBottom:12, display:"flex", alignItems:"flex-start", gap:10 }}>
              <span style={{ fontSize:18 }}>⚠️</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, color:"#92400E", fontSize:13 }}>Dossier déjà existant</div>
                <div style={{ fontSize:12, color:"#B45309", marginTop:2 }}>{patientExistant.message}</div>
                <button className="pbtn pbtn-ghost pbtn-sm" style={{ marginTop:8 }}
                  onClick={() => { setModalNouv(false); resetForm(); }}>
                  Fermer et consulter le dossier existant
                </button>
              </div>
            </div>
          )}
          {formError && (
            <div className="al-danger" style={{ marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:18 }}>❌</span>
              <div>
                <div style={{ fontWeight:700, color:"#B91C1C", fontSize:13 }}>Erreur</div>
                <div style={{ fontSize:12, color:"#DC2626" }}>{formError}</div>
                {formError.includes("email") && (
                  <button className="pbtn pbtn-ghost pbtn-sm" style={{ marginTop:6, fontSize:11 }}
                    onClick={() => setFormError("")}>
                    Corriger l'email
                  </button>
                )}
              </div>
            </div>
          )}
          {formSuccess && (
            <div className="al-success" style={{ marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:20 }}>✅</span>
              <div style={{ fontSize:13, color:"#065F46", fontWeight:600 }}>{formSuccess}</div>
            </div>
          )}

          {/* ── Actions ── */}
          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <button className="pbtn pbtn-ghost" onClick={() => { setModalNouv(false); resetForm(); }}>Annuler</button>
            <button className="pbtn pbtn-teal" style={{ marginLeft:"auto" }} disabled={saving || !!formSuccess} onClick={handleCreatePatient}>
              {I.save} {saving ? "Création en cours..." : "Créer le dossier"}
            </button>
          </div>
        </Modal>

        {/* ═══ MODAL : RENDEZ-VOUS ═══ */}
        <Modal open={modalRdv} onClose={() => setModalRdv(false)} title="📅 Planifier un rendez-vous" maxWidth={480}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <label className="plbl">Date *</label>
              <input type="date" className="pinp" min={new Date().toISOString().substring(0,10)} />
            </div>
            <div>
              <label className="plbl">Heure *</label>
              <input type="time" className="pinp" />
            </div>
            <div>
              <label className="plbl">Médecin</label>
              <select className="pinp">
                <option>— Sélectionner —</option>
                <option>Dr. Martin Leblanc — Chirurgie</option>
                <option>Dr. Sophie Pierre — Gynécologie</option>
                <option>Dr. Médecin Général</option>
              </select>
            </div>
            <div>
              <label className="plbl">Service</label>
              <select className="pinp">
                <option>Médecine générale</option>
                <option>Chirurgie</option>
                <option>Gynécologie</option>
                <option>Laboratoire</option>
                <option>Imagerie</option>
              </select>
            </div>
            <div>
              <label className="plbl">Motif</label>
              <textarea className="pinp" rows={2} placeholder="Motif de la consultation..." />
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="pbtn pbtn-ghost" onClick={() => setModalRdv(false)}>Annuler</button>
              <button className="pbtn pbtn-teal" style={{ marginLeft:"auto" }} onClick={() => setModalRdv(false)}>
                {I.save} Confirmer le RDV
              </button>
            </div>
          </div>
        </Modal>

      </div>
    </>
  );
}