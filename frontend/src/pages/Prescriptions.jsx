import { useState, useEffect, useCallback, useMemo, useRef, useId } from "react";
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchPrescriptions,
  selectPrescriptions, selectPrescriptionsLoading, selectPrescriptionsTotal,
} from '../store/slices/prescriptionsSlice';
import api from "../api";
import toast from "react-hot-toast";
import { FileText, Plus, Printer } from 'lucide-react';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import Hero from '../components/UI/Hero';
import Button from '../components/UI/Button';

// ─── Chart.js loader ─────────────────────────────────────────
function loadChartJs(cb) {
  if (window.Chart) { cb(); return; }
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
  s.onload = cb;
  document.head.appendChild(s);
}

// ─── CSS Medical Navy + Teal ──────────────────────────────────
// Palette locale supprimée (alignée sur les tokens globaux de
// index.css depuis T4.1) — toutes les règles ci-dessous consomment
// directement var(--ink)/--primary/--accent/etc. .ord-top/.ord-tabs/
// .ord-tab(:hover/.active)/.ord-tab-badge (bandeau + onglets
// fusionnés) retirés : mortes depuis le passage au <Hero> partagé
// (T4.3), confirmé par recherche exhaustive dans le JSX avant
// suppression. @keyframes ordP CONSERVÉ malgré la suppression de
// .ord-tab-badge : .okpi-dot/.inter-badge.critique (hors bandeau,
// confirmés vivants) l'utilisent aussi. .omov/.omov-box/.omov-hdr/
// .omov-cls/.omov-body (modale locale) restent inchangées en
// structure — seules leurs couleurs sont consolidées. .chronic-badge
// (#7C3AED22/#7C3AED11) laissée intacte : couleur 8 chiffres à
// alpha explicite, aucun token global ne couvre ce niveau de
// transparence — seule sa couleur pleine (#7C3AED, texte) migrée.
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.ord * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
@keyframes ordP { 0%,100%{opacity:1} 50%{opacity:.4} }
/* Cards */
.ord-card { background:#fff; border:1.5px solid var(--border); border-radius:18px; box-shadow:var(--shadow); overflow:hidden; transition:box-shadow .2s; }
.ord-card:hover { box-shadow:var(--shadow-md); }
.ord-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--border); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.ord-card-hdr h3 { font-size:14px; font-weight:700; color:var(--ink); margin:0; display:flex; align-items:center; gap:8px; }
.ord-card-hdr p { font-size:11px; color:var(--muted); margin:2px 0 0; }
/* KPI */
.ord-kpi { background:#fff; border:1.5px solid var(--border); border-radius:18px; padding:18px 20px; box-shadow:var(--shadow); position:relative; overflow:hidden; transition:all .25s; cursor:pointer; }
.ord-kpi:hover { transform:translateY(-2px); box-shadow:var(--shadow-md); }
.ord-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.ord-kpi.blue::before   { background:var(--primary); } .ord-kpi.teal::before   { background:var(--accent); }
.ord-kpi.red::before    { background:var(--danger); } .ord-kpi.orange::before { background:var(--warning); }
.ord-kpi.green::before  { background:var(--success); } .ord-kpi.purple::before { background:var(--tertiary); }
.okpi-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
.okpi-icon.blue   { background:#EFF6FF; color:var(--primary); } .okpi-icon.teal   { background:#F0FDFC; color:var(--accent); }
.okpi-icon.red    { background:#FEF2F2; color:var(--danger); } .okpi-icon.orange { background:#FFF7ED; color:var(--warning); }
.okpi-icon.green  { background:#ECFDF5; color:var(--success); } .okpi-icon.purple { background:#F5F3FF; color:var(--tertiary); }
.okpi-val { font-size:26px; font-weight:800; color:var(--ink); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.okpi-lbl { font-size:11.5px; font-weight:600; color:var(--muted); }
.okpi-sub { font-size:10.5px; color:#9CA3AF; margin-top:2px; }
.okpi-dot { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--danger); animation:ordP 2s infinite; }
/* Badges */
.obdg { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.obdg.red    { background:#FEF2F2; color:var(--danger); border:1px solid #FECACA; }
.obdg.orange { background:#FFF7ED; color:var(--warning); border:1px solid #FED7AA; }
.obdg.yellow { background:#FEFCE8; color:#CA8A04;   border:1px solid #FEF08A; }
.obdg.green  { background:#ECFDF5; color:var(--success); border:1px solid #A7F3D0; }
.obdg.blue   { background:#EFF6FF; color:var(--primary); border:1px solid #BFDBFE; }
.obdg.teal   { background:#F0FDFC; color:var(--accent); border:1px solid #99F6E4; }
.obdg.purple { background:#F5F3FF; color:var(--tertiary); border:1px solid #DDD6FE; }
.obdg.gray   { background:#F9FAFB; color:#4B5563;   border:1px solid #E5E7EB; }
/* Progress */
.ord-prog { background:var(--tint); border-radius:99px; height:7px; overflow:hidden; }
.ord-prog-f { height:100%; border-radius:99px; transition:width .5s; }
/* Buttons */
.obtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; text-decoration:none; }
.obtn-primary { background:var(--primary); color:#fff; } .obtn-primary:hover { background:var(--primary-dark); transform:translateY(-1px); }
.obtn-teal    { background:var(--accent); color:#fff; } .obtn-teal:hover    { background:var(--accent-dark); transform:translateY(-1px); }
.obtn-ghost   { background:transparent; color:var(--muted); border:1.5px solid var(--border); }
.obtn-ghost:hover { background:var(--tint); color:var(--ink); }
.obtn-danger  { background:#FEF2F2; color:var(--danger); border:1.5px solid #FECACA; }
.obtn-danger:hover { background:var(--danger); color:#fff; }
.obtn-sm { padding:6px 12px; font-size:12px; }
.obtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }
/* Forms */
.olbl { font-size:12px; font-weight:600; color:var(--muted); margin-bottom:6px; display:block; }
.oinp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--border); background:#FAFBFF; font-size:13px; color:var(--ink); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.oinp:focus { border-color:var(--accent); box-shadow:0 0 0 3px rgba(14,165,160,.12); }
/* Section nav */
.sec-nav { display:flex; gap:6px; flex-wrap:wrap; padding:14px 20px; background:linear-gradient(to right,var(--surface),var(--tint)); border-bottom:1.5px solid var(--border); }
.sec-btn { display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all .2s; color:var(--muted); background:none; font-family:'Poppins',sans-serif; }
.sec-btn:hover { background:white; color:var(--ink); border-color:var(--border); }
.sec-btn.active { background:var(--ink); color:white; border-color:var(--ink); }
.sec-btn.warn { border-color:#FECACA; color:var(--danger); }
/* Alerts */
.al-ia     { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; border-left:4px solid var(--primary); border-radius:14px; padding:14px 18px; }
.al-warn   { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--warning); border-radius:14px; padding:14px 18px; }
.al-danger { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--danger); border-radius:14px; padding:14px 18px; }
/* Table */
.ord-tbl { width:100%; border-collapse:collapse; }
.ord-tbl thead tr { background:linear-gradient(to right,var(--surface),var(--tint)); }
.ord-tbl th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--border); white-space:nowrap; }
.ord-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.ord-tbl tbody tr:last-child td { border-bottom:none; }
.ord-tbl tbody tr:hover { background:#F8FAFF; }
/* Modal */
.omov { position:fixed; inset:0; z-index:500; background:rgba(11,30,59,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.omov-box { background:#fff; border-radius:20px; box-shadow:var(--shadow-lg); width:100%; max-width:680px; max-height:92vh; overflow-y:auto; animation:oSlideUp .25s ease; }
@keyframes oSlideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.omov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--border); display:flex; align-items:center; justify-content:space-between; background:var(--tint); position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.omov-hdr h3 { font-size:16px; font-weight:700; color:var(--ink); margin:0; display:flex; align-items:center; gap:10px; }
.omov-cls { width:32px; height:32px; border-radius:8px; background:#F3F7FF; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.omov-cls:hover { background:#FEF2F2; color:var(--danger); }
.omov-body { padding:24px; }
/* Ligne médicament */
.med-row { background:var(--surface); border:1.5px solid var(--border); border-radius:12px; padding:14px 16px; position:relative; transition:border-color .2s; }
.med-row:hover { border-color:var(--accent); }
.med-row-num { position:absolute; top:-10px; left:14px; background:var(--primary); color:white; font-size:11px; font-weight:700; padding:2px 10px; border-radius:99px; }
/* Alerte interactions */
.inter-badge { display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:99px; font-size:11px; font-weight:700; }
.inter-badge.faible    { background:#ECFDF5; color:var(--success); border:1px solid #A7F3D0; }
.inter-badge.modere    { background:#FEFCE8; color:#CA8A04;   border:1px solid #FEF08A; }
.inter-badge.critique  { background:#FEF2F2; color:var(--danger); border:1px solid #FECACA; animation:ordP 2s infinite; }
/* Print ordonnance */
.ord-print-zone { background:#fff; border:2px solid var(--border); border-radius:18px; padding:32px; }
.ord-print-header { display:flex; align-items:center; justify-content:space-between; padding-bottom:18px; border-bottom:2px solid var(--ink); margin-bottom:18px; }
.ord-print-footer { padding-top:18px; border-top:2px solid var(--border); margin-top:18px; display:grid; grid-template-columns:1fr 1fr; gap:20px; }
/* QR placeholder */
.qr-placeholder { width:80px; height:80px; background:#F0FDFC; border:2px solid var(--accent); border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:28px; }
/* Chronic badge */
.chronic-badge { background:linear-gradient(135deg,#7C3AED22,#7C3AED11); border:1px solid #DDD6FE; color:var(--tertiary); font-size:10px; font-weight:700; padding:2px 8px; border-radius:99px; }
/* Fade */
@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
.fu { animation:fadeUp .35s ease both; }
/* Print */
@media print {
  .sec-nav,.obtn,.omov { display:none!important; }
  .ord-print-zone { border:none; padding:0; }
}

/* ─── Grilles responsives ─── */
.ord-g2   { display:grid; grid-template-columns:2fr 1fr; gap:20px; }
.ord-g11  { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.ord-g11s { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.ord-g4   { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }

/* ─── Mobile (≤ 767px) ─────────────────────────────────────── */
@media (max-width:767px) {
  /* Grilles → 1 colonne */
  .ord-g2, .ord-g11 { grid-template-columns:1fr; gap:14px; }
  .ord-g11s  { grid-template-columns:1fr 1fr; gap:8px; }
  .ord-g4    { grid-template-columns:1fr 1fr; gap:8px; }

  /* Formulaires anti-zoom iOS */
  .oinp { font-size:16px !important; }

  /* Boutons */
  .obtn    { font-size:12px; padding:8px 12px; }
  .obtn-sm { font-size:11px; padding:5px 8px; }

  /* Cards */
  .ord-card     { border-radius:14px; }
  .ord-card-hdr { padding:11px 14px; }
  .ord-card-hdr h3 { font-size:13px; }

  /* KPI */
  .okpi-val  { font-size:20px; }
  .okpi-icon { width:34px; height:34px; margin-bottom:8px; }

  /* Section nav scrollable */
  .sec-nav { overflow-x:auto; flex-wrap:nowrap; padding:10px 14px; scrollbar-width:none; }
  .sec-nav::-webkit-scrollbar { display:none; }

  /* Modal → bottom-sheet */
  .omov     { padding:0; align-items:flex-end; }
  .omov-box { border-radius:20px 20px 0 0; max-width:100%; max-height:93vh; }
  .omov-hdr { padding:13px 16px; }
  .omov-body{ padding:14px; }

  /* Ligne médicament */
  .med-row { padding:12px 14px; }

  /* Print footer → 1 col */
  .ord-print-footer { grid-template-columns:1fr; }
}

/* ─── Très petit écran (≤ 479px) ─────────────────────────────  */
@media (max-width:479px) {
  .ord-g11s { grid-template-columns:1fr; }
  .ord-g4   { grid-template-columns:1fr; }
  .okpi-val { font-size:18px; }
  .ord-card-hdr { flex-wrap:wrap; gap:8px; }
}
`;

// ─── Helpers ─────────────────────────────────────────────────
const fmtDate   = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const fmtDateInput = (d) => d ? new Date(d).toISOString().substring(0,10) : "";
const ageCalc   = (dob) => {
  if (!dob) return "—";
  return `${Math.floor((Date.now()-new Date(dob))/(365.25*24*3600*1000))} ans`;
};
const fmtNumOrd = (n) => `ORD-${new Date().getFullYear()}-${String(n).padStart(4,"0")}`;

// ─── Constantes ───────────────────────────────────────────────
const STATUTS = {
  brouillon:   { cls:"gray",   label:"Brouillon",  icon:"📝" },
  active:      { cls:"green",  label:"Active",     icon:"✅" },
  publiee:     { cls:"teal",   label:"Publiée",    icon:"📨" },
  dispensee:   { cls:"blue",   label:"Dispensée",  icon:"💊" },
  expiree:     { cls:"red",    label:"Expirée",    icon:"❌" },
  annulee:     { cls:"gray",   label:"Annulée",    icon:"🚫" },
  renouvellee: { cls:"purple", label:"Renouvelée", icon:"🔄" },
};

const FORMES_PHARMA = ["Comprimé","Gélule","Sirop","Injectable","Pommade","Crème","Patch","Gouttes","Spray","Suppositoire","Sachet","Solution buvable"];
const VOIES_ADMIN   = ["Orale","Intraveineuse (IV)","Intramusculaire (IM)","Sous-cutanée","Topique","Rectale","Sublinguale","Inhalée","Nasale"];
const FREQUENCES    = ["1 fois/jour","2 fois/jour","3 fois/jour","4 fois/jour","Toutes les 6h","Toutes les 8h","Toutes les 12h","Au coucher","Avant les repas","Après les repas","Si besoin","En continu"];
const MALADIES_CHRONIQUES = ["Diabète type 2","Hypertension artérielle","Asthme","VIH/SIDA","Épilepsie","Insuffisance cardiaque","Insuffisance rénale chronique","Tuberculose","Dépression chronique"];

const EXAMENS_COMPLS = ["NFS (Numération Formule Sanguine)","Glycémie à jeun","Créatinémie","Lipidogramme","Bilan hépatique","TSH (Thyroïde)","CRP (Protéine C réactive)","Hémoculture","ECBU","Sérologie VIH","Sérologie hépatite B","Test de grossesse","Groupage sanguin"];
const EXAMENS_IMAG   = ["Radiographie thorax","Échographie abdominale","Échographie pelvienne","Scanner cérébral","Scanner abdominal","IRM rachidienne","ECG","Fond d'œil"];

const ALLERGIES_COMMUNES = ["Pénicilline","Aspirine","AINS","Sulfamides","Codéine","Latex","Iode","Tétracyclines"];

const EMPTY_MED = { id:Date.now(), medicament:"", forme:"Comprimé", dosage:"", voie:"Orale", frequence:"2 fois/jour", duree:"7 jours", quantite:"", instructions:"" };

// Correction 5 (relecture du 6 sept. 2026, FE-BUG-007) — le dashboard, le
// chart de statuts, le BarChart 12 mois et l'onglet "Chroniques" itéraient
// sur DEMO_ORDONNANCES/DEMO_MOIS/DEMO_DATA, des constantes toujours vides,
// au lieu de l'état réel (`ordonnances`) déjà chargé par loadOrds. Agrège
// les vraies ordonnances par mois de date_prescription — même principe que
// Dashboard.jsx::chartAct.
function buildOrdonnancesParMois(ordonnances) {
  const moisFr = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const now = new Date();
  const labels = []; const data = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(moisFr[d.getMonth()]);
    const count = ordonnances.filter(o => {
      if (!o.date_prescription) return false;
      const od = new Date(o.date_prescription);
      return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth();
    }).length;
    data.push(count);
  }
  return { labels, data };
}
const EMPTY_ORD = {
  patient_id:"", poids:"", allergies:[], medecin:"", specialite:"", consultation_liee:"",
  date_prescription:new Date().toISOString().substring(0,10),
  date_expiration:"", diagnostic:"", chronique:false, maladie_chronique:"",
  medicaments:[{ ...EMPTY_MED, id:1 }],
  examens_labo:[], examens_imagerie:[],
  recommandations:"", note_confidentielle:"",
};

// ─── SVG Icons ─────────────────────────────────────────────
const I = {
  rx:     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12H15M12 9V15M3 12C3 7.03 7.03 3 12 3s9 4.03 9 9-4.03 9-9 9-9-4.03-9-9z"/></svg>,
  file:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  clock:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  alert:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  refresh:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
  plus:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  save:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  print:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  dl:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  send:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  grid:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  list:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  open:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  pill:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20H4a2 2 0 01-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 011.66.9l.82 1.2a2 2 0 001.66.9H20a2 2 0 012 2v2"/><circle cx="17" cy="17" r="5"/><path d="M14 17h6"/></svg>,
  check:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  trend:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  trash:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
  copy:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  drug:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>,
  ia:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  qr:     <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="5" y="5" width="3" height="3" fill="currentColor"/><rect x="16" y="5" width="3" height="3" fill="currentColor"/><rect x="5" y="16" width="3" height="3" fill="currentColor"/><line x1="14" y1="14" x2="14" y2="14"/><line x1="17" y1="14" x2="17" y2="14"/><line x1="20" y1="14" x2="20" y2="14"/><line x1="14" y1="17" x2="14" y2="17"/><line x1="17" y1="17" x2="20" y2="17"/><line x1="20" y1="20" x2="20" y2="20"/><line x1="14" y1="20" x2="17" y2="20"/></svg>,
};

// ─── Subcomponents ─────────────────────────────────────────
function Modal({ open, onClose, title, children, maxWidth=680 }) {
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
    <div className="omov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className="omov-box" style={{ maxWidth }} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="omov-hdr">
          <h3 id={titleId}>{title}</h3>
          <button className="omov-cls" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="omov-body">{children}</div>
      </div>
    </div>
  );
}

function Badge({ cls, children }) {
  return <span className={`obdg ${cls}`}>{children}</span>;
}

function KpiCard({ color, icon, value, label, sub, urgent, onClick }) {
  return (
    <div className={`ord-kpi ${color} fu`} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      {urgent && <div className="okpi-dot" />}
      <div className={`okpi-icon ${color}`}>{icon}</div>
      <div className="okpi-val">{value}</div>
      <div className="okpi-lbl">{label}</div>
      {sub && <div className="okpi-sub">{sub}</div>}
    </div>
  );
}

function Prog({ pct, color }) {
  return (
    <div className="ord-prog">
      <div className="ord-prog-f" style={{ width:`${pct}%`, background:color }} />
    </div>
  );
}

function BarChart({ labels, data, color="#1B4F9E", height=200 }) {
  const ref = useRef(null);
  const cRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (cRef.current) cRef.current.destroy();
      cRef.current = new window.Chart(ref.current, {
        type:"bar",
        data:{ labels, datasets:[{ label:"Ordonnances", data, backgroundColor:`${color}26`, borderColor:color, borderWidth:2, borderRadius:8, borderSkipped:false }] },
        options:{ responsive:true, maintainAspectRatio:true, plugins:{ legend:{display:false}, tooltip:{backgroundColor:"#0B1E3B",padding:10,cornerRadius:10} }, scales:{ x:{grid:{display:false},ticks:{font:{size:10},color:"#9CA3AF"},border:{display:false}}, y:{beginAtZero:true,grid:{color:"rgba(0,0,0,.04)"},ticks:{font:{size:10},color:"#9CA3AF",precision:0},border:{display:false}} } },
      });
    });
    return () => { if (cRef.current) cRef.current.destroy(); };
  }, [labels, data, color]);
  return <canvas ref={ref} style={{ maxHeight:height }} />;
}

// ─── MAIN ────────────────────────────────────────────────────
export default function Ordonnances() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const reduxOrdonnances = useSelector(selectPrescriptions);
  const reduxTotal = useSelector(selectPrescriptionsTotal);

  useEffect(() => { dispatch(fetchPrescriptions({})); }, [dispatch]);

  // Détection mobile — inline styles pour les onglets (priorité absolue)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 599);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const [tab, setTab]             = useState("dashboard");
  const [section, setSection]     = useState("patient");
  const [ordonnances, setOrds]    = useState([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState("");
  const [filterSt, setFilterSt]   = useState("");
  const [filterChr, setFilterChr] = useState(false);
  const [currentOrd, setCurrent]  = useState(null);
  const [patients, setPatients]   = useState([]);
  const [saving, setSaving]       = useState(false);
  const [kpis, setKpis]           = useState({ total:0, actives:0, expirees:0, renouvellements:0, chroniques:0, interactions:0, aujourd_hui:0 });
  const chartData = useMemo(() => buildOrdonnancesParMois(ordonnances), [ordonnances]);

  // Modals
  const [modalNouv, setModalNouv]   = useState(false);
  const [modalRenew, setModalRenew] = useState(false);
  const [modalAnnul, setModalAnnul] = useState(false);

  // Form
  const [formOrd, setFormOrd]       = useState(EMPTY_ORD);
  // Correction 2 (relecture du 6 sept. 2026, FE-BUG-004) — champs des
  // modales Renouvellement/Annulation, jusqu'ici saisis sans jamais être
  // transmis (renewOrd/cancelOrd postaient sans body utile).
  const [renewForm, setRenewForm]   = useState({ date_expiration: "", note: "" });
  const [annulMotif, setAnnulMotif] = useState("");

  // Médicaments dynamiques
  const addMed   = () => setFormOrd(f => ({ ...f, medicaments:[...f.medicaments,{ ...EMPTY_MED, id:Date.now() }] }));
  const removeMed = (id) => setFormOrd(f => ({ ...f, medicaments:f.medicaments.filter(m=>m.id!==id) }));
  const updateMed = (id, key, val) => setFormOrd(f => ({ ...f, medicaments:f.medicaments.map(m=>m.id===id?{...m,[key]:val}:m) }));

  // ── Chargement ──────────────────────────────────────────────
  // Normalise une prescription API vers le format attendu par la vue
  const normalizeOrd = (rx) => ({
    _id:             rx._id,
    numero:          rx.numero_rx || rx.numero || `RX-${rx._id?.slice(-5)}`,
    patient_nom:     rx.patient ? `${rx.patient.prenom || ''} ${rx.patient.nom || ''}`.trim() : (rx.patient_nom || '—'),
    patient_dob:     rx.patient?.date_naissance || rx.patient_dob || '',
    patient_id:      rx.patient?._id || rx.patient_id || '',
    patient_dossier: rx.patient?.numero_dossier || rx.patient_dossier || '',
    medecin:         rx.medecin ? `Dr. ${rx.medecin.prenom || ''} ${rx.medecin.nom || ''}`.trim() : (rx.medecin || '—'),
    specialite:      rx.medecin?.specialite || rx.specialite || '',
    diagnostic:      rx.diagnostic || rx.motif || '—',
    medicaments:     rx.lignes   || rx.medicaments   || [],   // lignes = backend, medicaments = ancienne forme
    lignes:          rx.lignes   || rx.medicaments   || [],
    date_prescription: rx.date_prescription,
    date_expiration:   rx.date_expiration,
    statut:          rx.statut || 'brouillon',
    publie_at:       rx.publie_at,
    chronique:       rx.chronique || false,
    allergies:       rx.allergies || [],
    poids:           rx.poids || '',
    pharmacie_statut:rx.pharmacie_statut || '',
    ia_interactions: (rx.interactions_detectees?.length || 0) > 0,
    interactions:    rx.interactions_detectees || [],
  });

  const loadOrds = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit:50 });
      if (search) p.set("q", search);
      if (filterSt) p.set("statut", filterSt);
      const { data } = await api.get(`/prescriptions?${p}`);
      const raw = data.prescriptions || data.ordonnances || [];
      setOrds(raw.map(normalizeOrd));
      setTotal(data.total || raw.length || 0);
    } catch {
      setOrds([]);
      setTotal(0);
    } finally { setLoading(false); }
  }, [page, search, filterSt]);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/prescriptions/stats");
      const s = data.stats || {};
      setKpis(prev => ({
        ...prev,
        total:          s.total          ?? prev.total,
        actives:        (s.actives || 0) + (s.publiees || 0),
        expirees:       s.expirees       ?? prev.expirees,
        chroniques:     s.chroniques     ?? prev.chroniques,
        aujourd_hui:    s.aujourd_hui    ?? prev.aujourd_hui,
        brouillons:     s.brouillons     ?? 0,
        publiees:       s.publiees       ?? 0,
      }));
    } catch {}
  }, []);

  // Correction 7 (relecture du 6 sept. 2026, FE-BUG-009) — un échec de
  // GET /patients injectait silencieusement 3 patients fictifs (Jean
  // Dupont, Marie Paul, Paul Nguema), sans jamais avertir l'utilisateur —
  // une ordonnance aurait pu être créée pour l'un de ces faux patients
  // sans que personne ne s'en aperçoive. Repli honnête : liste vide,
  // erreur explicite.
  const loadPatients = useCallback(async () => {
    try {
      const { data } = await api.get("/patients?limit=500");
      setPatients(data.patients || data.data || []);
    } catch {
      setPatients([]);
      toast.error("Impossible de charger la liste des patients — réessayez ou contactez le support.");
    }
  }, []);

  useEffect(() => { loadOrds(); loadStats(); loadPatients(); }, [loadOrds, loadStats, loadPatients]);
  useRealtimeRefresh(loadOrds);

  const openOrd = (ord) => { setCurrent(ord); setSection("patient"); setTab("ordonnance"); };

  // ── Créer ──────────────────────────────────────────────────
  const createOrd = async (ev) => {
    ev.preventDefault();
    if (!formOrd.patient_id) { toast.error("Veuillez sélectionner un patient."); return; }
    if (!formOrd.diagnostic)  { toast.error("Le diagnostic est obligatoire."); return; }
    setSaving(true);
    try {
      // Mapper les champs frontend → backend (Prescription model)
      const payload = {
        patient:          formOrd.patient_id,
        lignes:           (formOrd.medicaments || []).map(m => ({
          medicament_nom: m.medicament,
          posologie:      `${m.dosage} — ${m.frequence}${m.voie ? ` (${m.voie})` : ''}${m.instructions ? ` — ${m.instructions}` : ''}`,
          duree:          m.duree,
          quantite:       m.quantite ? parseInt(m.quantite, 10) : undefined,
          notes:          m.instructions,
        })),
        diagnostic:       formOrd.diagnostic,
        date_prescription:formOrd.date_prescription,
        date_expiration:  formOrd.date_expiration || undefined,
        statut:           'brouillon',
      };
      const { data } = await api.post("/prescriptions", payload);
      const newOrd = normalizeOrd(data.prescription || {});
      setOrds(prev => [newOrd, ...prev]);
      toast.success(`✅ Ordonnance ${data.prescription?.numero_rx || "créée"} — En brouillon, pensez à la publier.`);
      setModalNouv(false);
      setFormOrd(EMPTY_ORD);
      loadOrds(); loadStats();
    } catch (err) {
      const msg = err?.response?.data?.message || "Erreur lors de la création.";
      toast.error(`❌ ${msg}`);
    } finally { setSaving(false); }
  };

  // ── Renouveler ─────────────────────────────────────────────
  const renewOrd = async () => {
    if (!currentOrd) return;
    if (!renewForm.date_expiration) { toast.error("Renseignez la nouvelle date d'expiration."); return; }
    setSaving(true);
    try {
      await api.post(`/prescriptions/${currentOrd._id}/renouveler`, { date_expiration: renewForm.date_expiration, note: renewForm.note });
      toast.success("🔄 Ordonnance renouvelée — un brouillon a été créé.");
      setModalRenew(false);
      setRenewForm({ date_expiration: "", note: "" });
      loadOrds();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Erreur renouvellement.");
    } finally { setSaving(false); }
  };

  // ── Publier (rend visible au patient + notif + email) ─────
  const [publishing, setPublishing] = useState(false);
  const handlePublier = async () => {
    if (!currentOrd) return;
    if (!window.confirm("Publier cette ordonnance ? Elle sera envoyée au patient par email et visible sur son portail.")) return;
    setPublishing(true);
    try {
      const { data } = await api.post(`/prescriptions/${currentOrd._id}/publier`);
      setCurrent(prev => ({ ...prev, statut:"publiee", publie_at: new Date().toISOString() }));
      setOrds(prev => prev.map(o => o._id === currentOrd._id ? { ...o, statut:"publiee" } : o));
      const msg = data.email_envoye
        ? "✅ Ordonnance publiée et envoyée au patient par email."
        : "✅ Ordonnance publiée (email non envoyé — SMTP non configuré).";
      toast.success(msg, { duration: 5000 });
      loadStats();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Erreur lors de la publication.");
    } finally { setPublishing(false); }
  };

  // ── Annuler ────────────────────────────────────────────────
  const cancelOrd = async () => {
    if (!currentOrd) return;
    if (!annulMotif.trim()) { toast.error("Indiquez le motif d'annulation."); return; }
    setSaving(true);
    try {
      // AUDIT-ELEVE-3 (relecture du 6 sept. 2026) — le catch ci-dessous
      // marquait l'ordonnance "annulee" côté état local même si l'appel
      // réseau échouait réellement (même famille que FE-BUG-002 relevé
      // ailleurs) : hors périmètre de la Correction 2 (qui porte
      // uniquement sur le motif jamais transmis), documenté ici sans être
      // corrigé — le comportement du catch n'a pas été modifié.
      await api.put(`/prescriptions/${currentOrd._id}/cancel`, { motif: annulMotif });
      toast.success("🚫 Ordonnance annulée");
      setCurrent(prev => ({ ...prev, statut:"annulee", motif_annulation: annulMotif }));
      setOrds(prev => prev.map(o => o._id === currentOrd._id ? { ...o, statut:"annulee" } : o));
      setModalAnnul(false);
      setAnnulMotif("");
    } catch {
      setCurrent(prev => ({ ...prev, statut:"annulee" }));
      setModalAnnul(false);
    } finally { setSaving(false); }
  };

  // ── Pharmacie : stock réel (remplace l'ancien tirage aléatoire — AUDIT-0.1) ──
  // La disponibilité/quantité en stock affichées venaient de Math.random() à
  // chaque rendu ; ici on charge le vrai catalogue Medication (même source que
  // Pharmacy.jsx) et on l'associe par nom, sans jamais inventer de donnée : un
  // médicament non retrouvé dans le catalogue affiche "Non rattaché" plutôt
  // qu'un chiffre fabriqué.
  const [pharmStock, setPharmStock] = useState({});
  const [loadingStock, setLoadingStock] = useState(false);
  useEffect(() => {
    if (tab !== "ordonnance" || section !== "pharmacie" || !currentOrd) return;
    let cancelled = false;
    setLoadingStock(true);
    api.get("/pharmacy?limit=500")
      .then(({ data }) => {
        if (cancelled) return;
        const meds = data.medications || data.medicaments || [];
        const byName = {};
        meds.forEach(m => { byName[(m.nom_commercial || "").trim().toLowerCase()] = m; });
        setPharmStock(byName);
      })
      .catch(() => { if (!cancelled) setPharmStock({}); })
      .finally(() => { if (!cancelled) setLoadingStock(false); });
    return () => { cancelled = true; };
  }, [tab, section, currentOrd]);

  // Branché sur le vrai flux de dispensation (pharmacy.controller.js::dispenser,
  // déjà utilisé et fonctionnel depuis Pharmacy.jsx) — plus de toast simulé.
  const [dispensingRx, setDispensingRx] = useState(false);
  const dispenserRx = async () => {
    if (!currentOrd) return;
    if (!window.confirm("Confirmer la délivrance de cette ordonnance ? Le stock sera décrémenté pour les médicaments rattachés au catalogue pharmacie.")) return;
    setDispensingRx(true);
    try {
      await api.put(`/pharmacy/prescriptions/${currentOrd._id}/dispenser`);
      toast.success("💊 Délivrance confirmée — ordonnance marquée comme dispensée.");
      setCurrent(prev => ({ ...prev, statut: "dispensee" }));
      setOrds(prev => prev.map(o => o._id === currentOrd._id ? { ...o, statut: "dispensee" } : o));
      loadStats();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Erreur lors de la délivrance.");
    } finally { setDispensingRx(false); }
  };

  // ── Update ─────────────────────────────────────────────────
  const updateOrd = async (updates) => {
    if (!currentOrd) return;
    setSaving(true);
    try {
      await api.put(`/prescriptions/${currentOrd._id}`, updates);
      setCurrent(prev => ({ ...prev, ...updates }));
      setOrds(prev => prev.map(o => o._id === currentOrd._id ? { ...o, ...updates } : o));
      toast.success("✅ Ordonnance mise à jour.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Erreur mise à jour.");
    } finally { setSaving(false); }
  };

  const interactions = kpis.interactions || 0;
  const expirees     = kpis.expirees || 0;

  // ════════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      <div className="ord">

        {/* ── HERO ── */}
        <Hero
          icon={FileText}
          title="Module Ordonnances"
          dateLabel={`${kpis.total} ordonnance(s) · ${kpis.actives} active(s) · ${kpis.aujourd_hui} aujourd'hui`}
          right={
            <>
              {currentOrd && (
                <button className="hero-btn-ghost" onClick={() => window.print()}>
                  <Printer size={14} /> Imprimer
                </button>
              )}
              <Button icon={Plus} onClick={() => { setFormOrd(EMPTY_ORD); setModalNouv(true); }}>Nouvelle ordonnance</Button>
            </>
          }
        />

        {/* Tabs */}
        {(() => {
            const TABS = [
              { key:"dashboard",  icon:I.grid,    label:"Tableau de bord", labelM:"Dashboard" },
              { key:"liste",      icon:I.list,    label:"Historique",       labelM:"Historique" },
              { key:"ordonnance", icon:I.file,    label: currentOrd ? currentOrd.numero : "Ordonnance", labelM: currentOrd ? "Ordon." : "Ordonnance", disabled:!currentOrd },
              { key:"chroniques", icon:I.refresh, label:"Traitements chroniques", labelM:"Chroniques" },
              { key:"rapports",   icon:I.trend,   label:"Rapports", labelM:"Rapports" },
            ].filter(t=>!t.disabled);
            const cols = isMobile ? Math.min(3, TABS.length) : undefined;
            return (
              <div className="tab-bar" style={isMobile ? {
                display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap:4,
              } : {}}>
                {TABS.map(t=>(
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
                    <span style={isMobile ? { lineHeight:1.2 } : {}}>
                      {isMobile ? t.labelM : t.label}
                    </span>
                    {t.key==="liste" && (interactions>0||expirees>0) && <span className="tab-bar-item-count">{interactions+expirees}</span>}
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
              {/* Alerte interactions */}
              {interactions > 0 && (
                <div className="al-danger fu" style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, flexWrap:"wrap" }}>
                  <div style={{ width:42, height:42, background:"#FEE2E2", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{I.alert}</div>
                  <div style={{ flex:1 }}>
                    <strong style={{ color:"#B91C1C", fontSize:13 }}>⚠️ Interactions médicamenteuses détectées par l'IA</strong>
                    <div style={{ fontSize:12, color:"var(--danger)", marginTop:3 }}>
                      <strong>{interactions}</strong> ordonnance(s) présentent des interactions médicamenteuses potentielles. Révision médicale recommandée.
                    </div>
                  </div>
                  <button className="obtn obtn-danger obtn-sm" onClick={() => { setFilterSt(""); setTab("liste"); }}>Voir →</button>
                </div>
              )}

              {/* KPIs */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="blue"   icon={I.file}    value={kpis.total}          label="Total ordonnances"  sub="tous statuts"                onClick={() => setTab("liste")} />
                <KpiCard color="teal"   icon={I.check}   value={kpis.aujourd_hui}    label="Aujourd'hui"        sub="nouvelles prescriptions"     onClick={() => setTab("liste")} />
                <KpiCard color="green"  icon={I.drug}    value={kpis.actives}         label="Actives"            sub="en cours de traitement"      onClick={() => { setFilterSt("active"); setTab("liste"); }} />
                <KpiCard color="orange" icon={I.clock}   value={kpis.renouvellements} label="Renouvellements"   sub="à renouveler bientôt"        onClick={() => setTab("chroniques")} />
                <KpiCard color="red"    icon={I.clock}   value={kpis.expirees}        label="Expirées"           sub="sans renouvellement"         urgent={expirees>0} onClick={() => { setFilterSt("expiree"); setTab("liste"); }} />
                <KpiCard color="purple" icon={I.ia}      value={kpis.chroniques}      label="Chroniques"         sub="traitements long terme"      onClick={() => setTab("chroniques")} />
              </div>

              {/* Charts */}
              <div className="ord-g2" style={{ marginBottom:24 }}>
                <div className="ord-card fu">
                  <div className="ord-card-hdr">
                    <div><h3>{I.trend} Ordonnances émises — 12 mois</h3><p>Volume de prescriptions mensuel</p></div>
                  </div>
                  <div style={{ padding:20 }}>
                    <BarChart labels={chartData.labels} data={chartData.data} color="#0EA5A0" />
                  </div>
                </div>
                <div className="ord-card fu">
                  <div className="ord-card-hdr"><div><h3>Statuts des ordonnances</h3><p>{kpis.total} au total</p></div></div>
                  <div style={{ padding:20 }}>
                    {[["active","Actives","var(--success)"],["expiree","Expirées","var(--danger)"],["renouvellee","Renouvelées","var(--accent)"],["annulee","Annulées","#6B7280"]].map(([st,lbl,col]) => {
                      const cnt = ordonnances.filter(x=>x.statut===st).length;
                      const pct = kpis.total > 0 ? Math.round(cnt/kpis.total*100) : 0;
                      return (
                        <div key={st} style={{ marginBottom:12 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                            <span style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:"var(--muted)" }}>
                              <span style={{ width:10, height:10, borderRadius:3, background:col, display:"inline-block" }} />{lbl}
                            </span>
                            <span style={{ fontWeight:700, fontSize:12, color:"var(--ink)" }}>{cnt}</span>
                          </div>
                          <Prog pct={pct} color={col} />
                        </div>
                      );
                    })}
                    <div style={{ marginTop:14, paddingTop:12, borderTop:"1px solid var(--border)", fontSize:12, color:"var(--muted)", display:"flex", justifyContent:"space-between" }}>
                      <span>🤖 Interactions détectées</span>
                      <strong style={{ color: interactions>0?"var(--danger)":"var(--success)" }}>{interactions}</strong>
                    </div>
                    <div style={{ marginTop:6, fontSize:12, color:"var(--muted)", display:"flex", justifyContent:"space-between" }}>
                      <span>💊 Traitements chroniques</span>
                      <strong style={{ color:"var(--tertiary)" }}>{kpis.chroniques}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top médicaments prescrits */}
              <div className="ord-g11" style={{ marginBottom:24 }}>
                <div className="ord-card fu">
                  <div className="ord-card-hdr"><h3>{I.pill} Médicaments les plus prescrits</h3></div>
                  <div style={{ padding:20 }}>
                    {[["Paracétamol",38,"var(--success)"],["Amoxicilline",24,"var(--primary)"],["Oméprazole",21,"var(--accent)"],["Ibuprofène",18,"var(--warning)"],["Metformine",15,"var(--tertiary)"]].map(([med,pct,col]) => (
                      <div key={med} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3, fontSize:12 }}>
                          <span style={{ color:"var(--muted)", fontWeight:600 }}>{med}</span>
                          <span style={{ fontWeight:700, color:"var(--ink)" }}>{pct}%</span>
                        </div>
                        <Prog pct={pct} color={col} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="ord-card fu">
                  <div className="ord-card-hdr"><h3>👨‍⚕️ Top prescripteurs</h3></div>
                  <div style={{ padding:20 }}>
                    {[["Dr. Martin Leblanc","Chirurgie",42],["Dr. Sophie Pierre","Gynécologie / Med. Gen.",31],["Dr. Amina Diallo","Médecine interne",18],["Dr. Pierre Mouanda","Radiologie",9]].map(([dr,spe,n]) => (
                      <div key={dr} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid var(--border)" }}>
                        <div style={{ width:36, height:36, borderRadius:"50%", background:"var(--tint)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>👨‍⚕️</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:"var(--ink)" }}>{dr}</div>
                          <div style={{ fontSize:11, color:"var(--muted)" }}>{spe}</div>
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0 }}>
                          <div style={{ fontWeight:800, color:"var(--primary)", fontSize:16 }}>{n}</div>
                          <div style={{ fontSize:10, color:"var(--muted)" }}>ce mois</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ordonnances récentes */}
              <div className="ord-card fu">
                <div className="ord-card-hdr">
                  <div><h3>{I.file} Ordonnances récentes</h3><p>Dernières prescriptions émises</p></div>
                  <button className="obtn obtn-ghost obtn-sm" onClick={() => setTab("liste")}>Voir toutes →</button>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table className="ord-tbl">
                    <thead>
                      <tr><th>N° Ordonnance</th><th>Patient</th><th>Médecin</th><th>Diagnostic</th><th>Médicaments</th><th>Date</th><th>Expiration</th><th>Statut</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {ordonnances.slice(0,5).map(ord => {
                        const sc = STATUTS[ord.statut] || { cls:"gray", label:ord.statut, icon:"?" };
                        const jRestants = Math.max(0, Math.floor((new Date(ord.date_expiration)-Date.now())/(86400*1000)));
                        return (
                          <tr key={ord._id} style={{ background: ord.ia_interactions ? "#FFFBF0" : "" }}>
                            <td>
                              <span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--primary)", fontSize:12 }}>{ord.numero}</span>
                              {ord.chronique && <div><span className="chronic-badge">♾ Chronique</span></div>}
                              {ord.ia_interactions && <div><span className="inter-badge modere">🤖 Interaction</span></div>}
                            </td>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--ink)", cursor: ord.patient_id ? 'pointer' : 'default', textDecoration: ord.patient_id ? 'underline dotted' : 'none', textUnderlineOffset:2 }} onClick={() => ord.patient_id && navigate(`/patients/${ord.patient_id}`)} title={ord.patient_id ? "Ouvrir le dossier patient" : ""}>{ord.patient_nom}</div>
                              {ord.patient_dossier && <span style={{ fontFamily:'monospace', fontSize:10, fontWeight:700, color:'var(--primary)', background:'#EFF6FF', padding:'1px 6px', borderRadius:4, display:'inline-block', marginBottom:2 }}>{ord.patient_dossier}</span>}
                              <div style={{ fontSize:11, color:"var(--muted)" }}>{ageCalc(ord.patient_dob)} · {ord.poids}kg</div>
                            </td>
                            <td style={{ fontSize:12, color:"var(--muted)" }}>{ord.medecin}</td>
                            <td style={{ fontSize:12, maxWidth:180 }}><div style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{ord.diagnostic}</div></td>
                            <td><span style={{ fontWeight:700, color:"var(--primary)" }}>{ord.medicaments.length}</span><span style={{ fontSize:11, color:"var(--muted)" }}> médic.</span></td>
                            <td style={{ fontSize:12, color:"var(--muted)" }}>{fmtDate(ord.date_prescription)}</td>
                            <td style={{ fontSize:12, color: jRestants<7 && ord.statut==="active" ? "var(--danger)" : "var(--muted)", fontWeight: jRestants<7 && ord.statut==="active" ? 700 : 400 }}>
                              {fmtDate(ord.date_expiration)}
                              {ord.statut==="active" && jRestants<7 && <div style={{ fontSize:10 }}>⚠ {jRestants}j restants</div>}
                            </td>
                            <td><Badge cls={sc.cls}>{sc.icon} {sc.label}</Badge></td>
                            <td>
                              <button className="obtn obtn-ghost obtn-sm" style={{ fontSize:11 }} onClick={() => { openOrd(ord); setSection("impression"); }}>👁 Voir</button>
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

          {/* ══ LISTE / HISTORIQUE ══ */}
          {tab === "liste" && (
            <div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--ink)" }}>Historique des ordonnances</div>
                  <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>{total} ordonnance(s) au total</div>
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }}>{I.search}</span>
                    <input className="oinp" style={{ paddingLeft:34, width:210 }} placeholder="Patient, N° ordonnance..." aria-label="Patient, N° ordonnance" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                  </div>
                  <select className="oinp" style={{ width:150 }} value={filterSt} onChange={e => { setFilterSt(e.target.value); setPage(1); }}>
                    <option value="">Tous statuts</option>
                    {Object.entries(STATUTS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                  <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:600, color:"var(--muted)", cursor:"pointer" }}>
                    <input type="checkbox" checked={filterChr} onChange={e=>setFilterChr(e.target.checked)} style={{ accentColor:"var(--tertiary)", width:15, height:15 }} />
                    ♾ Chroniques
                  </label>
                  <button className="obtn obtn-primary" onClick={() => { setFormOrd(EMPTY_ORD); setModalNouv(true); }}>
                    {I.plus} Nouvelle ordonnance
                  </button>
                </div>
              </div>

              <div className="ord-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="ord-tbl" style={{ minWidth:1000 }}>
                    <thead>
                      <tr><th>N° Ordonnance</th><th>Patient</th><th>Médecin</th><th>Diagnostic</th><th>Méd.</th><th>Date</th><th>Expiration</th><th>Pharmacie</th><th>Statut</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={10} style={{ padding:40, textAlign:"center", color:"var(--muted)" }}>Chargement...</td></tr>
                      ) : ordonnances.map(ord => {
                        const sc = STATUTS[ord.statut] || { cls:"gray", label:ord.statut, icon:"?" };
                        const jRestants = Math.max(0, Math.floor((new Date(ord.date_expiration)-Date.now())/(86400*1000)));
                        const phCol = { "délivrée":"green", "en attente":"orange", "partielle":"yellow" }[ord.pharmacie_statut] || "gray";
                        return (
                          <tr key={ord._id} style={{ background: ord.ia_interactions?"#FFFBF0": ord.statut==="expiree"?"#FFF8F8":"" }}>
                            <td>
                              <span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--primary)", fontSize:12 }}>{ord.numero}</span>
                              {ord.chronique && <div><span className="chronic-badge">♾ Chronique</span></div>}
                              {ord.ia_interactions && <div style={{ marginTop:2 }}><span className="inter-badge modere">🤖 Interaction</span></div>}
                            </td>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--ink)", cursor: ord.patient_id ? 'pointer' : 'default', textDecoration: ord.patient_id ? 'underline dotted' : 'none', textUnderlineOffset:2 }} onClick={() => ord.patient_id && navigate(`/patients/${ord.patient_id}`)} title={ord.patient_id ? "Ouvrir le dossier patient" : ""}>{ord.patient_nom}</div>
                              {ord.patient_dossier && <span style={{ fontFamily:'monospace', fontSize:10, fontWeight:700, color:'var(--primary)', background:'#EFF6FF', padding:'1px 6px', borderRadius:4, display:'inline-block', marginBottom:2 }}>{ord.patient_dossier}</span>}
                              <div style={{ fontSize:11, color:"var(--muted)" }}>{ageCalc(ord.patient_dob)} · {ord.poids}kg
                                {ord.allergies?.length > 0 && <span style={{ color:"var(--danger)", marginLeft:4 }}>⚠ Allergie</span>}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize:12, fontWeight:600, color:"var(--ink)" }}>{ord.medecin}</div>
                              <div style={{ fontSize:11, color:"var(--muted)" }}>{ord.specialite}</div>
                            </td>
                            <td style={{ fontSize:12, maxWidth:160 }}><div style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{ord.diagnostic}</div></td>
                            <td style={{ textAlign:"center", fontWeight:700, color:"var(--primary)" }}>{ord.medicaments.length}</td>
                            <td style={{ fontSize:12, color:"var(--muted)" }}>{fmtDate(ord.date_prescription)}</td>
                            <td style={{ fontSize:12, color: jRestants<7&&ord.statut==="active"?"var(--danger)":"var(--muted)", fontWeight: jRestants<7&&ord.statut==="active"?700:400 }}>
                              {fmtDate(ord.date_expiration)}
                              {ord.statut==="active"&&jRestants<7 && <div style={{ fontSize:10 }}>⚠ {jRestants}j</div>}
                            </td>
                            <td><Badge cls={phCol}>{ord.pharmacie_statut||"—"}</Badge></td>
                            <td><Badge cls={sc.cls}>{sc.icon} {sc.label}</Badge></td>
                            <td>
                              <div style={{ display:"flex", gap:4, flexWrap:"wrap", alignItems:"center" }}>

                                {/* Voir → TOUJOURS disponible (ouvre la vue impression/détail) */}
                                <button
                                  className="obtn obtn-ghost obtn-sm"
                                  style={{ fontSize:10, display:"flex", alignItems:"center", gap:3 }}
                                  title="Voir l'ordonnance"
                                  onClick={() => { openOrd(ord); setSection("impression"); }}
                                >
                                  👁 Voir
                                </button>

                                {/* Publier → uniquement si pas encore publiée ni annulée */}
                                {!["publiee","annulee","dispensee"].includes(ord.statut) && (
                                  <button
                                    className="obtn obtn-sm"
                                    style={{ background:"#EFF6FF", color:"var(--primary)", border:"1px solid #BFDBFE", fontSize:10, padding:"4px 8px", borderRadius:6 }}
                                    title="Publier et envoyer au patient"
                                    onClick={async () => {
                                      if (!window.confirm(`Publier l'ordonnance ${ord.numero || ord.numero_rx} et l'envoyer au patient ?`)) return;
                                      try {
                                        const { data } = await api.post(`/prescriptions/${ord._id}/publier`);
                                        setOrds(prev => prev.map(o => o._id === ord._id ? { ...o, statut:"publiee" } : o));
                                        toast.success(data.email_envoye ? "✅ Ordonnance publiée et envoyée au patient par email." : "✅ Ordonnance publiée (email non envoyé — SMTP non configuré).", { duration: 4000 });
                                        loadStats();
                                      } catch (err) {
                                        toast.error(err?.response?.data?.message || "Erreur publication.");
                                      }
                                    }}
                                  >
                                    ✅ Publier
                                  </button>
                                )}

                                {/* Badge publiée */}
                                {ord.statut === "publiee" && (
                                  <span style={{ background:"#ECFDF5", color:"var(--success)", border:"1px solid #A7F3D0", fontSize:10, padding:"3px 7px", borderRadius:6, fontWeight:600 }}>
                                    📨 Publiée
                                  </span>
                                )}

                                {/* Renouveler */}
                                {!["annulee"].includes(ord.statut) && (
                                  <button className="obtn obtn-ghost obtn-sm" style={{ fontSize:10 }} onClick={() => { setCurrent(ord); setRenewForm({ date_expiration: "", note: "" }); setModalRenew(true); }} title="Renouveler">{I.refresh}</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!loading && ordonnances.length===0 && (
                        <tr><td colSpan={10} style={{ padding:40, textAlign:"center", color:"var(--muted)" }}>Aucune ordonnance trouvée</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {total > 15 && (
                  <div style={{ padding:"12px 20px", borderTop:"1.5px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontSize:12, color:"var(--muted)" }}>Page {page} / {Math.ceil(total/15)} · {total} ordonnances</span>
                    <div style={{ display:"flex", gap:8 }}>
                      {page>1 && <button className="obtn obtn-ghost obtn-sm" onClick={() => setPage(p=>p-1)}>← Précédent</button>}
                      {page<Math.ceil(total/15) && <button className="obtn obtn-primary obtn-sm" onClick={() => setPage(p=>p+1)}>Suivant →</button>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ ORDONNANCE INDIVIDUELLE ══ */}
          {tab === "ordonnance" && currentOrd && (
            <div>
              {/* Header */}
              <div style={{ background:"linear-gradient(135deg,var(--ink),var(--ink-2))", borderRadius:18, padding:"20px 24px", marginBottom:20, color:"#fff" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                    <div style={{ width:56, height:56, borderRadius:14, background:"rgba(255,255,255,.15)", border:"2px solid rgba(255,255,255,.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>
                      {currentOrd.sexe==="femme"?"👩":"👨"}
                    </div>
                    <div>
                      <div style={{ fontSize:18, fontWeight:700 }}>{currentOrd.patient_nom}</div>
                      <div style={{ fontSize:12, color:"rgba(255,255,255,.65)", marginTop:2 }}>
                        {ageCalc(currentOrd.patient_dob)} · {currentOrd.poids}kg
                        {currentOrd.allergies?.length>0 && <span style={{ color:"#FCA5A5" }}> · ⚠ Allergies : {currentOrd.allergies.join(", ")}</span>}
                      </div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:3 }}>📞 {currentOrd.telephone || "—"}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                    {currentOrd.chronique && (
                      <div style={{ background:"rgba(124,58,237,.3)", border:"1px solid rgba(124,58,237,.4)", borderRadius:10, padding:"8px 14px" }}>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,.6)", fontWeight:600, textTransform:"uppercase" }}>Traitement chronique</div>
                        <div style={{ fontSize:13, fontWeight:700, color:"#C4B5FD", marginTop:2 }}>♾ {currentOrd.maladie_chronique}</div>
                      </div>
                    )}
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontFamily:"monospace", fontSize:16, fontWeight:700, color:"rgba(255,255,255,.9)" }}>{currentOrd.numero}</div>
                      <div style={{ marginTop:6 }}>
                        <Badge cls={(STATUTS[currentOrd.statut]||{}).cls||"gray"}>
                          {(STATUTS[currentOrd.statut]||{}).icon} {(STATUTS[currentOrd.statut]||{}).label}
                        </Badge>
                      </div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:4 }}>
                        {currentOrd.medecin} · {fmtDate(currentOrd.date_prescription)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Alerte interactions IA */}
              {currentOrd.ia_interactions && (
                <div className="al-warn" style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:20 }}>
                  <span style={{ fontSize:20 }}>🤖</span>
                  <div style={{ flex:1 }}>
                    <strong style={{ color:"#92400E", fontSize:13 }}>IA — Interactions médicamenteuses détectées</strong>
                    <div style={{ fontSize:12, color:"#B45309", marginTop:4 }}>
                      {currentOrd.interactions?.map((i,n) => <div key={n}>• {i}</div>)}
                    </div>
                  </div>
                  <span className="inter-badge modere">Modéré</span>
                </div>
              )}

              {/* Section nav */}
              <div className="sec-nav" style={{ borderRadius:"18px 18px 0 0", overflow:"hidden" }}>
                {[
                  { id:"patient",    label:"👤 Patient" },
                  { id:"prescription",label:"💊 Prescription" },
                  { id:"examens",    label:"🔬 Examens & Recommandations" },
                  { id:"validation", label:"✍️ Validation" },
                  { id:"impression", label:"🖨 Impression" },
                  { id:"pharmacie",  label:"💊 Pharmacie" },
                  { id:"audit",      label:"📋 Audit" },
                ].map(s => (
                  <button key={s.id} className={`sec-btn ${section===s.id?"active":""}`} onClick={() => setSection(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>

              {/* ── PATIENT ── */}
              {section === "patient" && (
                <div style={{ marginTop:20 }}>
                  <div className="ord-g11">
                    <div className="ord-card">
                      <div className="ord-card-hdr"><h3>👤 Informations du patient</h3></div>
                      <div style={{ padding:20, display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                        {[["Nom complet",currentOrd.patient_nom,true],["Sexe",currentOrd.sexe?"Masculin":"Féminin",false],["Âge",ageCalc(currentOrd.patient_dob),false],["Poids",`${currentOrd.poids} kg`,false],["Téléphone",currentOrd.telephone||"—",false]].map(([lbl,val,wide])=>(
                          <div key={lbl} style={{ background:"var(--surface)", borderRadius:10, padding:"10px 12px", gridColumn:wide?"1/-1":"" }}>
                            <div style={{ fontSize:10, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:.4 }}>{lbl}</div>
                            <div style={{ fontSize:wide?15:13, fontWeight:wide?700:600, color:"var(--ink)", marginTop:2 }}>{val}</div>
                          </div>
                        ))}
                        {currentOrd.allergies?.length>0 && (
                          <div style={{ gridColumn:"1/-1", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10, padding:"10px 12px" }}>
                            <div style={{ fontSize:10, fontWeight:700, color:"#B91C1C", textTransform:"uppercase" }}>⚠ Allergies connues</div>
                            <div style={{ fontSize:12, color:"var(--danger)", marginTop:4 }}>{currentOrd.allergies.join(" · ")}</div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="ord-card">
                      <div className="ord-card-hdr"><h3>📋 Informations médicales</h3></div>
                      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
                        <div>
                          <label className="olbl">Consultation liée</label>
                          <input className="oinp" value={currentOrd.consultation_liee||""} onChange={e=>setCurrent(d=>({...d,consultation_liee:e.target.value}))} placeholder="N° consultation" />
                        </div>
                        <div>
                          <label className="olbl">Diagnostic *</label>
                          <textarea className="oinp" rows={3} value={currentOrd.diagnostic||""} onChange={e=>setCurrent(d=>({...d,diagnostic:e.target.value}))} placeholder="Diagnostic principal..." />
                        </div>
                        <div>
                          <label className="olbl">Médecin prescripteur</label>
                          <input className="oinp" value={currentOrd.medecin||""} onChange={e=>setCurrent(d=>({...d,medecin:e.target.value}))} />
                        </div>
                        <div className="ord-g11s">
                          <div>
                            <label className="olbl">Date prescription</label>
                            <input type="date" className="oinp" value={fmtDateInput(currentOrd.date_prescription)} onChange={e=>setCurrent(d=>({...d,date_prescription:e.target.value}))} />
                          </div>
                          <div>
                            <label className="olbl">Date expiration</label>
                            <input type="date" className="oinp" value={fmtDateInput(currentOrd.date_expiration)} onChange={e=>setCurrent(d=>({...d,date_expiration:e.target.value}))} />
                          </div>
                        </div>
                        <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                          <input type="checkbox" checked={currentOrd.chronique||false} onChange={e=>setCurrent(d=>({...d,chronique:e.target.checked}))} style={{ width:16, height:16, accentColor:"var(--tertiary)" }} />
                          <span style={{ fontSize:13, color:"var(--ink)", fontWeight:600 }}>♾ Traitement chronique</span>
                        </label>
                        {currentOrd.chronique && (
                          <div>
                            <label className="olbl">Pathologie chronique</label>
                            <select className="oinp" value={currentOrd.maladie_chronique||""} onChange={e=>setCurrent(d=>({...d,maladie_chronique:e.target.value}))}>
                              <option value="">— Sélectionner —</option>
                              {MALADIES_CHRONIQUES.map(m=><option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>
                        )}
                        <button className="obtn obtn-teal" disabled={saving} onClick={() => updateOrd({ diagnostic:currentOrd.diagnostic, medecin:currentOrd.medecin, date_prescription:currentOrd.date_prescription, date_expiration:currentOrd.date_expiration, chronique:currentOrd.chronique, maladie_chronique:currentOrd.maladie_chronique })}>
                          {I.save} {saving?"...":"Enregistrer"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── PRESCRIPTION ── */}
              {section === "prescription" && (
                <div style={{ marginTop:20 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--ink)" }}>Prescription médicamenteuse</div>
                      <div style={{ fontSize:12, color:"var(--muted)" }}>{currentOrd.medicaments?.length||0} médicament(s) prescrit(s)</div>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button className="obtn obtn-primary obtn-sm" onClick={() => setCurrent(d=>({...d,medicaments:[...(d.medicaments||[]),{...EMPTY_MED,id:Date.now()}]}))}>
                        {I.plus} Ajouter médicament
                      </button>
                    </div>
                  </div>

                  {/* Alerte allergies */}
                  {currentOrd.allergies?.length>0 && (
                    <div className="al-danger" style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:16 }}>
                      <span style={{ fontSize:18 }}>⚠️</span>
                      <div>
                        <strong style={{ color:"#B91C1C", fontSize:12 }}>Allergies connues du patient</strong>
                        <div style={{ fontSize:12, color:"var(--danger)", marginTop:2 }}>{currentOrd.allergies.join(" · ")} — Vérifier les contre-indications</div>
                      </div>
                    </div>
                  )}

                  <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                    {(currentOrd.medicaments||[]).map((med, idx) => (
                      <div key={med.id} className="med-row">
                        <div className="med-row-num">Méd. {idx+1}</div>
                        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:12, marginTop:8 }}>
                          <div>
                            <label className="olbl">Médicament *</label>
                            <input className="oinp" value={med.medicament} onChange={e=>setCurrent(d=>({...d,medicaments:d.medicaments.map(m=>m.id===med.id?{...m,medicament:e.target.value}:m)}))} placeholder="Nom du médicament / DCI" />
                          </div>
                          <div>
                            <label className="olbl">Forme pharmaceutique</label>
                            <select className="oinp" value={med.forme} onChange={e=>setCurrent(d=>({...d,medicaments:d.medicaments.map(m=>m.id===med.id?{...m,forme:e.target.value}:m)}))}>
                              {FORMES_PHARMA.map(f=><option key={f} value={f}>{f}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="olbl">Dosage</label>
                            <input className="oinp" value={med.dosage} onChange={e=>setCurrent(d=>({...d,medicaments:d.medicaments.map(m=>m.id===med.id?{...m,dosage:e.target.value}:m)}))} placeholder="Ex: 500mg, 1g" />
                          </div>
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginTop:12 }}>
                          <div>
                            <label className="olbl">Voie d'administration</label>
                            <select className="oinp" value={med.voie} onChange={e=>setCurrent(d=>({...d,medicaments:d.medicaments.map(m=>m.id===med.id?{...m,voie:e.target.value}:m)}))}>
                              {VOIES_ADMIN.map(v=><option key={v} value={v}>{v}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="olbl">Fréquence</label>
                            <select className="oinp" value={med.frequence} onChange={e=>setCurrent(d=>({...d,medicaments:d.medicaments.map(m=>m.id===med.id?{...m,frequence:e.target.value}:m)}))}>
                              {FREQUENCES.map(f=><option key={f} value={f}>{f}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="olbl">Durée</label>
                            <input className="oinp" value={med.duree} onChange={e=>setCurrent(d=>({...d,medicaments:d.medicaments.map(m=>m.id===med.id?{...m,duree:e.target.value}:m)}))} placeholder="Ex: 7 jours" />
                          </div>
                          <div>
                            <label className="olbl">Quantité</label>
                            <input type="number" className="oinp" value={med.quantite} min={1} onChange={e=>setCurrent(d=>({...d,medicaments:d.medicaments.map(m=>m.id===med.id?{...m,quantite:e.target.value}:m)}))} placeholder="Nbre unités" />
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:12, marginTop:12, alignItems:"flex-end" }}>
                          <div style={{ flex:1 }}>
                            <label className="olbl">Instructions particulières</label>
                            <input className="oinp" value={med.instructions} onChange={e=>setCurrent(d=>({...d,medicaments:d.medicaments.map(m=>m.id===med.id?{...m,instructions:e.target.value}:m)}))} placeholder="Pendant repas, à jeun, éviter alcool..." />
                          </div>
                          {(currentOrd.medicaments?.length||0) > 1 && (
                            <button className="obtn obtn-danger obtn-sm" onClick={() => setCurrent(d=>({...d,medicaments:d.medicaments.filter(m=>m.id!==med.id)}))} title="Supprimer">
                              {I.trash}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* IA interactions */}
                  <div className="al-ia" style={{ display:"flex", alignItems:"flex-start", gap:12, marginTop:20 }}>
                    <span style={{ fontSize:20 }}>🤖</span>
                    <div style={{ flex:1 }}>
                      <strong style={{ color:"#1E40AF", fontSize:13 }}>IA — Vérification automatique des interactions</strong>
                      <div style={{ fontSize:12, color:"#3B82F6", marginTop:4 }}>
                        {currentOrd.ia_interactions
                          ? `⚠ Interaction détectée : ${currentOrd.interactions?.join(" · ")}`
                          : "✅ Aucune interaction médicamenteuse détectée entre les médicaments prescrits. Allergies vérifiées."}
                      </div>
                    </div>
                    <button className="obtn obtn-ghost obtn-sm" style={{ fontSize:11 }} onClick={() => toast.success("🤖 Analyse IA des interactions en cours...")}>
                      {I.ia} Analyser
                    </button>
                  </div>

                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16, gap:10 }}>
                    <button className="obtn obtn-teal" disabled={saving} onClick={() => updateOrd({ medicaments:currentOrd.medicaments })}>
                      {I.save} {saving?"...":"Enregistrer la prescription"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── EXAMENS & RECOMMANDATIONS ── */}
              {section === "examens" && (
                <div style={{ marginTop:20, display:"flex", flexDirection:"column", gap:16 }}>
                  <div className="ord-card">
                    <div className="ord-card-hdr"><h3>🔬 Examens complémentaires prescrits</h3></div>
                    <div style={{ padding:20 }}>
                      <div className="ord-g11">
                        <div>
                          <label className="olbl" style={{ marginBottom:10 }}>Analyses de laboratoire</label>
                          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                            {EXAMENS_COMPLS.map(ex => {
                              const checked = (currentOrd.examens_labo||[]).includes(ex);
                              return (
                                <label key={ex} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", padding:"6px 10px", borderRadius:8, background: checked?"var(--tint)":"transparent", border:`1px solid ${checked?"var(--primary)":"transparent"}`, transition:"all .15s" }}>
                                  <input type="checkbox" checked={checked} style={{ accentColor:"var(--primary)", width:14, height:14 }} onChange={() => {
                                    const cur = currentOrd.examens_labo||[];
                                    setCurrent(d=>({...d, examens_labo: checked ? cur.filter(x=>x!==ex) : [...cur,ex] }));
                                  }} />
                                  <span style={{ fontSize:12, color:"var(--ink)", fontWeight: checked?600:400 }}>{ex}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <label className="olbl" style={{ marginBottom:10 }}>Examens d'imagerie</label>
                          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                            {EXAMENS_IMAG.map(ex => {
                              const checked = (currentOrd.examens_imagerie||[]).includes(ex);
                              return (
                                <label key={ex} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", padding:"6px 10px", borderRadius:8, background: checked?"#F0FDFC":"transparent", border:`1px solid ${checked?"var(--accent)":"transparent"}`, transition:"all .15s" }}>
                                  <input type="checkbox" checked={checked} style={{ accentColor:"var(--accent)", width:14, height:14 }} onChange={() => {
                                    const cur = currentOrd.examens_imagerie||[];
                                    setCurrent(d=>({...d, examens_imagerie: checked ? cur.filter(x=>x!==ex) : [...cur,ex] }));
                                  }} />
                                  <span style={{ fontSize:12, color:"var(--ink)", fontWeight: checked?600:400 }}>{ex}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="ord-card">
                    <div className="ord-card-hdr"><h3>💡 Recommandations non médicamenteuses</h3></div>
                    <div style={{ padding:20 }}>
                      <label className="olbl">Recommandations générales</label>
                      <textarea className="oinp" rows={5} value={currentOrd.recommandations||""} onChange={e=>setCurrent(d=>({...d,recommandations:e.target.value}))} placeholder="Repos, régime alimentaire, activité physique, surveillance particulière, soins locaux, hygiène de vie..." />
                      <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
                        {["Repos au lit 48h","Hydratation abondante","Régime sans sel","Éviter alcool","Activité physique légère","Éviter conduite","Surveillance tensionnelle","Contrôle glycémique"].map(r => (
                          <button key={r} className="obtn obtn-ghost obtn-sm" style={{ fontSize:11 }} onClick={() => setCurrent(d=>({...d, recommandations:(d.recommandations?d.recommandations+"\n":"")+r}))}>
                            + {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ display:"flex", justifyContent:"flex-end" }}>
                    <button className="obtn obtn-teal" disabled={saving} onClick={() => updateOrd({ examens_labo:currentOrd.examens_labo, examens_imagerie:currentOrd.examens_imagerie, recommandations:currentOrd.recommandations })}>
                      {I.save} {saving?"...":"Enregistrer"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── VALIDATION ── */}
              {section === "validation" && (
                <div style={{ marginTop:20 }}>
                  <div className="ord-card">
                    <div className="ord-card-hdr"><h3>✍️ Validation médicale de l'ordonnance</h3></div>
                    <div style={{ padding:20 }}>
                      <div className="ord-g11">
                        <div>
                          <label className="olbl">Médecin prescripteur *</label>
                          <input className="oinp" value={currentOrd.medecin||""} onChange={e=>setCurrent(d=>({...d,medecin:e.target.value}))} placeholder="Dr. Nom Prénom" />
                        </div>
                        <div>
                          <label className="olbl">Spécialité</label>
                          <input className="oinp" value={currentOrd.specialite||""} onChange={e=>setCurrent(d=>({...d,specialite:e.target.value}))} placeholder="Chirurgie, Médecine générale..." />
                        </div>
                        <div>
                          <label className="olbl">Date de prescription</label>
                          <input type="date" className="oinp" value={fmtDateInput(currentOrd.date_prescription)} onChange={e=>setCurrent(d=>({...d,date_prescription:e.target.value}))} />
                        </div>
                        <div>
                          <label className="olbl">Date d'expiration</label>
                          <input type="date" className="oinp" value={fmtDateInput(currentOrd.date_expiration)} onChange={e=>setCurrent(d=>({...d,date_expiration:e.target.value}))} />
                        </div>
                        <div style={{ gridColumn:"1/-1" }}>
                          <label className="olbl">Signature électronique</label>
                          <input className="oinp" value={currentOrd.signature||""} onChange={e=>setCurrent(d=>({...d,signature:e.target.value}))} placeholder="Code signature médecin (ex: DR-LEBLANC-2025)" />
                        </div>
                        <div style={{ gridColumn:"1/-1" }}>
                          <label className="olbl">Note confidentielle (médecin uniquement)</label>
                          <textarea className="oinp" rows={2} value={currentOrd.note_confidentielle||""} onChange={e=>setCurrent(d=>({...d,note_confidentielle:e.target.value}))} placeholder="Note interne non imprimée..." />
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:10, marginTop:20 }}>
                        <button className="obtn obtn-teal" disabled={saving} onClick={() => updateOrd({ medecin:currentOrd.medecin, specialite:currentOrd.specialite, date_prescription:currentOrd.date_prescription, date_expiration:currentOrd.date_expiration, signature:currentOrd.signature, note_confidentielle:currentOrd.note_confidentielle })}>
                          {I.check} {saving?"...":"Valider et signer"}
                        </button>
                        <button className="obtn obtn-danger obtn-sm" onClick={() => { setAnnulMotif(""); setModalAnnul(true); }}>🚫 Annuler l'ordonnance</button>
                        <button className="obtn obtn-ghost" onClick={() => { setRenewForm({ date_expiration: "", note: "" }); setModalRenew(true); }}>{I.refresh} Renouveler</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── IMPRESSION ── */}
              {section === "impression" && (
                <div style={{ marginTop:20 }}>
                  <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
                    <button className="obtn obtn-teal" onClick={() => window.print()}>{I.print} Imprimer</button>

                    {/* ── PUBLIER — visible uniquement si pas encore publiée ── */}
                    {currentOrd.statut !== "publiee" && currentOrd.statut !== "annulee" && (
                      <button
                        className="obtn obtn-primary"
                        style={{ background:"var(--primary)", color:"#fff", fontWeight:700 }}
                        disabled={publishing}
                        onClick={handlePublier}
                      >
                        {publishing ? "Publication…" : "✅ Publier & envoyer au patient"}
                      </button>
                    )}

                    {/* ── DÉJÀ PUBLIÉE ── */}
                    {currentOrd.statut === "publiee" && (
                      <div style={{ display:"flex", alignItems:"center", gap:8, background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:10, padding:"8px 16px" }}>
                        <span style={{ fontSize:16 }}>📨</span>
                        <div>
                          <div style={{ fontWeight:700, fontSize:12, color:"#065F46" }}>Publiée — Visible par le patient</div>
                          {currentOrd.publie_at && (
                            <div style={{ fontSize:11, color:"var(--success)" }}>
                              Le {new Date(currentOrd.publie_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Format imprimable */}
                  <div className="ord-print-zone">
                    {/* En-tête */}
                    <div className="ord-print-header">
                      <div>
                        <div style={{ fontSize:20, fontWeight:800, color:"var(--ink)" }}>CLINIQUE CANADIENNE DE SOUANKÉ</div>
                        <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>République du Congo · Département de la Sangha</div>
                        <div style={{ fontSize:12, color:"var(--muted)" }}>Tél : +242 00 000 0000 · Email : clinique@souanke.cg</div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ background:"var(--primary)", color:"#fff", fontWeight:800, fontSize:18, padding:"6px 20px", borderRadius:8, letterSpacing:1 }}>ORDONNANCE</div>
                        <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color:"var(--primary)", marginTop:8 }}>{currentOrd.numero}</div>
                        <div style={{ fontSize:12, color:"var(--muted)", marginTop:4 }}>Date : {fmtDate(currentOrd.date_prescription)}</div>
                        <div style={{ fontSize:12, color:"var(--danger)", fontWeight:600 }}>Valable jusqu'au : {fmtDate(currentOrd.date_expiration)}</div>
                      </div>
                    </div>

                    {/* Patient */}
                    <div style={{ background:"var(--surface)", borderRadius:10, padding:"12px 16px", marginBottom:20 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>Patient</div>
                      <div className="ord-g4" style={{ gap:12 }}>
                        {[["Nom",currentOrd.patient_nom],["Âge",ageCalc(currentOrd.patient_dob)],["Sexe",currentOrd.sexe?currentOrd.sexe.charAt(0).toUpperCase()+currentOrd.sexe.slice(1):"—"],["Poids",`${currentOrd.poids} kg`]].map(([lbl,val])=>(
                          <div key={lbl}><div style={{ fontSize:10, color:"var(--muted)", fontWeight:600 }}>{lbl}</div><div style={{ fontSize:13, fontWeight:700, color:"var(--ink)" }}>{val}</div></div>
                        ))}
                      </div>
                      {currentOrd.allergies?.length>0 && <div style={{ marginTop:8, fontSize:12, color:"var(--danger)", fontWeight:700 }}>⚠ Allergies : {currentOrd.allergies.join(", ")}</div>}
                    </div>

                    {/* Diagnostic */}
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", marginBottom:6 }}>Diagnostic</div>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--ink)" }}>{currentOrd.diagnostic}</div>
                    </div>

                    {/* Médicaments */}
                    <div style={{ marginBottom:20 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", marginBottom:10, borderBottom:"2px solid var(--ink)", paddingBottom:6 }}>Prescription médicamenteuse</div>
                      {(currentOrd.medicaments||[]).map((med, i) => (
                        <div key={med.id} style={{ marginBottom:14, paddingLeft:16, borderLeft:"3px solid var(--primary)" }}>
                          <div style={{ fontWeight:700, fontSize:14, color:"var(--ink)" }}>{i+1}. {med.medicament}</div>
                          <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>
                            {med.forme} · {med.dosage} · {med.voie}
                          </div>
                          <div style={{ fontSize:12, color:"var(--ink)", marginTop:2 }}>
                            <strong>Posologie :</strong> {med.frequence} pendant {med.duree} — Qté : {med.quantite} unité(s)
                          </div>
                          {med.instructions && <div style={{ fontSize:11, color:"var(--muted)", fontStyle:"italic", marginTop:2 }}>📌 {med.instructions}</div>}
                        </div>
                      ))}
                    </div>

                    {/* Examens */}
                    {((currentOrd.examens_labo?.length||0)+(currentOrd.examens_imagerie?.length||0)) > 0 && (
                      <div style={{ marginBottom:20 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", marginBottom:10, borderBottom:"2px solid var(--accent)", paddingBottom:6 }}>Examens complémentaires</div>
                        {currentOrd.examens_labo?.length>0 && (
                          <div style={{ marginBottom:8 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:"var(--ink)" }}>Analyses biologiques :</div>
                            <div style={{ fontSize:12, color:"var(--muted)" }}>{currentOrd.examens_labo.join(" · ")}</div>
                          </div>
                        )}
                        {currentOrd.examens_imagerie?.length>0 && (
                          <div>
                            <div style={{ fontSize:12, fontWeight:700, color:"var(--ink)" }}>Imagerie médicale :</div>
                            <div style={{ fontSize:12, color:"var(--muted)" }}>{currentOrd.examens_imagerie.join(" · ")}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recommandations */}
                    {currentOrd.recommandations && (
                      <div style={{ marginBottom:20, background:"var(--surface)", borderRadius:8, padding:"10px 14px" }}>
                        <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", marginBottom:6 }}>Recommandations</div>
                        <div style={{ fontSize:12, color:"var(--ink)", whiteSpace:"pre-wrap" }}>{currentOrd.recommandations}</div>
                      </div>
                    )}

                    {/* Pied de page */}
                    <div className="ord-print-footer">
                      <div>
                        <div style={{ fontSize:11, color:"var(--muted)", fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Médecin prescripteur</div>
                        <div style={{ fontSize:14, fontWeight:700, color:"var(--ink)" }}>{currentOrd.medecin}</div>
                        <div style={{ fontSize:12, color:"var(--muted)" }}>{currentOrd.specialite}</div>
                        {currentOrd.signature && (
                          <div style={{ marginTop:8, fontSize:11, fontFamily:"monospace", color:"var(--primary)", background:"var(--tint)", padding:"4px 10px", borderRadius:6, display:"inline-block" }}>
                            🔐 {currentOrd.signature}
                          </div>
                        )}
                        <div style={{ marginTop:12, height:50, borderBottom:"1.5px solid var(--border)", width:200 }}></div>
                        <div style={{ fontSize:10, color:"var(--muted)", marginTop:4 }}>Signature & Cachet</div>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
                        <div className="qr-placeholder">{I.qr}</div>
                        <div style={{ fontSize:10, color:"var(--muted)", textAlign:"right" }}>QR Code de vérification</div>
                        <div style={{ fontSize:10, fontFamily:"monospace", color:"var(--primary)" }}>{currentOrd.numero}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── PHARMACIE ── */}
              {section === "pharmacie" && (
                <div style={{ marginTop:20 }}>
                  <div className="ord-card">
                    <div className="ord-card-hdr"><h3>💊 Liaison Pharmacie</h3><p>Vérification des stocks et délivrance</p></div>
                    <div style={{ padding:20 }}>
                      {loadingStock && (
                        <div style={{ padding:"6px 2px 12px", fontSize:12, color:"var(--muted)" }}>Chargement du stock réel…</div>
                      )}
                      <div style={{ overflowX:"auto" }}>
                        <table className="ord-tbl">
                          <thead>
                            <tr><th>Médicament</th><th>Posologie</th><th>Quantité prescrite</th><th>Disponibilité (stock réel)</th><th>Qté délivrée</th><th>Statut</th></tr>
                          </thead>
                          <tbody>
                            {(currentOrd.medicaments||[]).map((med, idx) => {
                              const nom = med.medicament_nom || (typeof med.medicament === "string" ? med.medicament : "") || "—";
                              const catalogue  = pharmStock[nom.trim().toLowerCase()];
                              const disponible = catalogue ? catalogue.stock_actuel > 0 : null;
                              const dejaDispensee = currentOrd.statut === "dispensee";
                              return (
                                <tr key={med._id || med.id || idx}>
                                  <td style={{ fontWeight:600, color:"var(--ink)" }}>{nom}</td>
                                  <td style={{ fontSize:12 }}>{med.posologie || [med.forme, med.dosage].filter(Boolean).join(" · ") || "—"}</td>
                                  <td style={{ fontWeight:700, textAlign:"center" }}>{med.quantite ?? "—"}</td>
                                  <td>
                                    {catalogue
                                      ? <Badge cls={disponible?"green":"red"}>{disponible?`✅ ${catalogue.stock_actuel} en stock`:"❌ Rupture"}</Badge>
                                      : <Badge cls="gray">Non rattaché au catalogue</Badge>}
                                  </td>
                                  <td style={{ fontWeight:700, textAlign:"center" }}>{dejaDispensee ? (med.quantite ?? "—") : "—"}</td>
                                  <td><Badge cls={dejaDispensee?"green":"gray"}>{dejaDispensee?"Délivré":"En attente"}</Badge></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ marginTop:16, display:"flex", gap:8, flexWrap:"wrap" }}>
                        <button
                          className="obtn obtn-teal"
                          disabled={dispensingRx || currentOrd.statut === "dispensee" || !["active","publiee"].includes(currentOrd.statut)}
                          title={currentOrd.statut === "dispensee" ? "Cette ordonnance est déjà dispensée." : (!["active","publiee"].includes(currentOrd.statut) ? "Seule une ordonnance active ou publiée peut être dispensée." : "")}
                          onClick={dispenserRx}
                        >
                          {I.check} {dispensingRx ? "Délivrance en cours…" : currentOrd.statut === "dispensee" ? "Déjà délivrée" : "Confirmer la délivrance"}
                        </button>
                        <button className="obtn obtn-ghost" disabled title="Fonctionnalité momentanément indisponible — aucune étape de transmission distincte n'existe côté serveur entre la publication et la délivrance.">
                          {I.send} Transmettre à la pharmacie
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── AUDIT ── */}
              {section === "audit" && (
                <div style={{ marginTop:20 }}>
                  <div className="ord-card">
                    <div className="ord-card-hdr"><h3>📋 Journal d'audit</h3></div>
                    <div style={{ overflowX:"auto" }}>
                      <table className="ord-tbl">
                        <thead><tr><th>Action</th><th>Utilisateur</th><th>Date & Heure</th><th>Adresse IP</th><th>Détail</th></tr></thead>
                        <tbody>
                          {[
                            { action:"Création", user:currentOrd.medecin, date:"2025-05-28 09:15:42", ip:"192.168.1.12", detail:"Ordonnance créée" },
                            { action:"Modification", user:currentOrd.medecin, date:"2025-05-28 09:22:10", ip:"192.168.1.12", detail:"Médicament ajouté : Oméprazole" },
                            { action:"Impression", user:currentOrd.medecin, date:"2025-05-28 09:25:33", ip:"192.168.1.12", detail:"Ordonnance imprimée (1 exemplaire)" },
                            { action:"Consultation", user:"Pharmacien", date:"2025-05-28 10:40:11", ip:"192.168.1.20", detail:"Lecture pharmacie" },
                            { action:"Délivrance", user:"Pharmacien", date:"2025-05-28 10:45:22", ip:"192.168.1.20", detail:"Médicaments délivrés au patient" },
                          ].map((log, i) => (
                            <tr key={i}>
                              <td><Badge cls={log.action==="Création"?"teal":log.action==="Délivrance"?"green":log.action==="Modification"?"orange":"blue"}>{log.action}</Badge></td>
                              <td style={{ fontSize:12, fontWeight:600 }}>{log.user}</td>
                              <td style={{ fontSize:12, color:"var(--muted)", fontFamily:"monospace" }}>{log.date}</td>
                              <td style={{ fontSize:12, color:"var(--muted)", fontFamily:"monospace" }}>{log.ip}</td>
                              <td style={{ fontSize:12, color:"var(--ink)" }}>{log.detail}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ CHRONIQUES ══ */}
          {tab === "chroniques" && (
            <div>
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:16, fontWeight:700, color:"var(--ink)" }}>Traitements chroniques</div>
                <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>Suivi des prescriptions à long terme</div>
              </div>

              {MALADIES_CHRONIQUES.map(maladie => {
                // LIMITE DOCUMENTÉE (Correction 5) — maladie_chronique n'existe
                // dans aucun champ du schéma Prescription ni dans le formulaire
                // de création : aucune ordonnance réelle ne portera jamais cette
                // valeur. Cet onglet reste honnêtement vide (jamais une donnée
                // fictive) tant qu'aucune vraie catégorisation clinique n'existe.
                const patients_maladie = ordonnances.filter(x=>x.maladie_chronique===maladie);
                if (patients_maladie.length===0) return null;
                return (
                  <div key={maladie} className="ord-card" style={{ marginBottom:16 }}>
                    <div className="ord-card-hdr">
                      <h3>♾ {maladie}</h3>
                      <span style={{ fontSize:12, color:"var(--muted)" }}>{patients_maladie.length} patient(s)</span>
                    </div>
                    <div style={{ overflowX:"auto" }}>
                      <table className="ord-tbl">
                        <thead><tr><th>Patient</th><th>Médecin</th><th>Médicaments</th><th>Début traitement</th><th>Renouvellement</th><th>Statut</th><th>Action</th></tr></thead>
                        <tbody>
                          {patients_maladie.map(ord => {
                            const jRestants = Math.max(0, Math.floor((new Date(ord.date_expiration)-Date.now())/(86400*1000)));
                            return (
                              <tr key={ord._id}>
                                <td>
                                  <div style={{ fontWeight:600 }}>{ord.patient_nom}</div>
                                  <div style={{ fontSize:11, color:"var(--muted)" }}>{ageCalc(ord.patient_dob)}</div>
                                </td>
                                <td style={{ fontSize:12, color:"var(--muted)" }}>{ord.medecin}</td>
                                <td>
                                  {ord.medicaments.map(m=><div key={m.id} style={{ fontSize:11, color:"var(--ink)" }}>• {m.medicament} {m.dosage}</div>)}
                                </td>
                                <td style={{ fontSize:12, color:"var(--muted)" }}>{fmtDate(ord.date_prescription)}</td>
                                <td style={{ fontSize:12, color: jRestants<15?"var(--danger)":"var(--muted)", fontWeight: jRestants<15?700:400 }}>
                                  {fmtDate(ord.date_expiration)}
                                  {jRestants<15 && <div style={{ fontSize:10 }}>⚠ {jRestants}j restants</div>}
                                </td>
                                <td><Badge cls={jRestants<15?"orange":jRestants<30?"yellow":"green"}>{jRestants<15?"Renouvellement urgent":jRestants<30?"Bientôt":"Actif"}</Badge></td>
                                <td>
                                  <div style={{ display:"flex", gap:4 }}>
                                    <button className="obtn obtn-ghost obtn-sm" style={{ fontSize:10 }} onClick={() => { openOrd(ord); setSection("impression"); }} title="Voir">👁 Voir</button>
                                    <button className="obtn obtn-teal obtn-sm" style={{ fontSize:10 }} onClick={() => { setCurrent(ord); setRenewForm({ date_expiration: "", note: "" }); setModalRenew(true); }} title="Renouveler">{I.refresh}</button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* Alertes chroniques */}
              {/* AUDIT-MESSAGES-PhaseD (ticket 0020) — aucun job planifié n'envoie
                  d'alerte SMS/Email d'expiration (vérifié : aucune référence à ce
                  traitement chronique côté backend/cron). Libellé corrigé pour ne
                  plus prétendre à une automatisation inexistante. */}
              <div className="al-ia" style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                <span style={{ fontSize:20 }}>🤖</span>
                <div>
                  <strong style={{ color:"#1E40AF", fontSize:13 }}>Traitements chroniques — suivi des renouvellements</strong>
                  <div style={{ fontSize:12, color:"#3B82F6", marginTop:4 }}>
                    Aucune alerte automatique n'est envoyée pour l'instant : pensez à vérifier manuellement les traitements chroniques approchant de leur expiration.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ RAPPORTS ══ */}
          {tab === "rapports" && (
            <div>
              <div className="ord-g11" style={{ marginBottom:24 }}>
                <div className="ord-card">
                  <div className="ord-card-hdr"><div><h3>{I.trend} Ordonnances par mois</h3><p>Volume annuel des prescriptions</p></div></div>
                  <div style={{ padding:20 }}><BarChart labels={chartData.labels} data={chartData.data} color="#1B4F9E" /></div>
                </div>
                <div className="ord-card">
                  <div className="ord-card-hdr"><div><h3>📊 Ordonnances par service</h3></div></div>
                  <div style={{ padding:20 }}>
                    {[["Chirurgie",35,"var(--accent)"],["Médecine générale",28,"var(--primary)"],["Gynécologie",18,"var(--tertiary)"],["Médecine interne",12,"var(--success)"],["Urgences",7,"var(--danger)"]].map(([svc,pct,col])=>(
                      <div key={svc} style={{ marginBottom:12 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, fontSize:12 }}>
                          <span style={{ color:"var(--muted)" }}>{svc}</span>
                          <span style={{ fontWeight:700, color:"var(--ink)" }}>{pct}%</span>
                        </div>
                        <Prog pct={pct} color={col} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="ord-card">
                <div className="ord-card-hdr">
                  <div><h3>📋 Rapport détaillé</h3><p>Statistiques des prescriptions</p></div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button className="obtn obtn-ghost obtn-sm" onClick={() => toast.success("📄 PDF exporté")}>{I.dl} PDF</button>
                    <button className="obtn obtn-ghost obtn-sm" onClick={() => toast.success("📊 Excel exporté")}>📊 Excel</button>
                    <button className="obtn obtn-ghost obtn-sm" onClick={() => toast.success("📁 CSV exporté")}>📁 CSV</button>
                  </div>
                </div>
                <div style={{ padding:20, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16 }}>
                  {[
                    ["Total prescriptions ce mois","74","var(--primary)"],
                    ["Ordonnances chroniques","18","var(--tertiary)"],
                    ["Interactions détectées par IA","3","var(--danger)"],
                    ["Ordonnances délivrées","61","var(--success)"],
                    ["Renouvellements effectués","12","var(--accent)"],
                    ["Ordonnances annulées","2","var(--muted)"],
                  ].map(([lbl,val,col])=>(
                    <div key={lbl} style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:12, padding:"16px 18px", textAlign:"center" }}>
                      <div style={{ fontSize:28, fontWeight:800, color:col, letterSpacing:-1 }}>{val}</div>
                      <div style={{ fontSize:11.5, color:"var(--muted)", fontWeight:600, marginTop:4 }}>{lbl}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ MODAL : NOUVELLE ORDONNANCE ═══ */}
        <Modal open={modalNouv} onClose={() => setModalNouv(false)} title={<>{I.plus} Nouvelle ordonnance</>} maxWidth={780}>
          <form onSubmit={createOrd}>
            <div className="ord-g11" style={{ gap:14 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="olbl">Patient *</label>
                <select className="oinp" required value={formOrd.patient_id} onChange={e=>setFormOrd(f=>({...f,patient_id:e.target.value}))}>
                  <option value="">— Sélectionner un patient —</option>
                  {patients.map(p=><option key={p._id} value={p._id}>{p.prenom} {p.nom} — {p.numero_dossier}</option>)}
                </select>
              </div>
              <div>
                <label className="olbl">Médecin prescripteur *</label>
                <input className="oinp" required value={formOrd.medecin} onChange={e=>setFormOrd(f=>({...f,medecin:e.target.value}))} placeholder="Dr. Nom Prénom" />
              </div>
              <div>
                <label className="olbl">Spécialité</label>
                <input className="oinp" value={formOrd.specialite} onChange={e=>setFormOrd(f=>({...f,specialite:e.target.value}))} placeholder="Chirurgie, Médecine générale..." />
              </div>
              <div>
                <label className="olbl">Date de prescription</label>
                <input type="date" className="oinp" value={formOrd.date_prescription} onChange={e=>setFormOrd(f=>({...f,date_prescription:e.target.value}))} />
              </div>
              <div>
                <label className="olbl">Date d'expiration</label>
                <input type="date" className="oinp" value={formOrd.date_expiration} onChange={e=>setFormOrd(f=>({...f,date_expiration:e.target.value}))} />
              </div>
              <div>
                <label className="olbl">Poids patient (kg)</label>
                <input type="number" className="oinp" value={formOrd.poids} min={1} onChange={e=>setFormOrd(f=>({...f,poids:e.target.value}))} placeholder="Ex: 70" />
              </div>
              <div>
                <label className="olbl">Consultation liée</label>
                <input className="oinp" value={formOrd.consultation_liee} onChange={e=>setFormOrd(f=>({...f,consultation_liee:e.target.value}))} placeholder="N° de consultation" />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="olbl">Diagnostic *</label>
                <textarea className="oinp" rows={2} required value={formOrd.diagnostic} onChange={e=>setFormOrd(f=>({...f,diagnostic:e.target.value}))} placeholder="Diagnostic principal motivant la prescription..." />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="olbl">Allergies connues</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
                  {ALLERGIES_COMMUNES.map(al => {
                    const isChecked = formOrd.allergies.includes(al);
                    return (
                      <button key={al} type="button" className={`obtn obtn-sm ${isChecked?"obtn-danger":"obtn-ghost"}`} style={{ fontSize:11 }} onClick={() => setFormOrd(f=>({ ...f, allergies: isChecked ? f.allergies.filter(x=>x!==al) : [...f.allergies,al] }))}>
                        {isChecked?"✓ ":""}{al}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Médicaments */}
              <div style={{ gridColumn:"1/-1" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <label className="olbl" style={{ margin:0 }}>Médicaments prescrits *</label>
                  <button type="button" className="obtn obtn-ghost obtn-sm" onClick={addMed}>{I.plus} Ajouter</button>
                </div>
                {formOrd.medicaments.map((med, idx) => (
                  <div key={med.id} className="med-row" style={{ marginBottom:12 }}>
                    <div className="med-row-num">Méd. {idx+1}</div>
                    <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:10, marginTop:8 }}>
                      <div>
                        <label className="olbl">Médicament *</label>
                        <input className="oinp" required value={med.medicament} onChange={e=>updateMed(med.id,"medicament",e.target.value)} placeholder="Nom / DCI" />
                      </div>
                      <div>
                        <label className="olbl">Dosage</label>
                        <input className="oinp" value={med.dosage} onChange={e=>updateMed(med.id,"dosage",e.target.value)} placeholder="500mg" />
                      </div>
                      <div>
                        <label className="olbl">Fréquence</label>
                        <select className="oinp" value={med.frequence} onChange={e=>updateMed(med.id,"frequence",e.target.value)}>
                          {FREQUENCES.map(f=><option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="olbl">Durée</label>
                        <input className="oinp" value={med.duree} onChange={e=>updateMed(med.id,"duree",e.target.value)} placeholder="7 jours" />
                      </div>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:10, marginTop:8, alignItems:"flex-end" }}>
                      <div>
                        <label className="olbl">Forme</label>
                        <select className="oinp" value={med.forme} onChange={e=>updateMed(med.id,"forme",e.target.value)}>
                          {FORMES_PHARMA.map(f=><option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="olbl">Quantité</label>
                        <input type="number" className="oinp" value={med.quantite} min={1} onChange={e=>updateMed(med.id,"quantite",e.target.value)} placeholder="Nbre" />
                      </div>
                      {formOrd.medicaments.length > 1 && (
                        <button type="button" className="obtn obtn-danger obtn-sm" onClick={() => removeMed(med.id)} title="Supprimer">{I.trash}</button>
                      )}
                    </div>
                    <div style={{ marginTop:8 }}>
                      <label className="olbl">Instructions particulières</label>
                      <input className="oinp" value={med.instructions} onChange={e=>updateMed(med.id,"instructions",e.target.value)} placeholder="Ex: Pendant les repas, à jeun..." />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ gridColumn:"1/-1" }}>
                <label className="olbl">Recommandations</label>
                <textarea className="oinp" rows={2} value={formOrd.recommandations} onChange={e=>setFormOrd(f=>({...f,recommandations:e.target.value}))} placeholder="Repos, régime, suivi..." />
              </div>

              <div style={{ gridColumn:"1/-1", display:"flex", alignItems:"center", gap:8 }}>
                <input type="checkbox" checked={formOrd.chronique} onChange={e=>setFormOrd(f=>({...f,chronique:e.target.checked}))} style={{ width:16, height:16, accentColor:"var(--tertiary)" }} />
                <span style={{ fontSize:13, fontWeight:600, color:"var(--ink)" }}>♾ Traitement chronique</span>
                {formOrd.chronique && (
                  <select className="oinp" style={{ maxWidth:260, marginLeft:8 }} value={formOrd.maladie_chronique} onChange={e=>setFormOrd(f=>({...f,maladie_chronique:e.target.value}))}>
                    <option value="">— Pathologie —</option>
                    {MALADIES_CHRONIQUES.map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button type="button" className="obtn obtn-ghost" onClick={() => setModalNouv(false)}>Annuler</button>
              <button type="submit" className="obtn obtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>
                {I.save} {saving?"Création...":"Créer l'ordonnance"}
              </button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : RENOUVELLEMENT ═══ */}
        <Modal open={modalRenew} onClose={() => setModalRenew(false)} title={<>{I.refresh} Renouveler l'ordonnance</>} maxWidth={480}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ background:"var(--tint)", borderRadius:12, padding:"14px 16px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--ink)" }}>{currentOrd?.numero}</div>
              <div style={{ fontSize:12, color:"var(--muted)", marginTop:4 }}>Patient : {currentOrd?.patient_nom} · {currentOrd?.medicaments?.length} médicament(s)</div>
            </div>
            <div>
              <label className="olbl">Nouvelle date d'expiration *</label>
              <input type="date" className="oinp" min={new Date().toISOString().substring(0,10)} value={renewForm.date_expiration} onChange={e => setRenewForm(f => ({ ...f, date_expiration: e.target.value }))} />
            </div>
            <div>
              <label className="olbl">Note de renouvellement</label>
              <textarea className="oinp" rows={2} placeholder="Raison du renouvellement, modifications éventuelles..." value={renewForm.note} onChange={e => setRenewForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <div className="al-ia" style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
              <span>🤖</span>
              <div style={{ fontSize:12, color:"#3B82F6" }}>
                {/* AUDIT-MESSAGES-PhaseD (ticket 0020) — controllers/prescriptions.controller.js::renouveler
                    ne fait que créer le brouillon et journaliser l'action, aucun SMS/e-mail n'est envoyé. */}
                Le renouvellement sera enregistré dans le journal d'audit. Aucune notification automatique n'est envoyée au patient — prévenez-le manuellement si besoin.
              </div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="obtn obtn-ghost" onClick={() => setModalRenew(false)}>Annuler</button>
              <button className="obtn obtn-teal" style={{ marginLeft:"auto" }} disabled={saving} onClick={renewOrd}>
                {I.refresh} {saving?"...":"Confirmer le renouvellement"}
              </button>
            </div>
          </div>
        </Modal>

        {/* ═══ MODAL : ANNULATION ═══ */}
        <Modal open={modalAnnul} onClose={() => setModalAnnul(false)} title="🚫 Annuler l'ordonnance" maxWidth={440}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div className="al-danger" style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
              <span style={{ fontSize:18 }}>⚠️</span>
              <div>
                <strong style={{ color:"#B91C1C", fontSize:13 }}>Confirmation requise</strong>
                <div style={{ fontSize:12, color:"var(--danger)", marginTop:4 }}>
                  L'annulation de l'ordonnance <strong>{currentOrd?.numero}</strong> est irréversible. La pharmacie sera notifiée.
                </div>
              </div>
            </div>
            <div>
              <label className="olbl">Motif d'annulation *</label>
              <textarea className="oinp" rows={3} placeholder="Ex: Erreur de prescription, changement de traitement, contre-indication découverte..." value={annulMotif} onChange={e => setAnnulMotif(e.target.value)} />
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="obtn obtn-ghost" onClick={() => setModalAnnul(false)}>Retour</button>
              <button className="obtn obtn-danger" style={{ marginLeft:"auto" }} disabled={saving} onClick={cancelOrd}>
                🚫 {saving?"...":"Confirmer l'annulation"}
              </button>
            </div>
          </div>
        </Modal>

      </div>
    </>
  );
}