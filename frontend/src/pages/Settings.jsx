import { useState, useEffect, useCallback } from "react";
import api from "../api";
import toast from "react-hot-toast";

// ─── CSS Medical Navy + Teal ──────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.set * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --sn:#0B1E3B; --sn2:#132744; --sb:#1B4F9E;
  --st:#0EA5A0; --st2:#0D9490; --sr:#DC2626;
  --so:#D97706; --sg:#059669; --sp:#7C3AED;
  --sbr:#E2EAF4; --sm:#6B7A99; --sl:#EEF4FF; --ss:#F8FAFD;
  --sh:0 1px 3px rgba(11,30,59,.08); --shm:0 4px 16px rgba(11,30,59,.10); --shl:0 12px 40px rgba(11,30,59,.14);
}
.set-wrap { display:flex; min-height:100vh; }
.set-sidebar { width:260px; flex-shrink:0; background:#fff; border-right:1.5px solid var(--sbr); position:sticky; top:0; max-height:100vh; overflow-y:auto; box-shadow:var(--sh); }
.set-sidebar::-webkit-scrollbar { width:4px; }
.set-sidebar::-webkit-scrollbar-thumb { background:var(--sbr); border-radius:99px; }
.set-sidebar-hdr { padding:18px 20px 14px; border-bottom:1.5px solid var(--sbr); background:linear-gradient(135deg,var(--sn),var(--sn2)); position:sticky; top:0; z-index:2; }
.set-sidebar-hdr h2 { font-size:15px; font-weight:700; color:#fff; margin:0; display:flex; align-items:center; gap:8px; }
.set-sidebar-hdr p { font-size:11px; color:rgba(255,255,255,.5); margin:3px 0 0; }
.set-nav-group { padding:10px 10px 4px; }
.set-nav-group-label { font-size:10px; font-weight:700; color:var(--sm); text-transform:uppercase; letter-spacing:.8px; padding:6px 10px 4px; display:block; }
.set-nav-item { display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:10px; font-size:12.5px; font-weight:500; color:var(--sm); cursor:pointer; border:none; background:none; width:100%; text-align:left; font-family:'Poppins',sans-serif; transition:all .2s; margin-bottom:2px; }
.set-nav-item:hover { background:var(--sl); color:var(--sn); }
.set-nav-item.active { background:linear-gradient(135deg,var(--sb),#174391); color:#fff; box-shadow:0 4px 12px rgba(27,79,158,.25); }
.set-nav-item.active .set-nav-badge { background:rgba(255,255,255,.2); color:#fff; }
.set-nav-badge { margin-left:auto; background:var(--sl); color:var(--sb); font-size:10px; font-weight:700; padding:2px 7px; border-radius:99px; }
.set-nav-badge.warn { background:#FEF3C7; color:#D97706; }
.set-nav-badge.danger { background:#FEE2E2; color:#DC2626; animation:setP 2s infinite; }
@keyframes setP { 0%,100%{opacity:1} 50%{opacity:.5} }
.set-content { flex:1; min-width:0; padding:28px; background:var(--ss); }
.set-section-top { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:24px; }
.set-section-title { font-size:20px; font-weight:700; color:var(--sn); }
.set-section-sub { font-size:13px; color:var(--sm); margin-top:3px; }
.set-card { background:#fff; border:1.5px solid var(--sbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; margin-bottom:20px; transition:box-shadow .2s; }
.set-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--sbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.set-card-hdr h3 { font-size:14px; font-weight:700; color:var(--sn); margin:0; display:flex; align-items:center; gap:8px; }
.set-card-hdr p { font-size:11px; color:var(--sm); margin:2px 0 0; }
.set-card-body { padding:20px; }
.slbl { font-size:12px; font-weight:600; color:var(--sm); margin-bottom:6px; display:block; }
.sinp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--sbr); background:#FAFBFF; font-size:13px; color:var(--sn); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.sinp:focus { border-color:var(--st); box-shadow:0 0 0 3px rgba(14,165,160,.12); }
.sinp:disabled { background:#F3F4F6; color:#9CA3AF; cursor:not-allowed; }
.sinp-area { resize:vertical; min-height:80px; }
.sbtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; }
.sbtn-primary { background:var(--sb); color:#fff; } .sbtn-primary:hover { background:#174391; transform:translateY(-1px); }
.sbtn-teal    { background:var(--st); color:#fff; } .sbtn-teal:hover    { background:var(--st2); transform:translateY(-1px); }
.sbtn-ghost   { background:transparent; color:var(--sm); border:1.5px solid var(--sbr); }
.sbtn-ghost:hover { background:var(--sl); color:var(--sn); }
.sbtn-danger  { background:#FEF2F2; color:var(--sr); border:1.5px solid #FECACA; }
.sbtn-danger:hover { background:var(--sr); color:#fff; }
.sbtn-success { background:#ECFDF5; color:var(--sg); border:1.5px solid #A7F3D0; }
.sbtn-sm { padding:6px 12px; font-size:12px; }
.sbtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }
.sbdg { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; }
.sbdg.red    { background:#FEF2F2; color:var(--sr); border:1px solid #FECACA; }
.sbdg.orange { background:#FFF7ED; color:var(--so); border:1px solid #FED7AA; }
.sbdg.green  { background:#ECFDF5; color:var(--sg); border:1px solid #A7F3D0; }
.sbdg.blue   { background:#EFF6FF; color:var(--sb); border:1px solid #BFDBFE; }
.sbdg.teal   { background:#F0FDFC; color:var(--st); border:1px solid #99F6E4; }
.sbdg.purple { background:#F5F3FF; color:var(--sp); border:1px solid #DDD6FE; }
.sbdg.gray   { background:#F9FAFB; color:#4B5563;   border:1px solid #E5E7EB; }
.al-info   { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; border-left:4px solid var(--sb); border-radius:14px; padding:14px 18px; margin-bottom:16px; }
.al-warn   { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--so); border-radius:14px; padding:14px 18px; margin-bottom:16px; }
.al-danger { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--sr); border-radius:14px; padding:14px 18px; margin-bottom:16px; }
.toggle-wrap { display:flex; align-items:center; gap:10px; }
.toggle { position:relative; width:44px; height:24px; cursor:pointer; }
.toggle input { opacity:0; width:0; height:0; position:absolute; }
.toggle-slider { position:absolute; inset:0; background:#D1D5DB; border-radius:99px; transition:background .25s; }
.toggle-slider::before { content:''; position:absolute; width:18px; height:18px; left:3px; top:3px; background:white; border-radius:50%; transition:transform .25s; box-shadow:0 1px 3px rgba(0,0,0,.2); }
.toggle input:checked + .toggle-slider { background:var(--st); }
.toggle input:checked + .toggle-slider::before { transform:translateX(20px); }
.toggle-lbl { font-size:13px; font-weight:500; color:var(--sn); }
.set-tbl { width:100%; border-collapse:collapse; }
.set-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.set-tbl th { padding:10px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--sm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--sbr); white-space:nowrap; }
.set-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.set-tbl tbody tr:last-child td { border-bottom:none; }
.set-tbl tbody tr:hover { background:#F8FAFF; }
.perm-grid { display:grid; grid-template-columns:180px repeat(6,1fr); gap:0; border:1.5px solid var(--sbr); border-radius:14px; overflow:hidden; }
.perm-hdr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); padding:10px 14px; font-size:11px; font-weight:700; color:var(--sm); text-transform:uppercase; letter-spacing:.5px; border-bottom:1.5px solid var(--sbr); text-align:center; }
.perm-hdr:first-child { text-align:left; }
.perm-row { display:contents; }
.perm-cell { padding:10px 14px; border-bottom:1px solid #F3F7FF; display:flex; align-items:center; justify-content:center; font-size:12px; }
.perm-cell:first-child { justify-content:flex-start; font-weight:600; color:var(--sn); }
.perm-row:last-child .perm-cell { border-bottom:none; }
.perm-row:hover .perm-cell { background:#F8FAFF; }
.upload-zone { border:2px dashed var(--sbr); border-radius:12px; padding:24px; text-align:center; cursor:pointer; transition:all .2s; background:var(--ss); }
.upload-zone:hover { border-color:var(--st); background:#F0FDFC; }
.color-swatch { width:36px; height:36px; border-radius:8px; border:2px solid var(--sbr); cursor:pointer; transition:transform .2s; overflow:hidden; }
.color-swatch:hover { transform:scale(1.1); border-color:var(--st); }
.color-swatch input[type=color] { width:140%; height:140%; margin:-20%; border:none; cursor:pointer; padding:0; }
.avatar-zone { width:96px; height:96px; border-radius:20px; border:2px dashed var(--sbr); display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; transition:all .2s; background:var(--ss); font-size:11px; color:var(--sm); text-align:center; gap:6px; }
.avatar-zone:hover { border-color:var(--st); background:#F0FDFC; }
.sec-div { font-size:12px; font-weight:700; color:var(--sm); text-transform:uppercase; letter-spacing:.6px; margin:20px 0 12px; padding-bottom:6px; border-bottom:2px solid var(--sbr); display:flex; align-items:center; gap:8px; }
.set-prog { background:#EEF4FF; border-radius:99px; height:6px; overflow:hidden; }
.set-prog-f { height:100%; border-radius:99px; transition:width .5s; }
/* Skeleton loader */
.skel { background:linear-gradient(90deg,#EEF4FF 25%,#DBEAFE 50%,#EEF4FF 75%); background-size:200% 100%; animation:skelAnim 1.5s infinite; border-radius:8px; }
@keyframes skelAnim { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
/* Saved indicator */
.saved-dot { width:8px; height:8px; border-radius:50%; background:var(--sg); display:inline-block; margin-left:6px; animation:savedP .4s ease; }
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
const DEMO_USERS = [
  { id:1, prenom:"Martin",  nom:"Leblanc",  email:"m.leblanc@clinique.cg",  role:"medecin",       statut:"actif",   last:"Auj. 09:15" },
  { id:2, prenom:"Sophie",  nom:"Pierre",   email:"s.pierre@clinique.cg",   role:"medecin",       statut:"actif",   last:"Auj. 08:42" },
  { id:3, prenom:"Amina",   nom:"Diallo",   email:"a.diallo@clinique.cg",   role:"infirmier",     statut:"actif",   last:"Hier 16:30" },
  { id:4, prenom:"Jean",    nom:"Bakala",   email:"j.bakala@clinique.cg",   role:"pharmacien",    statut:"actif",   last:"Auj. 10:00" },
  { id:5, prenom:"Carine",  nom:"Mouanda",  email:"c.mouanda@clinique.cg",  role:"receptionniste",statut:"actif",   last:"Auj. 07:55" },
  { id:6, prenom:"Paul",    nom:"Ngoma",    email:"p.ngoma@clinique.cg",    role:"laborantin",    statut:"inactif", last:"Il y a 3j"  },
  { id:7, prenom:"Béatrice",nom:"Yomba",    email:"b.yomba@clinique.cg",    role:"comptable",     statut:"actif",   last:"Hier 14:20" },
  { id:8, prenom:"Admin",   nom:"Clinique", email:"admin@clinique.cg",      role:"superadmin",    statut:"actif",   last:"Auj. 11:00" },
];

const ROLES_PERMS = [
  { role:"Super Admin",     read:true,  add:true,  edit:true,  del:true,  print:true,  export:true },
  { role:"Admin Clinique",  read:true,  add:true,  edit:true,  del:false, print:true,  export:true },
  { role:"Médecin",         read:true,  add:true,  edit:true,  del:false, print:true,  export:false },
  { role:"Infirmier",       read:true,  add:true,  edit:false, del:false, print:true,  export:false },
  { role:"Pharmacien",      read:true,  add:true,  edit:true,  del:false, print:true,  export:false },
  { role:"Laborantin",      read:true,  add:true,  edit:true,  del:false, print:true,  export:false },
  { role:"Comptable",       read:true,  add:false, edit:false, del:false, print:true,  export:true },
  { role:"Réceptionniste",  read:true,  add:true,  edit:false, del:false, print:false, export:false },
];

const DEMO_LOGS = [
  { user:"Admin Clinique",     action:"Modification paramètres généraux",  type:"edit",   date:"Auj. 11:42", ip:"192.168.1.1" },
  { user:"Dr. Martin Leblanc", action:"Connexion réussie",                 type:"login",  date:"Auj. 09:15", ip:"192.168.1.12" },
  { user:"Dr. Sophie Pierre",  action:"Connexion réussie",                 type:"login",  date:"Auj. 08:42", ip:"192.168.1.14" },
  { user:"Admin Clinique",     action:"Ajout utilisateur Béatrice Yomba",  type:"add",    date:"Hier 14:20", ip:"192.168.1.1" },
  { user:"Admin Clinique",     action:"Suppression rôle test",             type:"delete", date:"Hier 10:11", ip:"192.168.1.1" },
  { user:"Paul Ngoma",         action:"Tentative connexion échouée",       type:"error",  date:"Il y a 3j",  ip:"192.168.1.30" },
  { user:"Admin Clinique",     action:"Sauvegarde manuelle effectuée",     type:"backup", date:"Il y a 4j",  ip:"192.168.1.1" },
];

const INTEGRATIONS = [
  { nom:"SMS Gateway (Orange)",  statut:"connecté",    icon:"📱", desc:"Envoi SMS patients & alertes",             color:"#059669" },
  { nom:"WhatsApp Business API", statut:"connecté",    icon:"💬", desc:"Messages automatiques WhatsApp",           color:"#059669" },
  { nom:"Paiement Mobile Money", statut:"connecté",    icon:"💰", desc:"MTN Mobile Money & Airtel Money",          color:"#059669" },
  { nom:"Assurance CNSS",        statut:"en attente",  icon:"🏦", desc:"Liaison tiers payant CNSS Congo",          color:"#D97706" },
  { nom:"Labo externe CHL",      statut:"déconnecté",  icon:"🔬", desc:"Centre Hospitalier de Libreville",         color:"#DC2626" },
  { nom:"Radiologie externe",    statut:"déconnecté",  icon:"🩻", desc:"Centre d'imagerie partenaire",             color:"#DC2626" },
  { nom:"Ministère de la Santé", statut:"en attente",  icon:"🏛️", desc:"Système national de santé Congo",          color:"#D97706" },
  { nom:"Stripe / Paiement CB",  statut:"déconnecté",  icon:"💳", desc:"Paiement carte bancaire international",    color:"#DC2626" },
];

// ─── MAIN COMPONENT ──────────────────────────────────────────
export default function Settings() {
  const [active, setActive]       = useState("clinique");
  const [settings, setSettings]   = useState([]);    // données brutes API
  const [values, setValues]       = useState({});    // { cle: valeur }
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [savingKey, setSavingKey] = useState(null);  // quelle clé est en cours de sauvegarde
  const [saved, setSaved]         = useState({});    // { cle: true } pour l'animation
  const [users, setUsers]         = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [logs, setLogs]           = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

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

  // ── Chargement logs ───────────────────────────────────────
  const loadLogs = useCallback(async () => {
    if (logs.length > 0) return;
    setLoadingLogs(true);
    try {
      const { data } = await api.get("/admin/logs?limit=50");
      setLogs(data.logs || data.data || DEMO_LOGS);
    } catch { setLogs(DEMO_LOGS); }
    finally { setLoadingLogs(false); }
  }, [logs.length]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  useEffect(() => {
    if (active === "utilisateurs") loadUsers();
    if (active === "audit")        loadLogs();
  }, [active, loadUsers, loadLogs]);

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

  // ── Bouton save rapide par clé ────────────────────────────
  const SaveBtn = ({ cle, type = "string" }) => (
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

  // ── Ligne de paramètre générique ──────────────────────────
  const ParamRow = ({ cle, label, desc, type = "string", children }) => (
    <div style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 0", borderBottom:"1px solid #F3F7FF" }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:"var(--sn)" }}>{label}</div>
        {desc && <div style={{ fontSize:11, color:"var(--sm)", marginTop:2 }}>{desc}</div>}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
        {children}
        <SaveBtn cle={cle} type={type} />
        {saved[cle] && <span className="saved-dot" />}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"60vh", flexDirection:"column", gap:16 }}>
      <div style={{ width:48, height:48, border:"4px solid #EEF4FF", borderTop:"4px solid #1B4F9E", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
      <div style={{ fontSize:13, color:"var(--sm)", fontFamily:"Poppins,sans-serif" }}>Chargement des paramètres...</div>
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
              <div style={{ fontSize:13, fontWeight:600, color:"var(--sn)", marginBottom:4 }}>Logo officiel de la clinique</div>
              <div style={{ fontSize:12, color:"var(--sm)", marginBottom:12 }}>Format recommandé : PNG transparent · 512×512px minimum · Max 2 Mo</div>
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
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
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
                  <div style={{ fontWeight:600, color:"var(--sn)", fontSize:13 }}>{nom}</div>
                  <div style={{ fontSize:11, color:"var(--sm)" }}>Réf : {ref} · Expire le {exp}</div>
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
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
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
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
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
                    <div key={col} title={lbl} style={{ width:36, height:36, borderRadius:10, background:col, cursor:"pointer", border:val("apparence_couleur")===col?"3px solid var(--sn)":"3px solid transparent", transition:"all .2s", transform:val("apparence_couleur")===col?"scale(1.15)":"scale(1)" }}
                      onClick={() => { set("apparence_couleur", col); saveKey("apparence_couleur"); }}
                    />
                  ))}
                  <div className="color-swatch">
                    <input type="color" value={val("apparence_couleur","#1B4F9E")} onChange={e => set("apparence_couleur", e.target.value)} onBlur={() => saveKey("apparence_couleur")} />
                  </div>
                </div>
                <div style={{ marginTop:8, fontSize:12, color:"var(--sm)" }}>
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
                    <div style={{ fontSize:12, fontWeight:600, color:"var(--sn)" }}>{d}</div>
                    <div style={{ fontSize:11, color:"var(--sm)", marginTop:4 }}>PNG, JPG, SVG · Max 5 Mo</div>
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
          <button className="sbtn sbtn-primary" onClick={() => toast.success("➕ Formulaire nouvel utilisateur")}>{I.plus} Ajouter</button>
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
                            <div style={{ width:34, height:34, borderRadius:"50%", background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13, color:"var(--sb)", flexShrink:0 }}>
                              {(u.prenom||"?")[0]}{(u.nom||"?")[0]}
                            </div>
                            <div style={{ fontWeight:600, color:"var(--sn)", fontSize:13 }}>{u.prenom} {u.nom}</div>
                          </div>
                        </td>
                        <td style={{ fontSize:12, color:"var(--sm)" }}>{u.email}</td>
                        <td><Badge cls={roleColors[u.role]||"gray"}>{roleLabels[u.role]||u.role}</Badge></td>
                        <td><Badge cls={u.statut==="actif"?"green":"red"}>{u.statut==="actif"?"● Actif":"○ Inactif"}</Badge></td>
                        <td style={{ fontSize:12, color:"var(--sm)" }}>{u.last || u.derniere_connexion || "—"}</td>
                        <td>
                          <div style={{ display:"flex", gap:4 }}>
                            <button className="sbtn sbtn-ghost sbtn-sm" onClick={() => toast.success(`✏️ Modifier ${u.prenom}`)}>{I.edit}</button>
                            <button className="sbtn sbtn-ghost sbtn-sm" onClick={() => toast.success("🔑 Réinitialisation envoyée")}>{I.key}</button>
                            {u.role !== "superadmin" && <button className="sbtn sbtn-danger sbtn-sm" onClick={() => toast.success("🔒 Compte désactivé")}>{I.lock}</button>}
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
    case "roles": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">🛡️ Rôles & Permissions</div><div className="set-section-sub">Contrôle d'accès par rôle (RBAC)</div></div>
          <button className="sbtn sbtn-primary" onClick={() => toast.success("➕ Créer un rôle")}>{I.plus} Nouveau rôle</button>
        </div>
        <div className="al-info" style={{ fontSize:12 }}>
          <strong>ℹ️ Conseil :</strong> Les permissions sont appliquées globalement sur tous les modules.
        </div>
        <div className="set-card" style={{ overflowX:"auto" }}>
          <div className="perm-grid">
            {["Rôle","Lire","Ajouter","Modifier","Supprimer","Imprimer","Exporter"].map(h=>(
              <div key={h} className="perm-hdr">{h}</div>
            ))}
            {ROLES_PERMS.map(r => (
              <div key={r.role} className="perm-row">
                <div className="perm-cell" style={{ fontWeight:600, fontSize:12.5 }}>{r.role}</div>
                {["read","add","edit","del","print","export"].map(p => (
                  <div key={p} className="perm-cell">
                    <div style={{ width:22, height:22, borderRadius:6, background:r[p]?"#ECFDF5":"#FEF2F2", border:`1.5px solid ${r[p]?"#A7F3D0":"#FECACA"}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {r[p]
                        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      }
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
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
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
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
                <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10 }}>
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
                <button className="sbtn sbtn-ghost sbtn-sm" style={{ alignSelf:"flex-start" }} onClick={async () => {
                  try { await api.post("/settings/test-smtp"); toast.success("📧 E-mail test envoyé"); }
                  catch { toast.error("Échec de la connexion SMTP"); }
                }}>Tester la connexion SMTP</button>
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
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
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
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
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
                <div style={{ fontSize:11, color:"var(--sm)", marginTop:4 }}>
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
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
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
                <div key={cle} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", background:"var(--ss)", borderRadius:10, border:"1.5px solid var(--sbr)" }}>
                  <span style={{ fontSize:20 }}>{ico}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--sn)" }}>{nom}</div>
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
          <div><div className="set-section-title">🛡️ Assurances & tiers payants</div><div className="set-section-sub">API /assurances</div></div>
          <button className="sbtn sbtn-primary" onClick={() => toast.success("➕ Ajouter assurance")}>{I.plus} Ajouter</button>
        </div>
        <div className="set-card">
          <div style={{ overflowX:"auto" }}>
            <table className="set-tbl">
              <thead><tr><th>Compagnie</th><th>Contact</th><th>Prise en charge</th><th>N° contrat</th><th>Validité</th><th>Statut</th><th></th></tr></thead>
              <tbody>
                {[["CNSS Congo","cnss@congosocial.cg",80,"CNSS-CG-2024","2025-12-31","actif"],["AXA Assurances","axa@axa-congo.cg",70,"AXA-CG-2024","2025-06-30","actif"],["NSIA Assurances","nsia@nsia.cg",75,"NSIA-2024-001","2025-09-30","actif"],["Mutuelle FPC","fpc@mutuelle.cg",60,"FPC-2024-012","2024-12-31","expiré"],["UAB Assurances","uab@uab-congo.cg",65,"UAB-2025-003","2026-03-31","actif"]].map(([nom,email,taux,contrat,exp,st])=>(
                  <tr key={nom}>
                    <td style={{ fontWeight:700, color:"var(--sn)", fontSize:12.5 }}>{nom}</td>
                    <td style={{ fontSize:11, color:"var(--sm)" }}>{email}</td>
                    <td><span style={{ fontWeight:800, fontSize:15, color:taux>=75?"var(--sg)":"var(--so)" }}>{taux}%</span></td>
                    <td style={{ fontFamily:"monospace", fontSize:12, color:"var(--sb)" }}>{contrat}</td>
                    <td style={{ fontSize:12, color:new Date(exp)<new Date()?"var(--sr)":"var(--sm)" }}>{exp}</td>
                    <td><Badge cls={st==="actif"?"green":"red"}>{st}</Badge></td>
                    <td><button className="sbtn sbtn-ghost sbtn-sm" onClick={() => toast.success(`✏️ Modifier ${nom}`)}>{I.edit}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );

    // ════ AUDIT ════
    case "audit": return (
      <div className="fu">
        <div className="set-section-top">
          <div><div className="set-section-title">📋 Audit & Journaux</div><div className="set-section-sub">API /admin/logs — Traçabilité complète</div></div>
          <div style={{ display:"flex", gap:8 }}>
            <button className="sbtn sbtn-ghost" onClick={async () => { try { await api.get("/admin/logs/export?format=pdf"); toast.success("📄 Export PDF lancé"); } catch { toast.error("Erreur export"); } }}>📄 PDF</button>
            <button className="sbtn sbtn-ghost" onClick={async () => { try { await api.get("/admin/logs/export?format=excel"); toast.success("📊 Export Excel lancé"); } catch { toast.error("Erreur export"); } }}>📊 Excel</button>
            <button className="sbtn sbtn-ghost sbtn-sm" onClick={loadLogs} title="Rafraîchir">{I.refresh}</button>
          </div>
        </div>
        {loadingLogs ? <Skeleton rows={7} /> : (
          <div className="set-card">
            <div style={{ overflowX:"auto" }}>
              <table className="set-tbl">
                <thead><tr><th>Utilisateur</th><th>Action</th><th>Type</th><th>Date & Heure</th><th>Adresse IP</th></tr></thead>
                <tbody>
                  {logs.map((log, i) => {
                    const typeConf = {
                      edit:["orange","✏️"], login:["teal","🔑"], add:["green","➕"],
                      delete:["red","🗑️"], error:["red","❌"], backup:["blue","💾"]
                    }[log.type] || ["gray","•"];
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight:600, color:"var(--sn)", fontSize:13 }}>{log.user || log.utilisateur}</td>
                        <td style={{ fontSize:12, color:"var(--sm)" }}>{log.action}</td>
                        <td><Badge cls={typeConf[0]}>{typeConf[1]} {log.type}</Badge></td>
                        <td style={{ fontSize:12, color:"var(--sm)", fontFamily:"monospace" }}>{log.date || log.created_at}</td>
                        <td style={{ fontSize:12, fontFamily:"monospace", color:"var(--sm)" }}>{log.ip}</td>
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
          <div><div className="set-section-title">🔗 Intégrations API</div><div className="set-section-sub">API /integrations — Connexions aux services externes</div></div>
          <button className="sbtn sbtn-primary" onClick={() => toast.success("➕ Nouvelle intégration")}>{I.plus} Nouvelle intégration</button>
        </div>
        <div className="al-info" style={{ fontSize:12 }}>
          <strong>🔗 API REST :</strong> Documentation sur <code style={{ background:"#EFF6FF", padding:"1px 6px", borderRadius:4, fontFamily:"monospace" }}>docs.clinique-souanke.cg/api</code>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
          {INTEGRATIONS.map((integ, i) => (
            <div key={i} style={{ background:"#fff", border:"1.5px solid var(--sbr)", borderRadius:16, padding:18, boxShadow:"var(--sh)", display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:`${integ.color}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{integ.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--sn)" }}>{integ.nom}</div>
                  <div style={{ fontSize:11, color:"var(--sm)" }}>{integ.desc}</div>
                </div>
                <div style={{ width:10, height:10, borderRadius:"50%", background:integ.color, flexShrink:0 }} />
              </div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <Badge cls={integ.statut==="connecté"?"green":integ.statut==="en attente"?"orange":"red"}>
                  {integ.statut==="connecté"?"● Connecté":integ.statut==="en attente"?"◐ En attente":"○ Déconnecté"}
                </Badge>
                <div style={{ display:"flex", gap:6 }}>
                  {integ.statut==="connecté" ? (
                    <>
                      <button className="sbtn sbtn-ghost sbtn-sm" style={{ fontSize:11 }} onClick={async () => { try { await api.put(`/integrations/${integ.nom.replace(/\s+/g,"_")}`); toast.success(`🔧 ${integ.nom} configuré`); } catch { toast.error("Erreur"); } }}>Config.</button>
                      <button className="sbtn sbtn-danger sbtn-sm" style={{ fontSize:11 }} onClick={async () => { try { await api.delete(`/integrations/${integ.nom.replace(/\s+/g,"_")}`); toast.success(`🔌 Déconnecté`); } catch { toast.error("Erreur"); } }}>Déconnecter</button>
                    </>
                  ) : (
                    <button className="sbtn sbtn-primary sbtn-sm" style={{ fontSize:11 }} onClick={async () => { try { await api.post("/integrations", { nom:integ.nom }); toast.success(`🔗 Connexion lancée`); } catch { toast.error("Erreur de connexion"); } }}>Connecter</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Clé API */}
        <div className="set-card" style={{ marginTop:20 }}>
          <div className="set-card-hdr"><h3>{I.key} Clé API de la clinique</h3></div>
          <div className="set-card-body">
            <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
              <input className="sinp" style={{ flex:1, fontFamily:"monospace", fontSize:12, letterSpacing:1 }} value={val("api_key","sk_live_••••••••••••••••")} readOnly />
              <button className="sbtn sbtn-ghost" onClick={() => { navigator.clipboard?.writeText(val("api_key","")); toast.success("📋 Clé API copiée"); }}>📋 Copier</button>
              <button className="sbtn sbtn-danger" onClick={async () => {
                try { const { data } = await api.post("/settings/regenerate-key"); set("api_key", data.key || "sk_live_new_••••••••"); toast.success("🔄 Nouvelle clé générée"); }
                catch { toast.error("Erreur lors de la régénération"); }
              }}>🔄 Régénérer</button>
            </div>
            <div style={{ fontSize:11, color:"var(--sm)", marginTop:8 }}>⚠️ Ne partagez jamais votre clé API. Révoquez-la immédiatement si elle est compromise.</div>
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
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--sn)" }}>{(s.label || s.cle).replace(/_/g," ")}</div>
                    {s.description && <div style={{ fontSize:11, color:"var(--sm)", marginTop:2 }}>{s.description}</div>}
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
            <div style={{ fontSize:16, fontWeight:700, color:"var(--sn)" }}>Section en cours de développement</div>
            <div style={{ color:"var(--sm)", marginTop:8 }}>Les paramètres seront chargés depuis <code style={{fontFamily:"monospace",background:"#EEF4FF",padding:"2px 6px",borderRadius:4}}>/settings?groupe={active}</code></div>
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
        <div className="set-wrap">
          {/* ── SIDEBAR ── */}
          <aside className="set-sidebar">
            <div className="set-sidebar-hdr">
              <h2>⚙️ Paramètres</h2>
              <p>{settings.length > 0 ? `${settings.length} paramètres chargés` : "Configuration du système"}</p>
            </div>
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
            {renderSection()}
          </main>
        </div>
      </div>
    </>
  );
}