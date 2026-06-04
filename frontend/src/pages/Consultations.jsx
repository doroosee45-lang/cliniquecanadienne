

import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from 'react-redux';
import api from '../api';
import toast from 'react-hot-toast';
import {
  fetchConsultations, createConsultation,
  selectConsultations, selectConsultationsLoading,
  selectVitals, setVitals,
} from '../store/slices/consultationsSlice';

// ─── CSS Medical Navy + Teal (same design system) ─────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.cons * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --cn: #0B1E3B; --cn2: #132744; --cb: #1B4F9E;
  --ct: #0EA5A0; --ct2: #0D9490; --cr: #DC2626;
  --co: #D97706; --cg: #059669; --cp: #7C3AED;
  --cbr: #E2EAF4; --cm: #6B7A99; --cl: #EEF4FF; --cs: #F8FAFD;
  --sh: 0 1px 3px rgba(11,30,59,.08); --shm: 0 4px 16px rgba(11,30,59,.10); --shl: 0 12px 40px rgba(11,30,59,.14);
}

/* Topbar */
.cons-top { background:linear-gradient(135deg,var(--cn) 0%,var(--cn2) 55%,#1B4F9E 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.cons-top::before { content:''; position:absolute; top:-50px; right:-50px; width:200px; height:200px; background:radial-gradient(circle,rgba(14,165,160,.22) 0%,transparent 70%); border-radius:50%; pointer-events:none; }

/* Tabs */
.cons-tabs { display:flex; gap:2px; padding:0; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.cons-tabs::-webkit-scrollbar { display:none; }
.cons-tab { display:flex; align-items:center; gap:7px; padding:10px 18px 12px; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.55); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.cons-tab:hover { color:rgba(255,255,255,.88); background:rgba(255,255,255,.08); }
.cons-tab.active { color:var(--cn); background:var(--cs); box-shadow:0 -2px 0 var(--ct) inset; }
.cons-tab-badge { background:var(--cr); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:99px; }

/* Cards */
.cons-card { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; }
.cons-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.cons-card-hdr h3 { font-size:14px; font-weight:700; color:var(--cn); margin:0; display:flex; align-items:center; gap:8px; }
.cons-card-hdr p { font-size:11px; color:var(--cm); margin:2px 0 0; }

/* KPI */
.cons-kpi { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; padding:16px 18px; box-shadow:var(--sh); position:relative; overflow:hidden; }
.cons-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.cons-kpi.blue::before { background:var(--cb); } .cons-kpi.teal::before { background:var(--ct); }
.cons-kpi.red::before { background:var(--cr); } .cons-kpi.orange::before { background:var(--co); }
.cons-kpi.green::before { background:var(--cg); } .cons-kpi.purple::before { background:var(--cp); }
.kpi-icon { width:38px; height:38px; border-radius:9px; display:flex; align-items:center; justify-content:center; margin-bottom:10px; }
.kpi-icon.blue { background:#EFF6FF; color:var(--cb); } .kpi-icon.teal { background:#F0FDFC; color:var(--ct); }
.kpi-icon.red { background:#FEF2F2; color:var(--cr); } .kpi-icon.orange { background:#FFF7ED; color:var(--co); }
.kpi-icon.green { background:#ECFDF5; color:var(--cg); } .kpi-icon.purple { background:#F5F3FF; color:var(--cp); }
.kpi-val { font-size:24px; font-weight:800; color:var(--cn); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.kpi-lbl { font-size:11px; font-weight:600; color:var(--cm); }

/* Section nav */
.sec-nav { display:flex; gap:6px; flex-wrap:wrap; padding:14px 20px; background:linear-gradient(to right,#F8FAFD,#EEF4FF); border-bottom:1.5px solid var(--cbr); }
.sec-btn { display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all .2s; color:var(--cm); background:none; font-family:'Poppins',sans-serif; white-space:nowrap; }
.sec-btn:hover { background:white; color:var(--cn); border-color:var(--cbr); }
.sec-btn.active { background:var(--cn); color:white; border-color:var(--cn); }

/* Badges */
.cbdg { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.cbdg.red { background:#FEF2F2; color:var(--cr); border:1px solid #FECACA; }
.cbdg.orange { background:#FFF7ED; color:var(--co); border:1px solid #FED7AA; }
.cbdg.yellow { background:#FEFCE8; color:#CA8A04; border:1px solid #FEF08A; }
.cbdg.green { background:#ECFDF5; color:var(--cg); border:1px solid #A7F3D0; }
.cbdg.blue { background:#EFF6FF; color:var(--cb); border:1px solid #BFDBFE; }
.cbdg.teal { background:#F0FDFC; color:var(--ct); border:1px solid #99F6E4; }
.cbdg.purple { background:#F5F3FF; color:var(--cp); border:1px solid #DDD6FE; }
.cbdg.gray { background:#F9FAFB; color:#4B5563; border:1px solid #E5E7EB; }

/* Buttons */
.cbtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; text-decoration:none; white-space:nowrap; }
.cbtn-primary { background:var(--cb); color:#fff; } .cbtn-primary:hover { background:#174391; transform:translateY(-1px); }
.cbtn-teal { background:var(--ct); color:#fff; } .cbtn-teal:hover { background:var(--ct2); transform:translateY(-1px); }
.cbtn-ghost { background:transparent; color:var(--cm); border:1.5px solid var(--cbr); }
.cbtn-ghost:hover { background:var(--cl); color:var(--cn); }
.cbtn-danger { background:#FEF2F2; color:var(--cr); border:1.5px solid #FECACA; }
.cbtn-danger:hover { background:var(--cr); color:#fff; }
.cbtn-sm { padding:6px 12px; font-size:12px; }
.cbtn-orange { background:#FFF7ED; color:var(--co); border:1.5px solid #FED7AA; }
.cbtn-orange:hover { background:var(--co); color:#fff; }
.cbtn-purple { background:#F5F3FF; color:var(--cp); border:1.5px solid #DDD6FE; }
.cbtn-purple:hover { background:var(--cp); color:#fff; }
.cbtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }

/* Forms */
.clbl { font-size:12px; font-weight:600; color:var(--cm); margin-bottom:6px; display:block; }
.clbl.req::after { content:' *'; color:var(--cr); }
.cinp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--cbr); background:#FAFBFF; font-size:13px; color:var(--cn); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.cinp:focus { border-color:var(--ct); box-shadow:0 0 0 3px rgba(14,165,160,.12); }
textarea.cinp { resize:vertical; min-height:80px; }

/* Vital card */
.vital { background:#F8FAFD; border:1.5px solid var(--cbr); border-radius:12px; padding:12px 14px; text-align:center; transition:all .2s; }
.vital:hover { border-color:var(--ct); }
.vital-v { font-size:20px; font-weight:800; color:var(--cn); }
.vital-l { font-size:10px; color:var(--cm); font-weight:600; text-transform:uppercase; margin-top:2px; letter-spacing:.4px; }
.vital-u { font-size:10px; color:#9CA3AF; margin-top:1px; }
.vital.warn .vital-v { color:var(--co); }
.vital.alert .vital-v { color:var(--cr); }

/* Alerts */
.al-ia { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; border-left:4px solid var(--cb); border-radius:14px; padding:14px 18px; }
.al-warn { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--co); border-radius:14px; padding:14px 18px; }
.al-success { background:linear-gradient(135deg,#ECFDF5,#D1FAE5); border:1.5px solid #A7F3D0; border-left:4px solid var(--cg); border-radius:14px; padding:14px 18px; }
.al-danger { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--cr); border-radius:14px; padding:14px 18px; }

/* Ordonnance print area */
.ordonnance { background:#fff; border:2px solid var(--cbr); border-radius:14px; padding:24px; }
.ordonnance-hdr { text-align:center; border-bottom:2px solid var(--cn); padding-bottom:14px; margin-bottom:14px; }

/* Table */
.cons-tbl { width:100%; border-collapse:collapse; }
.cons-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.cons-tbl th { padding:10px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--cm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--cbr); }
.cons-tbl td { padding:10px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.cons-tbl tbody tr:last-child td { border-bottom:none; }
.cons-tbl tbody tr:hover { background:#F8FAFF; }

/* Modal */
.mov { position:fixed; inset:0; z-index:500; background:rgba(11,30,59,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.mov-box { background:#fff; border-radius:20px; box-shadow:var(--shl); width:100%; max-width:600px; max-height:90vh; overflow-y:auto; animation:slideUp .25s ease; }
@keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.mov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:#EEF4FF; position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.mov-hdr h3 { font-size:15px; font-weight:700; color:var(--cn); margin:0; }
.mov-cls { width:32px; height:32px; border-radius:8px; background:#F3F7FF; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--cm); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.mov-cls:hover { background:#FEF2F2; color:var(--cr); }
.mov-body { padding:24px; }

/* Prog */
.cons-prog { background:#EEF4FF; border-radius:99px; height:6px; overflow:hidden; }
.cons-prog-f { height:100%; border-radius:99px; transition:width .5s; }

/* Steps indicator */
.steps { display:flex; gap:0; margin-bottom:24px; position:relative; }
.steps::before { content:''; position:absolute; top:18px; left:0; right:0; height:2px; background:var(--cbr); z-index:0; }
.step { flex:1; display:flex; flex-direction:column; align-items:center; gap:6px; position:relative; z-index:1; cursor:pointer; }
.step-dot { width:36px; height:36px; border-radius:50%; border:2px solid var(--cbr); background:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; color:var(--cm); transition:all .2s; }
.step.done .step-dot { background:var(--ct); border-color:var(--ct); color:#fff; }
.step.active .step-dot { background:var(--cn); border-color:var(--cn); color:#fff; box-shadow:0 0 0 4px rgba(14,165,160,.2); }
.step-lbl { font-size:10px; font-weight:600; color:var(--cm); text-align:center; white-space:nowrap; }
.step.active .step-lbl { color:var(--cn); }
.step.done .step-lbl { color:var(--ct); }

/* Ordonnance line */
.rx-line { display:flex; align-items:flex-start; gap:12px; background:#F8FAFD; border:1.5px solid var(--cbr); border-radius:12px; padding:14px 16px; transition:all .2s; }
.rx-line:hover { border-color:var(--ct); box-shadow:var(--sh); }
.rx-num { width:26px; height:26px; border-radius:50%; background:var(--cn); color:#fff; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }

/* Print */
@media print {
  .cons-top, .sec-nav, .cons-actions, .no-print { display:none!important; }
  .cons-card { box-shadow:none!important; border:1px solid #ddd!important; }
}

/* Fade */
@keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.fu { animation:fadeUp .3s ease both; }

/* ─── Grilles responsives ─── */
.cons-g2    { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.cons-g2-sm { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.cons-g3    { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
.cons-g4    { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }

/* ─── Mobile (≤ 767px) ─────────────────────────────────────── */
@media (max-width:767px) {
  .cons-top { padding:12px 14px 0; }

  /* Steps barre horizontale → scroll horizontal */
  .steps { overflow-x:auto; flex-wrap:nowrap; padding-bottom:6px; }
  .step-lbl { font-size:9px; }
  .step-dot  { width:30px; height:30px; font-size:11px; }
  .steps::before { top:15px; }

  /* Grilles → 1 colonne */
  .cons-g2, .cons-g3  { grid-template-columns:1fr; gap:14px; }
  .cons-g2-sm { grid-template-columns:1fr 1fr; gap:8px; } /* reste 2 col sur mobile */
  .cons-g4 { grid-template-columns:1fr 1fr; gap:10px; }

  /* Formulaires */
  .cinp { font-size:16px !important; }

  /* Boutons */
  .cbtn    { font-size:12px; padding:8px 12px; }
  .cbtn-sm { font-size:11px; padding:5px 8px; }

  /* Cards */
  .cons-card     { border-radius:14px; }
  .cons-card-hdr { padding:11px 14px; }
  .cons-card-hdr h3 { font-size:13px; }

  /* KPI */
  .kpi-val  { font-size:20px; }
  .kpi-icon { width:32px; height:32px; margin-bottom:8px; }

  /* Vital boxes */
  .vital { padding:10px 10px; }
  .vital-v { font-size:16px; }

  /* Modal → bottom-sheet */
  .mov     { padding:0; align-items:flex-end; }
  .mov-box { border-radius:20px 20px 0 0; max-width:100%; max-height:93vh; }
  .mov-hdr { padding:13px 16px; }
  .mov-body{ padding:14px; }

  /* Section nav scrollable */
  .sec-nav { overflow-x:auto; flex-wrap:nowrap; padding:10px 14px; scrollbar-width:none; }
  .sec-nav::-webkit-scrollbar { display:none; }
}

/* ─── Très petit écran (≤ 479px) ─────────────────────────────  */
@media (max-width:479px) {
  .cons-top   { padding:10px 12px 0; }
  .cons-g2-sm { grid-template-columns:1fr; gap:8px; }
  .cons-g4    { grid-template-columns:1fr; }
  .kpi-val    { font-size:18px; }
  .cons-card-hdr { flex-wrap:wrap; gap:8px; }
}
`;

// ─── Helpers ─────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const now = () => new Date().toISOString().substring(0, 16);
const genNumero = () => `CONS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

const GRAVITE_CFG = {
  leger: { cls: "green", label: "Légère" },
  modere: { cls: "orange", label: "Modérée" },
  grave: { cls: "red", label: "Grave" },
  critique: { cls: "red", label: "Critique" },
};

const SERVICES = ["Médecine générale", "Pédiatrie", "Gynécologie-obstétrique", "Chirurgie", "Cardiologie", "Urgences", "Orthopédie", "Ophtalmologie", "ORL", "Dermatologie"];
const MEDECINS = ["Dr. Martin Leblanc", "Dr. Sophie Pierre", "Dr. Paul Nkoma", "Dr. Fatou Diallo", "Dr. André Mbemba"];
const MEDICAMENTS_COURANTS = ["Paracétamol 500mg", "Amoxicilline 500mg", "Ibuprofène 400mg", "Métronidazole 250mg", "Oméprazole 20mg", "Cétirizine 10mg", "Diclofénac 50mg", "Cotrimoxazole 480mg"];

// ─── SVG Icons ────────────────────────────────────────────────
const I = {
  user:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  heart:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  pulse:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  steth:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6v0a6 6 0 006-6V4a2 2 0 00-2-2h-1a.2.2 0 10.3.3"/><path d="M8 15v1a6 6 0 006 6v0a6 6 0 006-6v-4"/><circle cx="20" cy="10" r="2"/></svg>,
  pill:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.5 20H4a2 2 0 01-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 011.66.9l.82 1.2a2 2 0 001.66.9H20a2 2 0 012 2v3"/><circle cx="18" cy="18" r="4"/><path d="M15.3 15.3l5.4 5.4"/></svg>,
  lab:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2v6l3 9H7l3-9V2"/><path d="M6 2h12"/><path d="M10 14h4"/></svg>,
  cash:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  save:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  print:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  plus:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
  check:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  alert:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  send:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  cal:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  dl:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  diag:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  hospit: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
};

// ─── Modal ────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, maxWidth = 600 }) {
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

// ─── Empty forms ─────────────────────────────────────────────
const EMPTY_RX = { medicament: "", posologie: "", duree: "", conseils: "" };
const EMPTY_EXAM = { type: "biologie", libelle: "", priorite: "normal", note: "" };
const EMPTY_CONS = {
  numero: genNumero(),
  patient_nom: "", patient_prenom: "", patient_sexe: "homme", patient_ddn: "",
  patient_tel: "", patient_adresse: "", patient_groupe_sanguin: "",
  patient_antecedents: "", patient_allergies: "",
  date_heure: now(), medecin: MEDECINS[0], service: SERVICES[0],
  type_consultation: "nouvelle_visite",
  motif: "",
  temp: "", poids: "", taille: "", ta_sys: "", ta_dia: "", fc: "", spo2: "",
  examen_clinique: "",
  diagnostic_principal: "", diagnostic_secondaire: "", gravite: "leger",
  prescriptions: [],
  examens: [],
  decision: "domicile", rdv_date: "", rdv_note: "",
  notes_generales: "",
  frais_consultation: 15000,
  statut_paiement: "non_paye",
};

// ─── DEMO PATIENTS ────────────────────────────────────────────
const DEMO_PATIENTS = [];

const ageCalc = (dob) => {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 3600 * 1000));
};

// ─── IMC ─────────────────────────────────────────────────────
const calcIMC = (poids, taille) => {
  if (!poids || !taille) return null;
  const imc = (parseFloat(poids) / Math.pow(parseFloat(taille) / 100, 2)).toFixed(1);
  const cat = imc < 18.5 ? { lbl: "Insuffisance", cls: "blue" } : imc < 25 ? { lbl: "Normal", cls: "green" } : imc < 30 ? { lbl: "Surpoids", cls: "orange" } : { lbl: "Obésité", cls: "red" };
  return { imc, ...cat };
};

// ─── MAIN COMPONENT ──────────────────────────────────────────
export default function Consultation() {
  const dispatch = useDispatch();
  const reduxConsultations = useSelector(selectConsultations);
  const reduxVitals = useSelector(selectVitals);

  useEffect(() => { dispatch(fetchConsultations({})); }, [dispatch]);

  // Détection mobile — inline styles priorité absolue sur les onglets
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 599);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const [section, setSection] = useState("patient");
  const [form, setForm] = useState(EMPTY_CONS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [modalPatient, setModalPatient] = useState(false);
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientLoading, setPatientLoading] = useState(false);

  const loadPatients = useCallback(async () => {
    setPatientLoading(true);
    try {
      const { data } = await api.get('/patients?limit=200');
      setPatients(data.patients || data || []);
    } catch { setPatients([]); }
    finally { setPatientLoading(false); }
  }, []);
  const [modalRx, setModalRx] = useState(false);
  const [modalExam, setModalExam] = useState(false);
  const [modalOrd, setModalOrd] = useState(false);
  const [formRx, setFormRx] = useState(EMPTY_RX);
  const [formExam, setFormExam] = useState(EMPTY_EXAM);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const age = ageCalc(form.patient_ddn);
  const imc = calcIMC(form.poids, form.taille);

  const selectPatient = (p) => {
    setForm(f => ({
      ...f,
      patient_id: p._id,
      patient_nom: p.nom, patient_prenom: p.prenom,
      patient_sexe: p.sexe || p.genre, patient_ddn: p.date_naissance || p.ddn,
      patient_tel: p.telephone || p.tel,
      patient_adresse: p.adresse?.rue || p.adresse || '',
      patient_groupe_sanguin: p.groupe_sanguin,
      patient_antecedents: Array.isArray(p.antecedents_medicaux) ? p.antecedents_medicaux.join(', ') : (p.antecedents_medicaux || p.antecedents || ''),
      patient_allergies: Array.isArray(p.allergies) ? p.allergies.join(', ') : (p.allergies || ''),
    }));
    setModalPatient(false);
  };

  const addRx = (e) => {
    e.preventDefault();
    if (!formRx.medicament) return;
    setForm(f => ({ ...f, prescriptions: [...f.prescriptions, { ...formRx, id: Date.now() }] }));
    setFormRx(EMPTY_RX);
    setModalRx(false);
  };

  const removeRx = (id) => setForm(f => ({ ...f, prescriptions: f.prescriptions.filter(r => r.id !== id) }));

  const addExam = (e) => {
    e.preventDefault();
    if (!formExam.libelle) return;
    setForm(f => ({ ...f, examens: [...f.examens, { ...formExam, id: Date.now() }] }));
    setFormExam(EMPTY_EXAM);
    setModalExam(false);
  };

  const removeExam = (id) => setForm(f => ({ ...f, examens: f.examens.filter(x => x.id !== id) }));

  const handleSave = async () => {
    if (!form.patient_id) {
      toast.error('Veuillez sélectionner un patient dans la base de données.');
      setSection('patient');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        patient: form.patient_id,
        date_consultation: form.date_heure || new Date().toISOString(),
        signes_vitaux: {
          tension_systolique:  form.ta_sys   ? Number(form.ta_sys)   : undefined,
          tension_diastolique: form.ta_dia   ? Number(form.ta_dia)   : undefined,
          pouls:       form.fc     ? Number(form.fc)     : undefined,
          temperature: form.temp   ? Number(form.temp)   : undefined,
          spo2:        form.spo2   ? Number(form.spo2)   : undefined,
          poids:       form.poids  ? Number(form.poids)  : undefined,
          taille:      form.taille ? Number(form.taille) : undefined,
        },
        anamnese:          form.motif || '',
        examen_clinique:   form.examen_clinique || '',
        diagnostic:        form.diagnostic_principal || '',
        diagnostic_code:   form.diagnostic_secondaire || '',
        recommandations:   form.notes_generales || '',
        prescriptions:     form.prescriptions.map(r => ({
          medicament_nom: r.medicament,
          posologie:      r.posologie,
          duree:          r.duree,
          notes:          r.conseils,
        })),
        statut: 'terminee',
      };
      await dispatch(createConsultation(payload)).unwrap();
      toast.success('✅ Consultation enregistrée avec succès');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setForm(EMPTY_CONS);
      setSection('patient');
    } catch (err) {
      toast.error(err || 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const totalFacture = form.frais_consultation
    + form.examens.reduce((s, x) => s + (x.type === "biologie" ? 5000 : x.type === "imagerie" ? 25000 : x.type === "scanner" ? 75000 : 15000), 0);

  const vitalWarning = (key, val) => {
    if (!val || val === "") return "";
    const v = parseFloat(val);
    if (key === "temp") return v > 38.5 ? "alert" : v > 37.5 ? "warn" : "";
    if (key === "fc") return v > 100 || v < 60 ? (v > 120 || v < 50 ? "alert" : "warn") : "";
    if (key === "spo2") return v < 90 ? "alert" : v < 95 ? "warn" : "";
    return "";
  };

  const STEPS = [
    { id: "patient", label: "Patient", icon: "👤" },
    { id: "consultation", label: "Consultation", icon: "📋" },
    { id: "vitaux", label: "Signes vitaux", icon: "💓" },
    { id: "clinique", label: "Examen clinique", icon: "🩺" },
    { id: "diagnostic", label: "Diagnostic", icon: "🔍" },
    { id: "prescriptions", label: "Prescriptions", icon: "💊" },
    { id: "examens", label: "Examens compl.", icon: "🔬" },
    { id: "decision", label: "Décision", icon: "📌" },
    { id: "facturation", label: "Facturation", icon: "💰" },
  ];

  const stepOrder = STEPS.map(s => s.id);
  const currentIdx = stepOrder.indexOf(section);

  const nextStep = () => { if (currentIdx < stepOrder.length - 1) setSection(stepOrder[currentIdx + 1]); };
  const prevStep = () => { if (currentIdx > 0) setSection(stepOrder[currentIdx - 1]); };

  return (
    <>
      <style>{CSS}</style>
      <div className="cons">

        {/* ── TOPBAR ── */}
        <div className="cons-top">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", position: "relative", zIndex: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 54, height: 54, borderRadius: 14, background: "rgba(255,255,255,.12)", border: "1.5px solid rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {I.steth}
              </div>
              <div>
                <div style={{ fontSize: 21, fontWeight: 700, color: "#fff", letterSpacing: -.3 }}>Nouvelle Consultation</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginTop: 2 }}>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: "rgba(255,255,255,.8)" }}>{form.numero}</span>
                  {" · "}{form.medecin}{" · "}{new Date().toLocaleDateString("fr-FR")}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} className="no-print">
              {saved && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(5,150,105,.2)", border: "1px solid rgba(5,150,105,.4)", borderRadius: 10, padding: "8px 14px", color: "#6EE7B7", fontSize: 12, fontWeight: 600 }}>
                  {I.check} Consultation enregistrée
                </div>
              )}
              <button className="cbtn cbtn-ghost" style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }} onClick={() => setModalOrd(true)}>
                {I.print} Ordonnance
              </button>
              <button className="cbtn cbtn-ghost" style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }} onClick={() => window.print()}>
                {I.print} Imprimer fiche
              </button>
              <button className="cbtn cbtn-teal" disabled={saving} onClick={handleSave}>
                {I.save} {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={isMobile ? {
            display:'grid', gridTemplateColumns:'repeat(3,1fr)',
            gap:'4px', padding:'8px 10px', marginTop:'8px',
            background:'rgba(255,255,255,.07)', borderRadius:'10px 10px 0 0',
          } : {
            display:'flex', gap:'2px', padding:'0', marginTop:'16px',
            overflowX:'auto', scrollbarWidth:'none',
          }}>
            {STEPS.map((s) => {
              const mobileLabels = {
                patient:'Patient', consultation:'Consult.',
                vitaux:'Vitaux', clinique:'Examen',
                diagnostic:'Diagnostic', prescriptions:'Prescrip.',
                examens:'Examens', decision:'Décision', facturation:'Facture',
              };
              return (
                <button
                  key={s.id}
                  className={`cons-tab ${section === s.id ? "active" : ""}`}
                  style={isMobile ? {
                    flexDirection:'column', alignItems:'center', justifyContent:'center',
                    textAlign:'center', padding:'7px 3px 8px', fontSize:'9px',
                    gap:'2px', borderRadius:'8px', whiteSpace:'normal', minWidth:0,
                  } : {}}
                  onClick={() => setSection(s.id)}
                >
                  <span style={isMobile ? { fontSize:'14px' } : {}}>{s.icon}</span>
                  <span style={isMobile ? { lineHeight:1.2 } : {}}>
                    {isMobile ? mobileLabels[s.id] : s.label}
                  </span>
                  {s.id === "prescriptions" && form.prescriptions.length > 0 && (
                    <span className="cons-tab-badge">{form.prescriptions.length}</span>
                  )}
                  {s.id === "examens" && form.examens.length > 0 && (
                    <span className="cons-tab-badge">{form.examens.length}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div style={{ padding: isMobile ? 14 : 24 }}>

          {/* Bandeau patient (si renseigné) */}
          {form.patient_nom && section !== "patient" && (
            <div className="fu" style={{ background: "linear-gradient(135deg,#0B1E3B,#132744)", borderRadius: 14, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ fontSize: 28 }}>{form.patient_sexe === "femme" ? "👩" : "👨"}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{form.patient_prenom} {form.patient_nom}</div>
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.6)", marginTop: 2 }}>
                  {age ? `${age} ans` : "—"} · {form.patient_groupe_sanguin || "Gr. ?"}
                  {form.patient_allergies && <span style={{ color: "#FCA5A5" }}> · ⚠ Allergies: {form.patient_allergies}</span>}
                </div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11.5, color: "rgba(255,255,255,.6)" }}>{form.service} · {form.type_consultation === "nouvelle_visite" ? "Nouvelle visite" : "Contrôle"}</span>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,.8)", fontWeight: 700 }}>{form.numero}</span>
              </div>
            </div>
          )}

          {/* ══ PATIENT ══ */}
          {section === "patient" && (
            <div className="fu">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--cn)" }}>Informations du patient</div>
                  <div style={{ fontSize: 12, color: "var(--cm)", marginTop: 2 }}>Identité, contact et historique médical</div>
                </div>
                <button className="cbtn cbtn-primary" onClick={() => { setModalPatient(true); setPatientSearch(''); loadPatients(); }}>
                  {I.user} Sélectionner un patient existant
                </button>
              </div>

              <div className="cons-g2">
                {/* Identité */}
                <div className="cons-card">
                  <div className="cons-card-hdr"><h3>👤 Identité</h3></div>
                  <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                    <div className="cons-g2-sm">
                      <div>
                        <label className="clbl req">Nom</label>
                        <input className="cinp" value={form.patient_nom} onChange={e => setF("patient_nom", e.target.value)} placeholder="DUPONT" style={{ textTransform: "uppercase" }} />
                      </div>
                      <div>
                        <label className="clbl req">Prénom</label>
                        <input className="cinp" value={form.patient_prenom} onChange={e => setF("patient_prenom", e.target.value)} placeholder="Jean" />
                      </div>
                    </div>
                    <div className="cons-g2-sm">
                      <div>
                        <label className="clbl">Sexe</label>
                        <select className="cinp" value={form.patient_sexe} onChange={e => setF("patient_sexe", e.target.value)}>
                          <option value="homme">Masculin</option>
                          <option value="femme">Féminin</option>
                        </select>
                      </div>
                      <div>
                        <label className="clbl">Date de naissance</label>
                        <input type="date" className="cinp" value={form.patient_ddn} onChange={e => setF("patient_ddn", e.target.value)} />
                      </div>
                    </div>
                    {age && (
                      <div style={{ background: "#EEF4FF", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "var(--cb)", fontWeight: 600 }}>
                        🎂 {age} ans {age < 15 ? "· Patient pédiatrique" : age > 65 ? "· Patient gériatrique" : ""}
                      </div>
                    )}
                    <div>
                      <label className="clbl">Téléphone</label>
                      <input className="cinp" value={form.patient_tel} onChange={e => setF("patient_tel", e.target.value)} placeholder="+242 06 000 0000" />
                    </div>
                    <div>
                      <label className="clbl">Adresse</label>
                      <input className="cinp" value={form.patient_adresse} onChange={e => setF("patient_adresse", e.target.value)} placeholder="Quartier, Ville" />
                    </div>
                    <div>
                      <label className="clbl">Groupe sanguin</label>
                      <select className="cinp" value={form.patient_groupe_sanguin} onChange={e => setF("patient_groupe_sanguin", e.target.value)}>
                        <option value="">— Inconnu —</option>
                        {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Historique médical */}
                <div className="cons-card">
                  <div className="cons-card-hdr"><h3>📋 Historique médical</h3></div>
                  <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label className="clbl">Antécédents médicaux</label>
                      <textarea className="cinp" rows={4} value={form.patient_antecedents} onChange={e => setF("patient_antecedents", e.target.value)} placeholder="HTA, Diabète, Asthme, maladies chroniques..." />
                    </div>
                    <div>
                      <label className="clbl">⚠ Allergies connues</label>
                      <input className="cinp" value={form.patient_allergies} onChange={e => setF("patient_allergies", e.target.value)} placeholder="Pénicilline, Aspirine, Latex..." style={{ borderColor: form.patient_allergies ? "#FECACA" : "", background: form.patient_allergies ? "#FEF2F2" : "" }} />
                      {form.patient_allergies && (
                        <div style={{ fontSize: 11, color: "var(--cr)", marginTop: 4, fontWeight: 600 }}>
                          ⚠ Attention lors de la prescription
                        </div>
                      )}
                    </div>
                    <div style={{ background: "#F8FAFD", borderRadius: 12, padding: "12px 14px", border: "1.5px dashed var(--cbr)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cm)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>🔗 Modules liés</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {["📁 Dossier médical", "💊 Pharmacie", "🔬 Labo", "🏥 Hospitalisation", "🔪 Chirurgie"].map(m => (
                          <span key={m} style={{ background: "white", border: "1px solid var(--cbr)", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "var(--cn)", cursor: "pointer" }}>{m}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ background: "linear-gradient(135deg,#F0FDFC,#CCFBF1)", border: "1.5px solid #99F6E4", borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ct)", marginBottom: 4 }}>💡 Dernières consultations</div>
                      <div style={{ fontSize: 12, color: "var(--cm)" }}>Aucune consultation précédente enregistrée</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ INFOS CONSULTATION ══ */}
          {section === "consultation" && (
            <div className="fu">
              <div className="cons-card">
                <div className="cons-card-hdr"><h3>📋 Informations de la consultation</h3></div>
                <div className="cons-g3" style={{ padding: 20 }}>
                  <div>
                    <label className="clbl">Numéro de consultation</label>
                    <input className="cinp" value={form.numero} readOnly style={{ background: "#EEF4FF", fontFamily: "monospace", fontWeight: 700, color: "var(--cb)" }} />
                  </div>
                  <div>
                    <label className="clbl req">Date et heure</label>
                    <input type="datetime-local" className="cinp" value={form.date_heure} onChange={e => setF("date_heure", e.target.value)} />
                  </div>
                  <div>
                    <label className="clbl req">Type de visite</label>
                    <select className="cinp" value={form.type_consultation} onChange={e => setF("type_consultation", e.target.value)}>
                      <option value="nouvelle_visite">🆕 Nouvelle visite</option>
                      <option value="controle">🔄 Contrôle / Suivi</option>
                      <option value="urgence">🚨 Urgence</option>
                    </select>
                  </div>
                  <div>
                    <label className="clbl req">Médecin consultant</label>
                    <select className="cinp" value={form.medecin} onChange={e => setF("medecin", e.target.value)}>
                      {MEDECINS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: "2 / span 2" }}>
                    <label className="clbl req">Service</label>
                    <select className="cinp" value={form.service} onChange={e => setF("service", e.target.value)}>
                      {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    <label className="clbl req">Motif de consultation</label>
                    <textarea className="cinp" rows={3} value={form.motif} onChange={e => setF("motif", e.target.value)} placeholder="Décrivez le motif principal de la visite : fièvre, douleur abdominale, toux persistante, contrôle de grossesse, bilan de santé..." />
                  </div>
                </div>
              </div>

              {/* Motifs rapides */}
              <div style={{ marginTop: 16 }} className="cons-card">
                <div className="cons-card-hdr"><h3>⚡ Motifs fréquents (clic rapide)</h3></div>
                <div style={{ padding: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {["Fièvre", "Douleur abdominale", "Toux", "Céphalée", "Douleur thoracique", "Contrôle de grossesse", "Suivi diabète", "Suivi HTA", "Douleur articulaire", "Éruption cutanée", "Bilan de santé", "Consultation prénatale", "Vaccination", "Paludisme", "Diarrhée"].map(m => (
                    <button key={m} className="cbdg blue" style={{ cursor: "pointer", padding: "6px 12px" }} onClick={() => setF("motif", form.motif ? form.motif + ", " + m : m)}>
                      + {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ SIGNES VITAUX ══ */}
          {section === "vitaux" && (
            <div className="fu">
              <div className="cons-card" style={{ marginBottom: 20 }}>
                <div className="cons-card-hdr"><h3>💓 Signes vitaux</h3><p>Mesures à la prise en charge</p></div>
                <div style={{ padding: 20 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 20 }}>
                    {[
                      { key: "temp", label: "Température", unit: "°C", placeholder: "37.0", min: 34, max: 42, step: "0.1", icon: "🌡️" },
                      { key: "poids", label: "Poids", unit: "kg", placeholder: "70", min: 1, max: 300, icon: "⚖️" },
                      { key: "taille", label: "Taille", unit: "cm", placeholder: "170", min: 30, max: 250, icon: "📏" },
                      { key: "fc", label: "Fréq. cardiaque", unit: "bpm", placeholder: "72", min: 20, max: 250, icon: "💗" },
                      { key: "spo2", label: "Saturation O₂", unit: "%", placeholder: "98", min: 50, max: 100, icon: "🫁" },
                    ].map(v => (
                      <div key={v.key}>
                        <label className="clbl">{v.icon} {v.label}</label>
                        <div style={{ position: "relative" }}>
                          <input type="number" className="cinp" placeholder={v.placeholder} min={v.min} max={v.max} step={v.step || 1} value={form[v.key]} onChange={e => setF(v.key, e.target.value)} style={{ paddingRight: 40, borderColor: vitalWarning(v.key, form[v.key]) === "alert" ? "#DC2626" : vitalWarning(v.key, form[v.key]) === "warn" ? "#D97706" : "" }} />
                          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--cm)", fontWeight: 600 }}>{v.unit}</span>
                        </div>
                      </div>
                    ))}
                    <div>
                      <label className="clbl">🩺 Tension artérielle</label>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input type="number" className="cinp" placeholder="120" value={form.ta_sys} onChange={e => setF("ta_sys", e.target.value)} style={{ flex: 1 }} />
                        <span style={{ color: "var(--cm)", fontWeight: 700, fontSize: 16 }}>/</span>
                        <input type="number" className="cinp" placeholder="80" value={form.ta_dia} onChange={e => setF("ta_dia", e.target.value)} style={{ flex: 1 }} />
                        <span style={{ fontSize: 10, color: "var(--cm)", whiteSpace: "nowrap" }}>mmHg</span>
                      </div>
                    </div>
                  </div>

                  {/* Résumé vitaux visuels */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12 }}>
                    {[
                      { label: "Température", val: form.temp ? `${form.temp}°C` : "—", key: "temp", norm: "36.5–37.5" },
                      { label: "Tension", val: form.ta_sys && form.ta_dia ? `${form.ta_sys}/${form.ta_dia}` : "—", key: "ta", norm: "< 130/85" },
                      { label: "Fréq. card.", val: form.fc ? `${form.fc} bpm` : "—", key: "fc", norm: "60–100" },
                      { label: "SpO₂", val: form.spo2 ? `${form.spo2}%` : "—", key: "spo2", norm: "≥ 95%" },
                      { label: "IMC", val: imc ? `${imc.imc}` : "—", key: "imc", norm: imc ? imc.lbl : "—" },
                    ].map(v => (
                      <div key={v.label} className={`vital ${vitalWarning(v.key, form[v.key])}`}>
                        <div className="vital-v">{v.val}</div>
                        <div className="vital-l">{v.label}</div>
                        <div className="vital-u">Norme : {v.norm}</div>
                      </div>
                    ))}
                  </div>

                  {/* Alertes vitaux */}
                  {(vitalWarning("temp", form.temp) || vitalWarning("fc", form.fc) || vitalWarning("spo2", form.spo2)) && (
                    <div className="al-warn" style={{ marginTop: 16, display: "flex", alignItems: "flex-start", gap: 12 }}>
                      {I.alert}
                      <div>
                        <strong style={{ color: "#92400E", fontSize: 13 }}>⚠ Valeur(s) anormale(s) détectée(s)</strong>
                        <div style={{ fontSize: 12, color: "#B45309", marginTop: 4 }}>
                          {vitalWarning("temp", form.temp) === "alert" && <div>🌡️ Température critique : {form.temp}°C — Hyperthermie majeure</div>}
                          {vitalWarning("temp", form.temp) === "warn" && <div>🌡️ Température élevée : {form.temp}°C — Surveiller</div>}
                          {vitalWarning("fc", form.fc) === "alert" && <div>💗 Fréquence cardiaque critique : {form.fc} bpm</div>}
                          {vitalWarning("spo2", form.spo2) === "alert" && <div>🫁 Saturation critique : {form.spo2}% — Oxygénothérapie urgente</div>}
                          {vitalWarning("spo2", form.spo2) === "warn" && <div>🫁 Saturation limite : {form.spo2}% — À surveiller</div>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══ EXAMEN CLINIQUE ══ */}
          {section === "clinique" && (
            <div className="fu">
              <div className="cons-card">
                <div className="cons-card-hdr"><h3>🩺 Examen clinique</h3></div>
                <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label className="clbl req">Observations générales</label>
                    <textarea className="cinp" rows={4} value={form.examen_clinique} onChange={e => setF("examen_clinique", e.target.value)} placeholder="État général, conscience, teint, hydratation, ictère, cyanose, œdèmes...&#10;Ex: Patient conscient, orienté, en bon état général. Pâleur cutanée modérée. Pas d'ictère." />
                  </div>
                  {/* Grille systèmes */}
                  {["examen_cardiovasculaire", "examen_pulmonaire", "examen_abdominal", "examen_neurologique", "examen_orl", "examen_dermatologie"].map((k, i) => {
                    const labels = { examen_cardiovasculaire: "❤️ Cardiovasculaire", examen_pulmonaire: "🫁 Pulmonaire / Respiratoire", examen_abdominal: "🫃 Abdominal", examen_neurologique: "🧠 Neurologique", examen_orl: "👂 ORL", examen_dermatologie: "🩹 Peau & Téguments" };
                    const placeholders = {
                      examen_cardiovasculaire: "Bruits du cœur, souffles, pouls périphériques...",
                      examen_pulmonaire: "Murmure vésiculaire, râles, wheezing, dyspnée...",
                      examen_abdominal: "Souple, douloureux, défense, hépatomégalie, splénomégalie...",
                      examen_neurologique: "ROT, sensibilité, force, équilibre, nerfs crâniens...",
                      examen_orl: "Gorge, oreilles, fosses nasales, ganglions...",
                      examen_dermatologie: "Éruption, lésions, cicatrices, plaies...",
                    };
                    return (
                      <div key={k}>
                        <label className="clbl">{labels[k]}</label>
                        <textarea className="cinp" rows={2} value={form[k] || ""} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={placeholders[k]} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ══ DIAGNOSTIC ══ */}
          {section === "diagnostic" && (
            <div className="fu">
              <div className="cons-card">
                <div className="cons-card-hdr"><h3>🔍 Diagnostic médical</h3></div>
                <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label className="clbl req">Diagnostic principal</label>
                    <input className="cinp" value={form.diagnostic_principal} onChange={e => setF("diagnostic_principal", e.target.value)} placeholder="Ex: Paludisme simple, Pneumonie bactérienne, HTA stade 2..." style={{ fontSize: 14, fontWeight: 600 }} />
                  </div>
                  <div>
                    <label className="clbl">Diagnostic secondaire / Comorbidités</label>
                    <input className="cinp" value={form.diagnostic_secondaire} onChange={e => setF("diagnostic_secondaire", e.target.value)} placeholder="Ex: Anémie associée, Dénutrition protéique..." />
                  </div>
                  <div>
                    <label className="clbl req">Niveau de gravité</label>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {[["leger", "🟢 Légère"], ["modere", "🟡 Modérée"], ["grave", "🟠 Grave"], ["critique", "🔴 Critique"]].map(([val, lbl]) => (
                        <button key={val} type="button" className={`cbtn ${form.gravite === val ? (val === "leger" ? "cbtn-teal" : val === "modere" ? "" : "cbtn-danger") : "cbtn-ghost"}`}
                          style={form.gravite === val && val === "modere" ? { background: "#FFF7ED", color: "var(--co)", border: "1.5px solid #FED7AA" } : {}}
                          onClick={() => setF("gravite", val)}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* IA suggestion */}
                  {form.diagnostic_principal && (
                    <div className="al-ia">
                      <strong style={{ color: "#1E40AF", fontSize: 13 }}>🤖 IA — Suggestion diagnostique</strong>
                      <div style={{ fontSize: 12, color: "#3B82F6", marginTop: 4 }}>
                        Diagnostic enregistré : <strong>{form.diagnostic_principal}</strong>
                        {form.patient_allergies && <span style={{ color: "var(--cr)" }}> · ⚠ Vérifier allergies ({form.patient_allergies}) lors de la prescription</span>}
                        {age && age > 65 && " · Patient âgé — posologies adaptées recommandées"}
                        {age && age < 15 && " · Posologies pédiatriques à utiliser"}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="clbl">Notes cliniques supplémentaires</label>
                    <textarea className="cinp" rows={3} value={form.notes_generales} onChange={e => setF("notes_generales", e.target.value)} placeholder="Observations complémentaires, hypothèses diagnostiques alternatives..." />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ PRESCRIPTIONS ══ */}
          {section === "prescriptions" && (
            <div className="fu">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--cn)" }}>💊 Prescriptions médicales</div>
                  <div style={{ fontSize: 12, color: "var(--cm)" }}>{form.prescriptions.length} médicament(s) prescrit(s)</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="cbtn cbtn-ghost" onClick={() => setModalOrd(true)}>{I.print} Aperçu ordonnance</button>
                  <button className="cbtn cbtn-primary" onClick={() => { setFormRx(EMPTY_RX); setModalRx(true); }}>
                    {I.plus} Ajouter médicament
                  </button>
                </div>
              </div>

              {form.patient_allergies && (
                <div className="al-danger" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  {I.alert}
                  <div>
                    <strong style={{ color: "#B91C1C", fontSize: 13 }}>⚠ Attention — Allergies connues du patient</strong>
                    <div style={{ fontSize: 12, color: "#DC2626", marginTop: 2 }}>{form.patient_allergies}</div>
                  </div>
                </div>
              )}

              {form.prescriptions.length === 0 ? (
                <div className="cons-card" style={{ padding: 50, textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>💊</div>
                  <div style={{ fontWeight: 700, color: "var(--cm)", fontSize: 14 }}>Aucune prescription</div>
                  <div style={{ color: "var(--cm)", fontSize: 12, marginTop: 6 }}>Ajoutez des médicaments à la prescription</div>
                  <button className="cbtn cbtn-primary" style={{ marginTop: 16 }} onClick={() => setModalRx(true)}>{I.plus} Première prescription</button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {form.prescriptions.map((rx, i) => (
                    <div key={rx.id} className="rx-line">
                      <div className="rx-num">{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--cn)" }}>💊 {rx.medicament}</div>
                        <div style={{ fontSize: 12, color: "var(--cm)", marginTop: 4 }}>
                          {rx.posologie && <span>📋 {rx.posologie}</span>}
                          {rx.duree && <span style={{ marginLeft: 12 }}>⏱ Durée : {rx.duree}</span>}
                        </div>
                        {rx.conseils && <div style={{ fontSize: 11.5, color: "#6B7280", marginTop: 4, fontStyle: "italic" }}>💡 {rx.conseils}</div>}
                      </div>
                      <button className="cbtn cbtn-ghost cbtn-sm" style={{ color: "var(--cr)", borderColor: "#FECACA" }} onClick={() => removeRx(rx.id)}>{I.trash}</button>
                    </div>
                  ))}
                </div>
              )}

              {form.prescriptions.length > 0 && (
                <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                  <button className="cbtn cbtn-teal" onClick={() => setModalOrd(true)}>{I.print} Imprimer l'ordonnance</button>
                  <button className="cbtn cbtn-ghost">{I.send} Envoyer à la pharmacie</button>
                </div>
              )}
            </div>
          )}

          {/* ══ EXAMENS COMPLÉMENTAIRES ══ */}
          {section === "examens" && (
            <div className="fu">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--cn)" }}>🔬 Examens complémentaires</div>
                  <div style={{ fontSize: 12, color: "var(--cm)" }}>{form.examens.length} examen(s) demandé(s)</div>
                </div>
                <button className="cbtn cbtn-primary" onClick={() => { setFormExam(EMPTY_EXAM); setModalExam(true); }}>
                  {I.plus} Demander un examen
                </button>
              </div>

              {/* Examens rapides */}
              <div className="cons-card" style={{ marginBottom: 16 }}>
                <div className="cons-card-hdr"><h3>⚡ Prescriptions rapides fréquentes</h3></div>
                <div style={{ padding: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    ["NFS complète", "biologie"], ["Glycémie à jeun", "biologie"], ["Créatinémie", "biologie"],
                    ["Ionogramme sanguin", "biologie"], ["Bilan lipidique", "biologie"], ["Groupage sanguin", "biologie"],
                    ["GE/TDR paludisme", "biologie"], ["ECBU", "biologie"], ["CRP", "biologie"],
                    ["Radiographie thorax", "imagerie"], ["Échographie abdominale", "imagerie"], ["ECG", "autre"],
                    ["Scanner thoracique", "scanner"], ["IRM cérébrale", "scanner"],
                  ].map(([lbl, type]) => (
                    <button key={lbl} type="button" className={`cbdg ${type === "biologie" ? "blue" : type === "imagerie" ? "teal" : type === "scanner" ? "purple" : "orange"}`}
                      style={{ cursor: "pointer", padding: "6px 12px" }}
                      onClick={() => {
                        if (!form.examens.find(x => x.libelle === lbl))
                          setForm(f => ({ ...f, examens: [...f.examens, { type, libelle: lbl, priorite: "normal", note: "", id: Date.now() }] }));
                      }}>
                      + {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {form.examens.length === 0 ? (
                <div className="cons-card" style={{ padding: 50, textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🔬</div>
                  <div style={{ fontWeight: 700, color: "var(--cm)" }}>Aucun examen prescrit</div>
                </div>
              ) : (
                <>
                  {[
                    { type: "biologie", label: "🩸 Analyses biologiques", btnCls: "cbtn-primary" },
                    { type: "imagerie", label: "🩻 Imagerie médicale", btnCls: "cbtn-teal" },
                    { type: "scanner", label: "🖥️ Scanner / IRM", btnCls: "cbtn-purple" },
                    { type: "autre", label: "📋 Autres examens", btnCls: "cbtn-ghost" },
                  ].map(({ type, label, btnCls }) => {
                    const items = form.examens.filter(x => x.type === type);
                    if (items.length === 0) return null;
                    return (
                      <div key={type} className="cons-card" style={{ marginBottom: 14 }}>
                        <div className="cons-card-hdr">
                          <h3>{label}</h3>
                          <div style={{ display: "flex", gap: 8 }}>
                            <span style={{ fontSize: 12, color: "var(--cm)" }}>{items.length} examen(s)</span>
                            <button className={`cbtn ${btnCls} cbtn-sm`}>{I.send} Envoyer au service</button>
                          </div>
                        </div>
                        <table className="cons-tbl">
                          <thead><tr><th>Examen</th><th>Priorité</th><th>Note</th><th></th></tr></thead>
                          <tbody>
                            {items.map(x => (
                              <tr key={x.id}>
                                <td style={{ fontWeight: 600, color: "var(--cn)" }}>{x.libelle}</td>
                                <td><span className={`cbdg ${x.priorite === "urgent" ? "red" : x.priorite === "semi_urgent" ? "orange" : "green"}`}>{x.priorite === "urgent" ? "🚨 Urgent" : x.priorite === "semi_urgent" ? "⚡ Semi-urgent" : "✅ Normal"}</span></td>
                                <td style={{ fontSize: 12, color: "var(--cm)" }}>{x.note || "—"}</td>
                                <td><button className="cbtn cbtn-ghost cbtn-sm" style={{ color: "var(--cr)" }} onClick={() => removeExam(x.id)}>{I.trash}</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* ══ DÉCISION ══ */}
          {section === "decision" && (
            <div className="fu">
              <div className="cons-card" style={{ marginBottom: 20 }}>
                <div className="cons-card-hdr"><h3>📌 Décision médicale</h3></div>
                <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label className="clbl req">Décision du médecin</label>
                    <div className="cons-g2-sm">
                      {[
                        ["domicile", "🏠", "Retour à domicile", "Patient stable, traitement ambulatoire", "green"],
                        ["hospitalisation", "🛏", "Hospitalisation", "Surveillance médicale nécessaire", "orange"],
                        ["specialiste", "👨‍⚕️", "Référence spécialiste", "Consultation spécialisée requise", "blue"],
                        ["urgences", "🚨", "Orientation urgences", "Prise en charge urgente nécessaire", "red"],
                      ].map(([val, icon, title, desc, col]) => (
                        <div key={val} onClick={() => setF("decision", val)}
                          style={{ border: `2px solid ${form.decision === val ? "var(--ct)" : "var(--cbr)"}`, borderRadius: 14, padding: "14px 16px", cursor: "pointer", background: form.decision === val ? "#F0FDFC" : "#F8FAFD", transition: "all .2s" }}>
                          <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--cn)" }}>{title}</div>
                          <div style={{ fontSize: 11.5, color: "var(--cm)", marginTop: 3 }}>{desc}</div>
                          {form.decision === val && <div style={{ marginTop: 8 }}><span className="cbdg teal">{I.check} Sélectionné</span></div>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {form.decision === "specialiste" && (
                    <div>
                      <label className="clbl">Service de référence</label>
                      <select className="cinp">
                        <option value="">— Sélectionner —</option>
                        {["Cardiologie", "Neurologie", "Chirurgie générale", "Gynécologie", "Pédiatrie", "Ophtalmologie", "ORL", "Dermatologie", "Orthopédie"].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  )}

                  {form.decision === "hospitalisation" && (
                    <div className="al-warn">
                      <strong style={{ color: "#92400E", fontSize: 13 }}>🛏 Ordre d'hospitalisation</strong>
                      <div style={{ fontSize: 12, color: "#B45309", marginTop: 6, display: "flex", gap: 10 }}>
                        <button className="cbtn cbtn-orange cbtn-sm">{I.hospit} Générer bon d'hospitalisation</button>
                        <button className="cbtn cbtn-ghost cbtn-sm">{I.send} Transmettre au service</button>
                      </div>
                    </div>
                  )}

                  {/* Rendez-vous */}
                  <div style={{ background: "#F8FAFD", border: "1.5px solid var(--cbr)", borderRadius: 14, padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cn)", marginBottom: 12 }}>📅 Rendez-vous de suivi</div>
                    <div className="cons-g2-sm">
                      <div>
                        <label className="clbl">Date du prochain RDV</label>
                        <input type="date" className="cinp" value={form.rdv_date} onChange={e => setF("rdv_date", e.target.value)} min={new Date().toISOString().substring(0, 10)} />
                      </div>
                      <div>
                        <label className="clbl">Motif du RDV</label>
                        <input className="cinp" value={form.rdv_note} onChange={e => setF("rdv_note", e.target.value)} placeholder="Ex: Contrôle tension, résultats labo..." />
                      </div>
                    </div>
                    {form.rdv_date && (
                      <button className="cbtn cbtn-ghost cbtn-sm" style={{ marginTop: 12 }}>{I.cal} Confirmer le rendez-vous</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ FACTURATION ══ */}
          {section === "facturation" && (
            <div className="fu">
              <div className="cons-card">
                <div className="cons-card-hdr"><h3>💰 Facturation de la consultation</h3></div>
                <div style={{ padding: 20 }}>
                  <table className="cons-tbl" style={{ marginBottom: 20 }}>
                    <thead>
                      <tr><th>Prestation</th><th style={{ textAlign: "right" }}>Montant (CFA)</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <div style={{ fontWeight: 600 }}>Consultation médicale — {form.service}</div>
                          <div style={{ fontSize: 11, color: "var(--cm)" }}>{form.medecin} · {form.type_consultation === "nouvelle_visite" ? "Nouvelle visite" : "Contrôle"}</div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <input type="number" className="cinp" value={form.frais_consultation} onChange={e => setF("frais_consultation", parseInt(e.target.value) || 0)} style={{ width: 140, textAlign: "right" }} />
                        </td>
                      </tr>
                      {form.examens.map(x => (
                        <tr key={x.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{x.libelle}</div>
                            <div style={{ fontSize: 11, color: "var(--cm)" }}>{x.type === "biologie" ? "Analyses biologiques" : x.type === "imagerie" ? "Imagerie" : x.type === "scanner" ? "Scanner/IRM" : "Examen"}</div>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>
                            {(x.type === "biologie" ? 5000 : x.type === "imagerie" ? 25000 : x.type === "scanner" ? 75000 : 15000).toLocaleString("fr-FR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "linear-gradient(to right,#EEF4FF,#DBEAFE)" }}>
                        <td style={{ fontWeight: 800, fontSize: 15, color: "var(--cn)", padding: "14px" }}>TOTAL À PAYER</td>
                        <td style={{ textAlign: "right", fontWeight: 800, fontSize: 18, color: "var(--cb)", padding: "14px" }}>
                          {totalFacture.toLocaleString("fr-FR")} <span style={{ fontSize: 12 }}>CFA</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  <div className="cons-g2" style={{ marginBottom: 20 }}>
                    <div>
                      <label className="clbl req">Statut de paiement</label>
                      <select className="cinp" value={form.statut_paiement} onChange={e => setF("statut_paiement", e.target.value)}>
                        <option value="non_paye">❌ Non payé</option>
                        <option value="partiel">⚠ Partiellement payé</option>
                        <option value="paye">✅ Payé intégralement</option>
                        <option value="assurance">🏥 Prise en charge assurance</option>
                        <option value="exonere">🆓 Exonéré</option>
                      </select>
                    </div>
                    <div>
                      <label className="clbl">Mode de paiement</label>
                      <select className="cinp">
                        <option value="especes">💵 Espèces</option>
                        <option value="mobile">📱 Mobile money</option>
                        <option value="virement">🏦 Virement bancaire</option>
                        <option value="assurance">🏥 Assurance maladie</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button className="cbtn cbtn-teal">{I.dl} Générer la facture officielle</button>
                    <button className="cbtn cbtn-ghost">{I.print} Imprimer reçu</button>
                    <button className="cbtn cbtn-ghost">{I.send} Envoyer au patient</button>
                  </div>

                  {form.statut_paiement === "paye" && (
                    <div className="al-success" style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--cg)" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="9 12 12 15 16 9"/></svg>
                      <strong style={{ color: "#065F46", fontSize: 13 }}>✅ Paiement enregistré — {totalFacture.toLocaleString("fr-FR")} CFA</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Prev/Next */}
          <div className="cons-actions" style={{ display: "flex", justifyContent: "space-between", marginTop: 24, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {currentIdx > 0 && (
                <button className="cbtn cbtn-ghost" onClick={prevStep}>← Précédent</button>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="cbtn cbtn-ghost" disabled={saving} onClick={handleSave}>
                {I.save} Enregistrer
              </button>
              {currentIdx < stepOrder.length - 1 ? (
                <button className="cbtn cbtn-teal" onClick={nextStep}>
                  Suivant →
                </button>
              ) : (
                <button className="cbtn cbtn-primary" onClick={handleSave} disabled={saving}>
                  {I.check} Finaliser la consultation
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ═══ MODAL : SÉLECTIONNER PATIENT ═══ */}
        <Modal open={modalPatient} onClose={() => setModalPatient(false)} title="👤 Sélectionner un patient" maxWidth={560}>
          <div style={{ marginBottom: 14 }}>
            <input
              className="cinp"
              placeholder="🔍 Rechercher par nom, prénom, numéro dossier..."
              value={patientSearch}
              onChange={e => setPatientSearch(e.target.value)}
              autoFocus
            />
          </div>
          {patientLoading ? (
            <div style={{ textAlign: "center", color: "var(--cm)", padding: 24 }}>Chargement…</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 380, overflowY: "auto" }}>
              {patients
                .filter(p => {
                  const q = patientSearch.toLowerCase();
                  return !q || `${p.prenom} ${p.nom} ${p.numero_dossier}`.toLowerCase().includes(q);
                })
                .map(p => {
                  const a = ageCalc(p.date_naissance);
                  const allergies = Array.isArray(p.allergies) ? p.allergies.join(', ') : p.allergies;
                  return (
                    <div key={p._id} onClick={() => selectPatient(p)}
                      style={{ border: "1.5px solid var(--cbr)", borderRadius: 14, padding: "14px 16px", cursor: "pointer", transition: "all .2s", display: "flex", alignItems: "center", gap: 14 }}
                      onMouseOver={e => e.currentTarget.style.borderColor = "var(--ct)"}
                      onMouseOut={e => e.currentTarget.style.borderColor = "var(--cbr)"}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: p.sexe === "F" ? "#FDF2F8" : "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                        {p.sexe === "F" ? "👩" : "👨"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: "var(--cn)", fontSize: 14 }}>{p.prenom} {p.nom}</div>
                        <div style={{ fontSize: 12, color: "var(--cm)", marginTop: 2 }}>
                          {a ? `${a} ans` : "—"} · {p.groupe_sanguin || "Gr. ?"} · {p.numero_dossier}
                        </div>
                        {allergies && <div style={{ fontSize: 11, color: "var(--cr)", marginTop: 2 }}>⚠ {allergies}</div>}
                      </div>
                      <button className="cbtn cbtn-teal cbtn-sm">Sélectionner →</button>
                    </div>
                  );
                })}
              {patients.filter(p => {
                const q = patientSearch.toLowerCase();
                return !q || `${p.prenom} ${p.nom} ${p.numero_dossier}`.toLowerCase().includes(q);
              }).length === 0 && (
                <div style={{ textAlign: "center", color: "var(--cm)", padding: 24 }}>Aucun patient trouvé</div>
              )}
            </div>
          )}
        </Modal>

        {/* ═══ MODAL : PRESCRIPTION ═══ */}
        <Modal open={modalRx} onClose={() => setModalRx(false)} title="💊 Ajouter un médicament" maxWidth={500}>
          <form onSubmit={addRx}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="clbl req">Médicament *</label>
                <input className="cinp" list="med-list" required value={formRx.medicament} onChange={e => setFormRx(f => ({ ...f, medicament: e.target.value }))} placeholder="Ex: Paracétamol 500mg, Amoxicilline 500mg..." />
                <datalist id="med-list">
                  {MEDICAMENTS_COURANTS.map(m => <option key={m} value={m} />)}
                </datalist>
              </div>
              <div>
                <label className="clbl req">Posologie *</label>
                <input className="cinp" required value={formRx.posologie} onChange={e => setFormRx(f => ({ ...f, posologie: e.target.value }))} placeholder="Ex: 1 comprimé × 3/j pendant les repas" />
              </div>
              <div>
                <label className="clbl">Durée du traitement</label>
                <input className="cinp" value={formRx.duree} onChange={e => setFormRx(f => ({ ...f, duree: e.target.value }))} placeholder="Ex: 7 jours, 1 mois, jusqu'à amélioration" />
              </div>
              <div>
                <label className="clbl">Conseils / Instructions</label>
                <textarea className="cinp" rows={2} value={formRx.conseils} onChange={e => setFormRx(f => ({ ...f, conseils: e.target.value }))} placeholder="Prendre avec de l'eau, éviter l'alcool, à jeun..." />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="cbtn cbtn-ghost" onClick={() => setModalRx(false)}>Annuler</button>
                <button type="submit" className="cbtn cbtn-teal" style={{ marginLeft: "auto" }}>{I.plus} Ajouter à l'ordonnance</button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : EXAMEN ═══ */}
        <Modal open={modalExam} onClose={() => setModalExam(false)} title="🔬 Demande d'examen" maxWidth={460}>
          <form onSubmit={addExam}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="clbl">Type d'examen</label>
                <select className="cinp" value={formExam.type} onChange={e => setFormExam(f => ({ ...f, type: e.target.value }))}>
                  <option value="biologie">🩸 Analyse biologique</option>
                  <option value="imagerie">🩻 Imagerie médicale</option>
                  <option value="scanner">🖥️ Scanner / IRM</option>
                  <option value="autre">📋 Autre examen</option>
                </select>
              </div>
              <div>
                <label className="clbl req">Examen demandé *</label>
                <input className="cinp" required value={formExam.libelle} onChange={e => setFormExam(f => ({ ...f, libelle: e.target.value }))} placeholder="Ex: NFS complète, Échographie abdominale..." />
              </div>
              <div>
                <label className="clbl">Priorité</label>
                <select className="cinp" value={formExam.priorite} onChange={e => setFormExam(f => ({ ...f, priorite: e.target.value }))}>
                  <option value="normal">✅ Normal</option>
                  <option value="semi_urgent">⚡ Semi-urgent</option>
                  <option value="urgent">🚨 Urgent</option>
                </select>
              </div>
              <div>
                <label className="clbl">Indication clinique</label>
                <textarea className="cinp" rows={2} value={formExam.note} onChange={e => setFormExam(f => ({ ...f, note: e.target.value }))} placeholder="Pourquoi cet examen est demandé..." />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="cbtn cbtn-ghost" onClick={() => setModalExam(false)}>Annuler</button>
                <button type="submit" className="cbtn cbtn-primary" style={{ marginLeft: "auto" }}>{I.plus} Prescrire</button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : ORDONNANCE ═══ */}
        <Modal open={modalOrd} onClose={() => setModalOrd(false)} title="📄 Ordonnance médicale" maxWidth={580}>
          <div className="ordonnance">
            <div className="ordonnance-hdr">
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--cn)", letterSpacing: -.3 }}>CLINIQUE CANADIENNE DE SOUANKÉ</div>
              <div style={{ fontSize: 11, color: "var(--cm)", marginTop: 3 }}>Médecine · Chirurgie · Gynécologie · Pédiatrie</div>
              <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span>{form.medecin} — {form.service}</span>
                <span style={{ fontFamily: "monospace" }}>{form.numero}</span>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cn)" }}>Patient : {form.patient_prenom} {form.patient_nom}</div>
              <div style={{ fontSize: 11.5, color: "var(--cm)", marginTop: 2 }}>
                {age ? `${age} ans` : "—"} · {form.patient_sexe === "femme" ? "F" : "M"} · {form.patient_groupe_sanguin || "Gr. ?"}
                {" · "}{fmtDate(form.date_heure)}
              </div>
              {form.diagnostic_principal && <div style={{ fontSize: 12, marginTop: 6, color: "var(--cn)" }}>Diagnostic : <em>{form.diagnostic_principal}</em></div>}
            </div>
            <div style={{ borderTop: "1px dashed var(--cbr)", paddingTop: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cn)", marginBottom: 10 }}>Rp</div>
              {form.prescriptions.length === 0 ? (
                <div style={{ color: "var(--cm)", fontSize: 13, fontStyle: "italic" }}>Aucune prescription</div>
              ) : form.prescriptions.map((rx, i) => (
                <div key={rx.id} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--cn)" }}>{i + 1}. {rx.medicament}</div>
                  <div style={{ fontSize: 12, color: "var(--cm)", marginLeft: 16 }}>
                    {rx.posologie}{rx.duree && ` — Pendant ${rx.duree}`}
                  </div>
                  {rx.conseils && <div style={{ fontSize: 11, color: "#6B7280", marginLeft: 16, fontStyle: "italic" }}>{rx.conseils}</div>}
                </div>
              ))}
            </div>
            {form.rdv_date && (
              <div style={{ background: "#F0FDFC", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--ct)" }}>
                📅 Prochain rendez-vous : {fmtDate(form.rdv_date)}{form.rdv_note && ` — ${form.rdv_note}`}
              </div>
            )}
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--cbr)", paddingTop: 14 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 120, height: 1, background: "var(--cn)", margin: "0 auto 4px" }} />
                <div style={{ fontSize: 11, color: "var(--cm)" }}>Signature & cachet du médecin</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "center" }}>
            <button className="cbtn cbtn-teal" onClick={() => window.print()}>{I.print} Imprimer l'ordonnance</button>
            <button className="cbtn cbtn-ghost">{I.dl} Télécharger PDF</button>
          </div>
        </Modal>

      </div>
    </>
  );
}