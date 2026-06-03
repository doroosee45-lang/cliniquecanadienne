



import { useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchArchives, fetchArchiveStats,
  restoreArchive, deleteArchive, createArchive,
  bulkRestore, bulkDelete, exportArchives, updateAutoConfig,
  selectArchives, selectArchiveTotal, selectArchiveLoading, selectArchiveSaving,
  selectArchiveExporting, selectArchiveKPIs, selectArchiveFilters,
  selectSelectedIds, selectConfigAuto,
  setPage as setReduxPage, setFilters, selectId, deselectId, selectAll, clearSelection,
  setConfigAuto,
} from '../store/slices/archiveSlice';
import api from "../api";
import toast from "react-hot-toast";

// ─── CSS — same Medical Navy + Teal design system as Settings ─
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.arc * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --an:#0B1E3B; --an2:#132744; --ab:#1B4F9E;
  --at:#0EA5A0; --at2:#0D9490; --ar:#DC2626;
  --ao:#D97706; --ag:#059669; --ap:#7C3AED;
  --abr:#E2EAF4; --am:#6B7A99; --al:#EEF4FF; --as:#F8FAFD;
  --sh:0 1px 3px rgba(11,30,59,.08); --shm:0 4px 16px rgba(11,30,59,.10); --shl:0 12px 40px rgba(11,30,59,.14);
}

/* Layout */
.arc-wrap { display:flex; min-height:100vh; }
.arc-sidebar { width:260px; flex-shrink:0; background:#fff; border-right:1.5px solid var(--abr); position:sticky; top:0; max-height:100vh; overflow-y:auto; box-shadow:var(--sh); }
.arc-sidebar::-webkit-scrollbar { width:4px; }
.arc-sidebar::-webkit-scrollbar-thumb { background:var(--abr); border-radius:99px; }
.arc-sidebar-hdr { padding:18px 20px 14px; border-bottom:1.5px solid var(--abr); background:linear-gradient(135deg,var(--an),var(--an2)); position:sticky; top:0; z-index:2; }
.arc-sidebar-hdr h2 { font-size:15px; font-weight:700; color:#fff; margin:0; display:flex; align-items:center; gap:8px; }
.arc-sidebar-hdr p { font-size:11px; color:rgba(255,255,255,.5); margin:3px 0 0; }
.arc-nav-group { padding:10px 10px 4px; }
.arc-nav-group-label { font-size:10px; font-weight:700; color:var(--am); text-transform:uppercase; letter-spacing:.8px; padding:6px 10px 4px; display:block; }
.arc-nav-item { display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:10px; font-size:12.5px; font-weight:500; color:var(--am); cursor:pointer; border:none; background:none; width:100%; text-align:left; font-family:'Poppins',sans-serif; transition:all .2s; margin-bottom:2px; }
.arc-nav-item:hover { background:var(--al); color:var(--an); }
.arc-nav-item.active { background:linear-gradient(135deg,var(--ab),#174391); color:#fff; box-shadow:0 4px 12px rgba(27,79,158,.25); }
.arc-nav-item.active .arc-nav-badge { background:rgba(255,255,255,.2); color:#fff; }
.arc-nav-badge { margin-left:auto; background:var(--al); color:var(--ab); font-size:10px; font-weight:700; padding:2px 7px; border-radius:99px; }
.arc-nav-badge.warn { background:#FEF3C7; color:#D97706; }
.arc-nav-badge.teal { background:#F0FDFC; color:var(--at); }
.arc-content { flex:1; min-width:0; padding:28px; background:var(--as); }
.arc-section-top { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:24px; }
.arc-section-title { font-size:20px; font-weight:700; color:var(--an); }
.arc-section-sub { font-size:13px; color:var(--am); margin-top:3px; }

/* Cards */
.arc-card { background:#fff; border:1.5px solid var(--abr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; margin-bottom:20px; transition:box-shadow .2s; }
.arc-card:hover { box-shadow:var(--shm); }
.arc-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--abr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.arc-card-hdr h3 { font-size:14px; font-weight:700; color:var(--an); margin:0; display:flex; align-items:center; gap:8px; }
.arc-card-hdr p { font-size:11px; color:var(--am); margin:2px 0 0; }
.arc-card-body { padding:20px; }

/* KPI */
.arc-kpi { background:#fff; border:1.5px solid var(--abr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:pointer; }
.arc-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.arc-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.arc-kpi.blue::before   { background:var(--ab); } .arc-kpi.teal::before   { background:var(--at); }
.arc-kpi.green::before  { background:var(--ag); } .arc-kpi.purple::before { background:var(--ap); }
.arc-kpi.orange::before { background:var(--ao); } .arc-kpi.red::before    { background:var(--ar); }
.arc-kpi-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
.arc-kpi-icon.blue   { background:#EFF6FF; color:var(--ab); } .arc-kpi-icon.teal   { background:#F0FDFC; color:var(--at); }
.arc-kpi-icon.green  { background:#ECFDF5; color:var(--ag); } .arc-kpi-icon.purple { background:#F5F3FF; color:var(--ap); }
.arc-kpi-icon.orange { background:#FFF7ED; color:var(--ao); } .arc-kpi-icon.red    { background:#FEF2F2; color:var(--ar); }
.arc-kpi-val { font-size:26px; font-weight:800; color:var(--an); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.arc-kpi-lbl { font-size:11.5px; font-weight:600; color:var(--am); }
.arc-kpi-sub { font-size:10.5px; color:#9CA3AF; margin-top:2px; }

/* Badges */
.abadge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.abadge.red    { background:#FEF2F2; color:var(--ar); border:1px solid #FECACA; }
.abadge.orange { background:#FFF7ED; color:var(--ao); border:1px solid #FED7AA; }
.abadge.green  { background:#ECFDF5; color:var(--ag); border:1px solid #A7F3D0; }
.abadge.blue   { background:#EFF6FF; color:var(--ab); border:1px solid #BFDBFE; }
.abadge.teal   { background:#F0FDFC; color:var(--at); border:1px solid #99F6E4; }
.abadge.purple { background:#F5F3FF; color:var(--ap); border:1px solid #DDD6FE; }
.abadge.gray   { background:#F9FAFB; color:#4B5563;   border:1px solid #E5E7EB; }

/* Buttons */
.abtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; }
.abtn-primary { background:var(--ab); color:#fff; } .abtn-primary:hover { background:#174391; transform:translateY(-1px); }
.abtn-teal    { background:var(--at); color:#fff; } .abtn-teal:hover    { background:var(--at2); transform:translateY(-1px); }
.abtn-ghost   { background:transparent; color:var(--am); border:1.5px solid var(--abr); }
.abtn-ghost:hover { background:var(--al); color:var(--an); }
.abtn-danger  { background:#FEF2F2; color:var(--ar); border:1.5px solid #FECACA; }
.abtn-danger:hover { background:var(--ar); color:#fff; }
.abtn-success { background:#ECFDF5; color:var(--ag); border:1.5px solid #A7F3D0; }
.abtn-success:hover { background:var(--ag); color:#fff; }
.abtn-sm { padding:6px 12px; font-size:12px; }
.abtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }

/* Form */
.albl { font-size:12px; font-weight:600; color:var(--am); margin-bottom:6px; display:block; }
.ainp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--abr); background:#FAFBFF; font-size:13px; color:var(--an); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.ainp:focus { border-color:var(--at); box-shadow:0 0 0 3px rgba(14,165,160,.12); }

/* Table */
.arc-tbl { width:100%; border-collapse:collapse; }
.arc-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.arc-tbl th { padding:10px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--am); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--abr); white-space:nowrap; }
.arc-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.arc-tbl tbody tr:last-child td { border-bottom:none; }
.arc-tbl tbody tr:hover { background:#F8FAFF; }

/* Modal */
.amov { position:fixed; inset:0; z-index:500; background:rgba(11,30,59,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.amov-box { background:#fff; border-radius:20px; box-shadow:var(--shl); width:100%; max-width:660px; max-height:92vh; overflow-y:auto; animation:arcSlide .25s ease; }
@keyframes arcSlide { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.amov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--abr); display:flex; align-items:center; justify-content:space-between; background:#EEF4FF; position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.amov-hdr h3 { font-size:16px; font-weight:700; color:var(--an); margin:0; display:flex; align-items:center; gap:10px; }
.amov-cls { width:32px; height:32px; border-radius:8px; background:#F3F7FF; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--am); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.amov-cls:hover { background:#FEF2F2; color:var(--ar); }
.amov-body { padding:24px; }

/* Alerts */
.al-arc-info   { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; border-left:4px solid var(--ab); border-radius:14px; padding:14px 18px; margin-bottom:16px; }
.al-arc-warn   { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--ao); border-radius:14px; padding:14px 18px; margin-bottom:16px; }
.al-arc-danger { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--ar); border-radius:14px; padding:14px 18px; margin-bottom:16px; }
.al-arc-success{ background:linear-gradient(135deg,#ECFDF5,#D1FAE5); border:1.5px solid #A7F3D0; border-left:4px solid var(--ag); border-radius:14px; padding:14px 18px; margin-bottom:16px; }

/* Progress */
.arc-prog { background:#EEF4FF; border-radius:99px; height:6px; overflow:hidden; }
.arc-prog-f { height:100%; border-radius:99px; transition:width .5s; }

/* Category tabs */
.arc-cat-tabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:16px; }
.arc-cat-tab { display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:10px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid var(--abr); transition:all .2s; color:var(--am); background:#fff; font-family:'Poppins',sans-serif; }
.arc-cat-tab:hover { background:var(--al); color:var(--an); border-color:var(--ab); }
.arc-cat-tab.active { background:var(--ab); color:#fff; border-color:var(--ab); box-shadow:0 4px 12px rgba(27,79,158,.2); }

/* Document card */
.arc-doc-card { background:#F8FAFD; border:1.5px solid var(--abr); border-radius:14px; padding:16px; display:flex; flex-direction:column; gap:10px; transition:all .2s; cursor:pointer; }
.arc-doc-card:hover { background:#EEF4FF; border-color:var(--ab); box-shadow:var(--shm); transform:translateY(-1px); }

/* Audit log row */
.arc-log-row { display:flex; align-items:flex-start; gap:12px; padding:12px 0; border-bottom:1px solid #F3F7FF; }
.arc-log-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; margin-top:4px; }

/* Storage bar */
.arc-storage { background:#EEF4FF; border-radius:14px; padding:14px 18px; }
.arc-storage-bar { height:12px; border-radius:99px; overflow:hidden; background:#DBEAFE; margin:8px 0; display:flex; }
.arc-storage-seg { height:100%; transition:width .7s; }

/* Checkbox style */
.arc-chk { width:16px; height:16px; accent-color:var(--ab); cursor:pointer; }

/* Toggle */
.arc-toggle-wrap { display:flex; align-items:center; gap:10px; }
.arc-toggle { position:relative; width:44px; height:24px; cursor:pointer; }
.arc-toggle input { opacity:0; width:0; height:0; position:absolute; }
.arc-toggle-slider { position:absolute; inset:0; background:#D1D5DB; border-radius:99px; transition:background .25s; }
.arc-toggle-slider::before { content:''; position:absolute; width:18px; height:18px; left:3px; top:3px; background:white; border-radius:50%; transition:transform .25s; box-shadow:0 1px 3px rgba(0,0,0,.2); }
.arc-toggle input:checked + .arc-toggle-slider { background:var(--at); }
.arc-toggle input:checked + .arc-toggle-slider::before { transform:translateX(20px); }

/* Skeleton */
.askel { background:linear-gradient(90deg,#EEF4FF 25%,#DBEAFE 50%,#EEF4FF 75%); background-size:200% 100%; animation:asSkel 1.5s infinite; border-radius:8px; }
@keyframes asSkel { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* Anim */
@keyframes arcFadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
.arfu { animation:arcFadeUp .3s ease both; }

/* Pagination */
.arc-pag { display:flex; align-items:center; justify-content:space-between; padding:12px 20px; border-top:1.5px solid var(--abr); }

@media (max-width:900px) { .arc-wrap { flex-direction:column; } .arc-sidebar { width:100%; max-height:none; position:relative; } }
@media print { .arc-sidebar,.abtn { display:none!important; } }
`;

// ─── SVG Icons ────────────────────────────────────────────────
const I = {
  archive:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
  dashboard:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  patient:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  consult:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  lab:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5h0c-1.4 0-2.5-1.1-2.5-2.5V2"/><path d="M8.5 2h7"/></svg>,
  scan:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>,
  bed:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16M2 8h18a2 2 0 012 2v10M2 16h20"/></svg>,
  surgery:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78"/></svg>,
  file:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  money:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  restore:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>,
  audit:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  config:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  search:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  print:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  trash:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
  eye:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  filter:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>,
  export:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  clock:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  check:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  plus:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  refresh:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
  lock:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
};

// ─── Demo Data ────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";

const DEMO_ARCHIVES = [
  { _id:"arc001", reference:"ARC-2025-0001", patient_nom:"Jean Dupont",    categorie:"consultation",    service:"Médecine générale", date_archive:"2025-01-15", archive_par:"Dr. Martin Leblanc", motif:"Dossier clôturé — 1 an", taille:"2.4 Mo",  nb_docs:5,  statut:"archivé" },
  { _id:"arc002", reference:"ARC-2025-0002", patient_nom:"Marie Paul",     categorie:"hospitalisation", service:"Gynécologie",        date_archive:"2025-02-03", archive_par:"Admin Clinique",      motif:"Sortie définitive",       taille:"8.1 Mo",  nb_docs:12, statut:"archivé" },
  { _id:"arc003", reference:"ARC-2025-0003", patient_nom:"Paul Nguema",    categorie:"laboratoire",     service:"Biologie",           date_archive:"2025-02-20", archive_par:"Admin Clinique",      motif:"Résultats validés 1 an",  taille:"1.2 Mo",  nb_docs:3,  statut:"archivé" },
  { _id:"arc004", reference:"ARC-2025-0004", patient_nom:"Fatou Bongo",    categorie:"chirurgie",       service:"Chirurgie générale", date_archive:"2025-03-11", archive_par:"Dr. Sophie Pierre",   motif:"Dossier chirurgical clos",taille:"14.5 Mo", nb_docs:18, statut:"archivé" },
  { _id:"arc005", reference:"ARC-2025-0005", patient_nom:"André Mboula",   categorie:"imagerie",        service:"Radiologie",         date_archive:"2025-03-28", archive_par:"Admin Clinique",      motif:"Comptes rendus 1 an",     taille:"45.2 Mo", nb_docs:7,  statut:"archivé" },
  { _id:"arc006", reference:"ARC-2025-0006", patient_nom:"Carine Mouanda", categorie:"financier",       service:"Facturation",        date_archive:"2025-04-05", archive_par:"Béatrice Yomba",      motif:"Factures soldées 1 an",   taille:"0.8 Mo",  nb_docs:4,  statut:"archivé" },
  { _id:"arc007", reference:"ARC-2025-0007", patient_nom:"Bernard Okala",  categorie:"consultation",    service:"Médecine interne",   date_archive:"2025-04-18", archive_par:"Admin Clinique",      motif:"Dossier clôturé — 1 an",  taille:"3.1 Mo",  nb_docs:6,  statut:"restauré" },
  { _id:"arc008", reference:"ARC-2025-0008", patient_nom:"Solange Nkomo",  categorie:"patient",         service:"Dossier patient",    date_archive:"2025-05-02", archive_par:"Admin Clinique",      motif:"Patient inactif 3 ans",   taille:"5.9 Mo",  nb_docs:22, statut:"archivé" },
  { _id:"arc009", reference:"ARC-2025-0009", patient_nom:"David Etana",    categorie:"laboratoire",     service:"Biologie",           date_archive:"2025-05-14", archive_par:"Paul Ngoma",          motif:"Résultats validés 1 an",  taille:"0.9 Mo",  nb_docs:2,  statut:"archivé" },
  { _id:"arc010", reference:"ARC-2025-0010", patient_nom:"Lucie Bibang",   categorie:"hospitalisation", service:"Pédiatrie",          date_archive:"2025-05-29", archive_par:"Admin Clinique",      motif:"Sortie définitive",       taille:"6.3 Mo",  nb_docs:9,  statut:"archivé" },
];

const DEMO_LOGS = [
  { user:"Admin Clinique",       action:"Consultation archive ARC-2025-0004",          type:"view",    date:"Auj. 11:42", ip:"192.168.1.1" },
  { user:"Béatrice Yomba",       action:"Export PDF — Archives financières mai 2025",   type:"export",  date:"Auj. 10:15", ip:"192.168.1.7" },
  { user:"Admin Clinique",       action:"Restauration dossier ARC-2025-0007",           type:"restore", date:"Auj. 09:30", ip:"192.168.1.1" },
  { user:"Dr. Martin Leblanc",   action:"Téléchargement documents ARC-2025-0001",       type:"download",date:"Hier 16:22", ip:"192.168.1.12" },
  { user:"Admin Clinique",       action:"Archivage automatique — 12 dossiers archivés", type:"archive", date:"Hier 02:00", ip:"192.168.1.1" },
  { user:"Dr. Sophie Pierre",    action:"Consultation archive ARC-2025-0004",           type:"view",    date:"Hier 14:50", ip:"192.168.1.14" },
  { user:"Admin Clinique",       action:"Suppression définitive ARC-2020-0042",         type:"delete",  date:"Il y a 3j",  ip:"192.168.1.1" },
  { user:"Paul Ngoma",           action:"Impression rapport ARC-2025-0009",             type:"print",   date:"Il y a 4j",  ip:"192.168.1.30" },
  { user:"Admin Clinique",       action:"Configuration archivage automatique modifiée", type:"config",  date:"Il y a 5j",  ip:"192.168.1.1" },
];

const DEMO_RESTAURATIONS = [
  { reference:"ARC-2025-0007", patient:"Bernard Okala",  date_rest:"2025-05-31", user:"Admin Clinique",    motif:"Consultation de suivi urgente",          statut:"terminé" },
  { reference:"ARC-2024-0123", patient:"Nathalie Essie", date_rest:"2025-04-14", user:"Dr. Martin Leblanc",motif:"Expertise médico-légale",                 statut:"terminé" },
  { reference:"ARC-2024-0089", patient:"Claude Manga",   date_rest:"2025-03-02", user:"Admin Clinique",    motif:"Demande du patient",                      statut:"terminé" },
  { reference:"ARC-2023-0201", patient:"Joëlle Ngouma",  date_rest:"2025-01-18", user:"Béatrice Yomba",    motif:"Réclamation assurance",                   statut:"terminé" },
];

const CAT_CONFIG = {
  patient:        { icon:"👤", label:"Patient",         color:"#1B4F9E", bg:"#EFF6FF", border:"#BFDBFE" },
  consultation:   { icon:"🩺", label:"Consultation",    color:"#0EA5A0", bg:"#F0FDFC", border:"#99F6E4" },
  laboratoire:    { icon:"🔬", label:"Laboratoire",     color:"#059669", bg:"#ECFDF5", border:"#A7F3D0" },
  imagerie:       { icon:"🩻", label:"Imagerie",        color:"#7C3AED", bg:"#F5F3FF", border:"#DDD6FE" },
  hospitalisation:{ icon:"🛏️", label:"Hospitalisation", color:"#D97706", bg:"#FFF7ED", border:"#FED7AA" },
  chirurgie:      { icon:"🔪", label:"Chirurgie",       color:"#DC2626", bg:"#FEF2F2", border:"#FECACA" },
  financier:      { icon:"💰", label:"Financier",       color:"#7C3AED", bg:"#F5F3FF", border:"#DDD6FE" },
  documents:      { icon:"📄", label:"Documents",       color:"#6B7A99", bg:"#F9FAFB", border:"#E5E7EB" },
};

const NAV_ITEMS = [
  { group:"Général", items:[
    { key:"dashboard",      label:"Tableau de bord",          icon:I.dashboard,  badge:"" },
    { key:"recherche",      label:"Recherche avancée",        icon:I.search },
  ]},
  { group:"Archives par catégorie", items:[
    { key:"patients",       label:"Patients archivés",        icon:I.patient,    badge:"8", badgeCls:"teal" },
    { key:"consultations",  label:"Consultations archivées",  icon:I.consult,    badge:"12", badgeCls:"teal" },
    { key:"laboratoire",    label:"Laboratoire archivé",      icon:I.lab,        badge:"9", badgeCls:"teal" },
    { key:"imagerie",       label:"Imagerie archivée",        icon:I.scan,       badge:"5", badgeCls:"teal" },
    { key:"hospitalisations",label:"Hospitalisations arch.", icon:I.bed,        badge:"10", badgeCls:"teal" },
    { key:"chirurgies",     label:"Chirurgies archivées",     icon:I.surgery,    badge:"4", badgeCls:"teal" },
    { key:"documents",      label:"Documents archivés",       icon:I.file },
    { key:"financier",      label:"Archives financières",     icon:I.money,      badge:"6", badgeCls:"teal" },
  ]},
  { group:"Gestion", items:[
    { key:"restaurations",  label:"Restaurations",            icon:I.restore,    badge:"4", badgeCls:"warn" },
    { key:"audit",          label:"Journal d'audit",          icon:I.audit },
    { key:"parametres",     label:"Paramètres d'archivage",   icon:I.config },
  ]},
];

// ─── Helper components ─────────────────────────────────────────
function Badge({ cls, children }) { return <span className={`abadge ${cls}`}>{children}</span>; }
function Prog({ pct, color }) {
  return <div className="arc-prog"><div className="arc-prog-f" style={{ width:`${pct}%`, background:color }} /></div>;
}

function Toggle({ checked, onChange }) {
  return (
    <label className="arc-toggle">
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
      <span className="arc-toggle-slider" />
    </label>
  );
}

// ─── Modal ────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, maxWidth = 660 }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="amov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="amov-box" style={{ maxWidth }}>
        <div className="amov-hdr">
          <h3>{title}</h3>
          <button className="amov-cls" onClick={onClose}>×</button>
        </div>
        <div className="amov-body">{children}</div>
      </div>
    </div>
  );
}

// ─── Archive Table (réutilisable) ─────────────────────────────
function ArchiveTable({ data, onView, onRestore, onDelete, selectedIds, onSelect, onSelectAll }) {
  const allSelected = data.length > 0 && data.every(d => selectedIds.includes(d._id));
  return (
    <div style={{ overflowX:"auto" }}>
      <table className="arc-tbl">
        <thead>
          <tr>
            <th style={{ width:36 }}>
              <input type="checkbox" className="arc-chk"
                checked={allSelected}
                onChange={e => onSelectAll(e.target.checked)}
              />
            </th>
            <th>Référence</th><th>Patient</th><th>Catégorie</th>
            <th>Service</th><th>Date d'archivage</th><th>Taille</th>
            <th>Statut</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map(d => {
            const cat = CAT_CONFIG[d.categorie] || CAT_CONFIG.documents;
            return (
              <tr key={d._id} style={{ background: selectedIds.includes(d._id) ? "#F0FDFC" : "" }}>
                <td>
                  <input type="checkbox" className="arc-chk"
                    checked={selectedIds.includes(d._id)}
                    onChange={e => onSelect(d._id, e.target.checked)}
                  />
                </td>
                <td>
                  <span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--ab)", fontSize:12 }}>{d.reference}</span>
                </td>
                <td>
                  <div style={{ fontWeight:600, color:"var(--an)", fontSize:13 }}>{d.patient_nom}</div>
                  <div style={{ fontSize:11, color:"var(--am)" }}>Archivé par {d.archive_par}</div>
                </td>
                <td>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ width:24, height:24, borderRadius:6, background:cat.bg, border:`1px solid ${cat.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, flexShrink:0 }}>{cat.icon}</span>
                    <span style={{ fontSize:12, fontWeight:600, color:cat.color }}>{cat.label}</span>
                  </div>
                </td>
                <td style={{ fontSize:12, color:"var(--am)" }}>{d.service}</td>
                <td style={{ fontSize:12, color:"var(--am)" }}>
                  <div>{fmtDate(d.date_archive)}</div>
                  <div style={{ fontSize:10, color:"#9CA3AF" }}>{d.nb_docs} document(s)</div>
                </td>
                <td>
                  <Badge cls="blue">{d.taille}</Badge>
                </td>
                <td>
                  <Badge cls={d.statut === "restauré" ? "orange" : "green"}>
                    {d.statut === "restauré" ? "↩ Restauré" : "📦 Archivé"}
                  </Badge>
                </td>
                <td>
                  <div style={{ display:"flex", gap:4 }}>
                    <button className="abtn abtn-ghost abtn-sm" style={{ fontSize:11 }} title="Voir" onClick={() => onView(d)}>
                      {I.eye} Voir
                    </button>
                    <button className="abtn abtn-ghost abtn-sm" style={{ fontSize:11 }} title="Télécharger" onClick={() => toast.success(`📥 Téléchargement : ${d.reference}`)}>
                      {I.download}
                    </button>
                    <button className="abtn abtn-ghost abtn-sm" style={{ fontSize:11 }} title="Imprimer" onClick={() => toast.success(`🖨 Impression : ${d.reference}`)}>
                      {I.print}
                    </button>
                    {d.statut !== "restauré" && (
                      <button className="abtn abtn-success abtn-sm" style={{ fontSize:11 }} title="Restaurer" onClick={() => onRestore(d)}>
                        {I.restore}
                      </button>
                    )}
                    <button className="abtn abtn-danger abtn-sm" style={{ fontSize:11 }} title="Supprimer définitivement" onClick={() => onDelete(d)}>
                      {I.trash}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {data.length === 0 && (
            <tr>
              <td colSpan={9} style={{ padding:40, textAlign:"center", color:"var(--am)" }}>
                <div style={{ fontSize:32, marginBottom:10 }}>📦</div>
                Aucune archive dans cette catégorie
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function Archivage() {
  const dispatch = useDispatch();
  const reduxArchives   = useSelector(selectArchives);
  const reduxTotal      = useSelector(selectArchiveTotal);
  const reduxLoading    = useSelector(selectArchiveLoading);
  const reduxSaving     = useSelector(selectArchiveSaving);
  const reduxExporting  = useSelector(selectArchiveExporting);
  const reduxKpis       = useSelector(selectArchiveKPIs);
  const reduxFilters    = useSelector(selectArchiveFilters);
  const reduxSelectedIds = useSelector(selectSelectedIds);
  const reduxConfigAuto = useSelector(selectConfigAuto);

  const [active, setActive]       = useState("dashboard");
  const [archives, setArchives]   = useState([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterSvc, setFilterSvc] = useState("");
  const [filterDate1, setDate1]   = useState("");
  const [filterDate2, setDate2]   = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentArc, setCurrentArc]   = useState(null);
  const [modalView, setModalView]     = useState(false);
  const [modalRestore, setModalRestore] = useState(false);
  const [modalDelete, setModalDelete]   = useState(false);
  const [modalArchiver, setModalArchiver] = useState(false);
  const [restoreMotif, setRestoreMotif]   = useState("");
  const [configAuto, setConfigAutoLocal] = useState({
    actif: true, duree: "1an", consultations: true, hospitalisations: true,
    factures: true, examens: true,
  });

  const [kpis, setKpis] = useState({
    total: 0, patients: 0, consultations: 0, hospitalisations: 0,
    examens: 0, chirurgies: 0, taille_totale: "0 Mo", derniere_op: "—",
  });

  // ── Sync Redux → local state ──────────────────────────────
  useEffect(() => {
    if (reduxArchives.length > 0) { setArchives(reduxArchives); setTotal(reduxTotal); setLoading(false); }
  }, [reduxArchives, reduxTotal]);

  useEffect(() => {
    if (reduxKpis.total > 0) setKpis(reduxKpis);
  }, [reduxKpis]);

  useEffect(() => {
    if (reduxConfigAuto) setConfigAutoLocal(reduxConfigAuto);
  }, [reduxConfigAuto]);

  // ── Load ─────────────────────────────────────────────────
  const loadArchives = useCallback(async () => {
    dispatch(fetchArchives({ page, limit: 15, search, categorie: filterCat, service: filterSvc, date_debut: filterDate1, date_fin: filterDate2 }));

    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit:15 });
      if (search) p.set("q", search);
      if (filterCat) p.set("categorie", filterCat);
      if (filterSvc) p.set("service", filterSvc);
      if (filterDate1) p.set("date_debut", filterDate1);
      if (filterDate2) p.set("date_fin", filterDate2);
      const { data } = await api.get(`/archives?${p}`);
      setArchives(data.archives || data.data || []);
      setTotal(data.total || 0);
    } catch {
      let filtered = DEMO_ARCHIVES;
      if (search) filtered = filtered.filter(a =>
        a.patient_nom.toLowerCase().includes(search.toLowerCase()) ||
        a.reference.toLowerCase().includes(search.toLowerCase())
      );
      if (filterCat) filtered = filtered.filter(a => a.categorie === filterCat);
      setArchives(filtered);
      setTotal(filtered.length);
    } finally { setLoading(false); }
  }, [dispatch, page, search, filterCat, filterSvc, filterDate1, filterDate2]);

  const loadStats = useCallback(async () => {
    dispatch(fetchArchiveStats());
    try {
      const { data } = await api.get("/archives/stats");
      setKpis(data.kpis || kpis);
    } catch {
      setKpis({
        total: DEMO_ARCHIVES.length,
        patients: 8, consultations: 12, hospitalisations: 10,
        examens: 9, chirurgies: 4,
        taille_totale: "87.4 Mo",
        derniere_op: "Auj. 02:00 (auto)",
      });
    }
  }, [dispatch]);

  useEffect(() => { loadArchives(); loadStats(); }, [loadArchives, loadStats]);

  // Filter by nav category
  const catForNav = { patients:"patient", consultations:"consultation", laboratoire:"laboratoire", imagerie:"imagerie", hospitalisations:"hospitalisation", chirurgies:"chirurgie", financier:"financier", documents:"documents" };
  const filteredByNav = ["patients","consultations","laboratoire","imagerie","hospitalisations","chirurgies","financier","documents"].includes(active)
    ? archives.filter(a => a.categorie === catForNav[active])
    : archives;

  // Selection
  const handleSelect = (id, checked) => setSelectedIds(prev => checked ? [...prev, id] : prev.filter(x => x !== id));
  const handleSelectAll = (checked) => setSelectedIds(checked ? filteredByNav.map(a => a._id) : []);

  // Actions
  const handleView = (arc) => { setCurrentArc(arc); setModalView(true); };
  const handleRestore = (arc) => { setCurrentArc(arc); setRestoreMotif(""); setModalRestore(true); };
  const handleDelete = (arc) => { setCurrentArc(arc); setModalDelete(true); };

  const confirmRestore = async () => {
    const result = await dispatch(restoreArchive({ id: currentArc._id, motif: restoreMotif }));
    if (restoreArchive.fulfilled.match(result)) {
      toast.success(`✅ Dossier ${currentArc.reference} restauré`);
      setArchives(prev => prev.map(a => a._id === currentArc._id ? { ...a, statut:"restauré" } : a));
    } else {
      toast.success(`✅ ${currentArc.reference} restauré (local)`);
      setArchives(prev => prev.map(a => a._id === currentArc._id ? { ...a, statut:"restauré" } : a));
    }
    setModalRestore(false);
  };

  const confirmDelete = async () => {
    const result = await dispatch(deleteArchive(currentArc._id));
    if (deleteArchive.fulfilled.match(result)) {
      toast.success(`🗑️ Archive ${currentArc.reference} supprimée définitivement`);
    } else {
      toast.success(`🗑️ ${currentArc.reference} supprimée (local)`);
    }
    setArchives(prev => prev.filter(a => a._id !== currentArc._id));
    setModalDelete(false);
  };

  const handleExport = async (format) => {
    const result = await dispatch(exportArchives(format));
    if (exportArchives.fulfilled.match(result)) {
      toast.success(`📤 Export ${format.toUpperCase()} lancé`);
    } else {
      toast.success(`📤 Export ${format.toUpperCase()} (démo)`);
    }
  };

  // ─── Render section ────────────────────────────────────────
  const renderSection = () => {
    // ── Dashboard ──────────────────────────────────────────
    if (active === "dashboard") return (
      <div className="arfu">
        <div className="arc-section-top">
          <div>
            <div className="arc-section-title">📦 Tableau de bord — Archivage</div>
            <div className="arc-section-sub">Vue d'ensemble des archives de la clinique</div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button className="abtn abtn-ghost abtn-sm" onClick={() => handleExport("pdf")}>📄 PDF</button>
            <button className="abtn abtn-ghost abtn-sm" onClick={() => handleExport("excel")}>📊 Excel</button>
            <button className="abtn abtn-ghost abtn-sm" onClick={() => handleExport("csv")}>📋 CSV</button>
            <button className="abtn abtn-primary" onClick={() => setModalArchiver(true)}>
              {I.plus} Archiver manuellement
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:14, marginBottom:24 }}>
          {[
            { color:"blue",   icon:I.archive, value:kpis.total,          label:"Total archives",       sub:"tous types confondus",      onClick:() => setActive("recherche") },
            { color:"teal",   icon:I.patient, value:kpis.patients,        label:"Patients archivés",    sub:"dossiers inactifs",         onClick:() => setActive("patients") },
            { color:"green",  icon:I.consult, value:kpis.consultations,   label:"Consultations arch.",  sub:"dossiers clôturés",         onClick:() => setActive("consultations") },
            { color:"purple", icon:I.bed,     value:kpis.hospitalisations,label:"Hospitalisations arch.",sub:"séjours terminés",         onClick:() => setActive("hospitalisations") },
            { color:"orange", icon:I.lab,     value:kpis.examens,         label:"Examens archivés",     sub:"labos + imagerie",          onClick:() => setActive("laboratoire") },
            { color:"red",    icon:I.surgery, value:kpis.chirurgies,      label:"Chirurgies arch.",     sub:"interventions clôturées",   onClick:() => setActive("chirurgies") },
          ].map((k, i) => (
            <div key={i} className={`arc-kpi ${k.color}`} onClick={k.onClick} style={{ cursor:"pointer" }}>
              <div className={`arc-kpi-icon ${k.color}`}>{k.icon}</div>
              <div className="arc-kpi-val">{k.value}</div>
              <div className="arc-kpi-lbl">{k.label}</div>
              <div className="arc-kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Storage + Info */}
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:20, marginBottom:20 }}>
          <div className="arc-card">
            <div className="arc-card-hdr">
              <h3>📊 Répartition par catégorie</h3>
              <Badge cls="blue">{kpis.taille_totale} total</Badge>
            </div>
            <div className="arc-card-body">
              {[
                ["👤 Patients",          kpis.patients,          "#1B4F9E", 8],
                ["🩺 Consultations",     kpis.consultations,     "#0EA5A0", 12],
                ["🛏️ Hospitalisations",  kpis.hospitalisations,  "#D97706", 10],
                ["🔬 Examens labo",      kpis.examens,           "#059669", 9],
                ["🩻 Imagerie",          5,                      "#7C3AED", 5],
                ["🔪 Chirurgies",        kpis.chirurgies,        "#DC2626", 4],
                ["💰 Financier",         6,                      "#7C3AED", 6],
              ].map(([lbl, val, col, n]) => (
                <div key={lbl} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, color:"var(--am)" }}>{lbl}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:"var(--an)" }}>{n} archives</span>
                  </div>
                  <Prog pct={kpis.total > 0 ? Math.round(n / kpis.total * 100) : 0} color={col} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div className="arc-card">
              <div className="arc-card-hdr"><h3>💾 Espace de stockage</h3></div>
              <div className="arc-card-body">
                <div className="arc-storage">
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
                    <span style={{ fontWeight:600, color:"var(--an)" }}>Utilisé : {kpis.taille_totale}</span>
                    <span style={{ color:"var(--am)" }}>Total : 2 Go</span>
                  </div>
                  <div className="arc-storage-bar">
                    <div className="arc-storage-seg" style={{ width:"4%", background:"#1B4F9E" }} />
                    <div className="arc-storage-seg" style={{ width:"2%", background:"#0EA5A0" }} />
                    <div className="arc-storage-seg" style={{ width:"52%", background:"#7C3AED" }} />
                    <div className="arc-storage-seg" style={{ width:"1%", background:"#059669" }} />
                  </div>
                  <div style={{ fontSize:11, color:"#9CA3AF", marginTop:4 }}>4.4% utilisé · 95.6% disponible</div>
                </div>
              </div>
            </div>
            <div className="arc-card">
              <div className="arc-card-hdr"><h3>⏱ Dernière opération</h3></div>
              <div className="arc-card-body" style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ background:"#ECFDF5", border:"1.5px solid #A7F3D0", borderRadius:10, padding:"10px 14px" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--ag)", textTransform:"uppercase" }}>Archivage automatique</div>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--an)", marginTop:2 }}>{kpis.derniere_op}</div>
                  <div style={{ fontSize:11, color:"var(--am)", marginTop:2 }}>12 dossiers archivés</div>
                </div>
                <div style={{ background:"#EFF6FF", border:"1.5px solid #BFDBFE", borderRadius:10, padding:"10px 14px" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--ab)", textTransform:"uppercase" }}>Prochaine opération</div>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--an)", marginTop:2 }}>Demain 02:00</div>
                  <div style={{ fontSize:11, color:"var(--am)", marginTop:2 }}>Archivage quotidien automatique</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent archives table */}
        <div className="arc-card">
          <div className="arc-card-hdr">
            <h3>{I.archive} Archives récentes</h3>
            <button className="abtn abtn-ghost abtn-sm" onClick={() => setActive("recherche")}>Voir toutes →</button>
          </div>
          <ArchiveTable
            data={archives.slice(0, 6)}
            onView={handleView} onRestore={handleRestore} onDelete={handleDelete}
            selectedIds={selectedIds} onSelect={handleSelect} onSelectAll={handleSelectAll}
          />
        </div>
      </div>
    );

    // ── Recherche avancée ─────────────────────────────────
    if (active === "recherche") return (
      <div className="arfu">
        <div className="arc-section-top">
          <div>
            <div className="arc-section-title">{I.search} Recherche avancée</div>
            <div className="arc-section-sub">{total} archive(s) trouvée(s)</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {selectedIds.length > 0 && (
              <>
                <button className="abtn abtn-success abtn-sm" onClick={() => toast.success(`✅ ${selectedIds.length} dossier(s) restaurés`)}>
                  {I.restore} Restaurer ({selectedIds.length})
                </button>
                <button className="abtn abtn-ghost abtn-sm" onClick={() => handleExport("pdf")}>
                  {I.export} Exporter ({selectedIds.length})
                </button>
              </>
            )}
            <button className="abtn abtn-ghost abtn-sm" onClick={() => handleExport("excel")}>{I.export} Export Excel</button>
            <button className="abtn abtn-primary" onClick={() => setModalArchiver(true)}>{I.plus} Archiver</button>
          </div>
        </div>

        {/* Filters */}
        <div className="arc-card" style={{ marginBottom:16 }}>
          <div className="arc-card-hdr"><h3>{I.filter} Filtres de recherche</h3></div>
          <div className="arc-card-body">
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr", gap:12, alignItems:"end" }}>
              <div>
                <label className="albl">Recherche rapide</label>
                <div style={{ position:"relative" }}>
                  <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }}>{I.search}</span>
                  <input className="ainp" style={{ paddingLeft:34 }} placeholder="Nom patient, n° dossier, référence..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                </div>
              </div>
              <div>
                <label className="albl">Catégorie</label>
                <select className="ainp" value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1); }}>
                  <option value="">Toutes</option>
                  {Object.entries(CAT_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="albl">Date début</label>
                <input type="date" className="ainp" value={filterDate1} onChange={e => setDate1(e.target.value)} />
              </div>
              <div>
                <label className="albl">Date fin</label>
                <input type="date" className="ainp" value={filterDate2} onChange={e => setDate2(e.target.value)} />
              </div>
              <div>
                <label className="albl">Service</label>
                <input className="ainp" placeholder="Ex: Médecine..." value={filterSvc} onChange={e => setFilterSvc(e.target.value)} />
              </div>
            </div>
            <div style={{ display:"flex", gap:8, marginTop:12 }}>
              <button className="abtn abtn-primary abtn-sm" onClick={loadArchives}>{I.search} Rechercher</button>
              <button className="abtn abtn-ghost abtn-sm" onClick={() => { setSearch(""); setFilterCat(""); setFilterSvc(""); setDate1(""); setDate2(""); setPage(1); }}>
                Réinitialiser
              </button>
            </div>
          </div>
        </div>

        {/* Category quick tabs */}
        <div className="arc-cat-tabs">
          <button className={`arc-cat-tab ${!filterCat ? "active" : ""}`} onClick={() => setFilterCat("")}>
            📦 Toutes ({archives.length})
          </button>
          {Object.entries(CAT_CONFIG).map(([k, v]) => (
            <button key={k} className={`arc-cat-tab ${filterCat === k ? "active" : ""}`} onClick={() => setFilterCat(k)}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>

        <div className="arc-card">
          {loading ? (
            <div style={{ padding:40, textAlign:"center", color:"var(--am)" }}>
              <div style={{ width:36, height:36, border:"3px solid #EEF4FF", borderTop:"3px solid #1B4F9E", borderRadius:"50%", animation:"spin 1s linear infinite", margin:"0 auto 12px" }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              Chargement...
            </div>
          ) : (
            <ArchiveTable
              data={filteredByNav}
              onView={handleView} onRestore={handleRestore} onDelete={handleDelete}
              selectedIds={selectedIds} onSelect={handleSelect} onSelectAll={handleSelectAll}
            />
          )}
          {total > 15 && (
            <div className="arc-pag">
              <span style={{ fontSize:12, color:"var(--am)" }}>Page {page} / {Math.ceil(total/15)} · {total} archives</span>
              <div style={{ display:"flex", gap:8 }}>
                {page > 1 && <button className="abtn abtn-ghost abtn-sm" onClick={() => setPage(p=>p-1)}>← Précédent</button>}
                {page < Math.ceil(total/15) && <button className="abtn abtn-primary abtn-sm" onClick={() => setPage(p=>p+1)}>Suivant →</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    );

    // ── Category views ─────────────────────────────────────
    if (["patients","consultations","laboratoire","imagerie","hospitalisations","chirurgies","financier","documents"].includes(active)) {
      const cat = catForNav[active];
      const catConf = CAT_CONFIG[cat] || CAT_CONFIG.documents;
      const navItem = NAV_ITEMS.flatMap(g=>g.items).find(i=>i.key===active);
      const catData = archives.filter(a => a.categorie === cat);
      return (
        <div className="arfu">
          <div className="arc-section-top">
            <div>
              <div className="arc-section-title">{catConf.icon} {navItem?.label || active}</div>
              <div className="arc-section-sub">{catData.length} archive(s) dans cette catégorie</div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="abtn abtn-ghost abtn-sm" onClick={() => handleExport("pdf")}>{I.export} PDF</button>
              <button className="abtn abtn-ghost abtn-sm" onClick={() => handleExport("excel")}>{I.export} Excel</button>
              {selectedIds.length > 0 && (
                <button className="abtn abtn-success abtn-sm" onClick={() => toast.success(`✅ ${selectedIds.length} restaurés`)}>
                  {I.restore} Restaurer ({selectedIds.length})
                </button>
              )}
            </div>
          </div>

          {catData.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:20 }}>
              {[
                { lbl:"Total archives",      val:catData.length },
                { lbl:"Taille totale",       val:catData.reduce((s,a)=>s+parseFloat(a.taille||0),0).toFixed(1)+" Mo" },
                { lbl:"Documents totaux",    val:catData.reduce((s,a)=>s+(a.nb_docs||0),0) },
                { lbl:"Restauré(s)",         val:catData.filter(a=>a.statut==="restauré").length },
              ].map((k,i) => (
                <div key={i} style={{ background:"#fff", border:"1.5px solid var(--abr)", borderRadius:14, padding:"14px 18px", boxShadow:"var(--sh)" }}>
                  <div style={{ fontSize:20, fontWeight:800, color:catConf.color, letterSpacing:-1 }}>{k.val}</div>
                  <div style={{ fontSize:11.5, fontWeight:600, color:"var(--am)", marginTop:2 }}>{k.lbl}</div>
                </div>
              ))}
            </div>
          )}

          <div className="arc-card">
            <ArchiveTable
              data={catData}
              onView={handleView} onRestore={handleRestore} onDelete={handleDelete}
              selectedIds={selectedIds} onSelect={handleSelect} onSelectAll={handleSelectAll}
            />
          </div>
        </div>
      );
    }

    // ── Restaurations ─────────────────────────────────────
    if (active === "restaurations") return (
      <div className="arfu">
        <div className="arc-section-top">
          <div>
            <div className="arc-section-title">{I.restore} Historique des restaurations</div>
            <div className="arc-section-sub">{DEMO_RESTAURATIONS.length} restauration(s) effectuée(s)</div>
          </div>
          <button className="abtn abtn-ghost abtn-sm" onClick={() => handleExport("pdf")}>{I.export} Exporter</button>
        </div>

        <div className="al-arc-info" style={{ fontSize:12 }}>
          <strong>ℹ️ Restauration :</strong> Un dossier restauré redevient accessible dans son module d'origine. Il peut être ré-archivé à tout moment.
        </div>

        <div className="arc-card">
          <div style={{ overflowX:"auto" }}>
            <table className="arc-tbl">
              <thead>
                <tr><th>Référence</th><th>Patient</th><th>Date restauration</th><th>Utilisateur</th><th>Motif</th><th>Statut</th></tr>
              </thead>
              <tbody>
                {DEMO_RESTAURATIONS.map((r, i) => (
                  <tr key={i}>
                    <td><span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--ab)", fontSize:12 }}>{r.reference}</span></td>
                    <td style={{ fontWeight:600, color:"var(--an)" }}>{r.patient}</td>
                    <td style={{ fontSize:12, color:"var(--am)" }}>{fmtDate(r.date_rest)}</td>
                    <td style={{ fontSize:12, color:"var(--am)" }}>{r.user}</td>
                    <td style={{ fontSize:12, color:"var(--am)" }}>{r.motif}</td>
                    <td><Badge cls="green">✅ {r.statut}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );

    // ── Journal d'audit ───────────────────────────────────
    if (active === "audit") return (
      <div className="arfu">
        <div className="arc-section-top">
          <div>
            <div className="arc-section-title">{I.audit} Journal d'audit</div>
            <div className="arc-section-sub">Traçabilité complète de toutes les opérations d'archivage</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button className="abtn abtn-ghost abtn-sm" onClick={() => handleExport("pdf")}>📄 PDF</button>
            <button className="abtn abtn-ghost abtn-sm" onClick={() => handleExport("excel")}>📊 Excel</button>
            <button className="abtn abtn-ghost abtn-sm" onClick={() => handleExport("csv")}>📋 CSV</button>
            <button className="abtn abtn-ghost abtn-sm" onClick={loadArchives}>{I.refresh}</button>
          </div>
        </div>

        <div className="arc-card">
          <div style={{ overflowX:"auto" }}>
            <table className="arc-tbl">
              <thead><tr><th>Utilisateur</th><th>Action</th><th>Type</th><th>Date & Heure</th><th>Adresse IP</th></tr></thead>
              <tbody>
                {DEMO_LOGS.map((log, i) => {
                  const tc = {
                    view:     ["teal",   "👁 Consultation"],
                    export:   ["blue",   "📤 Export"],
                    restore:  ["green",  "↩ Restauration"],
                    download: ["purple", "📥 Téléchargement"],
                    archive:  ["blue",   "📦 Archivage"],
                    delete:   ["red",    "🗑️ Suppression"],
                    print:    ["gray",   "🖨 Impression"],
                    config:   ["orange", "⚙️ Configuration"],
                  }[log.type] || ["gray","•"];
                  return (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight:600, color:"var(--an)", fontSize:13 }}>{log.user}</div>
                      </td>
                      <td style={{ fontSize:12, color:"var(--am)" }}>{log.action}</td>
                      <td><Badge cls={tc[0]}>{tc[1]}</Badge></td>
                      <td style={{ fontSize:12, color:"var(--am)", fontFamily:"monospace" }}>{log.date}</td>
                      <td style={{ fontSize:12, fontFamily:"monospace", color:"var(--am)" }}>{log.ip}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );

    // ── Paramètres d'archivage ────────────────────────────
    if (active === "parametres") return (
      <div className="arfu">
        <div className="arc-section-top">
          <div>
            <div className="arc-section-title">{I.config} Paramètres d'archivage</div>
            <div className="arc-section-sub">Configuration des règles d'archivage automatique</div>
          </div>
          <button className="abtn abtn-teal" onClick={() => toast.success("✅ Paramètres enregistrés")}>
            💾 Enregistrer
          </button>
        </div>

        <div className="al-arc-warn" style={{ fontSize:12 }}>
          <strong>⚠️ Attention :</strong> Les règles d'archivage automatique s'appliquent à l'ensemble des modules. Une fois archivés, les dossiers ne sont plus visibles dans les vues actives.
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          {/* Auto config */}
          <div className="arc-card">
            <div className="arc-card-hdr"><h3>⚙️ Archivage automatique</h3></div>
            <div className="arc-card-body" style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px", background:"#F8FAFD", borderRadius:10, border:"1.5px solid var(--abr)" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--an)" }}>Activer l'archivage automatique</div>
                  <div style={{ fontSize:11, color:"var(--am)" }}>Exécuté chaque nuit à 02:00</div>
                </div>
                <Toggle checked={configAuto.actif} onChange={v => setConfigAuto(p=>({...p,actif:v}))} />
              </div>
              <div>
                <label className="albl">Durée avant archivage automatique</label>
                <select className="ainp" value={configAuto.duree} onChange={e => setConfigAuto(p=>({...p,duree:e.target.value}))}>
                  <option value="1an">Après 1 an</option>
                  <option value="3ans">Après 3 ans</option>
                  <option value="5ans">Après 5 ans</option>
                  <option value="custom">Personnalisé</option>
                </select>
              </div>
              <div>
                <label className="albl">Heure d'exécution</label>
                <input type="time" className="ainp" style={{ width:120 }} defaultValue="02:00" />
              </div>
              <div style={{ background:"#EEF4FF", borderRadius:12, padding:"12px 14px" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--am)", textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>📅 Prochaine exécution</div>
                <div style={{ fontSize:14, fontWeight:700, color:"var(--ab)" }}>Demain à 02:00</div>
                <div style={{ fontSize:11, color:"var(--am)", marginTop:2 }}>Estimation : ~{kpis.total > 0 ? Math.ceil(kpis.total * 0.1) : 3} nouveaux dossiers à archiver</div>
              </div>
            </div>
          </div>

          {/* Elements */}
          <div className="arc-card">
            <div className="arc-card-hdr"><h3>📋 Éléments concernés par l'archivage auto</h3></div>
            <div className="arc-card-body" style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {[
                { key:"consultations",    label:"Consultations clôturées",  icon:"🩺", desc:"Après délai défini ci-contre" },
                { key:"hospitalisations", label:"Hospitalisations terminées",icon:"🛏️", desc:"Après sortie définitive du patient" },
                { key:"factures",         label:"Factures soldées",         icon:"💰", desc:"Après paiement complet" },
                { key:"examens",          label:"Examens validés",          icon:"🔬", desc:"Résultats finaux validés" },
              ].map(item => (
                <div key={item.key} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"#F8FAFD", borderRadius:10, border:"1.5px solid var(--abr)" }}>
                  <span style={{ fontSize:20 }}>{item.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--an)" }}>{item.label}</div>
                    <div style={{ fontSize:11, color:"var(--am)" }}>{item.desc}</div>
                  </div>
                  <Toggle
                    checked={configAuto[item.key]}
                    onChange={v => setConfigAuto(p=>({...p,[item.key]:v}))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Obligations légales */}
        <div className="arc-card">
          <div className="arc-card-hdr"><h3>⚖️ Obligations légales de conservation</h3></div>
          <div className="arc-card-body">
            <div style={{ overflowX:"auto" }}>
              <table className="arc-tbl">
                <thead><tr><th>Type de document</th><th>Durée légale</th><th>Base légale</th><th>Suppression autorisée après</th></tr></thead>
                <tbody>
                  {[
                    ["Dossier médical patient",        "20 ans",  "Code de santé publique",      "20 ans après dernière visite"],
                    ["Ordonnances",                    "5 ans",   "Code de santé publique",      "5 ans après émission"],
                    ["Comptes rendus opératoires",     "20 ans",  "Code de santé publique",      "20 ans après intervention"],
                    ["Factures & documents financiers","10 ans",  "Code de commerce",            "10 ans après émission"],
                    ["Résultats de laboratoire",       "20 ans",  "Bonnes pratiques médicales",  "20 ans après validation"],
                    ["Images médicales (DICOM)",       "20 ans",  "Code de santé publique",      "20 ans après acquisition"],
                    ["Consentements éclairés",         "20 ans",  "Code de santé publique",      "20 ans après signature"],
                  ].map(([type,duree,base,suppr]) => (
                    <tr key={type}>
                      <td style={{ fontWeight:600, color:"var(--an)", fontSize:12.5 }}>{type}</td>
                      <td><Badge cls="blue">{duree}</Badge></td>
                      <td style={{ fontSize:11, color:"var(--am)" }}>{base}</td>
                      <td style={{ fontSize:11, color:"var(--am)" }}>{suppr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Export global */}
        <div className="arc-card">
          <div className="arc-card-hdr"><h3>📤 Options d'exportation</h3></div>
          <div className="arc-card-body">
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12 }}>
              {[
                { ico:"📄", label:"Export individuel",      desc:"Un seul dossier archive",      onClick:() => toast.success("📄 Export individuel") },
                { ico:"📊", label:"Export par période",     desc:"Sélection d'une plage de dates",onClick:() => toast.success("📊 Export par période") },
                { ico:"🗂️",  label:"Export par service",    desc:"Tous les dossiers d'un service",onClick:() => toast.success("🗂️ Export par service") },
                { ico:"💾", label:"Sauvegarde complète",   desc:"Toutes les archives en ZIP",    onClick:() => toast.success("💾 Sauvegarde complète lancée") },
              ].map(e => (
                <button key={e.label} style={{ background:"#F8FAFD", border:"1.5px solid var(--abr)", borderRadius:14, padding:"14px 16px", textAlign:"left", cursor:"pointer", display:"flex", flexDirection:"column", gap:6, transition:"all .2s", fontFamily:"Poppins,sans-serif" }}
                  onMouseOver={ev=>ev.currentTarget.style.background="#EEF4FF"}
                  onMouseOut={ev=>ev.currentTarget.style.background="#F8FAFD"}
                  onClick={e.onClick}>
                  <span style={{ fontSize:22 }}>{e.ico}</span>
                  <div style={{ fontWeight:700, color:"var(--an)", fontSize:13 }}>{e.label}</div>
                  <div style={{ fontSize:11, color:"var(--am)" }}>{e.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );

    return null;
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="arc">
        <div className="arc-wrap">

          {/* ── SIDEBAR ── */}
          <aside className="arc-sidebar">
            <div className="arc-sidebar-hdr">
              <h2>📦 Archivage</h2>
              <p>{kpis.total} archives · {kpis.taille_totale}</p>
            </div>
            {NAV_ITEMS.map(group => (
              <div key={group.group} className="arc-nav-group">
                <span className="arc-nav-group-label">{group.group}</span>
                {group.items.map(item => (
                  <button key={item.key} className={`arc-nav-item ${active === item.key ? "active" : ""}`} onClick={() => setActive(item.key)}>
                    <span style={{ opacity:.85, flexShrink:0 }}>{item.icon}</span>
                    <span style={{ flex:1, textAlign:"left" }}>{item.label}</span>
                    {item.badge && <span className={`arc-nav-badge ${item.badgeCls||""}`}>{item.badge}</span>}
                  </button>
                ))}
              </div>
            ))}

            {/* Sidebar footer */}
            <div style={{ padding:"14px 16px", borderTop:"1.5px solid var(--abr)", margin:"10px 10px 0" }}>
              <div style={{ background:"linear-gradient(135deg,var(--an),var(--an2))", borderRadius:12, padding:"12px 14px" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,.6)", textTransform:"uppercase", letterSpacing:.5, marginBottom:6 }}>
                  🔒 Conformité légale
                </div>
                <div style={{ fontSize:12, color:"#fff", fontWeight:500, lineHeight:1.5 }}>
                  Conservation conforme au code de santé publique.
                </div>
                <div style={{ marginTop:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"rgba(255,255,255,.6)", marginBottom:4 }}>
                    <span>Stockage</span><span>4.4%</span>
                  </div>
                  <div style={{ background:"rgba(255,255,255,.15)", borderRadius:99, height:5, overflow:"hidden" }}>
                    <div style={{ width:"4.4%", height:"100%", background:"#0EA5A0", borderRadius:99 }} />
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* ── CONTENT ── */}
          <main className="arc-content">
            {renderSection()}
          </main>
        </div>

        {/* ═══ MODAL : VOIR ARCHIVE ═══ */}
        <Modal open={modalView} onClose={() => setModalView(false)} title={`📦 ${currentArc?.reference || "Archive"}`}>
          {currentArc && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {[
                  ["Référence",     currentArc.reference],
                  ["Patient",       currentArc.patient_nom],
                  ["Catégorie",     CAT_CONFIG[currentArc.categorie]?.label || currentArc.categorie],
                  ["Service",       currentArc.service],
                  ["Date d'archivage", fmtDate(currentArc.date_archive)],
                  ["Archivé par",   currentArc.archive_par],
                  ["Motif",         currentArc.motif],
                  ["Taille",        currentArc.taille],
                  ["Nb documents",  currentArc.nb_docs + " document(s)"],
                  ["Statut",        currentArc.statut],
                ].map(([lbl,val]) => (
                  <div key={lbl} style={{ background:"#F8FAFD", borderRadius:10, padding:"10px 14px" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"var(--am)", textTransform:"uppercase", letterSpacing:.4 }}>{lbl}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--an)", marginTop:2 }}>{val}</div>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--am)", textTransform:"uppercase", letterSpacing:.5, marginBottom:10 }}>📄 Documents disponibles</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {[
                    ["📋","Dossier médical complet","PDF · 1.2 Mo"],
                    ["💊","Ordonnances","PDF · 0.3 Mo"],
                    ["📊","Résultats examens","PDF · 0.5 Mo"],
                    ["🖼","Images médicales","ZIP · 2.4 Mo"],
                    ["🧾","Factures","PDF · 0.1 Mo"],
                    ["✍️","Consentements signés","PDF · 0.3 Mo"],
                  ].slice(0, currentArc.nb_docs || 3).map(([ico,nom,size]) => (
                    <div key={nom} style={{ background:"#F8FAFD", border:"1.5px solid var(--abr)", borderRadius:10, padding:"10px 12px", display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:18 }}>{ico}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:"var(--an)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{nom}</div>
                        <div style={{ fontSize:10, color:"var(--am)" }}>{size}</div>
                      </div>
                      <button className="abtn abtn-ghost abtn-sm" style={{ padding:"4px 8px" }} onClick={() => toast.success(`📥 Téléchargement : ${nom}`)}>{I.download}</button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <button className="abtn abtn-ghost" onClick={() => { setModalView(false); toast.success(`📥 Export complet : ${currentArc.reference}`); }}>{I.download} Télécharger tout</button>
                <button className="abtn abtn-ghost" onClick={() => toast.success(`🖨 Impression : ${currentArc.reference}`)}>{I.print} Imprimer</button>
                {currentArc.statut !== "restauré" && (
                  <button className="abtn abtn-success" onClick={() => { setModalView(false); handleRestore(currentArc); }}>{I.restore} Restaurer</button>
                )}
              </div>
            </div>
          )}
        </Modal>

        {/* ═══ MODAL : RESTAURER ═══ */}
        <Modal open={modalRestore} onClose={() => setModalRestore(false)} title="↩ Restaurer le dossier" maxWidth={500}>
          {currentArc && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div className="al-arc-info" style={{ marginBottom:0 }}>
                <strong style={{ color:"#1E40AF" }}>📦 Dossier à restaurer : {currentArc.reference}</strong>
                <div style={{ fontSize:12, color:"#3B82F6", marginTop:4 }}>
                  Patient : {currentArc.patient_nom} · Catégorie : {CAT_CONFIG[currentArc.categorie]?.label}
                </div>
              </div>
              <div style={{ background:"#ECFDF5", border:"1.5px solid #A7F3D0", borderRadius:12, padding:"12px 14px", fontSize:12, color:"var(--ag)" }}>
                ✅ Ce dossier redeviendra accessible dans son module d'origine. Vous pourrez le ré-archiver à tout moment.
              </div>
              <div>
                <label className="albl">Motif de la restauration *</label>
                <textarea className="ainp" rows={3} value={restoreMotif} onChange={e => setRestoreMotif(e.target.value)} placeholder="Ex: Consultation de suivi urgente, demande du patient, expertise médico-légale..." />
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button className="abtn abtn-ghost" onClick={() => setModalRestore(false)}>Annuler</button>
                <button className="abtn abtn-success" style={{ marginLeft:"auto" }} disabled={!restoreMotif.trim()} onClick={confirmRestore}>
                  {I.restore} Confirmer la restauration
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* ═══ MODAL : SUPPRIMER ═══ */}
        <Modal open={modalDelete} onClose={() => setModalDelete(false)} title="🗑️ Suppression définitive" maxWidth={480}>
          {currentArc && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div className="al-arc-danger" style={{ marginBottom:0 }}>
                <strong style={{ color:"#B91C1C", fontSize:14 }}>⚠️ Action irréversible</strong>
                <div style={{ fontSize:12, color:"#DC2626", marginTop:4 }}>
                  La suppression définitive de <strong>{currentArc.reference}</strong> est irréversible. Tous les documents associés seront perdus.
                </div>
              </div>
              <div style={{ background:"#F8FAFD", border:"1.5px solid var(--abr)", borderRadius:12, padding:"12px 14px" }}>
                <div style={{ fontSize:12, color:"var(--am)" }}>
                  <div><strong>Patient :</strong> {currentArc.patient_nom}</div>
                  <div><strong>Catégorie :</strong> {CAT_CONFIG[currentArc.categorie]?.label}</div>
                  <div><strong>Archivé le :</strong> {fmtDate(currentArc.date_archive)}</div>
                  <div><strong>Documents :</strong> {currentArc.nb_docs} fichier(s) · {currentArc.taille}</div>
                </div>
              </div>
              <div style={{ background:"#FEF3C7", border:"1.5px solid #FDE68A", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#92400E" }}>
                🔒 <strong>Autorisation requise :</strong> Cette action nécessite les droits Super Admin ou Admin Clinique.
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button className="abtn abtn-ghost" onClick={() => setModalDelete(false)}>Annuler</button>
                <button className="abtn abtn-danger" style={{ marginLeft:"auto" }} onClick={confirmDelete}>
                  {I.trash} Supprimer définitivement
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* ═══ MODAL : ARCHIVER MANUELLEMENT ═══ */}
        <Modal open={modalArchiver} onClose={() => setModalArchiver(false)} title="📦 Archivage manuel" maxWidth={540}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div className="al-arc-info" style={{ marginBottom:0, fontSize:12 }}>
              Archivez manuellement un dossier. Il ne sera plus visible dans les vues actives mais restera consultable ici.
            </div>
            <div>
              <label className="albl">Numéro de dossier / Référence *</label>
              <input className="ainp" placeholder="Ex: CHIR-2025-0001, PAT-0042..." />
            </div>
            <div>
              <label className="albl">Catégorie *</label>
              <select className="ainp">
                <option value="">— Sélectionner —</option>
                {Object.entries(CAT_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="albl">Service</label>
              <input className="ainp" placeholder="Ex: Médecine générale, Chirurgie..." />
            </div>
            <div>
              <label className="albl">Motif d'archivage *</label>
              <textarea className="ainp" rows={3} placeholder="Ex: Dossier clôturé, patient inactif depuis 1 an, demande de service..." />
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="abtn abtn-ghost" onClick={() => setModalArchiver(false)}>Annuler</button>
              <button className="abtn abtn-primary" style={{ marginLeft:"auto" }} onClick={() => { toast.success("📦 Dossier archivé avec succès"); setModalArchiver(false); }}>
                {I.archive} Archiver
              </button>
            </div>
          </div>
        </Modal>

      </div>
    </>
  );
}