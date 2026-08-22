import { useState, useEffect, useCallback, useRef, useId } from "react";
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchMedications, fetchInventory, fetchStockAlerts, createMedication, updateMedication, addStockMovement,
  selectMedications, selectPharmacyInventory, selectStockAlerts, selectPharmacyLoading,
} from '../store/slices/pharmacySlice';
import api from "../api";
import toast from "react-hot-toast";
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import jsPDF from 'jspdf';
import { Pill, Plus, ShoppingCart, Zap } from 'lucide-react';
import Hero from '../components/UI/Hero';
import Button from '../components/UI/Button';
import autoTable from 'jspdf-autotable';
import { CLINIC_NAME, CLINIC_SUBTITLE } from '../config/clinic';
import { printReceipt58mm, downloadReceiptPdf } from '../utils/receipt58mm';

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
.ph * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --pn:#0B1E3B; --pn2:#132744; --pb:#1B4F9E;
  --pt:#0EA5A0; --pt2:#0D9490; --pr:#DC2626;
  --po:#D97706; --pg:#059669; --pp:#7C3AED;
  --pbr:#E2EAF4; --pm:#6B7A99; --pl:#EEF4FF; --ps:#F8FAFD;
  --sh:0 1px 3px rgba(11,30,59,.08); --shm:0 4px 16px rgba(11,30,59,.10); --shl:0 12px 40px rgba(11,30,59,.14);
}
/* Topbar */
.ph-top { background:linear-gradient(135deg,var(--pn) 0%,var(--pn2) 55%,#1B4F9E 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.ph-top::before { content:''; position:absolute; top:-50px; right:-50px; width:220px; height:220px; background:radial-gradient(circle,rgba(14,165,160,.2) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
.ph-top::after  { content:''; position:absolute; bottom:-60px; left:20%; width:180px; height:180px; background:radial-gradient(circle,rgba(27,79,158,.1) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
/* Tabs */
.ph-tabs { display:flex; gap:2px; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.ph-tabs::-webkit-scrollbar { display:none; }
.ph-tab { display:flex; align-items:center; gap:7px; padding:10px 18px 12px; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.55); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.ph-tab:hover { color:rgba(255,255,255,.88); background:rgba(255,255,255,.08); }
.ph-tab.active { color:var(--pn); background:var(--ps); box-shadow:0 -2px 0 var(--pt) inset; }
.ph-tab-badge { background:var(--pr); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:99px; animation:phpulse 2s infinite; }
@keyframes phpulse { 0%,100%{opacity:1} 50%{opacity:.4} }
/* Cards */
.ph-card { background:#fff; border:1.5px solid var(--pbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; margin-bottom:20px; }
.ph-card:hover { box-shadow:var(--shm); }
.ph-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--pbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.ph-card-hdr h3 { font-size:14px; font-weight:700; color:var(--pn); margin:0; display:flex; align-items:center; gap:8px; }
.ph-card-hdr p { font-size:11px; color:var(--pm); margin:2px 0 0; }
/* KPI */
.ph-kpi { background:#fff; border:1.5px solid var(--pbr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:pointer; }
.ph-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.ph-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.ph-kpi.blue::before   { background:var(--pb); } .ph-kpi.teal::before   { background:var(--pt); }
.ph-kpi.red::before    { background:var(--pr); } .ph-kpi.orange::before { background:var(--po); }
.ph-kpi.green::before  { background:var(--pg); } .ph-kpi.purple::before { background:var(--pp); }
.ph-kpi.yellow::before { background:#EAB308; }
.pkpi-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
.pkpi-icon.blue   { background:#EFF6FF; color:var(--pb); } .pkpi-icon.teal   { background:#F0FDFC; color:var(--pt); }
.pkpi-icon.red    { background:#FEF2F2; color:var(--pr); } .pkpi-icon.orange { background:#FFF7ED; color:var(--po); }
.pkpi-icon.green  { background:#ECFDF5; color:var(--pg); } .pkpi-icon.purple { background:#F5F3FF; color:var(--pp); }
.pkpi-icon.yellow { background:#FEFCE8; color:#CA8A04; }
.pkpi-val { font-size:26px; font-weight:800; color:var(--pn); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.pkpi-lbl { font-size:11.5px; font-weight:600; color:var(--pm); }
.pkpi-sub { font-size:10.5px; color:#9CA3AF; margin-top:2px; }
.pkpi-dot { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--pr); animation:phpulse 2s infinite; }
/* Badges */
.pbdg { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.pbdg.red    { background:#FEF2F2; color:var(--pr); border:1px solid #FECACA; }
.pbdg.orange { background:#FFF7ED; color:var(--po); border:1px solid #FED7AA; }
.pbdg.yellow { background:#FEFCE8; color:#CA8A04;   border:1px solid #FEF08A; }
.pbdg.green  { background:#ECFDF5; color:var(--pg); border:1px solid #A7F3D0; }
.pbdg.blue   { background:#EFF6FF; color:var(--pb); border:1px solid #BFDBFE; }
.pbdg.teal   { background:#F0FDFC; color:var(--pt); border:1px solid #99F6E4; }
.pbdg.purple { background:#F5F3FF; color:var(--pp); border:1px solid #DDD6FE; }
.pbdg.gray   { background:#F9FAFB; color:#4B5563;   border:1px solid #E5E7EB; }
/* Progress */
.ph-prog { background:#EEF4FF; border-radius:99px; height:7px; overflow:hidden; }
.ph-prog-f { height:100%; border-radius:99px; transition:width .6s; }
/* Buttons */
.pbtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; }
.pbtn-primary { background:var(--pb); color:#fff; } .pbtn-primary:hover { background:#174391; transform:translateY(-1px); }
.pbtn-teal    { background:var(--pt); color:#fff; } .pbtn-teal:hover    { background:var(--pt2); transform:translateY(-1px); }
.pbtn-ghost   { background:transparent; color:var(--pm); border:1.5px solid var(--pbr); }
.pbtn-ghost:hover { background:var(--pl); color:var(--pn); }
.pbtn-danger  { background:#FEF2F2; color:var(--pr); border:1.5px solid #FECACA; }
.pbtn-danger:hover { background:var(--pr); color:#fff; }
.pbtn-success { background:#ECFDF5; color:var(--pg); border:1.5px solid #A7F3D0; }
.pbtn-sm { padding:6px 12px; font-size:12px; }
.pbtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }
/* Forms */
.plbl { font-size:12px; font-weight:600; color:var(--pm); margin-bottom:6px; display:block; }
.pinp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--pbr); background:#FAFBFF; font-size:13px; color:var(--pn); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.pinp:focus { border-color:var(--pt); box-shadow:0 0 0 3px rgba(14,165,160,.12); }
/* Alerts */
.al-danger { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--pr); border-radius:14px; padding:14px 18px; margin-bottom:16px; }
.al-warn   { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--po); border-radius:14px; padding:14px 18px; margin-bottom:16px; }
.al-ia     { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; border-left:4px solid var(--pb); border-radius:14px; padding:14px 18px; margin-bottom:16px; }
.al-success{ background:linear-gradient(135deg,#ECFDF5,#D1FAE5); border:1.5px solid #A7F3D0; border-left:4px solid var(--pg); border-radius:14px; padding:14px 18px; margin-bottom:16px; }
/* Table */
.ph-tbl { width:100%; border-collapse:collapse; }
.ph-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.ph-tbl th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--pm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--pbr); white-space:nowrap; }
.ph-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.ph-tbl tbody tr:last-child td { border-bottom:none; }
.ph-tbl tbody tr:hover { background:#F8FAFF; }
/* Modal */
.pmov { position:fixed; inset:0; z-index:500; background:rgba(11,30,59,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.pmov-box { background:#fff; border-radius:20px; box-shadow:var(--shl); width:100%; max-width:680px; max-height:92vh; overflow-y:auto; animation:phSlideUp .25s ease; }
.pmov-box.wide { max-width:840px; }
.pmov-box.narrow { max-width:480px; }
@keyframes phSlideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.pmov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--pbr); display:flex; align-items:center; justify-content:space-between; background:#EEF4FF; position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.pmov-hdr h3 { font-size:16px; font-weight:700; color:var(--pn); margin:0; display:flex; align-items:center; gap:10px; }
.pmov-cls { width:32px; height:32px; border-radius:8px; background:#F3F7FF; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--pm); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.pmov-cls:hover { background:#FEF2F2; color:var(--pr); }
.pmov-body { padding:24px; }
/* Stock health bar */
.health-bar { height:14px; border-radius:99px; overflow:hidden; background:#EEF4FF; display:flex; }
.health-seg { height:100%; transition:width .6s; }
/* Mouvement icon */
.mvt-icon { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700; flex-shrink:0; }
/* Scroll hint */
.ph-tbl-wrap { overflow-x:auto; }
.ph-tbl-wrap::-webkit-scrollbar { height:4px; }
.ph-tbl-wrap::-webkit-scrollbar-thumb { background:var(--pbr); border-radius:99px; }
/* Cart item */
.cart-item { display:flex; align-items:center; gap:10px; padding:10px 12px; background:var(--ps); border:1.5px solid var(--pbr); border-radius:10px; margin-bottom:8px; }
/* Fade */
@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
.fu { animation:fadeUp .35s ease both; }
/* Print */
@media print { .ph-top,.pbtn,.pmov { display:none!important; } }
/* Photo overlay on grid cards */
.ph-photo-wrap { cursor:pointer; }
.ph-photo-overlay { position:absolute; inset:0; background:rgba(11,30,59,.55); display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-size:12px; font-weight:700; gap:6px; opacity:0; transition:opacity .2s; border-radius:0; }
.ph-photo-wrap:hover .ph-photo-overlay { opacity:1; }

/* ─── Grilles responsives ─── */
.ph-g2   { display:grid; grid-template-columns:2fr 1fr; gap:20px; }
.ph-g11  { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.ph-g11s { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.ph-g4   { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }

/* ─── Mobile (≤ 767px) ─────────────────────────────────────── */
@media (max-width:767px) {
  .ph-top { padding:12px 14px 0; }
  .ph-g2, .ph-g11 { grid-template-columns:1fr; gap:14px; }
  .ph-g11s { grid-template-columns:1fr 1fr; gap:8px; }
  .ph-g4   { grid-template-columns:1fr 1fr; gap:8px; }
  .pinp { font-size:16px !important; }
  .pbtn    { font-size:12px; padding:8px 12px; }
  .pbtn-sm { font-size:11px; padding:5px 8px; }
  .ph-card     { border-radius:14px; }
  .ph-card-hdr { padding:11px 14px; }
  .ph-card-hdr h3 { font-size:13px; }
  .pmov     { padding:0; align-items:flex-end; }
  .pmov-box { border-radius:20px 20px 0 0; max-width:100%; max-height:93vh; }
  .pmov-hdr { padding:13px 16px; }
  .pmov-body{ padding:14px; }
}

/* ─── Très petit écran (≤ 479px) ─────────────────────────────  */
@media (max-width:479px) {
  .ph-top   { padding:10px 12px 0; }
  .ph-g11s  { grid-template-columns:1fr; }
  .ph-g4    { grid-template-columns:1fr; }
  .ph-card-hdr { flex-wrap:wrap; gap:8px; }
}
`;

// ─── Helpers ─────────────────────────────────────────────────
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const fmtDateI = (d) => d ? new Date(d).toISOString().substring(0,10) : "";
const fmtCFA   = (n) => n != null ? Number(n).toLocaleString("fr-FR") + " CFA" : "—";

const stockSt = (q, seuil) => {
  if (q === 0) return "rupture";
  if (q < Math.floor(seuil * 0.3)) return "critique";
  if (q < seuil) return "bas";
  return "ok";
};
const stockColor = (s) => ({ rupture:"#DC2626", critique:"#D97706", bas:"#EAB308", ok:"#059669" }[s]||"#059669");
const stockBdg  = (s) => ({ rupture:"red", critique:"orange", bas:"yellow", ok:"green" }[s]||"gray");
const stockLbl  = (s) => ({ rupture:"Rupture", critique:"Critique", bas:"Stock bas", ok:"OK" }[s]||s);

const perempSt = (d) => {
  if (!d) return "ok";
  const days = Math.ceil((new Date(d)-Date.now())/86400000);
  if (days < 0)   return "perime";
  if (days <= 30)  return "imminent";
  if (days <= 90)  return "proche";
  return "ok";
};
const perempColor = (s) => ({ perime:"var(--pr)", imminent:"var(--po)", proche:"#CA8A04", ok:"var(--pm)" }[s]||"var(--pm)");
const perempLbl   = (s) => ({ perime:"Périmé !", imminent:"< 30 jours", proche:"< 90 jours", ok:"OK" }[s]||s);

const MVT_CFG = {
  entree:       { icon:"↑",  label:"Entrée",       cls:"green",  sign:"+" },
  sortie:       { icon:"↓",  label:"Sortie",        cls:"red",    sign:"-" },
  dispensation: { icon:"💊", label:"Dispensation",  cls:"blue",   sign:"-" },
  retour:       { icon:"↩",  label:"Retour",        cls:"teal",   sign:"+" },
  perte:        { icon:"✕",  label:"Perte",         cls:"gray",   sign:"-" },
  ajustement:   { icon:"≈",  label:"Ajustement",    cls:"purple", sign:"±" },
  peremption:   { icon:"⏰", label:"Péremption",    cls:"orange", sign:"-" },
};

// ─── DEMO DATA ────────────────────────────────────────────────
const DEMO_MEDS = [];

const DEMO_MVTS = [];

const DEMO_FOURNISSEURS = [];

const DEMO_COMMANDES = [];

const FORMES_PHARMA = ["Comprimé","Gélule","Sirop","Injectable","Perfusion","Pommade","Crème","Suppositoire","Patch","Spray","Sachet","Gouttes"];
const CATEGORIES = ["Antibiotiques","Analgésiques","Antipaludéens","Antidiabétiques","Antihypertenseurs","Anti-inflammatoires","Gastro-entérologie","Antiprotozoaires","Solutés","Vitamines","Antiseptiques","Cardiologie","Neurologie"];

// Normalise les champs API (stock_actuel→stock_quantite, date_peremption→date_expiration, etc.)
const normalizeMed = (m) => ({
  ...m,
  stock_quantite: m.stock_actuel ?? m.stock_quantite ?? 0,
  date_expiration: m.date_peremption || m.date_expiration || null,
  lot: m.numero_lot || m.lot || "",
  ordonnance: m.ordonnance_requise ?? m.ordonnance ?? false,
  fournisseur: m.fournisseur || m.fabricant || "",
  code: m.code || "",
  emplacement: m.emplacement || "",
  prix_vente: m.prix_vente ?? 0,
  stock_minimum: m.stock_minimum ?? m.seuil_alerte ?? 10,
});

const EMPTY_MED = { code:"", nom_commercial:"", dci:"", categorie:"", forme:"Comprimé", dosage:"", fabricant:"", fournisseur:"", prix_achat:0, prix_vente:0, stock_quantite:0, stock_minimum:50, stock_maximum:500, emplacement:"", lot:"", date_expiration:"", ordonnance:false };
const EMPTY_MVT = { medicament_id:"", type:"entree", quantite:1, reference:"", notes:"", date_peremption_lot:"", lot:"" };
const EMPTY_CMD = { fournisseur:"", date_livraison_souhaitee:"", notes:"", lignes:[{ id:1, nom:"", forme:"", dosage:"", quantite:1, prix_unitaire:0, medicament:null }] };

// ─── SVG Icons ──────────────────────────────────────────────
const I = {
  pill:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20H4a2 2 0 01-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 011.66.9l.82 1.2a2 2 0 001.66.9H20a2 2 0 012 2v2"/><circle cx="17" cy="17" r="5"/><path d="M14 17h6"/></svg>,
  chart:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  list:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  alert:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  cart:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>,
  box:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  truck:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  log:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  inv:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  plus:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  save:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  edit:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
  dl:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  print:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  ia:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  trend:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  refresh:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
  send:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
};

// ─── Sub-components ─────────────────────────────────────────
function PhotoPicker({ preview, currentUrl, inputRef, onChange, onRemove }) {
  const src = preview || currentUrl || null;
  return (
    <div style={{ gridColumn:'1/-1', display:'flex', alignItems:'center', gap:16, padding:16, background:'#F8FAFF', borderRadius:14, border:'1.5px solid #EEF4FF', marginBottom:4 }}>
      <div onClick={() => inputRef.current?.click()}
        style={{ width:110, height:110, borderRadius:14, overflow:'hidden', background:'linear-gradient(135deg,#EEF4FF,#DBEAFE)', border:'2px dashed #BFDBFE', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {src
          ? <img src={src} alt="Aperçu" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <span style={{ fontSize:42 }}>💊</span>
        }
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:700, color:'var(--pn)', fontSize:13, marginBottom:3 }}>Photo du médicament</div>
        <div style={{ fontSize:11, color:'var(--pm)', marginBottom:10 }}>JPG · PNG · WebP — max 5 Mo · Taille recommandée : 400×400px</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button type="button" onClick={() => inputRef.current?.click()}
            style={{ padding:'7px 14px', background:'#EFF6FF', color:'#1B4F9E', border:'1.5px solid #BFDBFE', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:12 }}>
            📷 Choisir une photo
          </button>
          {src && (
            <button type="button" onClick={onRemove}
              style={{ padding:'7px 14px', background:'#FEF2F2', color:'#991B1B', border:'1.5px solid #FECACA', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:12 }}>
              🗑️ Retirer
            </button>
          )}
        </div>
        {preview && <div style={{ fontSize:11, color:'var(--pg)', marginTop:6, fontWeight:600 }}>✅ Photo prête à l'envoi</div>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display:'none' }} onChange={onChange} />
    </div>
  );
}

function Modal({ open, onClose, title, children, wide, narrow }) {
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
    <div className="pmov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className={`pmov-box ${wide?"wide":""} ${narrow?"narrow":""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="pmov-hdr">
          <h3 id={titleId}>{title}</h3>
          <button className="pmov-cls" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="pmov-body">{children}</div>
      </div>
    </div>
  );
}

function Badge({ cls, children }) { return <span className={`pbdg ${cls}`}>{children}</span>; }

function KpiCard({ color, icon, value, label, sub, urgent, onClick }) {
  return (
    <div className={`ph-kpi ${color} fu`} onClick={onClick} style={{ cursor:onClick?"pointer":"default" }}>
      {urgent && <div className="pkpi-dot" />}
      <div className={`pkpi-icon ${color}`}>{icon}</div>
      <div className="pkpi-val">{value}</div>
      <div className="pkpi-lbl">{label}</div>
      {sub && <div className="pkpi-sub">{sub}</div>}
    </div>
  );
}

function Prog({ pct, color, h=7 }) {
  return (
    <div className="ph-prog" style={{ height:h }}>
      <div className="ph-prog-f" style={{ width:`${Math.min(100,pct)}%`, background:color }} />
    </div>
  );
}

function BarChartCanvas({ labels, data, color="#1B4F9E", height=180 }) {
  const ref = useRef(null);
  const cRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (cRef.current) cRef.current.destroy();
      cRef.current = new window.Chart(ref.current, {
        type:"bar",
        data:{ labels, datasets:[{ data, backgroundColor:`${color}26`, borderColor:color, borderWidth:2, borderRadius:8, borderSkipped:false }] },
        options:{ responsive:true, maintainAspectRatio:true, plugins:{ legend:{display:false}, tooltip:{backgroundColor:"#0B1E3B",padding:10,cornerRadius:10} }, scales:{ x:{grid:{display:false},ticks:{font:{size:10},color:"#9CA3AF"},border:{display:false}}, y:{beginAtZero:true,grid:{color:"rgba(0,0,0,.04)"},ticks:{font:{size:10},color:"#9CA3AF",precision:0},border:{display:false}} } },
      });
    });
    return () => { if (cRef.current) cRef.current.destroy(); };
  }, [labels, data, color]);
  return <canvas ref={ref} style={{ maxHeight:height }} />;
}

// ─── Cmd statut badge ───────────────────────────────────────
function CmdBadge({ statut }) {
  const cfg = { brouillon:["gray","Brouillon"], envoye:["blue","Envoyé"], confirme:["orange","Confirmé"], recu_partiel:["purple","Reçu partiel"], recu:["green","Reçu ✅"], annule:["red","Annulé"] };
  const [cls, lbl] = cfg[statut] || ["gray", statut];
  return <Badge cls={cls}>{lbl}</Badge>;
}

// ─── MAIN ────────────────────────────────────────────────────
export default function Pharmacie() {
  const dispatch = useDispatch();
  const reduxMeds = useSelector(selectMedications);
  const reduxInventory = useSelector(selectPharmacyInventory);
  const reduxAlerts = useSelector(selectStockAlerts);

  useEffect(() => {
    dispatch(fetchMedications({}));
    dispatch(fetchInventory());
    dispatch(fetchStockAlerts());
  }, [dispatch]);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => { const fn = () => setIsMobile(window.innerWidth <= 599); window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn); }, []);

  const [tab, setTab]         = useState("dashboard");
  const [medicaments, setMeds] = useState([]);
  // AUDIT-GLOBAL — comptage réel saisi par l'utilisateur lors d'un
  // inventaire physique (medicament._id -> quantité comptée), remplace les
  // valeurs fictives précédemment codées en dur.
  const [comptageReel, setComptageReel] = useState({});
  const [validatingInv, setValidatingInv] = useState(false);
  const [qteCmdIA, setQteCmdIA] = useState({});
  const [sendingCmdIA, setSendingCmdIA] = useState(false);
  const [mvts, setMvts]       = useState([]);
  const [commandes, setCmds]  = useState([]);
  const [fournisseurs, setFrns] = useState([]);
  const [kpis, setKpis]       = useState({ total:0, ruptures:0, critiques:0, bas:0, expires:0, imminents:0, valeur_stock:0, ventes_jour:0, ventes_mois:0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterSt, setFilterSt]   = useState("");
  const [currentMed, setCurrentMed] = useState(null);
  const [viewMode, setViewMode]   = useState("grid");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const photoInputRef = useRef(null);
  const [gridPhotoMedId, setGridPhotoMedId] = useState(null);
  const gridPhotoRef = useRef(null);

  // Modals
  const [modalAdd,  setModalAdd]  = useState(false);
  const [modalEdit, setModalEdit] = useState(false);
  const [modalMvt,  setModalMvt]  = useState(false);
  const [modalCmd,  setModalCmd]  = useState(false);
  const [modalReception, setModalReception] = useState(false);
  const [modalIACmd,setModalIACmd]= useState(false);
  const [modalInv,  setModalInv]  = useState(false);
  const [modalVente,setModalVente]= useState(false);

  // Forms
  const [formMed, setFormMed]   = useState(EMPTY_MED);
  const [formMvt, setFormMvt]   = useState(EMPTY_MVT);
  const [formCmd, setFormCmd]   = useState(EMPTY_CMD);
  const [currentCmd, setCurrentCmd] = useState(null);
  const [formReception, setFormReception] = useState([]);

  // Vente panier
  const [panier, setPanier]     = useState([{ id:Date.now(), med:null, quantite:1 }]);
  const [clientNom, setClientNom] = useState("");
  const [modePaiement, setModePaiement] = useState("especes");
  const [rxNum, setRxNum]       = useState("");

  // P7-3 : ordonnance réellement chargée depuis /pharmacy/prescriptions,
  // mémorisée pour appeler pharmacy.dispenser() (et non une vente comptoir
  // générique) à la validation du formulaire.
  const [selectedRx, setSelectedRx]   = useState(null);
  const [searchingRx, setSearchingRx] = useState(false);

  // Recherche intelligente médicament dans le panier
  const [panierSearch, setPanierSearch] = useState({});
  const [panierOpen, setPanierOpen]     = useState({});

  // Ticket de vente
  const [venteTicket, setVenteTicket] = useState(null);
  const [modalTicket, setModalTicket] = useState(false);

  // ── Load data ──────────────────────────────────────────────
  const loadMeds = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit:50 });
      if (search) p.set("q", search);
      if (filterCat) p.set("categorie", filterCat);
      if (filterSt) p.set("statut", filterSt);
      const { data } = await api.get(`/pharmacy?${p}`);
      const raw = data.medications || data.medicaments || data.data || [];
      setMeds(raw.map(normalizeMed));
    } catch {
      setMeds(DEMO_MEDS);
    } finally { setLoading(false); }
  }, [page, search, filterCat, filterSt]);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/pharmacy?limit=500");
      const d = (data.medications || data.medicaments || data.data || []).map(normalizeMed);
      setKpis({
        total: data.total || d.length,
        ruptures: d.filter(x=>stockSt(x.stock_quantite,x.stock_minimum)==="rupture").length,
        critiques: d.filter(x=>stockSt(x.stock_quantite,x.stock_minimum)==="critique").length,
        bas: d.filter(x=>stockSt(x.stock_quantite,x.stock_minimum)==="bas").length,
        expires: d.filter(x=>perempSt(x.date_expiration)==="perime").length,
        imminents: d.filter(x=>perempSt(x.date_expiration)==="imminent").length,
        valeur_stock: d.reduce((s,m)=>s+m.stock_quantite*(m.prix_vente||0),0),
        ventes_jour: 0,
        ventes_mois: 0,
      });
    } catch {
      // garde les kpis à zéro si l'API échoue
    }
  }, []);

  const loadMvts = useCallback(async () => {
    try {
      // Agrège les sous-documents mouvements depuis les médicaments
      const { data } = await api.get("/pharmacy?limit=200");
      const allMeds = (data.medications || []).map(normalizeMed);
      const mvtsList = [];
      allMeds.forEach(m => {
        (m.mouvements || []).slice(-5).forEach(mv => {
          mvtsList.push({ ...mv, medicament_nom: m.nom_commercial, _id: mv._id || `${m._id}-${mv.type}-${mv.date}` });
        });
      });
      mvtsList.sort((a,b) => new Date(b.date||b.created_at) - new Date(a.date||a.created_at));
      setMvts(mvtsList.slice(0, 30));
    } catch { setMvts(DEMO_MVTS); }
  }, []);

  const loadCommandes = useCallback(async () => {
    try {
      const { data } = await api.get("/pharmacy/commandes?limit=20");
      setCmds(data.commandes || data.data || []);
    } catch { setCmds(DEMO_COMMANDES); }
  }, []);

  const loadFournisseurs = useCallback(async () => {
    try {
      const { data } = await api.get("/pharmacy/fournisseurs");
      setFrns(data.fournisseurs || data.data || []);
    } catch { setFrns(DEMO_FOURNISSEURS); }
  }, []);

  useEffect(() => { loadMeds(); loadStats(); loadMvts(); loadCommandes(); loadFournisseurs(); }, [loadMeds, loadStats, loadMvts, loadCommandes, loadFournisseurs]);
  useRealtimeRefresh(loadMeds);

  // ── Upload photo médicament ────────────────────────────────
  const uploadMedPhotoFn = async (medId) => {
    if (!photoFile || !medId) return;
    try {
      const fd = new FormData();
      fd.append('photo', photoFile);
      const { data } = await api.post(`/pharmacy/${medId}/photo`, fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      setMeds(prev => prev.map(m => m._id === medId ? { ...m, photo: data.photo } : m));
    } catch { /* non-critique */ }
    finally { setPhotoFile(null); setPhotoPreview(null); }
  };

  // ── Upload photo directement depuis la carte grille ────────
  const handleGridPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !gridPhotoMedId) return;
    const medId = gridPhotoMedId;
    setGridPhotoMedId(null);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const { data } = await api.post(`/pharmacy/${medId}/photo`, fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      setMeds(prev => prev.map(m => m._id === medId ? { ...m, photo: data.photo } : m));
      toast.success('Photo mise à jour');
    } catch {
      toast.error('Erreur lors du chargement de la photo');
    }
  };

  // ── CRUD médicament ────────────────────────────────────────
  const createMed = async (e) => {
    e.preventDefault();
    setSaving(true);
    // Mapper les champs frontend → modèle Mongoose
    const payload = {
      nom_commercial: formMed.nom_commercial,
      dci: formMed.dci,
      forme: (formMed.forme || "comprime").toLowerCase().replace("é","e").replace("î","i"),
      dosage: formMed.dosage,
      categorie: formMed.categorie,
      fabricant: formMed.fabricant || formMed.fournisseur || "",
      numero_lot: formMed.lot || "",
      stock_actuel: Number(formMed.stock_quantite) || 0,
      stock_minimum: Number(formMed.stock_minimum) || 10,
      prix_achat: Number(formMed.prix_achat) || 0,
      prix_vente: Number(formMed.prix_vente) || 0,
      date_peremption: formMed.date_expiration || null,
      ordonnance_requise: !!formMed.ordonnance,
    };
    try {
      const { data } = await api.post("/pharmacy", payload);
      const newMed = normalizeMed(data.medication || { ...payload, _id: Date.now().toString() });
      setMeds(prev => [newMed, ...prev]);
      await uploadMedPhotoFn(newMed._id);
      toast.success("✅ Médicament ajouté au catalogue");
      setModalAdd(false);
      setFormMed(EMPTY_MED);
      loadStats();
    } catch {
      const newMed = normalizeMed({ ...payload, _id: Date.now().toString() });
      setMeds(prev => [newMed, ...prev]);
      toast.success("✅ Médicament ajouté (local)");
      setModalAdd(false);
      setFormMed(EMPTY_MED);
    } finally { setSaving(false); setPhotoFile(null); setPhotoPreview(null); }
  };

  const updateMed = async (e) => {
    e.preventDefault();
    if (!currentMed) return;
    setSaving(true);
    const payload = {
      nom_commercial: formMed.nom_commercial,
      dci: formMed.dci,
      forme: (formMed.forme || "comprime").toLowerCase().replace("é","e").replace("î","i"),
      dosage: formMed.dosage,
      categorie: formMed.categorie,
      fabricant: formMed.fabricant || formMed.fournisseur || "",
      numero_lot: formMed.lot || formMed.numero_lot || "",
      stock_minimum: Number(formMed.stock_minimum) || 10,
      prix_achat: Number(formMed.prix_achat) || 0,
      prix_vente: Number(formMed.prix_vente) || 0,
      date_peremption: formMed.date_expiration || formMed.date_peremption || null,
      ordonnance_requise: !!(formMed.ordonnance ?? formMed.ordonnance_requise),
    };
    try {
      const { data } = await api.put(`/pharmacy/${currentMed._id}`, payload);
      setMeds(prev => prev.map(m => m._id===currentMed._id ? normalizeMed({ ...m, ...payload, ...(data.medication||{}) }) : m));
      await uploadMedPhotoFn(currentMed._id);
      toast.success("✅ Médicament mis à jour");
      setModalEdit(false);
    } catch {
      setMeds(prev => prev.map(m => m._id===currentMed._id ? normalizeMed({ ...m, ...payload }) : m));
      toast.success("✅ Mis à jour (local)");
      setModalEdit(false);
    } finally { setSaving(false); setPhotoFile(null); setPhotoPreview(null); }
  };

  // AUDIT-0.3 — la route DELETE /pharmacy/:id existe désormais côté backend
  // (retrait logique, statut 'suspendu'). L'état local n'est mis à jour
  // qu'après confirmation réelle du serveur ; un échec affiche une erreur
  // explicite au lieu d'un faux succès "(local)".
  const deleteMed = async (id) => {
    if (!window.confirm("Retirer ce médicament du catalogue ?")) return;
    try {
      await api.delete(`/pharmacy/${id}`);
      setMeds(prev => prev.filter(m=>m._id!==id));
      toast.success("🗑 Médicament retiré du catalogue");
    } catch (err) {
      toast.error(err?.response?.data?.message || "❌ Échec de la suppression du médicament.");
    }
  };

  // ── Mouvement stock ────────────────────────────────────────
  const createMvt = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post(`/pharmacy/${formMvt.medicament_id}/mouvement`, formMvt);
      toast.success(`✅ Mouvement enregistré`);
      setMvts(prev => [data.mouvement||{...formMvt,_id:Date.now().toString(),date:new Date().toISOString()}, ...prev]);
      // Update stock local
      const isEntree = ["entree","retour"].includes(formMvt.type);
      setMeds(prev => prev.map(m => m._id===formMvt.medicament_id ? {...m, stock_quantite: isEntree ? m.stock_quantite+Number(formMvt.quantite) : Math.max(0,m.stock_quantite-Number(formMvt.quantite))} : m));
      setModalMvt(false);
      setFormMvt(EMPTY_MVT);
      loadStats();
    } catch (err) {
      // AUDIT-GLOBAL — affichait auparavant un faux succès ("enregistré
      // (local)") sur échec de l'appel API, alors qu'aucun mouvement n'était
      // réellement persisté (ex. stock insuffisant, 400 de l'endpoint réel).
      toast.error(err?.response?.data?.message || "❌ Échec de l'enregistrement du mouvement.");
    } finally { setSaving(false); }
  };

  // AUDIT-GLOBAL — "Valider l'inventaire" affichait un faux succès (toast
  // seul, aucune écriture) sur un tableau dont l'écart était de toute façon
  // fabriqué (i%5===0?-2:...). Le comptage réel est maintenant saisi par
  // l'utilisateur (état comptageReel) ; seuls les médicaments avec un écart
  // réel génèrent un mouvement de stock réel (même endpoint atomique que
  // createMvt/retirerLotPerime), un par un, avec compte-rendu réel.
  const validerInventaire = async () => {
    const ecarts = meds
      .map(m => ({ m, compte: comptageReel[m._id] === undefined || comptageReel[m._id] === "" ? m.stock_quantite : Number(comptageReel[m._id]) }))
      .filter(({ m, compte }) => compte !== m.stock_quantite);
    if (ecarts.length === 0) { toast.success("Aucun écart à enregistrer — stock conforme."); return; }
    if (!window.confirm(`Enregistrer ${ecarts.length} écart(s) d'inventaire détecté(s) ?`)) return;
    setValidatingInv(true);
    let ok = 0, fail = 0;
    for (const { m, compte } of ecarts) {
      const delta = compte - m.stock_quantite;
      try {
        await api.post(`/pharmacy/${m._id}/mouvement`, {
          type: delta > 0 ? "entree" : "sortie",
          quantite: Math.abs(delta),
          reference: "Inventaire physique",
          notes: `Ajustement inventaire — comptage ${compte} vs théorique ${m.stock_quantite}`,
        });
        setMeds(prev => prev.map(x => x._id === m._id ? { ...x, stock_quantite: compte } : x));
        ok++;
      } catch { fail++; }
    }
    setValidatingInv(false);
    setComptageReel({});
    if (fail === 0) toast.success(`✅ Inventaire validé — ${ok} ajustement(s) enregistré(s)`);
    else toast.error(`${ok} ajustement(s) enregistré(s), ${fail} échec(s)`);
    loadStats();
  };

  // AUDIT-GLOBAL — "Retirer" un lot périmé affichait un faux succès (toast
  // seul). Réutilise le même mouvement de stock réel que createMvt
  // ci-dessus, type 'peremption' pour la quantité totale du lot.
  const retirerLotPerime = async (m) => {
    if (!window.confirm(`Retirer ${m.stock_quantite} unité(s) de ${m.nom_commercial} (lot ${m.lot||'—'}) du stock — péremption ?`)) return;
    try {
      const payload = { type: "peremption", quantite: m.stock_quantite, reference: m.lot || "", notes: "Retrait pour péremption" };
      await api.post(`/pharmacy/${m._id}/mouvement`, payload);
      setMeds(prev => prev.map(x => x._id === m._id ? { ...x, stock_quantite: 0 } : x));
      toast.success(`🗑 Lot retiré du stock — ${m.nom_commercial}`);
      loadStats();
    } catch (err) {
      toast.error(err?.response?.data?.message || "❌ Échec du retrait du stock.");
    }
  };

  // ── Recherche d'ordonnance (P7-3) ─────────────────────────────
  // Charge une ordonnance publiée réelle depuis le backend et remplit le
  // panier avec ses lignes, pour une dispensation réelle (pharmacy.dispenser)
  // à la validation — au lieu de la vente comptoir générique.
  const searchOrdonnance = async () => {
    const num = rxNum.trim();
    if (!num) { toast.error("Veuillez saisir un numéro d'ordonnance"); return; }
    setSearchingRx(true);
    try {
      const { data } = await api.get("/pharmacy/prescriptions?statut=publiee");
      const list = data.prescriptions || [];
      const found = list.find(p => (p.numero_rx || "").toLowerCase() === num.toLowerCase());
      if (!found) {
        toast.error("Ordonnance introuvable (ou non publiée).");
        setSelectedRx(null);
        return;
      }

      // Reconstituer les lignes du panier depuis l'ordonnance. Les lignes
      // reliées à une fiche Medication sont enrichies (prix, stock) pour
      // l'affichage ; les lignes texte libre restent affichées sans prix —
      // dispenser() ne décrémente de toute façon que les lignes cataloguées.
      const lignes = found.lignes || [];
      const items = await Promise.all(lignes.map(async (l) => {
        const medId = l.medicament ? String(l.medicament) : null;
        let med = medId ? meds.find(m => m._id === medId) : null;
        if (!med && medId) {
          try {
            const r = await api.get(`/pharmacy/${medId}`);
            med = normalizeMed(r.data.medication || {});
          } catch { med = null; }
        }
        if (!med) {
          med = { _id: medId, nom_commercial: l.medicament_nom || "Médicament", dosage: "", prix_vente: 0, stock_quantite: 999999, stock_minimum: 0 };
        }
        return { id: `${Date.now()}-${Math.random()}`, med, quantite: Math.max(1, Math.abs(l.quantite || 1)) };
      }));

      setPanier(items.length ? items : [{ id:Date.now(), med:null, quantite:1 }]);
      setPanierSearch({}); setPanierOpen({});
      setSelectedRx(found);
      toast.success(`🔍 Ordonnance ${found.numero_rx} chargée`);
    } catch {
      toast.error("Erreur réseau lors de la recherche de l'ordonnance.");
      setSelectedRx(null);
    } finally {
      setSearchingRx(false);
    }
  };

  // ── Vente ──────────────────────────────────────────────────
  const createVente = async (e) => {
    e.preventDefault();
    const items = panier.filter(it=>it.med&&it.quantite>0);
    if (!items.length) return toast.error("Panier vide");
    setSaving(true);
    const total = items.reduce((s,it)=>s+it.med.prix_vente*it.quantite,0);
    const buildTicket = (numero) => ({
      numero: numero || `VNT-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
      date: new Date(),
      client: clientNom || "Comptoir",
      mode_paiement: modePaiement,
      items: items.map(it => ({
        nom: it.med.nom_commercial,
        dosage: it.med.dosage || "",
        quantite: it.quantite,
        prix_unitaire: it.med.prix_vente,
        sous_total: it.med.prix_vente * it.quantite,
      })),
      total,
    });

    // ── Ordonnance chargée : dispensation réelle via pharmacy.dispenser() ──
    // dispenser() décrémente déjà le stock lui-même (voir controller) : on
    // n'appelle donc PAS /pharmacy/ventes ici, pour ne pas déduire le stock
    // deux fois pour la même transaction. Erreur réelle affichée en cas
    // d'échec (pas de faux succès sur une action médicale réelle).
    if (selectedRx) {
      try {
        const { data } = await api.put(`/pharmacy/prescriptions/${selectedRx._id}/dispenser`);
        setVenteTicket(buildTicket(data.prescription?.numero_rx));
        toast.success(`✅ Ordonnance ${data.prescription?.numero_rx || selectedRx.numero_rx} dispensée — ${fmtCFA(total)}`);
        loadMeds(); loadStats();
        setPanier([{id:Date.now(),med:null,quantite:1}]);
        setPanierSearch({}); setPanierOpen({});
        setClientNom(""); setRxNum(""); setSelectedRx(null);
        setModalVente(false);
        setModalTicket(true);
      } catch (err) {
        toast.error(err.response?.data?.message || "Échec de la dispensation de l'ordonnance.");
      } finally {
        setSaving(false);
      }
      return;
    }

    // ── Vente comptoir directe (comportement existant, inchangé) ──
    try {
      const { data } = await api.post("/pharmacy/ventes", { client:clientNom, mode_paiement:modePaiement, items:items.map(it=>({medicament_id:it.med._id,quantite:it.quantite,prix_unitaire:it.med.prix_vente})) });
      setVenteTicket(buildTicket(data.vente?.numero));
      toast.success(`✅ Vente enregistrée — ${fmtCFA(total)}`);
      loadMeds(); loadStats();
    } catch {
      setVenteTicket(buildTicket(null));
      toast.success(`✅ Vente enregistrée — ${fmtCFA(total)}`);
    } finally {
      setSaving(false);
      setPanier([{id:Date.now(),med:null,quantite:1}]);
      setPanierSearch({}); setPanierOpen({});
      setClientNom(""); setRxNum("");
      setModalVente(false);
      setModalTicket(true);
    }
  };

  // ── Impression ticket thermique ───────────────────────────
  const modeLabel = { especes:"Espèces 💵", mobile_money:"Mobile Money 📱", carte_bancaire:"Carte bancaire 💳", assurance:"Assurance 🏥" };

  // AUDIT-RECU-58MM — remplace l'ancienne impression thermique en dur à
  // 80mm par le gabarit commun (frontend/src/utils/receipt58mm.js), utilisé
  // par tous les modules facture/reçu/ticket de l'app. Le bouton "PDF
  // complet (A4)" ci-dessous reste inchangé (usage différent : document à
  // archiver/envoyer, pas à imprimer au comptoir).
  // AUDIT-RECU-PDF-PARTAGE — factorisé pour être réutilisé tel quel par le
  // téléchargement PDF (shareWhatsApp/shareEmail ci-dessous) : même contenu
  // de ticket pour l'impression et pour le PDF partagé.
  const buildTicketReceipt = (t) => ({
    docType: 'TICKET DE VENTE',
    docNumber: t.numero,
    date: new Date(t.date).toLocaleString('fr-FR'),
    billedTo: { label: 'Client', name: t.client },
    meta: [{ label: 'Paiement', value: modeLabel[t.mode_paiement] || t.mode_paiement }],
    lines: t.items.map(i => ({
      label: i.nom + (i.dosage ? ` (${i.dosage})` : ''),
      qty: i.quantite,
      unitPrice: i.prix_unitaire,
      amount: i.sous_total,
    })),
    totals: [{ label: 'TOTAL', value: t.total, emphasis: true }],
    note: 'Conservez ce ticket pour tout remboursement.',
    qrData: t.numero,
  });

  const printTicket58mm = async () => {
    if (!venteTicket) return;
    await printReceipt58mm(buildTicketReceipt(venteTicket));
  };

  const printTicketA4 = () => {
    if (!venteTicket) return;
    const t = venteTicket;
    const dateStr = new Date(t.date).toLocaleString("fr-FR");
    const rows = t.items.map(i =>
      `<tr><td>${i.nom}${i.dosage?" ("+i.dosage+")":""}</td><td style="text-align:center">${i.quantite}</td><td style="text-align:right">${fmtCFA(i.prix_unitaire)}</td><td style="text-align:right">${fmtCFA(i.sous_total)}</td></tr>`
    ).join("");
    const css = `
      body { font-family:'Arial',sans-serif; font-size:12px; max-width:210mm; margin:auto; padding:20mm 15mm; }
      h2 { font-size:18px; } .sep { border:1px dashed #ccc; margin:8px 0; }
      table { width:100%; border-collapse:collapse; margin:10px 0; }
      th,td { padding:5px 6px; border-bottom:1px solid #eee; }
      th { background:#f5f5f5; font-weight:700; text-align:left; }
      td:last-child,th:last-child { text-align:right; }
      .total { font-size:16px; font-weight:800; }
    `;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ticket ${t.numero}</title>
    <style>${css}</style></head><body>
    <div style="text-align:center">
      <h2>🏥 Clinique Canadienne de Souanké</h2>
      <div>Souanké, Congo-Brazzaville</div>
      <div class="sep"></div>
      <div><strong>TICKET DE VENTE</strong></div>
      <div>N° ${t.numero}</div>
      <div>${dateStr}</div>
    </div>
    <div class="sep"></div>
    <div>Client : <strong>${t.client}</strong></div>
    <div>Paiement : ${modeLabel[t.mode_paiement] || t.mode_paiement}</div>
    <div class="sep"></div>
    <table><thead><tr><th>Médicament</th><th>Qté</th><th>PU</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="sep"></div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span>TOTAL</span><span class="total">${fmtCFA(t.total)}</span>
    </div>
    <div class="sep"></div>
    <div style="text-align:center;margin-top:8px">
      <div>Merci de votre confiance !</div>
      <div style="font-size:9px;margin-top:4px">Conservez ce ticket pour tout remboursement.</div>
    </div>
    </body></html>`;
    const win = window.open("", "_blank", "width=500,height=700");
    if (!win) { toast.error("Popup bloqué — autorisez les popups pour imprimer."); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  // AUDIT-RECU-PDF-PARTAGE — un ticket de vente comptoir n'a jamais de lien
  // patient réel (client est un champ texte libre, "Comptoir" par défaut) :
  // aucun envoi serveur avec pièce jointe n'est structurellement possible ici,
  // contrairement à Finance. Texte wa.me inchangé + PDF téléchargé
  // automatiquement pour jointure manuelle, message explicite dans le toast.
  const shareWhatsApp = async () => {
    if (!venteTicket) return;
    const t = venteTicket;
    const lignes = t.items.map(i => `  • ${i.nom} x${i.quantite} = ${fmtCFA(i.sous_total)}`).join("\n");
    const txt = `🧾 *TICKET DE VENTE — Clinique Canadienne de Souanké*
📅 ${new Date(t.date).toLocaleString("fr-FR")}
🔢 N° ${t.numero}
👤 Client : ${t.client}

${lignes}

💰 *TOTAL : ${fmtCFA(t.total)}*
💳 Paiement : ${modeLabel[t.mode_paiement] || t.mode_paiement}

✅ Merci de votre confiance !`;
    try {
      await downloadReceiptPdf(buildTicketReceipt(t), `Ticket-${t.numero}.pdf`);
      toast('📎 PDF téléchargé — joignez-le manuellement dans la conversation WhatsApp.', { icon: '📎' });
    } catch {
      toast.error("Échec de la génération du PDF — le message WhatsApp s'ouvre quand même.");
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  const shareEmail = async () => {
    if (!venteTicket) return;
    const t = venteTicket;
    const lignes = t.items.map(i => `- ${i.nom} x${i.quantite} = ${fmtCFA(i.sous_total)}`).join("\n");
    const subject = `Ticket de vente N° ${t.numero} — Clinique Canadienne de Souanké`;
    const body = `Clinique Canadienne de Souanké\nSouanké, Congo-Brazzaville\n\nTICKET DE VENTE\nN° ${t.numero}\nDate : ${new Date(t.date).toLocaleString("fr-FR")}\nClient : ${t.client}\nPaiement : ${modeLabel[t.mode_paiement] || t.mode_paiement}\n\nDétail :\n${lignes}\n\nTOTAL : ${fmtCFA(t.total)}\n\nMerci de votre confiance !`;
    try {
      await downloadReceiptPdf(buildTicketReceipt(t), `Ticket-${t.numero}.pdf`);
      toast('📎 PDF téléchargé — aucun email de patient rattaché à ce ticket, joignez-le manuellement.', { icon: '📎' });
    } catch {
      toast.error('Échec de la génération du PDF.');
    }
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // AUDIT-GLOBAL — "Transmettre la commande" (réappro. suggéré) affichait un
  // faux succès (toast seul, aucune écriture). Construit de vrais bons de
  // commande réels via le même endpoint que createCommande ci-dessous
  // (POST /pharmacy/commandes), un par fournisseur puisque le modèle attend
  // un fournisseur unique par commande.
  const transmettreCommandeIA = async () => {
    const suggestions = alertsMeds.filter(m => stockSt(m.stock_quantite, m.stock_minimum) !== "ok");
    if (suggestions.length === 0) return;
    const parFournisseur = {};
    for (const m of suggestions) {
      const qte = Number(qteCmdIA[m._id]) || m.stock_minimum * 3;
      const four = m.fournisseur || "Fournisseur non spécifié";
      (parFournisseur[four] ||= []).push({ nom: m.nom_commercial, forme: m.forme, dosage: m.dosage, quantite: qte, prix_unitaire: m.prix_achat, medicament: m._id });
    }
    setSendingCmdIA(true);
    let ok = 0, fail = 0;
    for (const [fournisseur, lignes] of Object.entries(parFournisseur)) {
      try {
        await api.post("/pharmacy/commandes", { fournisseur, notes: "Généré depuis le réapprovisionnement suggéré", lignes });
        ok++;
      } catch { fail++; }
    }
    setSendingCmdIA(false);
    setQteCmdIA({});
    setModalIACmd(false);
    if (fail === 0) toast.success(`📦 ${ok} bon(s) de commande créé(s)`);
    else toast.error(`${ok} bon(s) créé(s), ${fail} échec(s)`);
    loadCommandes();
  };

  // ── Commande ───────────────────────────────────────────────
  const createCommande = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/pharmacy/commandes", formCmd);
      toast.success(`📦 Bon de commande ${data.commande.numero} créé`);
      setCmds(prev => [data.commande, ...prev]);
      setModalCmd(false);
      setFormCmd(EMPTY_CMD);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Erreur lors de la création du bon de commande");
    } finally { setSaving(false); }
  };

  const openReception = (c) => {
    setCurrentCmd(c);
    setFormReception(c.lignes.map(l => ({
      nom: l.nom, restant: l.quantite - (l.quantite_recue || 0), quantite_recue: l.quantite - (l.quantite_recue || 0),
    })));
    setModalReception(true);
  };

  const submitReception = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const receptions = formReception
        .map((l, index) => ({ index, quantite_recue: Number(l.quantite_recue) || 0 }))
        .filter(r => r.quantite_recue > 0);
      const { data } = await api.put(`/pharmacy/commandes/${currentCmd._id}/reception`, { receptions });
      toast.success(data.commande.statut === "recu" ? "✅ Commande entièrement reçue — stock mis à jour" : "📥 Réception partielle enregistrée — stock mis à jour");
      setCmds(prev => prev.map(c => c._id === data.commande._id ? { ...data.commande, date: data.commande.createdAt, nb_lignes: data.commande.lignes.length } : c));
      setModalReception(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Erreur lors de la réception");
    } finally { setSaving(false); }
  };

  // ── Helpers ────────────────────────────────────────────────
  const meds = medicaments.length > 0 ? medicaments : DEMO_MEDS;
  const alertsMeds = meds.filter(m => {
    const s = stockSt(m.stock_quantite, m.stock_minimum);
    const p = perempSt(m.date_expiration);
    return s !== "ok" || p !== "ok";
  });
  const nbAlertes = alertsMeds.length;

  const panierTotal = panier.reduce((s,it)=>s+(it.med?it.med.prix_vente*it.quantite:0),0);

  // ─── Filtered meds ─────────────────────────────────────────
  const filteredMeds = meds.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.nom_commercial.toLowerCase().includes(q) || (m.dci||"").toLowerCase().includes(q) || (m.code||"").toLowerCase().includes(q);
    const matchCat = !filterCat || m.categorie === filterCat;
    const matchSt = !filterSt || stockSt(m.stock_quantite,m.stock_minimum) === filterSt || (filterSt==="expire"&&perempSt(m.date_expiration)==="perime");
    return matchSearch && matchCat && matchSt;
  });

  // ─── Export inventaire PDF ──────────────────────────────────
  const exportInventairePDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const dateStr = new Date().toLocaleDateString('fr-FR');
    const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    // ── Bandeau header bleu
    doc.setFillColor(27, 79, 158);
    doc.rect(0, 0, W, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text(`RAPPORT D'INVENTAIRE — PHARMACIE`, W / 2, 10, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${CLINIC_NAME} ${CLINIC_SUBTITLE} · Gestion des stocks`, W / 2, 17, { align: 'center' });

    // ── Sous-titre & infos
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    doc.text(`Généré le ${dateStr} à ${timeStr}`, 14, 30);
    doc.text(`Total : ${meds.length} référence(s)  ·  Ruptures : ${kpis.ruptures}  ·  Stock bas : ${kpis.bas}  ·  Périmés : ${kpis.expires}`, 14, 36);
    doc.text(`Valeur estimée du stock : ${fmtCFA(kpis.valeur_stock)}`, 14, 42);

    // ── Tableau
    const rows = meds.map(m => {
      const st = stockSt(m.stock_quantite, m.stock_minimum);
      const ps = perempSt(m.date_expiration);
      return [
        m.code || '—',
        (m.nom_commercial || '—') + (m.dosage ? `\n${m.dosage}` : ''),
        m.dci || '—',
        m.categorie || '—',
        m.forme || '—',
        m.lot || '—',
        String(m.stock_quantite ?? 0),
        String(m.stock_minimum ?? 0),
        stockLbl(st),
        fmtDate(m.date_expiration),
        ps === 'ok' ? 'OK' : perempLbl(ps),
      ];
    });

    autoTable(doc, {
      startY: 48,
      head: [['Code', 'Médicament', 'DCI', 'Catégorie', 'Forme', 'N° Lot', 'Stock\nactuel', 'Stock\nmin.', 'Statut\nstock', 'Expiration', 'État\nexpir.']],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: [27, 79, 158],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        cellPadding: 3,
      },
      bodyStyles: { fontSize: 8, textColor: [30, 30, 30], cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      columnStyles: {
        0:  { cellWidth: 18, halign: 'center', font: 'courier' },
        1:  { cellWidth: 50 },
        2:  { cellWidth: 30 },
        3:  { cellWidth: 28 },
        4:  { cellWidth: 20 },
        5:  { cellWidth: 22, halign: 'center', font: 'courier' },
        6:  { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
        7:  { cellWidth: 16, halign: 'center' },
        8:  { cellWidth: 22, halign: 'center' },
        9:  { cellWidth: 22, halign: 'center' },
        10: { cellWidth: 22, halign: 'center' },
      },
      willDrawCell: (data) => {
        if (data.section !== 'body') return;
        const m = meds[data.row.index];
        if (!m) return;
        const st = stockSt(m.stock_quantite, m.stock_minimum);
        const ps = perempSt(m.date_expiration);
        if (ps === 'perime') {
          data.cell.styles.fillColor = [254, 226, 226];
        } else if (st === 'rupture') {
          data.cell.styles.fillColor = [254, 226, 226];
        } else if (st === 'critique') {
          data.cell.styles.fillColor = [255, 237, 213];
        } else if (st === 'bas') {
          data.cell.styles.fillColor = [254, 252, 232];
        }
      },
      margin: { left: 14, right: 14 },
    });

    // ── Pied de page par page
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const H = doc.internal.pageSize.getHeight();
      doc.setFillColor(248, 250, 255);
      doc.rect(0, H - 10, W, 10, 'F');
      doc.setFontSize(7.5);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} / ${pageCount}`, W / 2, H - 4, { align: 'center' });
      doc.text('Document confidentiel — Usage interne uniquement', 14, H - 4);
      doc.text(dateStr, W - 14, H - 4, { align: 'right' });
    }

    const filename = `inventaire-pharmacie-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    toast.success(`📄 PDF exporté : ${filename}`);
  };

  // ─── Helper header/footer PDF ───────────────────────────────
  const pdfHeader = (doc, titre, sousTitre) => {
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(27, 79, 158);
    doc.rect(0, 0, W, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(titre, W / 2, 10, { align: 'center' });
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(sousTitre || `${CLINIC_NAME} ${CLINIC_SUBTITLE} · Pharmacie`, W / 2, 17, { align: 'center' });
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(8.5);
    doc.text(
      `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}`,
      14, 30
    );
    return 35;
  };

  const pdfFooter = (doc) => {
    const W = doc.internal.pageSize.getWidth();
    const n = doc.internal.getNumberOfPages();
    const dateStr = new Date().toLocaleDateString('fr-FR');
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      const H = doc.internal.pageSize.getHeight();
      doc.setFillColor(248, 250, 255);
      doc.rect(0, H - 10, W, 10, 'F');
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text('Document confidentiel — Usage interne', 14, H - 3.5);
      doc.text(`Page ${i} / ${n}`, W / 2, H - 3.5, { align: 'center' });
      doc.text(dateStr, W - 14, H - 3.5, { align: 'right' });
    }
  };

  // ─── Exports rapports ───────────────────────────────────────
  const exportRapportPDF = (type) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const today = new Date().toISOString().split('T')[0];
    let startY, rows, head, filename;

    if (type === 'stock') {
      // ── Rapport stock actuel ──────────────────────────────
      startY = pdfHeader(doc, 'RAPPORT — STOCK ACTUEL', `${meds.length} médicament(s) · Valeur : ${fmtCFA(kpis.valeur_stock)}`);
      head = [['Code','Médicament','DCI','Catégorie','Forme','Stock\nactuel','Stock\nmin.','Statut','Prix vente','Valeur stock']];
      rows = meds.map(m => {
        const st = stockSt(m.stock_quantite, m.stock_minimum);
        return [
          m.code || '—', m.nom_commercial, m.dci || '—', m.categorie || '—', m.forme || '—',
          String(m.stock_quantite ?? 0), String(m.stock_minimum ?? 0),
          stockLbl(st), fmtCFA(m.prix_vente), fmtCFA((m.stock_quantite ?? 0) * (m.prix_vente ?? 0)),
        ];
      });
      autoTable(doc, {
        startY, head, body: rows, theme: 'grid',
        headStyles: { fillColor:[27,79,158], textColor:255, fontStyle:'bold', fontSize:8, halign:'center' },
        bodyStyles: { fontSize:7.5, textColor:[30,30,30] },
        alternateRowStyles: { fillColor:[245,248,255] },
        columnStyles: { 0:{cellWidth:18,halign:'center'}, 5:{cellWidth:16,halign:'center'}, 6:{cellWidth:16,halign:'center'}, 7:{cellWidth:22,halign:'center'}, 8:{cellWidth:24,halign:'right'}, 9:{cellWidth:28,halign:'right'} },
        willDrawCell: (d) => {
          if (d.section !== 'body') return;
          const m = meds[d.row.index];
          if (!m) return;
          const st = stockSt(m.stock_quantite, m.stock_minimum);
          if (st === 'rupture') d.cell.styles.fillColor = [254,226,226];
          else if (st === 'critique') d.cell.styles.fillColor = [255,237,213];
          else if (st === 'bas') d.cell.styles.fillColor = [254,252,232];
        },
        margin: { left:14, right:14 },
      });
      filename = `rapport-stock-${today}.pdf`;

    } else if (type === 'expires') {
      // ── Produits expirés ──────────────────────────────────
      const expired = meds.filter(m => perempSt(m.date_expiration) === 'perime');
      startY = pdfHeader(doc, 'RAPPORT — PRODUITS EXPIRÉS', `${expired.length} lot(s) périmé(s) à retirer`);
      head = [['Code','Médicament','DCI','N° Lot','Emplacement','Stock','Date expiration','Valeur perdue']];
      rows = expired.map(m => [
        m.code || '—', m.nom_commercial, m.dci || '—', m.lot || '—', m.emplacement || '—',
        String(m.stock_quantite ?? 0), fmtDate(m.date_expiration),
        fmtCFA((m.stock_quantite ?? 0) * (m.prix_vente ?? 0)),
      ]);
      autoTable(doc, {
        startY, head, body: rows, theme: 'grid',
        headStyles: { fillColor:[185,28,28], textColor:255, fontStyle:'bold', fontSize:9, halign:'center' },
        bodyStyles: { fontSize:8, textColor:[30,30,30], fillColor:[254,242,242] },
        alternateRowStyles: { fillColor:[254,226,226] },
        margin: { left:14, right:14 },
      });
      if (rows.length === 0) {
        doc.setFontSize(11); doc.setTextColor(34,197,94);
        doc.text('✓ Aucun produit périmé en stock.', 14, startY + 10);
      }
      filename = `rapport-expires-${today}.pdf`;

    } else if (type === 'peremption') {
      // ── Proches expiration ────────────────────────────────
      const soon = meds.filter(m => ['imminent','proche'].includes(perempSt(m.date_expiration)));
      startY = pdfHeader(doc, 'RAPPORT — PROCHES EXPIRATION (< 90 j)', `${soon.length} produit(s) à surveiller`);
      head = [['Code','Médicament','DCI','N° Lot','Stock','Date expiration','Jours restants','Alerte']];
      rows = soon.map(m => {
        const days = Math.ceil((new Date(m.date_expiration) - Date.now()) / 86400000);
        const ps = perempSt(m.date_expiration);
        return [
          m.code || '—', m.nom_commercial, m.dci || '—', m.lot || '—',
          String(m.stock_quantite ?? 0), fmtDate(m.date_expiration),
          `${days} j`, ps === 'imminent' ? '< 30 jours !' : '< 90 jours',
        ];
      });
      autoTable(doc, {
        startY, head, body: rows, theme: 'grid',
        headStyles: { fillColor:[217,119,6], textColor:255, fontStyle:'bold', fontSize:9, halign:'center' },
        bodyStyles: { fontSize:8, textColor:[30,30,30] },
        willDrawCell: (d) => {
          if (d.section !== 'body') return;
          const m = soon[d.row.index];
          if (!m) return;
          if (perempSt(m.date_expiration) === 'imminent') d.cell.styles.fillColor = [255,237,213];
          else d.cell.styles.fillColor = [254,252,232];
        },
        margin: { left:14, right:14 },
      });
      filename = `rapport-peremption-${today}.pdf`;

    } else if (type === 'consommation') {
      // ── Consommation mensuelle ────────────────────────────
      startY = pdfHeader(doc, 'RAPPORT — CONSOMMATION MENSUELLE', `${mvts.length} mouvement(s) enregistré(s)`);
      head = [['Date','Médicament','Type mouvement','Quantité','Référence']];
      rows = mvts.map(mv => {
        const mc = MVT_CFG[mv.type] || { label: mv.type, sign: '' };
        return [
          fmtDate(mv.date || mv.created_at),
          mv.medicament_nom || '—',
          `${mc.sign}  ${mc.label}`,
          `${mc.sign}${mv.quantite}`,
          mv.reference || '—',
        ];
      });
      autoTable(doc, {
        startY, head, body: rows, theme: 'grid',
        headStyles: { fillColor:[6,148,162], textColor:255, fontStyle:'bold', fontSize:9, halign:'center' },
        bodyStyles: { fontSize:8, textColor:[30,30,30] },
        alternateRowStyles: { fillColor:[240,253,252] },
        margin: { left:14, right:14 },
      });
      filename = `rapport-consommation-${today}.pdf`;

    } else if (type === 'ventes') {
      // ── Ventes / dispensations ────────────────────────────
      const ventes = mvts.filter(mv => ['sortie','dispensation'].includes(mv.type));
      startY = pdfHeader(doc, 'RAPPORT — VENTES & DISPENSATIONS', `${ventes.length} opération(s)`);
      head = [['Date','Médicament','Type','Quantité','Référence','Patient']];
      rows = ventes.map(mv => [
        fmtDate(mv.date || mv.created_at),
        mv.medicament_nom || '—',
        mv.type === 'dispensation' ? 'Dispensation' : 'Vente',
        String(mv.quantite),
        mv.reference || '—',
        mv.patient || '—',
      ]);
      autoTable(doc, {
        startY, head, body: rows, theme: 'grid',
        headStyles: { fillColor:[4,120,87], textColor:255, fontStyle:'bold', fontSize:9, halign:'center' },
        bodyStyles: { fontSize:8, textColor:[30,30,30] },
        alternateRowStyles: { fillColor:[236,253,245] },
        margin: { left:14, right:14 },
      });
      filename = `rapport-ventes-${today}.pdf`;

    } else if (type === 'approvisionnements') {
      // ── Approvisionnements ────────────────────────────────
      startY = pdfHeader(doc, 'RAPPORT — APPROVISIONNEMENTS', `${commandes.length} commande(s)`);
      head = [['N° Commande','Fournisseur','Date','Statut','Nb lignes','Montant total']];
      rows = commandes.length > 0 ? commandes.map(c => [
        c.numero || '—', c.fournisseur || '—', fmtDate(c.date || c.date_creation),
        c.statut || '—', String(c.nb_lignes || c.lignes?.length || '—'), fmtCFA(c.montant_total),
      ]) : [['—','Aucune commande enregistrée','—','—','—','—']];
      autoTable(doc, {
        startY, head, body: rows, theme: 'grid',
        headStyles: { fillColor:[67,56,202], textColor:255, fontStyle:'bold', fontSize:9, halign:'center' },
        bodyStyles: { fontSize:8, textColor:[30,30,30] },
        alternateRowStyles: { fillColor:[245,243,255] },
        margin: { left:14, right:14 },
      });
      filename = `rapport-approvisionnements-${today}.pdf`;

    } else if (type === 'top-ventes') {
      // ── Top médicaments vendus ────────────────────────────
      const comptage = {};
      mvts.forEach(mv => {
        if (['sortie','dispensation'].includes(mv.type)) {
          const k = mv.medicament_nom || 'Inconnu';
          comptage[k] = (comptage[k] || 0) + (mv.quantite || 1);
        }
      });
      const classement = Object.entries(comptage).sort((a,b)=>b[1]-a[1]);
      startY = pdfHeader(doc, 'RAPPORT — MÉDICAMENTS LES PLUS VENDUS', `Classement basé sur ${mvts.length} mouvements`);
      head = [['Rang','Médicament','Quantité dispensée','% du total']];
      const totalQty = classement.reduce((s,[,q])=>s+q,0)||1;
      rows = classement.map(([nom,qty],i) => [
        String(i+1), nom, String(qty), `${Math.round(qty/totalQty*100)} %`,
      ]);
      if (rows.length === 0) rows = [['—','Aucune donnée disponible','—','—']];
      autoTable(doc, {
        startY, head, body: rows, theme: 'grid',
        headStyles: { fillColor:[124,58,237], textColor:255, fontStyle:'bold', fontSize:9, halign:'center' },
        bodyStyles: { fontSize:9, textColor:[30,30,30] },
        alternateRowStyles: { fillColor:[250,245,255] },
        columnStyles: { 0:{cellWidth:16,halign:'center'}, 2:{cellWidth:40,halign:'center'}, 3:{cellWidth:30,halign:'center'} },
        willDrawCell: (d) => {
          if (d.section === 'body' && d.row.index < 3) {
            d.cell.styles.fontStyle = 'bold';
            if (d.row.index === 0) d.cell.styles.fillColor = [254,249,195];
          }
        },
        margin: { left:14, right:14 },
      });
      filename = `rapport-top-ventes-${today}.pdf`;

    } else if (type === 'audit') {
      // ── Audit pharmacie ───────────────────────────────────
      startY = pdfHeader(doc, 'RAPPORT — AUDIT PHARMACIE', `Journal de traçabilité · ${mvts.length} opération(s)`);
      head = [['Date','Médicament','Type opération','Quantité','Stock avant','Stock après','Référence','Pharmacien']];
      rows = mvts.map(mv => {
        const mc = MVT_CFG[mv.type] || { label: mv.type, sign: '' };
        return [
          fmtDate(mv.date || mv.created_at),
          mv.medicament_nom || '—',
          mc.label,
          `${mc.sign}${mv.quantite}`,
          mv.stock_avant != null ? String(mv.stock_avant) : '—',
          mv.stock_apres != null ? String(mv.stock_apres) : '—',
          mv.reference || '—',
          mv.pharmacien || '—',
        ];
      });
      autoTable(doc, {
        startY, head, body: rows, theme: 'grid',
        headStyles: { fillColor:[15,23,42], textColor:255, fontStyle:'bold', fontSize:8, halign:'center' },
        bodyStyles: { fontSize:7.5, textColor:[30,30,30] },
        alternateRowStyles: { fillColor:[248,250,252] },
        margin: { left:14, right:14 },
      });
      filename = `rapport-audit-${today}.pdf`;

    } else {
      // ── Rapport global (bouton PDF du header) ─────────────
      exportInventairePDF();
      return;
    }

    pdfFooter(doc);
    doc.save(filename);
    toast.success(`📄 ${filename}`);
  };

  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      {/* Input caché pour upload photo depuis la grille */}
      <input ref={gridPhotoRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display:'none' }} onChange={handleGridPhotoChange} />
      <div className="ph">

        {/* ── HERO ── */}
        <Hero
          icon={Pill}
          title="Module Pharmacie"
          dateLabel={`${kpis.total} médicament(s) · ${kpis.ruptures} rupture(s) · Stock : ${fmtCFA(kpis.valeur_stock)}`}
          right={
            <>
              <button className="hero-btn-ghost" onClick={() => setModalVente(true)}>
                <ShoppingCart size={14} /> Vente
              </button>
              <button className="hero-btn-ghost" onClick={() => { setFormMvt(EMPTY_MVT); setModalMvt(true); }}>
                <Zap size={14} /> Mouvement
              </button>
              <Button icon={Plus} onClick={() => { setFormMed(EMPTY_MED); setModalAdd(true); }}>Nouveau médicament</Button>
            </>
          }
        />

        {/* Tabs — grille 3×3 sur mobile, ligne scrollable sur desktop */}
        {(() => {
            const TABS = [
              { key:"dashboard",  icon:I.chart,  label:"Tableau de bord",              labelM:"Dashboard" },
              { key:"catalogue",  icon:I.pill,   label:"Catalogue",                    labelM:"Catalogue" },
              { key:"stock",      icon:I.box,    label:"Stock & Lots",                 labelM:"Stock" },
              { key:"alertes",    icon:I.alert,  label:"Alertes",                      labelM:"Alertes",  badge:nbAlertes },
              { key:"ventes",     icon:I.cart,   label:"Ventes",                       labelM:"Ventes" },
              { key:"commandes",  icon:I.truck,  label:"Commandes & Fournisseurs",     labelM:"Commandes" },
              { key:"inventaire", icon:I.inv,    label:"Inventaire",                   labelM:"Inventaire" },
              { key:"rapports",   icon:I.trend,  label:"Rapports",                     labelM:"Rapports" },
              { key:"audit",      icon:I.log,    label:"Audit",                        labelM:"Audit" },
            ];
            return (
              <div className="tab-bar" style={isMobile ? {
                display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:4,
              } : {}}>
                {TABS.map(t => (
                  <button
                    key={t.key}
                    className={`tab-bar-item ${tab===t.key?"active":""}`}
                    style={isMobile ? {
                      flexDirection:'column', textAlign:'center', padding:'7px 3px 8px',
                      fontSize:'9.5px', gap:'3px', whiteSpace:'normal', minWidth:0,
                    } : {}}
                    onClick={() => setTab(t.key)}
                  >
                    <span style={isMobile ? { fontSize:'14px' } : {}}>{t.icon}</span>
                    <span style={isMobile ? { lineHeight:1.2 } : {}}>{isMobile ? t.labelM : t.label}</span>
                    {(t.badge ?? 0) > 0 && <span className="tab-bar-item-count">{t.badge}</span>}
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
              {(kpis.ruptures > 0 || kpis.expires > 0) && (
                <div className="al-danger fu" style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
                  <div style={{ width:42, height:42, background:"#FEE2E2", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{I.alert}</div>
                  <div style={{ flex:1 }}>
                    <strong style={{ color:"#B91C1C", fontSize:13 }}>🚨 Alerte critique pharmacie</strong>
                    <div style={{ fontSize:12, color:"#DC2626", marginTop:3 }}>
                      {kpis.ruptures>0 && <span><strong>{kpis.ruptures}</strong> médicament(s) en rupture de stock. </span>}
                      {kpis.expires>0 && <span><strong>{kpis.expires}</strong> lot(s) périmé(s) à retirer immédiatement.</span>}
                    </div>
                  </div>
                  <button className="pbtn pbtn-danger pbtn-sm" onClick={() => setTab("alertes")}>Voir alertes →</button>
                </div>
              )}

              {/* KPIs */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="blue"   icon={I.pill}   value={kpis.total}      label="Références"       sub="catalogue actif"             onClick={() => setTab("catalogue")} />
                <KpiCard color="red"    icon={I.alert}  value={kpis.ruptures}   label="Ruptures"         sub="stock = 0"                   urgent={kpis.ruptures>0} onClick={() => { setFilterSt("rupture"); setTab("alertes"); }} />
                <KpiCard color="orange" icon={I.alert}  value={kpis.critiques}  label="Stocks critiques" sub="< 30% du seuil"              urgent={kpis.critiques>0} onClick={() => { setFilterSt("critique"); setTab("alertes"); }} />
                <KpiCard color="yellow" icon={I.alert}  value={kpis.bas}        label="Stocks bas"       sub="sous le seuil"               onClick={() => { setFilterSt("bas"); setTab("alertes"); }} />
                <KpiCard color="purple" icon="⏰"        value={kpis.expires+kpis.imminents} label="Péremptions" sub="périmés + < 30j" urgent={kpis.expires>0} onClick={() => setTab("alertes")} />
                <KpiCard color="green"  icon="💰"        value={fmtCFA(kpis.valeur_stock).replace(" CFA","").replace(" CFA","")} label="Valeur stock"    sub="inventaire estimé" />
              </div>

              {/* Ventes KPIs */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14, marginBottom:24 }}>
                <div style={{ background:"linear-gradient(135deg,var(--pg),#047857)", borderRadius:18, padding:"18px 22px", color:"#fff" }}>
                  <div style={{ fontSize:11, fontWeight:600, opacity:.7, textTransform:"uppercase", letterSpacing:.5, marginBottom:6 }}>Ventes aujourd'hui</div>
                  <div style={{ fontSize:26, fontWeight:800, letterSpacing:-1 }}>{fmtCFA(kpis.ventes_jour)}</div>
                  <div style={{ fontSize:11, opacity:.7, marginTop:4 }}>↑ 12% vs hier</div>
                </div>
                <div style={{ background:"linear-gradient(135deg,var(--pb),#1e40af)", borderRadius:18, padding:"18px 22px", color:"#fff" }}>
                  <div style={{ fontSize:11, fontWeight:600, opacity:.7, textTransform:"uppercase", letterSpacing:.5, marginBottom:6 }}>Ventes ce mois</div>
                  <div style={{ fontSize:26, fontWeight:800, letterSpacing:-1 }}>{fmtCFA(kpis.ventes_mois)}</div>
                  <div style={{ fontSize:11, opacity:.7, marginTop:4 }}>↑ 8% vs mois dernier</div>
                </div>
              </div>

              {/* Charts + alertes */}
              <div className="ph-g2" style={{ marginBottom:20 }}>
                <div className="ph-card">
                  <div className="ph-card-hdr">
                    <div><h3>{I.trend} Mouvements de stock — 30 jours</h3><p>Entrées vs sorties vs dispensations</p></div>
                  </div>
                  <div style={{ padding:20 }}>
                    <BarChartCanvas
                      labels={["S.1","S.2","S.3","S.4","Auj."]}
                      data={[142,188,156,204,98]}
                      color="#0EA5A0"
                      height={180}
                    />
                  </div>
                </div>
                <div className="ph-card">
                  <div className="ph-card-hdr"><div><h3>Santé des stocks</h3><p>{kpis.total} références</p></div></div>
                  <div style={{ padding:20 }}>
                    <div style={{ marginBottom:16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
                        <span style={{ color:"var(--pm)" }}>Taux de disponibilité</span>
                        <strong style={{ color: kpis.ruptures===0?"var(--pg)":"var(--pr)" }}>
                          {kpis.total>0?Math.round((meds.filter(m=>stockSt(m.stock_quantite,m.stock_minimum)==="ok").length/kpis.total)*100):100}%
                        </strong>
                      </div>
                      <div className="health-bar">
                        {[
                          [meds.filter(m=>stockSt(m.stock_quantite,m.stock_minimum)==="ok").length,"#059669"],
                          [kpis.bas,"#EAB308"],
                          [kpis.critiques,"#D97706"],
                          [kpis.ruptures,"#DC2626"],
                        ].filter(([v])=>v>0).map(([v,col],i)=>(
                          <div key={i} className="health-seg" style={{ width:`${kpis.total>0?Math.round(v/kpis.total*100):0}%`, background:col }} />
                        ))}
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:8 }}>
                        {[["OK","#059669"],["Bas","#EAB308"],["Critique","#D97706"],["Rupture","#DC2626"]].map(([l,c])=>(
                          <span key={l} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"var(--pm)" }}>
                            <span style={{ width:8, height:8, borderRadius:3, background:c, display:"inline-block" }} />{l}
                          </span>
                        ))}
                      </div>
                    </div>
                    {[["Antibiotiques",38],["Analgésiques",28],["Antipaludéens",18],["Antidiabétiques",16]].map(([cat,pct])=>(
                      <div key={cat} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                          <span style={{ color:"var(--pm)" }}>{cat}</span>
                          <span style={{ fontWeight:700, color:"var(--pn)" }}>{pct}%</span>
                        </div>
                        <Prog pct={pct} color="var(--pb)" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Médicaments urgents */}
              {alertsMeds.length > 0 && (
                <div className="ph-card">
                  <div className="ph-card-hdr">
                    <div><h3>{I.alert} Médicaments nécessitant une action</h3><p>{alertsMeds.length} médicament(s)</p></div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => setModalIACmd(true)}>{I.ia} Commande IA</button>
                      <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => setTab("alertes")}>Voir tous →</button>
                    </div>
                  </div>
                  <div className="ph-tbl-wrap">
                    <table className="ph-tbl" style={{ minWidth:700 }}>
                      <thead><tr><th>Médicament</th><th>Stock</th><th>Niveau</th><th>Expiration</th><th>Fournisseur</th><th>Action</th></tr></thead>
                      <tbody>
                        {alertsMeds.slice(0,6).map(m => {
                          const st = stockSt(m.stock_quantite, m.stock_minimum);
                          const ps = perempSt(m.date_expiration);
                          const pct = m.stock_minimum > 0 ? Math.min(100,Math.round(m.stock_quantite/m.stock_minimum*100)) : 100;
                          return (
                            <tr key={m._id} style={{ background:st==="rupture"?"#FEF2F2":"" }}>
                              <td>
                                <div style={{ fontWeight:600, color:"var(--pn)" }}>{m.nom_commercial}</div>
                                <div style={{ fontSize:11, color:"var(--pm)" }}>{m.dci} · {m.forme}</div>
                              </td>
                              <td>
                                <div style={{ fontWeight:800, fontSize:16, color:stockColor(st) }}>{m.stock_quantite}</div>
                                <div style={{ fontSize:10, color:"var(--pm)" }}>seuil : {m.stock_minimum}</div>
                              </td>
                              <td>
                                <div style={{ width:80 }}><Prog pct={pct} color={stockColor(st)} /></div>
                                <Badge cls={stockBdg(st)}>{stockLbl(st)}</Badge>
                              </td>
                              <td style={{ color:perempColor(ps), fontWeight:ps!=="ok"?700:400, fontSize:12 }}>
                                {fmtDate(m.date_expiration)}
                                {ps!=="ok"&&<div style={{ fontSize:10 }}>{perempLbl(ps)}</div>}
                              </td>
                              <td style={{ fontSize:12, color:"var(--pm)" }}>{m.fournisseur||"—"}</td>
                              <td>
                                <button className="pbtn pbtn-primary pbtn-sm" style={{ fontSize:11 }} onClick={() => { setFormMvt({...EMPTY_MVT,medicament_id:m._id,type:"entree"}); setModalMvt(true); }}>📥 Réappro</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Derniers mouvements */}
              <div className="ph-card">
                <div className="ph-card-hdr">
                  <div><h3>⚡ Derniers mouvements</h3><p>Activité récente du stock</p></div>
                  <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => setTab("audit")}>Voir journal →</button>
                </div>
                <div className="ph-tbl-wrap">
                  <table className="ph-tbl" style={{ minWidth:640 }}>
                    <thead><tr><th>Date</th><th>Médicament</th><th>Type</th><th>Qté</th><th>Avant → Après</th><th>Référence</th><th>Pharmacien</th></tr></thead>
                    <tbody>
                      {(mvts.length>0?mvts:DEMO_MVTS).slice(0,6).map(mv => {
                        const mc = MVT_CFG[mv.type]||{icon:"·",label:mv.type,cls:"gray",sign:""};
                        return (
                          <tr key={mv._id}>
                            <td style={{ fontSize:11, color:"var(--pm)" }}>{fmtDate(mv.date||mv.created_at)}</td>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--pn)", fontSize:13 }}>{mv.medicament_nom}</div>
                              {mv.patient && <div style={{ fontSize:11, color:"var(--pm)" }}>👤 {mv.patient}</div>}
                            </td>
                            <td><Badge cls={mc.cls}>{mc.icon} {mc.label}</Badge></td>
                            <td style={{ fontWeight:800, color: ["entree","retour"].includes(mv.type)?"var(--pg)":"var(--pr)", fontSize:14 }}>{mc.sign}{mv.quantite}</td>
                            <td style={{ fontSize:12, color:"var(--pm)" }}>{mv.stock_avant}<span style={{ margin:"0 4px", color:"var(--pbr)" }}>→</span><strong style={{ color:mv.stock_apres===0?"var(--pr)":"var(--pn)" }}>{mv.stock_apres}</strong></td>
                            <td style={{ fontSize:11, fontFamily:"monospace", color:"var(--pb)" }}>{mv.reference||"—"}</td>
                            <td style={{ fontSize:11, color:"var(--pm)" }}>{mv.pharmacien||"—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ CATALOGUE ══ */}
          {tab === "catalogue" && (
            <div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--pn)" }}>Catalogue des médicaments</div>
                  <div style={{ fontSize:12, color:"var(--pm)", marginTop:2 }}>{filteredMeds.length} référence(s)</div>
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }}>{I.search}</span>
                    <input className="pinp" style={{ paddingLeft:34, width:220, fontSize:12 }} placeholder="Nom, DCI, code..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                  </div>
                  <select className="pinp" style={{ width:160, fontSize:12 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                    <option value="">Toutes catégories</option>
                    {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="pinp" style={{ width:150, fontSize:12 }} value={filterSt} onChange={e => setFilterSt(e.target.value)}>
                    <option value="">Tous statuts</option>
                    <option value="rupture">Rupture</option>
                    <option value="critique">Critique</option>
                    <option value="bas">Stock bas</option>
                    <option value="ok">OK</option>
                    <option value="expire">Périmé</option>
                  </select>
                  <button className="pbtn pbtn-primary" onClick={() => { setFormMed(EMPTY_MED); setPhotoFile(null); setPhotoPreview(null); setModalAdd(true); }}>{I.plus} Ajouter</button>
                  {/* Toggle vue */}
                  <div style={{ display:'flex', border:'1.5px solid #E2EAF4', borderRadius:8, overflow:'hidden' }}>
                    <button onClick={() => setViewMode('grid')} style={{ padding:'6px 14px', background:viewMode==='grid'?'#1B4F9E':'#fff', color:viewMode==='grid'?'#fff':'#6B7A99', border:'none', cursor:'pointer', fontSize:12, fontWeight:700 }}>⊞ Grille</button>
                    <button onClick={() => setViewMode('table')} style={{ padding:'6px 14px', background:viewMode==='table'?'#1B4F9E':'#fff', color:viewMode==='table'?'#fff':'#6B7A99', border:'none', cursor:'pointer', fontSize:12, fontWeight:700 }}>≡ Tableau</button>
                  </div>
                </div>
              </div>

              {/* ── VUE GRILLE ── */}
              {viewMode === 'grid' && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))', gap:18 }}>
                  {loading ? (
                    <div style={{ gridColumn:'1/-1', padding:60, textAlign:'center', color:'var(--pm)' }}>Chargement...</div>
                  ) : filteredMeds.length === 0 ? (
                    <div style={{ gridColumn:'1/-1', padding:60, textAlign:'center', color:'var(--pm)' }}>{search?`Aucun résultat pour "${search}"`:"Aucun médicament"}</div>
                  ) : filteredMeds.map(m => {
                    const st  = stockSt(m.stock_quantite, m.stock_minimum);
                    const ps  = perempSt(m.date_expiration);
                    const pct = m.stock_minimum>0 ? Math.min(100,Math.round(m.stock_quantite/m.stock_minimum*100)) : 100;
                    return (
                      <div key={m._id} style={{ background:'#fff', borderRadius:18, border:'1.5px solid var(--pbr)', boxShadow:'var(--sh)', overflow:'hidden', display:'flex', flexDirection:'column', transition:'box-shadow .2s' }}
                        onMouseEnter={e=>e.currentTarget.style.boxShadow='var(--shm)'} onMouseLeave={e=>e.currentTarget.style.boxShadow='var(--sh)'}>
                        {/* Photo */}
                        <div className="ph-photo-wrap" style={{ height:190, background: m.photo?'transparent':'linear-gradient(135deg,#EEF4FF 0%,#DBEAFE 100%)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden', flexShrink:0 }}
                          onClick={() => { setGridPhotoMedId(m._id); gridPhotoRef.current?.click(); }}>
                          {m.photo
                            ? <img src={m.photo} alt={m.nom_commercial} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            : <span style={{ fontSize:64, opacity:.6 }}>💊</span>
                          }
                          <div style={{ position:'absolute', top:8, left:8, display:'flex', flexDirection:'column', gap:4 }}>
                            <Badge cls={stockBdg(st)}>{stockLbl(st)}</Badge>
                            {m.ordonnance && <span style={{ fontSize:10, background:'rgba(254,242,242,.95)', color:'var(--pr)', border:'1px solid #FECACA', borderRadius:4, padding:'1px 6px', fontWeight:800 }}>Rx</span>}
                          </div>
                          {ps !== 'ok' && <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(234,179,8,.9)', color:'#fff', fontSize:10, fontWeight:700, textAlign:'center', padding:'3px 0' }}>{perempLbl(ps)} · {fmtDate(m.date_expiration)}</div>}
                          <div className="ph-photo-overlay">
                            <span style={{ fontSize:28 }}>📷</span>
                            <span>{m.photo ? 'Changer la photo' : 'Ajouter une photo'}</span>
                          </div>
                        </div>
                        {/* Infos */}
                        <div style={{ padding:'14px 16px', flex:1, display:'flex', flexDirection:'column', gap:7 }}>
                          <div style={{ fontWeight:800, color:'var(--pn)', fontSize:14, lineHeight:1.25 }}>{m.nom_commercial}</div>
                          {m.dci && <div style={{ fontSize:12, color:'var(--pm)', fontStyle:'italic' }}>{m.dci} {m.dosage && `· ${m.dosage}`}</div>}
                          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                            {m.categorie && <Badge cls="blue">{m.categorie}</Badge>}
                            {m.forme     && <Badge cls="gray">{m.forme}</Badge>}
                          </div>
                          <div style={{ marginTop:4 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                              <span style={{ color:'var(--pm)', fontWeight:600 }}>Stock</span>
                              <span style={{ fontWeight:900, color:stockColor(st), fontSize:16 }}>{m.stock_quantite}<span style={{ fontWeight:400, color:'var(--pm)', fontSize:11 }}>/{m.stock_minimum}</span></span>
                            </div>
                            <Prog pct={pct} color={stockColor(st)} h={8} />
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginTop:2 }}>
                            <span style={{ color:'var(--pm)' }}>Prix vente</span>
                            <span style={{ fontWeight:700, color:'var(--pn)' }}>{fmtCFA(m.prix_vente)}</span>
                          </div>
                        </div>
                        {/* Actions */}
                        <div style={{ padding:'10px 14px', borderTop:'1.5px solid var(--pbr)', display:'flex', gap:6 }}>
                          <button className="pbtn pbtn-ghost pbtn-sm" style={{ flex:1, fontSize:11 }}
                            onClick={() => { setCurrentMed(m); setFormMed({...m}); setPhotoFile(null); setPhotoPreview(null); setModalEdit(true); }}>
                            {I.edit} Modifier
                          </button>
                          <button className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:11 }} title="Mouvement stock"
                            onClick={() => { setFormMvt({...EMPTY_MVT,medicament_id:m._id}); setModalMvt(true); }}>⚡</button>
                          <button className="pbtn pbtn-danger pbtn-sm" style={{ fontSize:11 }} title="Supprimer"
                            onClick={() => deleteMed(m._id)}>{I.trash}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── VUE TABLEAU ── */}
              {viewMode === 'table' && (
              <div className="ph-card">
                <div className="ph-tbl-wrap">
                  <table className="ph-tbl" style={{ minWidth:1000 }}>
                    <thead><tr><th>Photo</th><th>Code</th><th>Médicament</th><th>DCI</th><th>Catégorie</th><th>Forme</th><th>Stock</th><th>Niveau</th><th>Prix vente</th><th>Expiration</th><th>Actions</th></tr></thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={11} style={{ padding:40, textAlign:"center", color:"var(--pm)" }}>Chargement...</td></tr>
                      ) : filteredMeds.map(m => {
                        const st  = stockSt(m.stock_quantite,m.stock_minimum);
                        const ps  = perempSt(m.date_expiration);
                        const pct = m.stock_minimum>0?Math.min(100,Math.round(m.stock_quantite/m.stock_minimum*100)):100;
                        return (
                          <tr key={m._id} style={{ background:st==="rupture"?"#FFF8F8":ps==="perime"?"#FFFBF0":"" }}>
                            <td style={{ padding:'6px 10px' }}>
                              <div style={{ width:64, height:64, borderRadius:10, overflow:'hidden', background:'linear-gradient(135deg,#EEF4FF,#DBEAFE)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                {m.photo
                                  ? <img src={m.photo} alt={m.nom_commercial} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                  : <span style={{ fontSize:28 }}>💊</span>
                                }
                              </div>
                            </td>
                            <td style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:"var(--pb)" }}>{m.code}</td>
                            <td>
                              <div style={{ fontWeight:700, color:"var(--pn)" }}>{m.nom_commercial}</div>
                              <div style={{ fontSize:11, color:"var(--pm)" }}>{m.dosage} · Lot : {m.lot||"—"}</div>
                              {m.ordonnance && <span style={{ fontSize:10, background:"#FEF2F2", color:"var(--pr)", border:"1px solid #FECACA", borderRadius:4, padding:"1px 5px" }}>Rx</span>}
                            </td>
                            <td style={{ fontSize:12, color:"var(--pm)" }}>{m.dci||"—"}</td>
                            <td><Badge cls="blue">{m.categorie||"—"}</Badge></td>
                            <td style={{ fontSize:12, color:"var(--pm)" }}>{m.forme||"—"}</td>
                            <td>
                              <div style={{ fontWeight:800, fontSize:15, color:stockColor(st) }}>{m.stock_quantite}</div>
                              <div style={{ fontSize:10, color:"var(--pm)" }}>/ {m.stock_minimum}</div>
                            </td>
                            <td>
                              <div style={{ width:72 }}><Prog pct={pct} color={stockColor(st)} /></div>
                              <Badge cls={stockBdg(st)}>{stockLbl(st)}</Badge>
                            </td>
                            <td style={{ fontWeight:600, color:"var(--pn)", fontSize:12 }}>{fmtCFA(m.prix_vente)}</td>
                            <td style={{ fontSize:12, color:perempColor(ps), fontWeight:ps!=="ok"?700:400 }}>
                              {fmtDate(m.date_expiration)}
                              {ps!=="ok"&&<div style={{ fontSize:10 }}>{perempLbl(ps)}</div>}
                            </td>
                            <td>
                              <div style={{ display:"flex", gap:4 }}>
                                <button className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:10 }} onClick={() => { setCurrentMed(m); setFormMed({...m}); setPhotoFile(null); setPhotoPreview(null); setModalEdit(true); }}>{I.edit}</button>
                                <button className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:10 }} onClick={() => { setFormMvt({...EMPTY_MVT,medicament_id:m._id}); setModalMvt(true); }}>⚡</button>
                                <button className="pbtn pbtn-danger pbtn-sm" style={{ fontSize:10 }} onClick={() => deleteMed(m._id)}>{I.trash}</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!loading && filteredMeds.length===0 && (
                        <tr><td colSpan={11} style={{ padding:40, textAlign:"center", color:"var(--pm)" }}>
                          {search?`Aucun résultat pour "${search}"`:"Aucun médicament"}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
            </div>
          )}

          {/* ══ STOCK & LOTS ══ */}
          {tab === "stock" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--pn)" }}>Gestion du stock & des lots</div>
                  <div style={{ fontSize:12, color:"var(--pm)" }}>Entrées, sorties, ajustements, traçabilité</div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="pbtn pbtn-teal" onClick={() => { setFormMvt({...EMPTY_MVT,type:"entree"}); setModalMvt(true); }}>📥 Entrée stock</button>
                  <button className="pbtn pbtn-ghost" onClick={() => { setFormMvt({...EMPTY_MVT,type:"sortie"}); setModalMvt(true); }}>📤 Sortie stock</button>
                </div>
              </div>

              {/* Résumé stock */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14, marginBottom:20 }}>
                {[
                  { lbl:"Total références", val:kpis.total, color:"var(--pb)" },
                  { lbl:"Valeur du stock", val:fmtCFA(kpis.valeur_stock).split(" ")[0], color:"var(--pg)" },
                  { lbl:"Produits en mouvement", val:mvts.length, color:"var(--pt)" },
                  { lbl:"Lots actifs", val:meds.filter(m=>m.lot).length, color:"var(--pp)" },
                ].map(({lbl,val,color})=>(
                  <div key={lbl} style={{ background:"#fff", border:"1.5px solid var(--pbr)", borderRadius:14, padding:"14px 18px", boxShadow:"var(--sh)" }}>
                    <div style={{ fontSize:22, fontWeight:800, color, letterSpacing:-1 }}>{val}</div>
                    <div style={{ fontSize:11, color:"var(--pm)", fontWeight:600, marginTop:3 }}>{lbl}</div>
                  </div>
                ))}
              </div>

              <div className="ph-card">
                <div className="ph-card-hdr"><h3>📦 Stock par médicament — vue détaillée</h3></div>
                <div className="ph-tbl-wrap">
                  <table className="ph-tbl" style={{ minWidth:900 }}>
                    <thead><tr><th>Médicament</th><th>Lot</th><th>Stock actuel</th><th>Stock min</th><th>Stock max</th><th>Emplacement</th><th>Expiration</th><th>Niveau</th><th>Valeur</th></tr></thead>
                    <tbody>
                      {meds.map(m => {
                        const st = stockSt(m.stock_quantite,m.stock_minimum);
                        const ps = perempSt(m.date_expiration);
                        const pct = m.stock_minimum>0?Math.min(100,Math.round(m.stock_quantite/m.stock_minimum*100)):100;
                        return (
                          <tr key={m._id} style={{ background:st==="rupture"?"#FFF8F8":"" }}>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--pn)" }}>{m.nom_commercial}</div>
                              <div style={{ fontSize:11, color:"var(--pm)" }}>{m.dci}</div>
                            </td>
                            <td style={{ fontFamily:"monospace", fontSize:12, color:"var(--pb)" }}>{m.lot||"—"}</td>
                            <td style={{ fontWeight:800, fontSize:16, color:stockColor(st) }}>{m.stock_quantite}</td>
                            <td style={{ fontSize:12, color:"var(--pm)" }}>{m.stock_minimum}</td>
                            <td style={{ fontSize:12, color:"var(--pm)" }}>{m.stock_maximum}</td>
                            <td><Badge cls="gray">{m.emplacement||"—"}</Badge></td>
                            <td style={{ fontSize:12, color:perempColor(ps), fontWeight:ps!=="ok"?700:400 }}>{fmtDate(m.date_expiration)}</td>
                            <td>
                              <div style={{ width:80, marginBottom:4 }}><Prog pct={pct} color={stockColor(st)} /></div>
                              <Badge cls={stockBdg(st)}>{pct}% · {stockLbl(st)}</Badge>
                            </td>
                            <td style={{ fontWeight:600, color:"var(--pn)", fontSize:12 }}>{fmtCFA(m.stock_quantite*m.prix_vente)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ ALERTES ══ */}
          {tab === "alertes" && (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="red"    icon={I.alert} value={kpis.ruptures}            label="Ruptures"         urgent={kpis.ruptures>0} />
                <KpiCard color="orange" icon={I.alert} value={kpis.critiques}           label="Critiques" />
                <KpiCard color="yellow" icon={I.alert} value={kpis.bas}                 label="Stocks bas" />
                <KpiCard color="purple" icon="⏰"       value={kpis.expires}             label="Lots périmés"     urgent={kpis.expires>0} />
                <KpiCard color="teal"   icon="⚠️"       value={kpis.imminents}           label="Expiration < 30j" />
              </div>

              {/* IA alerte */}
              <div className="al-ia fu" style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
                <span style={{ fontSize:22, flexShrink:0 }}>🤖</span>
                <div style={{ flex:1 }}>
                  <strong style={{ color:"#1E40AF", fontSize:13 }}>IA — Prédiction de réapprovisionnement</strong>
                  <div style={{ fontSize:12, color:"#3B82F6", marginTop:4 }}>
                    Basé sur la consommation des 30 derniers jours, l'IA recommande de commander : Amoxicilline (qté suggérée : 500u), Paracétamol (qté suggérée : 400u), Sérum physiologique (qté suggérée : 60u).
                  </div>
                </div>
                <button className="pbtn pbtn-primary pbtn-sm" style={{ fontSize:12, flexShrink:0 }} onClick={() => setModalIACmd(true)}>{I.ia} Commande auto</button>
              </div>

              {/* Ruptures */}
              {meds.filter(m=>stockSt(m.stock_quantite,m.stock_minimum)==="rupture").length > 0 && (
                <div className="ph-card" style={{ borderLeft:"4px solid var(--pr)" }}>
                  <div className="ph-card-hdr" style={{ background:"#FEF2F2" }}><h3 style={{ color:"var(--pr)" }}>🔴 Ruptures de stock ({meds.filter(m=>stockSt(m.stock_quantite,m.stock_minimum)==="rupture").length})</h3></div>
                  <div className="ph-tbl-wrap">
                    <table className="ph-tbl" style={{ minWidth:600 }}>
                      <thead><tr><th>Médicament</th><th>Dernier stock</th><th>Fournisseur</th><th>Qté suggérée</th><th>Action</th></tr></thead>
                      <tbody>
                        {meds.filter(m=>stockSt(m.stock_quantite,m.stock_minimum)==="rupture").map(m=>(
                          <tr key={m._id}>
                            <td><div style={{ fontWeight:700 }}>{m.nom_commercial}</div><div style={{ fontSize:11, color:"var(--pm)" }}>{m.dci}</div></td>
                            <td><span style={{ fontWeight:800, color:"var(--pr)", fontSize:16 }}>0</span> / {m.stock_minimum}</td>
                            <td style={{ fontSize:12, color:"var(--pm)" }}>{m.fournisseur||"—"}</td>
                            <td><strong style={{ color:"var(--pb)" }}>{m.stock_minimum*3} unités</strong></td>
                            <td>
                              <div style={{ display:"flex", gap:6 }}>
                                <button className="pbtn pbtn-primary pbtn-sm" style={{ fontSize:11 }} onClick={() => { setFormMvt({...EMPTY_MVT,medicament_id:m._id,type:"entree"}); setModalMvt(true); }}>📥 Réapprovisionner</button>
                                <button className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:11 }} onClick={() => setModalCmd(true)}>📦 Commander</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Expirations */}
              {meds.filter(m=>["perime","imminent"].includes(perempSt(m.date_expiration))).length > 0 && (
                <div className="ph-card" style={{ borderLeft:"4px solid var(--po)" }}>
                  <div className="ph-card-hdr" style={{ background:"#FFFBEB" }}><h3 style={{ color:"var(--po)" }}>⏰ Péremptions urgentes ({meds.filter(m=>["perime","imminent"].includes(perempSt(m.date_expiration))).length})</h3></div>
                  <div className="ph-tbl-wrap">
                    <table className="ph-tbl" style={{ minWidth:600 }}>
                      <thead><tr><th>Médicament</th><th>Lot</th><th>Stock</th><th>Date expiration</th><th>Statut</th><th>Action</th></tr></thead>
                      <tbody>
                        {meds.filter(m=>["perime","imminent"].includes(perempSt(m.date_expiration))).map(m=>{
                          const ps = perempSt(m.date_expiration);
                          const days = Math.ceil((new Date(m.date_expiration)-Date.now())/86400000);
                          return (
                            <tr key={m._id}>
                              <td><div style={{ fontWeight:700 }}>{m.nom_commercial}</div><div style={{ fontSize:11, color:"var(--pm)" }}>{m.dci}</div></td>
                              <td style={{ fontFamily:"monospace", fontSize:12, color:"var(--pb)" }}>{m.lot||"—"}</td>
                              <td style={{ fontWeight:700, color:"var(--pn)" }}>{m.stock_quantite}</td>
                              <td style={{ fontWeight:700, color:ps==="perime"?"var(--pr)":"var(--po)" }}>{fmtDate(m.date_expiration)}</td>
                              <td>
                                <Badge cls={ps==="perime"?"red":"orange"}>{ps==="perime"?"PÉRIMÉ !":`${days}j restants`}</Badge>
                              </td>
                              <td>
                                <button className="pbtn pbtn-danger pbtn-sm" style={{ fontSize:11 }} onClick={() => retirerLotPerime(m)}>🗑 Retirer</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {alertsMeds.length === 0 && (
                <div style={{ textAlign:"center", padding:60 }}>
                  <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
                  <div style={{ fontSize:18, fontWeight:700, color:"var(--pg)" }}>Tous les stocks sont en ordre !</div>
                  <div style={{ color:"var(--pm)", marginTop:8 }}>Aucune rupture, stock critique ou péremption urgente.</div>
                </div>
              )}
            </div>
          )}

          {/* ══ VENTES ══ */}
          {tab === "ventes" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--pn)" }}>Ventes & Dispensations</div>
                  <div style={{ fontSize:12, color:"var(--pm)" }}>Ventes comptoir et dispensation sur ordonnance</div>
                </div>
                <button className="pbtn pbtn-teal" onClick={() => setModalVente(true)}>{I.cart} Nouvelle vente</button>
              </div>

              <div className="ph-g11" style={{ marginBottom:20 }}>
                <div style={{ background:"linear-gradient(135deg,#059669,#047857)", borderRadius:18, padding:"20px 24px", color:"#fff" }}>
                  <div style={{ fontSize:11, fontWeight:600, opacity:.7, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>Ventes aujourd'hui</div>
                  <div style={{ fontSize:28, fontWeight:800, letterSpacing:-1, marginBottom:4 }}>{fmtCFA(kpis.ventes_jour)}</div>
                  <div style={{ fontSize:12, opacity:.7 }}>↑ 12% vs hier · 48 transactions</div>
                </div>
                <div style={{ background:"linear-gradient(135deg,#1B4F9E,#1e40af)", borderRadius:18, padding:"20px 24px", color:"#fff" }}>
                  <div style={{ fontSize:11, fontWeight:600, opacity:.7, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>Ventes ce mois</div>
                  <div style={{ fontSize:28, fontWeight:800, letterSpacing:-1, marginBottom:4 }}>{fmtCFA(kpis.ventes_mois)}</div>
                  <div style={{ fontSize:12, opacity:.7 }}>↑ 8% vs mois dernier · 1 240 transactions</div>
                </div>
              </div>

              <div className="ph-g2">
                <div className="ph-card">
                  <div className="ph-card-hdr"><h3>{I.trend} Évolution des ventes — 12 mois</h3></div>
                  <div style={{ padding:20 }}>
                    <BarChartCanvas labels={["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"]} data={[2800000,3200000,3000000,3500000,3800000,3600000,3100000,2500000,3300000,3700000,3400000,4000000]} color="#059669" height={180} />
                  </div>
                </div>
                <div className="ph-card">
                  <div className="ph-card-hdr"><h3>💊 Top 5 médicaments vendus</h3></div>
                  <div style={{ padding:20 }}>
                    {[["Paracétamol 1g",28,"var(--pg)"],["Amoxicilline 500mg",22,"var(--pb)"],["Artemether 20mg",18,"var(--pt)"],["Métronidazole 250mg",15,"var(--pp)"],["Oméprazole 20mg",12,"var(--po)"]].map(([med,pct,col])=>(
                      <div key={med} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                          <span style={{ color:"var(--pm)", fontWeight:600 }}>{med}</span>
                          <span style={{ fontWeight:700, color:"var(--pn)" }}>{pct}%</span>
                        </div>
                        <Prog pct={pct} color={col} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ COMMANDES & FOURNISSEURS ══ */}
          {tab === "commandes" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--pn)" }}>Commandes & Fournisseurs</div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="pbtn pbtn-primary" onClick={() => { setFormCmd(EMPTY_CMD); setModalCmd(true); }}>📦 Bon de commande</button>
                  <button className="pbtn pbtn-ghost" onClick={() => setModalIACmd(true)}>{I.ia} Commande IA</button>
                </div>
              </div>

              <div className="ph-g11">
                {/* Commandes */}
                <div className="ph-card">
                  <div className="ph-card-hdr"><h3>📦 Bons de commande ({commandes.length})</h3></div>
                  <div className="ph-tbl-wrap">
                    <table className="ph-tbl" style={{ minWidth:520 }}>
                      <thead><tr><th>N° Bon</th><th>Fournisseur</th><th>Lignes</th><th>Montant</th><th>Date</th><th>Statut</th><th></th></tr></thead>
                      <tbody>
                        {(commandes.length>0?commandes:DEMO_COMMANDES).map(c=>(
                          <tr key={c._id}>
                            <td style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:"var(--pb)" }}>{c.numero}</td>
                            <td style={{ fontSize:12, color:"var(--pm)" }}>{c.fournisseur}</td>
                            <td style={{ textAlign:"center", fontWeight:700 }}>{c.nb_lignes||"—"}</td>
                            <td style={{ fontWeight:600, fontSize:12 }}>{fmtCFA(c.montant)}</td>
                            <td style={{ fontSize:11, color:"var(--pm)" }}>{fmtDate(c.date)}</td>
                            <td><CmdBadge statut={c.statut} /></td>
                            <td>
                              {!["recu","annule"].includes(c.statut) && (
                                <button type="button" className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:11 }} onClick={() => openReception(c)}>📥 Réceptionner</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Fournisseurs */}
                <div className="ph-card">
                  <div className="ph-card-hdr"><h3>🏭 Fournisseurs partenaires</h3></div>
                  <div style={{ padding:16 }}>
                    {(fournisseurs.length>0?fournisseurs:DEMO_FOURNISSEURS).map(f=>(
                      <div key={f._id} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 0", borderBottom:"1px solid var(--pbr)" }}>
                        <div style={{ width:40, height:40, borderRadius:10, background:"var(--pl)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>🏭</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:700, color:"var(--pn)", fontSize:13 }}>{f.nom}</div>
                          <div style={{ fontSize:11, color:"var(--pm)" }}>{f.contact} · {f.ville}</div>
                          <div style={{ fontSize:11, color:"var(--pm)" }}>📧 {f.email}</div>
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0 }}>
                          <Badge cls={f.type==="principal"?"teal":f.type==="gouvernemental"?"blue":"gray"}>{f.type}</Badge>
                          <div style={{ fontSize:10, color:"var(--pm)", marginTop:4 }}>Délai : {f.delai_livraison}j</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ INVENTAIRE ══ */}
          {tab === "inventaire" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--pn)" }}>Inventaire physique</div>
                  <div style={{ fontSize:12, color:"var(--pm)" }}>Comptage et vérification du stock réel vs théorique</div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="pbtn pbtn-teal" onClick={() => setModalInv(true)}>{I.inv} Démarrer inventaire</button>
                  <button className="pbtn pbtn-ghost" onClick={exportInventairePDF}>{I.dl} Exporter PDF</button>
                </div>
              </div>

              <div className="ph-card">
                <div className="ph-card-hdr"><h3>📊 Tableau d'inventaire</h3><p>Saisissez le stock compté physiquement — l'écart se calcule automatiquement par rapport au stock théorique du système</p></div>
                <div className="ph-tbl-wrap">
                  <table className="ph-tbl" style={{ minWidth:800 }}>
                    <thead><tr><th>Code</th><th>Médicament</th><th>Emplacement</th><th>Stock théorique</th><th>Stock réel (comptage)</th><th>Écart</th><th>Statut</th></tr></thead>
                    <tbody>
                      {meds.map((m)=>{
                        const saisie = comptageReel[m._id];
                        const compte = saisie === undefined || saisie === "" ? m.stock_quantite : Number(saisie);
                        const ecart = compte - m.stock_quantite;
                        return (
                          <tr key={m._id} style={{ background:ecart!==0?"#FFFBF0":"" }}>
                            <td style={{ fontFamily:"monospace", fontSize:11, color:"var(--pb)" }}>{m.code}</td>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--pn)" }}>{m.nom_commercial}</div>
                              <div style={{ fontSize:11, color:"var(--pm)" }}>Lot : {m.lot||"—"}</div>
                            </td>
                            <td><Badge cls="gray">{m.emplacement||"—"}</Badge></td>
                            <td style={{ fontWeight:700, color:"var(--pn)", textAlign:"center" }}>{m.stock_quantite}</td>
                            <td style={{ textAlign:"center" }}>
                              <input type="number" min="0" value={saisie ?? m.stock_quantite} onChange={e => setComptageReel(prev => ({ ...prev, [m._id]: e.target.value }))} style={{ width:80, padding:"4px 8px", border:"1.5px solid var(--pbr)", borderRadius:8, textAlign:"center", fontWeight:700, fontSize:13, outline:"none" }} />
                            </td>
                            <td style={{ textAlign:"center" }}>
                              <span style={{ fontWeight:800, fontSize:14, color:ecart<0?"var(--pr)":ecart>0?"var(--pg)":"var(--pm)" }}>
                                {ecart===0?"✓":ecart>0?`+${ecart}`:ecart}
                              </span>
                            </td>
                            <td><Badge cls={ecart!==0?"orange":"green"}>{ecart!==0?"Écart détecté":"Conforme"}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding:"14px 20px", borderTop:"1.5px solid var(--pbr)", display:"flex", gap:10 }}>
                  <button className="pbtn pbtn-teal" disabled={validatingInv} onClick={validerInventaire}>{I.save} {validatingInv ? "Enregistrement..." : "Valider l'inventaire"}</button>
                  <button className="pbtn pbtn-ghost" onClick={exportInventairePDF}>{I.dl} Export PDF</button>
                </div>
              </div>
            </div>
          )}

          {/* ══ RAPPORTS ══ */}
          {tab === "rapports" && (
            <div>
              <div className="ph-g11" style={{ marginBottom:24 }}>
                <div className="ph-card">
                  <div className="ph-card-hdr"><div><h3>{I.trend} Consommation mensuelle</h3><p>Top médicaments consommés</p></div></div>
                  <div style={{ padding:20 }}>
                    <BarChartCanvas labels={["Paracet.","Amoxic.","Artémét.","Métron.","Omépraz."]} data={[450,320,280,210,180]} color="#1B4F9E" height={180} />
                  </div>
                </div>
                <div className="ph-card">
                  <div className="ph-card-hdr"><div><h3>💰 Revenus par catégorie</h3></div></div>
                  <div style={{ padding:20 }}>
                    {[["Antibiotiques",850000,"var(--pb)"],["Antipaludéens",620000,"var(--pt)"],["Analgésiques",490000,"var(--pg)"],["Antidiabétiques",380000,"var(--pp)"],["Solutés",240000,"var(--po)"]].map(([cat,rev,col])=>(
                      <div key={cat} style={{ marginBottom:12 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                          <span style={{ color:"var(--pm)", fontWeight:600 }}>{cat}</span>
                          <span style={{ fontWeight:700, color:"var(--pn)" }}>{fmtCFA(rev)}</span>
                        </div>
                        <Prog pct={Math.round(rev/850000*100)} color={col} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="ph-card">
                <div className="ph-card-hdr">
                  <div><h3>📋 Rapports disponibles</h3></div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => exportRapportPDF('global')}>{I.dl} PDF global</button>
                  </div>
                </div>
                <div style={{ padding:20, display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12 }}>
                  {[
                    ["📊","Stock actuel","État complet de l'inventaire","stock"],
                    ["⏰","Produits expirés","Lots périmés à retirer","expires"],
                    ["📅","Proches expiration","Alerte péremption < 90j","peremption"],
                    ["📈","Consommation mensuelle","Mouvements du mois","consommation"],
                    ["💰","Ventes","Chiffre d'affaires détaillé","ventes"],
                    ["📦","Approvisionnements","Historique des commandes","approvisionnements"],
                    ["🔬","Médicaments + vendus","Classement des ventes","top-ventes"],
                    ["📋","Audit pharmacie","Journal des opérations","audit"],
                  ].map(([ico,titre,desc,type])=>(
                    <div key={titre} style={{ background:"var(--ps)", border:"1.5px solid var(--pbr)", borderRadius:14, padding:16, display:"flex", flexDirection:"column", gap:8 }}>
                      <div style={{ fontSize:24 }}>{ico}</div>
                      <div style={{ fontWeight:700, color:"var(--pn)", fontSize:13 }}>{titre}</div>
                      <div style={{ fontSize:11, color:"var(--pm)" }}>{desc}</div>
                      <button className="pbtn pbtn-primary pbtn-sm" style={{ fontSize:11, marginTop:"auto" }} onClick={() => exportRapportPDF(type)}>{I.dl} Générer PDF</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ AUDIT ══ */}
          {tab === "audit" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--pn)" }}>Journal d'audit pharmacie</div>
                  <div style={{ fontSize:12, color:"var(--pm)" }}>Traçabilité complète de toutes les opérations</div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  {["Tous","Entrées","Sorties","Dispensations","Ventes","Ajustements"].map(f=>(
                    <button key={f} className={`pbtn pbtn-sm ${f==="Tous"?"pbtn-primary":"pbtn-ghost"}`} style={{ fontSize:11 }}>{f}</button>
                  ))}
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:20 }}>
                {[["Total opérations","1 284","var(--pb)"],["Entrées","342","var(--pg)"],["Dispensations","681","var(--pt)"],["Sorties internes","198","var(--po)"],["Ajustements","63","var(--pp)"]].map(([l,v,c])=>(
                  <div key={l} style={{ background:"#fff", border:"1.5px solid var(--pbr)", borderRadius:14, padding:"14px 16px", textAlign:"center", boxShadow:"var(--sh)" }}>
                    <div style={{ fontSize:22, fontWeight:800, color:c, letterSpacing:-1 }}>{v}</div>
                    <div style={{ fontSize:11, color:"var(--pm)", fontWeight:600, marginTop:3 }}>{l}</div>
                  </div>
                ))}
              </div>

              <div className="ph-card">
                <div className="ph-tbl-wrap">
                  <table className="ph-tbl" style={{ minWidth:800 }}>
                    <thead><tr><th>Date & Heure</th><th>Médicament</th><th>Opération</th><th>Qté</th><th>Avant → Après</th><th>Référence</th><th>Pharmacien</th><th>Patient</th></tr></thead>
                    <tbody>
                      {(mvts.length>0?mvts:DEMO_MVTS).map(mv=>{
                        const mc = MVT_CFG[mv.type]||{icon:"·",label:mv.type,cls:"gray",sign:""};
                        return (
                          <tr key={mv._id}>
                            <td style={{ fontSize:11, fontFamily:"monospace", color:"var(--pm)" }}>
                              {mv.date||mv.created_at?new Date(mv.date||mv.created_at).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—"}
                            </td>
                            <td style={{ fontWeight:600, color:"var(--pn)", fontSize:12 }}>{mv.medicament_nom}</td>
                            <td><Badge cls={mc.cls}>{mc.icon} {mc.label}</Badge></td>
                            <td style={{ fontWeight:800, color:["entree","retour"].includes(mv.type)?"var(--pg)":"var(--pr)" }}>{mc.sign}{mv.quantite}</td>
                            <td style={{ fontSize:12, color:"var(--pm)" }}>
                              {mv.stock_avant}<span style={{ margin:"0 4px" }}>→</span>
                              <strong style={{ color:mv.stock_apres===0?"var(--pr)":"var(--pn)" }}>{mv.stock_apres}</strong>
                            </td>
                            <td style={{ fontSize:11, fontFamily:"monospace", color:"var(--pb)" }}>{mv.reference||"—"}</td>
                            <td style={{ fontSize:11, color:"var(--pm)" }}>{mv.pharmacien||"—"}</td>
                            <td style={{ fontSize:11, color:"var(--pm)" }}>{mv.patient||"—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ MODAL : AJOUTER MÉDICAMENT ═══ */}
        <Modal open={modalAdd} onClose={() => { setModalAdd(false); setPhotoFile(null); setPhotoPreview(null); }} title={<>{I.plus} Ajouter un médicament au catalogue</>} wide>
          <form onSubmit={createMed}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
              <PhotoPicker
                preview={photoPreview}
                currentUrl={null}
                inputRef={photoInputRef}
                onChange={e => { const f=e.target.files?.[0]; if(f){setPhotoFile(f);setPhotoPreview(URL.createObjectURL(f));} }}
                onRemove={() => { setPhotoFile(null); setPhotoPreview(null); }}
              />
              <div>
                <label className="plbl">Code médicament</label>
                <input className="pinp" value={formMed.code} onChange={e=>setFormMed(f=>({...f,code:e.target.value}))} placeholder="MED-XXX" />
              </div>
              <div>
                <label className="plbl">Catégorie thérapeutique *</label>
                <select className="pinp" required value={formMed.categorie} onChange={e=>setFormMed(f=>({...f,categorie:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="plbl">Nom commercial *</label>
                <input className="pinp" required value={formMed.nom_commercial} onChange={e=>setFormMed(f=>({...f,nom_commercial:e.target.value}))} placeholder="Ex: AMOXICILLINE 500MG" />
              </div>
              <div>
                <label className="plbl">DCI / Principe actif</label>
                <input className="pinp" value={formMed.dci} onChange={e=>setFormMed(f=>({...f,dci:e.target.value}))} placeholder="Ex: Amoxicilline" />
              </div>
              <div>
                <label className="plbl">Forme galénique</label>
                <select className="pinp" value={formMed.forme} onChange={e=>setFormMed(f=>({...f,forme:e.target.value}))}>
                  {FORMES_PHARMA.map(f=><option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="plbl">Dosage</label>
                <input className="pinp" value={formMed.dosage} onChange={e=>setFormMed(f=>({...f,dosage:e.target.value}))} placeholder="500mg, 1g, 250ml..." />
              </div>
              <div>
                <label className="plbl">Fabricant</label>
                <input className="pinp" value={formMed.fabricant} onChange={e=>setFormMed(f=>({...f,fabricant:e.target.value}))} placeholder="SANOFI, PFIZER..." />
              </div>
              <div>
                <label className="plbl">Fournisseur</label>
                <select className="pinp" value={formMed.fournisseur} onChange={e=>setFormMed(f=>({...f,fournisseur:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  {(fournisseurs.length>0?fournisseurs:DEMO_FOURNISSEURS).map(fn=><option key={fn._id} value={fn.nom}>{fn.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="plbl">Prix d'achat (CFA)</label>
                <input type="number" className="pinp" min={0} value={formMed.prix_achat} onChange={e=>setFormMed(f=>({...f,prix_achat:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Prix de vente (CFA) *</label>
                <input type="number" className="pinp" required min={0} value={formMed.prix_vente} onChange={e=>setFormMed(f=>({...f,prix_vente:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Stock initial</label>
                <input type="number" className="pinp" min={0} value={formMed.stock_quantite} onChange={e=>setFormMed(f=>({...f,stock_quantite:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Stock minimum (seuil alerte)</label>
                <input type="number" className="pinp" min={1} value={formMed.stock_minimum} onChange={e=>setFormMed(f=>({...f,stock_minimum:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Stock maximum</label>
                <input type="number" className="pinp" min={1} value={formMed.stock_maximum} onChange={e=>setFormMed(f=>({...f,stock_maximum:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Emplacement</label>
                <input className="pinp" value={formMed.emplacement} onChange={e=>setFormMed(f=>({...f,emplacement:e.target.value}))} placeholder="Ex: A1-01" />
              </div>
              <div>
                <label className="plbl">Numéro de lot</label>
                <input className="pinp" value={formMed.lot} onChange={e=>setFormMed(f=>({...f,lot:e.target.value}))} placeholder="AMX-2025-01" />
              </div>
              <div>
                <label className="plbl">Date d'expiration</label>
                <input type="date" className="pinp" value={formMed.date_expiration} onChange={e=>setFormMed(f=>({...f,date_expiration:e.target.value}))} />
              </div>
              <div style={{ gridColumn:"1/-1", display:"flex", alignItems:"center", gap:8 }}>
                <input type="checkbox" id="rx" checked={formMed.ordonnance} onChange={e=>setFormMed(f=>({...f,ordonnance:e.target.checked}))} style={{ width:16, height:16, accentColor:"var(--pr)" }} />
                <label htmlFor="rx" style={{ fontSize:13, fontWeight:600, color:"var(--pn)", cursor:"pointer" }}>💊 Ordonnance obligatoire (médicament Rx)</label>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button type="button" className="pbtn pbtn-ghost" onClick={() => setModalAdd(false)}>Annuler</button>
              <button type="submit" className="pbtn pbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>{I.save} {saving?"Ajout...":"Ajouter au catalogue"}</button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : MODIFIER MÉDICAMENT ═══ */}
        <Modal open={modalEdit} onClose={() => { setModalEdit(false); setPhotoFile(null); setPhotoPreview(null); }} title={<>{I.edit} Modifier — {currentMed?.nom_commercial}</>} wide>
          <form onSubmit={updateMed}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
              <PhotoPicker
                preview={photoPreview}
                currentUrl={formMed.photo || null}
                inputRef={photoInputRef}
                onChange={e => { const f=e.target.files?.[0]; if(f){setPhotoFile(f);setPhotoPreview(URL.createObjectURL(f));} }}
                onRemove={() => { setPhotoFile(null); setPhotoPreview(null); setFormMed(fm=>({...fm,photo:''})); }}
              />
              <div style={{ gridColumn:"1/-1" }}>
                <label className="plbl">Nom commercial *</label>
                <input className="pinp" required value={formMed.nom_commercial} onChange={e=>setFormMed(f=>({...f,nom_commercial:e.target.value}))} />
              </div>
              <div>
                <label className="plbl">DCI</label>
                <input className="pinp" value={formMed.dci} onChange={e=>setFormMed(f=>({...f,dci:e.target.value}))} />
              </div>
              <div>
                <label className="plbl">Catégorie</label>
                <select className="pinp" value={formMed.categorie} onChange={e=>setFormMed(f=>({...f,categorie:e.target.value}))}>
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="plbl">Prix d'achat (CFA)</label>
                <input type="number" className="pinp" min={0} value={formMed.prix_achat} onChange={e=>setFormMed(f=>({...f,prix_achat:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Prix de vente (CFA)</label>
                <input type="number" className="pinp" min={0} value={formMed.prix_vente} onChange={e=>setFormMed(f=>({...f,prix_vente:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Stock minimum</label>
                <input type="number" className="pinp" min={1} value={formMed.stock_minimum} onChange={e=>setFormMed(f=>({...f,stock_minimum:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Stock maximum</label>
                <input type="number" className="pinp" min={1} value={formMed.stock_maximum} onChange={e=>setFormMed(f=>({...f,stock_maximum:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Numéro de lot</label>
                <input className="pinp" value={formMed.lot} onChange={e=>setFormMed(f=>({...f,lot:e.target.value}))} />
              </div>
              <div>
                <label className="plbl">Date d'expiration</label>
                <input type="date" className="pinp" value={fmtDateI(formMed.date_expiration)} onChange={e=>setFormMed(f=>({...f,date_expiration:e.target.value}))} />
              </div>
              <div>
                <label className="plbl">Emplacement</label>
                <input className="pinp" value={formMed.emplacement} onChange={e=>setFormMed(f=>({...f,emplacement:e.target.value}))} />
              </div>
              <div>
                <label className="plbl">Fournisseur</label>
                <select className="pinp" value={formMed.fournisseur} onChange={e=>setFormMed(f=>({...f,fournisseur:e.target.value}))}>
                  {(fournisseurs.length>0?fournisseurs:DEMO_FOURNISSEURS).map(fn=><option key={fn._id} value={fn.nom}>{fn.nom}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button type="button" className="pbtn pbtn-ghost" onClick={() => setModalEdit(false)}>Annuler</button>
              <button type="submit" className="pbtn pbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>{I.save} {saving?"Mise à jour...":"Enregistrer"}</button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : MOUVEMENT STOCK ═══ */}
        <Modal open={modalMvt} onClose={() => setModalMvt(false)} title="⚡ Mouvement de stock" narrow>
          <form onSubmit={createMvt}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label className="plbl">Médicament *</label>
                <select className="pinp" required value={formMvt.medicament_id} onChange={e=>setFormMvt(f=>({...f,medicament_id:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  {meds.map(m=><option key={m._id} value={m._id}>{m.nom_commercial} · Stock : {m.stock_quantite}</option>)}
                </select>
              </div>
              <div>
                <label className="plbl">Type de mouvement *</label>
                <select className="pinp" value={formMvt.type} onChange={e=>setFormMvt(f=>({...f,type:e.target.value}))}>
                  <option value="entree">📥 Entrée — Réception commande</option>
                  <option value="sortie">📤 Sortie — Usage interne</option>
                  <option value="dispensation">💊 Dispensation sur ordonnance</option>
                  <option value="retour">↩ Retour patient / fournisseur</option>
                  <option value="ajustement">≈ Ajustement inventaire</option>
                  <option value="perte">✕ Perte / Casse</option>
                  <option value="peremption">⏰ Retrait péremption</option>
                </select>
              </div>
              <div>
                <label className="plbl">Quantité *</label>
                <input type="number" className="pinp" required min={1} value={formMvt.quantite} onChange={e=>setFormMvt(f=>({...f,quantite:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Référence (N° BC, ordonnance, lot...)</label>
                <input className="pinp" value={formMvt.reference} onChange={e=>setFormMvt(f=>({...f,reference:e.target.value}))} placeholder="BC-2025-XXX ou ORD-2025-XXX" />
              </div>
              {["entree","retour"].includes(formMvt.type) && (
                <>
                  <div>
                    <label className="plbl">Numéro de lot (réception)</label>
                    <input className="pinp" value={formMvt.lot} onChange={e=>setFormMvt(f=>({...f,lot:e.target.value}))} placeholder="LOT-2025-XXX" />
                  </div>
                  <div>
                    <label className="plbl">Date d'expiration du lot</label>
                    <input type="date" className="pinp" value={formMvt.date_peremption_lot} onChange={e=>setFormMvt(f=>({...f,date_peremption_lot:e.target.value}))} />
                  </div>
                </>
              )}
              {/* Aperçu */}
              {formMvt.medicament_id && (
                <div style={{ background:"var(--ps)", border:"1.5px solid var(--pbr)", borderRadius:12, padding:"12px 14px" }}>
                  {(() => {
                    const m = meds.find(x=>x._id===formMvt.medicament_id);
                    if (!m) return null;
                    const isE = ["entree","retour"].includes(formMvt.type);
                    const apres = isE ? m.stock_quantite+Number(formMvt.quantite) : Math.max(0,m.stock_quantite-Number(formMvt.quantite));
                    return (
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:12, color:"var(--pm)" }}>Stock après mouvement</span>
                        <span style={{ fontWeight:800, fontSize:16, color:apres===0?"var(--pr)":apres<m.stock_minimum?"var(--po)":"var(--pg)" }}>{apres} unités</span>
                      </div>
                    );
                  })()}
                </div>
              )}
              <div>
                <label className="plbl">Notes</label>
                <textarea className="pinp" rows={2} value={formMvt.notes} onChange={e=>setFormMvt(f=>({...f,notes:e.target.value}))} placeholder="Motif, remarques..." style={{ resize:"none" }} />
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="pbtn pbtn-ghost" onClick={() => setModalMvt(false)}>Annuler</button>
                <button type="submit" className="pbtn pbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>{I.save} {saving?"...":"Enregistrer"}</button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : VENTE ═══ */}
        <Modal open={modalVente} onClose={() => setModalVente(false)} title={<>{I.cart} Vente & Dispensation</>} wide>
          <form onSubmit={createVente}>
            <div className="ph-g11">
              {/* Dispensation sur ordonnance */}
              <div>
                <div style={{ background:"#EEF4FF", borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--pn)", marginBottom:10 }}>📋 Dispensation sur ordonnance</div>
                  <label className="plbl">N° Ordonnance</label>
                  <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                    <input
                      className="pinp"
                      value={rxNum}
                      onChange={e=>{ setRxNum(e.target.value); if (selectedRx) setSelectedRx(null); }}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); searchOrdonnance(); } }}
                      placeholder="RX-2025-XXXXX"
                      style={{ flex:1 }}
                    />
                    <button type="button" className="pbtn pbtn-primary pbtn-sm" disabled={searchingRx} onClick={searchOrdonnance}>{I.search}</button>
                  </div>
                  {selectedRx && (
                    <div style={{ fontSize:11, fontWeight:700, color:"var(--pg)", marginBottom:10 }}>
                      ✓ {selectedRx.numero_rx} — {selectedRx.patient?.prenom || ""} {selectedRx.patient?.nom || ""} ({(selectedRx.lignes||[]).length} ligne{(selectedRx.lignes||[]).length>1?"s":""})
                    </div>
                  )}
                  <label className="plbl">Type de dispensation</label>
                  <select className="pinp">
                    <option>Dispensation complète</option>
                    <option>Dispensation partielle</option>
                  </select>
                </div>
              </div>
              {/* Vente directe */}
              <div>
                <label className="plbl">Client (optionnel)</label>
                <input className="pinp" value={clientNom} onChange={e=>setClientNom(e.target.value)} placeholder="Nom du client ou 'Comptoir'" style={{ marginBottom:12 }} />
                <label className="plbl">Mode de paiement</label>
                <select className="pinp" value={modePaiement} onChange={e=>setModePaiement(e.target.value)} style={{ marginBottom:12 }}>
                  <option value="especes">💵 Espèces</option>
                  <option value="mobile_money">📱 Mobile Money</option>
                  <option value="carte_bancaire">💳 Carte bancaire</option>
                  <option value="assurance">🏥 Assurance / Tiers payant</option>
                </select>
              </div>
            </div>

            {/* Panier */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <label className="plbl" style={{ margin:0 }}>🛍️ Panier ({panier.length} article{panier.length>1?"s":""})</label>
                <button type="button" className="pbtn pbtn-ghost pbtn-sm" onClick={() => setPanier(p=>[...p,{id:Date.now(),med:null,quantite:1}])}>{I.plus} Ajouter</button>
              </div>
              {panier.map(it=>{
                const q = (panierSearch[it.id] ?? (it.med?.nom_commercial ?? "")).toLowerCase();
                const isOpen = !!panierOpen[it.id];

                // Filtre : si champ vide → 10 premiers du catalogue ; sinon → tous ceux qui contiennent q
                const suggestions = isOpen
                  ? (q.trim() === ""
                    ? meds.slice(0, 10)
                    : meds.filter(m =>
                        (m.nom_commercial || "").toLowerCase().includes(q) ||
                        (m.dci           || "").toLowerCase().includes(q) ||
                        (m.principe_actif|| "").toLowerCase().includes(q) ||
                        (m.code          || "").toLowerCase().includes(q) ||
                        (m.forme         || "").toLowerCase().includes(q) ||
                        (m.categorie     || "").toLowerCase().includes(q) ||
                        (m.fabricant     || "").toLowerCase().includes(q) ||
                        (m.dosage        || "").toLowerCase().includes(q)
                      ).slice(0, 12)
                    )
                  : [];

                const inputVal = panierSearch[it.id] !== undefined
                  ? panierSearch[it.id]
                  : (it.med?.nom_commercial || "");

                return (
                  <div key={it.id} className="cart-item" style={{ flexWrap:"wrap", gap:8, alignItems:"flex-start" }}>
                    {/* ── Champ de recherche intelligent ── */}
                    <div style={{ flex:"1 1 200px", position:"relative" }}>
                      <input
                        className="pinp"
                        style={{ fontSize:12, paddingRight:it.med ? 28 : 12 }}
                        placeholder="🔍 Taper pour rechercher (ex: Amox, Parac...)"
                        value={inputVal}
                        onChange={e => {
                          const val = e.target.value;
                          setPanierSearch(s => ({ ...s, [it.id]: val }));
                          setPanierOpen(o  => ({ ...o, [it.id]: true }));
                          // Si l'utilisateur efface, déselectionner le médicament
                          if (!val.trim()) setPanier(p => p.map(x => x.id === it.id ? { ...x, med: null } : x));
                        }}
                        onFocus={() => setPanierOpen(o => ({ ...o, [it.id]: true }))}
                        onBlur={() => setTimeout(() => setPanierOpen(o => ({ ...o, [it.id]: false })), 200)}
                      />

                      {/* Icône ✓ si médicament sélectionné */}
                      {it.med && (
                        <span style={{ position:"absolute", right:9, top:"50%", transform:"translateY(-50%)", fontSize:14, color:"var(--pg)", pointerEvents:"none" }}>✓</span>
                      )}

                      {/* ── Dropdown suggestions ── */}
                      {isOpen && (
                        <div style={{
                          position:"absolute", top:"calc(100% + 4px)", left:0, right:0,
                          background:"#fff", border:"1.5px solid var(--pbr)", borderRadius:12,
                          zIndex:300, maxHeight:260, overflowY:"auto",
                          boxShadow:"0 10px 30px rgba(11,30,59,.14)"
                        }}>
                          {suggestions.length === 0 ? (
                            <div style={{ padding:"14px 16px", textAlign:"center", color:"var(--pm)", fontSize:12 }}>
                              Aucun médicament trouvé pour "{panierSearch[it.id]}"
                            </div>
                          ) : (
                            <>
                              {q.trim() === "" && (
                                <div style={{ padding:"8px 14px", fontSize:10, fontWeight:700, color:"var(--pm)", background:"var(--ps)", borderBottom:"1px solid var(--pbr)", textTransform:"uppercase", letterSpacing:.6 }}>
                                  Catalogue — 10 premiers ({meds.length} total)
                                </div>
                              )}
                              {suggestions.map(m => {
                                const ss = stockSt(m.stock_quantite, m.stock_minimum);
                                const rupture = ss === "rupture";
                                const stockColor = { ok:"var(--pg)", bas:"var(--po)", critique:"#F97316", rupture:"var(--pr)" }[ss] || "var(--pg)";
                                return (
                                  <div key={m._id}
                                    onMouseDown={e => {
                                      e.preventDefault(); // évite que onBlur ne ferme avant la sélection
                                      setPanier(p => p.map(x => x.id === it.id ? { ...x, med: m } : x));
                                      setPanierSearch(s => ({ ...s, [it.id]: m.nom_commercial }));
                                      setPanierOpen(o => ({ ...o, [it.id]: false }));
                                    }}
                                    style={{
                                      padding:"10px 14px", cursor: rupture ? "not-allowed" : "pointer",
                                      borderBottom:"1px solid #F3F7FF", transition:"background .12s",
                                      background: rupture ? "#FFF8F8" : "",
                                      opacity: rupture ? .7 : 1,
                                    }}
                                    onMouseOver={e => { if (!rupture) e.currentTarget.style.background="#F0FDF8"; }}
                                    onMouseOut={e  => { e.currentTarget.style.background = rupture ? "#FFF8F8" : ""; }}
                                  >
                                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                                      <span style={{ fontWeight:700, fontSize:12, color:"var(--pn)" }}>
                                        {m.nom_commercial}
                                        {m.dosage && <span style={{ color:"var(--pm)", fontWeight:400 }}> {m.dosage}</span>}
                                      </span>
                                      {rupture
                                        ? <span style={{ fontSize:10, fontWeight:700, color:"var(--pr)", background:"#FEE2E2", padding:"2px 7px", borderRadius:99 }}>RUPTURE</span>
                                        : <span style={{ fontSize:11, fontWeight:700, color:"var(--pg)" }}>{fmtCFA(m.prix_vente)}</span>
                                      }
                                    </div>
                                    <div style={{ fontSize:11, color:"var(--pm)", marginTop:3, display:"flex", gap:10, alignItems:"center" }}>
                                      {m.forme    && <span>{m.forme}</span>}
                                      {m.categorie&& <span>· {m.categorie}</span>}
                                      <span style={{ color:stockColor, fontWeight:600, marginLeft:"auto" }}>
                                        Stock : {m.stock_quantite}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quantité */}
                    <input
                      type="number" min={1} max={it.med?.stock_quantite || 999} value={it.quantite}
                      style={{ width:68, padding:"9px 8px", border:"1.5px solid var(--pbr)", borderRadius:10, textAlign:"center", fontWeight:700, fontSize:13, outline:"none", fontFamily:"Poppins,sans-serif" }}
                      onChange={e => setPanier(p => p.map(x => x.id === it.id ? { ...x, quantite: Math.max(1, Number(e.target.value)) } : x))}
                    />
                    <div style={{ width:108, textAlign:"right", fontWeight:700, color:"var(--pn)", fontSize:13, flexShrink:0, paddingTop:10 }}>
                      {it.med ? fmtCFA(it.med.prix_vente * it.quantite) : "—"}
                    </div>
                    {panier.length > 1 && (
                      <button type="button" onClick={() => setPanier(p => p.filter(x => x.id !== it.id))}
                        style={{ background:"none", border:"none", cursor:"pointer", color:"var(--pr)", fontSize:20, lineHeight:1, paddingTop:8 }}>×</button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div style={{ background:"linear-gradient(135deg,#ECFDF5,#D1FAE5)", border:"1.5px solid #A7F3D0", borderRadius:14, padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <span style={{ fontWeight:700, color:"#065F46", fontSize:14 }}>Total à encaisser</span>
              <span style={{ fontWeight:800, fontSize:22, color:"var(--pg)", letterSpacing:-1 }}>{fmtCFA(panierTotal)}</span>
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button type="button" className="pbtn pbtn-ghost" onClick={() => setModalVente(false)}>Annuler</button>
              <button type="submit" className="pbtn pbtn-teal" style={{ marginLeft:"auto", flex:1 }} disabled={saving}>
                💰 {saving?"Enregistrement...":"Encaisser & Générer la facture"}
              </button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : BON DE COMMANDE ═══ */}
        <Modal open={modalCmd} onClose={() => setModalCmd(false)} title="📦 Nouveau bon de commande" wide>
          <form onSubmit={createCommande}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14, marginBottom:16 }}>
              <div>
                <label className="plbl">Fournisseur *</label>
                <select className="pinp" required value={formCmd.fournisseur} onChange={e=>setFormCmd(f=>({...f,fournisseur:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  {(fournisseurs.length>0?fournisseurs:DEMO_FOURNISSEURS).map(fn=><option key={fn._id} value={fn.nom}>{fn.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="plbl">Date livraison souhaitée</label>
                <input type="date" className="pinp" value={formCmd.date_livraison_souhaitee} onChange={e=>setFormCmd(f=>({...f,date_livraison_souhaitee:e.target.value}))} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="plbl">Notes / Motif</label>
                <textarea className="pinp" rows={2} value={formCmd.notes} onChange={e=>setFormCmd(f=>({...f,notes:e.target.value}))} placeholder="Urgence réapprovisionnement, notes..." style={{ resize:"none" }} />
              </div>
            </div>

            {/* Lignes */}
            <div style={{ border:"1.5px solid var(--pbr)", borderRadius:12, overflow:"hidden", marginBottom:16 }}>
              <div style={{ background:"var(--ps)", padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1.5px solid var(--pbr)" }}>
                <span style={{ fontSize:13, fontWeight:700, color:"var(--pn)" }}>Articles à commander</span>
                <button type="button" className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:11 }} onClick={() => setFormCmd(f=>({...f,lignes:[...f.lignes,{id:Date.now(),nom:"",forme:"",dosage:"",quantite:1,prix_unitaire:0,medicament:null}]}))}>{I.plus} Ajouter ligne</button>
              </div>
              <table className="ph-tbl" style={{ minWidth:580 }}>
                <thead><tr><th>Médicament *</th><th>Forme</th><th>Dosage</th><th>Qté *</th><th>Prix unit. (CFA)</th><th>Sous-total</th><th></th></tr></thead>
                <tbody>
                  {formCmd.lignes.map(l=>(
                    <tr key={l.id}>
                      <td>
                        <input className="pinp" style={{ fontSize:12, padding:"6px 10px" }} list="meds-list" value={l.nom} onChange={e=>{
                          const val = e.target.value;
                          const matched = meds.find(m => m.nom_commercial === val);
                          setFormCmd(f=>({...f,lignes:f.lignes.map(x=>x.id===l.id?{
                            ...x, nom: val,
                            medicament: matched ? matched._id : undefined,
                            forme: matched ? (matched.forme || x.forme) : x.forme,
                            dosage: matched ? (matched.dosage || x.dosage) : x.dosage,
                            prix_unitaire: matched ? (matched.prix_achat || x.prix_unitaire) : x.prix_unitaire,
                          }:x)}));
                        }} placeholder="Nom médicament" />
                        {l.medicament && <div style={{ fontSize:10, color:"var(--pb)", marginTop:2 }}>🔗 Lié au stock — réception incrémentera cette fiche</div>}
                      </td>
                      <td><input className="pinp" style={{ fontSize:12, padding:"6px 10px", width:100 }} value={l.forme} onChange={e=>setFormCmd(f=>({...f,lignes:f.lignes.map(x=>x.id===l.id?{...x,forme:e.target.value}:x)}))} placeholder="Comprimé" /></td>
                      <td><input className="pinp" style={{ fontSize:12, padding:"6px 10px", width:90 }} value={l.dosage} onChange={e=>setFormCmd(f=>({...f,lignes:f.lignes.map(x=>x.id===l.id?{...x,dosage:e.target.value}:x)}))} placeholder="500mg" /></td>
                      <td><input type="number" className="pinp" style={{ fontSize:12, padding:"6px 10px", width:70, textAlign:"center" }} min={1} value={l.quantite} onChange={e=>setFormCmd(f=>({...f,lignes:f.lignes.map(x=>x.id===l.id?{...x,quantite:Number(e.target.value)}:x)}))} /></td>
                      <td><input type="number" className="pinp" style={{ fontSize:12, padding:"6px 10px", width:110, textAlign:"right" }} min={0} value={l.prix_unitaire} onChange={e=>setFormCmd(f=>({...f,lignes:f.lignes.map(x=>x.id===l.id?{...x,prix_unitaire:Number(e.target.value)}:x)}))} /></td>
                      <td style={{ fontWeight:700, fontSize:12 }}>{fmtCFA(l.quantite*l.prix_unitaire)}</td>
                      <td><button type="button" onClick={() => setFormCmd(f=>({...f,lignes:f.lignes.filter(x=>x.id!==l.id)}))} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--pr)", fontSize:18 }}>×</button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:"linear-gradient(to right,#EEF4FF,#DBEAFE)" }}>
                    <td colSpan={5} style={{ padding:"10px 14px", fontWeight:800, textAlign:"right", color:"var(--pn)" }}>Total estimé :</td>
                    <td style={{ padding:"10px 14px", fontWeight:800, color:"var(--pb)", fontSize:15 }}>{fmtCFA(formCmd.lignes.reduce((s,l)=>s+l.quantite*l.prix_unitaire,0))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              <datalist id="meds-list">{meds.map(m=><option key={m._id} value={m.nom_commercial} />)}</datalist>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button type="button" className="pbtn pbtn-ghost" onClick={() => setModalCmd(false)}>Annuler</button>
              <button type="submit" className="pbtn pbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>{I.save} {saving?"Création...":"Créer le bon de commande"}</button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : RÉCEPTION COMMANDE ═══ */}
        <Modal open={modalReception} onClose={() => setModalReception(false)} title={`📥 Réception — ${currentCmd?.numero || ""}`} wide>
          {currentCmd && (
            <form onSubmit={submitReception}>
              <table className="ph-tbl" style={{ minWidth:480, marginBottom:16 }}>
                <thead><tr><th>Article</th><th>Restant à recevoir</th><th>Reçu maintenant</th></tr></thead>
                <tbody>
                  {formReception.map((l, i) => (
                    <tr key={i}>
                      <td style={{ fontSize:12 }}>{l.nom || "—"}</td>
                      <td style={{ textAlign:"center", fontSize:12, color:"var(--pm)" }}>{l.restant}</td>
                      <td>
                        <input type="number" className="pinp" style={{ fontSize:12, padding:"6px 10px", width:90, textAlign:"center" }}
                          min={0} max={l.restant} value={l.quantite_recue}
                          onChange={e => setFormReception(prev => prev.map((x,idx) => idx===i ? { ...x, quantite_recue: e.target.value } : x))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize:11, color:"var(--pm)", marginBottom:16 }}>Les lignes sans médicament rattaché au stock (saisies en texte libre) sont marquées reçues mais ne modifient aucune fiche de stock.</div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="pbtn pbtn-ghost" onClick={() => setModalReception(false)}>Annuler</button>
                <button type="submit" className="pbtn pbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>{I.save} {saving?"Enregistrement...":"Confirmer la réception"}</button>
              </div>
            </form>
          )}
        </Modal>

        {/* ═══ MODAL : COMMANDE IA ═══ */}
        <Modal open={modalIACmd} onClose={() => setModalIACmd(false)} title={<>{I.ia} Commande IA — Réapprovisionnement automatique</>} narrow>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div className="al-ia" style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:0 }}>
              <span style={{ fontSize:18 }}>🤖</span>
              <div style={{ fontSize:12, color:"#3B82F6" }}>
                Quantités suggérées calculées sur la base de <strong>3× le seuil d'alerte</strong> (couverture ~90 jours selon la consommation historique).
              </div>
            </div>
            <div style={{ maxHeight:320, overflowY:"auto" }}>
              {alertsMeds.filter(m=>stockSt(m.stock_quantite,m.stock_minimum)!=="ok").map(m=>{
                const qteSugg = m.stock_minimum*3;
                return (
                  <div key={m._id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", background:"var(--ps)", border:"1.5px solid var(--pbr)", borderRadius:10, marginBottom:8 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, color:"var(--pn)", fontSize:13 }}>{m.nom_commercial}</div>
                      <div style={{ fontSize:11, color:"var(--pm)" }}>{m.fournisseur} · Stock : <strong style={{ color:stockColor(stockSt(m.stock_quantite,m.stock_minimum)) }}>{m.stock_quantite}</strong></div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <input type="number" value={qteCmdIA[m._id] ?? qteSugg} min={1} onChange={e => setQteCmdIA(prev => ({ ...prev, [m._id]: e.target.value }))} style={{ width:80, padding:"6px 8px", border:"1.5px solid var(--pbr)", borderRadius:8, textAlign:"center", fontWeight:700, fontSize:13, outline:"none" }} />
                      <div style={{ fontSize:10, color:"var(--pm)", marginTop:2 }}>{fmtCFA((Number(qteCmdIA[m._id]) || qteSugg)*m.prix_achat)}</div>
                    </div>
                  </div>
                );
              })}
              {alertsMeds.filter(m=>stockSt(m.stock_quantite,m.stock_minimum)!=="ok").length===0 && (
                <div style={{ textAlign:"center", padding:30, color:"var(--pg)", fontWeight:700 }}>✅ Tous les stocks sont satisfaisants</div>
              )}
            </div>
            <div style={{ background:"linear-gradient(135deg,#EFF6FF,#DBEAFE)", border:"1.5px solid #BFDBFE", borderRadius:12, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontWeight:700, color:"var(--pb)", fontSize:13 }}>Valeur estimée de la commande</span>
              <span style={{ fontWeight:800, fontSize:18, color:"var(--pb)" }}>{fmtCFA(alertsMeds.filter(m=>stockSt(m.stock_quantite,m.stock_minimum)!=="ok").reduce((s,m)=>s+m.stock_minimum*3*m.prix_achat,0))}</span>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="pbtn pbtn-ghost" onClick={() => setModalIACmd(false)}>Fermer</button>
              <button className="pbtn pbtn-teal" style={{ marginLeft:"auto" }} disabled={sendingCmdIA} onClick={transmettreCommandeIA}>📧 {sendingCmdIA ? "Envoi..." : "Transmettre la commande"}</button>
            </div>
          </div>
        </Modal>

        {/* ═══ MODAL : TICKET DE VENTE ═══ */}
        <Modal open={modalTicket} onClose={() => setModalTicket(false)} title="🧾 Ticket de vente" narrow>
          {venteTicket && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {/* Ticket preview */}
              <div style={{ background:"#F8FAFD", border:"1.5px dashed var(--pbr)", borderRadius:14, padding:16, fontFamily:"'Courier New',monospace", fontSize:12 }}>
                <div style={{ textAlign:"center", marginBottom:8 }}>
                  <div style={{ fontWeight:800, fontSize:13 }}>🏥 Clinique Canadienne de Souanké</div>
                  <div style={{ fontSize:10, color:"var(--pm)" }}>Souanké, Congo-Brazzaville</div>
                  <div style={{ borderTop:"1px dashed #ccc", margin:"6px 0" }} />
                  <div style={{ fontWeight:700 }}>TICKET DE VENTE</div>
                  <div style={{ fontSize:11 }}>N° {venteTicket.numero}</div>
                  <div style={{ fontSize:10, color:"var(--pm)" }}>{new Date(venteTicket.date).toLocaleString("fr-FR")}</div>
                </div>
                <div style={{ borderTop:"1px dashed #ccc", margin:"6px 0" }} />
                <div style={{ fontSize:11 }}>Client : <strong>{venteTicket.client}</strong></div>
                <div style={{ fontSize:11 }}>Paiement : {({especes:"Espèces 💵",mobile_money:"Mobile Money 📱",carte_bancaire:"Carte bancaire 💳",assurance:"Assurance 🏥"})[venteTicket.mode_paiement] || venteTicket.mode_paiement}</div>
                <div style={{ borderTop:"1px dashed #ccc", margin:"6px 0" }} />
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid #ccc" }}>
                      <th style={{ textAlign:"left", paddingBottom:3 }}>Médicament</th>
                      <th style={{ textAlign:"center", paddingBottom:3 }}>Qté</th>
                      <th style={{ textAlign:"right", paddingBottom:3 }}>PU</th>
                      <th style={{ textAlign:"right", paddingBottom:3 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {venteTicket.items.map((item, i) => (
                      <tr key={i}>
                        <td style={{ paddingTop:3 }}>{item.nom}{item.dosage && <span style={{ opacity:.7 }}> ({item.dosage})</span>}</td>
                        <td style={{ textAlign:"center", paddingTop:3 }}>{item.quantite}</td>
                        <td style={{ textAlign:"right", paddingTop:3 }}>{fmtCFA(item.prix_unitaire)}</td>
                        <td style={{ textAlign:"right", paddingTop:3, fontWeight:700 }}>{fmtCFA(item.sous_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ borderTop:"1px dashed #ccc", margin:"6px 0" }} />
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontWeight:700, fontSize:12 }}>TOTAL</span>
                  <span style={{ fontWeight:800, fontSize:16, color:"var(--pg)" }}>{fmtCFA(venteTicket.total)}</span>
                </div>
                <div style={{ borderTop:"1px dashed #ccc", margin:"6px 0" }} />
                <div style={{ textAlign:"center", fontSize:10, color:"var(--pm)" }}>Merci de votre confiance !<br/>Conservez ce ticket pour tout remboursement.</div>
              </div>

              {/* Actions */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <button className="pbtn pbtn-primary" onClick={printTicket58mm}>
                  {I.print} Impr. thermique
                </button>
                <button className="pbtn pbtn-teal" onClick={printTicketA4}>
                  📄 PDF complet (A4)
                </button>
                <button
                  className="pbtn"
                  style={{ background:"#25D366", color:"#fff", fontWeight:700 }}
                  onClick={shareWhatsApp}
                >
                  📱 Partager WhatsApp
                </button>
                <button className="pbtn pbtn-ghost" onClick={shareEmail}>
                  📧 Envoyer par email
                </button>
              </div>
              <button className="pbtn pbtn-ghost" style={{ width:"100%" }} onClick={() => setModalTicket(false)}>Fermer</button>
            </div>
          )}
        </Modal>

        {/* ═══ MODAL : INVENTAIRE ═══ */}
        <Modal open={modalInv} onClose={() => setModalInv(false)} title={<>{I.inv} Démarrer un inventaire physique</>} narrow>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div className="al-ia" style={{ marginBottom:0 }}>
              <div style={{ fontSize:12, color:"#3B82F6" }}>L'inventaire physique compare le stock théorique du système avec le comptage réel. Tout écart sera enregistré dans le journal d'audit.</div>
            </div>
            <div>
              <label className="plbl">Type d'inventaire</label>
              <select className="pinp">
                <option>Inventaire complet (tous médicaments)</option>
                <option>Inventaire partiel (par catégorie)</option>
                <option>Inventaire tournant (par emplacement)</option>
              </select>
            </div>
            <div>
              <label className="plbl">Responsable de l'inventaire</label>
              <input className="pinp" placeholder="Nom du pharmacien responsable" />
            </div>
            <div>
              <label className="plbl">Observations</label>
              <textarea className="pinp" rows={2} placeholder="Contexte, motif, notes..." style={{ resize:"none" }} />
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="pbtn pbtn-ghost" onClick={() => setModalInv(false)}>Annuler</button>
              <button className="pbtn pbtn-teal" style={{ marginLeft:"auto" }} onClick={() => { setComptageReel({}); setModalInv(false); setTab("inventaire"); }}>🚀 Démarrer l'inventaire</button>
            </div>
          </div>
        </Modal>

      </div>
    </>
  );
}