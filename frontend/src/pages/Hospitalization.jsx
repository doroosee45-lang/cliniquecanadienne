


import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchHospitalizations, fetchRooms, createHospitalization, updateHospitalization,
  selectHospitalizations, selectRooms, selectHospitalizationLoading, selectOccupationPercentage,
} from '../store/slices/hospitalizationSlice';
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

// ─── CSS — Steel Blue + Surgical Green (same palette as Bloc Opératoire) ─────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.ho * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --hn:#0A1628; --hn2:#0F2040; --hb:#1A5276; --ht:#17A589;
  --ht2:#148F77; --hr:#C0392B; --ho:#D68910; --hg:#1E8449;
  --hp:#6C3483; --hv:#117A65; --cbr:#D6EAF8; --cm:#5D7892;
  --cl:#EAF4FB; --cs:#F4F9FD;
  --sh:0 1px 3px rgba(10,22,40,.08); --shm:0 4px 16px rgba(10,22,40,.12); --shl:0 12px 40px rgba(10,22,40,.16);
}

/* Topbar */
.ho-top { background:linear-gradient(135deg,var(--hn) 0%,var(--hn2) 50%,#1A5276 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.ho-top::before { content:''; position:absolute; top:-60px; right:-60px; width:240px; height:240px; background:radial-gradient(circle,rgba(23,165,137,.18) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
.ho-top::after  { content:''; position:absolute; bottom:-30px; left:40%; width:180px; height:180px; background:radial-gradient(circle,rgba(26,82,118,.25) 0%,transparent 70%); border-radius:50%; pointer-events:none; }

/* Tabs */
.ho-tabs { display:flex; gap:2px; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.ho-tabs::-webkit-scrollbar { display:none; }
.ho-tab { display:flex; align-items:center; gap:7px; padding:10px 18px 12px; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.5); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.ho-tab:hover { color:rgba(255,255,255,.85); background:rgba(255,255,255,.08); }
.ho-tab.active { color:var(--hn); background:var(--cs); box-shadow:0 -2px 0 var(--ht) inset; }
.ho-tab-badge { background:var(--hr); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:99px; animation:hoP 2s infinite; }
@keyframes hoP { 0%,100%{opacity:1} 50%{opacity:.4} }

/* Cards */
.ho-card { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; }
.ho-card:hover { box-shadow:var(--shm); }
.ho-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(234,244,251,.7),transparent); }
.ho-card-hdr h3 { font-size:14px; font-weight:700; color:var(--hn); margin:0; display:flex; align-items:center; gap:8px; }
.ho-card-hdr p  { font-size:11px; color:var(--cm); margin:2px 0 0; }

/* KPI */
.ho-kpi { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:pointer; }
.ho-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.ho-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.ho-kpi.blue::before   { background:var(--hb); } .ho-kpi.teal::before   { background:var(--ht); }
.ho-kpi.red::before    { background:var(--hr); } .ho-kpi.orange::before { background:var(--ho); }
.ho-kpi.green::before  { background:var(--hg); } .ho-kpi.purple::before { background:var(--hp); }
.kpi-icon-ho { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
.kpi-icon-ho.blue   { background:#EBF5FB; color:var(--hb); } .kpi-icon-ho.teal   { background:#E8F8F5; color:var(--ht); }
.kpi-icon-ho.red    { background:#FDEDEC; color:var(--hr); } .kpi-icon-ho.orange { background:#FEF9E7; color:var(--ho); }
.kpi-icon-ho.green  { background:#EAFAF1; color:var(--hg); } .kpi-icon-ho.purple { background:#F4ECF7; color:var(--hp); }
.kpi-val-ho { font-size:26px; font-weight:800; color:var(--hn); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.kpi-lbl-ho { font-size:11.5px; font-weight:600; color:var(--cm); }
.kpi-sub-ho { font-size:10.5px; color:#9CA3AF; margin-top:2px; }
.kpi-dot-ho { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--hr); animation:hoP 2s infinite; }

/* Badges */
.hbdg { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.hbdg.red    { background:#FDEDEC; color:var(--hr); border:1px solid #F5B7B1; }
.hbdg.orange { background:#FEF9E7; color:var(--ho); border:1px solid #FAD7A0; }
.hbdg.yellow { background:#FEFCE8; color:#B7950B;   border:1px solid #F9E79F; }
.hbdg.green  { background:#EAFAF1; color:var(--hg); border:1px solid #A9DFBF; }
.hbdg.blue   { background:#EBF5FB; color:var(--hb); border:1px solid #AED6F1; }
.hbdg.teal   { background:#E8F8F5; color:var(--ht); border:1px solid #A2D9CE; }
.hbdg.purple { background:#F4ECF7; color:var(--hp); border:1px solid #C39BD3; }
.hbdg.gray   { background:#F8F9FA; color:#4B5563;   border:1px solid #DEE2E6; }
.hbdg.dark   { background:var(--hn); color:#fff;    border:1px solid var(--hn2); }

/* Progress */
.ho-prog { background:#EAF4FB; border-radius:99px; height:7px; overflow:hidden; }
.ho-prog-f { height:100%; border-radius:99px; transition:width .5s; }

/* Buttons */
.hbtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; }
.hbtn-primary { background:var(--hb); color:#fff; } .hbtn-primary:hover { background:#154360; transform:translateY(-1px); }
.hbtn-teal    { background:var(--ht); color:#fff; } .hbtn-teal:hover    { background:var(--ht2); transform:translateY(-1px); }
.hbtn-ghost   { background:transparent; color:var(--cm); border:1.5px solid var(--cbr); }
.hbtn-ghost:hover { background:var(--cl); color:var(--hn); }
.hbtn-danger  { background:#FDEDEC; color:var(--hr); border:1.5px solid #F5B7B1; }
.hbtn-danger:hover { background:var(--hr); color:#fff; }
.hbtn-success { background:#EAFAF1; color:var(--hg); border:1.5px solid #A9DFBF; }
.hbtn-success:hover { background:var(--hg); color:#fff; }
.hbtn-sm { padding:6px 12px; font-size:12px; }
.hbtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }

/* Forms */
.hlbl { font-size:12px; font-weight:600; color:var(--cm); margin-bottom:6px; display:block; }
.hinp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--cbr); background:#FAFCFF; font-size:13px; color:var(--hn); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.hinp:focus { border-color:var(--ht); box-shadow:0 0 0 3px rgba(23,165,137,.12); }

/* Section nav */
.sec-nav-ho { display:flex; gap:6px; flex-wrap:wrap; padding:14px 20px; background:linear-gradient(to right,#F4F9FD,#EAF4FB); border-bottom:1.5px solid var(--cbr); border-radius:18px 18px 0 0; }
.sec-btn-ho { display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all .2s; color:var(--cm); background:none; font-family:'Poppins',sans-serif; }
.sec-btn-ho:hover { background:white; color:var(--hn); border-color:var(--cbr); }
.sec-btn-ho.active { background:var(--hn); color:white; border-color:var(--hn); }

/* Alerts */
.al-ho-ia     { background:linear-gradient(135deg,#EBF5FB,#D6EAF8); border:1.5px solid #AED6F1; border-left:4px solid var(--hb); border-radius:14px; padding:14px 18px; }
.al-ho-warn   { background:linear-gradient(135deg,#FEFCE8,#FEF3C7); border:1.5px solid #FAD7A0; border-left:4px solid var(--ho); border-radius:14px; padding:14px 18px; }
.al-ho-danger { background:linear-gradient(135deg,#FDEDEC,#FADBD8); border:1.5px solid #F5B7B1; border-left:4px solid var(--hr); border-radius:14px; padding:14px 18px; }
.al-ho-success{ background:linear-gradient(135deg,#EAFAF1,#D5F5E3); border:1.5px solid #A9DFBF; border-left:4px solid var(--hg); border-radius:14px; padding:14px 18px; }

/* Table */
.ho-tbl { width:100%; border-collapse:collapse; }
.ho-tbl thead tr { background:linear-gradient(to right,#F4F9FD,#EAF4FB); }
.ho-tbl th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--cm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--cbr); white-space:nowrap; }
.ho-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #EAF4FB; vertical-align:middle; }
.ho-tbl tbody tr:last-child td { border-bottom:none; }
.ho-tbl tbody tr:hover { background:#F4F9FD; }

/* Modal */
.hov { position:fixed; inset:0; z-index:500; background:rgba(10,22,40,.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.hov-box { background:#fff; border-radius:20px; box-shadow:var(--shl); width:100%; max-width:720px; max-height:92vh; overflow-y:auto; animation:hoSlide .25s ease; }
@keyframes hoSlide { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.hov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:#EAF4FB; position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.hov-hdr h3 { font-size:16px; font-weight:700; color:var(--hn); margin:0; display:flex; align-items:center; gap:10px; }
.hov-cls { width:32px; height:32px; border-radius:8px; background:#F4F9FD; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--cm); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.hov-cls:hover { background:#FDEDEC; color:var(--hr); }
.hov-body { padding:24px; }

/* Lit card */
.lit-card { background:#F4F9FD; border:1.5px solid var(--cbr); border-radius:14px; padding:14px 16px; transition:all .2s; cursor:pointer; }
.lit-card:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.lit-card.libre { border-color:#A9DFBF; background:#EAFAF1; }
.lit-card.occupe { border-color:#F5B7B1; background:#FDEDEC; }
.lit-card.reserve { border-color:#FAD7A0; background:#FEF9E7; }
.lit-card.nettoyage { border-color:#C39BD3; background:#F4ECF7; }

/* Timeline */
.ho-timeline { position:relative; padding-left:28px; }
.ho-timeline::before { content:''; position:absolute; left:10px; top:8px; bottom:8px; width:2px; background:var(--cbr); border-radius:2px; }
.ho-tl-item { position:relative; margin-bottom:14px; }
.ho-tl-dot { position:absolute; left:-23px; top:4px; width:14px; height:14px; border-radius:50%; border:2.5px solid white; box-shadow:0 0 0 2px var(--cbr); z-index:1; }
.ho-tl-dot.done   { background:var(--hg); box-shadow:0 0 0 2px #A9DFBF; }
.ho-tl-dot.active { background:var(--ht); box-shadow:0 0 0 2px #A2D9CE; animation:hoP 2s infinite; }
.ho-tl-dot.pending{ background:#E5E7EB; }

/* Vital card */
.vital-ho { background:#F4F9FD; border:1.5px solid var(--cbr); border-radius:12px; padding:12px 16px; text-align:center; }
.vital-ho.warn { background:#FEF9E7; border-color:#FAD7A0; }
.vital-ho.danger { background:#FDEDEC; border-color:#F5B7B1; }
.vital-ho.ok { background:#EAFAF1; border-color:#A9DFBF; }
.vital-v-ho { font-size:20px; font-weight:800; color:var(--hn); }
.vital-l-ho { font-size:10px; color:var(--cm); font-weight:600; text-transform:uppercase; margin-top:2px; }

/* Fade */
@keyframes hoFadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
.hofu { animation:hoFadeUp .35s ease both; }

/* Status strip */
.status-strip-ho { display:flex; align-items:center; gap:0; border-radius:12px; overflow:hidden; border:1.5px solid var(--cbr); }
.status-step-ho { flex:1; padding:10px 8px; text-align:center; font-size:11px; font-weight:600; color:var(--cm); background:#F4F9FD; transition:all .2s; position:relative; }
.status-step-ho.done   { background:var(--hg); color:#fff; }
.status-step-ho.active { background:var(--ht); color:#fff; }
.status-step-ho:not(:last-child)::after { content:'›'; position:absolute; right:-2px; top:50%; transform:translateY(-50%); font-size:16px; color:var(--cbr); z-index:1; }

/* Traitement row */
.trait-row { display:flex; align-items:center; gap:10px; padding:10px 14px; background:#F4F9FD; border-radius:10px; border:1.5px solid var(--cbr); margin-bottom:8px; }

@media print { .ho-top,.ho-tabs,.sec-nav-ho,.hbtn { display:none!important; } }

/* ─── Grilles responsives ─── */
.ho-g2    { display:grid; grid-template-columns:2fr 1fr; gap:20px; }
.ho-g32   { display:grid; grid-template-columns:3fr 2fr; gap:20px; }
.ho-g11   { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.ho-g11s  { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.ho-g4    { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
.ho-g5    { display:grid; grid-template-columns:repeat(5,1fr); gap:14px; }

/* ─── Mobile (≤ 767px) ─────────────────────────────────────── */
@media (max-width:767px) {
  .ho-top { padding:12px 14px 0; }

  /* Grilles → 1 colonne */
  .ho-g2, .ho-g32, .ho-g11 { grid-template-columns:1fr; gap:14px; }
  .ho-g4, .ho-g5 { grid-template-columns:1fr 1fr; gap:10px; }
  .ho-g11s { grid-template-columns:1fr 1fr; gap:8px; }

  /* Formulaires anti-zoom iOS */
  .hinp { font-size:16px !important; }

  /* Boutons */
  .hbtn    { font-size:12px; padding:8px 12px; }
  .hbtn-sm { font-size:11px; padding:5px 8px; }

  /* Cards */
  .ho-card     { border-radius:14px; }
  .ho-card-hdr { padding:11px 14px; }
  .ho-card-hdr h3 { font-size:13px; }

  /* KPI */
  .kpi-val-ho  { font-size:20px; }
  .kpi-icon-ho { width:34px; height:34px; margin-bottom:8px; }

  /* Section nav scrollable */
  .sec-nav-ho { overflow-x:auto; flex-wrap:nowrap; padding:10px 14px; scrollbar-width:none; }
  .sec-nav-ho::-webkit-scrollbar { display:none; }

  /* Modal → bottom-sheet */
  .hov     { padding:0; align-items:flex-end; }
  .hov-box { border-radius:20px 20px 0 0; max-width:100%; max-height:93vh; }
  .hov-hdr { padding:13px 16px; }
  .hov-body{ padding:14px; }

  /* Lit card - moins de padding */
  .lit-card { padding:10px 12px; }

  /* Status strip scroll */
  .status-strip-ho { overflow-x:auto; }
  .status-step-ho  { min-width:80px; font-size:10px; padding:8px 6px; }
}

/* ─── Très petit écran (≤ 479px) ─────────────────────────────  */
@media (max-width:479px) {
  .ho-top   { padding:10px 12px 0; }
  .ho-g4, .ho-g5 { grid-template-columns:1fr; }
  .ho-g11s  { grid-template-columns:1fr; gap:8px; }
  .kpi-val-ho { font-size:18px; }
  .ho-card-hdr { flex-wrap:wrap; gap:8px; }
}
`;

// ─── Helpers ─────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
const fmtDateInput  = (d) => d ? new Date(d).toISOString().substring(0, 10) : "";
const fmtDateTimeInput = (d) => d ? new Date(d).toISOString().substring(0, 16) : "";
const ageCalc = (dob) => {
  if (!dob) return "—";
  return `${Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 3600 * 1000))} ans`;
};
const nbJours = (d1, d2) => {
  if (!d1) return 0;
  const fin = d2 ? new Date(d2) : new Date();
  return Math.max(1, Math.ceil((fin - new Date(d1)) / (1000 * 3600 * 24)));
};

const STATUT_HOSP = {
  attente:       { cls:"orange", label:"En attente", icon:"⏳" },
  hospitalise:   { cls:"teal",   label:"Hospitalisé", icon:"🛏" },
  observation:   { cls:"blue",   label:"En observation", icon:"🔍" },
  sorti:         { cls:"green",  label:"Sorti", icon:"✅" },
  transfere:     { cls:"purple", label:"Transféré", icon:"🚑" },
};

const ETAT_SORTIE = {
  gueri:      { cls:"green",  label:"Guéri" },
  ameliore:   { cls:"teal",   label:"Amélioré" },
  stable:     { cls:"blue",   label:"Stable" },
  transfere:  { cls:"purple", label:"Transféré" },
  deces:      { cls:"red",    label:"Décédé" },
};

const TYPE_CHAMBRE = {
  standard: "Standard",
  privee:   "Privée",
  vip:      "VIP",
};

const STATUT_LIT = {
  libre:      { cls:"green",  label:"Libre" },
  occupe:     { cls:"red",    label:"Occupé" },
  reserve:    { cls:"orange", label:"Réservé" },
  nettoyage:  { cls:"purple", label:"En nettoyage" },
};

const PROVENANCE = {
  consultation: "Consultation",
  urgences:     "Urgences",
  transfert:    "Transfert externe",
  bloc:         "Post-opératoire",
};

// ─── Demo Data ────────────────────────────────────────────────
const DEMO_HOSPS = [
  { _id:"h1", numero:"HOSP-2026-0001", patient_nom:"Jean Dupont", patient_prenom:"Jean", patient_dob:"1975-04-12", patient_sexe:"homme", patient_gs:"O+", patient_tel:"77 123 45 67", patient_adresse:"12 Rue des Acacia, Dakar", patient_dossier:"PAT-001", contact_urgence:"Marie Dupont", tel_urgence:"77 987 65 43", statut:"hospitalise", provenance:"urgences", service:"Chirurgie générale", batiment:"Bâtiment A", chambre:"A12", lit:"01", type_chambre:"standard", medecin:"Dr. Martin Leblanc", diagnostic_entree:"Appendicite aiguë post-opératoire", motif:"Surveillance post-appendicectomie", date_admission:"2026-05-30T10:00", date_sortie:null },
  { _id:"h2", numero:"HOSP-2026-0002", patient_nom:"Marie Paul", patient_prenom:"Marie", patient_dob:"1988-11-03", patient_sexe:"femme", patient_gs:"A+", patient_tel:"77 234 56 78", patient_adresse:"45 Av. Léopold Sédar Senghor, Thiès", patient_dossier:"PAT-002", contact_urgence:"Paul Martin", tel_urgence:"77 876 54 32", statut:"sorti", provenance:"consultation", service:"Gynécologie", batiment:"Bâtiment B", chambre:"B05", lit:"02", type_chambre:"privee", medecin:"Dr. Sophie Pierre", diagnostic_entree:"Fibrome utérin", motif:"Myomectomie programmée", date_admission:"2026-05-28T08:30", date_sortie:"2026-05-31T14:00" },
  { _id:"h3", numero:"HOSP-2026-0003", patient_nom:"Paul Nguema", patient_prenom:"Paul", patient_dob:"1962-07-22", patient_sexe:"homme", patient_gs:"B+", patient_tel:"77 345 67 89", patient_adresse:"8 Rue Kléber, Saint-Louis", patient_dossier:"PAT-003", contact_urgence:"Anne Nguema", tel_urgence:"77 765 43 21", statut:"observation", provenance:"urgences", service:"Médecine interne", batiment:"Bâtiment A", chambre:"A08", lit:"03", type_chambre:"standard", medecin:"Dr. Camille Aubert", diagnostic_entree:"Occlusion intestinale aiguë", motif:"Post-laparotomie — surveillance", date_admission:"2026-05-31T14:00", date_sortie:null },
  { _id:"h4", numero:"HOSP-2026-0004", patient_nom:"Fatou Bongo", patient_prenom:"Fatou", patient_dob:"1995-02-14", patient_sexe:"femme", patient_gs:"AB+", patient_tel:"77 456 78 90", patient_adresse:"22 Cité Keur Gorgui, Dakar", patient_dossier:"PAT-004", contact_urgence:"Ibou Bongo", tel_urgence:"77 654 32 10", statut:"hospitalise", provenance:"bloc", service:"Chirurgie générale", batiment:"Bâtiment C", chambre:"C03", lit:"01", type_chambre:"vip", medecin:"Dr. Sophie Pierre", diagnostic_entree:"Appendicite aiguë non perforée", motif:"Post-appendicectomie cœlioscopique", date_admission:"2026-05-31T18:00", date_sortie:null },
  { _id:"h5", numero:"HOSP-2026-0005", patient_nom:"Ibrahim Diallo", patient_prenom:"Ibrahim", patient_dob:"1958-09-05", patient_sexe:"homme", patient_gs:"O-", patient_tel:"77 567 89 01", patient_adresse:"15 Rue Moussé Diop, Ziguinchor", patient_dossier:"PAT-005", contact_urgence:"Kadiatou Diallo", tel_urgence:"77 543 21 09", statut:"attente", provenance:"consultation", service:"Cardiologie", batiment:"Bâtiment B", chambre:"B12", lit:"01", type_chambre:"privee", medecin:"Dr. Martin Leblanc", diagnostic_entree:"Insuffisance cardiaque décompensée", motif:"Bilan cardiaque complet + traitement", date_admission:"2026-06-01T09:00", date_sortie:null },
];

const DEMO_LITS = [
  { id:"A-A11-01", batiment:"A", chambre:"A11", lit:"01", type:"standard", statut:"libre" },
  { id:"A-A11-02", batiment:"A", chambre:"A11", lit:"02", type:"standard", statut:"libre" },
  { id:"A-A12-01", batiment:"A", chambre:"A12", lit:"01", type:"standard", statut:"occupe", patient:"Jean Dupont" },
  { id:"A-A12-02", batiment:"A", chambre:"A12", lit:"02", type:"standard", statut:"nettoyage" },
  { id:"A-A08-03", batiment:"A", chambre:"A08", lit:"03", type:"standard", statut:"occupe", patient:"Paul Nguema" },
  { id:"B-B05-02", batiment:"B", chambre:"B05", lit:"02", type:"privee", statut:"libre" },
  { id:"B-B12-01", batiment:"B", chambre:"B12", lit:"01", type:"privee", statut:"reserve" },
  { id:"C-C03-01", batiment:"C", chambre:"C03", lit:"01", type:"vip", statut:"occupe", patient:"Fatou Bongo" },
  { id:"C-C04-01", batiment:"C", chambre:"C04", lit:"01", type:"vip", statut:"libre" },
];

const DEMO_CONSTANTES = [
  { id:"c1", date:"2026-05-31T08:00", temperature:"37.4", tension:"125/80", fc:"76", spo2:"98", poids:"78", note:"État stable, transit repris" },
  { id:"c2", date:"2026-05-31T14:00", temperature:"37.8", tension:"130/85", fc:"82", spo2:"97", poids:"78", note:"Légère fièvre, surveillance maintenue" },
  { id:"c3", date:"2026-06-01T08:00", temperature:"37.2", tension:"120/78", fc:"72", spo2:"99", poids:"77.5", note:"Apyrétique, douleur EVA 2/10" },
];

const DEMO_TRAITEMENTS = [
  { id:"t1", medicament:"Paracétamol 1g", dose:"1 comprimé", heure:"08:00", voie:"Orale", personnel:"Inf. Anne Martin", statut:"administre" },
  { id:"t2", medicament:"Métronidazole 500mg", dose:"1 sachet IV", heure:"12:00", voie:"IV", personnel:"Inf. Paul Ngom", statut:"administre" },
  { id:"t3", medicament:"Céfazoline 1g", dose:"1 flacon IV", heure:"20:00", voie:"IV", personnel:"Inf. Anne Martin", statut:"planifie" },
  { id:"t4", medicament:"Héparine LMWH", dose:"0.4 ml", heure:"21:00", voie:"SC", personnel:"Inf. Paul Ngom", statut:"planifie" },
];

const DEMO_PRESCRIPTIONS = [
  { id:"p1", type:"medicament", designation:"Amoxicilline 1g", posologie:"3x/jour pendant 7 jours", medecin:"Dr. Martin Leblanc", date:"2026-05-31" },
  { id:"p2", type:"perfusion",  designation:"Sérum salé 0.9% 500ml", posologie:"2 poches/jour", medecin:"Dr. Martin Leblanc", date:"2026-05-31" },
  { id:"p3", type:"soin",       designation:"Pansement de la cicatrice", posologie:"Matin et soir", medecin:"Dr. Martin Leblanc", date:"2026-05-31" },
  { id:"p4", type:"regime",     designation:"Régime hydrique 24h puis semi-liquide", posologie:"Progressif selon tolérance", medecin:"Dr. Martin Leblanc", date:"2026-05-31" },
];

const DEMO_EXAMENS = [
  { id:"e1", type:"labo", designation:"NFS — Numération formule sanguine", statut:"resultat", date:"2026-05-31", resultat:"GB: 12.5 G/L, Hb: 13.2 g/dL, Plaquettes: 280 G/L" },
  { id:"e2", type:"labo", designation:"CRP — Protéine C réactive", statut:"resultat", date:"2026-05-31", resultat:"CRP: 42 mg/L (↑)" },
  { id:"e3", type:"imagerie", designation:"Radiographie de l'abdomen sans préparation", statut:"resultat", date:"2026-05-31", resultat:"Pas de pneumopéritoine, transit normal" },
  { id:"e4", type:"labo", designation:"Ionogramme sanguin", statut:"attente", date:"2026-06-01", resultat:null },
];

const DEMO_VISITES = [
  { id:"v1", date:"2026-05-30", visiteur:"Marie Dupont (épouse)", heure_entree:"15:00", heure_sortie:"16:30", note:"Visite calme" },
  { id:"v2", date:"2026-05-31", visiteur:"Thomas Dupont (fils)", heure_entree:"18:00", heure_sortie:"19:00", note:"" },
  { id:"v3", date:"2026-06-01", visiteur:"Marie Dupont (épouse)", heure_entree:"10:00", heure_sortie:"11:00", note:"" },
];

const EMPTY_HOSP = {
  patient_id:"", medecin:"", service:"", batiment:"", chambre:"", lit:"", type_chambre:"standard",
  provenance:"urgences", motif:"", diagnostic_entree:"", date_admission:"",
  contact_urgence:"", tel_urgence:"",
};

const EMPTY_CONSTANTE = { date:"", temperature:"", tension_sys:"", tension_dia:"", fc:"", spo2:"", poids:"", note_med:"", note_inf:"" };
const EMPTY_TRAITEMENT = { medicament:"", dose:"", heure:"", voie:"orale", personnel:"", statut:"planifie" };
const EMPTY_EXAMEN = { type:"labo", designation:"", date:"", statut:"attente", resultat:"" };
const EMPTY_VISITE = { date:"", visiteur:"", heure_entree:"", heure_sortie:"", note:"" };
const EMPTY_SORTIE = { date_sortie:"", heure_sortie:"", diagnostic_sortie:"", etat_patient:"gueri", recommandations:"", rdv_controle:"" };

// ─── SVG Icons ────────────────────────────────────────────────
const I = {
  bed:      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9V5a2 2 0 012-2h16a2 2 0 012 2v4"/><path d="M2 11v6"/><path d="M22 11v6"/><path d="M1 17h22"/><path d="M6 11V9"/><path d="M18 11V9"/><rect x="6" y="9" width="12" height="4" rx="1"/></svg>,
  file:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  calendar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  users:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  clock:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  pulse:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  alert:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  plus:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  save:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  dl:       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  print:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  trend:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  grid:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  list:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  money:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  open:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  exit:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  link:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  flask:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 2v6l-4 8a2 2 0 001.8 2.9h12.4A2 2 0 0018 16.9L14 8V2"/><line x1="6" y1="2" x2="18" y2="2"/><line x1="9" y1="11" x2="15" y2="11"/></svg>,
  xray:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="12" y1="6" x2="12" y2="18"/><line x1="6" y1="12" x2="18" y2="12"/><path d="M9 8c0-1.1.9-2 2-2h2a2 2 0 110 4h-2a2 2 0 000 4h2a2 2 0 110 4h-2a2 2 0 01-2-2"/></svg>,
  pill:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.5 20.5L3.5 13.5a5 5 0 117.07-7.07L17.5 13.5a5 5 0 11-7.07 7.07z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/></svg>,
  eye:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  visitor:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  room:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
};

// ─── Modal ────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, maxWidth = 720 }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="hov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="hov-box" style={{ maxWidth }}>
        <div className="hov-hdr">
          <h3>{title}</h3>
          <button className="hov-cls" onClick={onClose}>×</button>
        </div>
        <div className="hov-body">{children}</div>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({ color, icon, value, label, sub, urgent, onClick }) {
  return (
    <div className={`ho-kpi ${color} hofu`} onClick={onClick} style={{ cursor:onClick?"pointer":"default" }}>
      {urgent && <div className="kpi-dot-ho" />}
      <div className={`kpi-icon-ho ${color}`}>{icon}</div>
      <div className="kpi-val-ho">{value}</div>
      <div className="kpi-lbl-ho">{label}</div>
      {sub && <div className="kpi-sub-ho">{sub}</div>}
    </div>
  );
}

function Prog({ pct, color }) {
  return <div className="ho-prog"><div className="ho-prog-f" style={{ width:`${pct}%`, background:color }} /></div>;
}
function Badge({ cls, children }) {
  return <span className={`hbdg ${cls}`}>{children}</span>;
}

// ─── Bar Chart ────────────────────────────────────────────────
function BarChart({ labels, data, color = "#1A5276", height = 180 }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new window.Chart(ref.current, {
        type:"bar",
        data: { labels, datasets:[{ label:"Hospitalisations", data, backgroundColor:`${color}28`, borderColor:color, borderWidth:2, borderRadius:8, borderSkipped:false }] },
        options: { responsive:true, maintainAspectRatio:true, plugins:{ legend:{ display:false }, tooltip:{ backgroundColor:"#0A1628", padding:10, cornerRadius:10 } }, scales:{ x:{ grid:{ display:false }, ticks:{ font:{size:10}, color:"#9CA3AF" }, border:{ display:false } }, y:{ beginAtZero:true, grid:{ color:"rgba(0,0,0,.04)" }, ticks:{ font:{size:10}, color:"#9CA3AF", precision:0 }, border:{ display:false } } } },
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [labels, data, color]);
  return <canvas ref={ref} style={{ maxHeight:height }} />;
}

function DoughnutChart({ labels, data, colors, height = 180 }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new window.Chart(ref.current, {
        type:"doughnut",
        data: { labels, datasets:[{ data, backgroundColor:colors, borderWidth:0, hoverOffset:4 }] },
        options: { responsive:true, maintainAspectRatio:true, cutout:"70%", plugins:{ legend:{ position:"right", labels:{ font:{size:11}, padding:14, boxWidth:12 } }, tooltip:{ backgroundColor:"#0A1628", padding:10 } } },
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [labels, data, colors]);
  return <canvas ref={ref} style={{ maxHeight:height }} />;
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function Hospitalisation() {
  const dispatch = useDispatch();
  const reduxHosps = useSelector(selectHospitalizations);
  const reduxRooms = useSelector(selectRooms);
  const reduxOccupation = useSelector(selectOccupationPercentage);

  useEffect(() => {
    dispatch(fetchHospitalizations({}));
    dispatch(fetchRooms());
  }, [dispatch]);

  // Détection mobile — inline styles pour les onglets (priorité absolue)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 599);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const [tab, setTab]         = useState("dashboard");
  const [section, setSection] = useState("admission");
  const [hosps, setHosps]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState("");
  const [filterStatut, setFilter] = useState("");
  const [currentHosp, setCurrentHosp] = useState(null);
  const [saving, setSaving]   = useState(false);
  const [patients, setPatients] = useState([]);

  // Local sub-data for current dossier
  const [constantes, setConstantes]       = useState(DEMO_CONSTANTES);
  const [traitements, setTraitements]     = useState(DEMO_TRAITEMENTS);
  const [prescriptions, setPrescriptions] = useState(DEMO_PRESCRIPTIONS);
  const [examens, setExamens]             = useState(DEMO_EXAMENS);
  const [visites, setVisites]             = useState(DEMO_VISITES);

  // Modals
  const [modalAdmission, setModalAdmission]   = useState(false);
  const [modalConstante, setModalConstante]   = useState(false);
  const [modalTraitement, setModalTraitement] = useState(false);
  const [modalExamen, setModalExamen]         = useState(false);
  const [modalVisite, setModalVisite]         = useState(false);
  const [modalSortie, setModalSortie]         = useState(false);
  const [modalPrescription, setModalPrescription] = useState(false);

  // Forms
  const [formHosp, setFormHosp]             = useState(EMPTY_HOSP);
  const [formConstante, setFormConstante]   = useState(EMPTY_CONSTANTE);
  const [formTraitement, setFormTraitement] = useState(EMPTY_TRAITEMENT);
  const [formExamen, setFormExamen]         = useState(EMPTY_EXAMEN);
  const [formVisite, setFormVisite]         = useState(EMPTY_VISITE);
  const [formSortie, setFormSortie]         = useState(EMPTY_SORTIE);
  const [formPrescription, setFormPrescription] = useState({ type:"medicament", designation:"", posologie:"", medecin:"" });

  // KPIs
  const [kpis, setKpis] = useState({ total:0, hospitalises:0, observation:0, attente:0, sortis:0, transferes:0, taux_occ:0 });

  // ── Load hospitalisations ─────────────────────────────────
  const loadHosps = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit:15 });
      if (search) p.set("q", search);
      if (filterStatut) p.set("statut", filterStatut);
      const { data } = await api.get(`/hospitalisations?${p}`);
      setHosps(data.hospitalisations || data.data || []);
      setTotal(data.total || 0);
    } catch {
      setHosps(DEMO_HOSPS);
      setTotal(DEMO_HOSPS.length);
    } finally { setLoading(false); }
  }, [page, search, filterStatut]);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/hospitalisations/stats");
      setKpis(data.kpis || kpis);
    } catch {
      const d = DEMO_HOSPS;
      setKpis({
        total: d.length,
        hospitalises: d.filter(x => x.statut === "hospitalise").length,
        observation:  d.filter(x => x.statut === "observation").length,
        attente:      d.filter(x => x.statut === "attente").length,
        sortis:       d.filter(x => x.statut === "sorti").length,
        transferes:   d.filter(x => x.statut === "transfere").length,
        taux_occ:     70,
      });
    }
  }, []);

  const loadPatients = useCallback(async () => {
    try {
      const { data } = await api.get("/patients?limit=500");
      setPatients(data.patients || data.data || []);
    } catch {
      setPatients([{ _id:"p1", prenom:"Jean", nom:"Dupont", numero_dossier:"PAT-001" }]);
    }
  }, []);

  useEffect(() => { loadHosps(); loadStats(); loadPatients(); }, [loadHosps, loadStats, loadPatients]);

  const openHosp = (d) => {
    setCurrentHosp(d);
    setSection("admission");
    setTab("dossier");
    setConstantes(DEMO_CONSTANTES);
    setTraitements(DEMO_TRAITEMENTS);
    setPrescriptions(DEMO_PRESCRIPTIONS);
    setExamens(DEMO_EXAMENS);
    setVisites(DEMO_VISITES);
  };

  const createHosp = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const { data } = await api.post("/hospitalisations", formHosp);
      toast.success(`✅ Admission ${data.numero || "créée"} avec succès`);
      setModalAdmission(false); setFormHosp(EMPTY_HOSP);
      loadHosps(); loadStats();
    } catch {
      const fake = { ...formHosp, _id: Date.now().toString(), numero:`HOSP-2026-${String(hosps.length+1).padStart(4,"0")}`, patient_nom:"Nouveau patient", patient_dob:"1985-01-01", statut:"attente", date_admission: formHosp.date_admission || new Date().toISOString() };
      setHosps(prev => [fake, ...prev]);
      toast.success("✅ Admission enregistrée");
      setModalAdmission(false); setFormHosp(EMPTY_HOSP);
    } finally { setSaving(false); }
  };

  const updateHosp = async (updates) => {
    if (!currentHosp) return; setSaving(true);
    try {
      await api.put(`/hospitalisations/${currentHosp._id}`, { ...currentHosp, ...updates });
      toast.success("✅ Dossier mis à jour");
      setCurrentHosp(prev => ({ ...prev, ...updates }));
      loadHosps();
    } catch {
      setCurrentHosp(prev => ({ ...prev, ...updates }));
      toast.success("✅ Enregistré (local)");
    } finally { setSaving(false); }
  };

  const addConstante = (e) => {
    e.preventDefault();
    const nouv = { ...formConstante, id: Date.now().toString(), date: formConstante.date || new Date().toISOString() };
    setConstantes(prev => [nouv, ...prev]);
    toast.success("✅ Constantes enregistrées");
    setModalConstante(false); setFormConstante(EMPTY_CONSTANTE);
  };

  const addTraitement = (e) => {
    e.preventDefault();
    const nouv = { ...formTraitement, id: Date.now().toString() };
    setTraitements(prev => [nouv, ...prev]);
    toast.success("✅ Traitement ajouté");
    setModalTraitement(false); setFormTraitement(EMPTY_TRAITEMENT);
  };

  const addExamen = (e) => {
    e.preventDefault();
    const nouv = { ...formExamen, id: Date.now().toString() };
    setExamens(prev => [nouv, ...prev]);
    toast.success("✅ Examen demandé");
    setModalExamen(false); setFormExamen(EMPTY_EXAMEN);
  };

  const addVisite = (e) => {
    e.preventDefault();
    const nouv = { ...formVisite, id: Date.now().toString() };
    setVisites(prev => [nouv, ...prev]);
    toast.success("✅ Visite enregistrée");
    setModalVisite(false); setFormVisite(EMPTY_VISITE);
  };

  const enregistrerSortie = (e) => {
    e.preventDefault();
    updateHosp({ statut:"sorti", ...formSortie });
    setModalSortie(false);
    toast.success("✅ Sortie du patient enregistrée");
  };

  const enCoursCount = hosps.filter(x => x.statut === "hospitalise" || x.statut === "observation").length;
  const attenteCount = hosps.filter(x => x.statut === "attente").length;
  const today = new Date().toLocaleDateString("fr-FR");

  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      <div className="ho">

        {/* ── TOPBAR ── */}
        <div className="ho-top">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap", position:"relative", zIndex:2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:54, height:54, borderRadius:14, background:"rgba(255,255,255,.12)", border:"1.5px solid rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {I.bed}
              </div>
              <div>
                <div style={{ fontSize:21, fontWeight:700, color:"#fff", letterSpacing:-.3 }}>Hospitalisation</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.55)", marginTop:2 }}>
                  {kpis.total} dossiers · {today}
                  {enCoursCount > 0 && <> · <span style={{ color:"#A2D9CE", fontWeight:600 }}>{enCoursCount} hospitalisés</span></>}
                  {attenteCount > 0 && <> · <span style={{ color:"#FAD7A0", fontWeight:600 }}>{attenteCount} en attente</span></>}
                </div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button className="hbtn hbtn-teal" onClick={() => { setFormHosp(EMPTY_HOSP); setModalAdmission(true); }}>
                {I.plus} Nouvelle admission
              </button>
              {currentHosp && currentHosp.statut !== "sorti" && (
                <button className="hbtn hbtn-ghost" style={{ color:"#fff", borderColor:"rgba(255,255,255,.3)" }} onClick={() => { setFormSortie(EMPTY_SORTIE); setModalSortie(true); }}>
                  {I.exit} Sortie patient
                </button>
              )}
              <button className="hbtn hbtn-ghost" style={{ color:"#fff", borderColor:"rgba(255,255,255,.3)" }} onClick={() => window.print()}>
                {I.print} Imprimer
              </button>
            </div>
          </div>

          {/* Tabs — grille 3 col sur mobile, ligne scrollable sur desktop */}
          {(() => {
            const TABS = [
              { key:"dashboard", icon:I.grid,  label:"Tableau de bord",    labelM:"Dashboard" },
              { key:"liste",     icon:I.list,  label:"Toutes les admissions", labelM:"Admissions" },
              { key:"lits",      icon:I.room,  label:"Chambres & Lits",    labelM:"Chambres" },
              { key:"dossier",   icon:I.file,  label: currentHosp ? `Dossier ${currentHosp.numero}` : "Dossier patient", labelM:"Dossier", disabled:!currentHosp },
              { key:"stats",     icon:I.trend, label:"Statistiques",       labelM:"Stats" },
            ].filter(t => !t.disabled);
            const cols = isMobile ? Math.min(3, TABS.length) : undefined;
            return (
              <div style={isMobile ? {
                display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`,
                gap:'4px', padding:'8px 10px', marginTop:'8px',
                background:'rgba(255,255,255,.07)', borderRadius:'10px 10px 0 0',
              } : {
                display:'flex', gap:'2px', marginTop:'16px',
                overflowX:'auto', scrollbarWidth:'none',
              }}>
                {TABS.map(t => (
                  <button
                    key={t.key}
                    className={`ho-tab ${tab === t.key ? "active" : ""}`}
                    style={isMobile ? {
                      flexDirection:'column', alignItems:'center', justifyContent:'center',
                      textAlign:'center', padding:'7px 3px 8px', fontSize:'9.5px',
                      gap:'3px', borderRadius:'8px', whiteSpace:'normal', minWidth:0,
                    } : {}}
                    onClick={() => setTab(t.key)}
                  >
                    <span style={isMobile ? { fontSize:'14px' } : {}}>{t.icon}</span>
                    <span style={isMobile ? { lineHeight:1.2 } : {}}>{isMobile ? t.labelM : t.label}</span>
                    {t.key === "liste" && attenteCount > 0 && <span className="ho-tab-badge">{attenteCount}</span>}
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
              {attenteCount > 0 && (
                <div className="al-ho-warn hofu" style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, flexWrap:"wrap" }}>
                  <div style={{ width:42, height:42, background:"#FAD7A0", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{I.alert}</div>
                  <div style={{ flex:1 }}>
                    <strong style={{ color:"#7E5109", fontSize:13 }}>⏳ Admissions en attente de lit</strong>
                    <div style={{ fontSize:12, color:"#D68910", marginTop:3 }}><strong>{attenteCount}</strong> patient(s) en attente d'attribution de chambre.</div>
                  </div>
                  <button className="hbtn hbtn-teal hbtn-sm" onClick={() => { setFilter("attente"); setTab("liste"); }}>Voir →</button>
                </div>
              )}

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="blue"   icon={I.calendar} value={kpis.total}       label="Total admissions"    sub="tous statuts"           onClick={() => setTab("liste")} />
                <KpiCard color="teal"   icon={I.bed}      value={kpis.hospitalises} label="Hospitalisés"        sub="en cours"               urgent={kpis.hospitalises > 0} onClick={() => { setFilter("hospitalise"); setTab("liste"); }} />
                <KpiCard color="blue"   icon={I.eye}      value={kpis.observation}  label="En observation"      sub="surveillance active"     onClick={() => { setFilter("observation"); setTab("liste"); }} />
                <KpiCard color="orange" icon={I.clock}    value={kpis.attente}      label="En attente"          sub="lit non attribué"        urgent={kpis.attente > 0} onClick={() => { setFilter("attente"); setTab("liste"); }} />
                <KpiCard color="green"  icon={I.exit}     icon={I.exit}             value={kpis.sortis}         label="Sortis" sub="ce mois"   onClick={() => { setFilter("sorti"); setTab("liste"); }} />
                <KpiCard color="teal"   icon={I.room}     value={`${kpis.taux_occ}%`} label="Taux occupation"  sub="chambres & lits"         onClick={() => setTab("lits")} />
              </div>

              <div className="ho-g2" style={{ marginBottom:24 }}>
                <div className="ho-card hofu">
                  <div className="ho-card-hdr"><div><h3>{I.trend} Admissions — 12 derniers mois</h3><p>Volume mensuel d'hospitalisations</p></div></div>
                  <div style={{ padding:20 }}>
                    <BarChart labels={["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"]} data={[18,22,19,25,28,24,20,16,21,23,19,26]} color="#1A5276" />
                  </div>
                </div>
                <div className="ho-card hofu">
                  <div className="ho-card-hdr"><div><h3>Par service</h3><p>Répartition des hospitalisations</p></div></div>
                  <div style={{ padding:20 }}>
                    <DoughnutChart labels={["Chirurgie","Médecine","Gynécologie","Cardiologie","Pédiatrie"]} data={[35,25,18,12,10]} colors={["#1A5276","#17A589","#D68910","#6C3483","#117A65"]} />
                  </div>
                </div>
              </div>

              {/* Today table */}
              <div className="ho-card hofu">
                <div className="ho-card-hdr">
                  <div><h3>{I.bed} Patients actuellement hospitalisés</h3><p>{enCoursCount} patient(s) en cours</p></div>
                  <button className="hbtn hbtn-ghost hbtn-sm" onClick={() => setTab("liste")}>Voir tous →</button>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table className="ho-tbl">
                    <thead>
                      <tr><th>N° Hosp</th><th>Patient</th><th>Chambre/Lit</th><th>Service</th><th>Médecin</th><th>Admission</th><th>Durée</th><th>Statut</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {(loading ? DEMO_HOSPS : hosps).slice(0,8).map(d => {
                        const sc = STATUT_HOSP[d.statut] || { cls:"gray", label:d.statut, icon:"" };
                        const jours = nbJours(d.date_admission, d.date_sortie);
                        return (
                          <tr key={d._id} style={{ background: d.statut === "attente" ? "#FEF9E7" : d.statut === "observation" ? "#EBF5FB" : "" }}>
                            <td><span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--hb)", fontSize:12 }}>{d.numero}</span></td>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--hn)" }}>{d.patient_nom}</div>
                              <div style={{ fontSize:11, color:"var(--cm)" }}>{ageCalc(d.patient_dob)} · {d.patient_gs || "—"}</div>
                            </td>
                            <td>
                              <Badge cls="blue">{d.chambre} · Lit {d.lit}</Badge>
                              <div style={{ fontSize:10, color:"var(--cm)", marginTop:3 }}>{TYPE_CHAMBRE[d.type_chambre] || d.type_chambre}</div>
                            </td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{d.service || "—"}</td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{d.medecin || "—"}</td>
                            <td style={{ fontSize:12 }}>
                              <div style={{ fontWeight:600, color:"var(--hn)" }}>{fmtDate(d.date_admission)}</div>
                              <div style={{ fontSize:10, color:"var(--cm)" }}>{d.date_admission ? new Date(d.date_admission).toLocaleTimeString("fr-FR", {hour:"2-digit",minute:"2-digit"}) : ""}</div>
                            </td>
                            <td><Badge cls={jours > 7 ? "orange" : "gray"}>{jours} j</Badge></td>
                            <td><span style={{ fontSize:13 }}>{sc.icon}</span> <Badge cls={sc.cls}>{sc.label}</Badge></td>
                            <td>
                              <button className="hbtn hbtn-ghost hbtn-sm" style={{ fontSize:11 }} onClick={() => openHosp(d)}>
                                {I.open} Ouvrir
                              </button>
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

          {/* ══ LISTE ══ */}
          {tab === "liste" && (
            <div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--hn)" }}>Admissions & Hospitalisations</div>
                  <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>{total} dossier(s) au total</div>
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }}>{I.search}</span>
                    <input className="hinp" style={{ paddingLeft:34, width:220 }} placeholder="Nom patient, N° dossier..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                  </div>
                  <select className="hinp" style={{ width:180 }} value={filterStatut} onChange={e => { setFilter(e.target.value); setPage(1); }}>
                    <option value="">Tous les statuts</option>
                    <option value="attente">En attente</option>
                    <option value="hospitalise">Hospitalisé</option>
                    <option value="observation">En observation</option>
                    <option value="sorti">Sorti</option>
                    <option value="transfere">Transféré</option>
                  </select>
                  <button className="hbtn hbtn-primary" onClick={() => { setFormHosp(EMPTY_HOSP); setModalAdmission(true); }}>
                    {I.plus} Nouvelle admission
                  </button>
                </div>
              </div>
              <div className="ho-card">
                <div style={{ overflowX:"auto" }}>
                  <table className="ho-tbl" style={{ minWidth:1050 }}>
                    <thead>
                      <tr><th>N° Hosp</th><th>Patient</th><th>Service</th><th>Chambre/Lit</th><th>Médecin</th><th>Provenance</th><th>Date admission</th><th>Durée</th><th>Statut</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={10} style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>Chargement...</td></tr>
                      ) : hosps.map(d => {
                        const sc = STATUT_HOSP[d.statut] || { cls:"gray", label:d.statut, icon:"" };
                        const jours = nbJours(d.date_admission, d.date_sortie);
                        return (
                          <tr key={d._id} style={{ background: d.statut === "attente" ? "#FEF9E7" : "" }}>
                            <td><span style={{ fontFamily:"monospace", fontWeight:700, color:"var(--hb)", fontSize:12 }}>{d.numero}</span></td>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--hn)" }}>{d.patient_nom}</div>
                              <div style={{ fontSize:11, color:"var(--cm)" }}>{ageCalc(d.patient_dob)} · {d.patient_gs || "—"}</div>
                            </td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{d.service || "—"}</td>
                            <td>
                              {d.chambre ? <><Badge cls="blue">{d.chambre} · Lit {d.lit}</Badge><div style={{ fontSize:10, color:"var(--cm)", marginTop:2 }}>{TYPE_CHAMBRE[d.type_chambre]}</div></> : <span style={{ color:"var(--cm)", fontSize:12 }}>Non attribué</span>}
                            </td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>{d.medecin || "—"}</td>
                            <td><Badge cls="gray">{PROVENANCE[d.provenance] || d.provenance}</Badge></td>
                            <td style={{ fontSize:12, color:"var(--cm)" }}>
                              <div style={{ fontWeight:600 }}>{fmtDate(d.date_admission)}</div>
                              <div style={{ fontSize:10 }}>{d.date_sortie ? `Sorti : ${fmtDate(d.date_sortie)}` : ""}</div>
                            </td>
                            <td><Badge cls={jours > 7 ? "orange" : "gray"}>{jours} j</Badge></td>
                            <td><span style={{ fontSize:13 }}>{sc.icon}</span> <Badge cls={sc.cls}>{sc.label}</Badge></td>
                            <td>
                              <button className="hbtn hbtn-ghost hbtn-sm" style={{ fontSize:11 }} onClick={() => openHosp(d)}>{I.open} Ouvrir</button>
                            </td>
                          </tr>
                        );
                      })}
                      {!loading && hosps.length === 0 && (
                        <tr><td colSpan={10} style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>Aucune hospitalisation enregistrée</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {total > 15 && (
                  <div style={{ padding:"12px 20px", borderTop:"1.5px solid var(--cbr)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontSize:12, color:"var(--cm)" }}>Page {page} / {Math.ceil(total/15)}</span>
                    <div style={{ display:"flex", gap:8 }}>
                      {page > 1 && <button className="hbtn hbtn-ghost hbtn-sm" onClick={() => setPage(p=>p-1)}>← Précédent</button>}
                      {page < Math.ceil(total/15) && <button className="hbtn hbtn-primary hbtn-sm" onClick={() => setPage(p=>p+1)}>Suivant →</button>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ CHAMBRES & LITS ══ */}
          {tab === "lits" && (
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--hn)", marginBottom:20 }}>Gestion des chambres & lits — Disponibilité en temps réel</div>

              {/* Stats lits */}
              <div className="ho-g4" style={{ marginBottom:24 }}>
                {[
                  { cls:"green",  val: DEMO_LITS.filter(l=>l.statut==="libre").length,      label:"Lits libres",      icon:"✅" },
                  { cls:"red",    val: DEMO_LITS.filter(l=>l.statut==="occupe").length,     label:"Lits occupés",     icon:"🔴" },
                  { cls:"orange", val: DEMO_LITS.filter(l=>l.statut==="reserve").length,    label:"Lits réservés",    icon:"📋" },
                  { cls:"purple", val: DEMO_LITS.filter(l=>l.statut==="nettoyage").length,  label:"En nettoyage",     icon:"🧹" },
                ].map((k,i) => (
                  <div key={i} className={`ho-kpi ${k.cls} hofu`}>
                    <div style={{ fontSize:22, marginBottom:8 }}>{k.icon}</div>
                    <div className="kpi-val-ho">{k.val}</div>
                    <div className="kpi-lbl-ho">{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Grille par bâtiment */}
              {["A","B","C"].map(bat => {
                const lits = DEMO_LITS.filter(l => l.batiment === bat);
                const colors = { A:{ color:"var(--hb)", light:"#EBF5FB" }, B:{ color:"var(--ht)", light:"#E8F8F5" }, C:{ color:"var(--hg)", light:"#EAFAF1" } }[bat];
                return (
                  <div key={bat} className="ho-card hofu" style={{ marginBottom:20 }}>
                    <div className="ho-card-hdr" style={{ background:`linear-gradient(to right,${colors.light},transparent)` }}>
                      <h3 style={{ color:colors.color }}>🏥 Bâtiment {bat}</h3>
                      <span style={{ fontSize:12, color:"var(--cm)" }}>{lits.filter(l=>l.statut==="libre").length} / {lits.length} lits libres</span>
                    </div>
                    <div style={{ padding:20, display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:14 }}>
                      {lits.map(l => (
                        <div key={l.id} className={`lit-card ${l.statut} hofu`}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                            <div style={{ fontWeight:700, color:"var(--hn)", fontSize:14 }}>Chambre {l.chambre} — Lit {l.lit}</div>
                            <Badge cls={(STATUT_LIT[l.statut]||{}).cls||"gray"}>{(STATUT_LIT[l.statut]||{}).label}</Badge>
                          </div>
                          <div style={{ fontSize:11, color:"var(--cm)", marginBottom:6 }}>{TYPE_CHAMBRE[l.type] || l.type}</div>
                          {l.patient && (
                            <div style={{ fontSize:12, fontWeight:600, color:"var(--hr)" }}>👤 {l.patient}</div>
                          )}
                          {l.statut === "libre" && (
                            <button className="hbtn hbtn-success hbtn-sm" style={{ marginTop:8, width:"100%" }} onClick={() => toast.success(`Lit ${l.chambre}-${l.lit} réservé`)}>
                              Affecter un patient
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={{ padding:"8px 20px 14px" }}>
                      <Prog pct={Math.round(lits.filter(l=>l.statut==="occupe").length / lits.length * 100)} color={colors.color} />
                      <div style={{ fontSize:11, color:"var(--cm)", marginTop:4 }}>Taux d'occupation : {Math.round(lits.filter(l=>l.statut==="occupe").length / lits.length * 100)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ DOSSIER PATIENT ══ */}
          {tab === "dossier" && currentHosp && (
            <div>
              {/* Header patient */}
              <div style={{ background:"linear-gradient(135deg,#0A1628,#0F2040)", borderRadius:18, padding:"20px 24px", marginBottom:20, color:"#fff" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                    <div style={{ width:56, height:56, borderRadius:14, background:"rgba(255,255,255,.15)", border:"2px solid rgba(255,255,255,.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>
                      {currentHosp.patient_sexe === "femme" ? "👩" : "👨"}
                    </div>
                    <div>
                      <div style={{ fontSize:18, fontWeight:700 }}>{currentHosp.patient_nom}</div>
                      <div style={{ fontSize:12, color:"rgba(255,255,255,.65)", marginTop:2 }}>
                        {ageCalc(currentHosp.patient_dob)} · Gr. {currentHosp.patient_gs || "—"} · {currentHosp.patient_tel || "—"}
                      </div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.45)", marginTop:3 }}>
                        Dossier : {currentHosp.patient_dossier || "—"} · Service : {currentHosp.service || "—"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                    <div style={{ background:"rgba(255,255,255,.1)", borderRadius:12, padding:"10px 16px", minWidth:160 }}>
                      <div style={{ fontSize:10, color:"rgba(255,255,255,.55)", fontWeight:600, textTransform:"uppercase", letterSpacing:.5, marginBottom:6 }}>Lit attribué</div>
                      <div style={{ fontSize:13, fontWeight:600, color:"#A2D9CE", marginBottom:2 }}>
                        🏥 {currentHosp.batiment} — {currentHosp.chambre} · Lit {currentHosp.lit}
                      </div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.6)" }}>{TYPE_CHAMBRE[currentHosp.type_chambre] || ""}</div>
                      <div style={{ marginTop:6 }}>
                        <Badge cls={(STATUT_HOSP[currentHosp.statut]||{}).cls||"gray"}>
                          {(STATUT_HOSP[currentHosp.statut]||{}).icon} {(STATUT_HOSP[currentHosp.statut]||{}).label}
                        </Badge>
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontFamily:"monospace", fontSize:16, fontWeight:700, color:"rgba(255,255,255,.9)" }}>{currentHosp.numero}</div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:6 }}>
                        📅 Admis : {fmtDate(currentHosp.date_admission)}<br/>
                        {currentHosp.date_sortie ? `✅ Sorti : ${fmtDate(currentHosp.date_sortie)}` : <span style={{ color:"#A2D9CE" }}>🛏 J+{nbJours(currentHosp.date_admission)}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status strip */}
              <div className="status-strip-ho hofu" style={{ marginBottom:20 }}>
                {["Admission","Hébergement","Soins & Examens","Prescription","Sortie"].map((lbl,i) => (
                  <div key={lbl} className={`status-step-ho ${currentHosp.statut === "sorti" ? "done" : i < 3 ? "done" : i === 3 ? "active" : "pending"}`}>
                    <div style={{ fontSize:16, fontWeight:800 }}>{["📋","🛏","🔬","💊","✅"][i]}</div>
                    <div>{lbl}</div>
                  </div>
                ))}
              </div>

              {/* Section nav */}
              <div className="sec-nav-ho">
                {[
                  { id:"admission",    label:"📋 Admission" },
                  { id:"patient",      label:"👤 Patient" },
                  { id:"lit",          label:"🛏 Chambre & Lit" },
                  { id:"constantes",   label:`💓 Constantes (${constantes.length})` },
                  { id:"traitements",  label:`💊 Traitements (${traitements.length})` },
                  { id:"prescriptions",label:`📄 Prescriptions (${prescriptions.length})` },
                  { id:"examens",      label:`🔬 Examens (${examens.length})` },
                  { id:"visites",      label:`👥 Visites (${visites.length})` },
                  { id:"facturation",  label:"💰 Facturation" },
                  { id:"sortie",       label:"🚪 Sortie" },
                  { id:"documents",    label:"📄 Documents" },
                ].map(s => (
                  <button key={s.id} className={`sec-btn-ho ${section === s.id ? "active" : ""}`} onClick={() => setSection(s.id)}>{s.label}</button>
                ))}
              </div>

              {/* ── ADMISSION ── */}
              {section === "admission" && (
                <div className="ho-g11" style={{ marginTop:20 }}>
                  <div className="ho-card">
                    <div className="ho-card-hdr"><h3>📋 Informations d'admission</h3></div>
                    <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
                      <div>
                        <label className="hlbl">Statut d'hospitalisation *</label>
                        <select className="hinp" value={currentHosp.statut} onChange={e => setCurrentHosp(d => ({ ...d, statut:e.target.value }))}>
                          <option value="attente">⏳ En attente</option>
                          <option value="hospitalise">🛏 Hospitalisé</option>
                          <option value="observation">🔍 En observation</option>
                          <option value="sorti">✅ Sorti</option>
                          <option value="transfere">🚑 Transféré</option>
                        </select>
                      </div>
                      <div>
                        <label className="hlbl">Provenance du patient</label>
                        <select className="hinp" value={currentHosp.provenance} onChange={e => setCurrentHosp(d => ({ ...d, provenance:e.target.value }))}>
                          <option value="consultation">Consultation</option>
                          <option value="urgences">Urgences</option>
                          <option value="transfert">Transfert externe</option>
                          <option value="bloc">Post-opératoire</option>
                        </select>
                      </div>
                      <div>
                        <label className="hlbl">Service d'hospitalisation</label>
                        <input className="hinp" value={currentHosp.service || ""} onChange={e => setCurrentHosp(d => ({ ...d, service:e.target.value }))} placeholder="Ex: Chirurgie générale, Gynécologie..." />
                      </div>
                      <div>
                        <label className="hlbl">Médecin responsable</label>
                        <input className="hinp" value={currentHosp.medecin || ""} onChange={e => setCurrentHosp(d => ({ ...d, medecin:e.target.value }))} placeholder="Dr. Nom Prénom" />
                      </div>
                      <div>
                        <label className="hlbl">Date et heure d'admission</label>
                        <input type="datetime-local" className="hinp" value={fmtDateTimeInput(currentHosp.date_admission)} onChange={e => setCurrentHosp(d => ({ ...d, date_admission:e.target.value }))} />
                      </div>
                      <div>
                        <label className="hlbl">Motif d'hospitalisation *</label>
                        <textarea className="hinp" rows={2} value={currentHosp.motif || ""} onChange={e => setCurrentHosp(d => ({ ...d, motif:e.target.value }))} placeholder="Motif clinique de l'admission..." />
                      </div>
                      <div>
                        <label className="hlbl">Diagnostic d'entrée</label>
                        <textarea className="hinp" rows={2} value={currentHosp.diagnostic_entree || ""} onChange={e => setCurrentHosp(d => ({ ...d, diagnostic_entree:e.target.value }))} placeholder="Diagnostic établi à l'admission..." />
                      </div>
                      <button className="hbtn hbtn-teal" disabled={saving} onClick={() => updateHosp({ statut:currentHosp.statut, provenance:currentHosp.provenance, service:currentHosp.service, medecin:currentHosp.medecin, motif:currentHosp.motif, diagnostic_entree:currentHosp.diagnostic_entree, date_admission:currentHosp.date_admission })}>
                        {I.save} {saving ? "Enregistrement..." : "Enregistrer"}
                      </button>
                    </div>
                  </div>

                  {/* Modules liés */}
                  <div className="ho-card">
                    <div className="ho-card-hdr"><h3>🔗 Modules connectés</h3></div>
                    <div style={{ padding:20 }}>
                      <div style={{ fontSize:12, color:"var(--cm)", marginBottom:14 }}>Ce dossier est connecté automatiquement aux modules :</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                        {[
                          ["🩺","Consultation","Dossier source d'admission"],
                          ["🔬","Laboratoire","Résultats des analyses"],
                          ["🩻","Imagerie","Radiologies & Scanners"],
                          ["💊","Pharmacie","Médicaments prescrits"],
                          ["🔪","Bloc opératoire","Interventions chirurgicales"],
                          ["💰","Facturation","Frais d'hospitalisation"],
                          ["📦","Stock médical","Consommables utilisés"],
                          ["📁","Dossier médical","Centralisation complète"],
                        ].map(([ico,mod,desc]) => (
                          <div key={mod} style={{ background:"#F4F9FD", border:"1.5px solid var(--cbr)", borderRadius:10, padding:"10px 12px", display:"flex", alignItems:"flex-start", gap:8, cursor:"pointer", transition:"all .2s" }}
                            onMouseOver={e => e.currentTarget.style.background="#EAF4FB"} onMouseOut={e => e.currentTarget.style.background="#F4F9FD"}>
                            <span style={{ fontSize:16, flexShrink:0 }}>{ico}</span>
                            <div>
                              <div style={{ fontSize:12, fontWeight:700, color:"var(--hn)" }}>{mod}</div>
                              <div style={{ fontSize:10, color:"var(--cm)" }}>{desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── PATIENT ── */}
              {section === "patient" && (
                <div style={{ marginTop:20 }}>
                  <div className="ho-card">
                    <div className="ho-card-hdr"><h3>👤 Informations du patient</h3></div>
                    <div style={{ padding:20, display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                      <div className="ho-g4" style={{ gridColumn:"1/-1", gap:12 }}>
                        {[
                          ["Nom complet", currentHosp.patient_nom],
                          ["Âge", ageCalc(currentHosp.patient_dob)],
                          ["Sexe", currentHosp.patient_sexe ? currentHosp.patient_sexe.charAt(0).toUpperCase() + currentHosp.patient_sexe.slice(1) : "—"],
                          ["Groupe sanguin", currentHosp.patient_gs || "—"],
                          ["N° dossier", currentHosp.patient_dossier || "—"],
                          ["Téléphone", currentHosp.patient_tel || "—"],
                        ].map(([lbl,val]) => (
                          <div key={lbl} style={{ background:"#F4F9FD", border:"1.5px solid var(--cbr)", borderRadius:10, padding:"10px 12px" }}>
                            <div style={{ fontSize:10, fontWeight:600, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.4 }}>{lbl}</div>
                            <div style={{ fontSize:13, fontWeight:600, color:"var(--hn)", marginTop:2 }}>{val}</div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <label className="hlbl">Adresse</label>
                        <textarea className="hinp" rows={2} value={currentHosp.patient_adresse || ""} onChange={e => setCurrentHosp(d => ({ ...d, patient_adresse:e.target.value }))} placeholder="Adresse complète du patient..." />
                      </div>
                      <div>
                        <label className="hlbl">Personne à contacter en urgence</label>
                        <input className="hinp" value={currentHosp.contact_urgence || ""} onChange={e => setCurrentHosp(d => ({ ...d, contact_urgence:e.target.value }))} placeholder="Nom et lien de parenté" />
                      </div>
                      <div>
                        <label className="hlbl">Téléphone urgence</label>
                        <input className="hinp" value={currentHosp.tel_urgence || ""} onChange={e => setCurrentHosp(d => ({ ...d, tel_urgence:e.target.value }))} placeholder="77 xxx xx xx" />
                      </div>
                      <div style={{ gridColumn:"1/-1", display:"flex", justifyContent:"flex-end" }}>
                        <button className="hbtn hbtn-teal" disabled={saving} onClick={() => updateHosp({ patient_adresse:currentHosp.patient_adresse, contact_urgence:currentHosp.contact_urgence, tel_urgence:currentHosp.tel_urgence })}>
                          {I.save} {saving ? "..." : "Enregistrer"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── CHAMBRE & LIT ── */}
              {section === "lit" && (
                <div style={{ marginTop:20 }}>
                  <div className="ho-g11">
                    <div className="ho-card">
                      <div className="ho-card-hdr"><h3>🛏 Lit & Chambre attribués</h3></div>
                      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
                        <div style={{ background:"#EAF4FB", border:"1.5px solid #AED6F1", borderRadius:12, padding:16, textAlign:"center" }}>
                          <div style={{ fontSize:32, marginBottom:8 }}>🛏</div>
                          <div style={{ fontWeight:800, fontSize:18, color:"var(--hn)" }}>{currentHosp.chambre} — Lit {currentHosp.lit}</div>
                          <div style={{ fontSize:13, color:"var(--cm)", marginTop:4 }}>{currentHosp.batiment} · {TYPE_CHAMBRE[currentHosp.type_chambre]}</div>
                          <div style={{ marginTop:10 }}><Badge cls="teal">🛏 Occupé</Badge></div>
                        </div>
                        <div>
                          <label className="hlbl">Bâtiment</label>
                          <select className="hinp" value={currentHosp.batiment || ""} onChange={e => setCurrentHosp(d => ({ ...d, batiment:e.target.value }))}>
                            <option value="">— Sélectionner —</option>
                            <option value="Bâtiment A">Bâtiment A</option>
                            <option value="Bâtiment B">Bâtiment B</option>
                            <option value="Bâtiment C">Bâtiment C</option>
                          </select>
                        </div>
                        <div className="ho-g11s">
                          <div>
                            <label className="hlbl">Chambre</label>
                            <input className="hinp" value={currentHosp.chambre || ""} onChange={e => setCurrentHosp(d => ({ ...d, chambre:e.target.value }))} placeholder="Ex: A12" />
                          </div>
                          <div>
                            <label className="hlbl">Numéro de lit</label>
                            <input className="hinp" value={currentHosp.lit || ""} onChange={e => setCurrentHosp(d => ({ ...d, lit:e.target.value }))} placeholder="Ex: 01" />
                          </div>
                        </div>
                        <div>
                          <label className="hlbl">Type de chambre</label>
                          <select className="hinp" value={currentHosp.type_chambre || "standard"} onChange={e => setCurrentHosp(d => ({ ...d, type_chambre:e.target.value }))}>
                            <option value="standard">Standard</option>
                            <option value="privee">Privée</option>
                            <option value="vip">VIP</option>
                          </select>
                        </div>
                        <button className="hbtn hbtn-teal" disabled={saving} onClick={() => updateHosp({ batiment:currentHosp.batiment, chambre:currentHosp.chambre, lit:currentHosp.lit, type_chambre:currentHosp.type_chambre })}>
                          {I.save} Enregistrer
                        </button>
                      </div>
                    </div>
                    <div className="ho-card">
                      <div className="ho-card-hdr"><h3>📊 Tarification par type</h3></div>
                      <div style={{ padding:20 }}>
                        {[
                          { type:"Standard", prix:15000, color:"var(--hb)" },
                          { type:"Privée",   prix:35000, color:"var(--ht)" },
                          { type:"VIP",      prix:75000, color:"var(--ho)" },
                        ].map(t => (
                          <div key={t.type} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", background: t.type === TYPE_CHAMBRE[currentHosp.type_chambre] ? "#EAF4FB" : "#F4F9FD", border:`1.5px solid ${t.type === TYPE_CHAMBRE[currentHosp.type_chambre] ? "#AED6F1" : "var(--cbr)"}`, borderRadius:10, marginBottom:10 }}>
                            <div style={{ fontWeight:600, color:"var(--hn)" }}>{t.type}</div>
                            <div style={{ fontWeight:700, color:t.color }}>{t.prix.toLocaleString("fr-FR")} CFA/nuit</div>
                          </div>
                        ))}
                        <div style={{ background:"#EAFAF1", border:"1.5px solid #A9DFBF", borderRadius:12, padding:14, marginTop:12 }}>
                          <div style={{ fontSize:12, color:"var(--cm)" }}>Coût total hébergement</div>
                          <div style={{ fontSize:20, fontWeight:800, color:"var(--hg)", marginTop:4 }}>
                            {(() => {
                              const prix = { standard:15000, privee:35000, vip:75000 }[currentHosp.type_chambre] || 15000;
                              return (prix * nbJours(currentHosp.date_admission, currentHosp.date_sortie)).toLocaleString("fr-FR");
                            })()} CFA
                          </div>
                          <div style={{ fontSize:11, color:"var(--cm)", marginTop:2 }}>
                            {nbJours(currentHosp.date_admission, currentHosp.date_sortie)} jour(s) × {({ standard:"15 000", privee:"35 000", vip:"75 000" }[currentHosp.type_chambre] || "15 000")} CFA
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── CONSTANTES ── */}
              {section === "constantes" && (
                <div style={{ marginTop:20 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--hn)" }}>Suivi des constantes vitales</div>
                      <div style={{ fontSize:12, color:"var(--cm)" }}>{constantes.length} relevé(s) enregistré(s)</div>
                    </div>
                    <button className="hbtn hbtn-primary" onClick={() => { setFormConstante(EMPTY_CONSTANTE); setModalConstante(true); }}>
                      {I.plus} Ajouter constantes
                    </button>
                  </div>

                  {/* Dernières constantes en vitals */}
                  {constantes.length > 0 && (
                    <div className="ho-g5" style={{ marginBottom:20 }}>
                      {[
                        { lbl:"Température", val: constantes[0].temperature ? `${constantes[0].temperature}°C` : "—", warn: constantes[0].temperature > 38.5 || constantes[0].temperature < 36, cls: constantes[0].temperature > 38.5 ? "danger" : constantes[0].temperature < 36 ? "warn" : "ok" },
                        { lbl:"Tension", val: constantes[0].tension_sys && constantes[0].tension_dia ? `${constantes[0].tension_sys}/${constantes[0].tension_dia}` : constantes[0].tension || "—", warn:false, cls:"" },
                        { lbl:"Fréquence cardiaque", val: constantes[0].fc ? `${constantes[0].fc} bpm` : "—", warn: constantes[0].fc > 100 || constantes[0].fc < 55, cls: constantes[0].fc > 100 || constantes[0].fc < 55 ? "danger" : "ok" },
                        { lbl:"SpO₂", val: constantes[0].spo2 ? `${constantes[0].spo2}%` : "—", warn: constantes[0].spo2 < 94, cls: constantes[0].spo2 < 94 ? "danger" : "ok" },
                        { lbl:"Poids", val: constantes[0].poids ? `${constantes[0].poids} kg` : "—", warn:false, cls:"" },
                      ].map(v => (
                        <div key={v.lbl} className={`vital-ho ${v.cls} hofu`}>
                          <div className="vital-v-ho" style={v.cls==="danger"?{color:"var(--hr)"}:{}}>{v.val}</div>
                          <div className="vital-l-ho">{v.lbl}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="ho-card">
                    <div className="ho-card-hdr"><h3>💓 Historique des constantes</h3></div>
                    <div style={{ overflowX:"auto" }}>
                      <table className="ho-tbl">
                        <thead>
                          <tr><th>Date / Heure</th><th>Temp (°C)</th><th>Tension</th><th>FC (bpm)</th><th>SpO₂ (%)</th><th>Poids (kg)</th><th>Note médicale</th><th>Note infirmière</th></tr>
                        </thead>
                        <tbody>
                          {constantes.map(c => (
                            <tr key={c.id}>
                              <td style={{ fontWeight:600, fontSize:12 }}>{fmtDateTime(c.date)}</td>
                              <td>
                                <span style={{ fontWeight:600, color: c.temperature > 38.5 ? "var(--hr)" : c.temperature < 36 ? "var(--ho)" : "var(--hg)" }}>
                                  {c.temperature || "—"}
                                </span>
                              </td>
                              <td style={{ fontSize:12 }}>{c.tension_sys && c.tension_dia ? `${c.tension_sys}/${c.tension_dia}` : c.tension || "—"}</td>
                              <td>
                                <span style={{ fontWeight:600, color: c.fc > 100 || c.fc < 55 ? "var(--hr)" : "var(--hg)" }}>
                                  {c.fc || "—"}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontWeight:600, color: c.spo2 < 94 ? "var(--hr)" : "var(--hg)" }}>
                                  {c.spo2 || "—"}
                                </span>
                              </td>
                              <td style={{ fontSize:12 }}>{c.poids || "—"}</td>
                              <td style={{ fontSize:11, color:"var(--cm)", maxWidth:200 }}>{c.note || c.note_med || "—"}</td>
                              <td style={{ fontSize:11, color:"var(--cm)", maxWidth:200 }}>{c.note_inf || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TRAITEMENTS ── */}
              {section === "traitements" && (
                <div style={{ marginTop:20 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--hn)" }}>Traitements administrés</div>
                      <div style={{ fontSize:12, color:"var(--cm)" }}>{traitements.length} traitement(s)</div>
                    </div>
                    <button className="hbtn hbtn-primary" onClick={() => { setFormTraitement(EMPTY_TRAITEMENT); setModalTraitement(true); }}>{I.plus} Ajouter traitement</button>
                  </div>
                  <div className="ho-card">
                    <div className="ho-card-hdr"><h3>💊 Feuille de traitement</h3></div>
                    <div style={{ padding:16 }}>
                      {traitements.map(t => (
                        <div key={t.id} className="trait-row">
                          <div style={{ width:36, height:36, borderRadius:10, background:t.statut === "administre" ? "#EAFAF1" : "#EBF5FB", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>💊</div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:"var(--hn)" }}>{t.medicament}</div>
                            <div style={{ fontSize:11, color:"var(--cm)" }}>
                              {t.dose} · Voie {t.voie} · {t.heure} · {t.personnel}
                            </div>
                          </div>
                          <Badge cls={t.statut === "administre" ? "green" : "blue"}>
                            {t.statut === "administre" ? "✅ Administré" : "📋 Planifié"}
                          </Badge>
                          {t.statut === "planifie" && (
                            <button className="hbtn hbtn-success hbtn-sm" onClick={() => setTraitements(prev => prev.map(x => x.id === t.id ? { ...x, statut:"administre" } : x))}>
                              Valider
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── PRESCRIPTIONS ── */}
              {section === "prescriptions" && (
                <div style={{ marginTop:20 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--hn)" }}>Prescriptions médicales</div>
                      <div style={{ fontSize:12, color:"var(--cm)" }}>Médicaments, perfusions, soins, régime, kiné</div>
                    </div>
                    <button className="hbtn hbtn-primary" onClick={() => { setFormPrescription({ type:"medicament", designation:"", posologie:"", medecin:"" }); setModalPrescription(true); }}>{I.plus} Nouvelle prescription</button>
                  </div>
                  <div className="ho-card">
                    <div className="ho-card-hdr"><h3>📄 Ordonnances d'hospitalisation</h3></div>
                    <div style={{ padding:16 }}>
                      {["medicament","perfusion","soin","regime","kine"].map(type => {
                        const items = prescriptions.filter(p => p.type === type);
                        if (items.length === 0) return null;
                        const icons = { medicament:"💊", perfusion:"🩸", soin:"🩺", regime:"🥗", kine:"🏃" };
                        const labels = { medicament:"Médicaments", perfusion:"Perfusions", soin:"Soins infirmiers", regime:"Régime alimentaire", kine:"Kinésithérapie" };
                        const colors = { medicament:"var(--hb)", perfusion:"var(--hr)", soin:"var(--ht)", regime:"var(--hg)", kine:"var(--hp)" };
                        return (
                          <div key={type} style={{ marginBottom:16 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:colors[type], marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                              {icons[type]} {labels[type]}
                            </div>
                            {items.map(p => (
                              <div key={p.id} style={{ background:"#F4F9FD", border:"1.5px solid var(--cbr)", borderRadius:10, padding:"10px 14px", marginBottom:8, display:"flex", gap:12, alignItems:"flex-start" }}>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontSize:13, fontWeight:600, color:"var(--hn)" }}>{p.designation}</div>
                                  <div style={{ fontSize:11, color:"var(--cm)" }}>{p.posologie} · {p.medecin} · {fmtDate(p.date)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── EXAMENS ── */}
              {section === "examens" && (
                <div style={{ marginTop:20 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--hn)" }}>Examens complémentaires</div>
                      <div style={{ fontSize:12, color:"var(--cm)" }}>{examens.filter(e=>e.statut==="attente").length} en attente · {examens.filter(e=>e.statut==="resultat").length} résultats disponibles</div>
                    </div>
                    <button className="hbtn hbtn-primary" onClick={() => { setFormExamen(EMPTY_EXAMEN); setModalExamen(true); }}>{I.plus} Demander examen</button>
                  </div>

                  {examens.filter(e=>e.statut==="attente").length > 0 && (
                    <div className="al-ho-warn" style={{ marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:18 }}>⏳</span>
                      <span style={{ fontSize:13, color:"#7E5109" }}><strong>{examens.filter(e=>e.statut==="attente").length}</strong> examen(s) en attente de résultats</span>
                    </div>
                  )}

                  {["labo","imagerie"].map(type => {
                    const items = examens.filter(e => e.type === type);
                    return (
                      <div key={type} className="ho-card" style={{ marginBottom:16 }}>
                        <div className="ho-card-hdr">
                          <h3>{type === "labo" ? <>{I.flask} Analyses de laboratoire</> : <>{I.xray} Imagerie médicale</>}</h3>
                          <Badge cls="blue">{items.length} examen(s)</Badge>
                        </div>
                        <div style={{ overflowX:"auto" }}>
                          <table className="ho-tbl">
                            <thead><tr><th>Examen</th><th>Date demande</th><th>Statut</th><th>Résultat</th></tr></thead>
                            <tbody>
                              {items.map(e => (
                                <tr key={e.id}>
                                  <td style={{ fontWeight:600 }}>{e.designation}</td>
                                  <td style={{ fontSize:12, color:"var(--cm)" }}>{fmtDate(e.date)}</td>
                                  <td><Badge cls={e.statut === "resultat" ? "green" : "orange"}>{e.statut === "resultat" ? "✅ Résultat" : "⏳ En attente"}</Badge></td>
                                  <td style={{ fontSize:12, color:"var(--hn)", maxWidth:250 }}>
                                    {e.resultat ? (
                                      <span style={{ background:"#EAFAF1", borderRadius:6, padding:"3px 8px", fontSize:11 }}>{e.resultat}</span>
                                    ) : (
                                      <button className="hbtn hbtn-ghost hbtn-sm" onClick={() => { const r = prompt("Saisir le résultat :"); if (r) setExamens(prev => prev.map(x => x.id === e.id ? { ...x, resultat:r, statut:"resultat" } : x)); }}>
                                        Saisir résultat
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── VISITES ── */}
              {section === "visites" && (
                <div style={{ marginTop:20 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--hn)" }}>Registre des visites</div>
                      <div style={{ fontSize:12, color:"var(--cm)" }}>{visites.length} visite(s) enregistrée(s)</div>
                    </div>
                    <button className="hbtn hbtn-primary" onClick={() => { setFormVisite(EMPTY_VISITE); setModalVisite(true); }}>{I.plus} Enregistrer visite</button>
                  </div>
                  <div className="ho-card">
                    <div className="ho-card-hdr"><h3>{I.visitor} Suivi des visites</h3></div>
                    <div style={{ overflowX:"auto" }}>
                      <table className="ho-tbl">
                        <thead>
                          <tr><th>Date</th><th>Visiteur</th><th>Heure entrée</th><th>Heure sortie</th><th>Durée</th><th>Note</th></tr>
                        </thead>
                        <tbody>
                          {visites.map(v => {
                            const duree = v.heure_entree && v.heure_sortie ? (() => {
                              const [h1,m1] = v.heure_entree.split(":").map(Number);
                              const [h2,m2] = v.heure_sortie.split(":").map(Number);
                              return `${h2*60+m2 - (h1*60+m1)} min`;
                            })() : "—";
                            return (
                              <tr key={v.id}>
                                <td style={{ fontWeight:600, fontSize:12 }}>{fmtDate(v.date)}</td>
                                <td style={{ fontWeight:600 }}>{v.visiteur}</td>
                                <td><Badge cls="blue">{v.heure_entree || "—"}</Badge></td>
                                <td><Badge cls="teal">{v.heure_sortie || "—"}</Badge></td>
                                <td style={{ fontSize:12, color:"var(--cm)" }}>{duree}</td>
                                <td style={{ fontSize:12, color:"var(--cm)" }}>{v.note || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── FACTURATION ── */}
              {section === "facturation" && (
                <div style={{ marginTop:20 }}>
                  <div className="ho-card">
                    <div className="ho-card-hdr"><h3>💰 Facturation d'hospitalisation</h3></div>
                    <div style={{ padding:20 }}>
                      {(() => {
                        const prixChambre = { standard:15000, privee:35000, vip:75000 }[currentHosp.type_chambre] || 15000;
                        const jours = nbJours(currentHosp.date_admission, currentHosp.date_sortie);
                        const hebergement = prixChambre * jours;
                        const actes = [
                          [`Hébergement — ${TYPE_CHAMBRE[currentHosp.type_chambre]} (${jours} nuit(s) × ${prixChambre.toLocaleString("fr-FR")} CFA)`, hebergement],
                          ["Frais de consultation médicale", 25000],
                          ["Soins infirmiers", traitements.filter(t=>t.statut==="administre").length * 5000],
                          ["Médicaments & perfusions", prescriptions.filter(p=>p.type==="medicament"||p.type==="perfusion").length * 18000],
                          ["Analyses de laboratoire", examens.filter(e=>e.type==="labo").length * 12000],
                          ["Imagerie médicale", examens.filter(e=>e.type==="imagerie").length * 35000],
                        ];
                        const total = actes.reduce((s,[,v])=>s+v,0);
                        const paye = Math.round(total * 0.65);
                        const reste = total - paye;
                        return (
                          <>
                            <table className="ho-tbl" style={{ marginBottom:20 }}>
                              <thead><tr><th>Prestation</th><th style={{textAlign:"right"}}>Montant (CFA)</th></tr></thead>
                              <tbody>{actes.map(([lbl,val]) => val > 0 && <tr key={lbl}><td style={{fontSize:12}}>{lbl}</td><td style={{textAlign:"right",fontWeight:600}}>{val.toLocaleString("fr-FR")}</td></tr>)}</tbody>
                            </table>
                            <div style={{ background:"#F4F9FD", borderRadius:14, padding:16, marginBottom:16 }}>
                              <div className="ho-g11s" style={{ gridTemplateColumns:"repeat(3,1fr)" }}>
                                <div style={{ background:"#EBF5FB", borderRadius:10, padding:14, textAlign:"center" }}>
                                  <div style={{ fontSize:18, fontWeight:800, color:"var(--hb)" }}>{total.toLocaleString("fr-FR")}</div>
                                  <div style={{ fontSize:11, color:"var(--cm)", marginTop:2 }}>TOTAL (CFA)</div>
                                </div>
                                <div style={{ background:"#EAFAF1", borderRadius:10, padding:14, textAlign:"center" }}>
                                  <div style={{ fontSize:18, fontWeight:800, color:"var(--hg)" }}>{paye.toLocaleString("fr-FR")}</div>
                                  <div style={{ fontSize:11, color:"var(--cm)", marginTop:2 }}>PAYÉ (CFA)</div>
                                </div>
                                <div style={{ background:"#FDEDEC", borderRadius:10, padding:14, textAlign:"center" }}>
                                  <div style={{ fontSize:18, fontWeight:800, color:"var(--hr)" }}>{reste.toLocaleString("fr-FR")}</div>
                                  <div style={{ fontSize:11, color:"var(--cm)", marginTop:2 }}>RESTE À PAYER</div>
                                </div>
                              </div>
                              <div style={{ marginTop:12 }}><Prog pct={Math.round(paye/total*100)} color="var(--hg)" /></div>
                              <div style={{ fontSize:11, color:"var(--cm)", marginTop:4, textAlign:"right" }}>Taux de paiement : {Math.round(paye/total*100)}%</div>
                            </div>
                            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                              <button className="hbtn hbtn-teal" onClick={() => toast.success("📄 Génération facture...")}>{I.dl} Générer facture</button>
                              <button className="hbtn hbtn-ghost" onClick={() => window.print()}>{I.print} Imprimer</button>
                              <button className="hbtn hbtn-ghost" onClick={() => toast.success("📤 Envoi à la facturation...")}>{I.link} Envoyer facturation</button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* ── SORTIE ── */}
              {section === "sortie" && (
                <div style={{ marginTop:20 }}>
                  {currentHosp.statut === "sorti" ? (
                    <div>
                      <div className="al-ho-success" style={{ marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
                        <span style={{ fontSize:24 }}>✅</span>
                        <div>
                          <strong style={{ color:"var(--hg)", fontSize:14 }}>Patient sorti le {fmtDate(currentHosp.date_sortie)}</strong>
                          <div style={{ fontSize:12, color:"var(--hg)", marginTop:3 }}>État : {(ETAT_SORTIE[currentHosp.etat_patient]||{}).label}</div>
                        </div>
                      </div>
                      <div className="ho-card">
                        <div className="ho-card-hdr">
                          <h3>🚪 Détails de sortie</h3>
                          <button className="hbtn hbtn-ghost hbtn-sm" onClick={() => { setFormSortie({ date_sortie:fmtDateInput(currentHosp.date_sortie), etat_patient:currentHosp.etat_patient || "gueri", diagnostic_sortie:currentHosp.diagnostic_sortie || "", recommandations:currentHosp.recommandations || "", rdv_controle:currentHosp.rdv_controle || "" }); setModalSortie(true); }}>Modifier</button>
                        </div>
                        <div style={{ padding:20, display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                          {[
                            ["Date de sortie", fmtDate(currentHosp.date_sortie)],
                            ["État du patient", (ETAT_SORTIE[currentHosp.etat_patient]||{}).label || "—"],
                            ["Diagnostic de sortie", currentHosp.diagnostic_sortie || "—"],
                            ["Recommandations", currentHosp.recommandations || "—"],
                            ["Rendez-vous de contrôle", currentHosp.rdv_controle || "—"],
                          ].map(([lbl,val]) => (
                            <div key={lbl} style={{ background:"#F4F9FD", borderRadius:10, padding:"10px 14px" }}>
                              <div style={{ fontSize:10, fontWeight:600, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.4 }}>{lbl}</div>
                              <div style={{ fontSize:13, color:"var(--hn)", marginTop:4 }}>{val}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="ho-card" style={{ padding:40, textAlign:"center" }}>
                      <div style={{ fontSize:40, marginBottom:14 }}>🚪</div>
                      <div style={{ fontWeight:700, fontSize:16, color:"var(--hn)", marginBottom:8 }}>Sortie du patient</div>
                      <div style={{ color:"var(--cm)", fontSize:13, marginBottom:20 }}>Patient actuellement hospitalisé. Enregistrer la sortie lorsque le patient quitte l'établissement.</div>
                      <button className="hbtn hbtn-teal" onClick={() => { setFormSortie(EMPTY_SORTIE); setModalSortie(true); }}>{I.exit} Enregistrer la sortie</button>
                    </div>
                  )}
                </div>
              )}

              {/* ── DOCUMENTS ── */}
              {section === "documents" && (
                <div style={{ marginTop:20 }}>
                  <div className="ho-card">
                    <div className="ho-card-hdr"><h3>📄 Documents d'hospitalisation</h3></div>
                    <div style={{ padding:20, display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:14 }}>
                      {[
                        ["📋","Bulletin d'admission","Fiche d'entrée du patient"],
                        ["🛏","Fiche d'hospitalisation","Dossier complet de séjour"],
                        ["💓","Feuille de suivi infirmier","Constantes et soins quotidiens"],
                        ["🔬","Rapport médical","Compte rendu médical complet"],
                        ["🚪","Bon de sortie","Attestation de sortie"],
                        ["💰","Facture","Détail des frais d'hospitalisation"],
                        ["💊","Ordonnance de sortie","Prescriptions post-hospitalisation"],
                        ["📁","Résumé du séjour","Synthèse médicale complète"],
                      ].map(([icon,title,desc]) => (
                        <div key={title} style={{ background:"#F4F9FD", border:"1.5px solid var(--cbr)", borderRadius:14, padding:16, display:"flex", flexDirection:"column", gap:8, transition:"all .2s" }}
                          onMouseOver={e => e.currentTarget.style.boxShadow="var(--shm)"} onMouseOut={e => e.currentTarget.style.boxShadow="none"}>
                          <div style={{ fontSize:24 }}>{icon}</div>
                          <div style={{ fontWeight:700, color:"var(--hn)", fontSize:13 }}>{title}</div>
                          <div style={{ fontSize:11, color:"var(--cm)" }}>{desc}</div>
                          <button className="hbtn hbtn-ghost hbtn-sm" style={{ marginTop:"auto" }} onClick={() => toast.success(`📄 ${title} en cours de génération...`)}>
                            {I.dl} Générer
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ STATS ══ */}
          {tab === "stats" && (
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--hn)", marginBottom:20 }}>Statistiques — Hospitalisation</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
                {[
                  { color:"blue",   val:kpis.total,        lbl:"Admissions/mois",    sub:"moyenne 3 mois" },
                  { color:"teal",   val:"70%",             lbl:"Taux d'occupation",  sub:"toutes chambres" },
                  { color:"green",  val:"4.8 j",           lbl:"Durée moyenne",      sub:"par hospitalisation" },
                  { color:"orange", val:"3.2%",            lbl:"Taux de réadmission",sub:"sur 30 jours" },
                  { color:"purple", val:"92%",             lbl:"Taux de satisfaction",sub:"sorties enquêtées" },
                  { color:"blue",   val:"2.4M CFA",        lbl:"Recettes/mois",      sub:"hébergement + soins" },
                ].map((k,i) => (
                  <div key={i} className={`ho-kpi ${k.color} hofu`}>
                    <div className="kpi-val-ho">{k.val}</div>
                    <div className="kpi-lbl-ho">{k.lbl}</div>
                    <div className="kpi-sub-ho">{k.sub}</div>
                  </div>
                ))}
              </div>
              <div className="ho-g32" style={{ marginBottom:20 }}>
                <div className="ho-card">
                  <div className="ho-card-hdr"><h3>{I.trend} Admissions par mois</h3></div>
                  <div style={{ padding:20 }}><BarChart labels={["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"]} data={[18,22,19,25,28,24,20,16,21,23,19,26]} color="#1A5276" /></div>
                </div>
                <div className="ho-card">
                  <div className="ho-card-hdr"><h3>Répartition services</h3></div>
                  <div style={{ padding:20 }}><DoughnutChart labels={["Chirurgie","Médecine","Gynéco","Cardio","Pédiatrie"]} data={[35,25,18,12,10]} colors={["#1A5276","#17A589","#D68910","#6C3483","#117A65"]} /></div>
                </div>
              </div>
              <div className="ho-g11">
                <div className="ho-card">
                  <div className="ho-card-hdr"><h3>📊 Taux d'occupation par service</h3></div>
                  <div style={{ padding:16 }}>
                    {[["Chirurgie générale",85,"var(--hb)"],["Médecine interne",72,"var(--ht)"],["Gynécologie",68,"var(--hg)"],["Cardiologie",90,"var(--hr)"],["Pédiatrie",55,"var(--hp)"]].map(([lbl,pct,col]) => (
                      <div key={lbl} style={{ marginBottom:12 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                          <span style={{ color:"var(--cm)" }}>{lbl}</span>
                          <strong style={{ color:"var(--hn)" }}>{pct}%</strong>
                        </div>
                        <Prog pct={pct} color={col} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="ho-card">
                  <div className="ho-card-hdr"><h3>🚪 Statuts de sortie</h3></div>
                  <div style={{ padding:16 }}>
                    {[["Guéri","✅",52,"var(--hg)"],["Amélioré","⬆️",28,"var(--ht)"],["Stable","➡️",12,"var(--hb)"],["Transféré","🚑",5,"var(--hp)"],["Décédé","💔",3,"var(--hr)"]].map(([lbl,ico,pct,col]) => (
                      <div key={lbl} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid #EAF4FB" }}>
                        <span style={{ fontSize:14 }}>{ico}</span>
                        <span style={{ fontSize:12, color:"var(--cm)", flex:1 }}>{lbl}</span>
                        <div style={{ width:100 }}><Prog pct={pct} color={col} /></div>
                        <strong style={{ fontSize:13, color:"var(--hn)", minWidth:36, textAlign:"right" }}>{pct}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ MODAL : NOUVELLE ADMISSION ═══ */}
        <Modal open={modalAdmission} onClose={() => setModalAdmission(false)} title={<>{I.plus} Nouvelle admission — Hospitalisation</>} maxWidth={760}>
          <form onSubmit={createHosp}>
            <div className="ho-g11" style={{ gap:14 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="hlbl">Patient *</label>
                <select className="hinp" required value={formHosp.patient_id} onChange={e => setFormHosp(f=>({...f,patient_id:e.target.value}))}>
                  <option value="">— Sélectionner un patient —</option>
                  {patients.map(p => <option key={p._id} value={p._id}>{p.prenom} {p.nom} — {p.numero_dossier}</option>)}
                </select>
              </div>
              <div>
                <label className="hlbl">Provenance *</label>
                <select className="hinp" required value={formHosp.provenance} onChange={e => setFormHosp(f=>({...f,provenance:e.target.value}))}>
                  <option value="urgences">Urgences</option>
                  <option value="consultation">Consultation</option>
                  <option value="transfert">Transfert externe</option>
                  <option value="bloc">Post-opératoire</option>
                </select>
              </div>
              <div>
                <label className="hlbl">Service d'hospitalisation *</label>
                <input className="hinp" required placeholder="Ex: Chirurgie générale..." value={formHosp.service} onChange={e => setFormHosp(f=>({...f,service:e.target.value}))} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="hlbl">Motif d'hospitalisation *</label>
                <input className="hinp" required placeholder="Ex: Surveillance post-opératoire, Décompensation..." value={formHosp.motif} onChange={e => setFormHosp(f=>({...f,motif:e.target.value}))} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="hlbl">Diagnostic d'entrée</label>
                <input className="hinp" placeholder="Ex: Appendicite aiguë, Insuffisance cardiaque..." value={formHosp.diagnostic_entree} onChange={e => setFormHosp(f=>({...f,diagnostic_entree:e.target.value}))} />
              </div>
              <div>
                <label className="hlbl">Médecin responsable</label>
                <input className="hinp" placeholder="Dr. Nom Prénom" value={formHosp.medecin} onChange={e => setFormHosp(f=>({...f,medecin:e.target.value}))} />
              </div>
              <div>
                <label className="hlbl">Date et heure d'admission</label>
                <input type="datetime-local" className="hinp" value={formHosp.date_admission} onChange={e => setFormHosp(f=>({...f,date_admission:e.target.value}))} />
              </div>
              <div>
                <label className="hlbl">Bâtiment</label>
                <select className="hinp" value={formHosp.batiment} onChange={e => setFormHosp(f=>({...f,batiment:e.target.value}))}>
                  <option value="">— Non attribué —</option>
                  <option value="Bâtiment A">Bâtiment A</option>
                  <option value="Bâtiment B">Bâtiment B</option>
                  <option value="Bâtiment C">Bâtiment C</option>
                </select>
              </div>
              <div>
                <label className="hlbl">Type de chambre</label>
                <select className="hinp" value={formHosp.type_chambre} onChange={e => setFormHosp(f=>({...f,type_chambre:e.target.value}))}>
                  <option value="standard">Standard (15 000 CFA/nuit)</option>
                  <option value="privee">Privée (35 000 CFA/nuit)</option>
                  <option value="vip">VIP (75 000 CFA/nuit)</option>
                </select>
              </div>
              <div>
                <label className="hlbl">Chambre</label>
                <input className="hinp" placeholder="Ex: A12, B05..." value={formHosp.chambre} onChange={e => setFormHosp(f=>({...f,chambre:e.target.value}))} />
              </div>
              <div>
                <label className="hlbl">Numéro de lit</label>
                <input className="hinp" placeholder="Ex: 01, 02..." value={formHosp.lit} onChange={e => setFormHosp(f=>({...f,lit:e.target.value}))} />
              </div>
              <div>
                <label className="hlbl">Personne à contacter (urgence)</label>
                <input className="hinp" placeholder="Nom et lien de parenté" value={formHosp.contact_urgence} onChange={e => setFormHosp(f=>({...f,contact_urgence:e.target.value}))} />
              </div>
              <div>
                <label className="hlbl">Téléphone urgence</label>
                <input className="hinp" placeholder="77 xxx xx xx" value={formHosp.tel_urgence} onChange={e => setFormHosp(f=>({...f,tel_urgence:e.target.value}))} />
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button type="button" className="hbtn hbtn-ghost" onClick={() => setModalAdmission(false)}>Annuler</button>
              <button type="submit" className="hbtn hbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>
                {I.save} {saving ? "Enregistrement..." : "Créer l'admission"}
              </button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : CONSTANTES ═══ */}
        <Modal open={modalConstante} onClose={() => setModalConstante(false)} title="💓 Saisie des constantes vitales" maxWidth={560}>
          <form onSubmit={addConstante}>
            <div className="ho-g11" style={{ gap:14 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="hlbl">Date et heure</label>
                <input type="datetime-local" className="hinp" value={formConstante.date} onChange={e => setFormConstante(f=>({...f,date:e.target.value}))} />
              </div>
              <div>
                <label className="hlbl">Température (°C)</label>
                <input type="number" step="0.1" className="hinp" placeholder="37.0" value={formConstante.temperature} onChange={e => setFormConstante(f=>({...f,temperature:e.target.value}))} />
              </div>
              <div>
                <label className="hlbl">Tension artérielle (mmHg)</label>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <input type="number" className="hinp" placeholder="120" style={{flex:1}} value={formConstante.tension_sys} onChange={e => setFormConstante(f=>({...f,tension_sys:e.target.value}))} />
                  <span style={{ fontWeight:700, color:"var(--cm)" }}>/</span>
                  <input type="number" className="hinp" placeholder="80" style={{flex:1}} value={formConstante.tension_dia} onChange={e => setFormConstante(f=>({...f,tension_dia:e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="hlbl">Fréquence cardiaque (bpm)</label>
                <input type="number" className="hinp" placeholder="72" value={formConstante.fc} onChange={e => setFormConstante(f=>({...f,fc:e.target.value}))} />
              </div>
              <div>
                <label className="hlbl">Saturation SpO₂ (%)</label>
                <input type="number" className="hinp" placeholder="98" min="0" max="100" value={formConstante.spo2} onChange={e => setFormConstante(f=>({...f,spo2:e.target.value}))} />
              </div>
              <div>
                <label className="hlbl">Poids (kg)</label>
                <input type="number" step="0.1" className="hinp" placeholder="70.0" value={formConstante.poids} onChange={e => setFormConstante(f=>({...f,poids:e.target.value}))} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="hlbl">Observations médicales</label>
                <textarea className="hinp" rows={2} value={formConstante.note_med} onChange={e => setFormConstante(f=>({...f,note_med:e.target.value}))} placeholder="Notes du médecin sur l'état du patient..." />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="hlbl">Notes infirmières</label>
                <textarea className="hinp" rows={2} value={formConstante.note_inf} onChange={e => setFormConstante(f=>({...f,note_inf:e.target.value}))} placeholder="Observations de l'infirmier(ère)..." />
              </div>
              <div style={{ gridColumn:"1/-1", display:"flex", gap:10 }}>
                <button type="button" className="hbtn hbtn-ghost" onClick={() => setModalConstante(false)}>Annuler</button>
                <button type="submit" className="hbtn hbtn-teal" style={{ marginLeft:"auto" }}>{I.save} Enregistrer</button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : TRAITEMENT ═══ */}
        <Modal open={modalTraitement} onClose={() => setModalTraitement(false)} title="💊 Ajouter un traitement" maxWidth={500}>
          <form onSubmit={addTraitement}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label className="hlbl">Médicament *</label>
                <input className="hinp" required placeholder="Ex: Paracétamol 1g, Amoxicilline 500mg..." value={formTraitement.medicament} onChange={e => setFormTraitement(f=>({...f,medicament:e.target.value}))} />
              </div>
              <div className="ho-g11s">
                <div>
                  <label className="hlbl">Dose *</label>
                  <input className="hinp" required placeholder="Ex: 1 comprimé, 500mg..." value={formTraitement.dose} onChange={e => setFormTraitement(f=>({...f,dose:e.target.value}))} />
                </div>
                <div>
                  <label className="hlbl">Heure d'administration</label>
                  <input type="time" className="hinp" value={formTraitement.heure} onChange={e => setFormTraitement(f=>({...f,heure:e.target.value}))} />
                </div>
              </div>
              <div className="ho-g11s">
                <div>
                  <label className="hlbl">Voie d'administration</label>
                  <select className="hinp" value={formTraitement.voie} onChange={e => setFormTraitement(f=>({...f,voie:e.target.value}))}>
                    <option value="orale">Orale (PO)</option>
                    <option value="IV">Intraveineuse (IV)</option>
                    <option value="IM">Intramusculaire (IM)</option>
                    <option value="SC">Sous-cutanée (SC)</option>
                    <option value="locale">Locale</option>
                  </select>
                </div>
                <div>
                  <label className="hlbl">Statut</label>
                  <select className="hinp" value={formTraitement.statut} onChange={e => setFormTraitement(f=>({...f,statut:e.target.value}))}>
                    <option value="planifie">Planifié</option>
                    <option value="administre">Administré</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="hlbl">Personnel responsable</label>
                <input className="hinp" placeholder="Inf. Nom Prénom" value={formTraitement.personnel} onChange={e => setFormTraitement(f=>({...f,personnel:e.target.value}))} />
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="hbtn hbtn-ghost" onClick={() => setModalTraitement(false)}>Annuler</button>
                <button type="submit" className="hbtn hbtn-teal" style={{ marginLeft:"auto" }}>{I.save} Ajouter</button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : EXAMEN ═══ */}
        <Modal open={modalExamen} onClose={() => setModalExamen(false)} title="🔬 Demande d'examen complémentaire" maxWidth={500}>
          <form onSubmit={addExamen}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label className="hlbl">Type d'examen</label>
                <select className="hinp" value={formExamen.type} onChange={e => setFormExamen(f=>({...f,type:e.target.value}))}>
                  <option value="labo">Analyse de laboratoire</option>
                  <option value="imagerie">Imagerie médicale</option>
                </select>
              </div>
              <div>
                <label className="hlbl">Désignation de l'examen *</label>
                <input className="hinp" required placeholder="Ex: NFS, CRP, Radiographie thorax, Échographie..." value={formExamen.designation} onChange={e => setFormExamen(f=>({...f,designation:e.target.value}))} />
              </div>
              <div>
                <label className="hlbl">Date de demande</label>
                <input type="date" className="hinp" value={formExamen.date} onChange={e => setFormExamen(f=>({...f,date:e.target.value}))} />
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="hbtn hbtn-ghost" onClick={() => setModalExamen(false)}>Annuler</button>
                <button type="submit" className="hbtn hbtn-teal" style={{ marginLeft:"auto" }}>{I.save} Demander</button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : VISITE ═══ */}
        <Modal open={modalVisite} onClose={() => setModalVisite(false)} title="👥 Enregistrer une visite" maxWidth={480}>
          <form onSubmit={addVisite}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label className="hlbl">Visiteur *</label>
                <input className="hinp" required placeholder="Nom et lien de parenté (ex: Marie Dupont — épouse)" value={formVisite.visiteur} onChange={e => setFormVisite(f=>({...f,visiteur:e.target.value}))} />
              </div>
              <div>
                <label className="hlbl">Date de visite</label>
                <input type="date" className="hinp" value={formVisite.date} onChange={e => setFormVisite(f=>({...f,date:e.target.value}))} />
              </div>
              <div className="ho-g11s">
                <div>
                  <label className="hlbl">Heure d'entrée</label>
                  <input type="time" className="hinp" value={formVisite.heure_entree} onChange={e => setFormVisite(f=>({...f,heure_entree:e.target.value}))} />
                </div>
                <div>
                  <label className="hlbl">Heure de sortie</label>
                  <input type="time" className="hinp" value={formVisite.heure_sortie} onChange={e => setFormVisite(f=>({...f,heure_sortie:e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="hlbl">Note</label>
                <input className="hinp" placeholder="Observation facultative..." value={formVisite.note} onChange={e => setFormVisite(f=>({...f,note:e.target.value}))} />
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="hbtn hbtn-ghost" onClick={() => setModalVisite(false)}>Annuler</button>
                <button type="submit" className="hbtn hbtn-teal" style={{ marginLeft:"auto" }}>{I.save} Enregistrer</button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : PRESCRIPTION ═══ */}
        <Modal open={modalPrescription} onClose={() => setModalPrescription(false)} title="📄 Nouvelle prescription" maxWidth={480}>
          <form onSubmit={e => { e.preventDefault(); setPrescriptions(prev => [...prev, { ...formPrescription, id:Date.now().toString(), date:new Date().toISOString().substring(0,10) }]); toast.success("✅ Prescription ajoutée"); setModalPrescription(false); }}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label className="hlbl">Type de prescription</label>
                <select className="hinp" value={formPrescription.type} onChange={e => setFormPrescription(f=>({...f,type:e.target.value}))}>
                  <option value="medicament">💊 Médicament</option>
                  <option value="perfusion">🩸 Perfusion</option>
                  <option value="soin">🩺 Soin infirmier</option>
                  <option value="regime">🥗 Régime alimentaire</option>
                  <option value="kine">🏃 Kinésithérapie</option>
                </select>
              </div>
              <div>
                <label className="hlbl">Désignation *</label>
                <input className="hinp" required placeholder="Nom du médicament, soin ou régime..." value={formPrescription.designation} onChange={e => setFormPrescription(f=>({...f,designation:e.target.value}))} />
              </div>
              <div>
                <label className="hlbl">Posologie / Instructions</label>
                <textarea className="hinp" rows={2} placeholder="Ex: 3 fois/jour pendant 7 jours, après les repas..." value={formPrescription.posologie} onChange={e => setFormPrescription(f=>({...f,posologie:e.target.value}))} />
              </div>
              <div>
                <label className="hlbl">Médecin prescripteur</label>
                <input className="hinp" placeholder="Dr. Nom Prénom" value={formPrescription.medecin} onChange={e => setFormPrescription(f=>({...f,medecin:e.target.value}))} />
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="hbtn hbtn-ghost" onClick={() => setModalPrescription(false)}>Annuler</button>
                <button type="submit" className="hbtn hbtn-teal" style={{ marginLeft:"auto" }}>{I.save} Ajouter</button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : SORTIE ═══ */}
        <Modal open={modalSortie} onClose={() => setModalSortie(false)} title="🚪 Sortie du patient" maxWidth={540}>
          <form onSubmit={enregistrerSortie}>
            <div className="ho-g11" style={{ gap:14 }}>
              <div>
                <label className="hlbl">Date de sortie *</label>
                <input type="date" className="hinp" required value={formSortie.date_sortie} onChange={e => setFormSortie(f=>({...f,date_sortie:e.target.value}))} />
              </div>
              <div>
                <label className="hlbl">Heure de sortie</label>
                <input type="time" className="hinp" value={formSortie.heure_sortie} onChange={e => setFormSortie(f=>({...f,heure_sortie:e.target.value}))} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="hlbl">État du patient à la sortie</label>
                <select className="hinp" value={formSortie.etat_patient} onChange={e => setFormSortie(f=>({...f,etat_patient:e.target.value}))}>
                  <option value="gueri">✅ Guéri</option>
                  <option value="ameliore">⬆️ Amélioré</option>
                  <option value="stable">➡️ Stable</option>
                  <option value="transfere">🚑 Transféré</option>
                  <option value="deces">💔 Décédé</option>
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="hlbl">Diagnostic de sortie</label>
                <textarea className="hinp" rows={2} value={formSortie.diagnostic_sortie} onChange={e => setFormSortie(f=>({...f,diagnostic_sortie:e.target.value}))} placeholder="Diagnostic confirmé en fin de séjour..." />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="hlbl">Recommandations</label>
                <textarea className="hinp" rows={3} value={formSortie.recommandations} onChange={e => setFormSortie(f=>({...f,recommandations:e.target.value}))} placeholder="Traitements à domicile, restrictions, surveillance..." />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="hlbl">Rendez-vous de contrôle</label>
                <input className="hinp" value={formSortie.rdv_controle} onChange={e => setFormSortie(f=>({...f,rdv_controle:e.target.value}))} placeholder="Ex: Dans 2 semaines en chirurgie, ou date précise..." />
              </div>
              <div style={{ gridColumn:"1/-1", display:"flex", gap:10 }}>
                <button type="button" className="hbtn hbtn-ghost" onClick={() => setModalSortie(false)}>Annuler</button>
                <button type="submit" className="hbtn hbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>
                  {I.exit} {saving ? "..." : "Valider la sortie"}
                </button>
              </div>
            </div>
          </form>
        </Modal>

      </div>
    </>
  );
}