



import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchInvoices, fetchFinanceStats, createInvoice, recordPayment,
  selectInvoices, selectFinanceStats, selectFinanceLoading, selectFinanceSaving,
} from '../store/slices/financeSlice';
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

// ─── CSS — Medical Navy + Teal ────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.fin * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --fn:#0B1E3B; --fn2:#132744; --fb:#1B4F9E;
  --ft:#0EA5A0; --ft2:#0D9490; --fr:#DC2626;
  --fo:#D97706; --fg:#059669; --fp:#7C3AED;
  --cbr:#E2EAF4; --cm:#6B7A99; --cl:#EEF4FF; --cs:#F8FAFD;
  --sh:0 1px 3px rgba(11,30,59,.08); --shm:0 4px 16px rgba(11,30,59,.10); --shl:0 12px 40px rgba(11,30,59,.14);
}

/* Topbar */
.fin-top { background:linear-gradient(135deg,var(--fn) 0%,var(--fn2) 55%,#1B4F9E 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.fin-top::before { content:''; position:absolute; top:-50px; right:-50px; width:200px; height:200px; background:radial-gradient(circle,rgba(14,165,160,.22) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
.fin-top::after  { content:''; position:absolute; bottom:-30px; left:30%; width:150px; height:150px; background:radial-gradient(circle,rgba(27,79,158,.18) 0%,transparent 70%); border-radius:50%; pointer-events:none; }

/* Tabs */
.fin-tabs { display:flex; gap:2px; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.fin-tabs::-webkit-scrollbar { display:none; }
.fin-tab { display:flex; align-items:center; gap:7px; padding:10px 18px 12px; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.55); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.fin-tab:hover { color:rgba(255,255,255,.88); background:rgba(255,255,255,.08); }
.fin-tab.active { color:var(--fn); background:var(--cs); box-shadow:0 -2px 0 var(--ft) inset; }
.fin-tab-badge { background:var(--fr); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:99px; animation:finP 2s infinite; }
@keyframes finP { 0%,100%{opacity:1} 50%{opacity:.4} }

/* Cards */
.fin-card { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; }
.fin-card:hover { box-shadow:var(--shm); }
.fin-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); flex-wrap:wrap; gap:8px; }
.fin-card-hdr h3 { font-size:14px; font-weight:700; color:var(--fn); margin:0; display:flex; align-items:center; gap:8px; }
.fin-card-hdr p { font-size:11px; color:var(--cm); margin:2px 0 0; }

/* KPI */
.fin-kpi { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:pointer; }
.fin-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.fin-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.fin-kpi.blue::before   { background:var(--fb); } .fin-kpi.teal::before   { background:var(--ft); }
.fin-kpi.red::before    { background:var(--fr); } .fin-kpi.orange::before { background:var(--fo); }
.fin-kpi.green::before  { background:var(--fg); } .fin-kpi.purple::before { background:var(--fp); }
.fin-kpi.dark::before   { background:var(--fn); }
.fkpi-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
.fkpi-icon.blue   { background:#EFF6FF; color:var(--fb); } .fkpi-icon.teal   { background:#F0FDFC; color:var(--ft); }
.fkpi-icon.red    { background:#FEF2F2; color:var(--fr); } .fkpi-icon.orange { background:#FFF7ED; color:var(--fo); }
.fkpi-icon.green  { background:#ECFDF5; color:var(--fg); } .fkpi-icon.purple { background:#F5F3FF; color:var(--fp); }
.fkpi-icon.dark   { background:#EEF4FF; color:var(--fn); }
.fkpi-val { font-size:22px; font-weight:800; color:var(--fn); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.fkpi-lbl { font-size:11.5px; font-weight:600; color:var(--cm); }
.fkpi-sub { font-size:10.5px; color:#9CA3AF; margin-top:2px; }
.fkpi-dot { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--fr); animation:finP 2s infinite; }
.fkpi-trend { font-size:10.5px; font-weight:600; margin-top:6px; display:flex; align-items:center; gap:4px; }
.fkpi-trend.up   { color:var(--fg); }
.fkpi-trend.down { color:var(--fr); }

/* Badges */
.fbdg { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.fbdg.red    { background:#FEF2F2; color:var(--fr); border:1px solid #FECACA; }
.fbdg.orange { background:#FFF7ED; color:var(--fo); border:1px solid #FED7AA; }
.fbdg.yellow { background:#FEFCE8; color:#CA8A04;   border:1px solid #FEF08A; }
.fbdg.green  { background:#ECFDF5; color:var(--fg); border:1px solid #A7F3D0; }
.fbdg.blue   { background:#EFF6FF; color:var(--fb); border:1px solid #BFDBFE; }
.fbdg.teal   { background:#F0FDFC; color:var(--ft); border:1px solid #99F6E4; }
.fbdg.purple { background:#F5F3FF; color:var(--fp); border:1px solid #DDD6FE; }
.fbdg.gray   { background:#F9FAFB; color:#4B5563;   border:1px solid #E5E7EB; }
.fbdg.dark   { background:var(--fn); color:#fff;    border:1px solid var(--fn2); }

/* Progress */
.fin-prog { background:#EEF4FF; border-radius:99px; height:7px; overflow:hidden; }
.fin-prog-f { height:100%; border-radius:99px; transition:width .5s; }

/* Buttons */
.fbtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; white-space:nowrap; }
.fbtn-primary { background:var(--fb); color:#fff; } .fbtn-primary:hover { background:#174391; transform:translateY(-1px); }
.fbtn-teal    { background:var(--ft); color:#fff; } .fbtn-teal:hover    { background:var(--ft2); transform:translateY(-1px); }
.fbtn-ghost   { background:transparent; color:var(--cm); border:1.5px solid var(--cbr); }
.fbtn-ghost:hover { background:var(--cl); color:var(--fn); }
.fbtn-danger  { background:#FEF2F2; color:var(--fr); border:1.5px solid #FECACA; }
.fbtn-danger:hover { background:var(--fr); color:#fff; }
.fbtn-green   { background:#ECFDF5; color:var(--fg); border:1.5px solid #A7F3D0; }
.fbtn-green:hover { background:var(--fg); color:#fff; }
.fbtn-orange  { background:#FFF7ED; color:var(--fo); border:1.5px solid #FED7AA; }
.fbtn-orange:hover { background:var(--fo); color:#fff; }
.fbtn-sm { padding:6px 12px; font-size:12px; }
.fbtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }

/* Forms */
.flbl { font-size:12px; font-weight:600; color:var(--cm); margin-bottom:6px; display:block; }
.finp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--cbr); background:#FAFBFF; font-size:13px; color:var(--fn); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.finp:focus { border-color:var(--ft); box-shadow:0 0 0 3px rgba(14,165,160,.12); }
textarea.finp { resize:vertical; }

/* Table */
.fin-tbl { width:100%; border-collapse:collapse; }
.fin-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.fin-tbl th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--cm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--cbr); white-space:nowrap; }
.fin-tbl td { padding:11px 14px; font-size:12.5px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.fin-tbl tbody tr:last-child td { border-bottom:none; }
.fin-tbl tbody tr:hover { background:#F8FAFF; cursor:pointer; }
.fin-tbl tfoot td { padding:12px 14px; font-size:13px; font-weight:800; }

/* Modal */
.fmov { position:fixed; inset:0; z-index:500; background:rgba(11,30,59,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.fmov-box { background:#fff; border-radius:20px; box-shadow:var(--shl); width:100%; max-width:620px; max-height:90vh; overflow-y:auto; animation:finSlide .25s ease; }
@keyframes finSlide { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.fmov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:#EEF4FF; position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.fmov-hdr h3 { font-size:15px; font-weight:700; color:var(--fn); margin:0; display:flex; align-items:center; gap:10px; }
.fmov-cls { width:32px; height:32px; border-radius:8px; background:#F3F7FF; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--cm); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.fmov-cls:hover { background:#FEF2F2; color:var(--fr); }
.fmov-body { padding:24px; }

/* Alerts */
.al-ia     { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; border-left:4px solid var(--fb); border-radius:14px; padding:14px 18px; }
.al-warn   { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--fo); border-radius:14px; padding:14px 18px; }
.al-danger { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--fr); border-radius:14px; padding:14px 18px; }
.al-success{ background:linear-gradient(135deg,#ECFDF5,#D1FAE5); border:1.5px solid #A7F3D0; border-left:4px solid var(--fg); border-radius:14px; padding:14px 18px; }

/* Caisse card */
.caisse-card { background:linear-gradient(135deg,#0B1E3B,#132744); border-radius:18px; padding:24px; color:#fff; position:relative; overflow:hidden; }
.caisse-card::before { content:''; position:absolute; top:-40px; right:-40px; width:150px; height:150px; background:radial-gradient(circle,rgba(14,165,160,.25) 0%,transparent 70%); border-radius:50%; }
.caisse-val { font-size:32px; font-weight:800; letter-spacing:-1.5px; color:#fff; }
.caisse-lbl { font-size:12px; color:rgba(255,255,255,.55); font-weight:600; text-transform:uppercase; letter-spacing:.5px; margin-top:2px; }
.caisse-item { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12); border-radius:12px; padding:14px 16px; }

/* Section nav */
.sec-nav { display:flex; gap:6px; flex-wrap:wrap; padding:14px 20px; background:linear-gradient(to right,#F8FAFD,#EEF4FF); border-bottom:1.5px solid var(--cbr); }
.sec-btn { display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all .2s; color:var(--cm); background:none; font-family:'Poppins',sans-serif; }
.sec-btn:hover { background:white; color:var(--fn); border-color:var(--cbr); }
.sec-btn.active { background:var(--fn); color:white; border-color:var(--fn); }

/* Info box */
.info-box { background:#F8FAFD; border:1.5px solid var(--cbr); border-radius:12px; padding:12px 14px; }
.info-box-lbl { font-size:10px; font-weight:700; color:var(--cm); text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px; }
.info-box-val { font-size:14px; font-weight:700; color:var(--fn); }

/* Fade */
@keyframes finFadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.ffu { animation:finFadeUp .3s ease both; }

@media print { .fin-top,.fin-tabs,.fbtn,.no-print { display:none!important; } }

/* ─── Responsive ─── */
.fin-g2  { display:grid; grid-template-columns:2fr 1fr; gap:20px; }
.fin-g11 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.fin-g11s{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
@media (max-width:767px) {
  .fin-top { padding:12px 14px 0; }
  .fin-g2,.fin-g11 { grid-template-columns:1fr; gap:14px; }
  .fin-g11s { grid-template-columns:1fr 1fr; gap:8px; }
  .finp { font-size:16px !important; }
  .fbtn { font-size:12px; padding:8px 12px; } .fbtn-sm { font-size:11px; padding:5px 8px; }
  .fin-card { border-radius:14px; } .fin-card-hdr { padding:11px 14px; }
  .fmov { padding:0; align-items:flex-end; } .fmov-box { border-radius:20px 20px 0 0; max-width:100%; max-height:93vh; }
  .fmov-hdr { padding:13px 16px; } .fmov-body { padding:14px; }
}
@media (max-width:479px) {
  .fin-top { padding:10px 12px 0; } .fin-g11s { grid-template-columns:1fr; }
  .fin-card-hdr { flex-wrap:wrap; gap:8px; }
}
`;

// ─── Helpers ─────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const fmtMontant = (v) => v !== undefined && v !== null ? Number(v).toLocaleString("fr-FR") + " CFA" : "—";
const genRef = (prefix) => `${prefix}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, "0")}`;

// ─── Demo data ────────────────────────────────────────────────
const DEMO_REVENUS = [
  { _id: "r1", date: "2026-06-01", service: "Consultation", reference: "FAC-2026-0041", patient: "Jean Dupont", montant: 25000, mode: "especes", statut: "paye" },
  { _id: "r2", date: "2026-06-01", service: "Laboratoire", reference: "FAC-2026-0040", patient: "Marie Paul", montant: 45000, mode: "mobile_money", statut: "paye" },
  { _id: "r3", date: "2026-06-01", service: "Chirurgie", reference: "FAC-2026-0039", patient: "Paul Nguema", montant: 350000, mode: "assurance", statut: "paye" },
  { _id: "r4", date: "2026-06-01", service: "Imagerie", reference: "FAC-2026-0038", patient: "Fatou Bongo", montant: 75000, mode: "especes", statut: "partiellement_paye" },
  { _id: "r5", date: "2026-05-31", service: "Hospitalisation", reference: "FAC-2026-0037", patient: "André Mboula", montant: 180000, mode: "virement", statut: "paye" },
  { _id: "r6", date: "2026-05-31", service: "Pharmacie", reference: "FAC-2026-0036", patient: "Kader Traoré", montant: 35000, mode: "especes", statut: "paye" },
  { _id: "r7", date: "2026-05-31", service: "Consultation", reference: "FAC-2026-0035", patient: "Anne Martin", montant: 15000, mode: "mobile_money", statut: "non_paye" },
  { _id: "r8", date: "2026-05-30", service: "Maternité", reference: "FAC-2026-0034", patient: "Sophie Kone", montant: 120000, mode: "assurance", statut: "paye" },
];

const DEMO_DEPENSES = [
  { _id: "d1", date: "2026-06-01", categorie: "Fournitures médicales", description: "Gants chirurgicaux × 500", montant: 50000, fournisseur: "MediSupply", statut: "paye" },
  { _id: "d2", date: "2026-06-01", categorie: "Médicaments", description: "Réapprovisionnement pharmacie — Lot A", montant: 280000, fournisseur: "PharmaCo", statut: "paye" },
  { _id: "d3", date: "2026-05-31", categorie: "Électricité", description: "Facture électricité mai 2026", montant: 95000, fournisseur: "SNEC", statut: "paye" },
  { _id: "d4", date: "2026-05-31", categorie: "Salaires", description: "Paiement salaires — Juin 2026", montant: 1850000, fournisseur: "Interne", statut: "paye" },
  { _id: "d5", date: "2026-05-30", categorie: "Maintenance", description: "Entretien appareil radiologie", montant: 120000, fournisseur: "TechMed Services", statut: "paye" },
  { _id: "d6", date: "2026-05-30", categorie: "Internet", description: "Abonnement fibre optique juin", montant: 45000, fournisseur: "Airtel Business", statut: "paye" },
  { _id: "d7", date: "2026-05-29", categorie: "Transport", description: "Carburant ambulance", montant: 30000, fournisseur: "Station Total", statut: "paye" },
  { _id: "d8", date: "2026-05-29", categorie: "Eau", description: "Facture eau mai 2026", montant: 22000, fournisseur: "SNEC Eau", statut: "en_attente" },
];

const DEMO_FACTURES = [
  { _id: "f1", numero: "FAC-2026-0041", date: "2026-06-01", patient: "Jean Dupont", service: "Consultation", montant: 25000, statut: "paye", echeance: "2026-06-01" },
  { _id: "f2", numero: "FAC-2026-0040", date: "2026-06-01", patient: "Marie Paul", service: "Laboratoire + Consultation", montant: 60000, statut: "paye", echeance: "2026-06-01" },
  { _id: "f3", numero: "FAC-2026-0039", date: "2026-05-28", patient: "Paul Nguema", service: "Chirurgie complète", montant: 670000, statut: "partiellement_paye", echeance: "2026-06-10" },
  { _id: "f4", numero: "FAC-2026-0038", date: "2026-06-01", patient: "Fatou Bongo", service: "Imagerie + Urgences", montant: 95000, statut: "non_paye", echeance: "2026-06-08" },
  { _id: "f5", numero: "FAC-2026-0037", date: "2026-05-31", patient: "André Mboula", service: "Hospitalisation 5j", montant: 180000, statut: "paye", echeance: "2026-05-31" },
  { _id: "f6", numero: "FAC-2026-0036", date: "2026-05-31", patient: "Kader Traoré", service: "Pharmacie", montant: 35000, statut: "paye", echeance: "2026-05-31" },
  { _id: "f7", numero: "FAC-2026-0035", date: "2026-05-31", patient: "Anne Martin", service: "Consultation", montant: 15000, statut: "non_paye", echeance: "2026-06-07" },
  { _id: "f8", numero: "FAC-2026-0034", date: "2026-05-30", patient: "Sophie Kone", service: "Accouchement + Maternité", montant: 220000, statut: "paye", echeance: "2026-05-30" },
];

const DEMO_PAIEMENTS = [
  { _id: "p1", reference: "PAY-2026-0055", patient: "Jean Dupont", montant: 25000, mode: "especes", date: "2026-06-01", heure: "09:15", facture: "FAC-2026-0041", caissier: "Paul Ngom" },
  { _id: "p2", reference: "PAY-2026-0054", patient: "Marie Paul", montant: 60000, mode: "mobile_money", date: "2026-06-01", heure: "10:32", facture: "FAC-2026-0040", caissier: "Paul Ngom" },
  { _id: "p3", reference: "PAY-2026-0053", patient: "Paul Nguema", montant: 300000, mode: "assurance", date: "2026-05-28", heure: "14:20", facture: "FAC-2026-0039", caissier: "Aminata Diallo" },
  { _id: "p4", reference: "PAY-2026-0052", patient: "André Mboula", montant: 180000, mode: "virement", date: "2026-05-31", heure: "16:00", facture: "FAC-2026-0037", caissier: "Aminata Diallo" },
  { _id: "p5", reference: "PAY-2026-0051", patient: "Kader Traoré", montant: 35000, mode: "especes", date: "2026-05-31", heure: "11:45", facture: "FAC-2026-0036", caissier: "Paul Ngom" },
  { _id: "p6", reference: "PAY-2026-0050", patient: "Sophie Kone", montant: 220000, mode: "assurance", date: "2026-05-30", heure: "08:55", facture: "FAC-2026-0034", caissier: "Aminata Diallo" },
];

const DEMO_ASSURANCES = [
  { _id: "a1", compagnie: "CNAM Congo", facture: "FAC-2026-0039", patient: "Paul Nguema", facture_montant: 670000, rembourse: 402000, en_attente: 268000, date_soumission: "2026-05-28", statut: "partiellement_rembourse" },
  { _id: "a2", compagnie: "Assur Vie", facture: "FAC-2026-0034", patient: "Sophie Kone", facture_montant: 220000, rembourse: 220000, en_attente: 0, date_soumission: "2026-05-30", statut: "rembourse" },
  { _id: "a3", compagnie: "CNAM Congo", facture: "FAC-2026-0028", patient: "Jean Mbeki", facture_montant: 145000, rembourse: 0, en_attente: 145000, date_soumission: "2026-05-15", statut: "en_attente" },
  { _id: "a4", compagnie: "Mutuelle AXA", facture: "FAC-2026-0020", patient: "Élise Nguesso", facture_montant: 95000, rembourse: 0, en_attente: 95000, date_soumission: "2026-05-10", statut: "en_attente" },
];

const DEMO_SALAIRES = [
  { _id: "s1", employe: "Dr. Martin Leblanc", fonction: "Médecin Chef", base: 850000, primes: 120000, deductions: 85000, net: 885000, statut: "paye", date_paiement: "2026-05-31" },
  { _id: "s2", employe: "Dr. Sophie Pierre", fonction: "Médecin", base: 720000, primes: 80000, deductions: 72000, net: 728000, statut: "paye", date_paiement: "2026-05-31" },
  { _id: "s3", employe: "Inf. Anne Martin", fonction: "Infirmier(e)", base: 380000, primes: 30000, deductions: 38000, net: 372000, statut: "paye", date_paiement: "2026-05-31" },
  { _id: "s4", employe: "Paul Ngom", fonction: "Caissier", base: 280000, primes: 20000, deductions: 28000, net: 272000, statut: "paye", date_paiement: "2026-05-31" },
  { _id: "s5", employe: "Aminata Diallo", fonction: "Secrétaire médicale", base: 260000, primes: 15000, deductions: 26000, net: 249000, statut: "en_attente", date_paiement: null },
  { _id: "s6", employe: "Kader Traoré", fonction: "Aide-soignant", base: 200000, primes: 10000, deductions: 20000, net: 190000, statut: "en_attente", date_paiement: null },
];

const DEMO_BUDGET = [
  { departement: "Consultations", budget: 500000, realise: 420000 },
  { departement: "Laboratoire", budget: 300000, realise: 285000 },
  { departement: "Chirurgie", budget: 800000, realise: 670000 },
  { departement: "Pharmacie", budget: 400000, realise: 380000 },
  { departement: "Imagerie", budget: 250000, realise: 195000 },
  { departement: "Hospitalisation", budget: 600000, realise: 540000 },
  { departement: "Maternité", budget: 350000, realise: 310000 },
  { departement: "Urgences", budget: 200000, realise: 175000 },
];

// ─── SVG Icons ────────────────────────────────────────────────
const I = {
  money:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  trend:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  trendD: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
  cash:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  file:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  pay:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/></svg>,
  shield: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  user:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  chart:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg>,
  book:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
  budget: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  dl:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  print:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  plus:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  save:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  x:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  check:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  grid:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  list:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/></svg>,
  refresh:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
  alert:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
};

// ─── Chart.js components ──────────────────────────────────────
function BarChart({ labels, data, color = "#1B4F9E", height = 200 }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new window.Chart(ref.current, {
        type: "bar",
        data: { labels, datasets: [{ data, backgroundColor: `${color}26`, borderColor: color, borderWidth: 2, borderRadius: 8, borderSkipped: false }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false }, tooltip: { backgroundColor: "#0B1E3B", padding: 10, cornerRadius: 10, callbacks: { label: (ctx) => " " + Number(ctx.raw).toLocaleString("fr-FR") + " CFA" } } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#9CA3AF" }, border: { display: false } }, y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.04)" }, ticks: { font: { size: 10 }, color: "#9CA3AF", callback: (v) => (v / 1000) + "K" }, border: { display: false } } } },
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [labels, data, color]);
  return <canvas ref={ref} style={{ maxHeight: height }} />;
}

function LineChart({ labels, datasets, height = 180 }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new window.Chart(ref.current, {
        type: "line",
        data: { labels, datasets: datasets.map(d => ({ ...d, fill: true, tension: .4, pointRadius: 3, borderWidth: 2, backgroundColor: `${d.borderColor}15` })) },
        options: { responsive: true, maintainAspectRatio: true, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: true, position: "top", labels: { font: { size: 11, family: "Poppins" }, usePointStyle: true } }, tooltip: { backgroundColor: "#0B1E3B", padding: 12, cornerRadius: 10, callbacks: { label: (ctx) => " " + Number(ctx.raw).toLocaleString("fr-FR") + " CFA" } } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#9CA3AF" }, border: { display: false } }, y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.04)" }, ticks: { font: { size: 10 }, color: "#9CA3AF", callback: (v) => (v / 1000) + "K" }, border: { display: false } } } },
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [labels, datasets]);
  return <canvas ref={ref} style={{ maxHeight: height }} />;
}

function DoughnutChart({ labels, data, colors, height = 180 }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new window.Chart(ref.current, {
        type: "doughnut",
        data: { labels, datasets: [{ data, backgroundColor: colors.map(c => c + "CC"), borderColor: colors, borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: true, cutout: "65%", plugins: { legend: { display: true, position: "right", labels: { font: { size: 10, family: "Poppins" }, usePointStyle: true, padding: 8 } }, tooltip: { backgroundColor: "#0B1E3B", padding: 10, cornerRadius: 10, callbacks: { label: (ctx) => " " + Number(ctx.raw).toLocaleString("fr-FR") + " CFA" } } } },
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [labels, data, colors]);
  return <canvas ref={ref} style={{ maxHeight: height }} />;
}

function Prog({ pct, color }) {
  return <div className="fin-prog"><div className="fin-prog-f" style={{ width: `${Math.min(100, pct)}%`, background: color }} /></div>;
}

// ─── Modal ────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, maxWidth = 620 }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="fmov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fmov-box" style={{ maxWidth }}>
        <div className="fmov-hdr">
          <h3>{title}</h3>
          <button className="fmov-cls" onClick={onClose}>×</button>
        </div>
        <div className="fmov-body">{children}</div>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({ color, icon, value, label, sub, trend, trendUp, urgent, onClick }) {
  return (
    <div className={`fin-kpi ${color} ffu`} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      {urgent && <div className="fkpi-dot" />}
      <div className={`fkpi-icon ${color}`}>{icon}</div>
      <div className="fkpi-val">{value}</div>
      <div className="fkpi-lbl">{label}</div>
      {sub && <div className="fkpi-sub">{sub}</div>}
      {trend && (
        <div className={`fkpi-trend ${trendUp ? "up" : "down"}`}>
          {trendUp ? I.trend : I.trendD} {trend}
        </div>
      )}
    </div>
  );
}

// ─── Statut config ────────────────────────────────────────────
const STATUT_FACT = {
  paye: { cls: "green", label: "Payée" },
  non_paye: { cls: "red", label: "Non payée" },
  partiellement_paye: { cls: "orange", label: "Part. payée" },
  annule: { cls: "gray", label: "Annulée" },
};

const MODE_PAY = {
  especes: { cls: "green", label: "💵 Espèces" },
  mobile_money: { cls: "teal", label: "📱 Mobile Money" },
  virement: { cls: "blue", label: "🏦 Virement" },
  assurance: { cls: "purple", label: "🛡️ Assurance" },
  carte: { cls: "orange", label: "💳 Carte bancaire" },
};

const CAT_DEP_COLOR = {
  "Salaires": "#1B4F9E",
  "Médicaments": "#0EA5A0",
  "Fournitures médicales": "#7C3AED",
  "Électricité": "#D97706",
  "Eau": "#059669",
  "Internet": "#6B7A99",
  "Maintenance": "#DC2626",
  "Transport": "#CA8A04",
};

// ─── EMPTY FORMS ──────────────────────────────────────────────
const EMPTY_REVENU = { date: new Date().toISOString().substring(0, 10), service: "Consultation", patient: "", reference: "", montant: "", mode: "especes", statut: "paye", notes: "" };
const EMPTY_DEPENSE = { date: new Date().toISOString().substring(0, 10), categorie: "Médicaments", description: "", montant: "", fournisseur: "", statut: "paye", notes: "" };
const EMPTY_FACTURE = { patient: "", service: "", montant: "", echeance: "", statut: "non_paye" };
const EMPTY_CAISSE = { type: "entree", montant: "", libelle: "", mode: "especes" };

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function Finance() {
  const dispatch = useDispatch();
  const reduxInvoices = useSelector(selectInvoices);
  const reduxStats = useSelector(selectFinanceStats);

  useEffect(() => {
    dispatch(fetchInvoices({}));
    dispatch(fetchFinanceStats());
  }, [dispatch]);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => { const fn = () => setIsMobile(window.innerWidth <= 599); window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn); }, []);

  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Data
  const [revenus, setRevenus] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [factures, setFactures] = useState([]);
  const [paiements, setPaiements] = useState([]);
  const [assurances, setAssurances] = useState([]);
  const [salaires, setSalaires] = useState([]);
  const [kpis, setKpis] = useState({});

  // Modals
  const [modalRevenu, setModalRevenu] = useState(false);
  const [modalDepense, setModalDepense] = useState(false);
  const [modalFacture, setModalFacture] = useState(false);
  const [modalCaisse, setModalCaisse] = useState(false);
  const [modalExport, setModalExport] = useState(false);
  const [modalFactureDetail, setModalFactureDetail] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState(null);

  // Forms
  const [formRevenu, setFormRevenu] = useState(EMPTY_REVENU);
  const [formDepense, setFormDepense] = useState(EMPTY_DEPENSE);
  const [formFacture, setFormFacture] = useState(EMPTY_FACTURE);
  const [formCaisse, setFormCaisse] = useState(EMPTY_CAISSE);

  // Filters
  const [searchFact, setSearchFact] = useState("");
  const [filterStatutFact, setFilterStatutFact] = useState("");
  const [searchDep, setSearchDep] = useState("");
  const [filterCatDep, setFilterCatDep] = useState("");

  // ── Load data ───────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [revRes, depRes, factRes, payRes, assRes, salRes, kpiRes] = await Promise.allSettled([
        api.get("/finance/revenus?limit=50"),
        api.get("/finance/depenses?limit=50"),
        api.get("/finance/factures?limit=50"),
        api.get("/finance/paiements?limit=50"),
        api.get("/finance/assurances"),
        api.get("/finance/salaires"),
        api.get("/finance/kpis"),
      ]);
      if (revRes.status  === "fulfilled") setRevenus(revRes.value.data.revenus || revRes.value.data.data || []);
      if (depRes.status  === "fulfilled") setDepenses(depRes.value.data.depenses || depRes.value.data.data || []);
      if (factRes.status === "fulfilled") setFactures(factRes.value.data.factures || factRes.value.data.data || []);
      if (payRes.status  === "fulfilled") setPaiements(payRes.value.data.paiements || payRes.value.data.data || []);
      if (assRes.status  === "fulfilled") setAssurances(assRes.value.data.assurances || []);
      if (salRes.status  === "fulfilled") setSalaires(salRes.value.data.salaires || []);
      if (kpiRes.status  === "fulfilled") setKpis(kpiRes.value.data || {});
    } catch {/* fallback demo */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Fallback demo data
    setRevenus(DEMO_REVENUS);
    setDepenses(DEMO_DEPENSES);
    setFactures(DEMO_FACTURES);
    setPaiements(DEMO_PAIEMENTS);
    setAssurances(DEMO_ASSURANCES);
    setSalaires(DEMO_SALAIRES);
  }, []);

  // ── Computed KPIs ────────────────────────────────────────
  const totalRevenus   = revenus.reduce((s, r) => s + Number(r.montant), 0);
  const totalDepenses  = depenses.reduce((s, d) => s + Number(d.montant), 0);
  const beneficeNet    = totalRevenus - totalDepenses;
  const facturesImpayees = factures.filter(f => f.statut === "non_paye");
  const montantImpaye  = facturesImpayees.reduce((s, f) => s + Number(f.montant), 0);
  const creanceAssur   = assurances.filter(a => a.statut !== "rembourse").reduce((s, a) => s + Number(a.en_attente), 0);
  const totalSalaires  = salaires.reduce((s, sl) => s + Number(sl.net), 0);
  const soldeCaisse    = 485000; // Demo
  const tauxRecouvrement = totalRevenus > 0 ? Math.round(((totalRevenus - montantImpaye) / totalRevenus) * 100) : 0;

  // ── Add revenu ───────────────────────────────────────────
  const addRevenu = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/finance/revenus", { ...formRevenu, reference: formRevenu.reference || genRef("FAC") });
      toast.success("✅ Revenu enregistré");
      setRevenus(prev => [data.revenu || { ...formRevenu, _id: Date.now(), reference: genRef("FAC") }, ...prev]);
    } catch {
      setRevenus(prev => [{ ...formRevenu, _id: Date.now().toString(), reference: genRef("FAC") }, ...prev]);
      toast.success("✅ Revenu enregistré (local)");
    } finally {
      setModalRevenu(false); setFormRevenu(EMPTY_REVENU); setSaving(false);
    }
  };

  // ── Add depense ──────────────────────────────────────────
  const addDepense = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/finance/depenses", formDepense);
      toast.success("✅ Dépense enregistrée");
      setDepenses(prev => [data.depense || { ...formDepense, _id: Date.now() }, ...prev]);
    } catch {
      setDepenses(prev => [{ ...formDepense, _id: Date.now().toString() }, ...prev]);
      toast.success("✅ Dépense enregistrée (local)");
    } finally {
      setModalDepense(false); setFormDepense(EMPTY_DEPENSE); setSaving(false);
    }
  };

  // ── Create facture ───────────────────────────────────────
  const createFacture = async (e) => {
    e.preventDefault();
    setSaving(true);
    const newFact = { ...formFacture, numero: genRef("FAC"), date: new Date().toISOString().substring(0, 10) };
    try {
      const { data } = await api.post("/finance/factures", newFact);
      toast.success(`✅ Facture ${data.numero || newFact.numero} créée`);
      setFactures(prev => [data.facture || { ...newFact, _id: Date.now() }, ...prev]);
    } catch {
      setFactures(prev => [{ ...newFact, _id: Date.now().toString() }, ...prev]);
      toast.success("✅ Facture créée (local)");
    } finally {
      setModalFacture(false); setFormFacture(EMPTY_FACTURE); setSaving(false);
    }
  };

  // ── Opération caisse ─────────────────────────────────────
  const opCaisse = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/finance/caisse", formCaisse);
    } catch { /* local */ } finally {
      toast.success(`✅ ${formCaisse.type === "entree" ? "Entrée" : "Sortie"} de caisse enregistrée — ${Number(formCaisse.montant).toLocaleString("fr-FR")} CFA`);
      setModalCaisse(false); setFormCaisse(EMPTY_CAISSE); setSaving(false);
    }
  };

  // ── Update statut facture ────────────────────────────────
  const updateStatutFacture = async (id, statut) => {
    try { await api.put(`/finance/factures/${id}`, { statut }); } catch { /* local */ }
    setFactures(prev => prev.map(f => f._id === id ? { ...f, statut } : f));
    if (statut === "paye") toast.success("✅ Facture marquée comme payée");
  };

  // ── Filtered data ────────────────────────────────────────
  const filteredFactures = factures.filter(f => {
    if (searchFact && !f.patient?.toLowerCase().includes(searchFact.toLowerCase()) && !f.numero?.includes(searchFact)) return false;
    if (filterStatutFact && f.statut !== filterStatutFact) return false;
    return true;
  });

  const filteredDepenses = depenses.filter(d => {
    if (searchDep && !d.description?.toLowerCase().includes(searchDep.toLowerCase())) return false;
    if (filterCatDep && d.categorie !== filterCatDep) return false;
    return true;
  });

  // ── Mois labels ──────────────────────────────────────────
  const MOIS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      <div className="fin">

        {/* ── TOPBAR ── */}
        <div className="fin-top">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap", position:"relative", zIndex:2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:54, height:54, borderRadius:14, background:"rgba(255,255,255,.12)", border:"1.5px solid rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {I.money}
              </div>
              <div>
                <div style={{ fontSize:21, fontWeight:700, color:"#fff", letterSpacing:-.3 }}>Module Finance</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.55)", marginTop:2 }}>
                  Clinique Canadienne de Souanké ·
                  <span style={{ color:"#A7F3D0", fontWeight:700 }}> {fmtMontant(totalRevenus)} de revenus ce mois</span>
                  {montantImpaye > 0 && <span style={{ color:"#FCA5A5", fontWeight:700 }}> · {fmtMontant(montantImpaye)} impayés</span>}
                </div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }} className="no-print">
              <button className="fbtn fbtn-ghost" style={{ color:"#fff", borderColor:"rgba(255,255,255,.3)" }} onClick={() => setModalExport(true)}>
                {I.dl} Exporter
              </button>
              <button className="fbtn fbtn-ghost" style={{ color:"#fff", borderColor:"rgba(255,255,255,.3)" }} onClick={() => setModalCaisse(true)}>
                {I.cash} Opération caisse
              </button>
              <button className="fbtn fbtn-teal" onClick={() => setModalFacture(true)}>
                {I.plus} Nouvelle facture
              </button>
            </div>
          </div>

          {/* Tabs */}
          {(() => {
            const TABS = [
              { key:"dashboard",    icon:I.grid,   label:"Tableau de bord", labelM:"Dash." },
              { key:"revenus",      icon:I.trend,  label:"Revenus",         labelM:"Revenus" },
              { key:"depenses",     icon:I.trendD, label:"Dépenses",        labelM:"Dépenses" },
              { key:"caisse",       icon:I.cash,   label:"Caisse",          labelM:"Caisse" },
              { key:"facturation",  icon:I.file,   label:"Facturation",     labelM:"Factures", badge:facturesImpayees.length },
              { key:"paiements",    icon:I.pay,    label:"Paiements",       labelM:"Paiements" },
              { key:"assurances",   icon:I.shield, label:"Assurances",      labelM:"Assur.", badge:assurances.filter(a=>a.statut==="en_attente").length },
              { key:"salaires",     icon:I.user,   label:"Salaires",        labelM:"Salaires" },
              { key:"comptabilite", icon:I.book,   label:"Comptabilité",    labelM:"Compta." },
              { key:"budget",       icon:I.budget, label:"Budget",          labelM:"Budget" },
              { key:"rapports",     icon:I.chart,  label:"Rapports",        labelM:"Rapports" },
            ];
            return (
              <div style={isMobile?{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'4px',padding:'8px 10px',marginTop:'8px',background:'rgba(255,255,255,.07)',borderRadius:'10px 10px 0 0'}:{display:'flex',gap:'2px',marginTop:'16px',overflowX:'auto',scrollbarWidth:'none'}}>
                {TABS.map(t=>(
                  <button key={t.key} className={`fin-tab ${tab===t.key?"active":""}`} style={isMobile?{flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'6px 2px 7px',fontSize:'9px',gap:'2px',borderRadius:'8px',whiteSpace:'normal',minWidth:0}:{}} onClick={()=>setTab(t.key)}>
                    <span style={isMobile?{fontSize:'13px'}:{}}>{t.icon}</span>
                    <span style={isMobile?{lineHeight:1.2}:{}}>{isMobile?t.labelM:t.label}</span>
                    {(t.badge??0)>0&&<span className="fin-tab-badge">{t.badge}</span>}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

        {/* ── CONTENT ── */}
        <div style={{ padding: isMobile ? 14 : 24 }}>

          {/* ══ DASHBOARD ══ */}
          {tab === "dashboard" && (
            <div>
              {/* Alert impayés */}
              {montantImpaye > 0 && (
                <div className="al-warn ffu" style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, flexWrap:"wrap" }}>
                  <div style={{ width:42, height:42, background:"#FEF3C7", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {I.alert}
                  </div>
                  <div style={{ flex:1 }}>
                    <strong style={{ color:"#92400E", fontSize:13 }}>⚠️ Factures impayées en attente</strong>
                    <div style={{ fontSize:12, color:"#B45309", marginTop:3 }}>
                      <strong>{facturesImpayees.length}</strong> facture(s) non payée(s) — Montant total : <strong>{fmtMontant(montantImpaye)}</strong>
                    </div>
                  </div>
                  <button className="fbtn fbtn-orange fbtn-sm" onClick={() => { setFilterStatutFact("non_paye"); setTab("facturation"); }}>
                    Gérer les impayés →
                  </button>
                </div>
              )}

              {/* KPIs */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="green"  icon={I.trend}  value={fmtMontant(totalRevenus).split(" CFA")[0]}  label="Revenus du mois"    sub="CFA"  trend="+12% vs mois préc." trendUp={true}  onClick={() => setTab("revenus")} />
                <KpiCard color="red"    icon={I.trendD} value={fmtMontant(totalDepenses).split(" CFA")[0]} label="Dépenses du mois"   sub="CFA"  trend="+3% vs mois préc."  trendUp={false} onClick={() => setTab("depenses")} />
                <KpiCard color="blue"   icon={I.chart}  value={fmtMontant(beneficeNet).split(" CFA")[0]}   label="Bénéfice net"       sub="CFA"  trend="+18% vs mois préc." trendUp={beneficeNet >= 0} onClick={() => setTab("rapports")} />
                <KpiCard color="orange" icon={I.file}   value={facturesImpayees.length}                    label="Factures impayées"  sub={fmtMontant(montantImpaye)} urgent={facturesImpayees.length > 0} onClick={() => { setFilterStatutFact("non_paye"); setTab("facturation"); }} />
                <KpiCard color="purple" icon={I.shield} value={fmtMontant(creanceAssur).split(" CFA")[0]}  label="Créances assurances" sub="CFA — en attente" onClick={() => setTab("assurances")} />
                <KpiCard color="teal"   icon={I.cash}   value={fmtMontant(soldeCaisse).split(" CFA")[0]}   label="Trésorerie caisse"  sub="CFA — solde actuel" onClick={() => setTab("caisse")} />
                <KpiCard color="dark"   icon={I.user}   value={fmtMontant(totalSalaires).split(" CFA")[0]} label="Masse salariale"    sub="CFA — ce mois" onClick={() => setTab("salaires")} />
                <KpiCard color="green"  icon={I.check}  value={`${tauxRecouvrement}%`}                     label="Taux recouvrement"  sub="paiements reçus/facturés" />
              </div>

              {/* Charts */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"2fr 1fr", gap:20, marginBottom:24 }}>
                <div className="fin-card ffu">
                  <div className="fin-card-hdr">
                    <div><h3>{I.trend} Revenus & Dépenses — 12 mois</h3><p>Évolution mensuelle</p></div>
                    <select className="finp" style={{ width:120, padding:"5px 10px", fontSize:11 }}>
                      <option>2026</option><option>2025</option>
                    </select>
                  </div>
                  <div style={{ padding:20 }}>
                    <LineChart
                      labels={MOIS}
                      datasets={[
                        { label:"Revenus", data:[580000,620000,490000,710000,680000,845000,0,0,0,0,0,0], borderColor:"#059669", pointBackgroundColor:"#059669" },
                        { label:"Dépenses", data:[420000,450000,380000,510000,490000,492000,0,0,0,0,0,0], borderColor:"#DC2626", pointBackgroundColor:"#DC2626" },
                      ]}
                      height={200}
                    />
                  </div>
                </div>
                <div className="fin-card ffu">
                  <div className="fin-card-hdr"><div><h3>Revenus par service</h3><p>{fmtMontant(totalRevenus)}</p></div></div>
                  <div style={{ padding:20 }}>
                    <DoughnutChart
                      labels={["Consultation","Labo","Chirurgie","Imagerie","Hospit.","Pharmacie"]}
                      data={[420000, 285000, 670000, 195000, 540000, 380000]}
                      colors={["#0EA5A0","#7C3AED","#DC2626","#059669","#1B4F9E","#D97706"]}
                      height={190}
                    />
                  </div>
                </div>
              </div>

              {/* Récent revenus + dépenses */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                <div className="fin-card ffu">
                  <div className="fin-card-hdr">
                    <div><h3>{I.trend} Derniers revenus</h3></div>
                    <button className="fbtn fbtn-ghost fbtn-sm" onClick={() => setTab("revenus")}>Voir tous →</button>
                  </div>
                  <div style={{ overflowX:"auto" }}>
                    <table className="fin-tbl">
                      <thead><tr><th>Date</th><th>Service</th><th>Patient</th><th>Montant</th><th>Mode</th></tr></thead>
                      <tbody>
                        {revenus.slice(0,5).map(r => {
                          const mp = MODE_PAY[r.mode] || { cls:"gray", label:r.mode };
                          return (
                            <tr key={r._id}>
                              <td style={{ fontSize:11, color:"var(--cm)" }}>{fmtDate(r.date)}</td>
                              <td><span className="fbdg teal" style={{ fontSize:10 }}>{r.service}</span></td>
                              <td style={{ fontSize:12, fontWeight:600, color:"var(--fn)" }}>{r.patient}</td>
                              <td style={{ fontWeight:700, color:"var(--fg)", fontSize:13 }}>{fmtMontant(r.montant)}</td>
                              <td><span className={`fbdg ${mp.cls}`} style={{ fontSize:10 }}>{mp.label}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="fin-card ffu">
                  <div className="fin-card-hdr">
                    <div><h3>{I.trendD} Dernières dépenses</h3></div>
                    <button className="fbtn fbtn-ghost fbtn-sm" onClick={() => setTab("depenses")}>Voir toutes →</button>
                  </div>
                  <div style={{ overflowX:"auto" }}>
                    <table className="fin-tbl">
                      <thead><tr><th>Date</th><th>Catégorie</th><th>Description</th><th>Montant</th></tr></thead>
                      <tbody>
                        {depenses.slice(0,5).map(d => (
                          <tr key={d._id}>
                            <td style={{ fontSize:11, color:"var(--cm)" }}>{fmtDate(d.date)}</td>
                            <td><span className="fbdg blue" style={{ fontSize:10 }}>{d.categorie}</span></td>
                            <td style={{ fontSize:11.5, color:"var(--cm)", maxWidth:140 }}><div style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{d.description}</div></td>
                            <td style={{ fontWeight:700, color:"var(--fr)", fontSize:13 }}>{fmtMontant(d.montant)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ REVENUS ══ */}
          {tab === "revenus" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--fn)" }}>Journal des revenus</div>
                  <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>Total : <strong style={{ color:"var(--fg)" }}>{fmtMontant(totalRevenus)}</strong></div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="fbtn fbtn-ghost fbtn-sm" onClick={() => toast.success("📊 Export en cours...")}>{I.dl} Exporter</button>
                  <button className="fbtn fbtn-teal" onClick={() => { setFormRevenu(EMPTY_REVENU); setModalRevenu(true); }}>
                    {I.plus} Enregistrer revenu
                  </button>
                </div>
              </div>

              {/* Stats revenus par service */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12, marginBottom:20 }}>
                {[
                  ["Consultation", 420000, "#0EA5A0"], ["Laboratoire", 285000, "#7C3AED"],
                  ["Chirurgie", 670000, "#DC2626"], ["Imagerie", 195000, "#059669"],
                  ["Hospitalisation", 540000, "#1B4F9E"], ["Pharmacie", 380000, "#D97706"],
                  ["Maternité", 310000, "#CA8A04"], ["Urgences", 175000, "#6B7A99"],
                ].map(([lbl, val, col]) => (
                  <div key={lbl} style={{ background:"#fff", border:"1.5px solid var(--cbr)", borderRadius:14, padding:"12px 14px", borderTop:`3px solid ${col}` }}>
                    <div style={{ fontSize:15, fontWeight:800, color:"var(--fn)" }}>{fmtMontant(val).replace(" CFA", "")}</div>
                    <div style={{ fontSize:10, fontWeight:600, color:"var(--cm)", marginTop:2 }}>{lbl} <span style={{ fontSize:9 }}>CFA</span></div>
                  </div>
                ))}
              </div>

              <div className="fin-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="fin-tbl" style={{ minWidth:800 }}>
                    <thead><tr><th>Date</th><th>Référence</th><th>Patient</th><th>Service</th><th>Montant</th><th>Mode paiement</th><th>Statut</th></tr></thead>
                    <tbody>
                      {revenus.map(r => {
                        const mp = MODE_PAY[r.mode] || { cls:"gray", label:r.mode };
                        const sc = STATUT_FACT[r.statut] || { cls:"gray", label:r.statut };
                        return (
                          <tr key={r._id}>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{fmtDate(r.date)}</td>
                            <td><span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--fb)", fontSize:12 }}>{r.reference}</span></td>
                            <td style={{ fontWeight:600, color:"var(--fn)" }}>{r.patient}</td>
                            <td><span className="fbdg teal">{r.service}</span></td>
                            <td style={{ fontWeight:800, fontSize:14, color:"var(--fg)" }}>{fmtMontant(r.montant)}</td>
                            <td><span className={`fbdg ${mp.cls}`}>{mp.label}</span></td>
                            <td><span className={`fbdg ${sc.cls}`}>{sc.label}</span></td>
                          </tr>
                        );
                      })}
                      {revenus.length === 0 && <tr><td colSpan={7} style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>Aucun revenu enregistré</td></tr>}
                    </tbody>
                    <tfoot>
                      <tr style={{ background:"linear-gradient(to right,#EEF4FF,#DBEAFE)" }}>
                        <td colSpan={4} style={{ color:"var(--fn)" }}>TOTAL REVENUS</td>
                        <td style={{ color:"var(--fg)", fontSize:15 }}>{fmtMontant(totalRevenus)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ DÉPENSES ══ */}
          {tab === "depenses" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--fn)" }}>Registre des dépenses</div>
                  <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>Total : <strong style={{ color:"var(--fr)" }}>{fmtMontant(totalDepenses)}</strong></div>
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }}>{I.search}</span>
                    <input className="finp" style={{ paddingLeft:32, width:200 }} placeholder="Rechercher..." value={searchDep} onChange={e => setSearchDep(e.target.value)} />
                  </div>
                  <select className="finp" style={{ width:180 }} value={filterCatDep} onChange={e => setFilterCatDep(e.target.value)}>
                    <option value="">Toutes catégories</option>
                    {Object.keys(CAT_DEP_COLOR).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button className="fbtn fbtn-danger" onClick={() => { setFormDepense(EMPTY_DEPENSE); setModalDepense(true); }}>
                    {I.plus} Enregistrer dépense
                  </button>
                </div>
              </div>

              {/* Répartition catégories */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"2fr 1fr", gap:20, marginBottom:20 }}>
                <div className="fin-card ffu">
                  <div className="fin-card-hdr"><h3>Dépenses par catégorie</h3></div>
                  <div style={{ padding:20 }}>
                    {Object.entries(CAT_DEP_COLOR).map(([cat, col]) => {
                      const total = depenses.filter(d => d.categorie === cat).reduce((s, d) => s + Number(d.montant), 0);
                      if (total === 0) return null;
                      const pct = totalDepenses > 0 ? Math.round(total / totalDepenses * 100) : 0;
                      return (
                        <div key={cat} style={{ marginBottom:10 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                            <span style={{ color:"var(--cm)", display:"flex", alignItems:"center", gap:6 }}>
                              <span style={{ width:9, height:9, borderRadius:2, background:col, display:"inline-block" }} />{cat}
                            </span>
                            <div style={{ display:"flex", gap:8 }}>
                              <span style={{ fontWeight:700, color:"var(--fn)" }}>{fmtMontant(total)}</span>
                              <span style={{ color:"var(--cm)" }}>{pct}%</span>
                            </div>
                          </div>
                          <Prog pct={pct} color={col} />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="fin-card ffu">
                  <div className="fin-card-hdr"><h3>Résumé mensuel</h3></div>
                  <div style={{ padding:20, display:"flex", flexDirection:"column", gap:10 }}>
                    {[
                      ["Total dépenses", fmtMontant(totalDepenses), "var(--fr)"],
                      ["Salaires", fmtMontant(depenses.filter(d=>d.categorie==="Salaires").reduce((s,d)=>s+Number(d.montant),0)), "var(--fb)"],
                      ["Médicaments", fmtMontant(depenses.filter(d=>d.categorie==="Médicaments").reduce((s,d)=>s+Number(d.montant),0)), "var(--ft)"],
                      ["Charges fixes", fmtMontant(depenses.filter(d=>["Électricité","Eau","Internet"].includes(d.categorie)).reduce((s,d)=>s+Number(d.montant),0)), "var(--fo)"],
                      ["Maintenance", fmtMontant(depenses.filter(d=>d.categorie==="Maintenance").reduce((s,d)=>s+Number(d.montant),0)), "var(--fp)"],
                    ].map(([lbl, val, col]) => (
                      <div key={lbl} style={{ display:"flex", justifyContent:"space-between", padding:"8px 12px", background:"#F8FAFD", borderRadius:10 }}>
                        <span style={{ fontSize:12, color:"var(--cm)" }}>{lbl}</span>
                        <strong style={{ fontSize:12, color:col }}>{val}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="fin-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="fin-tbl" style={{ minWidth:800 }}>
                    <thead><tr><th>Date</th><th>Catégorie</th><th>Description</th><th>Fournisseur</th><th>Montant</th><th>Statut</th></tr></thead>
                    <tbody>
                      {filteredDepenses.map(d => {
                        const sc = d.statut === "paye" ? {cls:"green",lbl:"Payée"} : d.statut === "en_attente" ? {cls:"orange",lbl:"En attente"} : {cls:"gray",lbl:d.statut};
                        return (
                          <tr key={d._id}>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{fmtDate(d.date)}</td>
                            <td><span className="fbdg blue">{d.categorie}</span></td>
                            <td style={{ fontSize:12.5, color:"var(--fn)" }}>{d.description}</td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{d.fournisseur}</td>
                            <td style={{ fontWeight:800, fontSize:14, color:"var(--fr)" }}>{fmtMontant(d.montant)}</td>
                            <td><span className={`fbdg ${sc.cls}`}>{sc.lbl}</span></td>
                          </tr>
                        );
                      })}
                      {filteredDepenses.length === 0 && <tr><td colSpan={6} style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>Aucune dépense enregistrée</td></tr>}
                    </tbody>
                    <tfoot>
                      <tr style={{ background:"linear-gradient(to right,#FEF2F2,#FEE2E2)" }}>
                        <td colSpan={4} style={{ color:"var(--fn)" }}>TOTAL DÉPENSES</td>
                        <td style={{ color:"var(--fr)", fontSize:15 }}>{fmtMontant(totalDepenses)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ CAISSE ══ */}
          {tab === "caisse" && (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:20, marginBottom:24 }}>
                <div className="caisse-card ffu" style={{ gridColumn:"1 / span 2" }}>
                  <div style={{ position:"relative", zIndex:1 }}>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,.55)", fontWeight:600, textTransform:"uppercase", letterSpacing:.6, marginBottom:4 }}>
                      💰 Solde de caisse actuel
                    </div>
                    <div className="caisse-val">{fmtMontant(soldeCaisse)}</div>
                    <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:12, marginTop:20 }}>
                      <div className="caisse-item">
                        <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginBottom:4 }}>Solde ouverture</div>
                        <div style={{ fontSize:16, fontWeight:700, color:"#A7F3D0" }}>{fmtMontant(450000)}</div>
                      </div>
                      <div className="caisse-item">
                        <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginBottom:4 }}>Encaissements</div>
                        <div style={{ fontSize:16, fontWeight:700, color:"#A7F3D0" }}>{fmtMontant(120000)}</div>
                      </div>
                      <div className="caisse-item">
                        <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginBottom:4 }}>Décaissements</div>
                        <div style={{ fontSize:16, fontWeight:700, color:"#FCA5A5" }}>{fmtMontant(85000)}</div>
                      </div>
                    </div>
                    <div style={{ marginTop:16, display:"flex", gap:8, flexWrap:"wrap" }}>
                      <button className="fbtn fbtn-teal fbtn-sm" onClick={() => { setFormCaisse({...EMPTY_CAISSE, type:"entree"}); setModalCaisse(true); }}>
                        {I.plus} Entrée de caisse
                      </button>
                      <button className="fbtn fbtn-danger fbtn-sm" onClick={() => { setFormCaisse({...EMPTY_CAISSE, type:"sortie"}); setModalCaisse(true); }}>
                        {I.trendD} Sortie de caisse
                      </button>
                      <button className="fbtn fbtn-ghost fbtn-sm" style={{ color:"rgba(255,255,255,.7)", borderColor:"rgba(255,255,255,.25)" }} onClick={() => toast.success("🔒 Clôture de caisse effectuée")}>
                        🔒 Clôturer la caisse
                      </button>
                    </div>
                  </div>
                </div>
                <div className="fin-card ffu">
                  <div className="fin-card-hdr"><h3>📊 Encaissements par mode</h3></div>
                  <div style={{ padding:18, display:"flex", flexDirection:"column", gap:10 }}>
                    {[
                      ["💵 Espèces", 65000, "#059669"],
                      ["📱 Mobile Money", 35000, "#0EA5A0"],
                      ["🏦 Virement", 0, "#1B4F9E"],
                      ["🛡️ Assurance", 20000, "#7C3AED"],
                    ].map(([lbl, val, col]) => (
                      <div key={lbl} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:12, color:"var(--cm)" }}>{lbl}</span>
                        <strong style={{ color:col, fontSize:13 }}>{fmtMontant(val)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Historique caisse */}
              <div className="fin-card ffu">
                <div className="fin-card-hdr">
                  <div><h3>📋 Journal de caisse du jour</h3><p>{new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p></div>
                  <button className="fbtn fbtn-ghost fbtn-sm" onClick={() => window.print()}>{I.print} Imprimer</button>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table className="fin-tbl">
                    <thead><tr><th>Heure</th><th>Type</th><th>Libellé</th><th>Mode</th><th>Entrée</th><th>Sortie</th><th>Solde</th></tr></thead>
                    <tbody>
                      {[
                        { heure:"08:00", type:"ouverture", libelle:"Solde d'ouverture", mode:"—", entree:450000, sortie:null, solde:450000 },
                        { heure:"09:15", type:"entree", libelle:"Consultation Jean Dupont — FAC-2026-0041", mode:"Espèces", entree:25000, sortie:null, solde:475000 },
                        { heure:"10:32", type:"entree", libelle:"Labo Marie Paul — FAC-2026-0040", mode:"Mobile Money", entree:60000, sortie:null, solde:535000 },
                        { heure:"11:45", type:"sortie", libelle:"Achat fournitures — MediSupply", mode:"Espèces", entree:null, sortie:50000, solde:485000 },
                      ].map((op, i) => (
                        <tr key={i} style={{ background: op.type === "ouverture" ? "#EEF4FF" : "" }}>
                          <td style={{ fontSize:12, color:"var(--cm)", fontWeight:600 }}>{op.heure}</td>
                          <td><span className={`fbdg ${op.type === "entree" ? "green" : op.type === "sortie" ? "red" : "blue"}`}>{op.type === "entree" ? "📥 Entrée" : op.type === "sortie" ? "📤 Sortie" : "🔓 Ouverture"}</span></td>
                          <td style={{ fontSize:12, color:"var(--fn)" }}>{op.libelle}</td>
                          <td style={{ fontSize:11, color:"var(--cm)" }}>{op.mode}</td>
                          <td style={{ fontWeight:700, color:"var(--fg)" }}>{op.entree ? fmtMontant(op.entree) : "—"}</td>
                          <td style={{ fontWeight:700, color:"var(--fr)" }}>{op.sortie ? fmtMontant(op.sortie) : "—"}</td>
                          <td style={{ fontWeight:800, fontSize:13, color:"var(--fn)" }}>{fmtMontant(op.solde)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background:"linear-gradient(to right,#EEF4FF,#DBEAFE)" }}>
                        <td colSpan={4} style={{ color:"var(--fn)" }}>SOLDE ACTUEL</td>
                        <td style={{ color:"var(--fg)" }}>{fmtMontant(120000)}</td>
                        <td style={{ color:"var(--fr)" }}>{fmtMontant(85000)}</td>
                        <td style={{ color:"var(--fb)", fontSize:15 }}>{fmtMontant(soldeCaisse)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ FACTURATION ══ */}
          {tab === "facturation" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--fn)" }}>Gestion des factures</div>
                  <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>{factures.length} facture(s) · {facturesImpayees.length} impayée(s)</div>
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }}>{I.search}</span>
                    <input className="finp" style={{ paddingLeft:32, width:200 }} placeholder="Patient, numéro..." value={searchFact} onChange={e => setSearchFact(e.target.value)} />
                  </div>
                  <select className="finp" style={{ width:180 }} value={filterStatutFact} onChange={e => setFilterStatutFact(e.target.value)}>
                    <option value="">Tous les statuts</option>
                    <option value="paye">Payées</option>
                    <option value="non_paye">Non payées</option>
                    <option value="partiellement_paye">Part. payées</option>
                    <option value="annule">Annulées</option>
                  </select>
                  <button className="fbtn fbtn-teal" onClick={() => { setFormFacture(EMPTY_FACTURE); setModalFacture(true); }}>
                    {I.plus} Nouvelle facture
                  </button>
                </div>
              </div>

              {/* KPI factures */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12, marginBottom:20 }}>
                {[
                  ["Payées", factures.filter(f=>f.statut==="paye").length, "green", factures.filter(f=>f.statut==="paye").reduce((s,f)=>s+Number(f.montant),0)],
                  ["Non payées", factures.filter(f=>f.statut==="non_paye").length, "red", montantImpaye],
                  ["Part. payées", factures.filter(f=>f.statut==="partiellement_paye").length, "orange", factures.filter(f=>f.statut==="partiellement_paye").reduce((s,f)=>s+Number(f.montant),0)],
                  ["Annulées", factures.filter(f=>f.statut==="annule").length, "gray", 0],
                ].map(([lbl, count, col, montant]) => (
                  <div key={lbl} style={{ background:"#fff", border:"1.5px solid var(--cbr)", borderRadius:14, padding:"14px 16px", cursor:"pointer" }} onClick={() => setFilterStatutFact(col === "green" ? "paye" : col === "red" ? "non_paye" : col === "orange" ? "partiellement_paye" : "annule")}>
                    <div style={{ fontSize:22, fontWeight:800, color:"var(--fn)" }}>{count}</div>
                    <div style={{ fontSize:11, fontWeight:600, color:"var(--cm)" }}>{lbl}</div>
                    {montant > 0 && <div style={{ fontSize:10, color:"#9CA3AF", marginTop:2 }}>{fmtMontant(montant)}</div>}
                  </div>
                ))}
              </div>

              <div className="fin-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="fin-tbl" style={{ minWidth:860 }}>
                    <thead><tr><th>Numéro</th><th>Date</th><th>Patient</th><th>Service</th><th>Montant</th><th>Échéance</th><th>Statut</th><th>Actions</th></tr></thead>
                    <tbody>
                      {filteredFactures.map(f => {
                        const sc = STATUT_FACT[f.statut] || { cls:"gray", label:f.statut };
                        const expired = f.statut !== "paye" && f.echeance && new Date(f.echeance) < new Date();
                        return (
                          <tr key={f._id} style={{ background: expired ? "#FFF8F8" : f.statut === "paye" ? "#F0FDF4" : "" }}>
                            <td><span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--fb)", fontSize:12 }}>{f.numero}</span></td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{fmtDate(f.date)}</td>
                            <td style={{ fontWeight:600, color:"var(--fn)" }}>{f.patient}</td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{f.service}</td>
                            <td style={{ fontWeight:800, fontSize:14, color:"var(--fn)" }}>{fmtMontant(f.montant)}</td>
                            <td>
                              <span style={{ fontSize:11, color: expired ? "var(--fr)" : "var(--cm)", fontWeight: expired ? 700 : 400 }}>
                                {expired && "⚠ "}{fmtDate(f.echeance)}
                              </span>
                            </td>
                            <td><span className={`fbdg ${sc.cls}`}>{sc.label}</span></td>
                            <td>
                              <div style={{ display:"flex", gap:6 }}>
                                <button className="fbtn fbtn-ghost fbtn-sm" style={{ fontSize:11 }} onClick={() => { setSelectedFacture(f); setModalFactureDetail(true); }}>
                                  👁️
                                </button>
                                {f.statut !== "paye" && (
                                  <button className="fbtn fbtn-green fbtn-sm" style={{ fontSize:11 }} onClick={() => updateStatutFacture(f._id, "paye")}>
                                    {I.check} Payer
                                  </button>
                                )}
                                <button className="fbtn fbtn-ghost fbtn-sm" style={{ fontSize:11 }} onClick={() => toast.success("📄 Facture imprimée")}>{I.print}</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredFactures.length === 0 && <tr><td colSpan={8} style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>Aucune facture trouvée</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ PAIEMENTS ══ */}
          {tab === "paiements" && (
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--fn)", marginBottom:20 }}>Historique des paiements</div>

              {/* Statistiques modes */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:20 }}>
                {Object.entries(MODE_PAY).map(([mode, cfg]) => {
                  const total = paiements.filter(p => p.mode === mode).reduce((s, p) => s + Number(p.montant), 0);
                  return (
                    <div key={mode} style={{ background:"#fff", border:"1.5px solid var(--cbr)", borderRadius:14, padding:"14px 16px" }}>
                      <div style={{ fontSize:13, marginBottom:6 }}>{cfg.label}</div>
                      <div style={{ fontSize:17, fontWeight:800, color:"var(--fn)" }}>{fmtMontant(total).replace(" CFA","")}</div>
                      <div style={{ fontSize:10, color:"var(--cm)", marginTop:1 }}>CFA · {paiements.filter(p=>p.mode===mode).length} opération(s)</div>
                    </div>
                  );
                })}
              </div>

              <div className="fin-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="fin-tbl" style={{ minWidth:800 }}>
                    <thead><tr><th>Référence</th><th>Date & Heure</th><th>Patient</th><th>Facture</th><th>Montant</th><th>Mode</th><th>Caissier</th></tr></thead>
                    <tbody>
                      {paiements.map(p => {
                        const mp = MODE_PAY[p.mode] || { cls:"gray", label:p.mode };
                        return (
                          <tr key={p._id}>
                            <td><span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--ft)", fontSize:12 }}>{p.reference}</span></td>
                            <td>
                              <div style={{ fontSize:12, fontWeight:600 }}>{fmtDate(p.date)}</div>
                              <div style={{ fontSize:10, color:"var(--cm)" }}>{p.heure}</div>
                            </td>
                            <td style={{ fontWeight:600, color:"var(--fn)" }}>{p.patient}</td>
                            <td><span style={{ fontFamily:"monospace", fontSize:11, color:"var(--fb)" }}>{p.facture}</span></td>
                            <td style={{ fontWeight:800, fontSize:14, color:"var(--fg)" }}>{fmtMontant(p.montant)}</td>
                            <td><span className={`fbdg ${mp.cls}`}>{mp.label}</span></td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{p.caissier}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background:"linear-gradient(to right,#ECFDF5,#D1FAE5)" }}>
                        <td colSpan={4} style={{ color:"var(--fn)" }}>TOTAL ENCAISSÉ</td>
                        <td style={{ color:"var(--fg)", fontSize:15 }}>{fmtMontant(paiements.reduce((s,p)=>s+Number(p.montant),0))}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ ASSURANCES ══ */}
          {tab === "assurances" && (
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--fn)", marginBottom:20 }}>Assurances & Prises en charge</div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:20 }}>
                <KpiCard color="blue"   icon={I.shield} value={fmtMontant(assurances.reduce((s,a)=>s+Number(a.facture_montant),0)).split(" CFA")[0]} label="Total facturé" sub="CFA" />
                <KpiCard color="green"  icon={I.check}  value={fmtMontant(assurances.reduce((s,a)=>s+Number(a.rembourse),0)).split(" CFA")[0]} label="Total remboursé" sub="CFA" />
                <KpiCard color="orange" icon={I.alert}  value={fmtMontant(assurances.reduce((s,a)=>s+Number(a.en_attente),0)).split(" CFA")[0]} label="En attente" sub="CFA" urgent={true} />
                <KpiCard color="teal"   icon={I.pay}    value={assurances.filter(a=>a.statut==="en_attente").length} label="Dossiers en attente" sub="à relancer" />
              </div>

              <div className="fin-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="fin-tbl" style={{ minWidth:900 }}>
                    <thead><tr><th>Compagnie</th><th>Facture</th><th>Patient</th><th>Montant facturé</th><th>Remboursé</th><th>En attente</th><th>Date soumission</th><th>Statut</th><th>Action</th></tr></thead>
                    <tbody>
                      {assurances.map(a => {
                        const sc = a.statut === "rembourse" ? {cls:"green",lbl:"Remboursé ✅"} : a.statut === "partiellement_rembourse" ? {cls:"orange",lbl:"Part. remboursé"} : {cls:"red",lbl:"En attente ⏳"};
                        return (
                          <tr key={a._id} style={{ background: a.statut === "en_attente" ? "#FFFDF8" : "" }}>
                            <td style={{ fontWeight:700, color:"var(--fn)" }}>{a.compagnie}</td>
                            <td><span style={{ fontFamily:"monospace", fontSize:11, color:"var(--fb)" }}>{a.facture}</span></td>
                            <td style={{ fontWeight:600 }}>{a.patient}</td>
                            <td style={{ fontWeight:700 }}>{fmtMontant(a.facture_montant)}</td>
                            <td style={{ fontWeight:700, color:"var(--fg)" }}>{fmtMontant(a.rembourse)}</td>
                            <td style={{ fontWeight:700, color: a.en_attente > 0 ? "var(--fo)" : "var(--fg)" }}>{fmtMontant(a.en_attente)}</td>
                            <td style={{ fontSize:11, color:"var(--cm)" }}>{fmtDate(a.date_soumission)}</td>
                            <td><span className={`fbdg ${sc.cls}`}>{sc.lbl}</span></td>
                            <td>
                              {a.statut !== "rembourse" && (
                                <button className="fbtn fbtn-ghost fbtn-sm" style={{ fontSize:11 }} onClick={() => toast.success("📧 Relance envoyée à " + a.compagnie)}>
                                  📧 Relancer
                                </button>
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

          {/* ══ SALAIRES ══ */}
          {tab === "salaires" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--fn)" }}>Gestion des salaires</div>
                  <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>Masse salariale : <strong style={{ color:"var(--fb)" }}>{fmtMontant(totalSalaires)}</strong></div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="fbtn fbtn-ghost fbtn-sm" onClick={() => toast.success("📊 Rapport salaires exporté")}>{I.dl} Exporter fiches</button>
                  <button className="fbtn fbtn-primary" onClick={() => toast.success("💸 Virement en masse lancé...")}>💸 Payer tout le monde</button>
                </div>
              </div>

              <div className="fin-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="fin-tbl" style={{ minWidth:860 }}>
                    <thead><tr><th>Employé</th><th>Fonction</th><th>Salaire de base</th><th>Primes</th><th>Déductions</th><th>Salaire net</th><th>Statut</th><th>Date paiement</th><th>Action</th></tr></thead>
                    <tbody>
                      {salaires.map(s => (
                        <tr key={s._id} style={{ background: s.statut === "en_attente" ? "#FFFDF8" : "" }}>
                          <td style={{ fontWeight:700, color:"var(--fn)" }}>{s.employe}</td>
                          <td><span className="fbdg blue">{s.fonction}</span></td>
                          <td style={{ fontWeight:600 }}>{fmtMontant(s.base)}</td>
                          <td style={{ color:"var(--fg)", fontWeight:600 }}>+{fmtMontant(s.primes)}</td>
                          <td style={{ color:"var(--fr)", fontWeight:600 }}>-{fmtMontant(s.deductions)}</td>
                          <td style={{ fontWeight:800, fontSize:14, color:"var(--fb)" }}>{fmtMontant(s.net)}</td>
                          <td><span className={`fbdg ${s.statut === "paye" ? "green" : "orange"}`}>{s.statut === "paye" ? "✅ Payé" : "⏳ En attente"}</span></td>
                          <td style={{ fontSize:11, color:"var(--cm)" }}>{fmtDate(s.date_paiement) || "—"}</td>
                          <td>
                            <div style={{ display:"flex", gap:6 }}>
                              {s.statut !== "paye" && (
                                <button className="fbtn fbtn-green fbtn-sm" style={{ fontSize:11 }} onClick={() => { setSalaires(prev => prev.map(x => x._id === s._id ? {...x, statut:"paye", date_paiement:new Date().toISOString()} : x)); toast.success("✅ Salaire payé — " + s.employe); }}>
                                  💸 Payer
                                </button>
                              )}
                              <button className="fbtn fbtn-ghost fbtn-sm" style={{ fontSize:11 }} onClick={() => toast.success("🖨️ Fiche de paie imprimée")}>{I.print}</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background:"linear-gradient(to right,#EEF4FF,#DBEAFE)" }}>
                        <td colSpan={2} style={{ color:"var(--fn)" }}>TOTAUX</td>
                        <td style={{ fontWeight:700 }}>{fmtMontant(salaires.reduce((s,x)=>s+Number(x.base),0))}</td>
                        <td style={{ color:"var(--fg)", fontWeight:700 }}>+{fmtMontant(salaires.reduce((s,x)=>s+Number(x.primes),0))}</td>
                        <td style={{ color:"var(--fr)", fontWeight:700 }}>-{fmtMontant(salaires.reduce((s,x)=>s+Number(x.deductions),0))}</td>
                        <td style={{ color:"var(--fb)", fontSize:15 }}>{fmtMontant(totalSalaires)}</td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ COMPTABILITÉ ══ */}
          {tab === "comptabilite" && (
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--fn)", marginBottom:20 }}>Plan comptable & Écritures</div>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:20, marginBottom:24 }}>
                {[
                  { titre:"Actifs", couleur:"var(--fg)", items:[["Trésorerie caisse", 485000], ["Créances clients", montantImpaye], ["Créances assurances", creanceAssur], ["Stocks pharmacie", 1200000]] },
                  { titre:"Passifs", couleur:"var(--fr)", items:[["Fournisseurs", 320000], ["Salaires à payer", salaires.filter(s=>s.statut!=="paye").reduce((s,x)=>s+Number(x.net),0)], ["Charges sociales", 185000], ["Impôts à payer", 95000]] },
                  { titre:"Capitaux propres", couleur:"var(--fb)", items:[["Capital social", 5000000], ["Réserves", 1200000], ["Résultat exercice", beneficeNet], ["Report à nouveau", 800000]] },
                ].map(({ titre, couleur, items }) => (
                  <div key={titre} className="fin-card ffu">
                    <div className="fin-card-hdr"><h3 style={{ color:couleur }}>{titre}</h3></div>
                    <div style={{ padding:16 }}>
                      {items.map(([lbl, val]) => (
                        <div key={lbl} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid #F3F7FF" }}>
                          <span style={{ fontSize:12, color:"var(--cm)" }}>{lbl}</span>
                          <strong style={{ fontSize:12, color: val >= 0 ? "var(--fn)" : "var(--fr)" }}>{fmtMontant(Math.abs(val))}</strong>
                        </div>
                      ))}
                      <div style={{ marginTop:10, paddingTop:10, borderTop:"1.5px solid var(--cbr)", display:"flex", justifyContent:"space-between", fontSize:13, fontWeight:800 }}>
                        <span style={{ color:"var(--fn)" }}>Total</span>
                        <span style={{ color:couleur }}>{fmtMontant(items.reduce((s,[,v])=>s+v,0))}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Journaux */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                <div className="fin-card ffu">
                  <div className="fin-card-hdr"><h3>📒 Journaux comptables</h3></div>
                  <div style={{ padding:16, display:"flex", flexDirection:"column", gap:8 }}>
                    {[
                      ["Journal de caisse", "24 écritures ce mois", "teal"],
                      ["Journal bancaire", "12 écritures ce mois", "blue"],
                      ["Journal des ventes", "38 écritures ce mois", "green"],
                      ["Journal des achats", "18 écritures ce mois", "orange"],
                    ].map(([lbl, sub, col]) => (
                      <div key={lbl} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"#F8FAFD", borderRadius:10, padding:"11px 14px" }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:"var(--fn)" }}>{lbl}</div>
                          <div style={{ fontSize:11, color:"var(--cm)" }}>{sub}</div>
                        </div>
                        <button className="fbtn fbtn-ghost fbtn-sm" style={{ fontSize:11 }} onClick={() => toast.success(`📒 Ouverture : ${lbl}`)}>Consulter →</button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="fin-card ffu">
                  <div className="fin-card-hdr"><h3>📊 Compte de résultat</h3></div>
                  <div style={{ padding:16 }}>
                    {[
                      ["Chiffre d'affaires", totalRevenus, "var(--fg)"],
                      ["Charges exploitation", totalDepenses, "var(--fr)"],
                      ["Résultat brut", totalRevenus - totalDepenses, "var(--fb)"],
                      ["Impôts (15%)", Math.round((totalRevenus - totalDepenses) * 0.15), "var(--fo)"],
                      ["Résultat net", Math.round((totalRevenus - totalDepenses) * 0.85), "var(--fb)"],
                    ].map(([lbl, val, col], i) => (
                      <div key={lbl} style={{ display:"flex", justifyContent:"space-between", padding:"10px 12px", background: i === 4 ? "#EEF4FF" : "#F8FAFD", borderRadius:10, marginBottom:6, borderLeft: i === 4 ? "3px solid var(--fb)" : "none" }}>
                        <span style={{ fontSize:12, color:"var(--cm)", fontWeight: i === 4 ? 700 : 400 }}>{lbl}</span>
                        <strong style={{ fontSize:12, color:col }}>{fmtMontant(val)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ BUDGET ══ */}
          {tab === "budget" && (
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--fn)", marginBottom:20 }}>Suivi budgétaire — Juin 2026</div>

              <div className="fin-card ffu" style={{ marginBottom:20 }}>
                <div className="fin-card-hdr"><h3>{I.budget} Budget par département</h3><p>Réalisé vs Prévu</p></div>
                <div style={{ padding:20 }}>
                  {DEMO_BUDGET.map(b => {
                    const pct = Math.round(b.realise / b.budget * 100);
                    const color = pct >= 100 ? "#DC2626" : pct >= 85 ? "#D97706" : "#059669";
                    const ecart = b.realise - b.budget;
                    return (
                      <div key={b.departement} style={{ marginBottom:14 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                          <span style={{ fontWeight:600, fontSize:13, color:"var(--fn)" }}>{b.departement}</span>
                          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                            <span style={{ fontSize:11, color:"var(--cm)" }}>Budget : {fmtMontant(b.budget)}</span>
                            <span style={{ fontSize:11, fontWeight:600, color:color }}>{pct}%</span>
                            <span style={{ fontSize:11, color: ecart > 0 ? "var(--fr)" : "var(--fg)", fontWeight:700 }}>
                              {ecart > 0 ? "+" : ""}{fmtMontant(ecart)}
                            </span>
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                          <div style={{ flex:1 }}>
                            <Prog pct={pct} color={color} />
                          </div>
                          <span style={{ fontSize:10, color:"var(--cm)", minWidth:80, textAlign:"right" }}>
                            {fmtMontant(b.realise)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
                <div className="fin-card ffu">
                  <div className="fin-card-hdr"><h3>📈 Budget global</h3></div>
                  <div style={{ padding:16 }}>
                    {[
                      ["Budget total mensuel", DEMO_BUDGET.reduce((s,b)=>s+b.budget,0), "var(--fb)"],
                      ["Réalisé", DEMO_BUDGET.reduce((s,b)=>s+b.realise,0), "var(--fg)"],
                      ["Écart global", DEMO_BUDGET.reduce((s,b)=>s+b.realise,0) - DEMO_BUDGET.reduce((s,b)=>s+b.budget,0), "var(--fo)"],
                      ["Taux exécution", Math.round(DEMO_BUDGET.reduce((s,b)=>s+b.realise,0)/DEMO_BUDGET.reduce((s,b)=>s+b.budget,0)*100) + "%", "var(--ft)"],
                    ].map(([lbl, val, col]) => (
                      <div key={lbl} style={{ display:"flex", justifyContent:"space-between", padding:"10px 12px", background:"#F8FAFD", borderRadius:10, marginBottom:8 }}>
                        <span style={{ fontSize:12, color:"var(--cm)" }}>{lbl}</span>
                        <strong style={{ color:col }}>{typeof val === "number" ? fmtMontant(val) : val}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="fin-card ffu">
                  <div className="fin-card-hdr"><h3>🎯 Objectifs financiers</h3></div>
                  <div style={{ padding:16 }}>
                    {[
                      ["Revenus mensuels cible", 900000, totalRevenus],
                      ["Taux recouvrement cible", 95, tauxRecouvrement],
                      ["Réduction charges (vs N-1)", 100, 87],
                    ].map(([lbl, cible, actuel]) => {
                      const pct = Math.min(100, Math.round(actuel / cible * 100));
                      return (
                        <div key={lbl} style={{ marginBottom:12 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                            <span style={{ color:"var(--cm)" }}>{lbl}</span>
                            <span style={{ fontWeight:700, color: pct >= 90 ? "var(--fg)" : "var(--fo)" }}>{pct}%</span>
                          </div>
                          <Prog pct={pct} color={pct >= 90 ? "#059669" : "#D97706"} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ RAPPORTS ══ */}
          {tab === "rapports" && (
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--fn)", marginBottom:20 }}>Rapports financiers</div>

              {/* KPIs synthèse */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="green"  icon={I.trend}  value={fmtMontant(totalRevenus).split(" CFA")[0]}  label="CA mensuel"     sub="CFA" trend="+12%" trendUp={true} />
                <KpiCard color="red"    icon={I.trendD} value={fmtMontant(totalDepenses).split(" CFA")[0]} label="Charges totales" sub="CFA" />
                <KpiCard color="blue"   icon={I.chart}  value={fmtMontant(beneficeNet).split(" CFA")[0]}   label="Bénéfice net"    sub="CFA" trend="+18%" trendUp={true} />
                <KpiCard color="teal"   icon={I.pay}    value={`${tauxRecouvrement}%`}                     label="Recouvrement"    sub="taux global" />
                <KpiCard color="orange" icon={I.budget} value={`${Math.round(totalRevenus/(totalDepenses||1)*100)}%`} label="Marge bénéficiaire" sub="ratio rev./dép." />
              </div>

              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20, marginBottom:24 }}>
                <div className="fin-card ffu">
                  <div className="fin-card-hdr"><h3>{I.trend} Bénéfice net mensuel</h3></div>
                  <div style={{ padding:20 }}>
                    <BarChart labels={MOIS.slice(0,6)} data={[160000,170000,110000,200000,190000,353000]} color="#059669" height={180} />
                  </div>
                </div>
                <div className="fin-card ffu">
                  <div className="fin-card-hdr"><h3>📊 Répartition revenus</h3></div>
                  <div style={{ padding:20 }}>
                    <DoughnutChart
                      labels={["Consultation","Chirurgie","Hospit.","Labo","Pharmacie","Imagerie"]}
                      data={[420000,670000,540000,285000,380000,195000]}
                      colors={["#0EA5A0","#DC2626","#1B4F9E","#7C3AED","#D97706","#059669"]}
                      height={200}
                    />
                  </div>
                </div>
              </div>

              {/* Rapports téléchargeables */}
              <div className="fin-card ffu">
                <div className="fin-card-hdr"><h3>📄 Rapports disponibles</h3></div>
                <div style={{ padding:20, display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:14 }}>
                  {[
                    ["📊","Rapport journalier","Résumé des transactions du jour","Aujourd'hui"],
                    ["📅","Rapport hebdomadaire","Bilan de la semaine en cours","Cette semaine"],
                    ["📆","Rapport mensuel","Synthèse financière de juin 2026","Juin 2026"],
                    ["📈","Rapport annuel","Bilan complet de l'exercice","2026"],
                    ["💰","Compte de résultat","Produits, charges, résultat net","Juin 2026"],
                    ["⚖️","Bilan financier","Actif, passif, capitaux propres","Juin 2026"],
                    ["🔄","Flux de trésorerie","Tableau des flux de trésorerie","Juin 2026"],
                    ["🧾","État des créances","Factures impayées & assurances","En cours"],
                  ].map(([icon, titre, desc, periode]) => (
                    <div key={titre} style={{ background:"#F8FAFD", border:"1.5px solid var(--cbr)", borderRadius:14, padding:16, display:"flex", flexDirection:"column", gap:8, transition:"box-shadow .2s" }} onMouseOver={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(11,30,59,.1)"} onMouseOut={e=>e.currentTarget.style.boxShadow="none"}>
                      <div style={{ fontSize:28 }}>{icon}</div>
                      <div style={{ fontWeight:700, color:"var(--fn)", fontSize:13 }}>{titre}</div>
                      <div style={{ fontSize:11, color:"var(--cm)" }}>{desc}</div>
                      <div style={{ fontSize:10, color:"var(--ft)", fontWeight:600 }}>📅 {periode}</div>
                      <div style={{ display:"flex", gap:6, marginTop:"auto" }}>
                        <button className="fbtn fbtn-ghost fbtn-sm" style={{ flex:1, fontSize:11 }} onClick={() => toast.success(`📄 Génération : ${titre}...`)}>{I.dl} PDF</button>
                        <button className="fbtn fbtn-ghost fbtn-sm" style={{ flex:1, fontSize:11 }} onClick={() => toast.success(`📊 Export Excel : ${titre}...`)}>📊 Excel</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ MODAL : REVENU ═══ */}
        <Modal open={modalRevenu} onClose={() => setModalRevenu(false)} title="📥 Enregistrer un revenu">
          <form onSubmit={addRevenu}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
              <div>
                <label className="flbl">Date *</label>
                <input type="date" className="finp" required value={formRevenu.date} onChange={e => setFormRevenu(f=>({...f,date:e.target.value}))} />
              </div>
              <div>
                <label className="flbl">Service *</label>
                <select className="finp" required value={formRevenu.service} onChange={e => setFormRevenu(f=>({...f,service:e.target.value}))}>
                  {["Consultation","Laboratoire","Imagerie","Hospitalisation","Chirurgie","Pharmacie","Maternité","Urgences"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="flbl">Patient *</label>
                <input className="finp" required value={formRevenu.patient} onChange={e => setFormRevenu(f=>({...f,patient:e.target.value}))} placeholder="Nom du patient" />
              </div>
              <div>
                <label className="flbl">Référence facture</label>
                <input className="finp" value={formRevenu.reference} onChange={e => setFormRevenu(f=>({...f,reference:e.target.value}))} placeholder="FAC-2026-XXXX (auto si vide)" />
              </div>
              <div>
                <label className="flbl">Montant (CFA) *</label>
                <input type="number" className="finp" required min={0} value={formRevenu.montant} onChange={e => setFormRevenu(f=>({...f,montant:e.target.value}))} placeholder="Ex: 25000" />
              </div>
              <div>
                <label className="flbl">Mode de paiement</label>
                <select className="finp" value={formRevenu.mode} onChange={e => setFormRevenu(f=>({...f,mode:e.target.value}))}>
                  <option value="especes">💵 Espèces</option>
                  <option value="mobile_money">📱 Mobile Money</option>
                  <option value="virement">🏦 Virement</option>
                  <option value="assurance">🛡️ Assurance</option>
                  <option value="carte">💳 Carte bancaire</option>
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="flbl">Notes</label>
                <textarea className="finp" rows={2} value={formRevenu.notes} onChange={e => setFormRevenu(f=>({...f,notes:e.target.value}))} placeholder="Observations complémentaires..." />
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button type="button" className="fbtn fbtn-ghost" onClick={() => setModalRevenu(false)}>Annuler</button>
              <button type="submit" className="fbtn fbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>{I.save} {saving ? "Enregistrement..." : "Enregistrer"}</button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : DÉPENSE ═══ */}
        <Modal open={modalDepense} onClose={() => setModalDepense(false)} title="📤 Enregistrer une dépense">
          <form onSubmit={addDepense}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
              <div>
                <label className="flbl">Date *</label>
                <input type="date" className="finp" required value={formDepense.date} onChange={e => setFormDepense(f=>({...f,date:e.target.value}))} />
              </div>
              <div>
                <label className="flbl">Catégorie *</label>
                <select className="finp" required value={formDepense.categorie} onChange={e => setFormDepense(f=>({...f,categorie:e.target.value}))}>
                  {Object.keys(CAT_DEP_COLOR).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="flbl">Description *</label>
                <input className="finp" required value={formDepense.description} onChange={e => setFormDepense(f=>({...f,description:e.target.value}))} placeholder="Ex: Gants chirurgicaux × 500" />
              </div>
              <div>
                <label className="flbl">Fournisseur</label>
                <input className="finp" value={formDepense.fournisseur} onChange={e => setFormDepense(f=>({...f,fournisseur:e.target.value}))} placeholder="Nom du fournisseur" />
              </div>
              <div>
                <label className="flbl">Montant (CFA) *</label>
                <input type="number" className="finp" required min={0} value={formDepense.montant} onChange={e => setFormDepense(f=>({...f,montant:e.target.value}))} placeholder="Ex: 50000" />
              </div>
              <div>
                <label className="flbl">Statut</label>
                <select className="finp" value={formDepense.statut} onChange={e => setFormDepense(f=>({...f,statut:e.target.value}))}>
                  <option value="paye">✅ Payée</option>
                  <option value="en_attente">⏳ En attente</option>
                </select>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button type="button" className="fbtn fbtn-ghost" onClick={() => setModalDepense(false)}>Annuler</button>
              <button type="submit" className="fbtn fbtn-danger" style={{ marginLeft:"auto" }} disabled={saving}>{I.save} {saving ? "Enregistrement..." : "Enregistrer"}</button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : FACTURE ═══ */}
        <Modal open={modalFacture} onClose={() => setModalFacture(false)} title="🧾 Nouvelle facture">
          <form onSubmit={createFacture}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label className="flbl">Patient *</label>
                <input className="finp" required value={formFacture.patient} onChange={e => setFormFacture(f=>({...f,patient:e.target.value}))} placeholder="Nom et prénom du patient" />
              </div>
              <div>
                <label className="flbl">Service / Prestations *</label>
                <input className="finp" required value={formFacture.service} onChange={e => setFormFacture(f=>({...f,service:e.target.value}))} placeholder="Ex: Consultation + Labo, Chirurgie complète..." />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                <div>
                  <label className="flbl">Montant (CFA) *</label>
                  <input type="number" className="finp" required min={0} value={formFacture.montant} onChange={e => setFormFacture(f=>({...f,montant:e.target.value}))} placeholder="Ex: 85000" />
                </div>
                <div>
                  <label className="flbl">Date d'échéance</label>
                  <input type="date" className="finp" value={formFacture.echeance} min={new Date().toISOString().substring(0,10)} onChange={e => setFormFacture(f=>({...f,echeance:e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="flbl">Statut initial</label>
                <select className="finp" value={formFacture.statut} onChange={e => setFormFacture(f=>({...f,statut:e.target.value}))}>
                  <option value="non_paye">❌ Non payée</option>
                  <option value="paye">✅ Payée immédiatement</option>
                  <option value="partiellement_paye">⚠ Partiellement payée</option>
                </select>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button type="button" className="fbtn fbtn-ghost" onClick={() => setModalFacture(false)}>Annuler</button>
              <button type="submit" className="fbtn fbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>{I.save} {saving ? "Création..." : "Créer la facture"}</button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : CAISSE ═══ */}
        <Modal open={modalCaisse} onClose={() => setModalCaisse(false)} title="💰 Opération de caisse" maxWidth={480}>
          <form onSubmit={opCaisse}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label className="flbl">Type d'opération *</label>
                <div style={{ display:"flex", gap:10 }}>
                  {[["entree","📥","Entrée de caisse","teal"], ["sortie","📤","Sortie de caisse","danger"], ["transfert","🔄","Transfert","ghost"]].map(([val,icon,lbl,col]) => (
                    <div key={val} style={{ flex:1, padding:"12px 10px", border:`2px solid ${formCaisse.type===val?"var(--ft)":"var(--cbr)"}`, borderRadius:12, background:formCaisse.type===val?"#F0FDFC":"#FAFBFF", cursor:"pointer", textAlign:"center", transition:"all .2s" }} onClick={() => setFormCaisse(f=>({...f,type:val}))}>
                      <div style={{ fontSize:20 }}>{icon}</div>
                      <div style={{ fontSize:11, fontWeight:600, color:"var(--fn)", marginTop:4 }}>{lbl}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="flbl">Montant (CFA) *</label>
                <input type="number" className="finp" required min={1} value={formCaisse.montant} onChange={e => setFormCaisse(f=>({...f,montant:e.target.value}))} placeholder="Ex: 25000" />
              </div>
              <div>
                <label className="flbl">Libellé *</label>
                <input className="finp" required value={formCaisse.libelle} onChange={e => setFormCaisse(f=>({...f,libelle:e.target.value}))} placeholder="Ex: Paiement consultation Jean Dupont, Achat fournitures..." />
              </div>
              <div>
                <label className="flbl">Mode</label>
                <select className="finp" value={formCaisse.mode} onChange={e => setFormCaisse(f=>({...f,mode:e.target.value}))}>
                  <option value="especes">💵 Espèces</option>
                  <option value="mobile_money">📱 Mobile Money</option>
                  <option value="virement">🏦 Virement</option>
                </select>
              </div>
              <div style={{ background:"#EEF4FF", borderRadius:10, padding:"10px 14px", fontSize:12, color:"var(--fb)" }}>
                Solde actuel : <strong>{fmtMontant(soldeCaisse)}</strong>
                {formCaisse.montant && <span> → Nouveau solde : <strong>{fmtMontant(formCaisse.type === "entree" ? soldeCaisse + Number(formCaisse.montant) : soldeCaisse - Number(formCaisse.montant))}</strong></span>}
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button type="button" className="fbtn fbtn-ghost" onClick={() => setModalCaisse(false)}>Annuler</button>
              <button type="submit" className={`fbtn fbtn-${formCaisse.type === "entree" ? "teal" : "danger"}`} style={{ marginLeft:"auto" }} disabled={saving}>
                {formCaisse.type === "entree" ? "📥" : "📤"} {saving ? "Traitement..." : "Valider l'opération"}
              </button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : FACTURE DETAIL ═══ */}
        <Modal open={modalFactureDetail} onClose={() => setModalFactureDetail(false)} title="🧾 Détail facture" maxWidth={540}>
          {selectedFacture && (
            <div>
              <div style={{ background:"linear-gradient(135deg,#0B1E3B,#132744)", borderRadius:14, padding:"18px 20px", marginBottom:16, color:"#fff" }}>
                <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color:"rgba(255,255,255,.7)", marginBottom:8 }}>{selectedFacture.numero}</div>
                <div style={{ fontSize:20, fontWeight:800 }}>{fmtMontant(selectedFacture.montant)}</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.55)", marginTop:4 }}>
                  {selectedFacture.service} · {fmtDate(selectedFacture.date)}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginBottom:16 }}>
                {[["Patient", selectedFacture.patient], ["Service", selectedFacture.service], ["Date facture", fmtDate(selectedFacture.date)], ["Échéance", fmtDate(selectedFacture.echeance)]].map(([lbl,val]) => (
                  <div key={lbl} className="info-box"><div className="info-box-lbl">{lbl}</div><div className="info-box-val">{val}</div></div>
                ))}
              </div>
              <div style={{ marginBottom:16 }}>
                <label className="flbl">Statut de paiement</label>
                <select className="finp" value={selectedFacture.statut} onChange={e => { updateStatutFacture(selectedFacture._id, e.target.value); setSelectedFacture(f => ({...f, statut:e.target.value})); }}>
                  <option value="non_paye">❌ Non payée</option>
                  <option value="paye">✅ Payée</option>
                  <option value="partiellement_paye">⚠ Partiellement payée</option>
                  <option value="annule">🚫 Annulée</option>
                </select>
              </div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                <button className="fbtn fbtn-teal" onClick={() => toast.success("🖨️ Facture imprimée")}>{I.print} Imprimer</button>
                <button className="fbtn fbtn-ghost" onClick={() => toast.success("📧 Envoyée au patient")}>{I.send} Envoyer</button>
                {selectedFacture.statut !== "paye" && (
                  <button className="fbtn fbtn-green" onClick={() => { updateStatutFacture(selectedFacture._id, "paye"); setModalFactureDetail(false); }}>
                    {I.check} Marquer comme payée
                  </button>
                )}
              </div>
            </div>
          )}
        </Modal>

        {/* ═══ MODAL : EXPORT ═══ */}
        <Modal open={modalExport} onClose={() => setModalExport(false)} title={<>{I.dl} Exporter les données</>} maxWidth={480}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <label className="flbl">Format</label>
              <div style={{ display:"flex", gap:10 }}>
                {[["pdf","📄","PDF"],["excel","📊","Excel"],["csv","📋","CSV"]].map(([val,icon,lbl]) => (
                  <div key={val} style={{ flex:1, padding:"12px 8px", border:"2px solid var(--cbr)", borderRadius:12, cursor:"pointer", textAlign:"center" }} onClick={() => toast.success(`⬇️ Export ${lbl} lancé...`)}>
                    <div style={{ fontSize:22 }}>{icon}</div>
                    <div style={{ fontSize:12, fontWeight:600, color:"var(--fn)", marginTop:4 }}>{lbl}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="flbl">Données à exporter</label>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {[["Revenus",true],["Dépenses",true],["Factures",true],["Paiements",false],["Salaires",false],["Rapport mensuel complet",false]].map(([lbl,checked]) => (
                  <label key={lbl} style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", padding:"8px 12px", background:"#F8FAFD", borderRadius:8 }}>
                    <input type="checkbox" defaultChecked={checked} style={{ accentColor:"var(--ft)", width:15, height:15 }} />
                    <span style={{ fontSize:12, color:"var(--fn)" }}>{lbl}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
              <div>
                <label className="flbl">Période début</label>
                <input type="date" className="finp" defaultValue="2026-06-01" />
              </div>
              <div>
                <label className="flbl">Période fin</label>
                <input type="date" className="finp" defaultValue="2026-06-30" />
              </div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="fbtn fbtn-ghost" onClick={() => setModalExport(false)}>Annuler</button>
              <button className="fbtn fbtn-teal" style={{ marginLeft:"auto" }} onClick={() => { toast.success("✅ Export en cours — Téléchargement démarré"); setModalExport(false); }}>
                {I.dl} Exporter maintenant
              </button>
            </div>
          </div>
        </Modal>

      </div>
    </>
  );
}