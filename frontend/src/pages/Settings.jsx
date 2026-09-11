import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import toast from "react-hot-toast";
import { Settings as SettingsIcon } from 'lucide-react';
import Hero from '../components/UI/Hero';
import { useAuth } from '../contexts/AuthContext';

// ─── CSS Medical Navy + Teal ──────────────────────────────────
// Palette locale supprimée (alignée sur les tokens globaux de
// index.css depuis T4.1) — toutes les règles ci-dessous consomment
// directement var(--ink)/--primary/--accent/etc. Page à layout
// sidebar (comme Archive.jsx), pas bandeau+onglets : .set-sidebar-hdr
// (en-tête propre à la sidebar) retiré — mort, remplacé par le
// <Hero> partagé placé au-dessus de .set-wrap (T4.3), confirmé par
// recherche exhaustive dans le JSX avant suppression. .set-sidebar/
// .set-wrap/.set-content restent vivants et inchangés. Toutes les
// autres keyframes (setP, skelAnim, savedP, fadeUp) conservées :
// aucune n'était liée à .set-sidebar-hdr.
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.set * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
.set-wrap { display:flex; min-height:100vh; }
.set-sidebar { width:260px; flex-shrink:0; background:#fff; border-right:1.5px solid var(--border); position:sticky; top:0; max-height:100vh; overflow-y:auto; box-shadow:var(--shadow); }
.set-sidebar::-webkit-scrollbar { width:4px; }
.set-sidebar::-webkit-scrollbar-thumb { background:var(--border); border-radius:99px; }
.set-nav-group { padding:10px 10px 4px; }
.set-nav-group-label { font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.8px; padding:6px 10px 4px; display:block; }
.set-nav-item { display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:10px; font-size:12.5px; font-weight:500; color:var(--muted); cursor:pointer; border:none; background:none; width:100%; text-align:left; font-family:'Poppins',sans-serif; transition:all .2s; margin-bottom:2px; }
.set-nav-item:hover { background:var(--tint); color:var(--ink); }
.set-nav-item.active { background:linear-gradient(135deg,var(--primary),var(--primary-dark)); color:#fff; box-shadow:0 4px 12px rgba(27,79,158,.25); }
.set-nav-item.active .set-nav-badge { background:rgba(255,255,255,.2); color:#fff; }
.set-nav-badge { margin-left:auto; background:var(--tint); color:var(--primary); font-size:10px; font-weight:700; padding:2px 7px; border-radius:99px; }
.set-nav-badge.warn { background:#FEF3C7; color:var(--warning); }
.set-nav-badge.danger { background:#FEE2E2; color:var(--danger); animation:setP 2s infinite; }
@keyframes setP { 0%,100%{opacity:1} 50%{opacity:.5} }
.set-content { flex:1; min-width:0; padding:28px; background:var(--surface); }
.set-section-top { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:24px; }
.set-section-title { font-size:20px; font-weight:700; color:var(--ink); }
.set-section-sub { font-size:13px; color:var(--muted); margin-top:3px; }
.set-card { background:#fff; border:1.5px solid var(--border); border-radius:18px; box-shadow:var(--shadow); overflow:hidden; margin-bottom:20px; transition:box-shadow .2s; }
.set-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--border); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.set-card-hdr h3 { font-size:14px; font-weight:700; color:var(--ink); margin:0; display:flex; align-items:center; gap:8px; }
.set-card-hdr p { font-size:11px; color:var(--muted); margin:2px 0 0; }
.set-card-body { padding:20px; }
.slbl { font-size:12px; font-weight:600; color:var(--muted); margin-bottom:6px; display:block; }
.sinp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--border); background:#FAFBFF; font-size:13px; color:var(--ink); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.sinp:focus { border-color:var(--accent); box-shadow:0 0 0 3px rgba(14,165,160,.12); }
.sinp:disabled { background:#F3F4F6; color:#9CA3AF; cursor:not-allowed; }
.sinp-area { resize:vertical; min-height:80px; }
.sbtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; }
.sbtn-primary { background:var(--primary); color:#fff; } .sbtn-primary:hover { background:var(--primary-dark); transform:translateY(-1px); }
.sbtn-teal    { background:var(--accent); color:#fff; } .sbtn-teal:hover    { background:var(--accent-dark); transform:translateY(-1px); }
.sbtn-ghost   { background:transparent; color:var(--muted); border:1.5px solid var(--border); }
.sbtn-ghost:hover { background:var(--tint); color:var(--ink); }
.sbtn-danger  { background:#FEF2F2; color:var(--danger); border:1.5px solid #FECACA; }
.sbtn-danger:hover { background:var(--danger); color:#fff; }
.sbtn-success { background:#ECFDF5; color:var(--success); border:1.5px solid #A7F3D0; }
.sbtn-sm { padding:6px 12px; font-size:12px; }
.sbtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }
.sbdg { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; }
.sbdg.red    { background:#FEF2F2; color:var(--danger); border:1px solid #FECACA; }
.sbdg.orange { background:#FFF7ED; color:var(--warning); border:1px solid #FED7AA; }
.sbdg.green  { background:#ECFDF5; color:var(--success); border:1px solid #A7F3D0; }
.sbdg.blue   { background:#EFF6FF; color:var(--primary); border:1px solid #BFDBFE; }
.sbdg.teal   { background:#F0FDFC; color:var(--accent); border:1px solid #99F6E4; }
.sbdg.purple { background:#F5F3FF; color:var(--tertiary); border:1px solid #DDD6FE; }
.sbdg.gray   { background:#F9FAFB; color:#4B5563;   border:1px solid #E5E7EB; }
.al-info   { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; border-left:4px solid var(--primary); border-radius:14px; padding:14px 18px; margin-bottom:16px; }
.al-warn   { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--warning); border-radius:14px; padding:14px 18px; margin-bottom:16px; }
.al-danger { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--danger); border-radius:14px; padding:14px 18px; margin-bottom:16px; }
.toggle-wrap { display:flex; align-items:center; gap:10px; }
.toggle { position:relative; width:44px; height:24px; cursor:pointer; }
.toggle input { opacity:0; width:0; height:0; position:absolute; }
.toggle-slider { position:absolute; inset:0; background:#D1D5DB; border-radius:99px; transition:background .25s; }
.toggle-slider::before { content:''; position:absolute; width:18px; height:18px; left:3px; top:3px; background:white; border-radius:50%; transition:transform .25s; box-shadow:0 1px 3px rgba(0,0,0,.2); }
.toggle input:checked + .toggle-slider { background:var(--accent); }
.toggle input:checked + .toggle-slider::before { transform:translateX(20px); }
.toggle-lbl { font-size:13px; font-weight:500; color:var(--ink); }
.set-tbl { width:100%; border-collapse:collapse; }
.set-tbl thead tr { background:linear-gradient(to right,var(--surface),var(--tint)); }
.set-tbl th { padding:10px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--border); white-space:nowrap; }
.set-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.set-tbl tbody tr:last-child td { border-bottom:none; }
.set-tbl tbody tr:hover { background:#F8FAFF; }
.perm-grid { display:grid; grid-template-columns:150px repeat(7,1fr); gap:0; border:1.5px solid var(--border); border-radius:14px; overflow:hidden; }
.perm-cell.editable { cursor:pointer; }
.perm-cell.editable:hover > div { filter:brightness(0.95); }
.perm-hdr { background:linear-gradient(to right,var(--surface),var(--tint)); padding:10px 14px; font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.5px; border-bottom:1.5px solid var(--border); text-align:center; }
.perm-hdr:first-child { text-align:left; }
.perm-row { display:contents; }
.perm-cell { padding:10px 14px; border-bottom:1px solid #F3F7FF; display:flex; align-items:center; justify-content:center; font-size:12px; }
.perm-cell:first-child { justify-content:flex-start; font-weight:600; color:var(--ink); }
.perm-row:last-child .perm-cell { border-bottom:none; }
.perm-row:hover .perm-cell { background:#F8FAFF; }
.upload-zone { border:2px dashed var(--border); border-radius:12px; padding:24px; text-align:center; cursor:pointer; transition:all .2s; background:var(--surface); }
.upload-zone:hover { border-color:var(--accent); background:#F0FDFC; }
.color-swatch { width:36px; height:36px; border-radius:8px; border:2px solid var(--border); cursor:pointer; transition:transform .2s; overflow:hidden; }
.color-swatch:hover { transform:scale(1.1); border-color:var(--accent); }
.color-swatch input[type=color] { width:140%; height:140%; margin:-20%; border:none; cursor:pointer; padding:0; }
.avatar-zone { width:96px; height:96px; border-radius:20px; border:2px dashed var(--border); display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; transition:all .2s; background:var(--surface); font-size:11px; color:var(--muted); text-align:center; gap:6px; }
.avatar-zone:hover { border-color:var(--accent); background:#F0FDFC; }
.sec-div { font-size:12px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.6px; margin:20px 0 12px; padding-bottom:6px; border-bottom:2px solid var(--border); display:flex; align-items:center; gap:8px; }
.set-prog { background:var(--tint); border-radius:99px; height:6px; overflow:hidden; }
.set-prog-f { height:100%; border-radius:99px; transition:width .5s; }
/* Skeleton loader */
.skel { background:linear-gradient(90deg,var(--tint) 25%,#DBEAFE 50%,var(--tint) 75%); background-size:200% 100%; animation:skelAnim 1.5s infinite; border-radius:8px; }
@keyframes skelAnim { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
/* Saved indicator */
.saved-dot { width:8px; height:8px; border-radius:50%; background:var(--success); display:inline-block; margin-left:6px; animation:savedP .4s ease; }
@keyframes savedP { from{transform:scale(0)} to{transform:scale(1)} }
@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
.fu { animation:fadeUp .3s ease both; }
@media print { .set-sidebar,.sbtn { display:none!important; } }
@media (max-width:900px) { .set-wrap { flex-direction:column; } .set-sidebar { width:100%; max-height:none; position:relative; } .perm-grid { overflow-x:auto; } }
`;

// ─── SVG Icons ──────────────────────────────────────────────
const I = {
  clinic:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  config:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  users:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  role:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  medical:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  consult:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  lab:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5h0c-1.4 0-2.5-1.1-2.5-2.5V2"/><path d="M8.5 2h7"/></svg>,
  scan:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>,
  bed:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16M2 8h18a2 2 0 012 2v10M2 16h20"/></svg>,
  surgery:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78"/></svg>,
  pill:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20H4a2 2 0 01-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 011.66.9l.82 1.2a2 2 0 001.66.9H20a2 2 0 012 2v2"/><circle cx="17" cy="17" r="5"/><path d="M14 17h6"/></svg>,
  money:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  insure:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  notif:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  backup:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
  audit:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  api:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  palette:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>,
  save:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  plus:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
  edit:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  upload:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  check:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  lock:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  globe:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  key:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  refresh:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
};

// ─── Toggle ─────────────────────────────────────────────────
function Toggle({ checked, onChange, label, disabled }) {
  return (
    <div className="toggle-wrap">
      <label className="toggle">
        <input type="checkbox" checked={!!checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
        <span className="toggle-slider" />
      </label>
      {label && <span className="toggle-lbl" style={{ color: disabled ? "#9CA3AF" : undefined }}>{label}</span>}
    </div>
  );
}

function Badge({ cls, children }) { return <span className={`sbdg ${cls}`}>{children}</span>; }

// ─── Skeleton loader ─────────────────────────────────────────
function Skeleton({ rows = 5 }) {
  return (
    <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div className="skel" style={{ flex:1, height:36 }} />
          <div className="skel" style={{ width:120, height:36 }} />
          <div className="skel" style={{ width:42, height:36, borderRadius:99 }} />
        </div>
      ))}
    </div>
  );
}

// ─── Nav data ────────────────────────────────────────────────
const NAV = [
  { group:"Clinique", items:[
    { key:"clinique",    label:"Informations clinique", icon:I.clinic, groupe:"clinique" },
    { key:"general",     label:"Général",               icon:I.config, groupe:"general" },
    { key:"apparence",   label:"Apparence",             icon:I.palette, groupe:"apparence" },
  ]},
  { group:"Accès", items:[
    { key:"utilisateurs",label:"Utilisateurs",          icon:I.users },
    { key:"roles",       label:"Rôles & Permissions",   icon:I.role },
  ]},
  { group:"Services médicaux", items:[
    { key:"services",    label:"Services médicaux",     icon:I.medical, groupe:"services" },
    { key:"consultations",label:"Consultations",        icon:I.consult, groupe:"consultations" },
    { key:"laboratoire", label:"Laboratoire",           icon:I.lab, groupe:"laboratoire" },
    { key:"imagerie",    label:"Imagerie",              icon:I.scan, groupe:"imagerie" },
    { key:"hospitalisation",label:"Hospitalisation",    icon:I.bed, groupe:"hospitalisation" },
    { key:"bloc",        label:"Bloc opératoire",       icon:I.surgery, groupe:"bloc" },
    { key:"pharmacie",   label:"Pharmacie",             icon:I.pill, groupe:"pharmacie", badge:"!", badgeCls:"warn" },
  ]},
  { group:"Administration", items:[
    { key:"facturation", label:"Facturation",           icon:I.money, groupe:"facturation" },
    { key:"assurances",  label:"Assurances",            icon:I.insure, groupe:"assurances" },
    { key:"notifications",label:"Notifications",        icon:I.notif, groupe:"notifications" },
  ]},
  { group:"Système", items:[
    { key:"sauvegarde",  label:"Sauvegarde & Sécurité", icon:I.backup, groupe:"sauvegarde" },
    { key:"audit",       label:"Audit & Journaux",       icon:I.audit },
    { key:"api",         label:"Intégrations API",       icon:I.api, groupe:"api" },
  ]},
];

const GROUP_ICONS = {
  clinique:"🏥", general:"⚙️", apparence:"🎨", services:"🏥",
  consultations:"🩺", laboratoire:"🔬", imagerie:"🩻", hospitalisation:"🛏️",
  bloc:"🔪", pharmacie:"💊", facturation:"💰", assurances:"🛡️",
  notifications:"🔔", sauvegarde:"🔒", api:"🔗",
};

// ─── DEMO fallback data ───────────────────────────────────────
const DEMO_USERS = [];

// Sous-phase 5.5.b — l'ancienne constante ROLES_PERMS (codée en dur,
// divergente de celle d'Administration.jsx — ex. "Comptable" ne pouvait ni
// ajouter ni modifier ici, alors qu'Administration.jsx le lui permettait)
// est retirée : la matrice vient désormais réellement de
// GET /settings/roles-permissions, seule source de vérité, partagée avec
// Administration.jsx.
const PERM_LABELS = { lecture:"Lecture", creation:"Création", modification:"Modification", suppression:"Suppression", validation:"Validation", impression:"Impression", exportation:"Exportation" };
const ROLE_LABELS = { superadmin:"Super Admin", adminclinique:"Admin Clinique", medecin:"Médecin", infirmier:"Infirmier", sage_femme:"Sage-femme", radiologue:"Radiologue", pharmacien:"Pharmacien", laborantin:"Laborantin", comptable:"Comptable", receptionniste:"Réceptionniste" };

// Ticket 0020 — les champs "statut" ci-dessous ne sont plus lus par le rendu
// (voir AUDIT-03 plus bas : chaque carte affiche "Bientôt disponible" et un
// bouton désactivé, quelle que soit cette valeur). Corrigés ici pour ne plus
// dire "connecté" en clair dans la source alors qu'aucune de ces intégrations
// n'est réellement provisionnée (SMS patient a depuis un canal réel distinct,
// via Messages.jsx/Twilio — cette carte reste une entrée générique "Orange").
const INTEGRATIONS = [
  { nom:"SMS Gateway (Orange)",  statut:"déconnecté",  icon:"📱", desc:"Envoi SMS patients & alertes",             color:"#DC2626" },
  { nom:"WhatsApp Business API", statut:"déconnecté",  icon:"💬", desc:"Messages automatiques WhatsApp",           color:"#DC2626" },
  { nom:"Paiement Mobile Money", statut:"déconnecté",  icon:"💰", desc:"MTN Mobile Money & Airtel Money",          color:"#DC2626" },
  { nom:"Assurance CNSS",        statut:"en attente",  icon:"🏦", desc:"Liaison tiers payant CNSS Congo",          color:"#D97706" },
  { nom:"Labo externe CHL",      statut:"déconnecté",  icon:"🔬", desc:"Centre Hospitalier de Libreville",         color:"#DC2626" },
  { nom:"Radiologie externe",    statut:"déconnecté",  icon:"🩻", desc:"Centre d'imagerie partenaire",             color:"#DC2626" },
  { nom:"Ministère de la Santé", statut:"en attente",  icon:"🏛️", desc:"Système national de santé Congo",          color:"#D97706" },
  { nom:"Stripe / Paiement CB",  statut:"déconnecté",  icon:"💳", desc:"Paiement carte bancaire international",    color:"#DC2626" },
];

// T9-formulaires — SaveBtn/ParamRow déclarés au niveau module (pas dans
// Settings()) : une nouvelle identité de fonction à chaque frappe (setValues
// → re-render) démontait/remontait chaque ligne de paramètre, faisant perdre
// le focus après chaque caractère — impact maximal ici (~59 usages). L'état
// de sauvegarde (savingKey/saved/saveKey), auparavant capturé par closure,
// passe maintenant par ce petit contexte plutôt que par 59 sites d'appel à
// modifier un par un.
const SettingsSaveCtx = createContext(null);

const SaveBtn = ({ cle, type = "string" }) => {
  const { savingKey, saved, saveKey } = useContext(SettingsSaveCtx);
  return (
    <button
      className="sbtn sbtn-ghost sbtn-sm"
      disabled={savingKey === cle}
      title="Enregistrer"
      style={{ padding:"6px 10px" }}
      onClick={() => saveKey(cle, type)}
    >
      {savingKey === cle ? "..." : saved[cle] ? "✅" : I.save}
    </button>
  );
};

const ParamRow = ({ cle, label, desc, type = "string", children }) => {
  const { saved } = useContext(SettingsSaveCtx);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 0", borderBottom:"1px solid #F3F7FF" }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:"var(--ink)" }}>{label}</div>
        {desc && <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>{desc}</div>}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
        {children}
        <SaveBtn cle={cle} type={type} />
        {saved[cle] && <span className="saved-dot" />}
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ──────────────────────────────────────────
export default function Settings() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth() || {};
  const isSuperadmin = authUser?.role === 'superadmin';
  const [active, setActive]       = useState("clinique");
  const [settings, setSettings]   = useState([]);    // données brutes API
  const [values, setValues]       = useState({});    // { cle: valeur }
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => { const fn = () => setIsMobile(window.innerWidth <= 599); window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn); }, []);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [savingKey, setSavingKey] = useState(null);  // quelle clé est en cours de sauvegarde
  const [saved, setSaved]         = useState({});    // { cle: true } pour l'animation
  const [users, setUsers]         = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [insurances, setInsurances] = useState([]);
  const [loadingInsurances, setLoadingInsurances] = useState(false);
  const [logs, setLogs]           = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [services, setServices]   = useState([]);
  const [rooms, setRooms]         = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  // Sous-phase 5.5.b — Rôles & Permissions : matrice réelle, plus la
  // constante ROLES_PERMS codée en dur.
  const [permMatrix, setPermMatrix]     = useState(null);
  const [permRoles, setPermRoles]       = useState([]);
  const [permActions, setPermActions]   = useState([]);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [savingPerms, setSavingPerms]   = useState(false);
  const [permsForbidden, setPermsForbidden] = useState(false);

  // ── Chargement API /settings ──────────────────────────────
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/settings");
      const list = data.settings || data.data || data || [];
      setSettings(list);
      const v = {};
      list.forEach(s => { v[s.cle] = s.valeur; });
      setValues(v);
    } catch {
      // Fallback : valeurs par défaut si API indisponible
      setValues({
        "clinique_nom":         "Clinique Canadienne de Souanké",
        "clinique_slogan":      "Votre santé, notre priorité",
        "clinique_adresse":     "Avenue de l'Indépendance",
        "clinique_ville":       "Souanké",
        "clinique_pays":        "République du Congo",
        "clinique_telephone":   "+242 00 000 0000",
        "clinique_email":       "contact@clinique-souanke.cg",
        "clinique_siteweb":     "www.clinique-souanke.cg",
        "clinique_nif":         "CG-2024-00123",
        "clinique_description": "Établissement de santé de référence dans la région de la Sangha.",
        "general_langue":       "fr",
        "general_timezone":     "Africa/Brazzaville",
        "general_format_date":  "DD/MM/YYYY",
        "general_format_heure": "24h",
        "general_devise":       "CFA",
        "general_decimales":    "0",
        "apparence_theme":      "clair",
        "apparence_couleur":    "#1B4F9E",
        "notif_sms_actif":      true,
        "notif_email_actif":    true,
        "notif_whatsapp_actif": false,
        "notif_smtp_host":      "smtp.gmail.com",
        "notif_smtp_port":      "587",
        "notif_smtp_user":      "noreply@clinique-souanke.cg",
        "backup_auto":          true,
        "backup_frequence":     "quotidien",
        "backup_heure":         "02:00",
        "security_tfa":         false,
        "security_pwd_min":     "8",
        "security_pwd_majuscule": true,
        "security_pwd_chiffre": true,
        "security_pwd_special": false,
        "pharma_stock_alerte":  true,
        "pharma_expire_alerte": true,
        "pharma_seuil_jours":   "30",
      });
    } finally { setLoading(false); }
  }, []);

  // ── Chargement utilisateurs ───────────────────────────────
  const loadUsers = useCallback(async () => {
    if (users.length > 0) return;
    setLoadingUsers(true);
    try {
      const { data } = await api.get("/admin/users");
      setUsers(data.users || data.data || DEMO_USERS);
    } catch { setUsers(DEMO_USERS); }
    finally { setLoadingUsers(false); }
  }, [users.length]);

  // AUDIT-GLOBAL — "Réinitialisation envoyée" et "Compte désactivé"
  // affichaient un faux succès (toast seul, aucune écriture). Réutilise les
  // vrais mécanismes déjà existants : auth.controller.js::forgotPassword
  // (même endpoint que ForgotPassword.jsx) et PUT /admin/users/:id (même
  // endpoint que Administration.jsx::toggleStatut).
  const resetUserPassword = async (u) => {
    try {
      await api.post("/auth/forgot-password", { email: u.email });
      toast.success(`🔑 Email de réinitialisation envoyé à ${u.email}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "❌ Échec de l'envoi de l'email.");
    }
  };
  const desactiverCompte = async (u) => {
    if (!window.confirm(`Désactiver le compte de ${u.prenom} ${u.nom} ?`)) return;
    try {
      await api.put(`/admin/users/${u.id || u._id}`, { statut: "suspendu" });
      setUsers(prev => prev.map(x => (x.id||x._id) === (u.id||u._id) ? { ...x, statut: "inactif" } : x));
      toast.success("🔒 Compte désactivé");
    } catch (err) {
      toast.error(err?.response?.data?.message || "❌ Échec de la désactivation du compte.");
    }
  };

  // AUDIT-GLOBAL — le tableau "Assurances" affichait 5 lignes entièrement
  // fabriquées (CNSS Congo, AXA...) au lieu d'appeler l'API /admin/insurances
  // qui existe déjà réellement. "Ajouter"/"Modifier" utilisent des invites
  // de saisie plutôt qu'un formulaire modal complet — priorité donnée à une
  // action réelle plutôt qu'à une UI non testée dans le temps imparti.
  const loadInsurances = useCallback(async () => {
    if (insurances.length > 0) return;
    setLoadingInsurances(true);
    try {
      const { data } = await api.get("/admin/insurances");
      setInsurances(data.insurances || []);
    } catch { setInsurances([]); }
    finally { setLoadingInsurances(false); }
  }, [insurances.length]);

  const ajouterAssurance = async () => {
    const nom = window.prompt("Nom de la compagnie d'assurance :");
    if (!nom) return;
    const tauxStr = window.prompt("Taux de prise en charge (%) :", "80");
    const taux = Number(tauxStr);
    if (tauxStr !== null && Number.isNaN(taux)) { toast.error("Taux invalide."); return; }
    try {
      const { data } = await api.post("/admin/insurances", { nom, taux_prise_en_charge: Number.isNaN(taux) ? 80 : taux });
      setInsurances(prev => [...prev, data.insurance]);
      toast.success(`✅ Assurance ${nom} ajoutée`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "❌ Échec de la création de l'assurance.");
    }
  };

  const modifierAssurance = async (ins) => {
    const tauxStr = window.prompt(`Taux de prise en charge pour ${ins.nom} (%) :`, String(ins.taux_prise_en_charge ?? 80));
    if (tauxStr === null) return;
    const taux = Number(tauxStr);
    if (Number.isNaN(taux)) { toast.error("Taux invalide."); return; }
    try {
      const { data } = await api.put(`/admin/insurances/${ins._id}`, { taux_prise_en_charge: taux });
      setInsurances(prev => prev.map(x => x._id === ins._id ? data.insurance : x));
      toast.success(`✅ ${ins.nom} mise à jour`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "❌ Échec de la modification.");
    }
  };

  // ── Chargement logs ───────────────────────────────────────
  // SET-001 (audit du 11 sept. 2026) — appelait GET /admin/logs, une route
  // qui n'existe pas côté backend (grep exhaustif sur backend/routes/) :
  // l'onglet affichait donc toujours "aucun log" (repli sur DEMO_LOGS = []),
  // silencieusement, jamais une erreur visible. Le système réel de
  // journalisation est /audit (audit.routes.js, authorize(ADMIN) — mêmes
  // rôles que cette page Settings), déjà utilisé par le module Audit dédié
  // (menu Audit) — réutilisé ici plutôt que de fabriquer une route.
  const loadLogs = useCallback(async () => {
    if (logs.length > 0) return;
    setLoadingLogs(true);
    try {
      const { data } = await api.get("/audit?limit=50");
      setLogs(data.events || []);
    } catch { setLogs([]); }
    finally { setLoadingLogs(false); }
  }, [logs.length]);

  // ── Chargement services & salles ──────────────────────────
  const loadServicesData = useCallback(async () => {
    setLoadingServices(true);
    try {
      const [sRes, rRes] = await Promise.allSettled([
        api.get("/admin/services"),
        api.get("/admin/rooms"),
      ]);
      if (sRes.status === "fulfilled") setServices(sRes.value.data.services || sRes.value.data.data || []);
      if (rRes.status === "fulfilled") setRooms(rRes.value.data.rooms || rRes.value.data.data || []);
    } catch { /* garde les états vides */ }
    finally { setLoadingServices(false); }
  }, []);

  // Sous-phase 5.5.b — Rôles & Permissions : GET /settings/roles-permissions
  // est réservé au superadmin côté backend (authorize('superadmin')) — la
  // donnée est trop sensible pour être exposée en lecture à adminclinique,
  // même en lecture seule. Un 403 affiche donc un message d'accès restreint
  // explicite, jamais une grille vide ou trompeuse.
  const loadRolesPermissions = useCallback(async () => {
    if (permMatrix || permsForbidden) return;
    setLoadingPerms(true);
    try {
      const { data } = await api.get("/settings/roles-permissions");
      setPermMatrix(data.permissions || {});
      setPermRoles(data.roles || []);
      setPermActions(data.actions || []);
    } catch (err) {
      if (err?.response?.status === 403) setPermsForbidden(true);
    } finally {
      setLoadingPerms(false);
    }
  }, [permMatrix, permsForbidden]);

  // Édition locale (brouillon) — un seul PUT à l'enregistrement, pas un
  // appel réseau par case cochée. Réservé à isSuperadmin côté UI ; le
  // backend (authorize('superadmin')) est le vrai verrou, jamais contourné
  // par ce seul contrôle frontend.
  const togglePerm = (role, actionKey) => {
    if (!isSuperadmin) return;
    setPermMatrix(prev => ({ ...prev, [role]: { ...prev[role], [actionKey]: !prev[role]?.[actionKey] } }));
  };

  const saveRolesPermissions = async () => {
    setSavingPerms(true);
    try {
      const { data } = await api.put("/settings/roles-permissions", { permissions: permMatrix });
      setPermMatrix(data.permissions);
      toast.success("✅ Permissions enregistrées");
    } catch (err) {
      toast.error(err?.response?.data?.message || "❌ Échec de l'enregistrement des permissions.");
    } finally {
      setSavingPerms(false);
    }
  };

  useEffect(() => { loadSettings(); }, [loadSettings]);

  useEffect(() => {
    if (active === "utilisateurs") loadUsers();
    if (active === "audit")        loadLogs();
    if (active === "assurances")   loadInsurances();
    if (active === "roles")        loadRolesPermissions();
    if (["services","consultations","laboratoire","imagerie","hospitalisation","bloc"].includes(active)) loadServicesData();
  }, [active, loadUsers, loadLogs, loadInsurances, loadRolesPermissions, loadServicesData]);

  // ── get / set helpers ─────────────────────────────────────
  const val = (key, def = "") => values[key] !== undefined ? values[key] : def;
  const set = (key, v) => setValues(prev => ({ ...prev, [key]: v }));

  // ── Sauvegarde une clé ────────────────────────────────────
  const saveKey = async (cle, type = "string") => {
    setSavingKey(cle);
    try {
      await api.post("/settings", { cle, valeur: values[cle], type });
      setSaved(prev => ({ ...prev, [cle]: true }));
      toast.success(`✅ Paramètre "${cle.replace(/_/g," ")}" enregistré`);
      setTimeout(() => setSaved(prev => { const n={...prev}; delete n[cle]; return n; }), 3000);
    } catch { toast.error("Erreur lors de la sauvegarde"); }
    finally { setSavingKey(null); }
  };

  // ── Sauvegarde un groupe de clés ──────────────────────────
  const saveGroup = async (cles, groupLabel) => {
    setSaving(true);
    try {
      await Promise.all(
        cles.map(({ cle, type }) =>
          api.post("/settings", { cle, valeur: values[cle], type: type || "string" })
        )
      );
      cles.forEach(({ cle }) => setSaved(prev => ({ ...prev, [cle]: true })));
      toast.success(`✅ ${groupLabel} enregistré`);
      setTimeout(() => {
        setSaved(prev => {
          const n = {...prev};
          cles.forEach(({ cle }) => delete n[cle]);
          return n;
        });
      }, 3000);
    } catch { toast.error("Erreur lors de la sauvegarde"); }
    finally { setSaving(false); }
  };

  // ─────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"60vh", flexDirection:"column", gap:16 }}>
      <div style={{ width:48, height:48, border:"4px solid var(--tint)", borderTop:"4px solid var(--primary)", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
      <div style={{ fontSize:13, color:"var(--muted)", fontFamily:"Poppins,sans-serif" }}>Chargement des paramètres...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ─────────────────────────────────────────────────────────
  const renderSection = () => {
    switch (active) {

    // ════ CLINIQUE ════
    case "clinique": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">🏥 Informations de la clinique</div><div className="set-section-sub">Profil officiel connecté à l'API /settings (groupe : clinique)</div></div>
          <button className="sbtn sbtn-teal" disabled={saving} onClick={() => saveGroup([
            {cle:"clinique_nom"},{cle:"clinique_slogan"},{cle:"clinique_adresse"},{cle:"clinique_ville"},
            {cle:"clinique_pays"},{cle:"clinique_telephone"},{cle:"clinique_email"},{cle:"clinique_siteweb"},
            {cle:"clinique_nif"},{cle:"clinique_description"},
          ], "Informations clinique")}>
            {I.save} {saving ? "Enregistrement..." : "Tout enregistrer"}
          </button>
        </div>

        <div className="set-card">
          <div className="set-card-hdr"><h3>🖼 Logo & identité visuelle</h3></div>
          <div className="set-card-body" style={{ display:"flex", alignItems:"center", gap:24, flexWrap:"wrap" }}>
            <div className="avatar-zone">{I.upload}<span>Logo clinique</span><span style={{fontSize:10,color:"#9CA3AF"}}>PNG, SVG</span></div>
            <div style={{ flex:1, minWidth:200 }}>
              <div style={{ fontSize:13, fontWeight:600, color:"var(--ink)", marginBottom:4 }}>Logo officiel de la clinique</div>
              <div style={{ fontSize:12, color:"var(--muted)", marginBottom:12 }}>Format recommandé : PNG transparent · 512×512px minimum · Max 2 Mo</div>
              <div style={{ display:"flex", gap:8 }}>
                <button className="sbtn sbtn-primary sbtn-sm">{I.upload} Téléverser</button>
                <button className="sbtn sbtn-ghost sbtn-sm">Supprimer</button>
              </div>
            </div>
          </div>
        </div>

        <div className="set-card">
          <div className="set-card-hdr"><h3>📋 Profil de la clinique</h3></div>
          <div className="set-card-body">
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>
              {[
                ["clinique_nom",         "Nom de la clinique *",         "1/-1"],
                ["clinique_slogan",      "Slogan",                       "1/-1"],
                ["clinique_adresse",     "Adresse",                      null],
                ["clinique_ville",       "Ville",                        null],
                ["clinique_pays",        "Pays",                         null],
                ["clinique_telephone",   "Téléphone",                    null],
                ["clinique_email",       "E-mail",                       null],
                ["clinique_siteweb",     "Site web",                     null],
                ["clinique_nif",         "N° identification fiscale (NIF)",null],
              ].map(([cle, label, col]) => (
                <div key={cle} style={{ gridColumn: col || undefined }}>
                  <label className="slbl">{label}</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <input className="sinp" value={val(cle)} onChange={e => set(cle, e.target.value)} />
                    <SaveBtn cle={cle} />
                    {saved[cle] && <span className="saved-dot" style={{ alignSelf:"center" }} />}
                  </div>
                </div>
              ))}
              <div style={{ gridColumn:"1/-1" }}>
                <label className="slbl">Description</label>
                <div style={{ display:"flex", gap:8 }}>
                  <textarea className="sinp sinp-area" value={val("clinique_description")} onChange={e => set("clinique_description", e.target.value)} />
                  <SaveBtn cle="clinique_description" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="set-card">
          <div className="set-card-hdr"><h3>📄 Documents officiels</h3></div>
          <div className="set-card-body">
            {[["Licence d'exploitation","EXP-2024-CG-001","2026-12-31"],["Agrément Ministère Santé","AGR-MS-2024-042","2025-06-30"],["Certificat ISO 9001","ISO-9001-2024","2025-03-15"]].map(([nom,ref,exp])=>(
              <div key={nom} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 0", borderBottom:"1px solid #F3F7FF" }}>
                <div style={{ fontSize:24 }}>📋</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, color:"var(--ink)", fontSize:13 }}>{nom}</div>
                  <div style={{ fontSize:11, color:"var(--muted)" }}>Réf : {ref} · Expire le {exp}</div>
                </div>
                <Badge cls={new Date(exp)>new Date()?"green":"red"}>{new Date(exp)>new Date()?"✅ Valide":"❌ Expiré"}</Badge>
                <button className="sbtn sbtn-ghost sbtn-sm">{I.upload} Mettre à jour</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

    // ════ GÉNÉRAL ════
    case "general": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">⚙️ Paramètres généraux</div><div className="set-section-sub">Configuration régionale — API /settings (groupe : general)</div></div>
          <button className="sbtn sbtn-teal" disabled={saving} onClick={() => saveGroup([
            {cle:"general_langue"},{cle:"general_timezone"},{cle:"general_format_date"},
            {cle:"general_format_heure"},{cle:"general_devise"},{cle:"general_decimales"},
          ], "Paramètres généraux")}>
            {I.save} {saving?"...":"Tout enregistrer"}
          </button>
        </div>
        <div className="set-card">
          <div className="set-card-hdr"><h3>{I.globe} Configuration régionale</h3></div>
          <div className="set-card-body">
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>
              {[
                { cle:"general_langue", label:"Langue du système", opts:[["fr","🇫🇷 Français"],["en","🇬🇧 English"],["pt","🇵🇹 Português"]] },
                { cle:"general_timezone", label:"Fuseau horaire", opts:[["Africa/Brazzaville","Africa/Brazzaville (UTC+1)"],["Africa/Lagos","Africa/Lagos (UTC+1)"],["Africa/Kinshasa","Africa/Kinshasa (UTC+1)"],["Europe/Paris","Europe/Paris (UTC+2)"]] },
                { cle:"general_format_date", label:"Format de date", opts:[["DD/MM/YYYY","DD/MM/YYYY (28/05/2025)"],["MM/DD/YYYY","MM/DD/YYYY (05/28/2025)"],["YYYY-MM-DD","YYYY-MM-DD (2025-05-28)"]] },
                { cle:"general_format_heure", label:"Format d'heure", opts:[["24h","24h (14:30)"],["12h","12h (02:30 PM)"]] },
                { cle:"general_devise", label:"Devise", opts:[["CFA","CFA (Franc CFA)"],["USD","USD (Dollar américain)"],["EUR","EUR (Euro)"],["XOF","XOF (Franc CFA BCEAO)"]] },
                { cle:"general_decimales", label:"Décimales", opts:[["0","0 (1 000 CFA)"],["2","2 (1 000,00 CFA)"]] },
              ].map(({ cle, label, opts }) => (
                <div key={cle}>
                  <label className="slbl">{label}</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <select className="sinp" value={val(cle)} onChange={e => set(cle, e.target.value)}>
                      {opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <SaveBtn cle={cle} />
                    {saved[cle] && <span className="saved-dot" style={{ alignSelf:"center" }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );

    // ════ APPARENCE ════
    case "apparence": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">🎨 Apparence</div><div className="set-section-sub">Personnalisation visuelle — API /settings (groupe : apparence)</div></div>
          <button className="sbtn sbtn-teal" disabled={saving} onClick={() => saveGroup([
            {cle:"apparence_theme"},{cle:"apparence_couleur"},{cle:"apparence_mode_sombre",type:"boolean"},
          ], "Apparence")}>
            {I.save} {saving?"...":"Enregistrer"}
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
          <div className="set-card">
            <div className="set-card-hdr"><h3>{I.palette} Thème et couleurs</h3></div>
            <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:18 }}>
              <div>
                <label className="slbl">Thème de l'interface</label>
                <div style={{ display:"flex", gap:10, marginTop:6, flexWrap:"wrap" }}>
                  {[["clair","☀️ Clair"],["sombre","🌙 Sombre"],["auto","🖥 Automatique"]].map(([v,l])=>(
                    <button key={v} className={`sbtn sbtn-sm ${val("apparence_theme")===v?"sbtn-teal":"sbtn-ghost"}`}
                      onClick={() => { set("apparence_theme", v); saveKey("apparence_theme"); }}
                    >{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="slbl">Couleur principale</label>
                <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop:6 }}>
                  {[["#1B4F9E","Bleu navy"],["#0EA5A0","Teal médical"],["#059669","Vert"],["#7C3AED","Violet"],["#DC2626","Rouge"],["#D97706","Ambre"]].map(([col,lbl])=>(
                    <div key={col} title={lbl} style={{ width:36, height:36, borderRadius:10, background:col, cursor:"pointer", border:val("apparence_couleur")===col?"3px solid var(--ink)":"3px solid transparent", transition:"all .2s", transform:val("apparence_couleur")===col?"scale(1.15)":"scale(1)" }}
                      onClick={() => { set("apparence_couleur", col); saveKey("apparence_couleur"); }}
                    />
                  ))}
                  <div className="color-swatch">
                    <input type="color" value={val("apparence_couleur","#1B4F9E")} onChange={e => set("apparence_couleur", e.target.value)} onBlur={() => saveKey("apparence_couleur")} />
                  </div>
                </div>
                <div style={{ marginTop:8, fontSize:12, color:"var(--muted)" }}>
                  Sélectionnée : <strong style={{ color:val("apparence_couleur","#1B4F9E") }}>{val("apparence_couleur","#1B4F9E")}</strong>
                  {saved["apparence_couleur"] && <span className="saved-dot" />}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <Toggle
                  checked={val("apparence_mode_sombre", false)}
                  onChange={v => { set("apparence_mode_sombre", v); saveKey("apparence_mode_sombre", "boolean"); }}
                  label="Mode sombre forcé"
                />
                {saved["apparence_mode_sombre"] && <span className="saved-dot" />}
              </div>
            </div>
          </div>
          <div className="set-card">
            <div className="set-card-hdr"><h3>🖼 Images & médias</h3></div>
            <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {[["Logo de connexion","Affiché sur la page de connexion"],["Image de fond","Arrière-plan de l'interface"],["Favicon","Icône onglet navigateur"]].map(([t,d])=>(
                <div key={t}>
                  <label className="slbl">{t}</label>
                  <div className="upload-zone">
                    <div style={{ fontSize:28, marginBottom:6 }}>{I.upload}</div>
                    <div style={{ fontSize:12, fontWeight:600, color:"var(--ink)" }}>{d}</div>
                    <div style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>PNG, JPG, SVG · Max 5 Mo</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );

    // ════ UTILISATEURS ════
    case "utilisateurs": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">👥 Gestion des utilisateurs</div><div className="set-section-sub">API /admin/users — {users.length} compte(s)</div></div>
          <button className="sbtn sbtn-primary" title="Ouvre la création d'utilisateur dans le module Administration" onClick={() => navigate("/administration")}>{I.plus} Ajouter</button>
        </div>
        {loadingUsers ? <Skeleton rows={8} /> : (
          <div className="set-card">
            <div style={{ overflowX:"auto" }}>
              <table className="set-tbl">
                <thead><tr><th>Utilisateur</th><th>E-mail</th><th>Rôle</th><th>Statut</th><th>Dernière connexion</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.map(u => {
                    const roleColors = { superadmin:"purple", medecin:"teal", infirmier:"teal", pharmacien:"orange", laborantin:"green", comptable:"gray", receptionniste:"gray" };
                    const roleLabels = { superadmin:"Super Admin", medecin:"Médecin", infirmier:"Infirmier", pharmacien:"Pharmacien", laborantin:"Laborantin", comptable:"Comptable", receptionniste:"Réceptionniste" };
                    return (
                      <tr key={u.id || u._id}>
                        <td>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <div style={{ width:34, height:34, borderRadius:"50%", background:"var(--tint)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13, color:"var(--primary)", flexShrink:0 }}>
                              {(u.prenom||"?")[0]}{(u.nom||"?")[0]}
                            </div>
                            <div style={{ fontWeight:600, color:"var(--ink)", fontSize:13 }}>{u.prenom} {u.nom}</div>
                          </div>
                        </td>
                        <td style={{ fontSize:12, color:"var(--muted)" }}>{u.email}</td>
                        <td><Badge cls={roleColors[u.role]||"gray"}>{roleLabels[u.role]||u.role}</Badge></td>
                        <td><Badge cls={u.statut==="actif"?"green":"red"}>{u.statut==="actif"?"● Actif":"○ Inactif"}</Badge></td>
                        <td style={{ fontSize:12, color:"var(--muted)" }}>{u.last || u.derniere_connexion || "—"}</td>
                        <td>
                          <div style={{ display:"flex", gap:4 }}>
                            <button className="sbtn sbtn-ghost sbtn-sm" title="Modifier — ouvre la gestion complète des utilisateurs (module Administration)" onClick={() => navigate("/administration")}>{I.edit}</button>
                            <button className="sbtn sbtn-ghost sbtn-sm" onClick={() => resetUserPassword(u)}>{I.key}</button>
                            {u.role !== "superadmin" && <button className="sbtn sbtn-danger sbtn-sm" onClick={() => desactiverCompte(u)}>{I.lock}</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );

    // ════ RÔLES ════
    // Sous-phase 5.5.b — matrice réelle (GET/PUT /settings/roles-permissions),
    // seule source de vérité partagée avec Administration.jsx. Éditable
    // uniquement par un superadmin (isSuperadmin) ; le backend
    // (authorize('superadmin')) reste le vrai verrou dans tous les cas.
    case "roles": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">🛡️ Rôles & Permissions</div><div className="set-section-sub">API /settings/roles-permissions — contrôle d'accès par rôle</div></div>
          {isSuperadmin && permMatrix && (
            <button className="sbtn sbtn-teal" disabled={savingPerms} onClick={saveRolesPermissions}>
              {I.save} {savingPerms ? "..." : "Enregistrer les permissions"}
            </button>
          )}
        </div>
        <div className="al-info" style={{ fontSize:12 }}>
          <strong>ℹ️ Conseil :</strong> Les permissions sont appliquées globalement sur tous les modules.
        </div>
        {!isSuperadmin || permsForbidden ? (
          <div className="set-card" style={{ padding:40, textAlign:"center", color:"var(--muted)" }}>
            🔒 Accès restreint : la matrice des permissions n'est consultable et modifiable que par un compte Super Admin.
          </div>
        ) : loadingPerms || !permMatrix ? (
          <Skeleton rows={8} />
        ) : (
          <div className="set-card" style={{ overflowX:"auto" }}>
            <div className="perm-grid">
              {["Rôle", ...permActions.map(a => PERM_LABELS[a] || a)].map(h=>(
                <div key={h} className="perm-hdr">{h}</div>
              ))}
              {permRoles.map(role => (
                <div key={role} className="perm-row">
                  <div className="perm-cell" style={{ fontWeight:600, fontSize:12.5 }}>{ROLE_LABELS[role] || role}</div>
                  {permActions.map(a => {
                    const has = !!permMatrix[role]?.[a];
                    return (
                      <div key={a} className="perm-cell editable" onClick={() => togglePerm(role, a)} title="Cliquer pour basculer">
                        <div style={{ width:22, height:22, borderRadius:6, background:has?"#ECFDF5":"#FEF2F2", border:`1.5px solid ${has?"#A7F3D0":"#FECACA"}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {has
                            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );

    // ════ NOTIFICATIONS ════
    case "notifications": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">🔔 Notifications</div><div className="set-section-sub">SMS, E-mail et WhatsApp — API /settings (groupe : notifications)</div></div>
          <button className="sbtn sbtn-teal" disabled={saving} onClick={() => saveGroup([
            {cle:"notif_sms_actif",type:"boolean"},{cle:"notif_email_actif",type:"boolean"},
            {cle:"notif_whatsapp_actif",type:"boolean"},{cle:"notif_smtp_host"},
            {cle:"notif_smtp_port"},{cle:"notif_smtp_user"},
          ], "Notifications")}>
            {I.save} {saving?"...":"Tout enregistrer"}
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
          <div className="set-card">
            <div className="set-card-hdr"><h3>📱 Configuration SMS</h3></div>
            <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <ParamRow cle="notif_sms_actif" label="Activer les SMS" type="boolean">
                <Toggle checked={val("notif_sms_actif", false)} onChange={v => set("notif_sms_actif", v)} />
              </ParamRow>
              <div>
                <label className="slbl">Clé API SMS Gateway</label>
                <div style={{ display:"flex", gap:8 }}>
                  <input className="sinp" type="password" value={val("notif_sms_api_key","")} onChange={e => set("notif_sms_api_key", e.target.value)} placeholder="sk_live_xxxxxxxx" />
                  <SaveBtn cle="notif_sms_api_key" />
                </div>
              </div>
              <div>
                <label className="slbl">Nom expéditeur</label>
                <div style={{ display:"flex", gap:8 }}>
                  <input className="sinp" value={val("notif_sms_expediteur","CLINIQUE-CSK")} onChange={e => set("notif_sms_expediteur", e.target.value)} />
                  <SaveBtn cle="notif_sms_expediteur" />
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className="set-card" style={{ marginBottom:16 }}>
              <div className="set-card-hdr"><h3>📧 Configuration E-mail (SMTP)</h3></div>
              <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <ParamRow cle="notif_email_actif" label="Activer les e-mails" type="boolean">
                  <Toggle checked={val("notif_email_actif", false)} onChange={v => set("notif_email_actif", v)} />
                </ParamRow>
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"2fr 1fr", gap:10 }}>
                  <div>
                    <label className="slbl">Serveur SMTP</label>
                    <div style={{ display:"flex", gap:8 }}>
                      <input className="sinp" value={val("notif_smtp_host","smtp.gmail.com")} onChange={e => set("notif_smtp_host", e.target.value)} />
                      <SaveBtn cle="notif_smtp_host" />
                    </div>
                  </div>
                  <div>
                    <label className="slbl">Port</label>
                    <div style={{ display:"flex", gap:8 }}>
                      <input className="sinp" value={val("notif_smtp_port","587")} onChange={e => set("notif_smtp_port", e.target.value)} />
                      <SaveBtn cle="notif_smtp_port" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="slbl">Adresse expéditeur</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <input className="sinp" value={val("notif_smtp_user","")} onChange={e => set("notif_smtp_user", e.target.value)} />
                    <SaveBtn cle="notif_smtp_user" />
                  </div>
                </div>
                <div>
                  <label className="slbl">Mot de passe SMTP</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <input className="sinp" type="password" value={val("notif_smtp_pwd","")} onChange={e => set("notif_smtp_pwd", e.target.value)} placeholder="••••••••" />
                    <SaveBtn cle="notif_smtp_pwd" />
                  </div>
                </div>
                {/* SET-002 (audit du 11 sept. 2026) — POST /settings/test-smtp
                    n'existe pas côté backend (grep exhaustif) : ce bouton
                    affichait donc systématiquement "Échec de la connexion
                    SMTP", quelle que soit la configuration réelle du serveur
                    mail — un faux diagnostic, jamais un vrai test. Désactivé
                    honnêtement plutôt que de fabriquer une route, ou pire, de
                    tester le service mail réel (utils/mail.js) sous couvert
                    de "tester" les 4 champs ci-dessus : ces champs sont
                    enregistrés dans Setting mais jamais lus par
                    utils/mail.js::getTransporter(), qui utilise exclusivement
                    les variables d'environnement du serveur (SMTP_HOST/
                    SMTP_PORT/SMTP_USER/SMTP_PASS) — un "test réussi" ici
                    validerait donc la config serveur, pas la saisie de
                    l'admin. Voir NEW-001 du rapport final. */}
                <button className="sbtn sbtn-ghost sbtn-sm" style={{ alignSelf:"flex-start" }} disabled
                  title="Fonctionnalité indisponible : aucune route backend de test SMTP n'existe, et ces champs ne pilotent pas encore l'envoi réel (voir la note ci-dessus).">
                  Tester la connexion SMTP
                </button>
                <p style={{ fontSize:11, color:"var(--muted)", margin:0 }}>
                  ℹ️ Ces valeurs sont enregistrées mais ne pilotent pas encore l'envoi réel des emails — celui-ci est actuellement configuré via les variables d'environnement du serveur.
                </p>
              </div>
            </div>
            <div className="set-card">
              <div className="set-card-hdr"><h3>💬 WhatsApp Business</h3></div>
              <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <ParamRow cle="notif_whatsapp_actif" label="Activer WhatsApp" type="boolean">
                  <Toggle checked={val("notif_whatsapp_actif", false)} onChange={v => set("notif_whatsapp_actif", v)} />
                </ParamRow>
                <div>
                  <label className="slbl">Token API WhatsApp</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <input className="sinp" type="password" value={val("notif_whatsapp_token","")} onChange={e => set("notif_whatsapp_token", e.target.value)} placeholder="EAAxxxxxxx..." />
                    <SaveBtn cle="notif_whatsapp_token" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );

    // ════ SAUVEGARDE & SÉCURITÉ ════
    case "sauvegarde": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">🔒 Sauvegarde & Sécurité</div><div className="set-section-sub">API /settings (groupe : sauvegarde) + /admin/backup</div></div>
          <button className="sbtn sbtn-teal" disabled={saving} onClick={() => saveGroup([
            {cle:"backup_auto",type:"boolean"},{cle:"backup_frequence"},{cle:"backup_heure"},
            {cle:"security_tfa",type:"boolean"},{cle:"security_pwd_min",type:"number"},
            {cle:"security_pwd_majuscule",type:"boolean"},{cle:"security_pwd_chiffre",type:"boolean"},{cle:"security_pwd_special",type:"boolean"},
          ], "Sauvegarde & Sécurité")}>
            {I.save} {saving?"...":"Tout enregistrer"}
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
          <div className="set-card">
            <div className="set-card-hdr"><h3>💾 Sauvegarde automatique</h3></div>
            <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <ParamRow cle="backup_auto" label="Sauvegarde automatique" type="boolean">
                <Toggle checked={val("backup_auto", true)} onChange={v => set("backup_auto", v)} />
              </ParamRow>
              <div>
                <label className="slbl">Fréquence</label>
                <div style={{ display:"flex", gap:8 }}>
                  <select className="sinp" value={val("backup_frequence","quotidien")} onChange={e => set("backup_frequence", e.target.value)}>
                    <option value="horaire">Toutes les heures</option>
                    <option value="quotidien">Quotidienne</option>
                    <option value="hebdomadaire">Hebdomadaire</option>
                  </select>
                  <SaveBtn cle="backup_frequence" />
                </div>
              </div>
              <div>
                <label className="slbl">Heure de sauvegarde</label>
                <div style={{ display:"flex", gap:8 }}>
                  <input type="time" className="sinp" style={{ width:120 }} value={val("backup_heure","02:00")} onChange={e => set("backup_heure", e.target.value)} />
                  <SaveBtn cle="backup_heure" />
                </div>
              </div>
              <button className="sbtn sbtn-primary" onClick={async () => {
                try {
                  await api.post("/admin/backup");
                  toast.success("💾 Sauvegarde lancée avec succès");
                } catch { toast.error("Échec du lancement de la sauvegarde"); }
              }}>
                💾 Lancer une sauvegarde maintenant
              </button>
            </div>
          </div>
          <div>
            <div className="set-card" style={{ marginBottom:16 }}>
              <div className="set-card-hdr"><h3>{I.lock} Politique de mot de passe</h3></div>
              <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div>
                  <label className="slbl">Longueur minimale</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <input type="number" className="sinp" style={{ width:100 }} value={val("security_pwd_min","8")} min={6} max={32} onChange={e => set("security_pwd_min", e.target.value)} />
                    <SaveBtn cle="security_pwd_min" type="number" />
                  </div>
                </div>
                {[
                  ["security_pwd_majuscule","Exiger une majuscule"],
                  ["security_pwd_chiffre","Exiger un chiffre"],
                  ["security_pwd_special","Exiger un caractère spécial"],
                ].map(([cle,label]) => (
                  <ParamRow key={cle} cle={cle} label={label} type="boolean">
                    <Toggle checked={val(cle, false)} onChange={v => set(cle, v)} />
                  </ParamRow>
                ))}
              </div>
            </div>
            <div className="set-card">
              <div className="set-card-hdr"><h3>🔐 Sécurité avancée</h3></div>
              <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <ParamRow cle="security_tfa" label="Double authentification (2FA)" type="boolean">
                  <Toggle checked={val("security_tfa", false)} onChange={v => set("security_tfa", v)} />
                </ParamRow>
                {val("security_tfa") && (
                  <div className="al-info" style={{ fontSize:12, marginBottom:0 }}>
                    🔐 2FA activée — Les utilisateurs devront confirmer leur identité via SMS ou application.
                  </div>
                )}
                <div>
                  <label className="slbl">Délai d'expiration de session (minutes)</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <input type="number" className="sinp" style={{ width:100 }} value={val("security_session_timeout","60")} min={15} onChange={e => set("security_session_timeout", e.target.value)} />
                    <SaveBtn cle="security_session_timeout" type="number" />
                  </div>
                </div>
                <div>
                  <label className="slbl">Tentatives avant blocage</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <input type="number" className="sinp" style={{ width:100 }} value={val("security_max_attempts","5")} min={3} max={10} onChange={e => set("security_max_attempts", e.target.value)} />
                    <SaveBtn cle="security_max_attempts" type="number" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );

    // ════ PHARMACIE ════
    case "pharmacie": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">💊 Paramètres pharmacie</div><div className="set-section-sub">API /settings (groupe : pharmacie)</div></div>
          <button className="sbtn sbtn-teal" disabled={saving} onClick={() => saveGroup([
            {cle:"pharma_stock_alerte",type:"boolean"},{cle:"pharma_expire_alerte",type:"boolean"},
            {cle:"pharma_seuil_jours",type:"number"},
          ], "Pharmacie")}>
            {I.save} {saving?"...":"Enregistrer"}
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
          <div className="set-card">
            <div className="set-card-hdr"><h3>📂 Catégories de médicaments</h3></div>
            <div style={{ overflowX:"auto" }}>
              <table className="set-tbl">
                <thead><tr><th>Catégorie</th><th>Nb produits</th><th>Actif</th></tr></thead>
                <tbody>
                  {[["Antibiotiques",42],["Analgésiques",28],["Antipaludéens",15],["Antidiabétiques",18],["Antihypertenseurs",22],["Anti-inflammatoires",16],["Vitamines & compléments",30],["Antiseptiques",14]].map(([c,n])=>(
                    <tr key={c}><td style={{ fontWeight:600, fontSize:12.5 }}>{c}</td><td><Badge cls="blue">{n}</Badge></td>
                    <td>
                      <Toggle
                        checked={val(`pharma_cat_${c.toLowerCase().replace(/\s+/g,"_")}`, true)}
                        onChange={v => { set(`pharma_cat_${c.toLowerCase().replace(/\s+/g,"_")}`, v); saveKey(`pharma_cat_${c.toLowerCase().replace(/\s+/g,"_")}`, "boolean"); }}
                      />
                    </td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="set-card">
            <div className="set-card-hdr"><h3>🔔 Configuration des alertes</h3></div>
            <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:18 }}>
              <ParamRow cle="pharma_stock_alerte" label="Alerte stock faible" type="boolean">
                <Toggle checked={val("pharma_stock_alerte", true)} onChange={v => set("pharma_stock_alerte", v)} />
              </ParamRow>
              <div>
                <label className="slbl">Seuil d'alerte stock (jours)</label>
                <div style={{ display:"flex", gap:8 }}>
                  <input type="number" className="sinp" style={{ width:120 }} value={val("pharma_seuil_jours","30")} min={7} max={90} onChange={e => set("pharma_seuil_jours", e.target.value)} />
                  <SaveBtn cle="pharma_seuil_jours" type="number" />
                </div>
                <div style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>
                  Déclenche l'alerte si le stock est inférieur à {val("pharma_seuil_jours","30")} jours
                </div>
              </div>
              <ParamRow cle="pharma_expire_alerte" label="Alerte médicaments expirés" type="boolean">
                <Toggle checked={val("pharma_expire_alerte", true)} onChange={v => set("pharma_expire_alerte", v)} />
              </ParamRow>
            </div>
          </div>
        </div>
      </div>
    );

    // ════ FACTURATION ════
    case "facturation": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">💰 Paramètres financiers</div><div className="set-section-sub">API /settings (groupe : facturation)</div></div>
          <button className="sbtn sbtn-teal" disabled={saving} onClick={() => saveGroup([
            {cle:"fact_prefixe"},{cle:"fact_format"},{cle:"fact_auto_numerotation",type:"boolean"},
            {cle:"fact_tva",type:"number"},{cle:"fact_remise_max",type:"number"},{cle:"fact_delai_paiement",type:"number"},
          ], "Facturation")}>
            {I.save} {saving?"...":"Tout enregistrer"}
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
          <div className="set-card">
            <div className="set-card-hdr"><h3>🧾 Configuration facturation</h3></div>
            <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <label className="slbl">Préfixe numéro de facture</label>
                <div style={{ display:"flex", gap:8 }}>
                  <input className="sinp" style={{ width:120 }} value={val("fact_prefixe","FAC-")} onChange={e => set("fact_prefixe", e.target.value)} />
                  <SaveBtn cle="fact_prefixe" />
                </div>
              </div>
              <div>
                <label className="slbl">Format numérotation</label>
                <div style={{ display:"flex", gap:8 }}>
                  <select className="sinp" value={val("fact_format","FAC-YYYY-NNNN")} onChange={e => set("fact_format", e.target.value)}>
                    <option value="FAC-YYYY-NNNN">FAC-YYYY-NNNN (FAC-2025-0001)</option>
                    <option value="FAC-YYYYMMDD-NNN">FAC-YYYYMMDD-NNN</option>
                  </select>
                  <SaveBtn cle="fact_format" />
                </div>
              </div>
              <ParamRow cle="fact_auto_numerotation" label="Numérotation automatique" type="boolean">
                <Toggle checked={val("fact_auto_numerotation", true)} onChange={v => set("fact_auto_numerotation", v)} />
              </ParamRow>
              {[
                ["fact_tva",           "TVA (%)",                       "number", 100],
                ["fact_remise_max",    "Remise maximale autorisée (%)",  "number", 100],
                ["fact_delai_paiement","Délai de paiement (jours)",      "number", 120],
              ].map(([cle, label, type, w]) => (
                <div key={cle}>
                  <label className="slbl">{label}</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <input type="number" className="sinp" style={{ width:w }} value={val(cle, "0")} min={0} onChange={e => set(cle, e.target.value)} />
                    <SaveBtn cle={cle} type={type} />
                    {saved[cle] && <span className="saved-dot" style={{ alignSelf:"center" }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="set-card">
            <div className="set-card-hdr"><h3>💳 Modes de paiement acceptés</h3></div>
            <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {[
                ["💵","Espèces (cash)",           "fact_pay_especes",   true],
                ["💳","Carte bancaire",            "fact_pay_carte",     false],
                ["📱","MTN Mobile Money",          "fact_pay_mtn",       true],
                ["📱","Airtel Money",              "fact_pay_airtel",    true],
                ["🏦","Virement bancaire",         "fact_pay_virement",  true],
                ["🏥","Assurance / Tiers payant",  "fact_pay_assurance", true],
              ].map(([ico, nom, cle, def]) => (
                <div key={cle} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", background:"var(--surface)", borderRadius:10, border:"1.5px solid var(--border)" }}>
                  <span style={{ fontSize:20 }}>{ico}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--ink)" }}>{nom}</div>
                  </div>
                  <Toggle
                    checked={val(cle, def)}
                    onChange={v => { set(cle, v); saveKey(cle, "boolean"); }}
                  />
                  {saved[cle] && <span className="saved-dot" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );

    // ════ ASSURANCES ════
    case "assurances": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">🛡️ Assurances & tiers payants</div><div className="set-section-sub">API /admin/insurances — {insurances.length} compagnie(s)</div></div>
          <button className="sbtn sbtn-primary" onClick={ajouterAssurance}>{I.plus} Ajouter</button>
        </div>
        {loadingInsurances ? <Skeleton rows={4} /> : (
        <div className="set-card">
          <div style={{ overflowX:"auto" }}>
            <table className="set-tbl">
              <thead><tr><th>Compagnie</th><th>Contact</th><th>Prise en charge</th><th>Code</th><th>Statut</th><th></th></tr></thead>
              <tbody>
                {insurances.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign:"center", padding:20, color:"var(--muted)", fontSize:12.5 }}>Aucune assurance enregistrée.</td></tr>
                )}
                {insurances.map(ins => (
                  <tr key={ins._id}>
                    <td style={{ fontWeight:700, color:"var(--ink)", fontSize:12.5 }}>{ins.nom}</td>
                    <td style={{ fontSize:11, color:"var(--muted)" }}>{ins.contact?.email || "—"}</td>
                    <td><span style={{ fontWeight:800, fontSize:15, color:ins.taux_prise_en_charge>=75?"var(--success)":"var(--warning)" }}>{ins.taux_prise_en_charge}%</span></td>
                    <td style={{ fontFamily:"monospace", fontSize:12, color:"var(--primary)" }}>{ins.code || "—"}</td>
                    <td><Badge cls={ins.statut==="actif"?"green":"red"}>{ins.statut}</Badge></td>
                    <td><button className="sbtn sbtn-ghost sbtn-sm" onClick={() => modifierAssurance(ins)}>{I.edit}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
    );

    // ════ AUDIT ════
    case "audit": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">📋 Audit & Journaux</div><div className="set-section-sub">API /audit — Traçabilité complète</div></div>
          <div style={{ display:"flex", gap:8 }}>
            <button className="sbtn sbtn-ghost" disabled title="Fonctionnalité indisponible : aucune route backend d'export de logs n'existe pour cette page — utilisez le module Audit (menu Audit), qui dispose d'un export PDF/Excel/CSV réel.">📄 PDF</button>
            <button className="sbtn sbtn-ghost" disabled title="Fonctionnalité indisponible : aucune route backend d'export de logs n'existe pour cette page — utilisez le module Audit (menu Audit), qui dispose d'un export PDF/Excel/CSV réel.">📊 Excel</button>
            <button className="sbtn sbtn-ghost sbtn-sm" onClick={loadLogs} title="Rafraîchir">{I.refresh}</button>
          </div>
        </div>
        {loadingLogs ? <Skeleton rows={7} /> : (
          <div className="set-card">
            <div style={{ overflowX:"auto" }}>
              <table className="set-tbl">
                <thead><tr><th>Utilisateur</th><th>Module</th><th>Action</th><th>Risque</th><th>Date & Heure</th><th>Adresse IP</th></tr></thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign:"center", color:"var(--muted)", fontSize:13, padding:20 }}>Aucun événement récent.</td></tr>
                  ) : logs.map((log) => {
                    const riskConf = {
                      critique:["red","🔴"], eleve:["orange","🟠"], moyen:["orange","🟡"], faible:["gray","🟢"],
                    }[log.risque] || ["gray","•"];
                    return (
                      <tr key={log._id}>
                        <td style={{ fontWeight:600, color:"var(--ink)", fontSize:13 }}>{log.utilisateur}</td>
                        <td style={{ fontSize:12, color:"var(--muted)" }}>{log.module}</td>
                        <td style={{ fontSize:12, color:"var(--muted)" }}>{log.action} — {log.description}</td>
                        <td><Badge cls={riskConf[0]}>{riskConf[1]} {log.risque}</Badge></td>
                        <td style={{ fontSize:12, color:"var(--muted)", fontFamily:"monospace" }}>{log.date ? new Date(log.date).toLocaleString("fr-FR") : "—"}</td>
                        <td style={{ fontSize:12, fontFamily:"monospace", color:"var(--muted)" }}>{log.ip}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );

    // ════ INTÉGRATIONS API ════
    case "api": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">🔗 Intégrations API</div><div className="set-section-sub">Connexions aux services externes — fonctionnalité pas encore disponible</div></div>
          <button className="sbtn sbtn-ghost" disabled title="Fonctionnalité non disponible pour le moment">{I.plus} Nouvelle intégration</button>
        </div>
        <div className="al-info" style={{ fontSize:12 }}>
          <strong>🔗 API REST :</strong> Documentation sur <code style={{ background:"#EFF6FF", padding:"1px 6px", borderRadius:4, fontFamily:"monospace" }}>docs.clinique-souanke.cg/api</code>
        </div>
        {/* AUDIT-03 — cette section listait des intégrations comme "Connecté"
            et proposait de les configurer/déconnecter alors qu'aucun backend
            d'intégrations n'existe (les boutons appelaient /integrations, une
            route qui n'a jamais été implémentée). Neutralisé plutôt que
            construit : statut honnête, actions désactivées, aucun appel
            réseau. Voir docs/tickets si une vraie intégration est décidée. */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
          {INTEGRATIONS.map((integ, i) => (
            <div key={i} style={{ background:"#fff", border:"1.5px solid var(--border)", borderRadius:16, padding:18, boxShadow:"var(--shadow)", display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:`${integ.color}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{integ.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--ink)" }}>{integ.nom}</div>
                  <div style={{ fontSize:11, color:"var(--muted)" }}>{integ.desc}</div>
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <Badge cls="gray">○ Bientôt disponible</Badge>
                <button className="sbtn sbtn-ghost sbtn-sm" style={{ fontSize:11 }} disabled title="Fonctionnalité non disponible pour le moment">Indisponible</button>
              </div>
            </div>
          ))}
        </div>

        {/* SET-003 (audit du 11 sept. 2026) — la valeur par défaut affichée
            ("sk_live_••••••••••••••••") n'a jamais été réellement générée
            (aucun modèle/route/contrôleur de clé API n'existe nulle part
            dans le backend, grep exhaustif), et POST /settings/regenerate-key
            n'existe pas non plus : "Régénérer" échouait systématiquement.
            Même traitement honnête que le reste de cette section
            "Intégrations API" (AUDIT-03, cartes ci-dessus) plutôt que de
            fabriquer une route ou une fausse clé. */}
        <div className="set-card" style={{ marginTop:20 }}>
          <div className="set-card-hdr"><h3>{I.key} Clé API de la clinique</h3></div>
          <div className="set-card-body">
            <div className="al-info" style={{ fontSize:12, marginBottom:12 }}>
              Aucune clé API n'a encore été émise — cette fonctionnalité n'est pas disponible pour le moment.
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
              <input className="sinp" style={{ flex:1, fontFamily:"monospace", fontSize:12, letterSpacing:1 }} value="Aucune clé émise" disabled />
              <button className="sbtn sbtn-ghost" disabled title="Fonctionnalité non disponible pour le moment">📋 Copier</button>
              <button className="sbtn sbtn-danger" disabled title="Fonctionnalité non disponible pour le moment">🔄 Régénérer</button>
            </div>
            <div style={{ fontSize:11, color:"var(--muted)", marginTop:8 }}>⚠️ Ne partagez jamais votre clé API. Révoquez-la immédiatement si elle est compromise.</div>
          </div>
        </div>
      </div>
    );

    // ════ SERVICES MÉDICAUX ════
    case "services": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">🏥 Services médicaux</div><div className="set-section-sub">Activer / désactiver les services · API /admin/services</div></div>
          <button className="sbtn sbtn-primary" onClick={loadServicesData}>{I.refresh} Recharger</button>
        </div>
        {loadingServices ? <Skeleton rows={6} /> : (
          <>
            {services.length > 0 ? (
              <div className="set-card">
                <div className="set-card-hdr"><h3>🏥 Services de la clinique</h3><p>{services.length} service(s)</p></div>
                <div style={{ overflowX:"auto" }}>
                  <table className="set-tbl">
                    <thead><tr><th>Service</th><th>Responsable</th><th>Personnel</th><th>Statut</th><th>Action</th></tr></thead>
                    <tbody>
                      {services.map(s => (
                        <tr key={s._id}>
                          <td><div style={{ fontWeight:700, color:"var(--ink)", fontSize:13 }}>{s.nom}</div>{s.description&&<div style={{fontSize:11,color:"var(--muted)"}}>{s.description}</div>}</td>
                          <td style={{ fontSize:12, color:"var(--muted)" }}>{s.chef_service?.prenom} {s.chef_service?.nom || "—"}</td>
                          <td><Badge cls="blue">{s.nb_personnel || 0} agents</Badge></td>
                          <td><Badge cls={s.statut==="actif"?"green":"red"}>{s.statut==="actif"?"● Actif":"○ Fermé"}</Badge></td>
                          <td>
                            <button className="sbtn sbtn-ghost sbtn-sm" onClick={async () => {
                              const newStatut = s.statut === "actif" ? "ferme" : "actif";
                              try { await api.put(`/admin/services/${s._id}`, { statut: newStatut }); toast.success("✅ Statut mis à jour"); loadServicesData(); }
                              catch { toast.error("Erreur mise à jour"); }
                            }}>{s.statut==="actif"?"Fermer":"Activer"}</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="al-info" style={{ marginBottom:20 }}><strong>ℹ️</strong> Aucun service configuré — utilisez le bouton "Ajouter" dans la section Administration pour créer des services.</div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
              {[
                { key:"services_consultations", nom:"Consultations", icon:"🩺", col:"var(--primary)" },
                { key:"services_laboratoire",   nom:"Laboratoire",   icon:"🔬", col:"var(--success)" },
                { key:"services_imagerie",       nom:"Imagerie",      icon:"🩻", col:"var(--tertiary)" },
                { key:"services_hospitalisation",nom:"Hospitalisation",icon:"🛏️",col:"var(--warning)" },
                { key:"services_bloc",           nom:"Bloc opératoire",icon:"🔪",col:"var(--danger)" },
                { key:"services_pharmacie",      nom:"Pharmacie",     icon:"💊", col:"var(--accent)" },
              ].map(s => (
                <div key={s.key} className="set-card" style={{ borderTop:`3px solid ${s.col}` }}>
                  <div className="set-card-body" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:14 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <span style={{ fontSize:28 }}>{s.icon}</span>
                      <div>
                        <div style={{ fontWeight:700, color:"var(--ink)", fontSize:13 }}>{s.nom}</div>
                        <div style={{ fontSize:11, color:"var(--muted)" }}>Module {val(s.key, "actif") === "actif" ? "activé" : "désactivé"}</div>
                      </div>
                    </div>
                    <Toggle checked={val(s.key, true)} onChange={v => { set(s.key, v ? "actif" : "inactif"); saveKey(s.key); }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );

    // ════ CONSULTATIONS ════
    case "consultations": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">🩺 Paramètres des consultations</div><div className="set-section-sub">API /settings · groupe : consultations</div></div>
          <button className="sbtn sbtn-teal" disabled={saving} onClick={() => saveGroup([
            {cle:"consult_duree_defaut",type:"number"},{cle:"consult_delai_min",type:"number"},
            {cle:"consult_tarif_base",type:"number"},{cle:"consult_rappel_sms",type:"boolean"},
            {cle:"consult_rappel_h",type:"number"},{cle:"consult_max_jour",type:"number"},
          ], "Consultations")}>
            {I.save} {saving?"...":"Tout enregistrer"}
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
          <div className="set-card">
            <div className="set-card-hdr"><h3>⏱️ Durées & planning</h3></div>
            <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {[
                ["consult_duree_defaut","Durée par défaut (minutes)","number",30],
                ["consult_delai_min","Délai minimum entre RDV (min)","number",10],
                ["consult_max_jour","Nombre max de consultations/jour","number",20],
              ].map(([cle,label,type,def]) => (
                <div key={cle}>
                  <label className="slbl">{label}</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <input type="number" className="sinp" style={{ width:120 }} value={val(cle, def)} min={1} onChange={e => set(cle, Number(e.target.value))} />
                    <SaveBtn cle={cle} type={type} />
                    {saved[cle] && <span className="saved-dot" style={{ alignSelf:"center" }} />}
                  </div>
                </div>
              ))}
              <div>
                <div className="slbl" style={{ marginBottom:8 }}>Durées disponibles (minutes)</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {[15,20,30,45,60,90].map(d => (
                    <button key={d} className={`sbtn sbtn-sm ${val("consult_duree_defaut",30)==d?"sbtn-teal":"sbtn-ghost"}`}
                      onClick={() => { set("consult_duree_defaut", d); saveKey("consult_duree_defaut","number"); }}>
                      {d} min
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="set-card">
            <div className="set-card-hdr"><h3>💰 Tarification</h3></div>
            <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {[
                ["consult_tarif_base",      "Tarif consultation standard (CFA)", 5000],
                ["consult_tarif_specialiste","Tarif spécialiste (CFA)",           10000],
                ["consult_tarif_urgence",   "Tarif consultation urgente (CFA)",   15000],
                ["consult_tarif_suivi",     "Tarif consultation de suivi (CFA)",   3000],
              ].map(([cle,label,def]) => (
                <div key={cle}>
                  <label className="slbl">{label}</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <input type="number" className="sinp" value={val(cle, def)} min={0} step={500} onChange={e => set(cle, Number(e.target.value))} />
                    <SaveBtn cle={cle} type="number" />
                    {saved[cle] && <span className="saved-dot" style={{ alignSelf:"center" }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="set-card">
            <div className="set-card-hdr"><h3>📱 Rappels automatiques</h3></div>
            <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <ParamRow cle="consult_rappel_sms" label="Rappel SMS avant RDV" type="boolean">
                <Toggle checked={val("consult_rappel_sms", true)} onChange={v => set("consult_rappel_sms", v)} />
              </ParamRow>
              <div>
                <label className="slbl">Délai de rappel (heures avant RDV)</label>
                <div style={{ display:"flex", gap:8 }}>
                  <select className="sinp" value={val("consult_rappel_h", 24)} onChange={e => set("consult_rappel_h", Number(e.target.value))}>
                    {[2,4,6,12,24,48].map(h => <option key={h} value={h}>{h}h avant</option>)}
                  </select>
                  <SaveBtn cle="consult_rappel_h" type="number" />
                </div>
              </div>
              <ParamRow cle="consult_rappel_email" label="Rappel e-mail" type="boolean">
                <Toggle checked={val("consult_rappel_email", false)} onChange={v => set("consult_rappel_email", v)} />
              </ParamRow>
            </div>
          </div>
          <div className="set-card">
            <div className="set-card-hdr"><h3>🩺 Types de consultations</h3></div>
            <div className="set-card-body">
              {[
                ["consult_type_generale",    "💊 Consultation générale",    true],
                ["consult_type_specialiste", "🎓 Spécialiste",              true],
                ["consult_type_suivi",       "🔄 Consultation de suivi",    true],
                ["consult_type_urgence",     "🚨 Urgence",                  true],
                ["consult_type_bilan",       "📋 Bilan de santé",           false],
                ["consult_type_preventif",   "🛡️ Médecine préventive",      false],
              ].map(([cle, nom, def]) => (
                <div key={cle} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #F3F7FF" }}>
                  <span style={{ fontSize:13, color:"var(--ink)" }}>{nom}</span>
                  <Toggle checked={val(cle, def)} onChange={v => { set(cle, v); saveKey(cle, "boolean"); }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );

    // ════ LABORATOIRE ════
    case "laboratoire": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">🔬 Paramètres Laboratoire</div><div className="set-section-sub">API /settings · groupe : laboratoire</div></div>
          <button className="sbtn sbtn-teal" disabled={saving} onClick={() => saveGroup([
            {cle:"labo_delai_validation",type:"number"},{cle:"labo_alerte_critique",type:"boolean"},
            {cle:"labo_notif_patient",type:"boolean"},{cle:"labo_notif_medecin",type:"boolean"},
          ], "Laboratoire")}>
            {I.save} {saving?"...":"Tout enregistrer"}
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
          <div className="set-card">
            <div className="set-card-hdr"><h3>⚙️ Configuration générale</h3></div>
            <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label className="slbl">Délai de validation des résultats (heures)</label>
                <div style={{ display:"flex", gap:8 }}>
                  <input type="number" className="sinp" style={{ width:120 }} value={val("labo_delai_validation", 24)} min={1} max={72} onChange={e => set("labo_delai_validation", Number(e.target.value))} />
                  <SaveBtn cle="labo_delai_validation" type="number" />
                </div>
              </div>
              <div>
                <label className="slbl">Préfixe numéro d'analyse</label>
                <div style={{ display:"flex", gap:8 }}>
                  <input className="sinp" style={{ width:140 }} value={val("labo_prefixe", "LAB-")} onChange={e => set("labo_prefixe", e.target.value)} />
                  <SaveBtn cle="labo_prefixe" />
                </div>
              </div>
              <ParamRow cle="labo_alerte_critique" label="Alertes résultats critiques" type="boolean">
                <Toggle checked={val("labo_alerte_critique", true)} onChange={v => set("labo_alerte_critique", v)} />
              </ParamRow>
              <ParamRow cle="labo_notif_medecin" label="Notifier le médecin prescripteur" type="boolean">
                <Toggle checked={val("labo_notif_medecin", true)} onChange={v => set("labo_notif_medecin", v)} />
              </ParamRow>
              <ParamRow cle="labo_notif_patient" label="Notifier le patient (résultats normaux)" type="boolean">
                <Toggle checked={val("labo_notif_patient", false)} onChange={v => set("labo_notif_patient", v)} />
              </ParamRow>
              <ParamRow cle="labo_signature_auto" label="Signature électronique automatique" type="boolean">
                <Toggle checked={val("labo_signature_auto", false)} onChange={v => set("labo_signature_auto", v)} />
              </ParamRow>
            </div>
          </div>
          <div className="set-card">
            <div className="set-card-hdr"><h3>💰 Tarifs analyses</h3></div>
            <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {[
                ["labo_tarif_nfs",      "NFS (Numération Formule Sanguine)", 5000],
                ["labo_tarif_glycemie", "Glycémie",                          2500],
                ["labo_tarif_creatinine","Créatinine",                       3000],
                ["labo_tarif_bilan_hepatique","Bilan hépatique complet",    15000],
                ["labo_tarif_ionogramme","Ionogramme sanguin",               8000],
                ["labo_tarif_culture",  "Culture & antibiogramme",          12000],
              ].map(([cle, label, def]) => (
                <div key={cle}>
                  <label className="slbl">{label} (CFA)</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <input type="number" className="sinp" value={val(cle, def)} min={0} step={500} onChange={e => set(cle, Number(e.target.value))} />
                    <SaveBtn cle={cle} type="number" />
                    {saved[cle] && <span className="saved-dot" style={{ alignSelf:"center" }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="set-card" style={{ gridColumn:isMobile?"1":"1/-1" }}>
            <div className="set-card-hdr"><h3>🔬 Catégories d'analyses disponibles</h3></div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:12, padding:16 }}>
              {[
                ["labo_cat_hematologie",  "🩸 Hématologie",          true],
                ["labo_cat_biochimie",    "🧪 Biochimie",             true],
                ["labo_cat_immunologie",  "💉 Immunologie/Sérologie", true],
                ["labo_cat_microbiologie","🦠 Microbiologie",         true],
                ["labo_cat_parasitologie","🔭 Parasitologie",         true],
                ["labo_cat_hormonologie", "⚗️ Hormonologie",          false],
                ["labo_cat_toxicologie",  "☣️ Toxicologie",           false],
                ["labo_cat_cytologie",    "🔬 Cytologie",             false],
              ].map(([cle, nom, def]) => (
                <div key={cle} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:10, padding:"10px 14px" }}>
                  <span style={{ fontSize:13, fontWeight:500, color:"var(--ink)" }}>{nom}</span>
                  <Toggle checked={val(cle, def)} onChange={v => { set(cle, v); saveKey(cle, "boolean"); }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );

    // ════ IMAGERIE ════
    case "imagerie": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">🩻 Paramètres Imagerie</div><div className="set-section-sub">API /settings · groupe : imagerie</div></div>
          <button className="sbtn sbtn-teal" disabled={saving} onClick={() => saveGroup([
            {cle:"img_delai_rapport",type:"number"},{cle:"img_alerte_urgent",type:"boolean"},
            {cle:"img_notif_medecin",type:"boolean"},{cle:"img_archivage_auto",type:"boolean"},
          ], "Imagerie")}>
            {I.save} {saving?"...":"Tout enregistrer"}
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
          <div className="set-card">
            <div className="set-card-hdr"><h3>⚙️ Configuration générale</h3></div>
            <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label className="slbl">Délai standard de compte-rendu (heures)</label>
                <div style={{ display:"flex", gap:8 }}>
                  <input type="number" className="sinp" style={{ width:120 }} value={val("img_delai_rapport", 24)} min={1} max={96} onChange={e => set("img_delai_rapport", Number(e.target.value))} />
                  <SaveBtn cle="img_delai_rapport" type="number" />
                </div>
              </div>
              <div>
                <label className="slbl">Préfixe numéro examen</label>
                <div style={{ display:"flex", gap:8 }}>
                  <input className="sinp" style={{ width:140 }} value={val("img_prefixe", "IMG-")} onChange={e => set("img_prefixe", e.target.value)} />
                  <SaveBtn cle="img_prefixe" />
                </div>
              </div>
              <ParamRow cle="img_alerte_urgent" label="Alertes examens urgents" type="boolean">
                <Toggle checked={val("img_alerte_urgent", true)} onChange={v => set("img_alerte_urgent", v)} />
              </ParamRow>
              <ParamRow cle="img_notif_medecin" label="Notifier le médecin prescripteur" type="boolean">
                <Toggle checked={val("img_notif_medecin", true)} onChange={v => set("img_notif_medecin", v)} />
              </ParamRow>
              <ParamRow cle="img_archivage_auto" label="Archivage automatique DICOM (après 90j)" type="boolean">
                <Toggle checked={val("img_archivage_auto", true)} onChange={v => set("img_archivage_auto", v)} />
              </ParamRow>
              <ParamRow cle="img_rapport_pdf" label="Génération automatique PDF" type="boolean">
                <Toggle checked={val("img_rapport_pdf", true)} onChange={v => set("img_rapport_pdf", v)} />
              </ParamRow>
            </div>
          </div>
          <div className="set-card">
            <div className="set-card-hdr"><h3>💰 Tarifs examens</h3></div>
            <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {[
                ["img_tarif_radio",     "Radiographie standard",          15000],
                ["img_tarif_echo",      "Échographie abdominale",         20000],
                ["img_tarif_echo_ob",   "Échographie obstétricale",       25000],
                ["img_tarif_scanner",   "Scanner (TDM)",                  80000],
                ["img_tarif_irm",       "IRM",                           120000],
                ["img_tarif_mammographie","Mammographie",                 35000],
              ].map(([cle, label, def]) => (
                <div key={cle}>
                  <label className="slbl">{label} (CFA)</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <input type="number" className="sinp" value={val(cle, def)} min={0} step={1000} onChange={e => set(cle, Number(e.target.value))} />
                    <SaveBtn cle={cle} type="number" />
                    {saved[cle] && <span className="saved-dot" style={{ alignSelf:"center" }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="set-card" style={{ gridColumn:isMobile?"1":"1/-1" }}>
            <div className="set-card-hdr"><h3>🩻 Types d'examens disponibles</h3></div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:12, padding:16 }}>
              {[
                ["img_type_radiographie","📸 Radiographie",        true],
                ["img_type_echographie", "🔊 Échographie",         true],
                ["img_type_scanner",     "🔄 Scanner (TDM)",       false],
                ["img_type_irm",         "🧲 IRM",                 false],
                ["img_type_mammographie","🎯 Mammographie",        false],
                ["img_type_dentaire",    "🦷 Radiologie dentaire", false],
                ["img_type_doppler",     "💓 Doppler vasculaire",  false],
                ["img_type_panoramique", "📐 Panoramique dentaire",false],
              ].map(([cle, nom, def]) => (
                <div key={cle} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:10, padding:"10px 14px" }}>
                  <span style={{ fontSize:13, fontWeight:500, color:"var(--ink)" }}>{nom}</span>
                  <Toggle checked={val(cle, def)} onChange={v => { set(cle, v); saveKey(cle, "boolean"); }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );

    // ════ HOSPITALISATION ════
    case "hospitalisation": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">🛏️ Paramètres Hospitalisation</div><div className="set-section-sub">API /settings · groupe : hospitalisation</div></div>
          <button className="sbtn sbtn-teal" disabled={saving} onClick={() => saveGroup([
            {cle:"hospit_duree_max",type:"number"},{cle:"hospit_alerte_duree",type:"boolean"},
            {cle:"hospit_tarif_chambre_simple",type:"number"},{cle:"hospit_tarif_chambre_double",type:"number"},
          ], "Hospitalisation")}>
            {I.save} {saving?"...":"Tout enregistrer"}
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
          <div className="set-card">
            <div className="set-card-hdr"><h3>⚙️ Configuration</h3></div>
            <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label className="slbl">Durée maximale de séjour (jours)</label>
                <div style={{ display:"flex", gap:8 }}>
                  <input type="number" className="sinp" style={{ width:120 }} value={val("hospit_duree_max", 30)} min={1} onChange={e => set("hospit_duree_max", Number(e.target.value))} />
                  <SaveBtn cle="hospit_duree_max" type="number" />
                </div>
              </div>
              <ParamRow cle="hospit_alerte_duree" label="Alertes dépassement durée" type="boolean">
                <Toggle checked={val("hospit_alerte_duree", true)} onChange={v => set("hospit_alerte_duree", v)} />
              </ParamRow>
              <ParamRow cle="hospit_notif_famille" label="Notifier la famille à l'admission" type="boolean">
                <Toggle checked={val("hospit_notif_famille", false)} onChange={v => set("hospit_notif_famille", v)} />
              </ParamRow>
              <ParamRow cle="hospit_signature_sortie" label="Signature électronique à la sortie" type="boolean">
                <Toggle checked={val("hospit_signature_sortie", false)} onChange={v => set("hospit_signature_sortie", v)} />
              </ParamRow>
            </div>
          </div>
          <div className="set-card">
            <div className="set-card-hdr"><h3>💰 Tarifs d'hospitalisation (par nuit)</h3></div>
            <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {[
                ["hospit_tarif_chambre_simple",  "Chambre simple (CFA/nuit)",    15000],
                ["hospit_tarif_chambre_double",  "Chambre double (CFA/nuit)",    10000],
                ["hospit_tarif_chambre_vip",     "Suite VIP (CFA/nuit)",         50000],
                ["hospit_tarif_reanimation",     "Réanimation (CFA/nuit)",       80000],
                ["hospit_tarif_maternite",       "Maternité (CFA/nuit)",         20000],
                ["hospit_tarif_pediatrie",       "Pédiatrie (CFA/nuit)",         12000],
              ].map(([cle, label, def]) => (
                <div key={cle}>
                  <label className="slbl">{label}</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <input type="number" className="sinp" value={val(cle, def)} min={0} step={1000} onChange={e => set(cle, Number(e.target.value))} />
                    <SaveBtn cle={cle} type="number" />
                    {saved[cle] && <span className="saved-dot" style={{ alignSelf:"center" }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="set-card" style={{ gridColumn:isMobile?"1":"1/-1" }}>
            <div className="set-card-hdr">
              <h3>🚪 Salles & Lits</h3>
              <p>{rooms.length} salle(s) · {rooms.filter(r=>r.statut==="libre").length} libre(s) · {rooms.filter(r=>r.statut==="occupe").length} occupée(s)</p>
            </div>
            {loadingServices ? <Skeleton rows={4} /> : rooms.length > 0 ? (
              <div style={{ overflowX:"auto" }}>
                <table className="set-tbl">
                  <thead><tr><th>Salle / Chambre</th><th>Type</th><th>Capacité</th><th>Statut</th><th>Responsable</th></tr></thead>
                  <tbody>
                    {rooms.map(r => {
                      const typeIcons = { bloc_operatoire:"🔪", consultation:"🩺", hospitalisation:"🛏️", laboratoire:"🔬", urgences:"🚨", imagerie:"🩻" };
                      const etatCfg = { libre:{cls:"green",label:"Libre"}, occupe:{cls:"red",label:"Occupée"}, maintenance:{cls:"orange",label:"Maintenance"}, reserve:{cls:"blue",label:"Réservée"} }[r.statut] || {cls:"gray",label:r.statut};
                      return (
                        <tr key={r._id}>
                          <td style={{ fontWeight:700, color:"var(--ink)" }}>{typeIcons[r.type]||"🏥"} {r.numero}</td>
                          <td style={{ fontSize:12, color:"var(--muted)" }}>{r.type}</td>
                          <td><Badge cls="blue">{r.capacite} lit(s)</Badge></td>
                          <td><Badge cls={etatCfg.cls}>{etatCfg.label}</Badge></td>
                          <td style={{ fontSize:12, color:"var(--muted)" }}>{r.responsable||"—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding:24, textAlign:"center", color:"var(--muted)", fontSize:13 }}>Aucune salle configurée — créez des salles depuis le module Administration.</div>
            )}
          </div>
        </div>
      </div>
    );

    // ════ BLOC OPÉRATOIRE ════
    case "bloc": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">🔪 Paramètres Bloc opératoire</div><div className="set-section-sub">API /settings · groupe : bloc</div></div>
          <button className="sbtn sbtn-teal" disabled={saving} onClick={() => saveGroup([
            {cle:"bloc_duree_prep",type:"number"},{cle:"bloc_duree_nettoyage",type:"number"},
            {cle:"bloc_alerte_planning",type:"boolean"},{cle:"bloc_checklist_obligatoire",type:"boolean"},
          ], "Bloc opératoire")}>
            {I.save} {saving?"...":"Tout enregistrer"}
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
          <div className="set-card">
            <div className="set-card-hdr"><h3>⚙️ Configuration générale</h3></div>
            <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {[
                ["bloc_duree_prep",       "Durée de préparation salle (min)",    30],
                ["bloc_duree_nettoyage",  "Durée de nettoyage post-op (min)",    45],
                ["bloc_delai_programme",  "Délai min planification opération (h)",24],
              ].map(([cle, label, def]) => (
                <div key={cle}>
                  <label className="slbl">{label}</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <input type="number" className="sinp" style={{ width:120 }} value={val(cle, def)} min={0} onChange={e => set(cle, Number(e.target.value))} />
                    <SaveBtn cle={cle} type="number" />
                    {saved[cle] && <span className="saved-dot" style={{ alignSelf:"center" }} />}
                  </div>
                </div>
              ))}
              <ParamRow cle="bloc_alerte_planning" label="Alertes conflits de planning" type="boolean">
                <Toggle checked={val("bloc_alerte_planning", true)} onChange={v => set("bloc_alerte_planning", v)} />
              </ParamRow>
              <ParamRow cle="bloc_checklist_obligatoire" label="Checklist pré-opératoire obligatoire" type="boolean">
                <Toggle checked={val("bloc_checklist_obligatoire", true)} onChange={v => set("bloc_checklist_obligatoire", v)} />
              </ParamRow>
              <ParamRow cle="bloc_consentement_numerique" label="Consentement numérique" type="boolean">
                <Toggle checked={val("bloc_consentement_numerique", false)} onChange={v => set("bloc_consentement_numerique", v)} />
              </ParamRow>
            </div>
          </div>
          <div className="set-card">
            <div className="set-card-hdr"><h3>💰 Tarifs opératoires</h3></div>
            <div className="set-card-body" style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {[
                ["bloc_tarif_chirurgie_mineure","Chirurgie mineure (CFA)",       50000],
                ["bloc_tarif_chirurgie_majeure","Chirurgie majeure (CFA)",      200000],
                ["bloc_tarif_cesarienne",       "Césarienne (CFA)",             150000],
                ["bloc_tarif_appendicectomie",  "Appendicectomie (CFA)",        120000],
                ["bloc_tarif_anesthesie_locale","Anesthésie locale (CFA)",       15000],
                ["bloc_tarif_anesthesie_generale","Anesthésie générale (CFA)",  80000],
              ].map(([cle, label, def]) => (
                <div key={cle}>
                  <label className="slbl">{label}</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <input type="number" className="sinp" value={val(cle, def)} min={0} step={5000} onChange={e => set(cle, Number(e.target.value))} />
                    <SaveBtn cle={cle} type="number" />
                    {saved[cle] && <span className="saved-dot" style={{ alignSelf:"center" }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="set-card" style={{ gridColumn:isMobile?"1":"1/-1" }}>
            <div className="set-card-hdr"><h3>🩺 Types d'anesthésie disponibles</h3></div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:12, padding:16 }}>
              {[
                ["bloc_anesth_generale",    "😴 Anesthésie générale",      true],
                ["bloc_anesth_locale",      "💉 Anesthésie locale",         true],
                ["bloc_anesth_locoregionale","🦾 Anesthésie loco-régionale",true],
                ["bloc_anesth_rachidienne", "🦴 Rachianesthésie",           true],
                ["bloc_anesth_peridurale",  "🔗 Anesthésie péridurale",     false],
                ["bloc_anesth_sedation",    "🌙 Sédation consciente",       false],
              ].map(([cle, nom, def]) => (
                <div key={cle} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:10, padding:"10px 14px" }}>
                  <span style={{ fontSize:13, fontWeight:500, color:"var(--ink)" }}>{nom}</span>
                  <Toggle checked={val(cle, def)} onChange={v => { set(cle, v); saveKey(cle, "boolean"); }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );

    // ════ SECTIONS STATIQUES (services, consultations, etc.) ════
    default: return (
      <div className="fu">
        <div className="set-section-top">
          <div>
            <div className="set-section-title">{GROUP_ICONS[active]||"⚙️"} {NAV.flatMap(g=>g.items).find(i=>i.key===active)?.label || active}</div>
            <div className="set-section-sub">API /settings · groupe : {active}</div>
          </div>
          <button className="sbtn sbtn-teal" onClick={loadSettings}>{I.refresh} Recharger</button>
        </div>

        {/* Affichage générique des settings par groupe depuis l'API */}
        {settings.filter(s => s.groupe === active).length > 0 ? (
          <div className="set-card">
            <div className="set-card-hdr"><h3>⚙️ Paramètres — {active}</h3><p>{settings.filter(s=>s.groupe===active).length} paramètre(s)</p></div>
            <div className="set-card-body">
              {settings.filter(s => s.groupe === active).map(s => (
                <div key={s.cle} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 0", borderBottom:"1px solid #F3F7FF" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--ink)" }}>{(s.label || s.cle).replace(/_/g," ")}</div>
                    {s.description && <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>{s.description}</div>}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                    {s.type === "boolean" ? (
                      <Toggle checked={val(s.cle, false)} onChange={v => set(s.cle, v)} />
                    ) : s.type === "color" ? (
                      <input type="color" className="sinp" style={{ width:50, height:36, padding:4 }} value={val(s.cle,"#1B4F9E")} onChange={e => set(s.cle, e.target.value)} onBlur={() => saveKey(s.cle, "color")} />
                    ) : s.type === "select" && s.options ? (
                      <select className="sinp" style={{ width:200 }} value={val(s.cle,"")} onChange={e => set(s.cle, e.target.value)}>
                        {(s.options||[]).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={s.type==="number"?"number":"text"} className="sinp" style={{ width:200 }} value={val(s.cle,"")} onChange={e => set(s.cle, s.type==="number"?Number(e.target.value):e.target.value)} />
                    )}
                    <SaveBtn cle={s.cle} type={s.type||"string"} />
                    {saved[s.cle] && <span className="saved-dot" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign:"center", padding:60 }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🔧</div>
            <div style={{ fontSize:16, fontWeight:700, color:"var(--ink)" }}>Section en cours de développement</div>
            <div style={{ color:"var(--muted)", marginTop:8 }}>Les paramètres seront chargés depuis <code style={{fontFamily:"monospace",background:"var(--tint)",padding:"2px 6px",borderRadius:4}}>/settings?groupe={active}</code></div>
          </div>
        )}
      </div>
    );
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="set">
        {/* ── HERO ── */}
        <Hero
          icon={SettingsIcon}
          title="Paramètres"
          dateLabel={settings.length > 0 ? `${settings.length} paramètres chargés` : "Configuration du système"}
        />

        <div className="set-wrap">
          {/* ── SIDEBAR ── */}
          <aside className="set-sidebar">
            {NAV.map(group => (
              <div key={group.group} className="set-nav-group">
                <span className="set-nav-group-label">{group.group}</span>
                {group.items.map(item => (
                  <button key={item.key} className={`set-nav-item ${active === item.key ? "active" : ""}`} onClick={() => setActive(item.key)}>
                    <span style={{ opacity:.85, flexShrink:0 }}>{item.icon}</span>
                    <span style={{ flex:1, textAlign:"left" }}>{item.label}</span>
                    {item.badge && <span className={`set-nav-badge ${item.badgeCls||""}`}>{item.badge}</span>}
                  </button>
                ))}
              </div>
            ))}
          </aside>

          {/* ── CONTENT ── */}
          <main className="set-content">
            <SettingsSaveCtx.Provider value={{ savingKey, saved, saveKey }}>
              {renderSection()}
            </SettingsSaveCtx.Provider>
          </main>
        </div>
      </div>
    </>
  );
}