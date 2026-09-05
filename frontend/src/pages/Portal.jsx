import { useState, useEffect, useRef, useCallback, useId } from "react";
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchPortalMe, fetchPortalAppointments, fetchPortalPrescriptions,
  fetchPortalLabResults, fetchPortalImaging, fetchPortalInvoices,
  fetchPortalNotifications, fetchPortalDashboard, markAllNotificationsRead,
  updatePortalProfile, changePortalPassword,
  selectPortalPatient, selectPortalStats, selectMustChangePassword,
  selectPortalAppointments, selectPortalPrescriptions, selectPortalLabResults,
  selectPortalImaging, selectPortalInvoices, selectPortalNotifications,
  selectPortalConstantes, selectPortalConstantesHistorique,
  selectPortalLoading, selectPortalSaving, selectPortalError, clearPortalError,
} from '../store/slices/portalSlice';
import { User, Calendar, Pencil } from 'lucide-react';
import Hero from '../components/UI/Hero';
import Button from '../components/UI/Button';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

// ─── Hook responsive — JavaScript pur, 100% fiable ────────────
function useScreenSize() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return { isMobile: w <= 767, isSmall: w <= 479, width: w };
}

// ─── CSS généré dynamiquement selon la taille d'écran ──────────
function buildResponsiveCSS({ isMobile, isSmall }) {
  if (!isMobile) return '';
  return `
    .ep-top     { padding: ${isSmall ? '8px 10px' : '10px 14px'} 0 !important; }
    .ep-header  { padding: 0 !important; }
    .ep-content { padding: ${isSmall ? '8px' : '10px'} !important; }

    .ep-g2, .ep-g11, .ep-g3 { grid-template-columns: 1fr !important; gap: 12px !important; }
    .ep-g11s  { grid-template-columns: ${isSmall ? '1fr' : '1fr 1fr'} !important; gap: 8px !important; }
    .ep-kpi-grid { grid-template-columns: repeat(${isSmall ? 2 : 3}, 1fr) !important; gap: 10px !important; }

    .ep-card     { border-radius: 14px !important; }
    .ep-card-hdr { padding: 11px 14px !important; flex-wrap: wrap !important; gap: 8px !important; }
    .ep-card-hdr h3 { font-size: 13px !important; }

    .ep-kpi  { padding: 14px 16px !important; border-radius: 14px !important; }
    .kpi-val { font-size: ${isSmall ? '18px' : '20px'} !important; }
    .kpi-icon { width: 34px !important; height: 34px !important; margin-bottom: 8px !important; }
    .kpi-sub { display: none !important; }
    .kpi-lbl { font-size: ${isSmall ? '10px' : '11px'} !important; }

    .ep-tbl th { padding: 8px 10px !important; font-size: 10px !important; }
    .ep-tbl td { padding: 8px 10px !important; font-size: 12px !important; }

    /* Tabs grille sur mobile */
    .ep-tabs { gap: 1px !important; padding: 2px 0 0 !important; }
    .ep-tab  { padding: ${isSmall ? '6px 6px 8px' : '7px 10px 9px'} !important; font-size: 10px !important; flex:1; min-width: ${isSmall ? '22%' : '17%'}; }
    .ep-tab-icon { font-size: ${isSmall ? '17px' : '18px'} !important; }

    .ebtn    { font-size: 12px !important; padding: 8px 12px !important; }
    .ebtn-sm { font-size: 11px !important; padding: 5px 8px !important; }
    .einp    { font-size: 16px !important; }

    .emov     { padding: 0 !important; align-items: flex-end !important; }
    .emov-box { border-radius: 20px 20px 0 0 !important; max-width: 100% !important; max-height: 93vh !important; }
    .emov-hdr { padding: 13px 16px !important; }
    .emov-body { padding: 14px !important; }

    .ep-info-row { padding: 8px 12px !important; }
    .ep-info-row .val { font-size: 12px !important; }
    .ep-stat { padding: 10px 12px !important; }
    .ep-stat-v { font-size: 18px !important; }
    .ep-notif { padding: 11px 13px !important; }
  `;
}

// ─── CSS Medical Navy + Teal (same design system) ──────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.ep * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --cn: #0B1E3B; --cn2: #132744; --cb: #1B4F9E;
  --ct: #0EA5A0; --ct2: #0D9490; --cr: #DC2626;
  --co: #D97706; --cg: #059669; --cp: #7C3AED;
  --cbr: #E2EAF4; --cm: #6B7A99; --cl: #EEF4FF; --cs: #F8FAFD;
  --sh: 0 1px 3px rgba(11,30,59,.08); --shm: 0 4px 16px rgba(11,30,59,.10); --shl: 0 12px 40px rgba(11,30,59,.14);
}

/* Topbar */
.ep-top { background:linear-gradient(135deg,var(--cn) 0%,var(--cn2) 55%,#1B4F9E 100%); padding:0; position:relative; overflow:hidden; }
.ep-top::before { content:''; position:absolute; top:-60px; right:-60px; width:240px; height:240px; background:radial-gradient(circle,rgba(14,165,160,.18) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
.ep-top::after { content:''; position:absolute; bottom:-40px; left:20%; width:180px; height:180px; background:radial-gradient(circle,rgba(27,79,158,.25) 0%,transparent 70%); border-radius:50%; pointer-events:none; }

/* Header patient */
.ep-header { padding:20px 24px 0; position:relative; z-index:2; }

/* Tabs bar — séparé du topbar pour éviter le clipping overflow:hidden */
.ep-tabs-bar { background:linear-gradient(135deg,var(--cn) 0%,var(--cn2) 55%,#1B4F9E 100%); padding:0 8px; border-bottom:2px solid rgba(255,255,255,.08); }
.ep-tabs { display:flex; flex-wrap:wrap; gap:2px; padding:4px 0 0; }
.ep-tab { display:flex; flex-direction:column; align-items:center; gap:3px; padding:8px 14px 10px; font-size:11px; font-weight:600; color:rgba(255,255,255,.55); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; min-width:0; position:relative; }
.ep-tab:hover { color:rgba(255,255,255,.88); background:rgba(255,255,255,.08); }
.ep-tab.active { color:var(--cn); background:var(--cs); box-shadow:0 -2px 0 var(--ct) inset; }
.ep-tab-icon { font-size:18px; line-height:1; }
.ep-tab-lbl { font-size:10px; font-weight:600; line-height:1; }
.ep-tab-badge { background:var(--cr); color:#fff; font-size:9px; font-weight:700; padding:0 5px; border-radius:99px; position:absolute; top:4px; right:6px; animation:epP 2s infinite; min-width:14px; text-align:center; }
@keyframes epP { 0%,100%{opacity:1} 50%{opacity:.4} }

/* Cards */
.ep-card { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; }
.ep-card:hover { box-shadow:var(--shm); }
.ep-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.ep-card-hdr h3 { font-size:14px; font-weight:700; color:var(--cn); margin:0; display:flex; align-items:center; gap:8px; }
.ep-card-hdr p { font-size:11px; color:var(--cm); margin:2px 0 0; }

/* KPI */
.ep-kpi { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:pointer; }
.ep-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.ep-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.ep-kpi.blue::before   { background:var(--cb); } .ep-kpi.teal::before   { background:var(--ct); }
.ep-kpi.red::before    { background:var(--cr); } .ep-kpi.orange::before { background:var(--co); }
.ep-kpi.green::before  { background:var(--cg); } .ep-kpi.purple::before { background:var(--cp); }
.kpi-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
.kpi-icon.blue   { background:#EFF6FF; color:var(--cb); } .kpi-icon.teal   { background:#F0FDFC; color:var(--ct); }
.kpi-icon.red    { background:#FEF2F2; color:var(--cr); } .kpi-icon.orange { background:#FFF7ED; color:var(--co); }
.kpi-icon.green  { background:#ECFDF5; color:var(--cg); } .kpi-icon.purple { background:#F5F3FF; color:var(--cp); }
.kpi-val { font-size:26px; font-weight:800; color:var(--cn); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.kpi-lbl { font-size:11.5px; font-weight:600; color:var(--cm); }
.kpi-sub { font-size:10.5px; color:#9CA3AF; margin-top:2px; }
.kpi-dot { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--cr); animation:epP 2s infinite; }

/* Badges */
.ebdg { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.ebdg.red    { background:#FEF2F2; color:var(--cr); border:1px solid #FECACA; }
.ebdg.orange { background:#FFF7ED; color:var(--co); border:1px solid #FED7AA; }
.ebdg.yellow { background:#FEFCE8; color:#CA8A04;   border:1px solid #FEF08A; }
.ebdg.green  { background:#ECFDF5; color:var(--cg); border:1px solid #A7F3D0; }
.ebdg.blue   { background:#EFF6FF; color:var(--cb); border:1px solid #BFDBFE; }
.ebdg.teal   { background:#F0FDFC; color:var(--ct); border:1px solid #99F6E4; }
.ebdg.purple { background:#F5F3FF; color:var(--cp); border:1px solid #DDD6FE; }
.ebdg.gray   { background:#F9FAFB; color:#4B5563;   border:1px solid #E5E7EB; }

/* Progress */
.ep-prog { background:#EEF4FF; border-radius:99px; height:7px; overflow:hidden; }
.ep-prog-f { height:100%; border-radius:99px; transition:width .5s; }

/* Buttons */
.ebtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; text-decoration:none; }
.ebtn-primary { background:var(--cb); color:#fff; } .ebtn-primary:hover { background:#174391; transform:translateY(-1px); }
.ebtn-teal    { background:var(--ct); color:#fff; } .ebtn-teal:hover    { background:var(--ct2); transform:translateY(-1px); }
.ebtn-ghost   { background:transparent; color:var(--cm); border:1.5px solid var(--cbr); }
.ebtn-ghost:hover { background:var(--cl); color:var(--cn); }
.ebtn-danger  { background:#FEF2F2; color:var(--cr); border:1.5px solid #FECACA; }
.ebtn-danger:hover { background:var(--cr); color:#fff; }
.ebtn-sm { padding:6px 12px; font-size:12px; }
.ebtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }

/* Forms */
.elbl { font-size:12px; font-weight:600; color:var(--cm); margin-bottom:6px; display:block; }
.einp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--cbr); background:#FAFBFF; font-size:13px; color:var(--cn); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.einp:focus { border-color:var(--ct); box-shadow:0 0 0 3px rgba(14,165,160,.12); }

/* Table */
.ep-tbl { width:100%; border-collapse:collapse; }
.ep-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.ep-tbl th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--cm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--cbr); white-space:nowrap; }
.ep-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.ep-tbl tbody tr:last-child td { border-bottom:none; }
.ep-tbl tbody tr:hover { background:#F8FAFF; }

/* Modal */
.emov { position:fixed; inset:0; z-index:500; background:rgba(11,30,59,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.emov-box { background:#fff; border-radius:20px; box-shadow:var(--shl); width:100%; max-width:540px; max-height:90vh; overflow-y:auto; animation:epSlide .25s ease; }
@keyframes epSlide { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.emov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:#EEF4FF; position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.emov-hdr h3 { font-size:16px; font-weight:700; color:var(--cn); margin:0; }
.emov-cls { width:32px; height:32px; border-radius:8px; background:#F3F7FF; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--cm); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.emov-cls:hover { background:#FEF2F2; color:var(--cr); }
.emov-body { padding:24px; }

/* Alerts */
.al-info   { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; border-left:4px solid var(--cb); border-radius:14px; padding:14px 18px; }
.al-warn  { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--co); border-radius:14px; padding:14px 18px; }
.al-success { background:linear-gradient(135deg,#ECFDF5,#D1FAE5); border:1.5px solid #A7F3D0; border-left:4px solid var(--cg); border-radius:14px; padding:14px 18px; }

/* Info row */
.ep-info-row { background:#F8FAFD; border-radius:10px; padding:10px 14px; }
.ep-info-row .lbl { font-size:10px; font-weight:600; color:var(--cm); text-transform:uppercase; letter-spacing:.4px; }
.ep-info-row .val { font-size:13px; font-weight:600; color:var(--cn); margin-top:2px; }

/* Timeline */
.ep-timeline { position:relative; padding-left:28px; }
.ep-timeline::before { content:''; position:absolute; left:9px; top:8px; bottom:8px; width:2px; background:var(--cbr); border-radius:2px; }
.ep-tl-item { position:relative; margin-bottom:20px; }
.ep-tl-dot { position:absolute; left:-23px; top:4px; width:12px; height:12px; border-radius:50%; border:2.5px solid #fff; box-shadow:0 0 0 2px var(--cbr); }
.ep-tl-dot.teal   { background:var(--ct); box-shadow:0 0 0 2px #99F6E4; }
.ep-tl-dot.blue   { background:var(--cb); box-shadow:0 0 0 2px #BFDBFE; }
.ep-tl-dot.green  { background:var(--cg); box-shadow:0 0 0 2px #A7F3D0; }
.ep-tl-dot.orange { background:var(--co); box-shadow:0 0 0 2px #FED7AA; }
.ep-tl-dot.gray   { background:#9CA3AF; box-shadow:0 0 0 2px #E5E7EB; }

/* Health stat */
.ep-stat { background:#F8FAFD; border:1.5px solid var(--cbr); border-radius:12px; padding:12px 16px; text-align:center; }
.ep-stat-v { font-size:22px; font-weight:800; color:var(--cn); }
.ep-stat-l { font-size:10px; color:var(--cm); font-weight:600; text-transform:uppercase; margin-top:2px; }
.ep-stat-u { font-size:10px; color:#9CA3AF; }

/* Fade anim */
@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
.fu { animation:fadeUp .35s ease both; }

/* Notif item */
.ep-notif { display:flex; align-items:flex-start; gap:12px; padding:14px 16px; border-bottom:1px solid #F3F7FF; transition:background .15s; }
.ep-notif:hover { background:#F8FAFF; }
.ep-notif:last-child { border-bottom:none; }
.ep-notif-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; margin-top:5px; }

/* Doc card */
.ep-doc { background:#F8FAFD; border:1.5px solid var(--cbr); border-radius:14px; padding:16px; display:flex; flex-direction:column; gap:8px; transition:box-shadow .2s; cursor:pointer; }
.ep-doc:hover { box-shadow:var(--shm); }

/* ─── Grilles (défini ici pour les styles de base desktop) ─────── */
/* Les règles responsive sont dans index.css avec !important         */
.ep-g2    { display:grid; grid-template-columns:2fr 1fr;     gap:20px; }
.ep-g11   { display:grid; grid-template-columns:1fr 1fr;     gap:20px; }
.ep-g3    { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }
.ep-g11s  { display:grid; grid-template-columns:1fr 1fr;     gap:12px; }
.ep-kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:12px; }

/* ─── Conteneur principal ────────────────────────────────────────── */
.ep-content { padding:24px; }
`;

// ─── SVG Icons ────────────────────────────────────────────────
const I = {
  user:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  calendar:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  pill:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20H4a2 2 0 01-2-2v-2a2 2 0 012-2h7"/><path d="M10 7H4a2 2 0 00-2 2v2"/><path d="M16 3l5 5-11 11-5-5z"/><path d="M16.5 3.5l5 5"/></svg>,
  file:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  flask:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v12l-2 3h10l-2-3V3"/></svg>,
  invoice: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/></svg>,
  bell:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  chat:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  ia:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  heart:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  shield:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  xray:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9l6 6M15 9l-6 6"/></svg>,
  dl:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  print:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  share:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  edit:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  lock:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  trend:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  check:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  syringe: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2l4 4"/><path d="M15 5l4 4"/><path d="M11.5 8.5l-7 7 1.5 1.5-2 2 1 1 2-2 1.5 1.5 7-7"/><path d="M8 12l1.5 1.5"/><path d="M11 9l1.5 1.5"/></svg>,
  hospital:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/></svg>,
};

// ─── Helpers ──────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";

// ─── Composants réutilisables ─────────────────────────────────
function Badge({ cls, children }) {
  return <span className={`ebdg ${cls}`}>{children}</span>;
}

function KpiCard({ color, icon, value, label, sub, urgent, onClick }) {
  return (
    <div className={`ep-kpi ${color} fu`} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      {urgent && <div className="kpi-dot" />}
      <div className={`kpi-icon ${color}`}>{icon}</div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-lbl">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function Modal({ open, onClose, title, children, maxWidth = 540 }) {
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
    <div className="emov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className="emov-box" style={{ maxWidth }} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="emov-hdr">
          <h3 id={titleId}>{title}</h3>
          <button className="emov-cls" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="emov-body">{children}</div>
      </div>
    </div>
  );
}

// Correction 8 (relecture du 6 sept. 2026, FE-BUG-010) — PATIENT/RDVS/
// ORDONNANCES/ANALYSES/IMAGERIES/FACTURES/NOTIFICATIONS (données de démo
// "Sophie Mercier") supprimées : servaient de repli silencieux dès que
// la donnée réelle était vide, y compris pour un vrai patient sans
// historique réel — voir le state gate plus bas dans le composant.
const VACCINS = [
  { nom: "Grippe saisonnière", date: "2024-10-15", prochaine: "2025-10-01", statut: "a_jour" },
  { nom: "COVID-19 (rappel)", date: "2024-09-01", prochaine: "Non défini", statut: "a_jour" },
  { nom: "Tétanos (DTP)", date: "2019-03-20", prochaine: "2029-03-20", statut: "a_jour" },
  { nom: "Hépatite B", date: "2010-06-10", prochaine: "Contrôle sérologique", statut: "en_retard" },
];

// Correction 3 (relecture du 6 sept. 2026) — MESSAGES était une constante
// statique (jamais fetchée depuis l'API), affichant à un vrai patient trois
// conversations entièrement fabriquées (dont une facture et un message
// médical inventés) comme si elles étaient réelles. Aucun canal de
// messagerie patient-scopé n'existe aujourd'hui (Conversation/Message sont
// réservés au personnel — SEC-004/SEC-005 — et le bouton "Nouveau message"
// de cet onglet est déjà honnêtement désactivé depuis AUDIT-11). Plutôt que
// de construire précipitamment un nouveau canal patient↔personnel sous
// pression de temps — une extension sensible du périmètre de sécurité
// délibérément fermé par SEC-004/SEC-005 — l'onglet est désactivé
// honnêtement dans son ensemble, cohérent avec le pattern déjà utilisé
// partout ailleurs sur cette page ("Fonctionnalité momentanément
// indisponible").


// ─── Helpers mapping API → UI ────────────────────────────────
const ageCalc = (dob) => {
  if (!dob) return "—";
  return Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 3600 * 1000)) + " ans";
};

// ─── MAIN COMPONENT ──────────────────────────────────────────
export default function MonEspacePatient() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { isMobile, isSmall } = useScreenSize();
  const RCSS = buildResponsiveCSS({ isMobile, isSmall });

  // ── Redux state ──────────────────────────────────────────
  const reduxPatient       = useSelector(selectPortalPatient);
  const stats              = useSelector(selectPortalStats);
  const mustChangePwd      = useSelector(selectMustChangePassword);
  const reduxAppointments  = useSelector(selectPortalAppointments);
  const reduxPrescriptions = useSelector(selectPortalPrescriptions);
  const reduxLabResults    = useSelector(selectPortalLabResults);
  const reduxImaging       = useSelector(selectPortalImaging);
  const reduxInvoices      = useSelector(selectPortalInvoices);
  const reduxNotifications = useSelector(selectPortalNotifications);
  const constantes         = useSelector(selectPortalConstantes);
  const constantesHistorique = useSelector(selectPortalConstantesHistorique);
  const loading            = useSelector(selectPortalLoading);
  const saving             = useSelector(selectPortalSaving);
  const portalError        = useSelector(selectPortalError);

  // ── Fetch au montage + rafraîchissement temps réel ────────
  // Corrections rendez-vous, item 6 : un rendez-vous confirmé/reporté par le
  // personnel doit apparaître à jour côté patient sans qu'il ait besoin de
  // recharger la page manuellement.
  const refreshPortal = useCallback(() => {
    dispatch(fetchPortalMe());
    dispatch(fetchPortalAppointments());
    dispatch(fetchPortalPrescriptions());
    dispatch(fetchPortalLabResults());
    dispatch(fetchPortalImaging());
    dispatch(fetchPortalInvoices());
    dispatch(fetchPortalNotifications());
    dispatch(fetchPortalDashboard());
  }, [dispatch]);
  useEffect(() => { refreshPortal(); }, [refreshPortal]);
  useRealtimeRefresh(refreshPortal);

  // Correction 8 (relecture du 6 sept. 2026, FE-BUG-010) — repli sur des
  // données de démo ("Sophie Mercier" et son historique fictif) dès que la
  // liste réelle était vide, y compris pour un vrai patient n'ayant tout
  // simplement encore aucun rendez-vous/ordonnance/résultat réel : il
  // aurait alors vu l'historique fabriqué d'un autre patient affiché comme
  // le sien. Retiré : chaque section utilise désormais l'état réel tel
  // quel, un tableau vide affiche honnêtement un état vide (voir plus bas).
  const patient     = reduxPatient;
  const rdvs        = reduxAppointments;
  const ordonnances = reduxPrescriptions;
  const analyses    = reduxLabResults;
  const imageries   = reduxImaging;
  const factures    = reduxInvoices;
  const notifs      = reduxNotifications;

  // ── Helpers accès champs API ──────────────────────────────
  const getRdvDate   = (r) => r.date_heure   || `${r.date}T${r.heure || "00:00"}`;
  const getRdvMedecin= (r) => r.medecin?.nom ? `Dr. ${r.medecin.prenom} ${r.medecin.nom}` : r.medecin;
  const getRdvService= (r) => r.service?.nom || r.service;
  const getRdvStatut = (r) => r.statut === 'confirme' || r.statut === 'planifie' ? 'confirme' : 'passe';
  const getOrdMedecin= (o) => o.medecin?.nom ? `Dr. ${o.medecin.prenom} ${o.medecin.nom}` : o.medecin;
  const getOrdDate   = (o) => o.date_prescription || o.date;
  const getOrdExpire = (o) => o.date_expiration || o.expire;
  const getOrdStatut = (o) => o.statut === 'active' ? 'active' : 'expiree';
  const getOrdMeds   = (o) => o.lignes ? o.lignes.map(l => `${l.medicament_nom || ''} — ${l.posologie || ''} ${l.duree ? `(${l.duree})` : ''}`.trim()) : o.medicaments || [];
  const getLabDate   = (l) => l.date_validation || l.date_prel;
  const getLabNom    = (l) => l.examen?.nom || l.id;
  const getLabResultats = (l) => {
    if (l.resultats && typeof l.resultats === 'object') return Object.entries(l.resultats).map(([k,v]) => ({ nom: k, val: String(v), statut: 'normal' }));
    return l.examens || [];
  };
  const getImgType   = (im) => im.type_examen || im.type;
  const getImgZone   = (im) => im.region_anatomique || im.zone;
  const getImgDate   = (im) => im.date_rapport || im.date;
  const getImgRadio  = (im) => im.radiologue?.nom ? `Dr. ${im.radiologue.prenom} ${im.radiologue.nom}` : im.radiologue;
  const getImgConclusion = (im) => im.conclusion || im.compte_rendu || "—";
  const getFacNum    = (f) => f.numero_facture || f.id;
  const getFacDate   = (f) => f.date_facture || f.date;
  const getFacMontant= (f) => f.montant_ttc ?? f.montant;
  const getFacStatut = (f) => ['payee'].includes(f.statut) ? 'payee' : 'impayee';
  const getFacDetail = (f) => f.lignes?.[0]?.libelle || f.detail || '—';
  const getNotifLu   = (n) => n.lu ?? n.lu;

  // ── UI state ──────────────────────────────────────────────
  const [tab, setTab] = useState("dashboard");
  const [modalRdv, setModalRdv]           = useState(false);
  const [modalMsg, setModalMsg]           = useState(false);
  const [modalProfil, setModalProfil]     = useState(false);
  const [modalChangePwd, setModalChangePwd] = useState(mustChangePwd);
  const [pwdForm, setPwdForm]             = useState({ currentPassword:"", newPassword:"", confirm:"" });
  const [pwdError, setPwdError]           = useState("");
  const [pwdSuccess, setPwdSuccess]       = useState("");
  const [profilForm, setProfilForm]       = useState({});
  const [profilSuccess, setProfilSuccess] = useState("");

  useEffect(() => { if (mustChangePwd) setModalChangePwd(true); }, [mustChangePwd]);
  useEffect(() => { if (reduxPatient) setProfilForm({
    telephone: reduxPatient.telephone || "",
    adresse:   reduxPatient.adresse   || {},
    contact_urgence: reduxPatient.contact_urgence || {},
    // AUDIT-D2 (ticket 0002) — uniquement pertinents tant que le profil est
    // à compléter (voir portal.controller.js::updateProfile, qui n'accepte
    // ces deux champs que dans ce cas précis).
    date_naissance: reduxPatient.date_naissance ? String(reduxPatient.date_naissance).substring(0,10) : "",
    sexe: reduxPatient.sexe || "",
  }); }, [reduxPatient]);

  const notifCount = notifs.filter(n => !getNotifLu(n)).length;

  const handleMarkAllRead = () => {
    dispatch(markAllNotificationsRead());
  };

  // AUDIT-11 (Vague 2, trouvé en marge de W1) — le bouton "Déconnexion" des
  // actions rapides n'avait aucun handler, contrairement à la Sidebar où la
  // déconnexion fonctionne réellement (useAuth().logout()). Pas une
  // nouvelle fonctionnalité : réutilise exactement le même mécanisme déjà
  // réel, avec le même filet de sécurité (Sidebar.jsx::handleLogout).
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      toast.error('Erreur lors de la déconnexion.');
    }
  };

  const handleUpdateProfil = async () => {
    const res = await dispatch(updatePortalProfile(profilForm));
    if (!res.error) { setProfilSuccess("Profil mis à jour !"); setTimeout(() => { setModalProfil(false); setProfilSuccess(""); }, 2000); }
  };

  const handleChangePassword = async () => {
    setPwdError(""); setPwdSuccess("");
    if (pwdForm.newPassword !== pwdForm.confirm) { setPwdError("Les mots de passe ne correspondent pas."); return; }
    if (pwdForm.newPassword.length < 8) { setPwdError("Minimum 8 caractères requis."); return; }
    const res = await dispatch(changePortalPassword({ currentPassword: pwdForm.currentPassword, newPassword: pwdForm.newPassword }));
    if (!res.error) { setPwdSuccess("Mot de passe changé avec succès !"); setTimeout(() => setModalChangePwd(false), 2000); }
    else setPwdError(res.payload || "Erreur.");
  };

  const TABS = [
    { key: "dashboard",   icon: "🏠", label: "Tableau de bord" },
    { key: "profil",      icon: "👤", label: "Mon Profil" },
    { key: "rdv",         icon: "📅", label: "Mes Rendez-vous" },
    { key: "ordonnances", icon: "💊", label: "Ordonnances" },
    { key: "analyses",    icon: "🔬", label: "Analyses" },
    { key: "imageries",   icon: "🩻", label: "Imageries" },
    { key: "vaccinations",icon: "💉", label: "Vaccinations" },
    { key: "factures",    icon: "💰", label: "Factures" },
    { key: "messagerie",  icon: "💬", label: "Messagerie" },
    { key: "notifs",      icon: "🔔", label: "Notifications", badge: notifCount > 0 ? notifCount : 0 },
    { key: "ia",          icon: "🤖", label: "Assistant IA" },
  ];

  if (loading && !reduxPatient) return (
    <div style={{ minHeight:"60vh", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ width:48, height:48, border:"4px solid #E2EAF4", borderTop:"4px solid #0EA5A0", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ color:"#6B7A99", fontSize:14 }}>Chargement de votre espace patient…</div>
    </div>
  );

  // Correction 8 (relecture du 6 sept. 2026, FE-BUG-010) — au-delà de ce
  // point, la page affichait auparavant PATIENT/RDVS/ORDONNANCES/... (les
  // données de démo "Sophie Mercier") dès que reduxPatient était vide —
  // y compris pour une vraie erreur serveur (ex. GET /portal/me → 404
  // "Dossier patient introuvable", portal.controller.js::getMe), jamais
  // seulement pour un chargement en cours. Un vrai patient sans dossier
  // lié verrait alors le profil fictif d'un autre patient affiché comme
  // le sien. État d'erreur honnête désormais affiché à sa place.
  if (!loading && !reduxPatient) return (
    <div style={{ minHeight:"60vh", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12, padding:24, textAlign:"center" }}>
      <div style={{ fontSize:40 }}>⚠️</div>
      <div style={{ color:"#0B1E3B", fontSize:16, fontWeight:700 }}>Impossible de charger votre dossier patient</div>
      <div style={{ color:"#6B7A99", fontSize:13, maxWidth:420 }}>{portalError || "Votre compte ne semble lié à aucun dossier patient. Contactez la clinique si le problème persiste."}</div>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      {RCSS && <style>{RCSS}</style>}
      <div className="ep">

        {/* ── HERO ── */}
        <Hero
          icon={User}
          title={patient.prenom || patient.nom ? `${patient.prenom} ${patient.nom}` : "Mon espace patient"}
          dateLabel={
            <span className="flex items-center gap-2 flex-wrap">
              <span>📋 {patient.numero_dossier || patient.dossier || "—"} · 🎂 {ageCalc(patient.date_naissance) || patient.age} · 🩸 {patient.groupe_sanguin || "—"}</span>
              {mustChangePwd && <span style={{ color:"#FCD34D", fontWeight:700 }}>🔒 Changez votre mot de passe temporaire</span>}
              {patient.profil_a_completer && <span style={{ color:"#FCD34D", fontWeight:700 }}>⚠ Profil à compléter</span>}
            </span>
          }
          right={
            <>
              <button className="hero-btn-ghost" onClick={() => setModalProfil(true)} aria-label="Profil">
                <Pencil size={14} /> {!isSmall && "Profil"}
              </button>
              {/* AUDIT-11 (Vague 2, W1) — prise de RDV désactivée : la
                  modale ne postait vers aucune route réelle (pas de champs
                  liés à un état, aucun POST /appointments côté portail).
                  Câblage réel hors périmètre de cette vague (nouveaux
                  endpoints, conflits de créneaux) — voir décision W1. */}
              <Button icon={Calendar} disabled title="Fonctionnalité momentanément indisponible" aria-label={isSmall ? "Prendre RDV" : undefined}>{!isSmall ? "Prendre RDV" : ""}</Button>
            </>
          }
        />

        {/* ── TABS BAR ── */}
        <div className="tab-bar">
          {TABS.map(t => (
            <button key={t.key} className={`tab-bar-item ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)} title={t.label}>
              <span>{t.icon}</span>
              <span style={{ display: isSmall && TABS.length > 8 ? 'none' : 'inline' }}>
                {isMobile ? t.label.split(' ').slice(0,2).join(' ') : t.label}
              </span>
              {t.badge > 0 && <span className="tab-bar-item-count">{t.badge}</span>}
            </button>
          ))}
        </div>

        {/* ── CONTENT ── */}
        <div className="ep-content">

          {/* ══ DASHBOARD ══ */}
          {tab === "dashboard" && (
            <div>
              {/* AUDIT-D2 (ticket 0002) — dossier créé automatiquement via
                  Google OAuth (T3.1) sans date de naissance ni sexe :
                  invite le patient à les renseigner. Disparaît d'elle-même
                  dès que profil_a_completer repasse à false côté backend
                  (portal.controller.js::updateProfile). */}
              {patient.profil_a_completer && (
                <div className="al-warn fu" style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, flexWrap:"wrap" }}>
                  <div style={{ width:40, height:40, background:"#FEF3C7", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>⚠</div>
                  <div style={{ flex:1 }}>
                    <strong style={{ color:"#92400E", fontSize:13 }}>Profil à compléter</strong>
                    <div style={{ fontSize:12, color:"#B45309", marginTop:2 }}>Votre date de naissance et votre sexe sont manquants — merci de les renseigner pour finaliser votre dossier.</div>
                  </div>
                  <button className="ebtn ebtn-ghost ebtn-sm" style={{ borderColor:"#FCD34D", color:"#92400E" }} onClick={() => setModalProfil(true)}>Compléter mon profil →</button>
                </div>
              )}

              {/* Alerte vaccin */}
              <div className="al-warn fu" style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, flexWrap:"wrap" }}>
                <div style={{ width:40, height:40, background:"#FEF3C7", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>💉</div>
                <div style={{ flex:1 }}>
                  <strong style={{ color:"#92400E", fontSize:13 }}>Rappel vaccinal</strong>
                  <div style={{ fontSize:12, color:"#B45309", marginTop:2 }}>Vérification sérologique Hépatite B recommandée. Consultez votre médecin.</div>
                </div>
                <button className="ebtn ebtn-ghost ebtn-sm" style={{ borderColor:"#FCD34D", color:"#92400E" }} onClick={() => setTab("vaccinations")}>Voir vaccinations →</button>
              </div>

              {/* KPIs */}
              <div className="ep-kpi-grid" style={{ marginBottom:20 }}>
                <KpiCard color="teal"   icon={I.calendar} value={stats.nbRdv  || rdvs.filter(r=>getRdvStatut(r)==='confirme').length}  label="Rendez-vous à venir"  sub="prochains RDV"  onClick={() => setTab("rdv")} />
                <KpiCard color="blue"   icon={I.pill}     value={stats.nbOrd  || ordonnances.filter(o=>getOrdStatut(o)==='active').length} label="Ordonnances actives" sub="en cours"     onClick={() => setTab("ordonnances")} />
                <KpiCard color="green"  icon={I.flask}    value={stats.nbLabo || analyses.length}    label="Analyses disponibles"  sub="résultats reçus"  onClick={() => setTab("analyses")} />
                <KpiCard color="purple" icon={I.xray}     value={stats.nbImag || imageries.length}   label="Imageries disponibles" sub="rapports prêts"   onClick={() => setTab("imageries")} />
                <KpiCard color="orange" icon={I.invoice}  value={stats.nbFactImpayees || factures.filter(f=>getFacStatut(f)==='impayee').length} label="Factures impayées" sub="à régler" urgent={(stats.nbFactImpayees || 0) > 0} onClick={() => setTab("factures")} />
                <KpiCard color="red"    icon={I.bell}     value={notifCount}  label="Notifications" sub="non lues" urgent={notifCount > 0} onClick={() => setTab("notifs")} />
              </div>

              <div className="ep-g2" style={{ marginBottom:24 }}>
                {/* Prochains RDV */}
                <div className="ep-card fu">
                  <div className="ep-card-hdr">
                    <div><h3>📅 Prochains rendez-vous</h3><p>{rdvs.filter(r=>getRdvStatut(r)==='confirme').length} RDV confirmés</p></div>
                    <button className="ebtn ebtn-ghost ebtn-sm" onClick={() => setTab("rdv")}>Voir tous →</button>
                  </div>
                  <div style={{ padding:"0 0 8px" }}>
                    {rdvs.filter(r => getRdvStatut(r) === "confirme").slice(0,3).map((rdv,i) => {
                      const d = new Date(getRdvDate(rdv));
                      return (
                      <div key={rdv._id||rdv.id||i} style={{ padding:"14px 20px", borderBottom:"1px solid #F3F7FF", display:"flex", alignItems:"center", gap:14 }}>
                        <div style={{ width:48, height:48, background:"linear-gradient(135deg,#EEF4FF,#DBEAFE)", borderRadius:12, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <div style={{ fontSize:14, fontWeight:800, color:"var(--cb)", lineHeight:1 }}>{isNaN(d)?'—':d.getDate()}</div>
                          <div style={{ fontSize:9, fontWeight:600, color:"var(--cm)", textTransform:"uppercase" }}>{isNaN(d)?'':d.toLocaleDateString("fr-FR",{month:"short"})}</div>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:700, color:"var(--cn)", fontSize:13 }}>{getRdvMedecin(rdv)}</div>
                          <div style={{ fontSize:11, color:"var(--cm)", marginTop:2 }}>{getRdvService(rdv)} · {isNaN(d)?'':d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</div>
                          <div style={{ fontSize:11, color:"var(--cm)" }}>{rdv.motif}</div>
                        </div>
                        <Badge cls="teal">✓ Confirmé</Badge>
                      </div>
                    )})}
                  </div>
                </div>

                {/* Résumé santé + Notifs */}
                <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                  {/* Sous-phase 5.1 (relecture du 6 sept. 2026) — remplace
                      CONSTANTES codée en dur (3 lignes fixes, jamais liées au
                      patient réel) par les vraies constantes de la dernière
                      consultation réelle (portal.controller.js::getDashboard,
                      signes_vitaux réellement saisis). État vide honnête si
                      aucune constante réelle n'a encore été saisie. */}
                  <div className="ep-card fu">
                    <div className="ep-card-hdr"><h3>❤️ Constantes récentes</h3><p>{constantes.date ? fmtDate(constantes.date) : "Aucune donnée"}</p></div>
                    {!constantes.date ? (
                      <div style={{ padding:20, textAlign:"center", color:"var(--cm)", fontSize:12 }}>Aucune constante réelle enregistrée pour l'instant.</div>
                    ) : (
                    <div className="ep-g11s" style={{ padding:16 }}>
                      {[
                        { lbl:"Tension", val:constantes.tension ?? "—", u:"mmHg" },
                        { lbl:"Pouls",   val:constantes.fc ?? "—",      u:"bpm" },
                        { lbl:"Poids",   val:constantes.poids ?? "—",   u:"kg" },
                        { lbl:"IMC",     val:constantes.imc ?? "—",     u:"" },
                      ].map(s => (
                        <div key={s.lbl} className="ep-stat">
                          <div className="ep-stat-v">{s.val}</div>
                          <div className="ep-stat-u">{s.u}</div>
                          <div className="ep-stat-l">{s.lbl}</div>
                        </div>
                      ))}
                    </div>
                    )}
                  </div>

                  {/* Notifications récentes */}
                  <div className="ep-card fu">
                    <div className="ep-card-hdr">
                      <h3>🔔 Notifications récentes</h3>
                      <span className="ebdg red">{notifCount} nouvelles</span>
                    </div>
                    <div>
                      {notifs.slice(0, 3).map((n,i) => (
                        <div key={n._id||n.id||i} className="ep-notif" style={{ background: getNotifLu(n) ? "" : "rgba(14,165,160,.04)" }}>
                          <div className="ep-notif-dot" style={{ background: n.color||"var(--ct)", opacity: getNotifLu(n) ? .4 : 1 }} />
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12.5, color:"var(--cn)", fontWeight: getNotifLu(n) ? 400 : 600 }}>{n.message||n.titre}</div>
                            <div style={{ fontSize:11, color:"var(--cm)", marginTop:2 }}>{n.date||fmtDate(n.createdAt)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ordonnances actives */}
              <div className="ep-card fu">
                <div className="ep-card-hdr">
                  <div><h3>💊 Ordonnances actives</h3><p>Traitements en cours</p></div>
                  <button className="ebtn ebtn-ghost ebtn-sm" onClick={() => setTab("ordonnances")}>Voir toutes →</button>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table className="ep-tbl">
                    <thead><tr><th>Date</th><th>Médecin prescripteur</th><th>Médicaments</th><th>Expire le</th><th>Statut</th><th>Action</th></tr></thead>
                    <tbody>
                      {ordonnances.filter(o => getOrdStatut(o) === "active").slice(0,5).map((o,i) => (
                        <tr key={o._id||o.id||i}>
                          <td style={{ fontSize:12 }}>{fmtDate(getOrdDate(o))}</td>
                          <td style={{ fontWeight:600, color:"var(--cn)" }}>{getOrdMedecin(o)}</td>
                          <td style={{ fontSize:12, color:"var(--cm)" }}>
                            <ul style={{ margin:0, padding:"0 0 0 16px" }}>{getOrdMeds(o).slice(0,3).map((m,j)=><li key={j}>{m}</li>)}</ul>
                          </td>
                          <td style={{ fontSize:12 }}>{fmtDate(getOrdExpire(o))}</td>
                          <td><Badge cls="green">✓ Active</Badge></td>
                          <td><button className="ebtn ebtn-ghost ebtn-sm" disabled title="Fonctionnalité momentanément indisponible" style={{ opacity:.5, cursor:"not-allowed" }}>{I.dl} Télécharger</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ PROFIL ══ */}
          {tab === "profil" && (
            <div>
              <div className="ep-g11" style={{ marginBottom:20 }}>
                <div className="ep-card fu">
                  {/* AUDIT-11 — dupliquait "Modifier profil" (actions
                      rapides ci-dessous) sans handler propre ; pointe vers
                      la même modale réelle plutôt que de rester inerte. */}
                  <div className="ep-card-hdr"><h3>👤 Informations personnelles</h3><button className="ebtn ebtn-ghost ebtn-sm" onClick={() => setModalProfil(true)}>{I.edit} Modifier</button></div>
                  <div className="ep-g11s" style={{ padding:16 }}>
                    {[
                      ["Nom",              patient.nom],
                      ["Prénom",           patient.prenom],
                      ["Date de naissance",fmtDate(patient.date_naissance)],
                      ["Sexe",             patient.sexe === 'M' ? 'Masculin' : patient.sexe === 'F' ? 'Féminin' : patient.sexe],
                      ["Nationalité",      patient.nationalite],
                      ["Téléphone",        patient.telephone],
                    ].map(([lbl,val]) => (
                      <div key={lbl} className="ep-info-row">
                        <div className="lbl">{lbl}</div>
                        <div className="val">{val || "—"}</div>
                      </div>
                    ))}
                    <div className="ep-info-row" style={{ gridColumn:"1/-1" }}>
                      <div className="lbl">Adresse</div>
                      <div className="val">{patient.adresse ? [patient.adresse.rue,patient.adresse.ville,patient.adresse.pays].filter(Boolean).join(', ') : patient.adresse || "—"}</div>
                    </div>
                    <div className="ep-info-row" style={{ gridColumn:"1/-1" }}>
                      <div className="lbl">Email</div>
                      <div className="val">{patient.email || "—"}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                  <div className="ep-card fu">
                    <div className="ep-card-hdr"><h3>🆘 Contact d'urgence</h3></div>
                    <div style={{ padding:20, display:"flex", flexDirection:"column", gap:10 }}>
                      {/* AUDIT-P3-2 — patient.contact_urgence est dérivé de reduxPatient.contact_urgence
                          || {} (jamais null), donc un contact réellement vide retombait
                          silencieusement sur la fiche de démo codée en dur ("Marc Mercier") au
                          lieu d'indiquer que le champ n'est pas renseigné. */}
                      {[["Nom", patient.contact_urgence?.nom||"Non renseigné"],["Téléphone", patient.contact_urgence?.telephone||"Non renseigné"],["Lien de parenté", patient.contact_urgence?.relation||"Non renseigné"]].map(([lbl,val])=>(
                        <div key={lbl} className="ep-info-row">
                          <div className="lbl">{lbl}</div>
                          <div className="val">{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="ep-card fu">
                    <div className="ep-card-hdr"><h3>🩺 Informations médicales</h3></div>
                    <div style={{ padding:20, display:"flex", flexDirection:"column", gap:10 }}>
                      <div className="ep-info-row"><div className="lbl">Groupe sanguin</div><div className="val">{patient.groupe_sanguin || "—"}</div></div>
                      {(Array.isArray(patient.allergies) ? patient.allergies.length > 0 : !!patient.allergies) && (
                        <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10, padding:"10px 14px" }}>
                          <div style={{ fontSize:10, fontWeight:700, color:"#B91C1C", textTransform:"uppercase", letterSpacing:.4 }}>⚠ Allergies</div>
                          <div style={{ fontSize:13, color:"#DC2626", marginTop:2, fontWeight:600 }}>{Array.isArray(patient.allergies) ? patient.allergies.join(', ') : patient.allergies}</div>
                        </div>
                      )}
                      <div className="ep-info-row"><div className="lbl">Antécédents médicaux</div><div className="val">{Array.isArray(patient.antecedents_medicaux) ? patient.antecedents_medicaux.join(', ') || "—" : "—"}</div></div>
                      {/* AUDIT-11 (trouvé en marge de W1) — une ligne
                          "Antécédents : Appendicectomie 2015" codée en dur
                          était affichée ici, redondante avec le champ réel
                          ci-dessus mais avec un contenu fabriqué présenté
                          comme un fait médical du patient. Retirée, même
                          raisonnement que le panneau "Recommandations IA". */}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions rapides */}
              <div className="ep-card fu">
                <div className="ep-card-hdr"><h3>⚡ Actions rapides</h3></div>
                <div style={{ padding:20, display:"flex", gap:12, flexWrap:"wrap" }}>
                  <button className="ebtn ebtn-ghost" onClick={() => setModalChangePwd(true)}>🔒 Changer mot de passe</button>
                  <button className="ebtn ebtn-ghost" onClick={() => setModalProfil(true)}>{I.edit} Modifier profil</button>
                  <button className="ebtn ebtn-teal" disabled title="Fonctionnalité momentanément indisponible" style={{ opacity:.5, cursor:"not-allowed" }}>🪪 Télécharger carte patient</button>
                  <button className="ebtn ebtn-ghost" disabled title="Fonctionnalité momentanément indisponible" style={{ opacity:.5, cursor:"not-allowed" }}>📋 Exporter dossier</button>
                  <button className="ebtn ebtn-danger" onClick={handleLogout}>🚪 Déconnexion</button>
                </div>
              </div>
            </div>
          )}

          {/* ══ RENDEZ-VOUS ══ */}
          {tab === "rdv" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12 }}>
                <div><div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>Mes Rendez-vous</div><div style={{ fontSize:12, color:"var(--cm)" }}>{rdvs.length} rendez-vous au total</div></div>
                <button className="ebtn ebtn-teal" disabled title="Fonctionnalité momentanément indisponible" style={{ opacity:.5, cursor:"not-allowed" }}>📅 Prendre un rendez-vous</button>
              </div>

              {["confirme","passe"].map(statut => (
                <div key={statut} className="ep-card fu" style={{ marginBottom:20 }}>
                  <div className="ep-card-hdr">
                    <div><h3>{statut === "confirme" ? "📅 À venir" : "🕐 Passés"}</h3><p>{rdvs.filter(r=>getRdvStatut(r)===statut).length} rendez-vous</p></div>
                  </div>
                  <div style={{ overflowX:"auto" }}>
                    <table className="ep-tbl">
                      <thead><tr><th>Date</th><th>Heure</th><th>Médecin</th><th>Service</th><th>Motif</th><th>Statut</th><th>Actions</th></tr></thead>
                      <tbody>
                        {rdvs.filter(r => getRdvStatut(r) === statut).map((rdv,i) => {
                          const d = new Date(getRdvDate(rdv));
                          return (
                          <tr key={rdv._id||rdv.id||i}>
                            <td style={{ fontWeight:600, color:"var(--cn)" }}>{isNaN(d)?'—':d.toLocaleDateString("fr-FR")}</td>
                            <td><Badge cls="blue">{isNaN(d)?'—':d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</Badge></td>
                            <td style={{ fontWeight:600, color:"var(--cn)" }}>{getRdvMedecin(rdv)}</td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{getRdvService(rdv)}</td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{rdv.motif}</td>
                            <td><Badge cls={statut === "confirme" ? "teal" : "gray"}>{statut === "confirme" ? "✓ Confirmé" : "Passé"}</Badge></td>
                            <td>
                              <div style={{ display:"flex", gap:6 }}>
                                <button className="ebtn ebtn-ghost ebtn-sm" disabled title="Fonctionnalité momentanément indisponible" style={{ opacity:.5, cursor:"not-allowed" }}>{I.dl} Conf.</button>
                                {statut === "confirme" && <button className="ebtn ebtn-danger ebtn-sm" disabled title="Fonctionnalité momentanément indisponible" style={{ opacity:.5, cursor:"not-allowed" }}>Annuler</button>}
                              </div>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ ORDONNANCES ══ */}
          {tab === "ordonnances" && (
            <div>
              <div style={{ marginBottom:20 }}><div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>Mes Ordonnances</div><div style={{ fontSize:12, color:"var(--cm)" }}>{ordonnances.length} prescriptions</div></div>
              {ordonnances.map((o,i) => {
                const meds = getOrdMeds(o);
                const st   = getOrdStatut(o);
                return (
                <div key={o._id||o.id||i} className="ep-card fu" style={{ marginBottom:16, borderLeft:`4px solid ${st === "active" ? "var(--cg)" : "#9CA3AF"}` }}>
                  <div style={{ padding:"16px 20px" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap", marginBottom:12 }}>
                      <div>
                        <div style={{ fontWeight:700, color:"var(--cn)", fontSize:14 }}>📋 {getOrdMedecin(o)}</div>
                        <div style={{ fontSize:11, color:"var(--cm)", marginTop:2 }}>Prescrit le {fmtDate(getOrdDate(o))} · Expire le {fmtDate(getOrdExpire(o))}</div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <Badge cls={st === "active" ? "green" : "gray"}>{st === "active" ? "✓ Active" : "Expirée"}</Badge>
                        <button className="ebtn ebtn-ghost ebtn-sm" disabled title="Fonctionnalité momentanément indisponible" style={{ opacity:.5, cursor:"not-allowed" }}>{I.dl} Télécharger</button>
                        {/* Sous-phase 5.2 — n'avait aucun onClick (bouton
                            muet, ni désactivé ni fonctionnel). Câblé sur
                            window.print(), même mécanisme réel utilisé
                            partout ailleurs dans ce système pour "Imprimer". */}
                        <button className="ebtn ebtn-ghost ebtn-sm" onClick={() => window.print()}>{I.print} Imprimer</button>
                      </div>
                    </div>
                    <div style={{ background:"#F8FAFD", borderRadius:10, padding:14 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.4, marginBottom:8 }}>💊 Médicaments prescrits</div>
                      {meds.length ? meds.map((m,j) => (
                        <div key={j} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom: j < meds.length-1 ? "1px solid var(--cbr)" : "none" }}>
                          <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--ct)", flexShrink:0 }} />
                          <span style={{ fontSize:13, color:"var(--cn)" }}>{m}</span>
                        </div>
                      )) : <span style={{ fontSize:13, color:"var(--cm)" }}>Aucun médicament enregistré</span>}
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}

          {/* ══ ANALYSES ══ */}
          {tab === "analyses" && (
            <div>
              <div style={{ marginBottom:20 }}><div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>Mes Analyses de Laboratoire</div><div style={{ fontSize:12, color:"var(--cm)" }}>{analyses.length} résultats disponibles</div></div>
              {analyses.map((a,i) => {
                const examens = getLabResultats(a);
                return (
                <div key={a._id||a.id||i} className="ep-card fu" style={{ marginBottom:20 }}>
                  <div className="ep-card-hdr">
                    <div>
                      <h3>🔬 {getLabNom(a)}</h3>
                      <p>Résultat : {fmtDate(getLabDate(a))}{a.technicien ? ` · ${a.technicien}` : ''}</p>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      {a.est_critique && <Badge cls="red">⚠ Critique</Badge>}
                      <button className="ebtn ebtn-ghost ebtn-sm" disabled title="Fonctionnalité momentanément indisponible" style={{ opacity:.5, cursor:"not-allowed" }}>{I.dl} PDF</button>
                    </div>
                  </div>
                  <div style={{ overflowX:"auto" }}>
                    <table className="ep-tbl">
                      <thead><tr><th>Examen</th><th>Résultat</th><th>Statut</th></tr></thead>
                      <tbody>
                        {examens.length ? examens.map((e,j) => (
                          <tr key={j} style={{ background: e.statut === "anormal" ? "#FFF8F8" : "" }}>
                            <td style={{ fontWeight:600, color:"var(--cn)" }}>{e.nom}</td>
                            <td style={{ fontSize:13, color: e.statut === "anormal" ? "var(--cr)" : "var(--cn)", fontWeight: e.statut === "anormal" ? 700 : 400 }}>{e.val}</td>
                            <td><Badge cls={e.statut === "anormal" ? "red" : "green"}>{e.statut === "anormal" ? "⚠ Anormal" : "✓ Normal"}</Badge></td>
                          </tr>
                        )) : (
                          <tr><td colSpan={3} style={{ textAlign:"center", color:"var(--cm)", fontSize:12, padding:16 }}>{a.commentaires || "Résultats disponibles sur demande"}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {examens.some(e => e.statut === "anormal") && (
                    <div style={{ padding:"12px 20px" }}>
                      <div className="al-warn" style={{ fontSize:12, color:"#B45309" }}>
                        <strong>⚠ Attention :</strong> Certains résultats sont anormaux. Consultez votre médecin.
                      </div>
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}

          {/* ══ IMAGERIES ══ */}
          {tab === "imageries" && (
            <div>
              <div style={{ marginBottom:20 }}><div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>Mes Imageries</div><div style={{ fontSize:12, color:"var(--cm)" }}>{imageries.length} examens disponibles</div></div>
              <div className="ep-g11">
                {imageries.map((im,i) => (
                  <div key={im._id||im.id||i} className="ep-card fu">
                    <div style={{ background:"linear-gradient(135deg,#0B1E3B,#132744)", padding:"18px 20px 14px", borderRadius:"16px 16px 0 0" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div>
                          <div style={{ fontSize:24 }}>🩻</div>
                          <div style={{ fontSize:16, fontWeight:700, color:"#fff", marginTop:6 }}>{getImgType(im)}</div>
                          <div style={{ fontSize:12, color:"rgba(255,255,255,.6)", marginTop:2 }}>{getImgZone(im)}</div>
                        </div>
                        <Badge cls="teal">✓ Disponible</Badge>
                      </div>
                    </div>
                    <div style={{ padding:18 }}>
                      <div style={{ fontSize:12, color:"var(--cm)", marginBottom:8 }}>
                        📅 {fmtDate(getImgDate(im))} · 👨‍⚕️ {getImgRadio(im)||"—"}
                      </div>
                      <div style={{ background:"#F8FAFD", borderRadius:10, padding:12, fontSize:12.5, color:"var(--cn)", lineHeight:1.7, marginBottom:14 }}>
                        <strong style={{ color:"var(--cm)", fontSize:11, textTransform:"uppercase", letterSpacing:.4, display:"block", marginBottom:4 }}>Conclusion</strong>
                        {getImgConclusion(im)}
                      </div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button className="ebtn ebtn-teal ebtn-sm" disabled title="Fonctionnalité momentanément indisponible" style={{ opacity:.5, cursor:"not-allowed" }}>👁 Visualiser</button>
                        <button className="ebtn ebtn-ghost ebtn-sm" disabled title="Fonctionnalité momentanément indisponible" style={{ opacity:.5, cursor:"not-allowed" }}>{I.dl} Rapport</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ VACCINATIONS ══ */}
          {tab === "vaccinations" && (
            <div>
              <div style={{ marginBottom:20 }}><div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>Mon Carnet Vaccinal</div><div style={{ fontSize:12, color:"var(--cm)" }}>{VACCINS.length} vaccins enregistrés</div></div>
              {VACCINS.some(v => v.statut === "en_retard") && (
                <div className="al-warn fu" style={{ marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontSize:18 }}>⚠️</span>
                  <div><strong style={{ color:"#92400E" }}>Vaccin(s) en retard</strong><div style={{ fontSize:12, color:"#B45309", marginTop:2 }}>Veuillez consulter votre médecin pour une mise à jour vaccinale.</div></div>
                </div>
              )}
              <div className="ep-card fu">
                <div style={{ overflowX:"auto" }}>
                  <table className="ep-tbl">
                    <thead><tr><th>Vaccin</th><th>Date d'administration</th><th>Prochaine dose</th><th>Statut</th></tr></thead>
                    <tbody>
                      {VACCINS.map((v,i) => (
                        <tr key={i} style={{ background: v.statut === "en_retard" ? "#FFF8F8" : "" }}>
                          <td style={{ fontWeight:700, color:"var(--cn)", display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontSize:16 }}>💉</span> {v.nom}
                          </td>
                          <td style={{ fontSize:12 }}>{fmtDate(v.date)}</td>
                          <td style={{ fontSize:12, color:"var(--cm)" }}>{v.prochaine}</td>
                          <td>
                            <Badge cls={v.statut === "a_jour" ? "green" : "red"}>
                              {v.statut === "a_jour" ? "✓ À jour" : "⚠ En retard"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ FACTURES ══ */}
          {tab === "factures" && (
            <div>
              <div style={{ marginBottom:20 }}><div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>Mes Factures</div><div style={{ fontSize:12, color:"var(--cm)" }}>{factures.length} factures au total</div></div>
              {factures.some(f => getFacStatut(f) === "impayee") && (
                <div style={{ background:"linear-gradient(135deg,#FEF2F2,#FEE2E2)", border:"1.5px solid #FECACA", borderLeft:"4px solid var(--cr)", borderRadius:14, padding:"14px 18px", marginBottom:20, display:"flex", alignItems:"center", gap:14 }} className="fu">
                  <div style={{ fontSize:24 }}>💰</div>
                  <div style={{ flex:1 }}>
                    <strong style={{ color:"#B91C1C" }}>Facture(s) en attente de paiement</strong>
                    <div style={{ fontSize:12, color:"#DC2626", marginTop:2 }}>
                      Total dû : <strong>{factures.filter(f=>getFacStatut(f)==="impayee").reduce((s,f)=>s+getFacMontant(f),0).toLocaleString("fr-FR")} CFA</strong>
                    </div>
                  </div>
                  <button className="ebtn ebtn-danger ebtn-sm" disabled title="Fonctionnalité momentanément indisponible" style={{ opacity:.5, cursor:"not-allowed" }}>💳 Payer en ligne</button>
                </div>
              )}
              <div className="ep-card fu">
                <div style={{ overflowX:"auto" }}>
                  <table className="ep-tbl">
                    <thead><tr><th>N° Facture</th><th>Date</th><th>Prestation</th><th>Montant</th><th>Statut</th><th>Actions</th></tr></thead>
                    <tbody>
                      {factures.map((f,i) => (
                        <tr key={f._id||f.id||i} style={{ background: getFacStatut(f) === "impayee" ? "#FFF8F8" : "" }}>
                          <td><span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--cb)", fontSize:12 }}>{getFacNum(f)}</span></td>
                          <td style={{ fontSize:12 }}>{fmtDate(getFacDate(f))}</td>
                          <td style={{ fontSize:12, color:"var(--cm)" }}>{getFacDetail(f)}</td>
                          <td><strong style={{ fontSize:14, color:"var(--cn)" }}>{getFacMontant(f)?.toLocaleString("fr-FR")} CFA</strong></td>
                          <td><Badge cls={getFacStatut(f) === "payee" ? "green" : "red"}>{getFacStatut(f) === "payee" ? "✓ Payée" : "⚠ Impayée"}</Badge></td>
                          <td>
                            <div style={{ display:"flex", gap:6 }}>
                              <button className="ebtn ebtn-ghost ebtn-sm" disabled title="Fonctionnalité momentanément indisponible" style={{ opacity:.5, cursor:"not-allowed" }}>{I.dl} Facture</button>
                              {getFacStatut(f) === "impayee" && <button className="ebtn ebtn-teal ebtn-sm" disabled title="Fonctionnalité momentanément indisponible" style={{ opacity:.5, cursor:"not-allowed" }}>💳 Payer</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding:"12px 20px", borderTop:"1.5px solid var(--cbr)", display:"flex", justifyContent:"flex-end", gap:20, fontSize:13 }}>
                  {/* AUDIT-P3-1 — ces totaux étaient calculés sur FACTURES (données de
                      démo codées en dur), déconnectés des lignes réellement affichées
                      ci-dessus (issues de `factures`) : le total ne correspondait jamais
                      à ce que le patient voyait dans son propre tableau. */}
                  <span style={{ color:"var(--cm)" }}>Total payé : <strong style={{ color:"var(--cg)" }}>{factures.filter(f=>getFacStatut(f)==="payee").reduce((s,f)=>s+(getFacMontant(f)||0),0).toLocaleString("fr-FR")} CFA</strong></span>
                  <span style={{ color:"var(--cm)" }}>Restant dû : <strong style={{ color:"var(--cr)" }}>{factures.filter(f=>getFacStatut(f)==="impayee").reduce((s,f)=>s+(getFacMontant(f)||0),0).toLocaleString("fr-FR")} CFA</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* ══ MESSAGERIE ══ */}
          {/* Correction 3 (relecture du 6 sept. 2026) — cet onglet affichait
              MESSAGES, une constante statique de trois conversations
              entièrement fabriquées (dont une facture inventée), jamais
              chargée depuis l'API, comme si un vrai patient recevait ces
              messages. Aucun canal de messagerie patient-scopé n'existe
              aujourd'hui : Conversation/Message sont réservés au personnel
              (SEC-004/SEC-005), et "Nouveau message" ci-dessous est déjà
              honnêtement désactivé depuis AUDIT-11. Plutôt que de construire
              précipitamment un nouveau canal patient↔personnel — une
              extension sensible du périmètre de sécurité délibérément fermé
              par SEC-004/SEC-005 — désactivé honnêtement dans son ensemble,
              même pattern que le reste de cette page. */}
          {tab === "messagerie" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12 }}>
                <div><div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>Messagerie Sécurisée</div><div style={{ fontSize:12, color:"var(--cm)" }}>Fonctionnalité momentanément indisponible</div></div>
                <button className="ebtn ebtn-teal" disabled title="Fonctionnalité momentanément indisponible" style={{ opacity:.5, cursor:"not-allowed" }}>✉️ Nouveau message</button>
              </div>
              <div className="ep-card fu">
                <div style={{ padding:"32px 20px", textAlign:"center", color:"var(--cm)" }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>💬</div>
                  <div style={{ fontWeight:600, color:"var(--cn)", fontSize:14 }}>Messagerie momentanément indisponible</div>
                  <div style={{ fontSize:12.5, marginTop:6 }}>Pour toute question, contactez directement votre clinique par téléphone.</div>
                </div>
              </div>
            </div>
          )}

          {/* ══ NOTIFICATIONS ══ */}
          {tab === "notifs" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12 }}>
                <div><div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>Notifications</div><div style={{ fontSize:12, color:"var(--cm)" }}>{notifCount} non lue(s)</div></div>
                <button className="ebtn ebtn-ghost ebtn-sm" onClick={handleMarkAllRead}>✓ Tout marquer comme lu</button>
              </div>
              <div className="ep-card fu">
                {notifs.length === 0 && <div style={{ padding:24, textAlign:"center", color:"var(--cm)", fontSize:13 }}>Aucune notification</div>}
                {notifs.map((n,i) => (
                  <div key={n._id||n.id||i} className="ep-notif" style={{ background: getNotifLu(n) ? "" : "rgba(14,165,160,.04)" }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:`${n.color||"var(--ct)"}22`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <div style={{ width:10, height:10, borderRadius:"50%", background:n.color||"var(--ct)" }} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, color:"var(--cn)", fontWeight: getNotifLu(n) ? 400 : 600 }}>{n.message||n.titre}</div>
                      <div style={{ fontSize:11, color:"var(--cm)", marginTop:3 }}>{n.date||fmtDate(n.createdAt)}</div>
                    </div>
                    {!getNotifLu(n) && <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--ct)", flexShrink:0, marginTop:6 }} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ ASSISTANT IA ══ */}
          {tab === "ia" && (
            <div>
              {/* En-tête IA */}
              <div style={{ background:"linear-gradient(135deg,#0B1E3B,#132744,#1B4F9E)", borderRadius:18, padding:"24px 28px", marginBottom:24, color:"#fff" }} className="fu">
                <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                  <div style={{ width:56, height:56, borderRadius:14, background:"rgba(14,165,160,.25)", border:"1.5px solid rgba(14,165,160,.4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26 }}>🤖</div>
                  <div>
                    <div style={{ fontSize:20, fontWeight:700 }}>Assistant IA Santé</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,.6)", marginTop:2 }}>Analyse personnalisée basée sur vos données médicales</div>
                  </div>
                </div>
              </div>

              <div className="ep-g2" style={{ marginBottom:24 }}>
                {/* Fonctions IA */}
                <div className="ep-card fu">
                  <div className="ep-card-hdr"><h3>🤖 Fonctions disponibles</h3></div>
                  <div style={{ padding:20, display:"flex", flexDirection:"column", gap:10 }}>
                    {[
                      ["📊","Explication des résultats","Comprenez vos analyses laboratoire en langage simple","teal"],
                      ["⏰","Rappel médicaments","Gérez votre traitement et horaires de prise","blue"],
                      ["🛡","Conseils préventifs","Recommandations basées sur votre profil santé","green"],
                      ["📋","Préparation consultation","Préparez vos questions avant votre RDV médecin","orange"],
                      ["❓","FAQ médicale","Réponses aux questions fréquentes sur votre santé","purple"],
                    ].map(([ico,titre,desc,col]) => (
                      <div key={titre} style={{ display:"flex", alignItems:"flex-start", gap:12, background:"#F8FAFD", borderRadius:12, padding:"12px 14px", cursor:"pointer", transition:"box-shadow .2s" }}
                        onMouseOver={e=>e.currentTarget.style.boxShadow="var(--shm)"} onMouseOut={e=>e.currentTarget.style.boxShadow="none"}>
                        <span style={{ fontSize:20, flexShrink:0 }}>{ico}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:700, fontSize:13, color:"var(--cn)" }}>{titre}</div>
                          <div style={{ fontSize:11.5, color:"var(--cm)", marginTop:2 }}>{desc}</div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cm)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tableau santé */}
                <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                  {/* Sous-phase 5.1 — même correctif que "Constantes
                      récentes" ci-dessus : CONSTANTES (3 lignes fixes)
                      remplacée par les vraies constantes + le vrai
                      historique (jusqu'à 5 consultations réelles portant des
                      signes_vitaux, portal.controller.js::getDashboard). */}
                  <div className="ep-card fu">
                    <div className="ep-card-hdr"><h3>📈 Tableau Santé Personnel</h3><p>Vos constantes</p></div>
                    <div style={{ padding:16 }}>
                      {!constantes.date ? (
                        <div style={{ textAlign:"center", color:"var(--cm)", fontSize:12, padding:16 }}>Aucune constante réelle enregistrée pour l'instant — elles apparaissent ici après une consultation où elles ont été saisies.</div>
                      ) : (<>
                      <div className="ep-g11s" style={{ marginBottom:16 }}>
                        {[
                          { lbl:"Tension", val:constantes.tension ?? "—", u:"mmHg", ok:true },
                          { lbl:"Pouls",   val:`${constantes.fc ?? "—"}`, u:"bpm", ok:true },
                          { lbl:"Poids",   val:`${constantes.poids ?? "—"}`, u:"kg", ok:true },
                          { lbl:"IMC",     val:`${constantes.imc ?? "—"}`, u:"", ok:true },
                          { lbl:"Glycémie",val:`${constantes.glycemie ?? "—"}`, u:"mmol/L", ok:true },
                        ].map(s => (
                          <div key={s.lbl} className="ep-stat" style={{ gridColumn: s.lbl === "Glycémie" ? "1/-1" : "" }}>
                            <div className="ep-stat-v" style={{ color: s.ok ? "var(--cn)" : "var(--cr)" }}>{s.val}</div>
                            <div className="ep-stat-u">{s.u}</div>
                            <div className="ep-stat-l">{s.lbl}</div>
                          </div>
                        ))}
                      </div>

                      {/* Historique constantes */}
                      <div style={{ fontSize:11, fontWeight:700, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>Historique</div>
                      {constantesHistorique.map((c,i) => (
                        <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom: i < constantesHistorique.length-1 ? "1px solid var(--cbr)" : "none", fontSize:12 }}>
                          <span style={{ color:"var(--cm)" }}>{fmtDate(c.date)}</span>
                          <div style={{ display:"flex", gap:10 }}>
                            <span style={{ color:"var(--cn)" }}>🩺 {c.tension ?? "—"}</span>
                            <span style={{ color:"var(--cn)" }}>❤️ {c.fc ?? "—"}</span>
                            <span style={{ color:"var(--cn)" }}>⚖️ {c.poids ?? "—"}kg</span>
                          </div>
                        </div>
                      ))}
                      </>)}
                    </div>
                  </div>

                  {/* AUDIT-11 (Vague 2, W1) — panneau "Recommandations IA"
                      retiré : contenu clinique entièrement fabriqué (valeurs
                      de laboratoire inventées, ex. "cholestérol 5.9 mmol/L"),
                      sans aucun rapport avec les données réelles du patient
                      affichées ailleurs sur cette même page. Présenter un
                      faux conseil médical personnalisé est plus grave qu'un
                      simple bouton inerte — retiré plutôt que désactivé. */}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ MODAL : PRENDRE RDV ═══ */}
        <Modal open={modalRdv} onClose={() => setModalRdv(false)} title="📅 Prendre un rendez-vous">
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><label className="elbl">Service *</label>
              <select className="einp">
                <option>— Sélectionner un service —</option>
                {["Médecine générale","Cardiologie","Pneumologie","Dermatologie","Pédiatrie","Gynécologie","Chirurgie","Radiologie"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="elbl">Médecin</label>
              <select className="einp">
                <option>— Sélectionner un médecin —</option>
                {["Dr. Claire Fontaine","Dr. Alain Dupont","Dr. Yasmine Benali"].map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="ep-g11s">
              <div><label className="elbl">Date souhaitée *</label><input type="date" className="einp" min={new Date().toISOString().substring(0,10)} /></div>
              <div><label className="elbl">Heure préférée</label>
                <select className="einp">
                  <option>Matin (8h-12h)</option>
                  <option>Après-midi (13h-17h)</option>
                  <option>Fin de journée (17h-19h)</option>
                </select>
              </div>
            </div>
            <div><label className="elbl">Motif de consultation</label><textarea className="einp" rows={2} placeholder="Décrivez brièvement le motif de votre consultation..." /></div>
            <div className="al-info" style={{ fontSize:12, color:"#1E40AF" }}>
              ℹ️ Votre demande sera confirmée par la clinique dans les 24h. Vous recevrez une notification.
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="ebtn ebtn-ghost" onClick={() => setModalRdv(false)}>Annuler</button>
              {/* Filet de sécurité : le déclencheur qui ouvre cette modale
                  est désactivé, mais si elle était atteinte autrement, ce
                  bouton n'a jamais eu de handler réel — le laisser inerte
                  plutôt que de lui ajouter une fausse action. */}
              <button className="ebtn ebtn-teal" disabled title="Fonctionnalité momentanément indisponible" style={{ marginLeft:"auto", opacity:.5, cursor:"not-allowed" }}>✓ Demander le rendez-vous</button>
            </div>
          </div>
        </Modal>

        {/* ═══ MODAL : NOUVEAU MESSAGE ═══ */}
        <Modal open={modalMsg} onClose={() => setModalMsg(false)} title="✉️ Nouveau message">
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><label className="elbl">Destinataire *</label>
              <select className="einp">
                <option>— Sélectionner —</option>
                {["Dr. Claire Fontaine – Cardiologie","Dr. Alain Dupont – Pneumologie","Administration – Clinique"].map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
            <div><label className="elbl">Objet *</label><input className="einp" placeholder="Sujet de votre message..." /></div>
            <div><label className="elbl">Message *</label><textarea className="einp" rows={5} placeholder="Rédigez votre message ici..." /></div>
            <div><label className="elbl">Pièce jointe (optionnel)</label><input type="file" className="einp" style={{ padding:"6px 10px" }} /></div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="ebtn ebtn-ghost" onClick={() => setModalMsg(false)}>Annuler</button>
              <button className="ebtn ebtn-teal" disabled title="Fonctionnalité momentanément indisponible" style={{ marginLeft:"auto", opacity:.5, cursor:"not-allowed" }}>📤 Envoyer</button>
            </div>
          </div>
        </Modal>

        {/* ═══ MODAL : MODIFIER PROFIL ═══ */}
        <Modal open={modalProfil} onClose={() => { setModalProfil(false); setProfilSuccess(""); }} title="✏️ Modifier mon profil" maxWidth={600}>
          <div className="ep-g11s">
            {/* AUDIT-D2 (ticket 0002) — dossier créé via Google OAuth
                (T3.1) : date de naissance/sexe absents à l'origine, non
                modifiables en usage normal (gérées par la réception une
                fois le profil complété — voir portal.controller.js::
                updateProfile). */}
            {patient.profil_a_completer && (
              <>
                <div><label className="elbl">Date de naissance *</label>
                  <input type="date" className="einp" value={profilForm.date_naissance||""} onChange={e => setProfilForm(f => ({...f, date_naissance:e.target.value}))} />
                </div>
                <div><label className="elbl">Sexe *</label>
                  <select className="einp" value={profilForm.sexe||""} onChange={e => setProfilForm(f => ({...f, sexe:e.target.value}))}>
                    <option value="">— Sélectionner —</option>
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                  </select>
                </div>
              </>
            )}
            <div><label className="elbl">Téléphone</label>
              <input className="einp" value={profilForm.telephone||""} onChange={e => setProfilForm(f => ({...f, telephone:e.target.value}))} />
            </div>
            <div><label className="elbl">Ville</label>
              <input className="einp" value={profilForm.adresse?.ville||""} onChange={e => setProfilForm(f => ({...f, adresse:{...f.adresse,ville:e.target.value}}))} />
            </div>
            <div style={{ gridColumn:"1/-1" }}><label className="elbl">Rue / Adresse</label>
              <input className="einp" value={profilForm.adresse?.rue||""} onChange={e => setProfilForm(f => ({...f, adresse:{...f.adresse,rue:e.target.value}}))} />
            </div>
            <div><label className="elbl">Contact urgence – Nom</label>
              <input className="einp" value={profilForm.contact_urgence?.nom||""} onChange={e => setProfilForm(f => ({...f, contact_urgence:{...f.contact_urgence,nom:e.target.value}}))} />
            </div>
            <div><label className="elbl">Contact urgence – Tél.</label>
              <input className="einp" value={profilForm.contact_urgence?.telephone||""} onChange={e => setProfilForm(f => ({...f, contact_urgence:{...f.contact_urgence,telephone:e.target.value}}))} />
            </div>
            {profilSuccess && <div style={{ gridColumn:"1/-1", background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:10, padding:"10px 14px", color:"#065F46", fontSize:13, fontWeight:600 }}>✅ {profilSuccess}</div>}
            {portalError && <div style={{ gridColumn:"1/-1", color:"#DC2626", fontSize:12 }}>❌ {portalError}</div>}
            <div style={{ gridColumn:"1/-1", display:"flex", gap:10 }}>
              <button className="ebtn ebtn-ghost" onClick={() => { setModalProfil(false); setProfilSuccess(""); }}>Annuler</button>
              <button className="ebtn ebtn-teal" style={{ marginLeft:"auto" }} disabled={saving} onClick={handleUpdateProfil}>
                {saving ? "Enregistrement..." : "💾 Enregistrer"}
              </button>
            </div>
          </div>
        </Modal>

        {/* ═══ MODAL : CHANGER MOT DE PASSE ═══ */}
        <Modal open={modalChangePwd} onClose={() => !mustChangePwd && setModalChangePwd(false)} title="🔒 Changer le mot de passe" maxWidth={460}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {mustChangePwd && (
              <div style={{ background:"#FFF7ED", border:"1.5px solid #FED7AA", borderLeft:"4px solid #D97706", borderRadius:12, padding:"12px 16px", fontSize:13, color:"#92400E" }}>
                <strong>⚠ Mot de passe temporaire détecté</strong><br/>
                <span style={{ fontSize:12 }}>Vous devez définir un nouveau mot de passe avant de continuer.</span>
              </div>
            )}
            <div><label className="elbl">Mot de passe actuel (temporaire)</label>
              <input type="password" className="einp" value={pwdForm.currentPassword} onChange={e => setPwdForm(f => ({...f,currentPassword:e.target.value}))} placeholder="Mot de passe actuel" />
            </div>
            <div><label className="elbl">Nouveau mot de passe (min. 8 caractères)</label>
              <input type="password" className="einp" value={pwdForm.newPassword} onChange={e => setPwdForm(f => ({...f,newPassword:e.target.value}))} placeholder="Nouveau mot de passe" />
            </div>
            <div><label className="elbl">Confirmer le nouveau mot de passe</label>
              <input type="password" className="einp" value={pwdForm.confirm} onChange={e => setPwdForm(f => ({...f,confirm:e.target.value}))} placeholder="Confirmation" />
            </div>
            {pwdError && <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10, padding:"10px 14px", color:"#DC2626", fontSize:13 }}>❌ {pwdError}</div>}
            {pwdSuccess && <div style={{ background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:10, padding:"10px 14px", color:"#065F46", fontSize:13, fontWeight:600 }}>✅ {pwdSuccess}</div>}
            <div style={{ display:"flex", gap:10 }}>
              {!mustChangePwd && <button className="ebtn ebtn-ghost" onClick={() => setModalChangePwd(false)}>Annuler</button>}
              <button className="ebtn ebtn-teal" style={{ marginLeft:"auto" }} disabled={saving} onClick={handleChangePassword}>
                {saving ? "En cours..." : "🔒 Changer le mot de passe"}
              </button>
            </div>
          </div>
        </Modal>

      </div>
    </>
  );
}