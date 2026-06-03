import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchStaff, fetchLeaves, fetchSchedules,
  selectStaff, selectLeaves, selectSchedules, selectHRLoading,
} from '../store/slices/hrSlice';
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
.rh * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --rn: #0B1E3B; --rn2: #132744; --rb: #1B4F9E;
  --rt: #0EA5A0; --rt2: #0D9490; --rr: #DC2626;
  --ro: #D97706; --rg: #059669; --rp: #7C3AED;
  --rbr: #E2EAF4; --rm: #6B7A99; --rl: #EEF4FF; --rs: #F8FAFD;
  --sh: 0 1px 3px rgba(11,30,59,.08); --shm: 0 4px 16px rgba(11,30,59,.10); --shl: 0 12px 40px rgba(11,30,59,.14);
}

.rh-top { background:linear-gradient(135deg,var(--rn) 0%,var(--rn2) 55%,#1B4F9E 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.rh-top::before { content:''; position:absolute; top:-50px; right:-50px; width:200px; height:200px; background:radial-gradient(circle,rgba(14,165,160,.22) 0%,transparent 70%); border-radius:50%; pointer-events:none; }

.rh-tabs { display:flex; gap:2px; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.rh-tabs::-webkit-scrollbar { display:none; }
.rh-tab { display:flex; align-items:center; gap:7px; padding:10px 16px 12px; font-size:12px; font-weight:600; color:rgba(255,255,255,.55); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.rh-tab:hover { color:rgba(255,255,255,.88); background:rgba(255,255,255,.08); }
.rh-tab.active { color:var(--rn); background:var(--rs); box-shadow:0 -2px 0 var(--rt) inset; }
.rh-tab-badge { background:var(--rr); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:99px; animation:rhP 2s infinite; }
@keyframes rhP { 0%,100%{opacity:1} 50%{opacity:.4} }

.rh-card { background:#fff; border:1.5px solid var(--rbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; }
.rh-card:hover { box-shadow:var(--shm); }
.rh-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--rbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.rh-card-hdr h3 { font-size:14px; font-weight:700; color:var(--rn); margin:0; display:flex; align-items:center; gap:8px; }
.rh-card-hdr p { font-size:11px; color:var(--rm); margin:2px 0 0; }

.rh-kpi { background:#fff; border:1.5px solid var(--rbr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:pointer; }
.rh-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.rh-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.rh-kpi.blue::before   { background:var(--rb); } .rh-kpi.teal::before   { background:var(--rt); }
.rh-kpi.red::before    { background:var(--rr); } .rh-kpi.orange::before { background:var(--ro); }
.rh-kpi.green::before  { background:var(--rg); } .rh-kpi.purple::before { background:var(--rp); }
.rh-kpi.yellow::before { background:#CA8A04; }
.rh-kpi-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
.rh-kpi-icon.blue   { background:#EFF6FF; color:var(--rb); } .rh-kpi-icon.teal   { background:#F0FDFC; color:var(--rt); }
.rh-kpi-icon.red    { background:#FEF2F2; color:var(--rr); } .rh-kpi-icon.orange { background:#FFF7ED; color:var(--ro); }
.rh-kpi-icon.green  { background:#ECFDF5; color:var(--rg); } .rh-kpi-icon.purple { background:#F5F3FF; color:var(--rp); }
.rh-kpi-icon.yellow { background:#FEFCE8; color:#CA8A04; }
.kpi-val { font-size:26px; font-weight:800; color:var(--rn); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.kpi-lbl { font-size:11.5px; font-weight:600; color:var(--rm); }
.kpi-sub { font-size:10.5px; color:#9CA3AF; margin-top:2px; }
.kpi-dot { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--rr); animation:rhP 2s infinite; }

.rbdg { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.rbdg.red    { background:#FEF2F2; color:var(--rr); border:1px solid #FECACA; }
.rbdg.orange { background:#FFF7ED; color:var(--ro); border:1px solid #FED7AA; }
.rbdg.yellow { background:#FEFCE8; color:#CA8A04;   border:1px solid #FEF08A; }
.rbdg.green  { background:#ECFDF5; color:var(--rg); border:1px solid #A7F3D0; }
.rbdg.blue   { background:#EFF6FF; color:var(--rb); border:1px solid #BFDBFE; }
.rbdg.teal   { background:#F0FDFC; color:var(--rt); border:1px solid #99F6E4; }
.rbdg.purple { background:#F5F3FF; color:var(--rp); border:1px solid #DDD6FE; }
.rbdg.gray   { background:#F9FAFB; color:#4B5563;   border:1px solid #E5E7EB; }

.rh-prog { background:#EEF4FF; border-radius:99px; height:7px; overflow:hidden; }
.rh-prog-f { height:100%; border-radius:99px; transition:width .5s; }

.rbtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; }
.rbtn-primary { background:var(--rb); color:#fff; } .rbtn-primary:hover { background:#174391; transform:translateY(-1px); }
.rbtn-teal    { background:var(--rt); color:#fff; } .rbtn-teal:hover    { background:var(--rt2); transform:translateY(-1px); }
.rbtn-green   { background:var(--rg); color:#fff; } .rbtn-green:hover   { background:#047857; transform:translateY(-1px); }
.rbtn-ghost   { background:transparent; color:var(--rm); border:1.5px solid var(--rbr); }
.rbtn-ghost:hover { background:var(--rl); color:var(--rn); }
.rbtn-danger  { background:#FEF2F2; color:var(--rr); border:1.5px solid #FECACA; }
.rbtn-danger:hover { background:var(--rr); color:#fff; }
.rbtn-orange  { background:#FFF7ED; color:var(--ro); border:1.5px solid #FED7AA; }
.rbtn-orange:hover { background:var(--ro); color:#fff; }
.rbtn-sm { padding:6px 12px; font-size:12px; }
.rbtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }

.rlbl { font-size:12px; font-weight:600; color:var(--rm); margin-bottom:6px; display:block; }
.rinp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--rbr); background:#FAFBFF; font-size:13px; color:var(--rn); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.rinp:focus { border-color:var(--rt); box-shadow:0 0 0 3px rgba(14,165,160,.12); }

.sec-nav { display:flex; gap:6px; flex-wrap:wrap; padding:14px 20px; background:linear-gradient(to right,#F8FAFD,#EEF4FF); border-bottom:1.5px solid var(--rbr); }
.sec-btn { display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all .2s; color:var(--rm); background:none; font-family:'Poppins',sans-serif; }
.sec-btn:hover { background:white; color:var(--rn); border-color:var(--rbr); }
.sec-btn.active { background:var(--rn); color:white; border-color:var(--rn); }
.sec-btn.warn { border-color:#FECACA; color:var(--rr); }

.al-info   { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; border-left:4px solid var(--rb); border-radius:14px; padding:14px 18px; }
.al-warn   { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--ro); border-radius:14px; padding:14px 18px; }
.al-danger { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--rr); border-radius:14px; padding:14px 18px; }
.al-success{ background:linear-gradient(135deg,#ECFDF5,#D1FAE5); border:1.5px solid #A7F3D0; border-left:4px solid var(--rg); border-radius:14px; padding:14px 18px; }

.rh-tbl { width:100%; border-collapse:collapse; }
.rh-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.rh-tbl th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--rm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--rbr); white-space:nowrap; }
.rh-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.rh-tbl tbody tr:last-child td { border-bottom:none; }
.rh-tbl tbody tr:hover { background:#F8FAFF; }

.mov { position:fixed; inset:0; z-index:500; background:rgba(11,30,59,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.mov-box { background:#fff; border-radius:20px; box-shadow:var(--shl); width:100%; max-width:680px; max-height:92vh; overflow-y:auto; animation:slideUp .25s ease; }
@keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.mov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--rbr); display:flex; align-items:center; justify-content:space-between; background:#EEF4FF; position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.mov-hdr h3 { font-size:16px; font-weight:700; color:var(--rn); margin:0; display:flex; align-items:center; gap:10px; }
.mov-cls { width:32px; height:32px; border-radius:8px; background:#F3F7FF; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--rm); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.mov-cls:hover { background:#FEF2F2; color:var(--rr); }
.mov-body { padding:24px; }

/* Organigramme */
.org-node { background:#fff; border:2px solid var(--rbr); border-radius:14px; padding:14px 18px; text-align:center; position:relative; min-width:140px; transition:all .2s; }
.org-node:hover { border-color:var(--rt); box-shadow:var(--shm); }
.org-node.direction { border-color:var(--rb); background:linear-gradient(135deg,#EFF6FF,#DBEAFE); }
.org-node.chef      { border-color:var(--rt); background:linear-gradient(135deg,#F0FDFC,#CCFBF1); }
.org-line { width:2px; background:var(--rbr); margin:0 auto; }
.org-hline { height:2px; background:var(--rbr); }

/* Avatar */
.emp-avatar { width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:800; color:#fff; flex-shrink:0; }

/* Planning cell */
.plan-cell { padding:6px 8px; border-radius:6px; font-size:10px; font-weight:700; text-align:center; }
.plan-cell.travail  { background:#ECFDF5; color:#065F46; border:1px solid #A7F3D0; }
.plan-cell.conge    { background:#FFF7ED; color:#92400E; border:1px solid #FED7AA; }
.plan-cell.garde    { background:#EFF6FF; color:#1E40AF; border:1px solid #BFDBFE; }
.plan-cell.repos    { background:#F9FAFB; color:#6B7280; border:1px solid #E5E7EB; }
.plan-cell.absence  { background:#FEF2F2; color:#B91C1C; border:1px solid #FECACA; }
.plan-cell.astreinte{ background:#F5F3FF; color:#5B21B6; border:1px solid #DDD6FE; }

/* Note stars */
.star-filled { color:#F59E0B; }
.star-empty  { color:#E5E7EB; }

/* Score bar */
.score-bar { height:8px; border-radius:99px; overflow:hidden; background:#EEF4FF; }
.score-bar-f { height:100%; border-radius:99px; }

@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
.fu { animation:fadeUp .35s ease both; }

/* ─── Responsive ─── */
.rh-g2  { display:grid; grid-template-columns:2fr 1fr; gap:20px; }
.rh-g11 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.rh-g11s{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
@media (max-width:767px) {
  .rh-top { padding:12px 14px 0; }
  .rh-g2,.rh-g11 { grid-template-columns:1fr; gap:14px; }
  .rh-g11s { grid-template-columns:1fr 1fr; gap:8px; }
  .rinp { font-size:16px !important; }
  .rbtn { font-size:12px; padding:8px 12px; } .rbtn-sm { font-size:11px; padding:5px 8px; }
  .rh-card { border-radius:14px; } .rh-card-hdr { padding:11px 14px; }
  .mov { padding:0; align-items:flex-end; } .mov-box { border-radius:20px 20px 0 0; max-width:100%; max-height:93vh; }
  .mov-hdr { padding:13px 16px; } .mov-body { padding:14px; }
}
@media (max-width:479px) {
  .rh-top { padding:10px 12px 0; } .rh-g11s { grid-template-columns:1fr; }
  .rh-card-hdr { flex-wrap:wrap; gap:8px; }
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
const anciennete = (d) => {
  if (!d) return "—";
  const y = Math.floor((Date.now() - new Date(d)) / (365.25 * 24 * 3600 * 1000));
  return y === 0 ? "< 1 an" : `${y} an${y > 1 ? "s" : ""}`;
};

const POSTE_COLORS = {
  medecin:         { cls:"blue",   label:"Médecin",             color:"#1B4F9E" },
  infirmier:       { cls:"teal",   label:"Infirmier(ère)",      color:"#0EA5A0" },
  laborantin:      { cls:"purple", label:"Laborantin",          color:"#7C3AED" },
  radiologue:      { cls:"orange", label:"Radiologue",          color:"#D97706" },
  pharmacien:      { cls:"green",  label:"Pharmacien",          color:"#059669" },
  administratif:   { cls:"gray",   label:"Administratif",       color:"#6B7280" },
  aide_soignant:   { cls:"yellow", label:"Aide-soignant",       color:"#CA8A04" },
  maintenance:     { cls:"red",    label:"Maintenance",         color:"#DC2626" },
};

const CONTRAT_CFG = {
  cdi:        { cls:"green",  label:"CDI" },
  cdd:        { cls:"orange", label:"CDD" },
  stage:      { cls:"blue",   label:"Stage" },
  consultant: { cls:"purple", label:"Consultant" },
  prestataire:{ cls:"gray",   label:"Prestataire" },
};

const STATUT_EMP = {
  actif:   { cls:"green",  label:"Actif" },
  conge:   { cls:"orange", label:"En congé" },
  maladie: { cls:"red",    label:"Maladie" },
  suspendu:{ cls:"red",    label:"Suspendu" },
  inactif: { cls:"gray",   label:"Inactif" },
};

const CONGE_CFG = {
  annuel:       { label:"Congé annuel",      icon:"🏖️", color:"#059669" },
  maladie:      { label:"Congé maladie",     icon:"🏥", color:"#DC2626" },
  maternite:    { label:"Congé maternité",   icon:"👶", color:"#7C3AED" },
  paternite:    { label:"Congé paternité",   icon:"👨‍👶", color:"#1B4F9E" },
  exceptionnel: { label:"Congé exceptionnel",icon:"⭐", color:"#D97706" },
};

// ─── SVG Icons ────────────────────────────────────────────────
const I = {
  users:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  user:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  org:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="8" height="6" rx="1"/><rect x="9" y="16" width="6" height="6" rx="1"/><rect x="17" y="16" width="6" height="6" rx="1"/><path d="M6 8v4h12V8M12 12v4"/></svg>,
  recruit: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  contract:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  clock:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  calendar:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  money:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>,
  star:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  book:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
  alert:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  health:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  audit:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  report:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  grid:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  list:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  plus:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  save:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  open:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  dl:      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  print:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  check:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  trend:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  edit:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  link:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
};

// ─── Modal wrapper ───────────────────────────────────────────
function Modal({ open, onClose, title, children, maxWidth = 680 }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="mov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mov-box" style={{ maxWidth }}>
        <div className="mov-hdr"><h3>{title}</h3><button className="mov-cls" onClick={onClose}>×</button></div>
        <div className="mov-body">{children}</div>
      </div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────
function KpiCard({ color, icon, value, label, sub, urgent, onClick }) {
  return (
    <div className={`rh-kpi ${color} fu`} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      {urgent && <div className="kpi-dot" />}
      <div className={`rh-kpi-icon ${color}`}>{icon}</div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-lbl">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function Badge({ cls, children }) { return <span className={`rbdg ${cls}`}>{children}</span>; }
function Prog({ pct, color }) {
  return <div className="rh-prog"><div className="rh-prog-f" style={{ width:`${pct}%`, background:color }} /></div>;
}

// ─── Bar Chart ───────────────────────────────────────────────
function BarChart({ labels, data, color = "#1B4F9E", height = 200 }) {
  const ref = useRef(null); const chartRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new window.Chart(ref.current, {
        type: "bar",
        data: { labels, datasets: [{ label:"", data, backgroundColor:`${color}26`, borderColor:color, borderWidth:2, borderRadius:8, borderSkipped:false }] },
        options: { responsive:true, maintainAspectRatio:true, plugins:{ legend:{display:false}, tooltip:{backgroundColor:"#0B1E3B",padding:10,cornerRadius:10} }, scales: { x:{grid:{display:false},ticks:{font:{size:10},color:"#9CA3AF"},border:{display:false}}, y:{beginAtZero:true,grid:{color:"rgba(0,0,0,.04)"},ticks:{font:{size:10},color:"#9CA3AF",precision:0},border:{display:false}} } },
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [labels, data, color]);
  return <canvas ref={ref} style={{ maxHeight: height }} />;
}

// ─── Stars ───────────────────────────────────────────────────
function Stars({ note, max = 5 }) {
  return (
    <span style={{ display:"inline-flex", gap:2 }}>
      {Array.from({length:max}).map((_,i) => (
        <span key={i} className={i < Math.round(note) ? "star-filled" : "star-empty"} style={{ fontSize:13 }}>★</span>
      ))}
    </span>
  );
}

// ─── DEMO DATA ───────────────────────────────────────────────
const DEMO_EMPLOYES = [
  { _id:"1", matricule:"EMP-001", prenom:"Martin",  nom:"Leblanc",  sexe:"homme", date_naissance:"1975-03-15", poste:"medecin",       departement:"Chirurgie",    date_embauche:"2018-01-15", contrat:"cdi",   statut:"actif",   salaire_base:850000, telephone:"+242 06 111 2233", email:"m.leblanc@clinique.cg",   nationalite:"Congolaise", note_eval:4.5, conge_solde:18, absences_mois:0 },
  { _id:"2", matricule:"EMP-002", prenom:"Sophie",  nom:"Pierre",   sexe:"femme", date_naissance:"1982-07-22", poste:"medecin",       departement:"Gynécologie",  date_embauche:"2019-06-01", contrat:"cdi",   statut:"actif",   salaire_base:820000, telephone:"+242 05 444 5566", email:"s.pierre@clinique.cg",    nationalite:"Congolaise", note_eval:4.8, conge_solde:22, absences_mois:0 },
  { _id:"3", matricule:"EMP-003", prenom:"Aline",   nom:"Moukala",  sexe:"femme", date_naissance:"1990-11-08", poste:"infirmier",     departement:"Chirurgie",    date_embauche:"2021-03-10", contrat:"cdi",   statut:"actif",   salaire_base:420000, telephone:"+242 06 777 8899", email:"a.moukala@clinique.cg",   nationalite:"Congolaise", note_eval:4.2, conge_solde:14, absences_mois:1 },
  { _id:"4", matricule:"EMP-004", prenom:"Paul",    nom:"Nkomo",    sexe:"homme", date_naissance:"1985-05-20", poste:"laborantin",    departement:"Laboratoire",  date_embauche:"2020-09-15", contrat:"cdi",   statut:"actif",   salaire_base:380000, telephone:"+242 06 222 3344", email:"p.nkomo@clinique.cg",     nationalite:"Congolaise", note_eval:4.0, conge_solde:10, absences_mois:0 },
  { _id:"5", matricule:"EMP-005", prenom:"Fatima",  nom:"Diallo",   sexe:"femme", date_naissance:"1993-09-30", poste:"pharmacien",    departement:"Pharmacie",    date_embauche:"2022-01-20", contrat:"cdi",   statut:"conge",   salaire_base:450000, telephone:"+242 05 555 6677", email:"f.diallo@clinique.cg",    nationalite:"Malienne",   note_eval:3.8, conge_solde:5,  absences_mois:0 },
  { _id:"6", matricule:"EMP-006", prenom:"Jacques", nom:"Bongo",    sexe:"homme", date_naissance:"1988-02-14", poste:"radiologue",    departement:"Imagerie",     date_embauche:"2017-08-01", contrat:"cdi",   statut:"actif",   salaire_base:750000, telephone:"+242 06 888 9900", email:"j.bongo@clinique.cg",     nationalite:"Congolaise", note_eval:4.6, conge_solde:20, absences_mois:0 },
  { _id:"7", matricule:"EMP-007", prenom:"Marie",   nom:"Nguema",   sexe:"femme", date_naissance:"1995-04-18", poste:"infirmier",     departement:"Pédiatrie",    date_embauche:"2023-03-01", contrat:"cdd",   statut:"actif",   salaire_base:350000, telephone:"+242 05 111 2222", email:"m.nguema@clinique.cg",    nationalite:"Congolaise", note_eval:3.5, conge_solde:8,  absences_mois:2 },
  { _id:"8", matricule:"EMP-008", prenom:"André",   nom:"Makosso",  sexe:"homme", date_naissance:"1978-12-05", poste:"administratif", departement:"Administration",date_embauche:"2015-06-15", contrat:"cdi",   statut:"actif",   salaire_base:320000, telephone:"+242 06 333 4455", email:"a.makosso@clinique.cg",   nationalite:"Congolaise", note_eval:4.1, conge_solde:25, absences_mois:0 },
];

const DEMO_CONGES = [
  { _id:"c1", employe_id:"3", employe_nom:"Aline Moukala",  type:"annuel",    date_debut:"2025-06-15", date_fin:"2025-06-29", nb_jours:15, statut:"approuve",   motif:"Congés d'été" },
  { _id:"c2", employe_id:"5", employe_nom:"Fatima Diallo",  type:"maternite", date_debut:"2025-06-01", date_fin:"2025-08-31", nb_jours:91, statut:"approuve",   motif:"Congé maternité" },
  { _id:"c3", employe_id:"7", employe_nom:"Marie Nguema",   type:"maladie",   date_debut:"2025-06-02", date_fin:"2025-06-06", nb_jours:5,  statut:"approuve",   motif:"Grippe sévère" },
  { _id:"c4", employe_id:"1", employe_nom:"Martin Leblanc", type:"annuel",    date_debut:"2025-07-01", date_fin:"2025-07-14", nb_jours:14, statut:"en_attente", motif:"Vacances familiales" },
  { _id:"c5", employe_id:"6", employe_nom:"Jacques Bongo",  type:"exceptionnel",date_debut:"2025-05-28", date_fin:"2025-05-30", nb_jours:3, statut:"approuve",   motif:"Décès familial" },
];

const DEMO_CANDIDATURES = [
  { _id:"r1", nom:"Clarisse Obiang",  poste:"infirmier",     experience:"3 ans", diplome:"BTS Infirmier", date_depot:"2025-05-28", statut:"entretien",  email:"c.obiang@gmail.com" },
  { _id:"r2", nom:"Franck Mbemba",    poste:"laborantin",    experience:"5 ans", diplome:"BTS Labomédico", date_depot:"2025-05-30", statut:"en_analyse", email:"f.mbemba@gmail.com" },
  { _id:"r3", nom:"Héloïse Nzamba",   poste:"administratif", experience:"2 ans", diplome:"Licence Gestion", date_depot:"2025-06-01", statut:"recu",       email:"h.nzamba@gmail.com" },
  { _id:"r4", nom:"Bernard Koumba",   poste:"medecin",       experience:"8 ans", diplome:"Docteur en Médecine", date_depot:"2025-06-01", statut:"en_analyse", email:"b.koumba@gmail.com" },
];

const DEMO_POINTAGES = [
  { _id:"p1", employe_id:"1", employe_nom:"Martin Leblanc",  date:"2025-06-01", heure_entree:"07:45", heure_sortie:"16:30", retard_min:0,  heures_sup:0.5,  statut:"present" },
  { _id:"p2", employe_id:"2", employe_nom:"Sophie Pierre",   date:"2025-06-01", heure_entree:"08:10", heure_sortie:"17:00", retard_min:10, heures_sup:0,    statut:"present" },
  { _id:"p3", employe_id:"3", employe_nom:"Aline Moukala",   date:"2025-06-01", heure_entree:"08:00", heure_sortie:"16:00", retard_min:0,  heures_sup:0,    statut:"present" },
  { _id:"p4", employe_id:"7", employe_nom:"Marie Nguema",    date:"2025-06-01", heure_entree:"—",     heure_sortie:"—",     retard_min:0,  heures_sup:0,    statut:"absent" },
  { _id:"p5", employe_id:"4", employe_nom:"Paul Nkomo",      date:"2025-06-01", heure_entree:"07:55", heure_sortie:"16:05", retard_min:0,  heures_sup:0,    statut:"present" },
];

const DEMO_EVALUATIONS = [
  { _id:"e1", employe_id:"1", employe_nom:"Martin Leblanc", periode:"2025-S1", ponctualite:4, qualite:5, productivite:4, discipline:5, relation_patient:5, note_globale:4.5, commentaire:"Excellent médecin, très apprécié des patients.", evaluateur:"Direction" },
  { _id:"e2", employe_id:"2", employe_nom:"Sophie Pierre",  periode:"2025-S1", ponctualite:5, qualite:5, productivite:5, discipline:5, relation_patient:4, note_globale:4.8, commentaire:"Travail remarquable en gynécologie.", evaluateur:"Direction" },
  { _id:"e3", employe_id:"3", employe_nom:"Aline Moukala",  periode:"2025-S1", ponctualite:4, qualite:4, productivite:4, discipline:4, relation_patient:5, note_globale:4.2, commentaire:"Infirmière sérieuse et dévouée.", evaluateur:"Chef de service" },
  { _id:"e4", employe_id:"7", employe_nom:"Marie Nguema",   periode:"2025-S1", ponctualite:3, qualite:4, productivite:3, discipline:4, relation_patient:4, note_globale:3.5, commentaire:"Absences répétées à surveiller.", evaluateur:"Chef de service" },
];

const DEMO_FORMATIONS = [
  { _id:"f1", titre:"Formation urgences médicales",    type:"interne",  date:"2025-04-10", duree_h:8,  participants:["Martin Leblanc","Sophie Pierre","Aline Moukala"], certificat:true, statut:"termine" },
  { _id:"f2", titre:"Séminaire gestion des soins",     type:"externe",  date:"2025-05-20", duree_h:16, participants:["Aline Moukala","Marie Nguema"], certificat:true,  statut:"termine" },
  { _id:"f3", titre:"Atelier hygiène et sécurité",     type:"interne",  date:"2025-06-15", duree_h:4,  participants:["Paul Nkomo","André Makosso"],    certificat:false, statut:"planifie" },
  { _id:"f4", titre:"Formation logiciel médical",      type:"externe",  date:"2025-07-01", duree_h:12, participants:["André Makosso"],                 certificat:true,  statut:"planifie" },
];

const DEMO_SANCTIONS = [
  { _id:"d1", employe_id:"7", employe_nom:"Marie Nguema",  type:"avertissement",  date:"2025-05-15", motif:"Absences injustifiées répétées (3x ce mois)", statut:"notifie" },
  { _id:"d2", employe_id:"3", employe_nom:"Aline Moukala", type:"blame",          date:"2025-04-20", motif:"Non-respect du protocole de soins",           statut:"notifie" },
];

const DEMO_AUDIT = [
  { _id:"a1", action:"Création employé",   utilisateur:"Admin RH",     date:"2025-06-01T09:15:00", details:"Création dossier EMP-008 — André Makosso" },
  { _id:"a2", action:"Validation congé",   utilisateur:"Dir. Médicale", date:"2025-06-01T10:30:00", details:"Approbation congé maternité Fatima Diallo" },
  { _id:"a3", action:"Paiement salaire",   utilisateur:"Comptabilité",  date:"2025-05-31T14:00:00", details:"Virement salaires mai 2025 — 8 employés" },
  { _id:"a4", action:"Modification dossier",utilisateur:"RH",           date:"2025-05-30T11:20:00", details:"Mise à jour contrat Martin Leblanc" },
  { _id:"a5", action:"Sanction émise",     utilisateur:"RH",           date:"2025-05-15T09:00:00", details:"Avertissement notifié à Marie Nguema" },
];

const MOIS_LABELS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const DEMO_EFFECTIF_MOIS = [8, 8, 9, 9, 8, 8, 9, 0, 0, 0, 0, 0];
const DEMO_ABSENCE_MOIS  = [2, 1, 3, 2, 4, 3, 0, 0, 0, 0, 0, 0];

const PLANNING_JOURS = ["Lun 02", "Mar 03", "Mer 04", "Jeu 05", "Ven 06", "Sam 07", "Dim 08"];
const PLANNING_DATA = {
  "Martin Leblanc":  ["travail","travail","travail","travail","travail","repos","repos"],
  "Sophie Pierre":   ["travail","travail","conge","conge","conge","conge","conge"],
  "Aline Moukala":   ["travail","garde","travail","travail","travail","repos","repos"],
  "Paul Nkomo":      ["travail","travail","travail","repos","travail","astreinte","repos"],
  "Fatima Diallo":   ["conge","conge","conge","conge","conge","conge","conge"],
  "Jacques Bongo":   ["travail","travail","travail","travail","garde","repos","repos"],
  "Marie Nguema":    ["absence","travail","travail","travail","travail","repos","repos"],
  "André Makosso":   ["travail","travail","travail","travail","travail","repos","repos"],
};

const PLAN_LABEL = { travail:"Travail", garde:"Garde", conge:"Congé", repos:"Repos", absence:"Absent", astreinte:"Astreinte" };

const EMPTY_EMP = { matricule:"", prenom:"", nom:"", sexe:"homme", date_naissance:"", nationalite:"", telephone:"", email:"", adresse:"", poste:"infirmier", departement:"", service:"", date_embauche:"", contrat:"cdi", statut:"actif", salaire_base:"" };
const EMPTY_CONGE = { employe_id:"", type:"annuel", date_debut:"", date_fin:"", motif:"" };
const EMPTY_CANDIDATURE = { nom:"", poste:"infirmier", experience:"", diplome:"", email:"", telephone:"", statut:"recu" };
const EMPTY_EVAL = { employe_id:"", periode:"2025-S1", ponctualite:3, qualite:3, productivite:3, discipline:3, relation_patient:3, commentaire:"", evaluateur:"" };
const EMPTY_FORMATION = { titre:"", type:"interne", date:"", duree_h:"", participants:"", certificat:false };
const EMPTY_SANCTION = { employe_id:"", type:"avertissement", motif:"" };

// ─── MAIN COMPONENT ──────────────────────────────────────────
export default function RessourcesHumaines() {
  const dispatch = useDispatch();
  const reduxStaff = useSelector(selectStaff);
  const reduxLeaves = useSelector(selectLeaves);

  useEffect(() => {
    dispatch(fetchStaff({}));
    dispatch(fetchLeaves());
    dispatch(fetchSchedules());
  }, [dispatch]);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => { const fn = () => setIsMobile(window.innerWidth <= 599); window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn); }, []);

  const [tab, setTab]                     = useState("dashboard");
  const [section, setSection]             = useState("infos");
  const [employes, setEmployes]           = useState(DEMO_EMPLOYES);
  const [conges, setConges]               = useState(DEMO_CONGES);
  const [candidatures, setCandidatures]   = useState(DEMO_CANDIDATURES);
  const [evaluations, setEvaluations]     = useState(DEMO_EVALUATIONS);
  const [formations, setFormations]       = useState(DEMO_FORMATIONS);
  const [sanctions, setSanctions]         = useState(DEMO_SANCTIONS);
  const [pointages, setPointages]         = useState(DEMO_POINTAGES);
  const [auditLog, setAuditLog]           = useState(DEMO_AUDIT);
  const [currentEmp, setCurrentEmp]       = useState(null);
  const [search, setSearch]               = useState("");
  const [filterPoste, setFilterPoste]     = useState("");
  const [filterStatut, setFilterStatut]   = useState("");
  const [saving, setSaving]               = useState(false);
  const [page, setPage]                   = useState(1);

  // Modals
  const [modalEmp,        setModalEmp]        = useState(false);
  const [modalConge,      setModalConge]       = useState(false);
  const [modalCandidat,   setModalCandidat]    = useState(false);
  const [modalEval,       setModalEval]        = useState(false);
  const [modalFormation,  setModalFormation]   = useState(false);
  const [modalSanction,   setModalSanction]    = useState(false);
  const [modalPointage,   setModalPointage]    = useState(false);

  // Forms
  const [formEmp,       setFormEmp]       = useState(EMPTY_EMP);
  const [formConge,     setFormConge]     = useState(EMPTY_CONGE);
  const [formCandidat,  setFormCandidat]  = useState(EMPTY_CANDIDATURE);
  const [formEval,      setFormEval]      = useState(EMPTY_EVAL);
  const [formFormation, setFormFormation] = useState(EMPTY_FORMATION);
  const [formSanction,  setFormSanction]  = useState(EMPTY_SANCTION);

  // KPIs
  const total      = employes.length;
  const actifs     = employes.filter(e => e.statut === "actif").length;
  const enConge    = employes.filter(e => e.statut === "conge").length;
  const medecins   = employes.filter(e => e.poste === "medecin").length;
  const infirmiers = employes.filter(e => e.poste === "infirmier").length;
  const nbSanction = sanctions.length;
  const congesAttente = conges.filter(c => c.statut === "en_attente").length;
  const masseSalariale = employes.reduce((s,e) => s + (e.salaire_base || 0), 0);

  const filteredEmps = employes.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${e.prenom} ${e.nom} ${e.matricule} ${e.poste}`.toLowerCase().includes(q);
    const matchPoste  = !filterPoste  || e.poste  === filterPoste;
    const matchStatut = !filterStatut || e.statut === filterStatut;
    return matchSearch && matchPoste && matchStatut;
  });

  const openEmp = (e) => { setCurrentEmp(e); setSection("infos"); setTab("dossier"); };

  const createEmp = (ev) => {
    ev.preventDefault();
    setSaving(true);
    const newE = { ...formEmp, _id:Date.now().toString(), matricule:`EMP-${String(employes.length+1).padStart(3,"0")}`, note_eval:0, conge_solde:18, absences_mois:0 };
    setEmployes(prev => [newE, ...prev]);
    toast.success(`✅ Employé ${newE.prenom} ${newE.nom} créé`);
    setModalEmp(false); setFormEmp(EMPTY_EMP); setSaving(false);
  };

  const addConge = (ev) => {
    ev.preventDefault();
    const emp = employes.find(e => e._id === formConge.employe_id);
    const d1 = new Date(formConge.date_debut), d2 = new Date(formConge.date_fin);
    const nb = Math.ceil((d2 - d1) / (1000*60*60*24)) + 1;
    const newC = { ...formConge, _id:Date.now().toString(), employe_nom:emp ? `${emp.prenom} ${emp.nom}` : "—", nb_jours:nb, statut:"en_attente" };
    setConges(prev => [newC, ...prev]);
    toast.success("✅ Demande de congé soumise");
    setModalConge(false); setFormConge(EMPTY_CONGE);
  };

  const approuverConge = (id) => {
    setConges(prev => prev.map(c => c._id === id ? { ...c, statut:"approuve" } : c));
    toast.success("✅ Congé approuvé");
  };

  const addCandidat = (ev) => {
    ev.preventDefault();
    const newC = { ...formCandidat, _id:Date.now().toString(), date_depot:new Date().toISOString().substring(0,10) };
    setCandidatures(prev => [newC, ...prev]);
    toast.success("✅ Candidature enregistrée");
    setModalCandidat(false); setFormCandidat(EMPTY_CANDIDATURE);
  };

  const addEval = (ev) => {
    ev.preventDefault();
    const emp = employes.find(e => e._id === formEval.employe_id);
    const note = Math.round((formEval.ponctualite + formEval.qualite + formEval.productivite + formEval.discipline + formEval.relation_patient) / 5 * 10) / 10;
    const newE = { ...formEval, _id:Date.now().toString(), employe_nom:emp ? `${emp.prenom} ${emp.nom}` : "—", note_globale:note };
    setEvaluations(prev => [newE, ...prev]);
    toast.success("✅ Évaluation enregistrée");
    setModalEval(false); setFormEval(EMPTY_EVAL);
  };

  const addFormation = (ev) => {
    ev.preventDefault();
    const newF = { ...formFormation, _id:Date.now().toString(), participants:formFormation.participants.split(",").map(s=>s.trim()) };
    setFormations(prev => [newF, ...prev]);
    toast.success("✅ Formation planifiée");
    setModalFormation(false); setFormFormation(EMPTY_FORMATION);
  };

  const addSanction = (ev) => {
    ev.preventDefault();
    const emp = employes.find(e => e._id === formSanction.employe_id);
    const newS = { ...formSanction, _id:Date.now().toString(), employe_nom:emp ? `${emp.prenom} ${emp.nom}` : "—", date:new Date().toISOString().substring(0,10), statut:"notifie" };
    setSanctions(prev => [newS, ...prev]);
    toast.success("⚠️ Sanction enregistrée");
    setModalSanction(false); setFormSanction(EMPTY_SANCTION);
  };

  const updateEmp = (updates) => {
    setEmployes(prev => prev.map(e => e._id === currentEmp._id ? { ...e, ...updates } : e));
    setCurrentEmp(prev => ({ ...prev, ...updates }));
    toast.success("✅ Dossier mis à jour");
  };

  // Avatar color
  const avatarColor = (poste) => {
    const map = { medecin:"#1B4F9E", infirmier:"#0EA5A0", laborantin:"#7C3AED", radiologue:"#D97706", pharmacien:"#059669", administratif:"#6B7280", aide_soignant:"#CA8A04", maintenance:"#DC2626" };
    return map[poste] || "#6B7280";
  };

  const SANCTION_CFG = {
    avertissement:{ cls:"yellow", label:"Avertissement", icon:"⚠️" },
    blame:        { cls:"orange", label:"Blâme",         icon:"📋" },
    suspension:   { cls:"red",    label:"Suspension",    icon:"⛔" },
    licenciement: { cls:"red",    label:"Licenciement",  icon:"🚫" },
  };

  const CANDIDAT_CFG = {
    recu:       { cls:"blue",   label:"Reçu" },
    en_analyse: { cls:"orange", label:"En analyse" },
    entretien:  { cls:"purple", label:"Entretien" },
    selectionne:{ cls:"green",  label:"Sélectionné" },
    refuse:     { cls:"red",    label:"Refusé" },
  };

  const CONGE_STATUT = {
    en_attente: { cls:"orange", label:"En attente" },
    approuve:   { cls:"green",  label:"Approuvé" },
    refuse:     { cls:"red",    label:"Refusé" },
  };

  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      <div className="rh">

        {/* ── TOPBAR ── */}
        <div className="rh-top">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap", position:"relative", zIndex:2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:54, height:54, borderRadius:14, background:"rgba(255,255,255,.12)", border:"1.5px solid rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {I.users}
              </div>
              <div>
                <div style={{ fontSize:21, fontWeight:700, color:"#fff", letterSpacing:-.3 }}>Ressources Humaines</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.55)", marginTop:2 }}>{total} employés · Clinique Canadienne de Souanké</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button className="rbtn rbtn-teal" onClick={() => { setFormEmp(EMPTY_EMP); setModalEmp(true); }}>
                {I.plus} Nouvel employé
              </button>
              <button className="rbtn rbtn-ghost" style={{ color:"#fff", borderColor:"rgba(255,255,255,.3)" }} onClick={() => window.print()}>
                {I.print} Exporter
              </button>
            </div>
          </div>

          {/* Tabs */}
          {(() => {
            const TABS = [
              { key:"dashboard",   icon:I.grid,     label:"Tableau de bord",   labelM:"Dashboard" },
              { key:"employes",    icon:I.user,     label:"Employés",           labelM:"Employés" },
              { key:"dossier",     icon:I.contract, label:currentEmp?`${currentEmp.prenom} ${currentEmp.nom}`:"Dossier", labelM:"Dossier", disabled:!currentEmp },
              { key:"org",         icon:I.org,      label:"Organigramme",       labelM:"Organi." },
              { key:"recrutement", icon:I.recruit,  label:"Recrutement",        labelM:"Recrut." },
              { key:"presences",   icon:I.clock,    label:"Présences",          labelM:"Présences" },
              { key:"conges",      icon:I.calendar, label:`Congés${congesAttente>0?` (${congesAttente})`:""}`, labelM:"Congés" },
              { key:"planning",    icon:I.calendar, label:"Planning",           labelM:"Planning" },
              { key:"salaires",    icon:I.money,    label:"Salaires",           labelM:"Salaires" },
              { key:"evaluations", icon:I.star,     label:"Évaluations",        labelM:"Évaluat." },
              { key:"formations",  icon:I.book,     label:"Formations",         labelM:"Format." },
              { key:"discipline",  icon:I.alert,    label:"Discipline",         labelM:"Discipl." },
              { key:"sante",       icon:I.health,   label:"Santé au travail",   labelM:"Santé" },
              { key:"audit",       icon:I.audit,    label:"Audit RH",           labelM:"Audit" },
              { key:"rapports",    icon:I.report,   label:"Rapports",           labelM:"Rapports" },
            ].filter(t=>!t.disabled);
            return (
              <div style={isMobile?{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'4px',padding:'8px 10px',marginTop:'8px',background:'rgba(255,255,255,.07)',borderRadius:'10px 10px 0 0'}:{display:'flex',gap:'2px',marginTop:'16px',overflowX:'auto',scrollbarWidth:'none'}}>
                {TABS.map(t=>(
                  <button key={t.key} className={`rh-tab ${tab===t.key?"active":""}`} style={isMobile?{flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'6px 2px 7px',fontSize:'9px',gap:'2px',borderRadius:'8px',whiteSpace:'normal',minWidth:0}:{}} onClick={()=>setTab(t.key)}>
                    <span style={isMobile?{fontSize:'13px'}:{}}>{t.icon}</span>
                    <span style={isMobile?{lineHeight:1.2}:{}}>{isMobile?t.labelM:t.label}</span>
                    {t.key==="conges"&&congesAttente>0&&<span className="rh-tab-badge">{congesAttente}</span>}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

        <div style={{ padding: isMobile ? 14 : 24 }}>

          {/* ══ DASHBOARD ══ */}
          {tab === "dashboard" && (
            <div>
              {nbSanction > 0 && (
                <div className="al-warn fu" style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, flexWrap:"wrap" }}>
                  <div style={{ width:42, height:42, background:"#FEF3C7", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{I.alert}</div>
                  <div style={{ flex:1 }}>
                    <strong style={{ color:"#92400E", fontSize:13 }}>⚠ Alertes RH en attente</strong>
                    <div style={{ fontSize:12, color:"#B45309", marginTop:3 }}>
                      {congesAttente > 0 && <span>{congesAttente} demande(s) de congé en attente de validation · </span>}
                      {nbSanction} mesure(s) disciplinaire(s) ce mois
                    </div>
                  </div>
                  <button className="rbtn rbtn-orange rbtn-sm" onClick={() => setTab("conges")}>Voir congés →</button>
                </div>
              )}

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="blue"   icon={I.user}     value={total}       label="Total employés"    sub="tous postes confondus"         onClick={() => setTab("employes")} />
                <KpiCard color="green"  icon={I.check}    value={actifs}      label="Employés actifs"   sub="en service aujourd'hui"        onClick={() => { setFilterStatut("actif"); setTab("employes"); }} />
                <KpiCard color="orange" icon={I.calendar} value={enConge}     label="En congé"          sub="absence planifiée"             onClick={() => setTab("conges")} />
                <KpiCard color="teal"   icon={I.users}    value={medecins}    label="Médecins"          sub="corps médical"                 onClick={() => { setFilterPoste("medecin"); setTab("employes"); }} />
                <KpiCard color="purple" icon={I.health}   value={infirmiers}  label="Infirmiers"        sub="personnel soignant"            onClick={() => { setFilterPoste("infirmier"); setTab("employes"); }} />
                <KpiCard color="red"    icon={I.alert}    value={nbSanction}  label="Sanctions ce mois" sub="mesures disciplinaires"        urgent={nbSanction > 0} onClick={() => setTab("discipline")} />
                <KpiCard color="yellow" icon={I.money}    value={`${(masseSalariale/1000000).toFixed(1)}M`} label="Masse salariale" sub="FCFA / mois"     onClick={() => setTab("salaires")} />
                <KpiCard color="teal"   icon={I.book}     value={formations.filter(f=>f.statut==="planifie").length} label="Formations" sub="planifiées ce trimestre" onClick={() => setTab("formations")} />
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:20, marginBottom:24 }}>
                <div className="rh-card fu">
                  <div className="rh-card-hdr">
                    <div><h3>{I.trend} Effectif & Absences — 12 mois</h3><p>Évolution mensuelle</p></div>
                  </div>
                  <div style={{ padding:20 }}>
                    <BarChart labels={MOIS_LABELS} data={DEMO_EFFECTIF_MOIS} color="#1B4F9E" />
                  </div>
                </div>
                <div className="rh-card fu">
                  <div className="rh-card-hdr"><div><h3>Répartition par poste</h3><p>{total} employés</p></div></div>
                  <div style={{ padding:20 }}>
                    {Object.entries(POSTE_COLORS).map(([key, cfg]) => {
                      const n = employes.filter(e => e.poste === key).length;
                      if (n === 0) return null;
                      return (
                        <div key={key} style={{ marginBottom:10 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                            <span style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:"var(--rm)" }}>
                              <span style={{ width:10, height:10, borderRadius:3, background:cfg.color, display:"inline-block" }} />
                              {cfg.label}
                            </span>
                            <span style={{ fontWeight:700, fontSize:12, color:"var(--rn)" }}>{n}</span>
                          </div>
                          <Prog pct={Math.round(n/total*100)} color={cfg.color} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Employés récents */}
              <div className="rh-card fu">
                <div className="rh-card-hdr">
                  <div><h3>{I.user} Annuaire du personnel</h3><p>Derniers dossiers mis à jour</p></div>
                  <button className="rbtn rbtn-ghost rbtn-sm" onClick={() => setTab("employes")}>Voir tous →</button>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table className="rh-tbl">
                    <thead><tr><th>Matricule</th><th>Employé</th><th>Poste</th><th>Département</th><th>Contrat</th><th>Ancienneté</th><th>Note</th><th>Statut</th><th>Action</th></tr></thead>
                    <tbody>
                      {employes.slice(0,8).map(e => {
                        const pc = POSTE_COLORS[e.poste] || { cls:"gray", label:e.poste };
                        const sc = STATUT_EMP[e.statut] || { cls:"gray", label:e.statut };
                        const cc = CONTRAT_CFG[e.contrat] || { cls:"gray", label:e.contrat };
                        return (
                          <tr key={e._id}>
                            <td><span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--rb)", fontSize:12 }}>{e.matricule}</span></td>
                            <td>
                              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                <div className="emp-avatar" style={{ background:avatarColor(e.poste), width:34, height:34, fontSize:13 }}>
                                  {e.prenom[0]}{e.nom[0]}
                                </div>
                                <div>
                                  <div style={{ fontWeight:600, color:"var(--rn)", fontSize:13 }}>{e.prenom} {e.nom}</div>
                                  <div style={{ fontSize:11, color:"var(--rm)" }}>{e.sexe === "femme" ? "F" : "H"} · {ageCalc(e.date_naissance)}</div>
                                </div>
                              </div>
                            </td>
                            <td><Badge cls={pc.cls}>{pc.label}</Badge></td>
                            <td style={{ fontSize:12, color:"var(--rm)" }}>{e.departement}</td>
                            <td><Badge cls={cc.cls}>{cc.label}</Badge></td>
                            <td style={{ fontSize:12, color:"var(--rm)" }}>{anciennete(e.date_embauche)}</td>
                            <td>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <Stars note={e.note_eval} />
                                <span style={{ fontSize:11, color:"var(--rm)" }}>{e.note_eval}/5</span>
                              </div>
                            </td>
                            <td><Badge cls={sc.cls}>{sc.label}</Badge></td>
                            <td><button className="rbtn rbtn-ghost rbtn-sm" style={{ fontSize:11 }} onClick={() => openEmp(e)}>{I.open} Ouvrir</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ LISTE EMPLOYÉS ══ */}
          {tab === "employes" && (
            <div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--rn)" }}>Personnel de la clinique</div>
                  <div style={{ fontSize:12, color:"var(--rm)", marginTop:2 }}>{filteredEmps.length} employé(s)</div>
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }}>{I.search}</span>
                    <input className="rinp" style={{ paddingLeft:34, width:220 }} placeholder="Nom, matricule, poste..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <select className="rinp" style={{ width:160 }} value={filterPoste} onChange={e => setFilterPoste(e.target.value)}>
                    <option value="">Tous les postes</option>
                    {Object.entries(POSTE_COLORS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <select className="rinp" style={{ width:140 }} value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
                    <option value="">Tous statuts</option>
                    {Object.entries(STATUT_EMP).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <button className="rbtn rbtn-primary" onClick={() => { setFormEmp(EMPTY_EMP); setModalEmp(true); }}>
                    {I.plus} Nouvel employé
                  </button>
                </div>
              </div>

              <div className="rh-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="rh-tbl" style={{ minWidth:1000 }}>
                    <thead><tr><th>Matricule</th><th>Employé</th><th>Poste</th><th>Département</th><th>Téléphone</th><th>Contrat</th><th>Date embauche</th><th>Ancienneté</th><th>Solde congé</th><th>Statut</th><th>Action</th></tr></thead>
                    <tbody>
                      {filteredEmps.map(e => {
                        const pc = POSTE_COLORS[e.poste] || { cls:"gray", label:e.poste, color:"#6B7280" };
                        const sc = STATUT_EMP[e.statut] || { cls:"gray", label:e.statut };
                        const cc = CONTRAT_CFG[e.contrat] || { cls:"gray", label:e.contrat };
                        return (
                          <tr key={e._id}>
                            <td><span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--rb)", fontSize:12 }}>{e.matricule}</span></td>
                            <td>
                              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                <div className="emp-avatar" style={{ background:pc.color, width:36, height:36, fontSize:13 }}>{e.prenom[0]}{e.nom[0]}</div>
                                <div>
                                  <div style={{ fontWeight:600, color:"var(--rn)" }}>{e.prenom} {e.nom}</div>
                                  <div style={{ fontSize:11, color:"var(--rm)" }}>{e.email}</div>
                                </div>
                              </div>
                            </td>
                            <td><Badge cls={pc.cls}>{pc.label}</Badge></td>
                            <td style={{ fontSize:12, color:"var(--rm)" }}>{e.departement}</td>
                            <td style={{ fontSize:12, color:"var(--rm)" }}>{e.telephone}</td>
                            <td><Badge cls={cc.cls}>{cc.label}</Badge></td>
                            <td style={{ fontSize:12, color:"var(--rm)" }}>{fmtDate(e.date_embauche)}</td>
                            <td style={{ fontSize:12, color:"var(--rm)" }}>{anciennete(e.date_embauche)}</td>
                            <td>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <span style={{ fontWeight:700, color:e.conge_solde < 5 ? "var(--rr)" : "var(--rg)", fontSize:13 }}>{e.conge_solde}j</span>
                                {e.conge_solde < 5 && <span style={{ fontSize:10, color:"var(--rr)" }}>faible</span>}
                              </div>
                            </td>
                            <td><Badge cls={sc.cls}>{sc.label}</Badge></td>
                            <td><button className="rbtn rbtn-ghost rbtn-sm" style={{ fontSize:11 }} onClick={() => openEmp(e)}>{I.open} Ouvrir</button></td>
                          </tr>
                        );
                      })}
                      {filteredEmps.length === 0 && <tr><td colSpan={11} style={{ padding:40, textAlign:"center", color:"var(--rm)" }}>Aucun employé trouvé</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ DOSSIER EMPLOYÉ ══ */}
          {tab === "dossier" && currentEmp && (() => {
            const pc = POSTE_COLORS[currentEmp.poste] || { cls:"gray", label:currentEmp.poste, color:"#6B7280" };
            const sc = STATUT_EMP[currentEmp.statut] || { cls:"gray", label:currentEmp.statut };
            const cc = CONTRAT_CFG[currentEmp.contrat] || { cls:"gray", label:currentEmp.contrat };
            const empConges = conges.filter(c => c.employe_id === currentEmp._id);
            const empEvals  = evaluations.filter(v => v.employe_id === currentEmp._id);
            const empSanc   = sanctions.filter(s => s.employe_id === currentEmp._id);
            return (
              <div>
                {/* Header */}
                <div style={{ background:"linear-gradient(135deg,#0B1E3B,#132744)", borderRadius:18, padding:"20px 24px", marginBottom:20, color:"#fff" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                      <div className="emp-avatar" style={{ background:pc.color, width:60, height:60, fontSize:22, borderRadius:16, border:"2px solid rgba(255,255,255,.3)" }}>
                        {currentEmp.prenom[0]}{currentEmp.nom[0]}
                      </div>
                      <div>
                        <div style={{ fontSize:18, fontWeight:700 }}>{currentEmp.prenom} {currentEmp.nom}</div>
                        <div style={{ fontSize:12, color:"rgba(255,255,255,.65)", marginTop:2 }}>
                          {pc.label} · {currentEmp.departement} · {anciennete(currentEmp.date_embauche)} d'ancienneté
                        </div>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:3 }}>
                          📞 {currentEmp.telephone} · ✉️ {currentEmp.email}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                      <div style={{ background:"rgba(255,255,255,.1)", borderRadius:12, padding:"10px 16px", textAlign:"center" }}>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,.6)", fontWeight:600, textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>Évaluation</div>
                        <Stars note={currentEmp.note_eval} />
                        <div style={{ fontSize:12, color:"rgba(255,255,255,.7)", marginTop:2 }}>{currentEmp.note_eval}/5</div>
                      </div>
                      <div style={{ background:"rgba(255,255,255,.1)", borderRadius:12, padding:"10px 16px", textAlign:"center" }}>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,.6)", fontWeight:600, textTransform:"uppercase", marginBottom:4 }}>Congé solde</div>
                        <div style={{ fontSize:22, fontWeight:800, color:currentEmp.conge_solde < 5 ? "#FCA5A5" : "#6EE7B7" }}>{currentEmp.conge_solde}</div>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,.5)" }}>jours</div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontFamily:"monospace", fontSize:16, fontWeight:700, color:"rgba(255,255,255,.9)" }}>{currentEmp.matricule}</div>
                        <Badge cls={sc.cls} style={{ marginTop:6 }}>{sc.label}</Badge>
                        <div style={{ marginTop:6 }}><Badge cls={cc.cls}>{cc.label}</Badge></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alerte sanctions */}
                {empSanc.length > 0 && (
                  <div className="al-warn" style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
                    {I.alert}
                    <span style={{ fontSize:13, color:"#92400E" }}>
                      <strong>{empSanc.length} mesure(s) disciplinaire(s)</strong> enregistrée(s) pour cet employé
                    </span>
                  </div>
                )}

                <div className="sec-nav" style={{ borderRadius:"18px 18px 0 0" }}>
                  {[
                    { id:"infos",      label:"👤 Infos personnelles" },
                    { id:"professionnel", label:"💼 Professionnel" },
                    { id:"conges_emp", label:`🏖️ Congés (${empConges.length})` },
                    { id:"salaire_emp",label:"💰 Salaire" },
                    { id:"eval_emp",   label:`⭐ Évaluations (${empEvals.length})` },
                    { id:"discipline_emp", label:`⚠️ Discipline${empSanc.length > 0 ? ` (${empSanc.length})` : ""}`, warn:empSanc.length > 0 },
                    { id:"sante_emp",  label:"🏥 Santé au travail" },
                    { id:"docs_emp",   label:"📄 Documents" },
                  ].map(s => (
                    <button key={s.id} className={`sec-btn ${section === s.id ? "active" : ""} ${s.warn ? "warn" : ""}`} onClick={() => setSection(s.id)}>{s.label}</button>
                  ))}
                </div>

                {/* ── INFOS PERSONNELLES ── */}
                {section === "infos" && (
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginTop:20 }}>
                    <div className="rh-card">
                      <div className="rh-card-hdr"><h3>👤 Informations personnelles</h3></div>
                      <div style={{ padding:20, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                        {[
                          ["Prénom", currentEmp.prenom], ["Nom", currentEmp.nom],
                          ["Sexe", currentEmp.sexe === "femme" ? "Féminin" : "Masculin"], ["Date naissance", fmtDate(currentEmp.date_naissance)],
                          ["Âge", ageCalc(currentEmp.date_naissance)], ["Nationalité", currentEmp.nationalite || "—"],
                          ["Téléphone", currentEmp.telephone || "—"], ["Email", currentEmp.email || "—"],
                        ].map(([lbl,val]) => (
                          <div key={lbl} style={{ background:"#F8FAFD", borderRadius:10, padding:"10px 12px" }}>
                            <div style={{ fontSize:10, fontWeight:600, color:"var(--rm)", textTransform:"uppercase", letterSpacing:.4 }}>{lbl}</div>
                            <div style={{ fontSize:13, fontWeight:600, color:"var(--rn)", marginTop:2 }}>{val}</div>
                          </div>
                        ))}
                        {currentEmp.adresse && (
                          <div style={{ gridColumn:"1/-1", background:"#F8FAFD", borderRadius:10, padding:"10px 12px" }}>
                            <div style={{ fontSize:10, fontWeight:600, color:"var(--rm)", textTransform:"uppercase", letterSpacing:.4 }}>Adresse</div>
                            <div style={{ fontSize:13, color:"var(--rn)", marginTop:2 }}>{currentEmp.adresse}</div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="rh-card">
                      <div className="rh-card-hdr"><h3>📋 Informations professionnelles</h3></div>
                      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:12 }}>
                        <div>
                          <label className="rlbl">Statut *</label>
                          <select className="rinp" value={currentEmp.statut} onChange={e => setCurrentEmp(p => ({...p, statut:e.target.value}))}>
                            {Object.entries(STATUT_EMP).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="rlbl">Poste</label>
                          <select className="rinp" value={currentEmp.poste} onChange={e => setCurrentEmp(p => ({...p, poste:e.target.value}))}>
                            {Object.entries(POSTE_COLORS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="rlbl">Département</label>
                          <input className="rinp" value={currentEmp.departement} onChange={e => setCurrentEmp(p => ({...p, departement:e.target.value}))} />
                        </div>
                        <div style={{ background:"#EEF4FF", borderRadius:12, padding:"12px 14px" }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"var(--rm)", textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>🔗 Liaisons modules</div>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                            {["📋 Planning","💰 Salaires","⭐ Évaluations","🏥 Santé","📁 Documents"].map(lbl => (
                              <span key={lbl} style={{ background:"white", border:"1px solid var(--rbr)", borderRadius:8, padding:"4px 10px", fontSize:11, fontWeight:600, color:"var(--rn)", cursor:"pointer" }}>{lbl}</span>
                            ))}
                          </div>
                        </div>
                        <button className="rbtn rbtn-teal rbtn-sm" disabled={saving} onClick={() => updateEmp({ statut:currentEmp.statut, poste:currentEmp.poste, departement:currentEmp.departement })}>
                          {I.save} Enregistrer
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── PROFESSIONNEL ── */}
                {section === "professionnel" && (
                  <div style={{ marginTop:20 }}>
                    <div className="rh-card">
                      <div className="rh-card-hdr"><h3>💼 Informations du contrat</h3></div>
                      <div style={{ padding:20, display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                        {[
                          ["Poste", (POSTE_COLORS[currentEmp.poste]||{}).label || currentEmp.poste],
                          ["Département", currentEmp.departement || "—"],
                          ["Service", currentEmp.service || "—"],
                          ["Date d'embauche", fmtDate(currentEmp.date_embauche)],
                          ["Ancienneté", anciennete(currentEmp.date_embauche)],
                          ["Type de contrat", (CONTRAT_CFG[currentEmp.contrat]||{}).label || currentEmp.contrat],
                          ["Salaire de base", currentEmp.salaire_base ? `${currentEmp.salaire_base.toLocaleString("fr-FR")} FCFA` : "—"],
                        ].map(([lbl,val]) => (
                          <div key={lbl} style={{ background:"#F8FAFD", borderRadius:10, padding:"10px 12px" }}>
                            <div style={{ fontSize:10, fontWeight:600, color:"var(--rm)", textTransform:"uppercase", letterSpacing:.4 }}>{lbl}</div>
                            <div style={{ fontSize:13, fontWeight:600, color:"var(--rn)", marginTop:2 }}>{val}</div>
                          </div>
                        ))}
                        <div style={{ gridColumn:"1/-1", background:"#EEF4FF", borderRadius:12, padding:"12px 14px" }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"var(--rb)", marginBottom:8 }}>📋 Récapitulatif contrat</div>
                          <div style={{ fontSize:13, color:"var(--rn)" }}>
                            <strong>{(CONTRAT_CFG[currentEmp.contrat]||{}).label}</strong> · Embauché le <strong>{fmtDate(currentEmp.date_embauche)}</strong> · {anciennete(currentEmp.date_embauche)} d'ancienneté
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── CONGÉS EMPLOYÉ ── */}
                {section === "conges_emp" && (
                  <div style={{ marginTop:20 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                      <div>
                        <div style={{ fontSize:15, fontWeight:700, color:"var(--rn)" }}>Congés de {currentEmp.prenom} {currentEmp.nom}</div>
                        <div style={{ fontSize:12, color:"var(--rm)" }}>Solde disponible : <strong>{currentEmp.conge_solde} jours</strong></div>
                      </div>
                      <button className="rbtn rbtn-primary" onClick={() => { setFormConge({...EMPTY_CONGE, employe_id:currentEmp._id}); setModalConge(true); }}>
                        {I.plus} Soumettre congé
                      </button>
                    </div>
                    <div className="rh-card">
                      <div style={{ overflowX:"auto" }}>
                        <table className="rh-tbl">
                          <thead><tr><th>Type</th><th>Date début</th><th>Date fin</th><th>Nb jours</th><th>Motif</th><th>Statut</th></tr></thead>
                          <tbody>
                            {empConges.length === 0 ? (
                              <tr><td colSpan={6} style={{ padding:40, textAlign:"center", color:"var(--rm)" }}>Aucun congé enregistré</td></tr>
                            ) : empConges.map(c => {
                              const cc = CONGE_CFG[c.type] || { label:c.type, icon:"📅", color:"#6B7280" };
                              const cs = CONGE_STATUT[c.statut] || { cls:"gray", label:c.statut };
                              return (
                                <tr key={c._id}>
                                  <td><span style={{ display:"flex", alignItems:"center", gap:6, fontSize:13 }}>{cc.icon} {cc.label}</span></td>
                                  <td style={{ fontSize:12 }}>{fmtDate(c.date_debut)}</td>
                                  <td style={{ fontSize:12 }}>{fmtDate(c.date_fin)}</td>
                                  <td style={{ fontWeight:700, color:"var(--rb)" }}>{c.nb_jours}j</td>
                                  <td style={{ fontSize:12, color:"var(--rm)" }}>{c.motif}</td>
                                  <td><Badge cls={cs.cls}>{cs.label}</Badge></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── SALAIRE ── */}
                {section === "salaire_emp" && (
                  <div style={{ marginTop:20 }}>
                    <div className="rh-card">
                      <div className="rh-card-hdr"><h3>💰 Fiche de paie — {currentEmp.prenom} {currentEmp.nom}</h3></div>
                      <div style={{ padding:20 }}>
                        {(() => {
                          const base = currentEmp.salaire_base || 0;
                          const prime = Math.round(base * 0.1);
                          const hsSup = Math.round(base * 0.05);
                          const transport = 25000;
                          const brut = base + prime + hsSup + transport;
                          const cnss = Math.round(brut * 0.028);
                          const irpp = Math.round(brut * 0.15);
                          const retenues = cnss + irpp;
                          const net = brut - retenues;
                          return (
                            <>
                              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
                                {[
                                  ["Salaire de base", base.toLocaleString("fr-FR")+" FCFA", "var(--rn)"],
                                  ["Prime de rendement", prime.toLocaleString("fr-FR")+" FCFA", "var(--rg)"],
                                  ["Heures supplémentaires", hsSup.toLocaleString("fr-FR")+" FCFA", "var(--rb)"],
                                  ["Indemnité transport", transport.toLocaleString("fr-FR")+" FCFA", "var(--rt)"],
                                  ["CNSS (2.8%)", `-${cnss.toLocaleString("fr-FR")} FCFA`, "var(--rr)"],
                                  ["IRPP (15%)", `-${irpp.toLocaleString("fr-FR")} FCFA`, "var(--rr)"],
                                ].map(([lbl,val,col]) => (
                                  <div key={lbl} style={{ background:"#F8FAFD", borderRadius:10, padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                                    <span style={{ fontSize:12, color:"var(--rm)" }}>{lbl}</span>
                                    <span style={{ fontWeight:700, fontSize:13, color:col }}>{val}</span>
                                  </div>
                                ))}
                              </div>
                              <div style={{ background:"linear-gradient(135deg,#EEF4FF,#DBEAFE)", borderRadius:14, padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                                <span style={{ fontSize:15, fontWeight:700, color:"var(--rn)" }}>SALAIRE NET</span>
                                <span style={{ fontSize:22, fontWeight:800, color:"var(--rb)" }}>{net.toLocaleString("fr-FR")} FCFA</span>
                              </div>
                              <div style={{ display:"flex", gap:10 }}>
                                <button className="rbtn rbtn-teal rbtn-sm">{I.dl} Bulletin de paie</button>
                                <button className="rbtn rbtn-ghost rbtn-sm">{I.print} Imprimer</button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── ÉVALUATIONS ── */}
                {section === "eval_emp" && (
                  <div style={{ marginTop:20 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--rn)" }}>Évaluations</div>
                      <button className="rbtn rbtn-primary" onClick={() => { setFormEval({...EMPTY_EVAL, employe_id:currentEmp._id}); setModalEval(true); }}>
                        {I.plus} Nouvelle évaluation
                      </button>
                    </div>
                    {empEvals.map(ev => (
                      <div key={ev._id} className="rh-card" style={{ marginBottom:16 }}>
                        <div className="rh-card-hdr">
                          <h3>⭐ Évaluation — {ev.periode}</h3>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <Stars note={ev.note_globale} />
                            <span style={{ fontWeight:800, fontSize:14, color:"var(--rn)" }}>{ev.note_globale}/5</span>
                          </div>
                        </div>
                        <div style={{ padding:20 }}>
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:14 }}>
                            {[
                              ["Ponctualité", ev.ponctualite],
                              ["Qualité du travail", ev.qualite],
                              ["Productivité", ev.productivite],
                              ["Discipline", ev.discipline],
                              ["Relation patients", ev.relation_patient],
                            ].map(([lbl,val]) => (
                              <div key={lbl} style={{ background:"#F8FAFD", borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
                                <div style={{ fontSize:10, color:"var(--rm)", fontWeight:600, textTransform:"uppercase", marginBottom:6 }}>{lbl}</div>
                                <Stars note={val} max={5} />
                                <div style={{ fontSize:13, fontWeight:800, color:"var(--rn)", marginTop:4 }}>{val}/5</div>
                              </div>
                            ))}
                          </div>
                          {ev.commentaire && (
                            <div style={{ background:"#EEF4FF", borderRadius:10, padding:12, fontSize:12, color:"var(--rm)" }}>
                              <strong>Commentaire :</strong> {ev.commentaire}
                            </div>
                          )}
                          <div style={{ fontSize:11, color:"var(--rm)", marginTop:8 }}>Évalué par : <strong>{ev.evaluateur}</strong></div>
                        </div>
                      </div>
                    ))}
                    {empEvals.length === 0 && <div className="rh-card" style={{ padding:40, textAlign:"center", color:"var(--rm)" }}>Aucune évaluation enregistrée</div>}
                  </div>
                )}

                {/* ── DISCIPLINE ── */}
                {section === "discipline_emp" && (
                  <div style={{ marginTop:20 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--rn)" }}>Mesures disciplinaires</div>
                      <button className="rbtn rbtn-danger" onClick={() => { setFormSanction({...EMPTY_SANCTION, employe_id:currentEmp._id}); setModalSanction(true); }}>
                        {I.plus} Enregistrer sanction
                      </button>
                    </div>
                    {empSanc.length > 0 ? empSanc.map(s => {
                      const sc = SANCTION_CFG[s.type] || { cls:"gray", label:s.type, icon:"⚠️" };
                      return (
                        <div key={s._id} className="rh-card" style={{ marginBottom:12, borderLeft:`4px solid ${s.type === "avertissement" ? "#CA8A04" : "#DC2626"}` }}>
                          <div style={{ padding:"14px 20px" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                              <span style={{ fontSize:18 }}>{sc.icon}</span>
                              <span style={{ fontWeight:700, fontSize:14, color:"var(--rn)" }}>{sc.label}</span>
                              <Badge cls={sc.cls}>{sc.label}</Badge>
                              <span style={{ fontSize:11, color:"var(--rm)" }}>📅 {fmtDate(s.date)}</span>
                            </div>
                            <div style={{ fontSize:12, color:"var(--rm)", marginTop:8 }}>{s.motif}</div>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="rh-card" style={{ padding:40, textAlign:"center" }}>
                        <div style={{ fontSize:32, marginBottom:12 }}>✅</div>
                        <div style={{ fontWeight:700, color:"var(--rg)" }}>Aucune mesure disciplinaire</div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── SANTÉ AU TRAVAIL ── */}
                {section === "sante_emp" && (
                  <div style={{ marginTop:20 }}>
                    <div className="rh-card">
                      <div className="rh-card-hdr"><h3>🏥 Suivi médical professionnel</h3></div>
                      <div style={{ padding:20 }}>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14, marginBottom:20 }}>
                          {[
                            ["Dernière visite médicale",  "12/01/2025",  "var(--rg)"],
                            ["Prochaine visite prévue",   "12/01/2026",  "var(--rb)"],
                            ["Aptitude au poste",          "Apte",        "var(--rg)"],
                            ["Vaccinations à jour",        "Oui",         "var(--rg)"],
                          ].map(([lbl,val,col]) => (
                            <div key={lbl} style={{ background:"#F8FAFD", borderRadius:12, padding:"14px 16px", textAlign:"center" }}>
                              <div style={{ fontSize:10, fontWeight:600, color:"var(--rm)", textTransform:"uppercase", letterSpacing:.4, marginBottom:6 }}>{lbl}</div>
                              <div style={{ fontSize:15, fontWeight:700, color:col }}>{val}</div>
                            </div>
                          ))}
                        </div>
                        <div className="al-success" style={{ display:"flex", alignItems:"center", gap:10 }}>
                          {I.check}
                          <span style={{ fontSize:13, color:"#065F46", fontWeight:600 }}>Dossier médical professionnel à jour — Aucun accident de travail déclaré</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── DOCUMENTS ── */}
                {section === "docs_emp" && (
                  <div style={{ marginTop:20 }}>
                    <div className="rh-card">
                      <div className="rh-card-hdr"><h3>📄 Documents RH</h3></div>
                      <div style={{ padding:20, display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))", gap:14 }}>
                        {[
                          ["📋","CV","Curriculum vitae"],
                          ["🎓","Diplômes","Copies certifiées"],
                          ["📝","Contrat de travail","Contrat signé"],
                          ["💰","Bulletins de paie","Historique des salaires"],
                          ["⭐","Fiche d'évaluation","Dernière évaluation"],
                          ["🏥","Certificat médical","Aptitude au travail"],
                          ["📜","Attestation de travail","Document officiel"],
                          ["🏖️","Historique congés","Soldes et prises"],
                        ].map(([icon,title,desc]) => (
                          <div key={title} style={{ background:"#F8FAFD", border:"1.5px solid var(--rbr)", borderRadius:14, padding:16, display:"flex", flexDirection:"column", gap:8 }} onMouseOver={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(11,30,59,.1)"} onMouseOut={e=>e.currentTarget.style.boxShadow="none"}>
                            <div style={{ fontSize:24 }}>{icon}</div>
                            <div style={{ fontWeight:700, color:"var(--rn)", fontSize:13 }}>{title}</div>
                            <div style={{ fontSize:11, color:"var(--rm)" }}>{desc}</div>
                            <button className="rbtn rbtn-ghost rbtn-sm" style={{ marginTop:"auto" }} onClick={() => toast.success(`📄 ${title} généré...`)}>{I.dl} Générer</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ══ ORGANIGRAMME ══ */}
          {tab === "org" && (
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--rn)", marginBottom:20 }}>Organigramme — Clinique Canadienne de Souanké</div>
              <div className="rh-card fu" style={{ padding:30, overflowX:"auto" }}>
                <div style={{ minWidth:700, display:"flex", flexDirection:"column", alignItems:"center", gap:0 }}>
                  {/* Direction */}
                  <div className="org-node direction" style={{ width:220 }}>
                    <div style={{ fontSize:20, marginBottom:6 }}>🏥</div>
                    <div style={{ fontWeight:800, color:"var(--rb)", fontSize:14 }}>Direction Générale</div>
                    <div style={{ fontSize:11, color:"var(--rm)", marginTop:2 }}>Dr. Directeur Médical</div>
                  </div>
                  <div className="org-line" style={{ height:30 }} />
                  {/* Niveau 2 */}
                  <div style={{ display:"flex", gap:0, alignItems:"flex-start", width:"100%", justifyContent:"center" }}>
                    {[
                      { icon:"💊",  label:"Administration", sub:"André Makosso", color:"var(--rm)", w:140 },
                      { icon:"🩺",  label:"Médecins",       sub:`${medecins} médecins`, color:"var(--rb)", w:140 },
                      { icon:"💉",  label:"Infirmiers",     sub:`${infirmiers} infirmiers`, color:"var(--rt)", w:140 },
                      { icon:"🔬",  label:"Laboratoire",    sub:"Paul Nkomo",   color:"var(--rp)", w:130 },
                      { icon:"🩻",  label:"Imagerie",       sub:"Jacques Bongo",color:"var(--ro)", w:130 },
                      { icon:"💊",  label:"Pharmacie",      sub:"Fatima Diallo",color:"var(--rg)", w:130 },
                    ].map((dep, i, arr) => (
                      <div key={dep.label} style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                        <div className="org-hline" style={{ width: i === 0 ? "50%" : i === arr.length-1 ? "50%" : "100%", alignSelf:i===0?"flex-end":i===arr.length-1?"flex-start":"center" }} />
                        <div className="org-line" style={{ height:20 }} />
                        <div className="org-node chef" style={{ width:dep.w, borderColor:dep.color }}>
                          <div style={{ fontSize:18, marginBottom:4 }}>{dep.icon}</div>
                          <div style={{ fontWeight:700, fontSize:12, color:"var(--rn)" }}>{dep.label}</div>
                          <div style={{ fontSize:10, color:"var(--rm)", marginTop:2 }}>{dep.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* List des dept */}
                <div style={{ marginTop:40, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))", gap:16 }}>
                  {Object.entries(POSTE_COLORS).map(([key, cfg]) => {
                    const emps = employes.filter(e => e.poste === key);
                    if (emps.length === 0) return null;
                    return (
                      <div key={key} style={{ background:"#F8FAFD", border:"1.5px solid var(--rbr)", borderRadius:14, padding:14, borderTop:`3px solid ${cfg.color}` }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                          <span style={{ width:10, height:10, borderRadius:3, background:cfg.color, display:"inline-block" }} />
                          <span style={{ fontWeight:700, fontSize:13, color:"var(--rn)" }}>{cfg.label}s</span>
                          <Badge cls={cfg.cls}>{emps.length}</Badge>
                        </div>
                        {emps.map(e => (
                          <div key={e._id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:"1px solid var(--rbr)" }}>
                            <div className="emp-avatar" style={{ background:cfg.color, width:28, height:28, fontSize:11, borderRadius:8 }}>{e.prenom[0]}{e.nom[0]}</div>
                            <div>
                              <div style={{ fontSize:12, fontWeight:600, color:"var(--rn)" }}>{e.prenom} {e.nom}</div>
                              <div style={{ fontSize:10, color:"var(--rm)" }}>{e.departement}</div>
                            </div>
                            <Badge cls={(STATUT_EMP[e.statut]||{}).cls || "gray"} style={{ marginLeft:"auto", fontSize:10 }}>{(STATUT_EMP[e.statut]||{}).label}</Badge>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ══ RECRUTEMENT ══ */}
          {tab === "recrutement" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--rn)" }}>Gestion des candidatures</div>
                  <div style={{ fontSize:12, color:"var(--rm)", marginTop:2 }}>{candidatures.length} candidature(s)</div>
                </div>
                <button className="rbtn rbtn-primary" onClick={() => { setFormCandidat(EMPTY_CANDIDATURE); setModalCandidat(true); }}>
                  {I.plus} Nouvelle candidature
                </button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
                {candidatures.map(c => {
                  const cs = CANDIDAT_CFG[c.statut] || { cls:"gray", label:c.statut };
                  const pc = POSTE_COLORS[c.poste] || { cls:"gray", label:c.poste, color:"#6B7280" };
                  return (
                    <div key={c._id} className="rh-card fu" style={{ padding:20 }}>
                      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div className="emp-avatar" style={{ background:pc.color, width:40, height:40, fontSize:15, borderRadius:10 }}>{c.nom[0]}</div>
                          <div>
                            <div style={{ fontWeight:700, fontSize:14, color:"var(--rn)" }}>{c.nom}</div>
                            <div style={{ fontSize:11, color:"var(--rm)" }}>{c.email}</div>
                          </div>
                        </div>
                        <Badge cls={cs.cls}>{cs.label}</Badge>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        {[["Poste demandé", pc.label], ["Expérience", c.experience], ["Diplôme", c.diplome], ["Date dépôt", fmtDate(c.date_depot)]].map(([lbl,val]) => (
                          <div key={lbl} style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                            <span style={{ color:"var(--rm)" }}>{lbl}</span>
                            <span style={{ fontWeight:600, color:"var(--rn)" }}>{val}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display:"flex", gap:8, marginTop:14 }}>
                        <button className="rbtn rbtn-ghost rbtn-sm" style={{ flex:1 }} onClick={() => { setCandidatures(prev => prev.map(x => x._id === c._id ? {...x, statut:"entretien"} : x)); toast.success("📅 Convoqué en entretien"); }}>Convoquer</button>
                        <button className="rbtn rbtn-teal rbtn-sm" onClick={() => { setCandidatures(prev => prev.map(x => x._id === c._id ? {...x, statut:"selectionne"} : x)); toast.success("✅ Candidat sélectionné"); }}>Sélectionner</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ PRÉSENCES ══ */}
          {tab === "presences" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--rn)" }}>Présences & Pointage — Aujourd'hui</div>
                  <div style={{ fontSize:12, color:"var(--rm)", marginTop:2 }}>{fmtDate(new Date().toISOString())}</div>
                </div>
                <button className="rbtn rbtn-primary" onClick={() => setModalPointage(true)}>
                  {I.plus} Saisir pointage
                </button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
                {[
                  ["Présents", pointages.filter(p=>p.statut==="present").length, "var(--rg)", "✅"],
                  ["Absents",  pointages.filter(p=>p.statut==="absent").length,  "var(--rr)", "❌"],
                  ["Retards",  pointages.filter(p=>p.retard_min>0).length,        "var(--ro)", "⏱"],
                  ["Heures sup.", pointages.reduce((s,p)=>s+(p.heures_sup||0),0).toFixed(1)+"h", "var(--rb)", "⌚"],
                ].map(([lbl,val,col,icon]) => (
                  <div key={lbl} style={{ background:"#fff", border:"1.5px solid var(--rbr)", borderRadius:14, padding:"14px 18px", textAlign:"center", boxShadow:"var(--sh)" }}>
                    <div style={{ fontSize:22 }}>{icon}</div>
                    <div style={{ fontSize:22, fontWeight:800, color:col, marginTop:6 }}>{val}</div>
                    <div style={{ fontSize:12, color:"var(--rm)", marginTop:2 }}>{lbl}</div>
                  </div>
                ))}
              </div>
              <div className="rh-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="rh-tbl">
                    <thead><tr><th>Employé</th><th>Poste</th><th>Heure entrée</th><th>Heure sortie</th><th>Retard</th><th>H. suppl.</th><th>Statut</th></tr></thead>
                    <tbody>
                      {pointages.map(p => {
                        const emp = employes.find(e => e._id === p.employe_id);
                        const pc = emp ? (POSTE_COLORS[emp.poste] || { cls:"gray" }) : { cls:"gray" };
                        return (
                          <tr key={p._id} style={{ background:p.statut==="absent"?"#FFF8F8":"" }}>
                            <td style={{ fontWeight:600, color:"var(--rn)" }}>{p.employe_nom}</td>
                            <td>{emp && <Badge cls={pc.cls}>{(POSTE_COLORS[emp.poste]||{}).label || emp.poste}</Badge>}</td>
                            <td style={{ fontSize:12, fontWeight:600, color:"var(--rg)" }}>{p.heure_entree}</td>
                            <td style={{ fontSize:12, color:"var(--rm)" }}>{p.heure_sortie}</td>
                            <td>
                              {p.retard_min > 0 ? <Badge cls="orange">⏱ {p.retard_min} min</Badge> : <span style={{ fontSize:12, color:"var(--rm)" }}>—</span>}
                            </td>
                            <td style={{ fontSize:12, color:p.heures_sup > 0 ? "var(--rb)" : "var(--rm)", fontWeight:p.heures_sup > 0 ? 700 : 400 }}>
                              {p.heures_sup > 0 ? `+${p.heures_sup}h` : "—"}
                            </td>
                            <td>
                              <Badge cls={p.statut === "present" ? "green" : "red"}>
                                {p.statut === "present" ? "✅ Présent" : "❌ Absent"}
                              </Badge>
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

          {/* ══ CONGÉS ══ */}
          {tab === "conges" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--rn)" }}>Congés & Absences</div>
                  <div style={{ fontSize:12, color:"var(--rm)", marginTop:2 }}>{conges.length} demande(s) · {congesAttente} en attente</div>
                </div>
                <button className="rbtn rbtn-primary" onClick={() => { setFormConge(EMPTY_CONGE); setModalConge(true); }}>
                  {I.plus} Nouvelle demande
                </button>
              </div>
              {congesAttente > 0 && (
                <div className="al-warn fu" style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                  {I.alert}
                  <span style={{ fontSize:13, color:"#92400E" }}><strong>{congesAttente}</strong> demande(s) en attente de validation DRH</span>
                </div>
              )}
              <div className="rh-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="rh-tbl">
                    <thead><tr><th>Employé</th><th>Type</th><th>Date début</th><th>Date fin</th><th>Nb jours</th><th>Motif</th><th>Statut</th><th>Action</th></tr></thead>
                    <tbody>
                      {conges.map(c => {
                        const cc = CONGE_CFG[c.type] || { label:c.type, icon:"📅" };
                        const cs = CONGE_STATUT[c.statut] || { cls:"gray", label:c.statut };
                        return (
                          <tr key={c._id}>
                            <td style={{ fontWeight:600, color:"var(--rn)" }}>{c.employe_nom}</td>
                            <td><span style={{ fontSize:13 }}>{cc.icon} {cc.label}</span></td>
                            <td style={{ fontSize:12 }}>{fmtDate(c.date_debut)}</td>
                            <td style={{ fontSize:12 }}>{fmtDate(c.date_fin)}</td>
                            <td style={{ fontWeight:700, color:"var(--rb)" }}>{c.nb_jours}j</td>
                            <td style={{ fontSize:12, color:"var(--rm)", maxWidth:160 }}><div style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.motif}</div></td>
                            <td><Badge cls={cs.cls}>{cs.label}</Badge></td>
                            <td>
                              {c.statut === "en_attente" && (
                                <div style={{ display:"flex", gap:6 }}>
                                  <button className="rbtn rbtn-teal rbtn-sm" style={{ fontSize:11 }} onClick={() => approuverConge(c._id)}>✅ Approuver</button>
                                  <button className="rbtn rbtn-danger rbtn-sm" style={{ fontSize:11 }} onClick={() => { setConges(prev => prev.map(x => x._id === c._id ? {...x,statut:"refuse"} : x)); toast.error("❌ Congé refusé"); }}>Refuser</button>
                                </div>
                              )}
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

          {/* ══ PLANNING ══ */}
          {tab === "planning" && (
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--rn)", marginBottom:20 }}>Planning hebdomadaire — Semaine du 02 au 08 Juin 2025</div>
              <div className="rh-card fu" style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", minWidth:900 }}>
                  <thead>
                    <tr style={{ background:"linear-gradient(to right,#F8FAFD,#EEF4FF)" }}>
                      <th style={{ padding:"11px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--rm)", textTransform:"uppercase", borderBottom:"1.5px solid var(--rbr)", width:160 }}>Employé</th>
                      {PLANNING_JOURS.map(j => (
                        <th key={j} style={{ padding:"11px 8px", textAlign:"center", fontSize:11, fontWeight:700, color:"var(--rm)", textTransform:"uppercase", letterSpacing:.4, borderBottom:"1.5px solid var(--rbr)" }}>{j}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(PLANNING_DATA).map(([nom, jours]) => {
                      const emp = employes.find(e => `${e.prenom} ${e.nom}` === nom);
                      const pc  = emp ? (POSTE_COLORS[emp.poste] || { color:"#6B7280" }) : { color:"#6B7280" };
                      return (
                        <tr key={nom} style={{ borderBottom:"1px solid #F3F7FF" }}>
                          <td style={{ padding:"10px 14px" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <div className="emp-avatar" style={{ background:pc.color, width:30, height:30, fontSize:11, borderRadius:8 }}>{nom.split(" ").map(n=>n[0]).join("")}</div>
                              <span style={{ fontSize:12, fontWeight:600, color:"var(--rn)" }}>{nom}</span>
                            </div>
                          </td>
                          {jours.map((type, i) => (
                            <td key={i} style={{ padding:"8px 6px", textAlign:"center" }}>
                              <div className={`plan-cell ${type}`}>{PLAN_LABEL[type] || type}</div>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ padding:"12px 20px", borderTop:"1.5px solid var(--rbr)", display:"flex", gap:12, flexWrap:"wrap" }}>
                  {[["travail","Travail","#059669"],["garde","Garde","#1B4F9E"],["conge","Congé","#D97706"],["repos","Repos","#6B7280"],["absence","Absent","#DC2626"],["astreinte","Astreinte","#7C3AED"]].map(([key,lbl,col]) => (
                    <div key={key} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"var(--rm)" }}>
                      <span style={{ width:12, height:12, borderRadius:3, background:col, display:"inline-block", opacity:.7 }} />{lbl}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ SALAIRES ══ */}
          {tab === "salaires" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--rn)" }}>Gestion salariale — Juin 2025</div>
                  <div style={{ fontSize:12, color:"var(--rm)", marginTop:2 }}>Masse salariale : <strong>{masseSalariale.toLocaleString("fr-FR")} FCFA</strong></div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="rbtn rbtn-teal">{I.dl} Virement groupé</button>
                  <button className="rbtn rbtn-ghost">{I.print} Éditer bulletins</button>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 }}>
                {[
                  ["Masse salariale brute", `${masseSalariale.toLocaleString("fr-FR")} FCFA`, "var(--rb)"],
                  ["Total cotisations",     `${Math.round(masseSalariale*0.198).toLocaleString("fr-FR")} FCFA`, "var(--rr)"],
                  ["Net à payer",           `${Math.round(masseSalariale*0.802).toLocaleString("fr-FR")} FCFA`, "var(--rg)"],
                ].map(([lbl,val,col]) => (
                  <div key={lbl} style={{ background:"#fff", border:"1.5px solid var(--rbr)", borderRadius:14, padding:"16px 20px", boxShadow:"var(--sh)" }}>
                    <div style={{ fontSize:11, color:"var(--rm)", fontWeight:600, textTransform:"uppercase", marginBottom:6 }}>{lbl}</div>
                    <div style={{ fontSize:20, fontWeight:800, color:col }}>{val}</div>
                  </div>
                ))}
              </div>
              <div className="rh-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="rh-tbl">
                    <thead><tr><th>Matricule</th><th>Employé</th><th>Poste</th><th>Salaire base</th><th>Prime</th><th>Transport</th><th>Brut</th><th>Retenues</th><th>Net</th><th>Statut</th><th>Action</th></tr></thead>
                    <tbody>
                      {employes.map(e => {
                        const base = e.salaire_base || 0;
                        const prime = Math.round(base * 0.1);
                        const transport = 25000;
                        const brut = base + prime + transport;
                        const retenues = Math.round(brut * 0.198);
                        const net = brut - retenues;
                        const pc = POSTE_COLORS[e.poste] || { cls:"gray", label:e.poste };
                        return (
                          <tr key={e._id}>
                            <td><span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--rb)", fontSize:12 }}>{e.matricule}</span></td>
                            <td style={{ fontWeight:600, color:"var(--rn)" }}>{e.prenom} {e.nom}</td>
                            <td><Badge cls={pc.cls}>{pc.label}</Badge></td>
                            <td style={{ fontSize:12 }}>{base.toLocaleString("fr-FR")}</td>
                            <td style={{ fontSize:12, color:"var(--rg)" }}>+{prime.toLocaleString("fr-FR")}</td>
                            <td style={{ fontSize:12 }}>{transport.toLocaleString("fr-FR")}</td>
                            <td style={{ fontSize:13, fontWeight:700, color:"var(--rn)" }}>{brut.toLocaleString("fr-FR")}</td>
                            <td style={{ fontSize:12, color:"var(--rr)" }}>-{retenues.toLocaleString("fr-FR")}</td>
                            <td style={{ fontSize:13, fontWeight:800, color:"var(--rb)" }}>{net.toLocaleString("fr-FR")}</td>
                            <td><Badge cls="green">✅ Payé</Badge></td>
                            <td><button className="rbtn rbtn-ghost rbtn-sm" style={{ fontSize:11 }} onClick={() => toast.success(`📄 Bulletin généré — ${e.prenom} ${e.nom}`)}>{I.dl} Bulletin</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ ÉVALUATIONS ══ */}
          {tab === "evaluations" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--rn)" }}>Évaluations du personnel</div>
                  <div style={{ fontSize:12, color:"var(--rm)", marginTop:2 }}>{evaluations.length} évaluation(s)</div>
                </div>
                <button className="rbtn rbtn-primary" onClick={() => { setFormEval(EMPTY_EVAL); setModalEval(true); }}>{I.plus} Nouvelle évaluation</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))", gap:16 }}>
                {evaluations.map(ev => {
                  const emp = employes.find(e => e._id === ev.employe_id);
                  const pc  = emp ? (POSTE_COLORS[emp.poste] || { color:"#6B7280" }) : { color:"#6B7280" };
                  return (
                    <div key={ev._id} className="rh-card fu">
                      <div style={{ padding:20 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                          {emp && <div className="emp-avatar" style={{ background:pc.color, width:40, height:40, fontSize:14, borderRadius:10 }}>{emp.prenom[0]}{emp.nom[0]}</div>}
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:700, fontSize:14, color:"var(--rn)" }}>{ev.employe_nom}</div>
                            <div style={{ fontSize:11, color:"var(--rm)" }}>Période : {ev.periode}</div>
                          </div>
                          <div style={{ textAlign:"center" }}>
                            <div style={{ fontSize:22, fontWeight:800, color:"var(--rn)" }}>{ev.note_globale}</div>
                            <Stars note={ev.note_globale} />
                          </div>
                        </div>
                        {[["Ponctualité",ev.ponctualite],["Qualité du travail",ev.qualite],["Productivité",ev.productivite],["Discipline",ev.discipline],["Relation patients",ev.relation_patient]].map(([lbl,val]) => (
                          <div key={lbl} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                            <span style={{ fontSize:12, color:"var(--rm)" }}>{lbl}</span>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <div className="score-bar" style={{ width:60 }}><div className="score-bar-f" style={{ width:`${val*20}%`, background:val >= 4 ? "var(--rg)" : val >= 3 ? "var(--ro)" : "var(--rr)" }} /></div>
                              <span style={{ fontSize:12, fontWeight:700, color:"var(--rn)", width:24 }}>{val}/5</span>
                            </div>
                          </div>
                        ))}
                        {ev.commentaire && <div style={{ fontSize:12, color:"var(--rm)", marginTop:10, background:"#F8FAFD", borderRadius:8, padding:"8px 10px" }}>{ev.commentaire}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ FORMATIONS ══ */}
          {tab === "formations" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--rn)" }}>Formations & Développement</div>
                  <div style={{ fontSize:12, color:"var(--rm)", marginTop:2 }}>{formations.length} formation(s) · {formations.filter(f=>f.statut==="planifie").length} planifiée(s)</div>
                </div>
                <button className="rbtn rbtn-primary" onClick={() => { setFormFormation(EMPTY_FORMATION); setModalFormation(true); }}>{I.plus} Planifier formation</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:16 }}>
                {formations.map(f => (
                  <div key={f._id} className="rh-card fu" style={{ padding:20 }}>
                    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14, color:"var(--rn)" }}>{f.titre}</div>
                        <div style={{ fontSize:11, color:"var(--rm)", marginTop:2 }}>{f.type === "interne" ? "🏥 Formation interne" : "🌍 Formation externe"} · {f.duree_h}h</div>
                      </div>
                      <Badge cls={f.statut === "termine" ? "green" : "blue"}>{f.statut === "termine" ? "✅ Terminée" : "📅 Planifiée"}</Badge>
                    </div>
                    <div style={{ fontSize:12, color:"var(--rm)", marginBottom:8 }}>📅 {fmtDate(f.date)}</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:10 }}>
                      {f.participants.map(p => (
                        <span key={p} style={{ background:"#EEF4FF", color:"var(--rb)", border:"1px solid #BFDBFE", borderRadius:8, padding:"2px 8px", fontSize:11, fontWeight:600 }}>{p}</span>
                      ))}
                    </div>
                    {f.certificat && <Badge cls="teal">🎓 Certificat délivré</Badge>}
                    <div style={{ display:"flex", gap:8, marginTop:12 }}>
                      <button className="rbtn rbtn-ghost rbtn-sm" onClick={() => toast.success("📄 Attestation générée")}>{I.dl} Attestation</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ DISCIPLINE ══ */}
          {tab === "discipline" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--rn)" }}>Mesures disciplinaires</div>
                  <div style={{ fontSize:12, color:"var(--rm)", marginTop:2 }}>{sanctions.length} mesure(s) enregistrée(s)</div>
                </div>
                <button className="rbtn rbtn-danger" onClick={() => { setFormSanction(EMPTY_SANCTION); setModalSanction(true); }}>{I.plus} Enregistrer sanction</button>
              </div>
              {sanctions.map(s => {
                const sc = SANCTION_CFG[s.type] || { cls:"gray", label:s.type, icon:"⚠️" };
                const emp = employes.find(e => e._id === s.employe_id);
                const pc = emp ? (POSTE_COLORS[emp.poste] || { color:"#6B7280" }) : { color:"#6B7280" };
                return (
                  <div key={s._id} className="rh-card fu" style={{ marginBottom:12, borderLeft:`4px solid ${sc.cls === "red" ? "#DC2626" : "#CA8A04"}` }}>
                    <div style={{ padding:"16px 20px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                        {emp && <div className="emp-avatar" style={{ background:pc.color, width:36, height:36, fontSize:12, borderRadius:10 }}>{emp.prenom[0]}{emp.nom[0]}</div>}
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:700, fontSize:14, color:"var(--rn)" }}>{s.employe_nom}</div>
                          <div style={{ fontSize:12, color:"var(--rm)" }}>📅 {fmtDate(s.date)}</div>
                        </div>
                        <Badge cls={sc.cls}>{sc.icon} {sc.label}</Badge>
                        <Badge cls="green">Notifié</Badge>
                      </div>
                      <div style={{ fontSize:12, color:"var(--rm)", marginTop:10, background:"#FFF7ED", borderRadius:8, padding:"8px 12px" }}>
                        <strong>Motif :</strong> {s.motif}
                      </div>
                    </div>
                  </div>
                );
              })}
              {sanctions.length === 0 && (
                <div className="rh-card" style={{ padding:40, textAlign:"center" }}>
                  <div style={{ fontSize:36, marginBottom:12 }}>✅</div>
                  <div style={{ fontWeight:700, color:"var(--rg)" }}>Aucune mesure disciplinaire enregistrée</div>
                </div>
              )}
            </div>
          )}

          {/* ══ SANTÉ AU TRAVAIL ══ */}
          {tab === "sante" && (
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--rn)", marginBottom:20 }}>Santé au travail</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
                <div className="rh-card">
                  <div className="rh-card-hdr"><h3>🏥 Visites médicales</h3></div>
                  <div style={{ overflowX:"auto" }}>
                    <table className="rh-tbl">
                      <thead><tr><th>Employé</th><th>Poste</th><th>Dernière visite</th><th>Prochaine</th><th>Aptitude</th></tr></thead>
                      <tbody>
                        {employes.slice(0,6).map(e => {
                          const pc = POSTE_COLORS[e.poste] || { cls:"gray", label:e.poste };
                          return (
                            <tr key={e._id}>
                              <td style={{ fontWeight:600, fontSize:12 }}>{e.prenom} {e.nom}</td>
                              <td><Badge cls={pc.cls}>{pc.label}</Badge></td>
                              <td style={{ fontSize:12, color:"var(--rm)" }}>15/01/2025</td>
                              <td style={{ fontSize:12, color:"var(--rb)" }}>15/01/2026</td>
                              <td><Badge cls="green">Apte</Badge></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="rh-card">
                  <div className="rh-card-hdr"><h3>⚠️ Accidents de travail</h3></div>
                  <div style={{ padding:40, textAlign:"center" }}>
                    <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
                    <div style={{ fontWeight:700, color:"var(--rg)", fontSize:15 }}>Aucun accident déclaré</div>
                    <div style={{ color:"var(--rm)", fontSize:13, marginTop:6 }}>Ce mois de juin 2025</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ AUDIT ══ */}
          {tab === "audit" && (
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--rn)", marginBottom:20 }}>Journal d'audit RH</div>
              <div className="rh-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="rh-tbl">
                    <thead><tr><th>Action</th><th>Utilisateur</th><th>Date & heure</th><th>Détails</th></tr></thead>
                    <tbody>
                      {auditLog.map(a => (
                        <tr key={a._id}>
                          <td>
                            <Badge cls={a.action.includes("Création") ? "teal" : a.action.includes("Paiement") ? "green" : a.action.includes("Sanction") ? "red" : "blue"}>
                              {a.action}
                            </Badge>
                          </td>
                          <td style={{ fontSize:12, fontWeight:600, color:"var(--rn)" }}>{a.utilisateur}</td>
                          <td style={{ fontSize:12, color:"var(--rm)" }}>{new Date(a.date).toLocaleString("fr-FR")}</td>
                          <td style={{ fontSize:12, color:"var(--rm)" }}>{a.details}</td>
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
              <div style={{ fontSize:16, fontWeight:700, color:"var(--rn)", marginBottom:20 }}>Rapports RH</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:16, marginBottom:24 }}>
                {[
                  ["👥","Effectif du personnel",   "Tableau des ressources humaines par poste et département"],
                  ["📅","Présences & Absences",    "Récapitulatif mensuel des présences, retards et absences"],
                  ["🏖️","Rapport de congés",       "Soldes, prises et historique des congés par employé"],
                  ["💰","Rapport salarial",        "Masse salariale, primes et retenues — vue détaillée"],
                  ["⭐","Rapport d'évaluations",   "Synthèse des performances et recommandations"],
                  ["📋","Rapport disciplinaire",   "Incidents et mesures disciplinaires prises"],
                  ["🏥","Santé au travail",        "Visites médicales, aptitudes et accidents de travail"],
                  ["🎓","Rapport formations",      "Formations dispensées, participants et certifications"],
                ].map(([icon,title,desc]) => (
                  <div key={title} style={{ background:"#fff", border:"1.5px solid var(--rbr)", borderRadius:16, padding:20, display:"flex", flexDirection:"column", gap:10, boxShadow:"var(--sh)", transition:"all .2s" }} onMouseOver={e=>e.currentTarget.style.boxShadow="var(--shm)"} onMouseOut={e=>e.currentTarget.style.boxShadow="var(--sh)"}>
                    <div style={{ fontSize:28 }}>{icon}</div>
                    <div style={{ fontWeight:700, color:"var(--rn)", fontSize:14 }}>{title}</div>
                    <div style={{ fontSize:11, color:"var(--rm)", flex:1 }}>{desc}</div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button className="rbtn rbtn-teal rbtn-sm" style={{ flex:1 }} onClick={() => toast.success(`📊 Génération : ${title}...`)}>{I.dl} PDF</button>
                      <button className="rbtn rbtn-ghost rbtn-sm" onClick={() => toast.success("📊 Export Excel...")}>{I.trend} Excel</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:20 }}>
                <div className="rh-card fu">
                  <div className="rh-card-hdr"><div><h3>{I.trend} Évolution des absences — 12 mois</h3></div></div>
                  <div style={{ padding:20 }}><BarChart labels={MOIS_LABELS} data={DEMO_ABSENCE_MOIS} color="#DC2626" /></div>
                </div>
                <div className="rh-card fu">
                  <div className="rh-card-hdr"><div><h3>Résumé mensuel</h3><p>Juin 2025</p></div></div>
                  <div style={{ padding:20, display:"flex", flexDirection:"column", gap:12 }}>
                    {[
                      ["Total employés",       total,                  "var(--rb)"],
                      ["Présents aujourd'hui", actifs - enConge,       "var(--rg)"],
                      ["En congé",             enConge,                "var(--ro)"],
                      ["Contrats CDI",         employes.filter(e=>e.contrat==="cdi").length, "var(--rt)"],
                      ["Note moyenne",         (evaluations.reduce((s,e)=>s+e.note_globale,0)/Math.max(evaluations.length,1)).toFixed(1)+"/5", "var(--rp)"],
                    ].map(([lbl,val,col]) => (
                      <div key={lbl} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:"#F8FAFD", borderRadius:8 }}>
                        <span style={{ fontSize:12, color:"var(--rm)" }}>{lbl}</span>
                        <span style={{ fontSize:14, fontWeight:800, color:col }}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ MODAL : NOUVEL EMPLOYÉ ═══ */}
        <Modal open={modalEmp} onClose={() => setModalEmp(false)} title={<>{I.plus} Nouvel employé</>} maxWidth={720}>
          <form onSubmit={createEmp}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div><label className="rlbl">Prénom *</label><input className="rinp" required value={formEmp.prenom} onChange={e=>setFormEmp(f=>({...f,prenom:e.target.value}))} /></div>
              <div><label className="rlbl">Nom *</label><input className="rinp" required value={formEmp.nom} onChange={e=>setFormEmp(f=>({...f,nom:e.target.value}))} /></div>
              <div><label className="rlbl">Sexe</label>
                <select className="rinp" value={formEmp.sexe} onChange={e=>setFormEmp(f=>({...f,sexe:e.target.value}))}>
                  <option value="homme">Masculin</option><option value="femme">Féminin</option>
                </select>
              </div>
              <div><label className="rlbl">Date de naissance</label><input type="date" className="rinp" value={formEmp.date_naissance} onChange={e=>setFormEmp(f=>({...f,date_naissance:e.target.value}))} /></div>
              <div><label className="rlbl">Nationalité</label><input className="rinp" value={formEmp.nationalite} onChange={e=>setFormEmp(f=>({...f,nationalite:e.target.value}))} placeholder="Congolaise" /></div>
              <div><label className="rlbl">Téléphone</label><input className="rinp" value={formEmp.telephone} onChange={e=>setFormEmp(f=>({...f,telephone:e.target.value}))} /></div>
              <div><label className="rlbl">Email</label><input type="email" className="rinp" value={formEmp.email} onChange={e=>setFormEmp(f=>({...f,email:e.target.value}))} /></div>
              <div><label className="rlbl">Poste *</label>
                <select className="rinp" required value={formEmp.poste} onChange={e=>setFormEmp(f=>({...f,poste:e.target.value}))}>
                  {Object.entries(POSTE_COLORS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div><label className="rlbl">Département</label><input className="rinp" value={formEmp.departement} onChange={e=>setFormEmp(f=>({...f,departement:e.target.value}))} /></div>
              <div><label className="rlbl">Service</label><input className="rinp" value={formEmp.service} onChange={e=>setFormEmp(f=>({...f,service:e.target.value}))} /></div>
              <div><label className="rlbl">Date d'embauche *</label><input type="date" className="rinp" required value={formEmp.date_embauche} onChange={e=>setFormEmp(f=>({...f,date_embauche:e.target.value}))} /></div>
              <div><label className="rlbl">Type de contrat</label>
                <select className="rinp" value={formEmp.contrat} onChange={e=>setFormEmp(f=>({...f,contrat:e.target.value}))}>
                  {Object.entries(CONTRAT_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div><label className="rlbl">Salaire de base (FCFA)</label><input type="number" className="rinp" value={formEmp.salaire_base} onChange={e=>setFormEmp(f=>({...f,salaire_base:+e.target.value}))} placeholder="350000" /></div>
              <div style={{ gridColumn:"1/-1" }}><label className="rlbl">Adresse</label><input className="rinp" value={formEmp.adresse} onChange={e=>setFormEmp(f=>({...f,adresse:e.target.value}))} /></div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button type="button" className="rbtn rbtn-ghost" onClick={() => setModalEmp(false)}>Annuler</button>
              <button type="submit" className="rbtn rbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>{I.save} {saving ? "Création..." : "Créer l'employé"}</button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : CONGÉ ═══ */}
        <Modal open={modalConge} onClose={() => setModalConge(false)} title="🏖️ Demande de congé" maxWidth={500}>
          <form onSubmit={addConge}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div><label className="rlbl">Employé *</label>
                <select className="rinp" required value={formConge.employe_id} onChange={e=>setFormConge(f=>({...f,employe_id:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  {employes.map(e => <option key={e._id} value={e._id}>{e.prenom} {e.nom}</option>)}
                </select>
              </div>
              <div><label className="rlbl">Type de congé</label>
                <select className="rinp" value={formConge.type} onChange={e=>setFormConge(f=>({...f,type:e.target.value}))}>
                  {Object.entries(CONGE_CFG).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div><label className="rlbl">Date début *</label><input type="date" className="rinp" required value={formConge.date_debut} onChange={e=>setFormConge(f=>({...f,date_debut:e.target.value}))} /></div>
                <div><label className="rlbl">Date fin *</label><input type="date" className="rinp" required value={formConge.date_fin} onChange={e=>setFormConge(f=>({...f,date_fin:e.target.value}))} /></div>
              </div>
              <div><label className="rlbl">Motif *</label><textarea className="rinp" rows={3} required value={formConge.motif} onChange={e=>setFormConge(f=>({...f,motif:e.target.value}))} /></div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="rbtn rbtn-ghost" onClick={() => setModalConge(false)}>Annuler</button>
                <button type="submit" className="rbtn rbtn-teal" style={{ marginLeft:"auto" }}>{I.save} Soumettre</button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : CANDIDATURE ═══ */}
        <Modal open={modalCandidat} onClose={() => setModalCandidat(false)} title="👤 Nouvelle candidature" maxWidth={520}>
          <form onSubmit={addCandidat}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div style={{ gridColumn:"1/-1" }}><label className="rlbl">Nom complet *</label><input className="rinp" required value={formCandidat.nom} onChange={e=>setFormCandidat(f=>({...f,nom:e.target.value}))} /></div>
              <div><label className="rlbl">Poste demandé</label>
                <select className="rinp" value={formCandidat.poste} onChange={e=>setFormCandidat(f=>({...f,poste:e.target.value}))}>
                  {Object.entries(POSTE_COLORS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div><label className="rlbl">Expérience</label><input className="rinp" value={formCandidat.experience} onChange={e=>setFormCandidat(f=>({...f,experience:e.target.value}))} placeholder="Ex: 3 ans" /></div>
              <div style={{ gridColumn:"1/-1" }}><label className="rlbl">Diplôme(s)</label><input className="rinp" value={formCandidat.diplome} onChange={e=>setFormCandidat(f=>({...f,diplome:e.target.value}))} /></div>
              <div><label className="rlbl">Email</label><input type="email" className="rinp" value={formCandidat.email} onChange={e=>setFormCandidat(f=>({...f,email:e.target.value}))} /></div>
              <div><label className="rlbl">Téléphone</label><input className="rinp" value={formCandidat.telephone} onChange={e=>setFormCandidat(f=>({...f,telephone:e.target.value}))} /></div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button type="button" className="rbtn rbtn-ghost" onClick={() => setModalCandidat(false)}>Annuler</button>
              <button type="submit" className="rbtn rbtn-teal" style={{ marginLeft:"auto" }}>{I.save} Enregistrer</button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : ÉVALUATION ═══ */}
        <Modal open={modalEval} onClose={() => setModalEval(false)} title="⭐ Nouvelle évaluation" maxWidth={560}>
          <form onSubmit={addEval}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div><label className="rlbl">Employé *</label>
                <select className="rinp" required value={formEval.employe_id} onChange={e=>setFormEval(f=>({...f,employe_id:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  {employes.map(e => <option key={e._id} value={e._id}>{e.prenom} {e.nom}</option>)}
                </select>
              </div>
              <div><label className="rlbl">Période</label>
                <select className="rinp" value={formEval.periode} onChange={e=>setFormEval(f=>({...f,periode:e.target.value}))}>
                  {["2025-S1","2025-S2","2024-S2","2024-S1"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              {[["ponctualite","Ponctualité"],["qualite","Qualité du travail"],["productivite","Productivité"],["discipline","Discipline"],["relation_patient","Relation avec les patients"]].map(([key,lbl]) => (
                <div key={key}>
                  <label className="rlbl">{lbl} (1-5)</label>
                  <div style={{ display:"flex", gap:6 }}>
                    {[1,2,3,4,5].map(v => (
                      <button key={v} type="button" onClick={() => setFormEval(f=>({...f,[key]:v}))}
                        style={{ width:36, height:36, borderRadius:8, border:`2px solid ${formEval[key]>=v?"#F59E0B":"#E5E7EB"}`, background:formEval[key]>=v?"#FEF3C7":"#F9FAFB", cursor:"pointer", fontSize:16, color:formEval[key]>=v?"#F59E0B":"#D1D5DB" }}>
                        ★
                      </button>
                    ))}
                    <span style={{ marginLeft:8, fontSize:13, color:"var(--rm)", alignSelf:"center" }}>{formEval[key]}/5</span>
                  </div>
                </div>
              ))}
              <div><label className="rlbl">Évaluateur</label><input className="rinp" value={formEval.evaluateur} onChange={e=>setFormEval(f=>({...f,evaluateur:e.target.value}))} placeholder="Nom du responsable" /></div>
              <div><label className="rlbl">Commentaires</label><textarea className="rinp" rows={3} value={formEval.commentaire} onChange={e=>setFormEval(f=>({...f,commentaire:e.target.value}))} /></div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="rbtn rbtn-ghost" onClick={() => setModalEval(false)}>Annuler</button>
                <button type="submit" className="rbtn rbtn-teal" style={{ marginLeft:"auto" }}>{I.save} Enregistrer</button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : FORMATION ═══ */}
        <Modal open={modalFormation} onClose={() => setModalFormation(false)} title="🎓 Planifier une formation" maxWidth={500}>
          <form onSubmit={addFormation}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div><label className="rlbl">Titre de la formation *</label><input className="rinp" required value={formFormation.titre} onChange={e=>setFormFormation(f=>({...f,titre:e.target.value}))} /></div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div><label className="rlbl">Type</label>
                  <select className="rinp" value={formFormation.type} onChange={e=>setFormFormation(f=>({...f,type:e.target.value}))}>
                    <option value="interne">🏥 Interne</option><option value="externe">🌍 Externe</option>
                    <option value="seminaire">📚 Séminaire</option><option value="atelier">🛠 Atelier</option>
                  </select>
                </div>
                <div><label className="rlbl">Durée (heures)</label><input type="number" className="rinp" value={formFormation.duree_h} onChange={e=>setFormFormation(f=>({...f,duree_h:+e.target.value}))} /></div>
              </div>
              <div><label className="rlbl">Date</label><input type="date" className="rinp" value={formFormation.date} onChange={e=>setFormFormation(f=>({...f,date:e.target.value}))} /></div>
              <div><label className="rlbl">Participants (séparés par virgule)</label><input className="rinp" value={formFormation.participants} onChange={e=>setFormFormation(f=>({...f,participants:e.target.value}))} placeholder="Martin Leblanc, Sophie Pierre..." /></div>
              <label style={{ display:"flex", alignItems:"center", gap:8 }}>
                <input type="checkbox" checked={formFormation.certificat} onChange={e=>setFormFormation(f=>({...f,certificat:e.target.checked}))} style={{ width:16, height:16, accentColor:"var(--rt)" }} />
                <span style={{ fontSize:13, color:"var(--rn)" }}>🎓 Certificat délivré</span>
              </label>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="rbtn rbtn-ghost" onClick={() => setModalFormation(false)}>Annuler</button>
                <button type="submit" className="rbtn rbtn-teal" style={{ marginLeft:"auto" }}>{I.save} Planifier</button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : SANCTION ═══ */}
        <Modal open={modalSanction} onClose={() => setModalSanction(false)} title="⚠️ Mesure disciplinaire" maxWidth={480}>
          <form onSubmit={addSanction}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div><label className="rlbl">Employé *</label>
                <select className="rinp" required value={formSanction.employe_id} onChange={e=>setFormSanction(f=>({...f,employe_id:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  {employes.map(e => <option key={e._id} value={e._id}>{e.prenom} {e.nom}</option>)}
                </select>
              </div>
              <div><label className="rlbl">Type de sanction *</label>
                <select className="rinp" required value={formSanction.type} onChange={e=>setFormSanction(f=>({...f,type:e.target.value}))}>
                  {Object.entries(SANCTION_CFG).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div><label className="rlbl">Motif *</label><textarea className="rinp" rows={4} required value={formSanction.motif} onChange={e=>setFormSanction(f=>({...f,motif:e.target.value}))} placeholder="Décrivez les faits reprochés..." /></div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="rbtn rbtn-ghost" onClick={() => setModalSanction(false)}>Annuler</button>
                <button type="submit" className="rbtn rbtn-danger" style={{ marginLeft:"auto" }}>⚠️ Enregistrer</button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : POINTAGE MANUEL ═══ */}
        <Modal open={modalPointage} onClose={() => setModalPointage(false)} title="⏱ Saisie pointage manuel" maxWidth={460}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><label className="rlbl">Employé</label>
              <select className="rinp">
                <option value="">— Sélectionner —</option>
                {employes.map(e => <option key={e._id} value={e._id}>{e.prenom} {e.nom}</option>)}
              </select>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div><label className="rlbl">Heure d'entrée</label><input type="time" className="rinp" defaultValue="08:00" /></div>
              <div><label className="rlbl">Heure de sortie</label><input type="time" className="rinp" defaultValue="16:00" /></div>
            </div>
            <div><label className="rlbl">Méthode de pointage</label>
              <select className="rinp">
                <option value="manuel">✍️ Saisie manuelle</option>
                <option value="badge">🏷️ Badge</option>
                <option value="qr">📱 QR Code</option>
                <option value="biometrie">👆 Empreinte digitale</option>
              </select>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button type="button" className="rbtn rbtn-ghost" onClick={() => setModalPointage(false)}>Annuler</button>
              <button type="button" className="rbtn rbtn-teal" style={{ marginLeft:"auto" }} onClick={() => { toast.success("✅ Pointage enregistré"); setModalPointage(false); }}>{I.save} Enregistrer</button>
            </div>
          </div>
        </Modal>

      </div>
    </>
  );
}