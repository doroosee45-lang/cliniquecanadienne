



import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchInvoices, fetchFinanceStats, createInvoice, recordPayment,
  selectInvoices, selectFinanceStats, selectFinanceLoading, selectFinanceSaving,
} from '../store/slices/financeSlice';
import api from "../api";
import toast from "react-hot-toast";
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Wallet, Download, Banknote, Plus } from 'lucide-react';
import Hero from '../components/UI/Hero';
import Button from '../components/UI/Button';
import * as XLSX from 'xlsx';
import { CLINIC_NAME, CLINIC_SUBTITLE } from '../config/clinic';

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
const fmtMontant = (v) => { const n = Number(v); return (!isNaN(n) ? n : 0).toLocaleString("fr-FR") + " CFA"; };
const genRef = (prefix) => `${prefix}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, "0")}`;

// Adapter Invoice (modèle backend) → champs affichés dans le frontend
const normalizeFacture = (f) => {
  const pat = f.patient && typeof f.patient === 'object' ? f.patient : null;
  const statutMap = { emise:'non_paye', payee:'paye', partiellement_payee:'partiellement_paye', annulee:'annule', contentieux:'non_paye', brouillon:'non_paye' };
  return {
    ...f,
    numero:   f.numero          || f.numero_facture  || genRef("FAC"),
    date:     f.date            || f.date_facture     || f.createdAt,
    echeance: f.echeance        || f.date_echeance    || null,
    patient:  pat ? `${pat.prenom || ''} ${pat.nom || ''}`.trim() : (typeof f.patient === 'string' ? f.patient : f.patient_nom || '—'),
    service:  f.service         || f.service_label    || '—',
    montant:  Number(f.montant  || f.montant_direct   || f.montant_ttc || 0),
    statut:   statutMap[f.statut] || f.statut         || 'non_paye',
  };
};

// ── Impression HTML dans une nouvelle fenêtre ────────────────
const printInvoice = (f) => {
  const clinicFull = `${CLINIC_NAME} ${CLINIC_SUBTITLE}`;
  const statutLabel = f.statut === 'paye' ? '✓ Payée' : f.statut === 'partiellement_paye' ? '⚠ Part. payée' : '✗ Non payée';
  const statutCls   = f.statut === 'paye' ? 'paye' : f.statut === 'partiellement_paye' ? 'partial' : 'non_paye';
  const win = window.open('', '_blank', 'width=820,height=1000');
  if (!win) { window.print(); return; }
  win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>Facture ${f.numero} — ${clinicFull}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif}
body{background:#f5f7fa;padding:0;font-size:10pt;color:#1a1a2e}
.page{max-width:760px;margin:0 auto;background:#fff;box-shadow:0 2px 20px rgba(0,0,0,.08)}
/* Bandeau header */
.inv-header{background:linear-gradient(135deg,#0B1E3B 0%,#1B4F9E 100%);padding:28px 36px;display:flex;justify-content:space-between;align-items:flex-start}
.clinic-name{font-size:17pt;font-weight:800;color:#fff;letter-spacing:-.3px}
.clinic-sub{font-size:8pt;color:rgba(255,255,255,.6);margin-top:5px;line-height:1.6}
.inv-title-box{text-align:right}
.inv-title-box h1{font-size:26pt;font-weight:800;color:#0EA5A0;letter-spacing:-1px;line-height:1}
.inv-num{font-size:10pt;color:rgba(255,255,255,.7);margin-top:4px;font-family:monospace;font-weight:700}
.badge{display:inline-block;padding:4px 14px;border-radius:99px;font-size:8.5pt;font-weight:700;margin-top:8px}
.paye{background:#DCFCE7;color:#15803D}.non_paye{background:#FEE2E2;color:#DC2626}.partial{background:#FEF3C7;color:#D97706}
/* Corps */
.body{padding:32px 36px}
/* Grid infos */
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px}
.info-box{background:#F8FAFD;border:1px solid #E2EAF4;border-radius:10px;padding:14px 16px}
.info-box-lbl{font-size:7.5pt;text-transform:uppercase;letter-spacing:1px;color:#6B7A99;font-weight:700;margin-bottom:6px}
.info-box-val{font-size:12pt;font-weight:700;color:#0B1E3B}
.info-box-sub{font-size:8.5pt;color:#6B7A99;margin-top:3px}
/* Tableau */
table{width:100%;border-collapse:collapse;margin-bottom:24px}
thead tr{background:#0B1E3B}
th{padding:10px 12px;text-align:left;font-size:8pt;text-transform:uppercase;letter-spacing:.6px;color:#fff;font-weight:700}
td{padding:12px;border-bottom:1px solid #EEF4FF;font-size:9.5pt;color:#1a1a2e}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover{background:#F8FAFD}
.ar{text-align:right;font-weight:700}
/* Totaux */
.totals-wrap{display:flex;justify-content:flex-end;margin-bottom:28px}
.totals-box{min-width:280px;border:1.5px solid #E2EAF4;border-radius:12px;overflow:hidden}
.t-row{display:flex;justify-content:space-between;padding:9px 16px;border-bottom:1px solid #EEF4FF;font-size:9.5pt;color:#6B7A99}
.t-row.total{background:#0B1E3B;color:#fff;font-size:12pt;font-weight:800;border-bottom:none}
/* Paiement */
.pay-note{background:#F0FDFC;border:1.5px solid #0EA5A030;border-left:4px solid #0EA5A0;border-radius:10px;padding:12px 16px;margin-bottom:24px;font-size:9pt;color:#0D9490}
/* Footer */
.inv-footer{background:#F8FAFD;border-top:2px solid #E2EAF4;padding:16px 36px;text-align:center;font-size:8pt;color:#9CA3AF;line-height:1.6}
@media print{body{background:#fff}.page{box-shadow:none}button{display:none}}
</style></head><body>
<div class="page">
  <div class="inv-header">
    <div>
      <div class="clinic-name">🏥 ${clinicFull}</div>
      <div class="clinic-sub">BP 123, Souanké, Sangha-Mbaéré, Congo<br>Tél : +236 XX XX XX XX &nbsp;·&nbsp; Email : clinique@souanke.cg</div>
    </div>
    <div class="inv-title-box">
      <h1>FACTURE</h1>
      <div class="inv-num">${f.numero}</div>
      <div><span class="badge ${statutCls}">${statutLabel}</span></div>
    </div>
  </div>

  <div class="body">
    <div class="info-grid">
      <div class="info-box">
        <div class="info-box-lbl">Facturé à</div>
        <div class="info-box-val">👤 ${f.patient || 'N/A'}</div>
        <div class="info-box-sub">Patient — ${clinicFull}</div>
      </div>
      <div class="info-box">
        <div class="info-box-lbl">Informations facture</div>
        <div class="info-box-val" style="font-family:monospace;font-size:11pt">${f.numero}</div>
        <div class="info-box-sub">Émise le ${fmtDate(f.date)}</div>
        <div class="info-box-sub">Échéance : <strong style="color:${f.echeance && new Date(f.echeance)<new Date()&&f.statut!=='paye'?'#DC2626':'inherit'}">${fmtDate(f.echeance) || '—'}</strong></div>
      </div>
    </div>

    <table>
      <thead><tr><th>Prestation / Service</th><th>Quantité</th><th>P.U.</th><th class="ar">Montant</th></tr></thead>
      <tbody>
        <tr><td>${f.service || 'Prestation médicale'}</td><td>1</td><td>${fmtMontant(f.montant)}</td><td class="ar">${fmtMontant(f.montant)}</td></tr>
      </tbody>
    </table>

    <div class="totals-wrap">
      <div class="totals-box">
        <div class="t-row"><span>Sous-total HT</span><span>${fmtMontant(f.montant)}</span></div>
        <div class="t-row"><span>Taxes (0%)</span><span>0 CFA</span></div>
        <div class="t-row total"><span>TOTAL TTC</span><span>${fmtMontant(f.montant)}</span></div>
      </div>
    </div>

    ${f.statut !== 'paye' ? `<div class="pay-note">
      💳 <strong>Mode de règlement acceptés :</strong> Espèces · Mobile Money · Virement bancaire · Assurance maladie<br>
      Merci de régler avant le <strong>${fmtDate(f.echeance) || 'la date d\'échéance'}</strong>. En cas de question, contactez le service comptabilité.
    </div>` : `<div class="pay-note" style="background:#ECFDF5;border-color:#059669;border-left-color:#059669;color:#065F46">
      ✅ <strong>Cette facture a été entièrement réglée.</strong> Merci pour votre confiance.
    </div>`}
  </div>

  <div class="inv-footer">
    <strong>${clinicFull}</strong> — Souanké, Sangha-Mbaéré, République du Congo<br>
    Document officiel généré automatiquement · Toute question : comptabilite@${CLINIC_NAME.toLowerCase().replace(/\s/g,'')}.cg
  </div>
</div>
<script>window.onload=()=>{window.print()}</script>
</body></html>`);
  win.document.close();
};

// ── Téléchargement PDF via jsPDF ─────────────────────────────
const downloadInvoicePDF = (f) => {
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const clinicFull = `${CLINIC_NAME} ${CLINIC_SUBTITLE}`;
  const dateStr = new Date().toLocaleDateString('fr-FR');

  // ── Bandeau header navy ──
  doc.setFillColor(11,30,59);
  doc.rect(0,0,W,38,'F');
  doc.setFillColor(14,165,160);
  doc.rect(0,38,W,2,'F');

  // Nom clinique
  doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(255,255,255);
  doc.text(`🏥 ${clinicFull}`, 14, 14);
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(180,200,230);
  doc.text('BP 123, Souanké, Sangha-Mbaéré, Congo  ·  clinique@souanke.cg', 14, 22);
  doc.text(`Tél : +236 XX XX XX XX`, 14, 29);

  // FACTURE titre + numéro (droite)
  doc.setFont('helvetica','bold'); doc.setFontSize(22); doc.setTextColor(14,165,160);
  doc.text('FACTURE', W-14, 16, { align:'right' });
  doc.setFontSize(9); doc.setTextColor(200,220,255); doc.setFont('helvetica','normal');
  doc.text(f.numero, W-14, 24, { align:'right' });
  doc.text(dateStr, W-14, 31, { align:'right' });

  // ── Statut badge ──
  const statusColor = f.statut==='paye' ? [5,150,105] : f.statut==='partiellement_paye' ? [217,119,6] : [220,38,38];
  const statusLabel = f.statut==='paye' ? 'PAYÉE' : f.statut==='partiellement_paye' ? 'PART. PAYÉE' : 'NON PAYÉE';
  doc.setFillColor(...statusColor);
  doc.roundedRect(14,46,36,8,2,2,'F');
  doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
  doc.text(statusLabel, 32, 51.5, { align:'center' });

  // ── Blocs info ──
  doc.setDrawColor(226,234,244); doc.setLineWidth(0.3);
  // Bloc patient
  doc.setFillColor(248,250,253); doc.roundedRect(14,58,85,28,3,3,'F');
  doc.rect(14,58,85,28,'S');
  doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(107,122,153);
  doc.text('FACTURÉ À', 18, 65);
  doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(11,30,59);
  doc.text(f.patient || 'N/A', 18, 73);
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(107,122,153);
  doc.text(`Patient — ${clinicFull}`, 18, 80);
  // Bloc détails
  doc.setFillColor(248,250,253); doc.roundedRect(105,58,91,28,3,3,'F');
  doc.rect(105,58,91,28,'S');
  doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(107,122,153);
  doc.text('DÉTAILS FACTURE', 109, 65);
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(11,30,59);
  doc.text(`N° ${f.numero}`, 109, 72);
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(107,122,153);
  doc.text(`Émise le : ${fmtDate(f.date)}`, 109, 79);
  doc.text(`Échéance : ${fmtDate(f.echeance) || '—'}`, 109, 84.5);

  // ── Tableau prestations ──
  autoTable(doc, {
    startY: 95,
    margin: { left:14, right:14 },
    head:[['Prestation / Service','Quantité','Prix unitaire','Montant TTC']],
    body:[[ f.service || 'Prestation médicale', '1', fmtMontant(f.montant), fmtMontant(f.montant) ]],
    headStyles:{ fillColor:[11,30,59], textColor:255, fontStyle:'bold', fontSize:9, halign:'left' },
    bodyStyles:{ fontSize:10, textColor:[30,30,50], cellPadding:5 },
    columnStyles:{ 0:{cellWidth:85}, 1:{halign:'center',cellWidth:20}, 2:{halign:'right',cellWidth:40}, 3:{halign:'right',cellWidth:40,fontStyle:'bold'} },
    alternateRowStyles:{ fillColor:[248,250,253] },
  });

  const endY = doc.lastAutoTable.finalY;

  // ── Totaux ──
  doc.setFillColor(248,250,253); doc.rect(W-86,endY+6,72,24,'F');
  doc.setDrawColor(226,234,244); doc.rect(W-86,endY+6,72,24,'S');
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(107,122,153);
  doc.text('Sous-total HT :', W-82, endY+14);
  doc.text('Taxes (0%) :', W-82, endY+20);
  doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(11,30,59);
  doc.text(fmtMontant(f.montant), W-16, endY+14, { align:'right' });
  doc.text('0 CFA', W-16, endY+20, { align:'right' });

  // Ligne totale colorée
  doc.setFillColor(11,30,59); doc.rect(W-86,endY+30,72,12,'F');
  doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
  doc.text('TOTAL TTC', W-82, endY+38);
  doc.setTextColor(14,165,160);
  doc.text(fmtMontant(f.montant), W-16, endY+38, { align:'right' });

  // ── Note paiement ──
  const noteY = endY + 50;
  if (f.statut !== 'paye') {
    doc.setFillColor(240,253,252); doc.roundedRect(14,noteY,W-28,14,3,3,'F');
    doc.setDrawColor(14,165,160); doc.setLineWidth(0.5); doc.line(14,noteY,14,noteY+14);
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(13,148,136);
    doc.text('Règlement accepté : Espèces · Mobile Money · Virement · Assurance', 18, noteY+6);
    doc.text(`Merci de régler avant le ${fmtDate(f.echeance) || "la date d'échéance"}.`, 18, noteY+11);
  } else {
    doc.setFillColor(236,253,245); doc.roundedRect(14,noteY,W-28,12,3,3,'F');
    doc.setDrawColor(5,150,105); doc.setLineWidth(0.5); doc.line(14,noteY,14,noteY+12);
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(5,150,105);
    doc.text('✓  Facture entièrement réglée — Merci pour votre confiance.', 18, noteY+7.5);
  }

  // ── Footer ──
  doc.setFillColor(248,250,253);
  doc.rect(0,H-18,W,18,'F');
  doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(150,150,160);
  doc.text(`${clinicFull} — Souanké, Sangha-Mbaéré, République du Congo`, W/2, H-10, { align:'center' });
  doc.text('Document officiel · Usage interne et comptable', W/2, H-5, { align:'center' });
  doc.setTextColor(107,122,153);
  doc.text(dateStr, 14, H-10);
  doc.text(`Page 1/1`, W-14, H-10, { align:'right' });

  doc.save(`facture-${f.numero}-${new Date().toISOString().split('T')[0]}.pdf`);
};

const shareWhatsApp = (f) => {
  const clinicFull = `${CLINIC_NAME} ${CLINIC_SUBTITLE}`;
  const msg = `🏥 *${clinicFull}*\n\n📋 *FACTURE N° ${f.numero}*\n\n👤 Patient : ${f.patient}\n💼 Service : ${f.service}\n💰 Montant : ${fmtMontant(f.montant)}\n📅 Date : ${fmtDate(f.date)}\n⏰ Échéance : ${fmtDate(f.echeance)}\n✅ Statut : ${f.statut === 'paye' ? 'Payée ✓' : f.statut === 'partiellement_paye' ? 'Partiellement payée ⚠' : 'Non payée ✗'}\n\nModes de paiement : Espèces · Mobile Money · Virement · Assurance\n\n📞 Contact : +236 XX XX XX XX`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
};

const shareEmail = (f) => {
  const clinicFull = `${CLINIC_NAME} ${CLINIC_SUBTITLE}`;
  const subject = `Facture N° ${f.numero} — ${clinicFull}`;
  const statutTxt = f.statut === 'paye' ? 'Payée' : f.statut === 'partiellement_paye' ? 'Partiellement payée' : 'Non payée';
  const body = `Bonjour,\n\nVeuillez trouver ci-dessous votre facture de la ${clinicFull}.\n\nN° Facture  : ${f.numero}\nPatient     : ${f.patient}\nPrestation  : ${f.service}\nMontant     : ${fmtMontant(f.montant)}\nDate émise  : ${fmtDate(f.date)}\nÉchéance    : ${fmtDate(f.echeance)}\nStatut      : ${statutTxt}\n\nPour toute question, contactez notre service comptabilité.\n\nCordialement,\nService Comptabilité — ${clinicFull}\nTél : +236 XX XX XX XX`;
  window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
};

// ─── Demo data ────────────────────────────────────────────────
const DEMO_REVENUS = [];

const DEMO_DEPENSES = [];

const DEMO_FACTURES = [];

const DEMO_PAIEMENTS = [];

const DEMO_ASSURANCES = [];

const DEMO_SALAIRES = [];

const DEMO_BUDGET = [];

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
const EMPTY_FACTURE = { patient_id: "", patient_nom: "", service: "", montant: "", echeance: "", statut: "non_paye" };
const EMPTY_CAISSE    = { type: "entree", montant: "", libelle: "", mode: "especes" };
const EMPTY_PAIEMENT  = { facture_id: "", facture_num: "", patient: "", montant_restant: 0, montant: "", mode: "especes", reference: "" };

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
  const [modalPaiement, setModalPaiement] = useState(false);
  const [formPaiement, setFormPaiement] = useState(EMPTY_PAIEMENT);
  const [paiementFactureQ, setPaiementFactureQ] = useState("");

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

  // Recherche patient pour formulaire facture
  const [patientResults, setPatientResults] = useState([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const patientTimer = useRef(null);

  const searchPatients = (q) => {
    if (patientTimer.current) clearTimeout(patientTimer.current);
    if (!q || q.length < 2) { setPatientResults([]); return; }
    patientTimer.current = setTimeout(async () => {
      setPatientSearching(true);
      try {
        const { data } = await api.get(`/patients/search?q=${encodeURIComponent(q)}`);
        setPatientResults(data.patients || []);
      } catch { setPatientResults([]); }
      finally { setPatientSearching(false); }
    }, 280);
  };

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
      if (revRes.status  === "fulfilled") setRevenus((revRes.value.data.revenus || revRes.value.data.data || []).map(r => ({ ...r, patient: r.patient && typeof r.patient === 'object' ? `${r.patient.prenom||''} ${r.patient.nom||''}`.trim() : (r.patient || r.patient_nom || '—') })));
      if (depRes.status  === "fulfilled") setDepenses(depRes.value.data.depenses || depRes.value.data.data  || []);
      if (factRes.status === "fulfilled") {
        const raw = factRes.value.data.invoices || factRes.value.data.factures || factRes.value.data.data || [];
        setFactures(raw.map(normalizeFacture));
      }
      if (payRes.status  === "fulfilled") setPaiements((payRes.value.data.paiements || payRes.value.data.data || []).map(p => ({ ...p, patient: p.patient && typeof p.patient === 'object' ? `${p.patient.prenom||''} ${p.patient.nom||''}`.trim() : (p.patient || '—') })));
      if (assRes.status  === "fulfilled") setAssurances(assRes.value.data.assurances || []);
      if (salRes.status  === "fulfilled") setSalaires(salRes.value.data.salaires   || []);
      if (kpiRes.status  === "fulfilled") setKpis(kpiRes.value.data || {});
    } catch (err) {
      console.error("Erreur chargement finance:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeRefresh(loadData);

  // ── Computed KPIs ────────────────────────────────────────
  const safeNum = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };
  const totalRevenus   = revenus.reduce((s, r) => s + safeNum(r.montant), 0);
  const totalDepenses  = depenses.reduce((s, d) => s + safeNum(d.montant), 0);
  const beneficeNet    = totalRevenus - totalDepenses;
  const facturesImpayees = factures.filter(f => f.statut === "non_paye");
  const montantImpaye  = facturesImpayees.reduce((s, f) => s + safeNum(f.montant), 0);
  const creanceAssur   = assurances.filter(a => a.statut !== "rembourse").reduce((s, a) => s + safeNum(a.en_attente), 0);
  const totalSalaires  = salaires.reduce((s, sl) => s + safeNum(sl.net), 0);
  const soldeCaisse    = kpis.solde_caisse || 0;
  const tauxRecouvrement = totalRevenus > 0 ? Math.round(((totalRevenus - montantImpaye) / totalRevenus) * 100) : 0;

  // ── Agrégations par mois (depuis les données réelles) ────────
  const revByMonth = Array(12).fill(0);
  revenus.forEach(r => { const m = r.date ? new Date(r.date).getMonth() : -1; if (m >= 0) revByMonth[m] += Number(r.montant||0); });
  const depByMonth = Array(12).fill(0);
  depenses.forEach(d => { const m = d.date ? new Date(d.date).getMonth() : -1; if (m >= 0) depByMonth[m] += Number(d.montant||0); });
  const benefByMonth = revByMonth.map((r, i) => r - depByMonth[i]);

  // ── Agrégations par service (depuis les données réelles) ─────
  const SERVICE_KEYS   = ["Consultation","Laboratoire","Chirurgie","Imagerie","Hospitalisation","Pharmacie","Maternité","Urgences"];
  const SERVICE_SHORT  = ["Consultation","Labo","Chirurgie","Imagerie","Hospit.","Pharmacie","Maternité","Urgences"];
  const SERVICE_COLORS = ["#0EA5A0","#7C3AED","#DC2626","#059669","#1B4F9E","#D97706","#CA8A04","#6B7A99"];
  const revByService   = SERVICE_KEYS.map(s => revenus.filter(r => r.service === s).reduce((sum,r) => sum + Number(r.montant||0), 0));

  // ── Encaissements par mode (depuis paiements réels) ──────────
  const encByMode = { especes:0, mobile_money:0, virement:0, assurance:0, carte:0 };
  paiements.forEach(p => { const m = p.mode || 'especes'; if (m in encByMode) encByMode[m] += Number(p.montant||0); });

  // ── Add revenu ───────────────────────────────────────────
  const addRevenu = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/finance/revenus", { ...formRevenu, reference: formRevenu.reference || genRef("FAC") });
      toast.success("✅ Revenu enregistré");
      const newR = data.revenu || { ...formRevenu, _id: Date.now(), reference: genRef("FAC") };
      const patObj = newR.patient && typeof newR.patient === 'object';
      setRevenus(prev => [{ ...newR, patient: patObj ? `${newR.patient.prenom||''} ${newR.patient.nom||''}`.trim() : (newR.patient || '—') }, ...prev]);
      setModalRevenu(false); setFormRevenu(EMPTY_REVENU);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Erreur lors de l'enregistrement du revenu");
    } finally {
      setSaving(false);
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
      setModalDepense(false); setFormDepense(EMPTY_DEPENSE);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Erreur lors de l'enregistrement de la dépense");
    } finally {
      setSaving(false);
    }
  };

  // ── Create facture ───────────────────────────────────────
  const createFacture = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        service:  formFacture.service,
        montant:  Number(formFacture.montant),
        echeance: formFacture.echeance || undefined,
        statut:   formFacture.statut,
      };
      if (formFacture.patient_id) {
        payload.patient = formFacture.patient_id;
      } else {
        payload.patient_nom = formFacture.patient_nom;
      }
      const { data } = await api.post("/finance/factures", payload);
      const facture = normalizeFacture(data.facture || data.invoice || {});
      setFactures(prev => [facture, ...prev]);
      toast.success(`✅ Facture ${facture.numero} créée`);
      setModalFacture(false);
      setFormFacture(EMPTY_FACTURE);
      setPatientResults([]);
      // Ouvrir directement le détail avec options impression/partage
      setSelectedFacture(facture);
      setModalFactureDetail(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Erreur lors de la création de la facture");
    } finally {
      setSaving(false);
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

  // ── Enregistrer un paiement sur une facture ─────────────
  const enregistrerPaiement = async (e) => {
    e.preventDefault();
    if (!formPaiement.facture_id) { toast.error("Sélectionnez une facture"); return; }
    if (!formPaiement.montant || Number(formPaiement.montant) <= 0) { toast.error("Montant invalide"); return; }
    setSaving(true);
    try {
      const { data } = await api.post(`/finance/${formPaiement.facture_id}/paiement`, {
        montant:   Number(formPaiement.montant),
        mode:      formPaiement.mode,
        reference: formPaiement.reference || undefined,
      });
      // Mettre à jour la facture dans la liste
      const updated = normalizeFacture(data.invoice || {});
      if (updated._id) setFactures(prev => prev.map(f => f._id === updated._id ? updated : f));
      // Ajouter le paiement à l'historique local
      const newPay = {
        _id:       `local-${Date.now()}`,
        reference: formPaiement.reference || formPaiement.facture_num,
        date:      new Date(),
        heure:     new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }),
        patient:   formPaiement.patient,
        facture:   formPaiement.facture_num,
        montant:   Number(formPaiement.montant),
        mode:      formPaiement.mode,
        caissier:  'Caisse',
      };
      setPaiements(prev => [newPay, ...prev]);
      toast.success(`✅ Paiement de ${Number(formPaiement.montant).toLocaleString("fr-FR")} CFA enregistré`);
      setModalPaiement(false);
      setFormPaiement(EMPTY_PAIEMENT);
      setPaiementFactureQ("");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Erreur lors de l'enregistrement du paiement");
    } finally {
      setSaving(false);
    }
  };

  // ── Update statut facture ────────────────────────────────
  const updateStatutFacture = async (id, statutFront) => {
    const statutMap = { non_paye:'emise', paye:'payee', partiellement_paye:'partiellement_payee', annule:'annulee' };
    try { await api.put(`/finance/${id}`, { statut: statutMap[statutFront] || statutFront }); } catch { /* local */ }
    setFactures(prev => prev.map(f => f._id === id ? { ...f, statut: statutFront } : f));
    if (statutFront === "paye") toast.success("✅ Facture marquée comme payée");
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

  // ── Export PDF ───────────────────────────────────────────────
  const exportFinancePDF = () => {
    const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
    const W = doc.internal.pageSize.getWidth();
    const dateStr = new Date().toLocaleDateString('fr-FR');
    doc.setFillColor(11,30,59); doc.rect(0,0,W,24,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text(`RAPPORT FINANCIER — ${CLINIC_NAME.toUpperCase()}`, W/2, 10, { align:'center' });
    doc.setFontSize(8.5); doc.setFont('helvetica','normal');
    doc.text(`${CLINIC_NAME} ${CLINIC_SUBTITLE} · Généré le ${dateStr}`, W/2, 17, { align:'center' });
    autoTable(doc, {
      startY:30, margin:{left:14,right:14},
      head:[['Indicateur','Valeur','Indicateur','Valeur']],
      body:[
        ['Revenus totaux', `${totalRevenus.toLocaleString('fr-FR')} CFA`, 'Dépenses totales', `${totalDepenses.toLocaleString('fr-FR')} CFA`],
        ['Bénéfice net', `${beneficeNet.toLocaleString('fr-FR')} CFA`, 'Taux recouvrement', `${tauxRecouvrement}%`],
        ['Factures impayées', facturesImpayees.length, 'Montant impayé', `${montantImpaye.toLocaleString('fr-FR')} CFA`],
        ['Créances assurances', `${creanceAssur.toLocaleString('fr-FR')} CFA`, 'Masse salariale', `${totalSalaires.toLocaleString('fr-FR')} CFA`],
      ],
      headStyles:{ fillColor:[11,30,59], textColor:255, fontStyle:'bold', fontSize:9 },
      bodyStyles:{ fontSize:9 }, alternateRowStyles:{ fillColor:[240,248,255] },
      columnStyles:{ 0:{fontStyle:'bold'}, 2:{fontStyle:'bold'} },
    });
    if (revenus.length > 0) {
      const y = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(11,30,59);
      doc.text('Journal des revenus', 14, y);
      autoTable(doc, {
        startY: y+4, margin:{left:14,right:14},
        head:[['Date','Référence','Patient','Service','Montant','Mode']],
        body: revenus.map(r => [fmtDate(r.date), r.reference||'—', r.patient||'—', r.service||'—', `${Number(r.montant||0).toLocaleString('fr-FR')} CFA`, r.mode||'—']),
        headStyles:{ fillColor:[5,150,105], textColor:255, fontSize:8 },
        bodyStyles:{ fontSize:8 },
      });
    }
    if (factures.length > 0) {
      const y2 = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(11,30,59);
      doc.text('Factures', 14, y2);
      autoTable(doc, {
        startY: y2+4, margin:{left:14,right:14},
        head:[['Numéro','Date','Patient','Service','Montant','Statut']],
        body: factures.map(f => [f.numero||'—', fmtDate(f.date), f.patient||'—', f.service||'—', `${Number(f.montant||0).toLocaleString('fr-FR')} CFA`, f.statut||'—']),
        headStyles:{ fillColor:[27,79,158], textColor:255, fontSize:8 },
        bodyStyles:{ fontSize:8 },
        didParseCell: (d) => { if (d.section==='body' && d.column.index===5 && d.cell.raw==='paye') d.cell.styles.textColor=[5,150,105]; if (d.section==='body' && d.column.index===5 && d.cell.raw==='non_paye') d.cell.styles.textColor=[220,38,38]; },
      });
    }
    const n = doc.internal.getNumberOfPages();
    for (let i=1;i<=n;i++) { doc.setPage(i); const H=doc.internal.pageSize.getHeight(); doc.setFontSize(7); doc.setTextColor(150,150,150); doc.text(`Page ${i}/${n}`, W/2, H-4, {align:'center'}); doc.text(dateStr, W-14, H-4, {align:'right'}); }
    doc.save(`finance-${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('📄 PDF exporté');
  };

  const exportFinanceExcel = () => {
    const wb = XLSX.utils.book_new();
    const revData = [['Date','Référence','Patient','Service','Montant CFA','Mode','Statut'],
      ...revenus.map(r=>[fmtDate(r.date),r.reference||'',r.patient||'',r.service||'',Number(r.montant||0),r.mode||'',r.statut||''])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(revData), 'Revenus');
    const factData = [['Numéro','Date','Patient','Service','Montant CFA','Échéance','Statut'],
      ...factures.map(f=>[f.numero||'',fmtDate(f.date),f.patient||'',f.service||'',Number(f.montant||0),fmtDate(f.echeance),f.statut||''])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(factData), 'Factures');
    const payData = [['Référence','Date','Patient','Facture','Montant CFA','Mode'],
      ...paiements.map(p=>[p.reference||'',fmtDate(p.date),p.patient||'',p.facture||'',Number(p.montant||0),p.mode||''])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(payData), 'Paiements');
    const kpiData = [['KPI','Valeur'],['Revenus totaux',totalRevenus],['Dépenses totales',totalDepenses],['Bénéfice net',beneficeNet],['Factures impayées',facturesImpayees.length],['Montant impayé',montantImpaye],['Taux recouvrement %',tauxRecouvrement]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpiData), 'KPIs');
    XLSX.writeFile(wb, `finance-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('📊 Excel exporté (4 feuilles)');
  };

  const exportFinanceCSV = () => {
    const esc = v => `"${String(v??'').replace(/"/g,'""')}"`;
    const rows = [['Date','Référence','Patient','Service','Montant CFA','Mode','Statut'],
      ...revenus.map(r=>[fmtDate(r.date),r.reference||'',r.patient||'',r.service||'',Number(r.montant||0),r.mode||'',r.statut||''])];
    const csv = '﻿' + rows.map(r=>r.map(esc).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    a.download = `finance-revenus-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('📋 CSV exporté');
  };

  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      <div className="fin">

        {/* ── HERO ── */}
        <Hero
          icon={Wallet}
          title="Module Finance"
          dateLabel={
            <>
              {CLINIC_NAME} {CLINIC_SUBTITLE} ·
              <span style={{ color:"#A7F3D0", fontWeight:700 }}> {fmtMontant(totalRevenus)} de revenus ce mois</span>
              {montantImpaye > 0 && <span style={{ color:"#FCA5A5", fontWeight:700 }}> · {fmtMontant(montantImpaye)} impayés</span>}
            </>
          }
          right={
            <div className="no-print flex items-center gap-2 flex-wrap">
              <button className="hero-btn-ghost" onClick={() => setModalExport(true)}>
                <Download size={14} /> Exporter
              </button>
              <button className="hero-btn-ghost" onClick={() => setModalCaisse(true)}>
                <Banknote size={14} /> Opération caisse
              </button>
              <Button icon={Plus} onClick={() => setModalFacture(true)}>Nouvelle facture</Button>
            </div>
          }
        />

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
              <div className="tab-bar" style={isMobile?{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}:{}}>
                {TABS.map(t=>(
                  <button key={t.key} className={`tab-bar-item ${tab===t.key?"active":""}`} style={isMobile?{flexDirection:'column',textAlign:'center',padding:'6px 2px 7px',fontSize:'9px',gap:'2px',whiteSpace:'normal',minWidth:0}:{}} onClick={()=>setTab(t.key)}>
                    <span style={isMobile?{fontSize:'13px'}:{}}>{t.icon}</span>
                    <span style={isMobile?{lineHeight:1.2}:{}}>{isMobile?t.labelM:t.label}</span>
                    {(t.badge??0)>0&&<span className="tab-bar-item-count">{t.badge}</span>}
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
                        { label:"Revenus", data:revByMonth, borderColor:"#059669", pointBackgroundColor:"#059669" },
                        { label:"Dépenses", data:depByMonth, borderColor:"#DC2626", pointBackgroundColor:"#DC2626" },
                        { label:"Bénéfice", data:benefByMonth, borderColor:"#0EA5A0", pointBackgroundColor:"#0EA5A0" },
                      ]}
                      height={200}
                    />
                  </div>
                </div>
                <div className="fin-card ffu">
                  <div className="fin-card-hdr"><div><h3>Revenus par service</h3><p>{fmtMontant(totalRevenus)}</p></div></div>
                  <div style={{ padding:20 }}>
                    <DoughnutChart
                      labels={SERVICE_SHORT}
                      data={revByService}
                      colors={SERVICE_COLORS}
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
                  <button className="fbtn fbtn-ghost fbtn-sm" onClick={exportFinanceExcel}>{I.dl} Exporter</button>
                  <button className="fbtn fbtn-teal" onClick={() => { setFormRevenu(EMPTY_REVENU); setModalRevenu(true); }}>
                    {I.plus} Enregistrer revenu
                  </button>
                </div>
              </div>

              {/* Stats revenus par service — données réelles */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12, marginBottom:20 }}>
                {SERVICE_KEYS.map((lbl, i) => {
                  const val = revByService[i];
                  const col = SERVICE_COLORS[i];
                  return (
                    <div key={lbl} style={{ background:"#fff", border:"1.5px solid var(--cbr)", borderRadius:14, padding:"12px 14px", borderTop:`3px solid ${col}` }}>
                      <div style={{ fontSize:15, fontWeight:800, color:"var(--fn)" }}>{val > 0 ? fmtMontant(val).replace(" CFA","") : "0"}</div>
                      <div style={{ fontSize:10, fontWeight:600, color:"var(--cm)", marginTop:2 }}>{lbl} <span style={{ fontSize:9 }}>CFA</span></div>
                    </div>
                  );
                })}
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
                      ["💵 Espèces",      encByMode.especes,      "#059669"],
                      ["📱 Mobile Money", encByMode.mobile_money, "#0EA5A0"],
                      ["🏦 Virement",     encByMode.virement,     "#1B4F9E"],
                      ["🛡️ Assurance",    encByMode.assurance,    "#7C3AED"],
                      ["💳 Carte",        encByMode.carte,        "#D97706"],
                    ].map(([lbl, val, col]) => (
                      <div key={lbl} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:12, color:"var(--cm)" }}>{lbl}</span>
                        <strong style={{ color: val > 0 ? col : "var(--cm)", fontSize:13 }}>{val > 0 ? fmtMontant(val) : "—"}</strong>
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
                                <button className="fbtn fbtn-ghost fbtn-sm" style={{ fontSize:11 }} title="Imprimer" onClick={() => printInvoice(f)}>{I.print}</button>
                                <button className="fbtn fbtn-ghost fbtn-sm" style={{ fontSize:11 }} title="Télécharger PDF" onClick={() => downloadInvoicePDF(f)}>📥</button>
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
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--fn)" }}>Historique des paiements</div>
                  <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>{paiements.length} paiement(s) enregistré(s)</div>
                </div>
                <button className="fbtn fbtn-teal" onClick={() => { setFormPaiement(EMPTY_PAIEMENT); setPaiementFactureQ(""); setModalPaiement(true); }}>
                  {I.plus} Enregistrer un paiement
                </button>
              </div>

              {/* Statistiques par mode */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:20 }}>
                {Object.entries(MODE_PAY).map(([mode, cfg]) => {
                  const total = paiements.filter(p => p.mode === mode).reduce((s, p) => s + Number(p.montant || 0), 0);
                  const count = paiements.filter(p => p.mode === mode).length;
                  return (
                    <div key={mode} style={{ background:"#fff", border:"1.5px solid var(--cbr)", borderRadius:14, padding:"14px 16px" }}>
                      <div style={{ fontSize:13, marginBottom:6 }}>{cfg.label}</div>
                      <div style={{ fontSize:17, fontWeight:800, color: count > 0 ? "var(--fn)" : "var(--cm)" }}>
                        {count > 0 ? fmtMontant(total).replace(" CFA","") : "0"}
                      </div>
                      <div style={{ fontSize:10, color:"var(--cm)", marginTop:1 }}>CFA · {count} opération(s)</div>
                    </div>
                  );
                })}
              </div>

              <div className="fin-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="fin-tbl" style={{ minWidth:800 }}>
                    <thead>
                      <tr><th>Référence</th><th>Date & Heure</th><th>Patient</th><th>Facture</th><th>Montant</th><th>Mode</th><th>Caissier</th></tr>
                    </thead>
                    <tbody>
                      {paiements.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding:"48px 24px", textAlign:"center" }}>
                            <div style={{ fontSize:36, marginBottom:12 }}>💳</div>
                            <div style={{ fontSize:14, fontWeight:600, color:"var(--fn)", marginBottom:6 }}>Aucun paiement enregistré</div>
                            <div style={{ fontSize:12, color:"var(--cm)", marginBottom:16 }}>
                              Les paiements apparaissent ici dès qu'une facture est marquée comme payée.
                            </div>
                            <button className="fbtn fbtn-teal" onClick={() => { setFormPaiement(EMPTY_PAIEMENT); setPaiementFactureQ(""); setModalPaiement(true); }}>
                              {I.plus} Enregistrer un paiement
                            </button>
                          </td>
                        </tr>
                      ) : paiements.map((p, idx) => {
                        const mp = MODE_PAY[p.mode] || { cls:"gray", label: p.mode || "Autre" };
                        const patNom = p.patient && typeof p.patient === 'object'
                          ? `${p.patient.prenom || ''} ${p.patient.nom || ''}`.trim()
                          : (p.patient || '—');
                        const heure = p.heure || (p.date ? new Date(p.date).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) : '—');
                        return (
                          <tr key={p._id || `pay-${idx}`}>
                            <td><span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--ft)", fontSize:12 }}>{p.reference || '—'}</span></td>
                            <td>
                              <div style={{ fontSize:12, fontWeight:600 }}>{fmtDate(p.date)}</div>
                              <div style={{ fontSize:10, color:"var(--cm)" }}>{heure}</div>
                            </td>
                            <td style={{ fontWeight:600, color:"var(--fn)" }}>{patNom}</td>
                            <td><span style={{ fontFamily:"monospace", fontSize:11, color:"var(--fb)" }}>{p.facture || '—'}</span></td>
                            <td style={{ fontWeight:800, fontSize:14, color:"var(--fg)" }}>{fmtMontant(p.montant)}</td>
                            <td><span className={`fbdg ${mp.cls}`}>{mp.label}</span></td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{p.caissier || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {paiements.length > 0 && (
                      <tfoot>
                        <tr style={{ background:"linear-gradient(to right,#ECFDF5,#D1FAE5)" }}>
                          <td colSpan={4} style={{ fontWeight:700, color:"var(--fn)", padding:"10px 12px" }}>TOTAL ENCAISSÉ</td>
                          <td style={{ fontWeight:800, color:"var(--fg)", fontSize:15, padding:"10px 12px" }}>
                            {fmtMontant(paiements.reduce((s, p) => s + Number(p.montant || 0), 0))}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    )}
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
                    <BarChart labels={MOIS} data={benefByMonth} color="#059669" height={180} />
                  </div>
                </div>
                <div className="fin-card ffu">
                  <div className="fin-card-hdr"><h3>📊 Répartition revenus</h3></div>
                  <div style={{ padding:20 }}>
                    <DoughnutChart
                      labels={SERVICE_SHORT}
                      data={revByService}
                      colors={SERVICE_COLORS}
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
                        <button className="fbtn fbtn-ghost fbtn-sm" style={{ flex:1, fontSize:11 }} onClick={exportFinancePDF}>{I.dl} PDF</button>
                        <button className="fbtn fbtn-ghost fbtn-sm" style={{ flex:1, fontSize:11 }} onClick={exportFinanceExcel}>📊 Excel</button>
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
        <Modal open={modalFacture} onClose={() => { setModalFacture(false); setPatientResults([]); }} title="🧾 Nouvelle facture">
          <form onSubmit={createFacture}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

              {/* ─ Sélecteur patient intelligent ─ */}
              <div style={{ position:"relative" }}>
                <label className="flbl">Patient * <span style={{ fontSize:10, color:"var(--cm)", fontWeight:400 }}>(recherche dans le système)</span></label>
                {formFacture.patient_id ? (
                  /* Patient sélectionné — badge avec bouton effacer */
                  <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"#EEF4FF", borderRadius:10, border:"2px solid var(--fb)" }}>
                    <span style={{ fontSize:18 }}>👤</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, color:"var(--fn)", fontSize:13 }}>{formFacture.patient_nom}</div>
                      <div style={{ fontSize:11, color:"var(--cm)", marginTop:1 }}>Patient enregistré dans le système</div>
                    </div>
                    <button type="button" onClick={() => { setFormFacture(f=>({...f, patient_id:"", patient_nom:""})); setPatientResults([]); }}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"var(--fr)", fontSize:20, lineHeight:1, padding:"0 2px" }}>×</button>
                  </div>
                ) : (
                  /* Champ de recherche */
                  <>
                    <div style={{ position:"relative" }}>
                      <input className="finp" required={!formFacture.patient_id}
                        value={formFacture.patient_nom}
                        placeholder="Taper le nom du patient..."
                        autoComplete="off"
                        onChange={e => {
                          setFormFacture(f=>({...f, patient_nom:e.target.value, patient_id:""}));
                          searchPatients(e.target.value);
                        }}
                        onBlur={() => setTimeout(() => setPatientResults([]), 200)}
                        style={{ paddingRight:patientSearching ? 38 : 12 }}
                      />
                      {patientSearching && (
                        <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", fontSize:13, color:"var(--cm)" }}>⏳</span>
                      )}
                    </div>
                    {/* Dropdown résultats */}
                    {patientResults.length > 0 && (
                      <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#fff", border:"1.5px solid var(--cbr)", borderRadius:10, boxShadow:"0 8px 24px rgba(11,30,59,.12)", zIndex:200, maxHeight:220, overflowY:"auto", marginTop:2 }}>
                        {patientResults.map(p => (
                          <div key={p._id}
                            onMouseDown={() => {
                              setFormFacture(f=>({...f, patient_id:p._id, patient_nom:`${p.prenom} ${p.nom}`}));
                              setPatientResults([]);
                            }}
                            style={{ padding:"10px 14px", cursor:"pointer", borderBottom:"1px solid var(--cbr)", transition:"background .15s" }}
                            onMouseEnter={e=>e.currentTarget.style.background="#EEF4FF"}
                            onMouseLeave={e=>e.currentTarget.style.background=""}
                          >
                            <div style={{ fontWeight:600, color:"var(--fn)", fontSize:13 }}>👤 {p.prenom} {p.nom}</div>
                            <div style={{ fontSize:11, color:"var(--cm)", marginTop:2, display:"flex", gap:10 }}>
                              <span>📋 {p.numero_dossier || "—"}</span>
                              {p.telephone && <span>📞 {p.telephone}</span>}
                              {p.date_naissance && <span>🎂 {new Date(p.date_naissance).getFullYear()}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {formFacture.patient_nom.length >= 2 && !patientSearching && patientResults.length === 0 && (
                      <div style={{ fontSize:11, color:"var(--cm)", marginTop:4, padding:"6px 10px", background:"#FFF8F0", borderRadius:8, border:"1px solid #FED7AA" }}>
                        ⚠ Aucun patient trouvé. Vérifiez l'orthographe ou ajoutez le patient depuis la page Patients.
                      </div>
                    )}
                  </>
                )}
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
        <Modal open={modalFactureDetail} onClose={() => setModalFactureDetail(false)} title="🧾 Détail facture" maxWidth={580}>
          {selectedFacture && (() => {
            const sc = STATUT_FACT[selectedFacture.statut] || { cls:"gray", label: selectedFacture.statut };
            const isOverdue = selectedFacture.echeance && new Date(selectedFacture.echeance) < new Date() && selectedFacture.statut !== "paye" && selectedFacture.statut !== "annule";
            return (
              <div>
                {/* En-tête colorée */}
                <div style={{ background:"linear-gradient(135deg,#0B1E3B 0%,#1B4F9E 100%)", borderRadius:14, padding:"18px 20px", marginBottom:16, color:"#fff" }}>
                  <div style={{ fontSize:10, fontWeight:600, color:"rgba(255,255,255,.45)", letterSpacing:1, marginBottom:8, textTransform:"uppercase" }}>
                    🏥 {CLINIC_NAME} {CLINIC_SUBTITLE}
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
                    <div>
                      <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color:"rgba(255,255,255,.65)", marginBottom:4 }}>{selectedFacture.numero}</div>
                      <div style={{ fontSize:26, fontWeight:800, letterSpacing:-1, color:"#fff" }}>{fmtMontant(selectedFacture.montant)}</div>
                      <div style={{ fontSize:12, color:"rgba(255,255,255,.55)", marginTop:6 }}>
                        {selectedFacture.service} &nbsp;·&nbsp; émise le {fmtDate(selectedFacture.date)}
                      </div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                      <span className={`fbdg ${sc.cls}`}>{sc.label}</span>
                      {isOverdue && <span style={{ background:"#DC2626", color:"#fff", borderRadius:99, fontSize:9, fontWeight:700, padding:"2px 8px", letterSpacing:.3 }}>EN RETARD</span>}
                    </div>
                  </div>
                </div>

                {/* Alerte retard */}
                {isOverdue && (
                  <div style={{ background:"#FEF2F2", border:"1.5px solid #FCA5A5", borderLeft:"4px solid #DC2626", borderRadius:10, padding:"10px 14px", marginBottom:12, fontSize:12, color:"#DC2626", display:"flex", alignItems:"center", gap:8 }}>
                    <span>⚠️</span>
                    <span>Cette facture est <strong>en retard</strong> depuis le {fmtDate(selectedFacture.echeance)}. Pensez à relancer le patient.</span>
                  </div>
                )}

                {/* Infos */}
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginBottom:16 }}>
                  {[
                    ["Patient",      selectedFacture.patient],
                    ["Service",      selectedFacture.service],
                    ["Date facture", fmtDate(selectedFacture.date)],
                    ["Échéance",     fmtDate(selectedFacture.echeance)],
                  ].map(([lbl,val]) => (
                    <div key={lbl} style={{ background:"#F8FAFD", border:"1px solid #E2EAF4", borderRadius:10, padding:"10px 12px" }}>
                      <div style={{ fontSize:10, fontWeight:600, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.5 }}>{lbl}</div>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--fn)", marginTop:3 }}>{val || "—"}</div>
                    </div>
                  ))}
                </div>

                {/* Détail montant */}
                <div style={{ background:"#F8FAFD", border:"1px solid #E2EAF4", borderRadius:10, padding:"12px 14px", marginBottom:16 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.5, marginBottom:10 }}>Récapitulatif</div>
                  {[["Sous-total HT", fmtMontant(selectedFacture.montant)], ["Taxes (0%)", "0 CFA"]].map(([lbl,val]) => (
                    <div key={lbl} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid #EEF4FF", fontSize:12, color:"var(--cm)" }}>
                      <span>{lbl}</span><span>{val}</span>
                    </div>
                  ))}
                  <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0 0", fontSize:14, fontWeight:800, color:"var(--fn)" }}>
                    <span>Total TTC</span><span style={{ color:"var(--ft)" }}>{fmtMontant(selectedFacture.montant)}</span>
                  </div>
                </div>

                {/* Statut */}
                <div style={{ marginBottom:14 }}>
                  <label className="flbl">Modifier le statut de paiement</label>
                  <select className="finp" value={selectedFacture.statut} onChange={e => { updateStatutFacture(selectedFacture._id, e.target.value); setSelectedFacture(f => ({...f, statut:e.target.value})); }}>
                    <option value="non_paye">❌ Non payée</option>
                    <option value="paye">✅ Payée</option>
                    <option value="partiellement_paye">⚠ Partiellement payée</option>
                    <option value="annule">🚫 Annulée</option>
                  </select>
                </div>

                {/* Archive automatique info */}
                <div style={{ background:"#EEF4FF", borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:12, color:"var(--fb)", display:"flex", alignItems:"center", gap:8 }}>
                  <span>📁</span>
                  <span>Cette facture est <strong>archivée automatiquement</strong> dans le système dès sa création.</span>
                </div>

                {/* Actions */}
                <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
                  <button className="fbtn fbtn-teal" onClick={() => printInvoice(selectedFacture)}>
                    {I.print} Imprimer
                  </button>
                  <button className="fbtn fbtn-primary" style={{ background:"#1B4F9E", borderColor:"#1B4F9E" }} onClick={() => downloadInvoicePDF(selectedFacture)}>
                    📥 Télécharger PDF
                  </button>
                  <button className="fbtn fbtn-green" style={{ background:"#25D366", borderColor:"#25D366", color:"#fff" }} onClick={() => shareWhatsApp(selectedFacture)}>
                    📱 WhatsApp
                  </button>
                  <button className="fbtn fbtn-ghost" onClick={() => shareEmail(selectedFacture)}>
                    📧 Email
                  </button>
                  {selectedFacture.statut !== "paye" && (
                    <button className="fbtn fbtn-success" style={{ marginLeft:"auto" }} onClick={() => { updateStatutFacture(selectedFacture._id, "paye"); setSelectedFacture(f => ({...f, statut:"paye"})); }}>
                      {I.check} Marquer payée
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </Modal>

        {/* ═══ MODAL : ENREGISTRER PAIEMENT ═══ */}
        <Modal open={modalPaiement} onClose={() => { setModalPaiement(false); setPaiementFactureQ(""); }} title="💳 Enregistrer un paiement" maxWidth={540}>
          <form onSubmit={enregistrerPaiement}>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

              {/* ─ Recherche facture ─ */}
              <div>
                <label className="flbl">Facture à régler *</label>
                {formPaiement.facture_id ? (
                  /* Facture sélectionnée */
                  <div style={{ background:"#EEF4FF", border:"2px solid var(--fb)", borderRadius:12, padding:"12px 16px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div>
                        <div style={{ fontFamily:"monospace", fontWeight:700, color:"var(--fb)", fontSize:13 }}>{formPaiement.facture_num}</div>
                        <div style={{ fontWeight:600, color:"var(--fn)", fontSize:13, marginTop:2 }}>👤 {formPaiement.patient}</div>
                        <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>
                          Restant à payer : <strong style={{ color:"var(--fr)" }}>{fmtMontant(formPaiement.montant_restant)}</strong>
                        </div>
                      </div>
                      <button type="button" onClick={() => setFormPaiement(EMPTY_PAIEMENT)}
                        style={{ background:"none", border:"none", cursor:"pointer", color:"var(--fr)", fontSize:20 }}>×</button>
                    </div>
                  </div>
                ) : (
                  /* Recherche dans les factures non payées */
                  <div>
                    <input className="finp" value={paiementFactureQ}
                      placeholder="Rechercher par n° facture ou patient..."
                      onChange={e => setPaiementFactureQ(e.target.value)}
                      autoComplete="off"
                    />
                    {paiementFactureQ.length >= 1 && (() => {
                      const q = paiementFactureQ.toLowerCase();
                      const results = factures.filter(f =>
                        f.statut !== "paye" &&
                        ((f.numero || "").toLowerCase().includes(q) || (f.patient || "").toLowerCase().includes(q))
                      ).slice(0, 8);
                      return results.length > 0 ? (
                        <div style={{ border:"1.5px solid var(--cbr)", borderRadius:10, marginTop:4, background:"#fff", boxShadow:"0 8px 24px rgba(11,30,59,.10)", maxHeight:220, overflowY:"auto" }}>
                          {results.map(f => (
                            <div key={f._id}
                              onClick={() => {
                                const restant = Number(f.montant_restant || f.montant || 0);
                                setFormPaiement(p => ({
                                  ...p,
                                  facture_id:     f._id,
                                  facture_num:    f.numero,
                                  patient:        f.patient,
                                  montant_restant:restant,
                                  montant:        String(restant),
                                }));
                                setPaiementFactureQ("");
                              }}
                              style={{ padding:"10px 14px", cursor:"pointer", borderBottom:"1px solid var(--cbr)" }}
                              onMouseEnter={e => e.currentTarget.style.background="#EEF4FF"}
                              onMouseLeave={e => e.currentTarget.style.background=""}
                            >
                              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                                <div>
                                  <span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--fb)", fontSize:12 }}>{f.numero}</span>
                                  <span style={{ fontSize:13, fontWeight:600, color:"var(--fn)", marginLeft:10 }}>{f.patient}</span>
                                </div>
                                <div style={{ textAlign:"right" }}>
                                  <div style={{ fontWeight:800, color:"var(--fr)", fontSize:13 }}>{fmtMontant(f.montant_restant || f.montant)}</div>
                                  <span className={`fbdg ${(STATUT_FACT[f.statut]||{cls:"gray"}).cls}`} style={{ fontSize:10 }}>
                                    {(STATUT_FACT[f.statut]||{label:f.statut}).label}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize:12, color:"var(--cm)", marginTop:6, padding:"8px 12px", background:"#F8FAFD", borderRadius:8 }}>
                          Aucune facture non payée trouvée pour « {paiementFactureQ} »
                        </div>
                      );
                    })()}
                    {paiementFactureQ.length === 0 && factures.filter(f => f.statut !== "paye").length > 0 && (
                      <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:6 }}>
                        <span style={{ fontSize:11, color:"var(--cm)" }}>Factures en attente :</span>
                        {factures.filter(f => f.statut !== "paye").slice(0, 5).map(f => (
                          <span key={f._id} onClick={() => {
                            const restant = Number(f.montant_restant || f.montant || 0);
                            setFormPaiement(p => ({ ...p, facture_id:f._id, facture_num:f.numero, patient:f.patient, montant_restant:restant, montant:String(restant) }));
                          }}
                            style={{ background:"#EEF4FF", color:"var(--fb)", borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:600, cursor:"pointer", border:"1px solid #BFDBFE" }}>
                            {f.numero}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ─ Montant ─ */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <label className="flbl">Montant à encaisser (CFA) *</label>
                  <input type="number" className="finp" required min={1}
                    max={formPaiement.montant_restant || undefined}
                    value={formPaiement.montant}
                    onChange={e => setFormPaiement(p => ({...p, montant:e.target.value}))}
                    placeholder="Ex: 50000"
                  />
                  {formPaiement.montant_restant > 0 && Number(formPaiement.montant) > 0 && (
                    <div style={{ fontSize:11, color:"var(--cm)", marginTop:4 }}>
                      Solde après paiement : <strong style={{ color: Number(formPaiement.montant) >= formPaiement.montant_restant ? "var(--fg)" : "var(--fo)" }}>
                        {fmtMontant(Math.max(0, formPaiement.montant_restant - Number(formPaiement.montant)))}
                      </strong>
                    </div>
                  )}
                </div>
                <div>
                  <label className="flbl">Référence / Reçu</label>
                  <input className="finp" value={formPaiement.reference}
                    onChange={e => setFormPaiement(p => ({...p, reference:e.target.value}))}
                    placeholder="Ex: RECU-2025-001"
                  />
                </div>
              </div>

              {/* ─ Mode de paiement ─ */}
              <div>
                <label className="flbl">Mode de paiement *</label>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(100px,1fr))", gap:8 }}>
                  {[
                    ["especes",      "💵", "Espèces"],
                    ["mobile_money", "📱", "Mobile Money"],
                    ["carte",        "💳", "Carte"],
                    ["virement",     "🏦", "Virement"],
                    ["cheque",       "📄", "Chèque"],
                  ].map(([val, icon, lbl]) => (
                    <div key={val}
                      onClick={() => setFormPaiement(p => ({...p, mode:val}))}
                      style={{ padding:"10px 8px", border:`2px solid ${formPaiement.mode===val?"var(--ft)":"var(--cbr)"}`, borderRadius:10, background:formPaiement.mode===val?"#F0FDFC":"#FAFBFF", cursor:"pointer", textAlign:"center", transition:"all .2s" }}>
                      <div style={{ fontSize:20 }}>{icon}</div>
                      <div style={{ fontSize:10, fontWeight:600, color:"var(--fn)", marginTop:4 }}>{lbl}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ─ Récapitulatif ─ */}
              {formPaiement.facture_id && formPaiement.montant && (
                <div style={{ background:"#ECFDF5", border:"1.5px solid #A7F3D0", borderRadius:12, padding:"12px 16px", fontSize:13 }}>
                  <div style={{ fontWeight:700, color:"var(--fg)", marginBottom:6 }}>✅ Récapitulatif du paiement</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, color:"var(--fn)" }}>
                    <span>Facture :</span><strong>{formPaiement.facture_num}</strong>
                    <span>Patient :</span><strong>{formPaiement.patient}</strong>
                    <span>Montant encaissé :</span><strong style={{ color:"var(--fg)" }}>{fmtMontant(Number(formPaiement.montant))}</strong>
                    <span>Mode :</span><strong>{formPaiement.mode}</strong>
                  </div>
                </div>
              )}

              <div style={{ display:"flex", gap:10, marginTop:4 }}>
                <button type="button" className="fbtn fbtn-ghost" onClick={() => { setModalPaiement(false); setPaiementFactureQ(""); }}>Annuler</button>
                <button type="submit" className="fbtn fbtn-teal" style={{ marginLeft:"auto" }} disabled={saving || !formPaiement.facture_id}>
                  {I.check} {saving ? "Enregistrement..." : "Valider le paiement"}
                </button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : EXPORT ═══ */}
        <Modal open={modalExport} onClose={() => setModalExport(false)} title={<>{I.dl} Exporter les données</>} maxWidth={480}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <label className="flbl">Format</label>
              <div style={{ display:"flex", gap:10 }}>
                {[["pdf","📄","PDF",exportFinancePDF],["excel","📊","Excel",exportFinanceExcel],["csv","📋","CSV",exportFinanceCSV]].map(([val,icon,lbl,fn]) => (
                  <div key={val} style={{ flex:1, padding:"12px 8px", border:"2px solid var(--cbr)", borderRadius:12, cursor:"pointer", textAlign:"center" }} onClick={() => { fn(); setModalExport(false); }}>
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