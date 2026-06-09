import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchEchographieStats, fetchDemandes, createDemande,
  selectDemandesList,
} from "../store/slices/echographieSlice";

// ─── CSS — même design system que Consultation (Navy + Teal) ──
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.echo * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --cn:#0B1E3B; --cn2:#132744; --cb:#1B4F9E;
  --ct:#0EA5A0; --ct2:#0D9490; --cr:#DC2626;
  --co:#D97706; --cg:#059669; --cp:#7C3AED; --cu:#0891B2;
  --cbr:#E2EAF4; --cm:#6B7A99; --cl:#EEF4FF; --cs:#F8FAFD;
  --sh:0 1px 3px rgba(11,30,59,.08);
  --shm:0 4px 16px rgba(11,30,59,.10);
  --shl:0 12px 40px rgba(11,30,59,.14);
}

/* ── Topbar ── */
.echo-top {
  background:linear-gradient(135deg,var(--cn) 0%,var(--cn2) 55%,#1B4F9E 100%);
  padding:20px 24px 0; position:relative; overflow:hidden;
}
.echo-top::before {
  content:''; position:absolute; top:-50px; right:-50px;
  width:220px; height:220px;
  background:radial-gradient(circle,rgba(14,165,160,.22) 0%,transparent 70%);
  border-radius:50%; pointer-events:none;
}
.echo-top::after {
  content:''; position:absolute; bottom:-40px; left:60px;
  width:140px; height:140px;
  background:radial-gradient(circle,rgba(8,145,178,.18) 0%,transparent 70%);
  border-radius:50%; pointer-events:none;
}

/* ── Tabs ── */
.echo-tabs { display:flex; gap:2px; padding:0; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.echo-tabs::-webkit-scrollbar { display:none; }
.echo-tab {
  display:flex; align-items:center; gap:7px; padding:10px 18px 12px;
  font-size:12.5px; font-weight:600; color:rgba(255,255,255,.55);
  border:none; background:none; cursor:pointer;
  border-radius:10px 10px 0 0; transition:all .2s;
  white-space:nowrap; font-family:'Poppins',sans-serif;
}
.echo-tab:hover { color:rgba(255,255,255,.88); background:rgba(255,255,255,.08); }
.echo-tab.active { color:var(--cn); background:var(--cs); box-shadow:0 -2px 0 var(--ct) inset; }
.echo-tab-badge {
  background:var(--cr); color:#fff; font-size:10px; font-weight:700;
  padding:1px 6px; border-radius:99px;
}

/* ── Cards ── */
.echo-card {
  background:#fff; border:1.5px solid var(--cbr);
  border-radius:18px; box-shadow:var(--sh); overflow:hidden;
}
.echo-card-hdr {
  padding:14px 20px; border-bottom:1.5px solid var(--cbr);
  display:flex; align-items:center; justify-content:space-between;
  background:linear-gradient(to right,rgba(238,244,255,.6),transparent);
}
.echo-card-hdr h3 {
  font-size:14px; font-weight:700; color:var(--cn);
  margin:0; display:flex; align-items:center; gap:8px;
}
.echo-card-hdr p { font-size:11px; color:var(--cm); margin:2px 0 0; }

/* ── KPI ── */
.echo-kpi {
  background:#fff; border:1.5px solid var(--cbr);
  border-radius:18px; padding:16px 18px;
  box-shadow:var(--sh); position:relative; overflow:hidden;
  transition:transform .2s, box-shadow .2s;
  cursor:default;
}
.echo-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.echo-kpi::before {
  content:''; position:absolute; top:0; left:0; right:0;
  height:3px; border-radius:18px 18px 0 0;
}
.echo-kpi.blue::before  { background:var(--cb); }
.echo-kpi.teal::before  { background:var(--ct); }
.echo-kpi.red::before   { background:var(--cr); }
.echo-kpi.orange::before{ background:var(--co); }
.echo-kpi.green::before { background:var(--cg); }
.echo-kpi.purple::before{ background:var(--cp); }
.echo-kpi.cyan::before  { background:var(--cu); }
.kpi-icon { width:38px; height:38px; border-radius:9px; display:flex; align-items:center; justify-content:center; margin-bottom:10px; font-size:18px; }
.kpi-icon.blue   { background:#EFF6FF; color:var(--cb); }
.kpi-icon.teal   { background:#F0FDFC; color:var(--ct); }
.kpi-icon.red    { background:#FEF2F2; color:var(--cr); }
.kpi-icon.orange { background:#FFF7ED; color:var(--co); }
.kpi-icon.green  { background:#ECFDF5; color:var(--cg); }
.kpi-icon.purple { background:#F5F3FF; color:var(--cp); }
.kpi-icon.cyan   { background:#ECFEFF; color:var(--cu); }
.kpi-val { font-size:24px; font-weight:800; color:var(--cn); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.kpi-lbl { font-size:11px; font-weight:600; color:var(--cm); }
.kpi-sub { font-size:10px; color:#9CA3AF; margin-top:2px; }

/* ── Section nav (sous-onglets) ── */
.sec-nav {
  display:flex; gap:6px; flex-wrap:wrap; padding:14px 20px;
  background:linear-gradient(to right,#F8FAFD,#EEF4FF);
  border-bottom:1.5px solid var(--cbr);
}
.sec-btn {
  display:flex; align-items:center; gap:6px; padding:7px 14px;
  border-radius:8px; font-size:12px; font-weight:600;
  cursor:pointer; border:1.5px solid transparent;
  transition:all .2s; color:var(--cm); background:none;
  font-family:'Poppins',sans-serif; white-space:nowrap;
}
.sec-btn:hover { background:white; color:var(--cn); border-color:var(--cbr); }
.sec-btn.active { background:var(--cn); color:white; border-color:var(--cn); }

/* ── Badges ── */
.cbdg {
  display:inline-flex; align-items:center; gap:5px;
  padding:3px 10px; border-radius:99px;
  font-size:11px; font-weight:600; white-space:nowrap;
}
.cbdg.red    { background:#FEF2F2; color:var(--cr); border:1px solid #FECACA; }
.cbdg.orange { background:#FFF7ED; color:var(--co); border:1px solid #FED7AA; }
.cbdg.yellow { background:#FEFCE8; color:#CA8A04;   border:1px solid #FEF08A; }
.cbdg.green  { background:#ECFDF5; color:var(--cg); border:1px solid #A7F3D0; }
.cbdg.blue   { background:#EFF6FF; color:var(--cb); border:1px solid #BFDBFE; }
.cbdg.teal   { background:#F0FDFC; color:var(--ct); border:1px solid #99F6E4; }
.cbdg.purple { background:#F5F3FF; color:var(--cp); border:1px solid #DDD6FE; }
.cbdg.cyan   { background:#ECFEFF; color:var(--cu); border:1px solid #A5F3FC; }
.cbdg.gray   { background:#F9FAFB; color:#4B5563;   border:1px solid #E5E7EB; }
.cbdg.pink   { background:#FDF2F8; color:#BE185D;   border:1px solid #FBCFE8; }

/* ── Buttons ── */
.cbtn {
  display:inline-flex; align-items:center; gap:7px;
  padding:9px 18px; border-radius:10px;
  font-size:13px; font-weight:600; cursor:pointer;
  border:none; transition:all .2s;
  font-family:'Poppins',sans-serif; text-decoration:none; white-space:nowrap;
}
.cbtn-primary { background:var(--cb); color:#fff; }
.cbtn-primary:hover { background:#174391; transform:translateY(-1px); }
.cbtn-teal  { background:var(--ct); color:#fff; }
.cbtn-teal:hover  { background:var(--ct2); transform:translateY(-1px); }
.cbtn-cyan  { background:var(--cu); color:#fff; }
.cbtn-cyan:hover  { background:#0e7490; transform:translateY(-1px); }
.cbtn-ghost { background:transparent; color:var(--cm); border:1.5px solid var(--cbr); }
.cbtn-ghost:hover { background:var(--cl); color:var(--cn); }
.cbtn-danger { background:#FEF2F2; color:var(--cr); border:1.5px solid #FECACA; }
.cbtn-danger:hover { background:var(--cr); color:#fff; }
.cbtn-orange { background:#FFF7ED; color:var(--co); border:1.5px solid #FED7AA; }
.cbtn-orange:hover { background:var(--co); color:#fff; }
.cbtn-purple { background:#F5F3FF; color:var(--cp); border:1.5px solid #DDD6FE; }
.cbtn-purple:hover { background:var(--cp); color:#fff; }
.cbtn-green { background:#ECFDF5; color:var(--cg); border:1.5px solid #A7F3D0; }
.cbtn-green:hover { background:var(--cg); color:#fff; }
.cbtn-sm { padding:6px 12px; font-size:12px; }
.cbtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }

/* ── Forms ── */
.clbl { font-size:12px; font-weight:600; color:var(--cm); margin-bottom:6px; display:block; }
.clbl.req::after { content:' *'; color:var(--cr); }
.cinp {
  width:100%; padding:9px 13px; border-radius:10px;
  border:1.5px solid var(--cbr); background:#FAFBFF;
  font-size:13px; color:var(--cn); font-family:'Poppins',sans-serif;
  transition:border-color .2s, box-shadow .2s; outline:none;
}
.cinp:focus { border-color:var(--ct); box-shadow:0 0 0 3px rgba(14,165,160,.12); }
textarea.cinp { resize:vertical; min-height:80px; }

/* ── Table ── */
.echo-tbl { width:100%; border-collapse:collapse; }
.echo-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.echo-tbl th { padding:10px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--cm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--cbr); }
.echo-tbl td { padding:10px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.echo-tbl tbody tr:last-child td { border-bottom:none; }
.echo-tbl tbody tr:hover { background:#F8FAFF; }

/* ── Modal ── */
.mov { position:fixed; inset:0; z-index:500; background:rgba(11,30,59,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.mov-box { background:#fff; border-radius:20px; box-shadow:var(--shl); width:100%; max-width:640px; max-height:90vh; overflow-y:auto; animation:slideUp .25s ease; }
@keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.mov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:#EEF4FF; position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.mov-hdr h3 { font-size:15px; font-weight:700; color:var(--cn); margin:0; }
.mov-cls { width:32px; height:32px; border-radius:8px; background:#F3F7FF; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--cm); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.mov-cls:hover { background:#FEF2F2; color:var(--cr); }
.mov-body { padding:24px; }

/* ── Alerts ── */
.al-ia      { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; border-left:4px solid var(--cb); border-radius:14px; padding:14px 18px; }
.al-warn    { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--co); border-radius:14px; padding:14px 18px; }
.al-success { background:linear-gradient(135deg,#ECFDF5,#D1FAE5); border:1.5px solid #A7F3D0; border-left:4px solid var(--cg); border-radius:14px; padding:14px 18px; }
.al-danger  { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--cr); border-radius:14px; padding:14px 18px; }
.al-teal    { background:linear-gradient(135deg,#F0FDFC,#CCFBF1); border:1.5px solid #99F6E4; border-left:4px solid var(--ct); border-radius:14px; padding:14px 18px; }
.al-cyan    { background:linear-gradient(135deg,#ECFEFF,#CFFAFE); border:1.5px solid #A5F3FC; border-left:4px solid var(--cu); border-radius:14px; padding:14px 18px; }

/* ── Upload zone ── */
.upload-zone {
  border:2px dashed var(--cbr); border-radius:14px;
  padding:32px; text-align:center; cursor:pointer;
  transition:all .2s; background:#FAFBFF;
}
.upload-zone:hover { border-color:var(--ct); background:#F0FDFC; }
.upload-zone.drag  { border-color:var(--ct); background:#F0FDFC; box-shadow:0 0 0 4px rgba(14,165,160,.1); }

/* ── Image thumb ── */
.img-thumb {
  border-radius:12px; overflow:hidden; position:relative;
  border:1.5px solid var(--cbr); background:#F8FAFD;
  aspect-ratio:4/3; display:flex; align-items:center; justify-content:center;
  cursor:pointer; transition:all .2s;
}
.img-thumb:hover { border-color:var(--ct); box-shadow:var(--shm); }
.img-thumb-overlay {
  position:absolute; inset:0; background:rgba(11,30,59,.6);
  display:flex; align-items:center; justify-content:center;
  gap:8px; opacity:0; transition:opacity .2s;
}
.img-thumb:hover .img-thumb-overlay { opacity:1; }

/* ── Organ exam card ── */
.organ-card {
  border:1.5px solid var(--cbr); border-radius:14px;
  padding:14px 16px; background:#FAFBFF; transition:all .2s;
  cursor:pointer;
}
.organ-card:hover { border-color:var(--ct); background:#F0FDFC; }
.organ-card.selected { border-color:var(--ct); background:#F0FDFC; box-shadow:0 0 0 3px rgba(14,165,160,.12); }

/* ── Steps ── */
.steps { display:flex; gap:0; margin-bottom:24px; position:relative; }
.steps::before { content:''; position:absolute; top:18px; left:0; right:0; height:2px; background:var(--cbr); z-index:0; }
.step { flex:1; display:flex; flex-direction:column; align-items:center; gap:6px; position:relative; z-index:1; cursor:pointer; }
.step-dot { width:36px; height:36px; border-radius:50%; border:2px solid var(--cbr); background:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; color:var(--cm); transition:all .2s; }
.step.done .step-dot   { background:var(--ct); border-color:var(--ct); color:#fff; }
.step.active .step-dot { background:var(--cn); border-color:var(--cn); color:#fff; box-shadow:0 0 0 4px rgba(14,165,160,.2); }
.step-lbl { font-size:10px; font-weight:600; color:var(--cm); text-align:center; white-space:nowrap; }
.step.active .step-lbl { color:var(--cn); }
.step.done  .step-lbl  { color:var(--ct); }

/* ── Pulse dot ── */
@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.4)} }
.pulse-dot { width:8px; height:8px; border-radius:50%; background:var(--cg); animation:pulse 2s infinite; display:inline-block; }

/* ── Liaison badge ── */
.liaison-badge {
  display:inline-flex; align-items:center; gap:6px;
  padding:6px 12px; border-radius:10px; font-size:11.5px;
  font-weight:600; border:1.5px solid; cursor:pointer;
  transition:all .2s; background:white;
}
.liaison-badge:hover { transform:translateY(-1px); box-shadow:var(--sh); }

/* ── Fade animation ── */
@keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.fu { animation:fadeUp .3s ease both; }

/* ── Compte rendu editor ── */
.cr-section {
  border:1.5px solid var(--cbr); border-radius:12px;
  margin-bottom:14px; overflow:hidden;
}
.cr-section-hdr {
  padding:10px 16px; background:linear-gradient(to right,#F8FAFD,#EEF4FF);
  font-size:13px; font-weight:700; color:var(--cn);
  display:flex; align-items:center; gap:8px; border-bottom:1.5px solid var(--cbr);
}
.cr-section-body { padding:14px 16px; }

/* ── Grilles responsive ── */
.echo-g2    { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.echo-g2-sm { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.echo-g3    { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
.echo-g4    { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
.echo-g6    { display:grid; grid-template-columns:repeat(6,1fr); gap:10px; }

/* ── Mobile ── */
@media(max-width:767px) {
  .echo-top { padding:12px 14px 0; }
  .echo-g2,.echo-g3 { grid-template-columns:1fr; gap:14px; }
  .echo-g2-sm { grid-template-columns:1fr 1fr; gap:8px; }
  .echo-g4 { grid-template-columns:1fr 1fr; gap:10px; }
  .echo-g6 { grid-template-columns:repeat(3,1fr); gap:8px; }
  .echo-tabs { overflow-x:auto; flex-wrap:nowrap; }
  .cinp { font-size:16px!important; }
  .cbtn { font-size:12px; padding:8px 12px; }
  .cbtn-sm { font-size:11px; padding:5px 8px; }
  .echo-card { border-radius:14px; }
  .echo-card-hdr { padding:11px 14px; }
  .mov { padding:0; align-items:flex-end; }
  .mov-box { border-radius:20px 20px 0 0; max-width:100%; max-height:93vh; }
  .mov-body { padding:14px; }
  .sec-nav { overflow-x:auto; flex-wrap:nowrap; padding:10px 14px; scrollbar-width:none; }
  .sec-nav::-webkit-scrollbar { display:none; }
  .steps { overflow-x:auto; }
  .step-lbl { font-size:9px; }
}
@media(max-width:479px){
  .echo-g2-sm { grid-template-columns:1fr; }
  .echo-g4,.echo-g6 { grid-template-columns:1fr 1fr; }
}
`;

// ─── Helpers ─────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const now = () => new Date().toISOString().substring(0, 16);
const genNum = (prefix) => `${prefix}-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}`;

// ─── Data constants ──────────────────────────────────────────
const ECHOGRAPHISTES = ["Dr. Amina Cherif", "Dr. Paul Nkoma", "Dr. Sophie Pierre", "Dr. Marie Koné"];
const SALLES = ["Salle Écho 1", "Salle Écho 2", "Salle Doppler", "Salle Maternité"];
const RADIOLOGUES = ["Dr. Jean-Pierre Mbemba", "Dr. Fatou Diallo", "Dr. André Leblanc"];
const SERVICES_SOURCE = ["Consultation générale","Maternité","Gynécologie","Pédiatrie","Urgences","Hospitalisation","Chirurgie","Cardiologie"];

const TYPES_ECHO = [
  { id:"obstet",   label:"Obstétricale",  icon:"🤰", color:"#BE185D", bg:"#FDF2F8", border:"#FBCFE8",
    subtypes:["1er trimestre","2e trimestre","3e trimestre","Grossesse multiple","Contrôle croissance"] },
  { id:"gyneco",   label:"Gynécologique", icon:"💜", color:"#7C3AED", bg:"#F5F3FF", border:"#DDD6FE",
    subtypes:["Utérus","Ovaires","Endomètre","Fertilité"] },
  { id:"abdo",     label:"Abdominale",    icon:"🫃", color:"#0891B2", bg:"#ECFEFF", border:"#A5F3FC",
    subtypes:["Foie","Vésicule biliaire","Rate","Reins","Pancréas"] },
  { id:"pelvi",    label:"Pelvienne",     icon:"🩺", color:"#0EA5A0", bg:"#F0FDFC", border:"#99F6E4",
    subtypes:["Organes pelviens","Vessie"] },
  { id:"cardio",   label:"Cardiaque",     icon:"❤️", color:"#DC2626", bg:"#FEF2F2", border:"#FECACA",
    subtypes:["Échocardiographie"] },
  { id:"thyro",    label:"Thyroïdienne",  icon:"🦋", color:"#D97706", bg:"#FFF7ED", border:"#FDE68A",
    subtypes:["Thyroïde","Ganglions"] },
  { id:"mammo",    label:"Mammaire",      icon:"🩷", color:"#BE185D", bg:"#FDF2F8", border:"#FBCFE8",
    subtypes:["Sein droit","Sein gauche"] },
  { id:"pedia",    label:"Pédiatrique",   icon:"👶", color:"#059669", bg:"#ECFDF5", border:"#A7F3D0",
    subtypes:["Nouveau-né","Abdomen enfant"] },
  { id:"doppler",  label:"Doppler",       icon:"🔴", color:"#1B4F9E", bg:"#EFF6FF", border:"#BFDBFE",
    subtypes:["Artériel","Veineux","Obstétrical"] },
  { id:"parties",  label:"Parties molles",icon:"💪", color:"#6B7280", bg:"#F9FAFB", border:"#E5E7EB",
    subtypes:["Muscles","Tendons","Kystes"] },
];

const PRIORITES = [
  { v:"normale",    l:"Normale",    cls:"green" },
  { v:"semi_urgent",l:"Semi-urgent",cls:"orange"},
  { v:"urgente",    l:"Urgente",    cls:"red"   },
];

const STATUTS_DEMANDE = [
  { v:"en_attente",l:"En attente",  cls:"orange"},
  { v:"planifiee",  l:"Planifiée",  cls:"blue"  },
  { v:"realisee",   l:"Réalisée",   cls:"teal"  },
  { v:"validee",    l:"Validée",    cls:"green" },
  { v:"annulee",    l:"Annulée",    cls:"gray"  },
];

const STATUTS_RAPPORT = [
  { v:"brouillon",    l:"Brouillon",         cls:"gray"  },
  { v:"en_validation",l:"En validation",     cls:"orange"},
  { v:"valide",       l:"Validé",            cls:"green" },
  { v:"rejete",       l:"Rejeté",            cls:"red"   },
];

// ─── Sample data ──────────────────────────────────────────────
const SAMPLE_DEMANDES = [
  { id:1, numero:"ECH-2026-1042", patient:"Aïssatou DIALLO", dossier:"DOS-2024-0034", age:28, sexe:"F",
    source:"Maternité", medecin_presc:"Dr. Sophie Pierre", date_prescription:"2026-06-08",
    type:"Obstétricale", sous_type:"3e trimestre", motif:"Contrôle croissance fœtale – terme 36 SA",
    priorite:"normale", statut:"planifiee", date_planif:"2026-06-09T10:00",
    echographiste:"Dr. Amina Cherif", salle:"Salle Maternité" },
  { id:2, numero:"ECH-2026-1043", patient:"Mamadou KONÉ", dossier:"DOS-2024-0078", age:52, sexe:"M",
    source:"Consultation générale", medecin_presc:"Dr. Martin Leblanc", date_prescription:"2026-06-09",
    type:"Abdominale", sous_type:"Foie", motif:"Hépatomégalie – bilan cirrhose",
    priorite:"semi_urgent", statut:"en_attente" },
  { id:3, numero:"ECH-2026-1040", patient:"Fatima BAMBA", dossier:"DOS-2024-0091", age:35, sexe:"F",
    source:"Gynécologie", medecin_presc:"Dr. Fatou Diallo", date_prescription:"2026-06-07",
    type:"Gynécologique", sous_type:"Ovaires", motif:"Douleur pelvienne – kyste ovarien ?",
    priorite:"normale", statut:"realisee", date_planif:"2026-06-08T14:30",
    echographiste:"Dr. Paul Nkoma", salle:"Salle Écho 2",
    rapport_statut:"valide", rapport_radiologue:"Dr. Jean-Pierre Mbemba" },
  { id:4, numero:"ECH-2026-1039", patient:"Ibrahim TOURÉ", dossier:"DOS-2024-0055", age:44, sexe:"M",
    source:"Urgences", medecin_presc:"Dr. André Mbemba", date_prescription:"2026-06-09",
    type:"Abdominale", sous_type:"Vésicule biliaire", motif:"Douleur abdominale aiguë – colique hépatique",
    priorite:"urgente", statut:"planifiee", date_planif:"2026-06-09T08:30",
    echographiste:"Dr. Amina Cherif", salle:"Salle Écho 1" },
];

// ─── Modal ───────────────────────────────────────────────────
function Modal({ open, onClose, title, children, maxWidth=640 }) {
  useEffect(() => {
    const h = e => e.key==="Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="mov" onClick={e => e.target===e.currentTarget && onClose()}>
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

// ─── DField ──────────────────────────────────────────────────
function DField({ label, value, full, accent }) {
  const empty = !value || value === "—";
  return (
    <div style={full ? { gridColumn:"1/-1" } : {}}>
      <div style={{ fontSize:10.5, fontWeight:700, color:accent||"var(--cm)", textTransform:"uppercase", letterSpacing:.5, marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:600, color:empty?"#CBD5E1":"var(--cn)", fontStyle:empty?"italic":"normal" }}>
        {empty ? "Non renseigné" : value}
      </div>
    </div>
  );
}

// ─── Liaison Badge ────────────────────────────────────────────
const LIAISONS = [
  { label:"Dossier Patient",  icon:"📁", color:"#1B4F9E", border:"#BFDBFE", bg:"#EFF6FF" },
  { label:"Consultation",     icon:"🩺", color:"#0EA5A0", border:"#99F6E4", bg:"#F0FDFC" },
  { label:"Maternité",        icon:"🤰", color:"#BE185D", border:"#FBCFE8", bg:"#FDF2F8" },
  { label:"Gynécologie",      icon:"💜", color:"#7C3AED", border:"#DDD6FE", bg:"#F5F3FF" },
  { label:"Urgences",         icon:"🚨", color:"#DC2626", border:"#FECACA", bg:"#FEF2F2" },
  { label:"Hospitalisation",  icon:"🛏",  color:"#D97706", border:"#FDE68A", bg:"#FFF7ED" },
  { label:"Imagerie Médicale",icon:"🖥️", color:"#0891B2", border:"#A5F3FC", bg:"#ECFEFF" },
  { label:"Facturation",      icon:"💰", color:"#059669", border:"#A7F3D0", bg:"#ECFDF5" },
  { label:"Portail Patient",  icon:"📱", color:"#6B7280", border:"#E5E7EB", bg:"#F9FAFB" },
];

// ─── TABLEAU DE BORD ─────────────────────────────────────────
function Dashboard({ demandes }) {
  const total = demandes.length;
  const today_r = demandes.filter(d => d.statut==="realisee").length;
  const planif  = demandes.filter(d => d.statut==="planifiee").length;
  const attente = demandes.filter(d => d.statut==="en_attente").length;
  const validees= demandes.filter(d => d.statut==="validee" || d.rapport_statut==="valide").length;
  const urgentes= demandes.filter(d => d.priorite==="urgente").length;
  const enceintes=demandes.filter(d => d.type==="Obstétricale").length;

  const KPIS = [
    { icon:"📋", label:"Demandes totales",     val:total,    sub:"toutes périodes",     color:"blue"  },
    { icon:"✅", label:"Réalisées",            val:today_r,  sub:"examens complétés",   color:"teal"  },
    { icon:"📅", label:"Planifiées",           val:planif,   sub:"à réaliser",          color:"blue"  },
    { icon:"⏳", label:"En attente",           val:attente,  sub:"non planifiées",      color:"orange", urgent:attente>0 },
    { icon:"🔬", label:"Rapports validés",     val:validees, sub:"disponibles",         color:"green" },
    { icon:"🚨", label:"Urgentes",             val:urgentes, sub:"priorité haute",      color:"red",   urgent:urgentes>0 },
    { icon:"🤰", label:"Grossesses suivies",   val:enceintes,sub:"échographies obs.",   color:"purple"},
    { icon:"💰", label:"Recettes (estimation)",val:`${(total*25000).toLocaleString("fr-FR")} F`,sub:"CFA",color:"cyan"},
  ];

  // mini chart: répartition par type
  const typeCounts = TYPES_ECHO.map(t => ({
    ...t, count: demandes.filter(d=>d.type===t.label).length
  })).filter(t=>t.count>0);

  return (
    <div className="fu">
      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))", gap:14, marginBottom:24 }}>
        {KPIS.map((k,i) => (
          <div key={i} className={`echo-kpi ${k.color}`} style={{ position:"relative" }}>
            {k.urgent && <div className="pulse-dot" style={{ position:"absolute", top:12, right:12 }} />}
            <div className={`kpi-icon ${k.color}`}>{k.icon}</div>
            <div className="kpi-val">{k.val}</div>
            <div className="kpi-lbl">{k.label}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="echo-g2" style={{ marginBottom:24 }}>
        {/* Répartition par type */}
        <div className="echo-card">
          <div className="echo-card-hdr"><h3>📊 Répartition par type d'échographie</h3></div>
          <div style={{ padding:20 }}>
            {typeCounts.length===0 ? (
              <div style={{ textAlign:"center", color:"var(--cm)", fontSize:13, padding:"20px 0" }}>Aucune donnée</div>
            ) : typeCounts.map(t => {
              const pct = total>0 ? Math.round(t.count/total*100) : 0;
              return (
                <div key={t.id} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:"var(--cn)" }}>{t.icon} {t.label}</span>
                    <span style={{ fontSize:11, color:"var(--cm)", fontWeight:600 }}>{t.count} ({pct}%)</span>
                  </div>
                  <div style={{ background:"#EEF4FF", borderRadius:99, height:6, overflow:"hidden" }}>
                    <div style={{ height:"100%", borderRadius:99, background:t.color, width:`${pct}%`, transition:"width .5s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Flux de liaison */}
        <div className="echo-card">
          <div className="echo-card-hdr"><h3>🔗 Modules connectés</h3><p>Liaisons actives</p></div>
          <div style={{ padding:20 }}>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {LIAISONS.map(l => (
                <div key={l.label} className="liaison-badge" style={{ color:l.color, borderColor:l.border, background:l.bg }}>
                  <span>{l.icon}</span> {l.label}
                  <span className="pulse-dot" style={{ background:l.color, width:6, height:6 }} />
                </div>
              ))}
            </div>
            <div className="al-teal" style={{ marginTop:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--ct)", marginBottom:4 }}>✅ Transmission automatique active</div>
              <div style={{ fontSize:11, color:"#0F766E" }}>Les résultats validés sont automatiquement transmis au dossier patient, à la consultation prescriptrice et aux modules concernés.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Demandes urgentes */}
      {urgentes > 0 && (
        <div className="al-danger" style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:16 }}>
          <span style={{ fontSize:20 }}>🚨</span>
          <div>
            <strong style={{ color:"#B91C1C", fontSize:13 }}>{urgentes} demande{urgentes>1?"s":""} urgente{urgentes>1?"s":""} en attente</strong>
            <div style={{ fontSize:12, color:"#DC2626", marginTop:4 }}>Ces examens sont prioritaires et doivent être réalisés immédiatement.</div>
          </div>
        </div>
      )}

      {/* Activité récente */}
      <div className="echo-card">
        <div className="echo-card-hdr">
          <h3>📋 Demandes récentes</h3>
          <span style={{ fontSize:11, color:"var(--cm)" }}>
            {total} demandes · <span className="pulse-dot" style={{ width:6,height:6 }}/> Temps réel
          </span>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table className="echo-tbl">
            <thead>
              <tr>{["N° Demande","Patient","Type","Source","Priorité","Statut"].map(h=>(
                <th key={h}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {demandes.slice(0,5).map(d => {
                const pr = PRIORITES.find(p=>p.v===d.priorite)||PRIORITES[0];
                const st = STATUTS_DEMANDE.find(s=>s.v===d.statut)||STATUTS_DEMANDE[0];
                return (
                  <tr key={d.id}>
                    <td style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:"var(--cb)" }}>{d.numero}</td>
                    <td style={{ fontWeight:600, color:"var(--cn)" }}>{d.patient}</td>
                    <td>
                      {(() => { const t=TYPES_ECHO.find(t=>t.label===d.type); return t ? <span style={{ color:t.color, fontWeight:600, fontSize:12 }}>{t.icon} {d.type}</span> : d.type; })()}
                    </td>
                    <td><span className="cbdg blue">{d.source}</span></td>
                    <td><span className={`cbdg ${pr.cls}`}>{pr.l}</span></td>
                    <td><span className={`cbdg ${st.cls}`}>{st.l}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── DEMANDES D'EXAMEN ────────────────────────────────────────
function Demandes({ demandes, setDemandes, onNewDemande, setMainTab }) {
  const [filtre, setFiltre] = useState("tous");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const filtered = demandes.filter(d => {
    const matchFiltre = filtre==="tous" || d.statut===filtre || d.priorite===filtre;
    const matchSearch = !search || `${d.patient} ${d.numero} ${d.type} ${d.source}`.toLowerCase().includes(search.toLowerCase());
    return matchFiltre && matchSearch;
  });

  return (
    <div className="fu">
      {/* Filtres */}
      <div className="echo-card" style={{ marginBottom:16 }}>
        <div style={{ padding:"14px 20px", display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
          <input className="cinp" placeholder="🔍 Rechercher patient, N° demande, type..." value={search} onChange={e=>setSearch(e.target.value)} style={{ maxWidth:320 }} />
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {[["tous","Tous",""],[...STATUTS_DEMANDE],["urgente","Urgentes","red"]].flat().filter((v,i,a)=>typeof v==="object"||i===0).map(f => {
              if (!f) return null;
              const item = typeof f==="object" ? f : { v:"tous", l:"Tous", cls:"" };
              return (
                <button key={item.v} onClick={()=>setFiltre(item.v)}
                  className={`cbtn cbtn-sm ${filtre===item.v?"cbtn-primary":"cbtn-ghost"}`}>
                  {item.l}
                </button>
              );
            })}
          </div>
          <div style={{ marginLeft:"auto" }}>
            <button className="cbtn cbtn-teal" onClick={onNewDemande}>+ Nouvelle demande</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="echo-card">
        <div className="echo-card-hdr">
          <h3>📋 Demandes d'échographie ({filtered.length})</h3>
          <div style={{ display:"flex", gap:8 }}>
            <span className="cbdg orange">{demandes.filter(d=>d.statut==="en_attente").length} en attente</span>
            <span className="cbdg red">{demandes.filter(d=>d.priorite==="urgente").length} urgentes</span>
          </div>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table className="echo-tbl">
            <thead>
              <tr>{["N° Demande","Patient","Type d'écho","Source / Médecin prescripteur","Date prescr.","Priorité","Statut","Actions"].map(h=><th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.length===0 ? (
                <tr><td colSpan={8} style={{ textAlign:"center", padding:40, color:"var(--cm)", fontSize:13 }}>Aucune demande trouvée</td></tr>
              ) : filtered.map(d => {
                const pr = PRIORITES.find(p=>p.v===d.priorite)||PRIORITES[0];
                const st = STATUTS_DEMANDE.find(s=>s.v===d.statut)||STATUTS_DEMANDE[0];
                const te = TYPES_ECHO.find(t=>t.label===d.type);
                return (
                  <tr key={d.id}>
                    <td style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:"var(--cb)" }}>{d.numero}</td>
                    <td>
                      <div style={{ fontWeight:700, color:"var(--cn)", fontSize:13 }}>{d.patient}</div>
                      <div style={{ fontSize:11, color:"var(--cm)" }}>{d.age} ans · {d.sexe==="F"?"👩":"👨"} · {d.dossier}</div>
                    </td>
                    <td>
                      {te && <span style={{ color:te.color, fontWeight:700, fontSize:13 }}>{te.icon} {d.type}</span>}
                      <div style={{ fontSize:11, color:"var(--cm)" }}>{d.sous_type}</div>
                    </td>
                    <td>
                      <span className="cbdg blue" style={{ marginBottom:4, display:"inline-flex" }}>{d.source}</span>
                      <div style={{ fontSize:11, color:"var(--cm)", marginTop:3 }}>{d.medecin_presc}</div>
                    </td>
                    <td style={{ fontSize:12, color:"var(--cm)" }}>{fmtDate(d.date_prescription)}</td>
                    <td><span className={`cbdg ${pr.cls}`}>{pr.l}</span></td>
                    <td><span className={`cbdg ${st.cls}`}>{st.l}</span></td>
                    <td>
                      <div style={{ display:"flex", gap:6 }}>
                        <button className="cbtn cbtn-ghost cbtn-sm" style={{ color:"var(--cb)", borderColor:"#BFDBFE" }} onClick={()=>setSelected(d)}>👁 Détail</button>
                        {d.statut==="en_attente" && (
                          <button className="cbtn cbtn-teal cbtn-sm" onClick={()=>setMainTab("planning")}>📅 Planifier</button>
                        )}
                        {d.statut==="planifiee" && (
                          <button className="cbtn cbtn-cyan cbtn-sm" onClick={()=>{ setSelected(d); setMainTab("realisation"); }}>▶ Réaliser</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal détail */}
      {selected && (
        <Modal open={!!selected} onClose={()=>setSelected(null)} title={`🔍 Détail — ${selected.numero}`} maxWidth={580}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
            <DField label="Patient" value={selected.patient} />
            <DField label="Dossier" value={selected.dossier} />
            <DField label="Type d'échographie" value={`${TYPES_ECHO.find(t=>t.label===selected.type)?.icon||""} ${selected.type} — ${selected.sous_type}`} />
            <DField label="Service prescripteur" value={selected.source} />
            <DField label="Médecin prescripteur" value={selected.medecin_presc} />
            <DField label="Date de prescription" value={fmtDate(selected.date_prescription)} />
            <DField label="Priorité" value={PRIORITES.find(p=>p.v===selected.priorite)?.l} />
            <DField label="Statut" value={STATUTS_DEMANDE.find(s=>s.v===selected.statut)?.l} />
            {selected.echographiste && <DField label="Échographiste" value={selected.echographiste} />}
            {selected.salle && <DField label="Salle" value={selected.salle} />}
            {selected.date_planif && <DField label="Date planifiée" value={`${fmtDate(selected.date_planif)} à ${new Date(selected.date_planif).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}`} />}
            <DField label="Motif clinique" value={selected.motif} full />
          </div>
          {selected.rapport_statut==="valide" && (
            <div className="al-success" style={{ display:"flex", gap:10, alignItems:"center" }}>
              <span style={{ fontSize:20 }}>✅</span>
              <div>
                <strong style={{ fontSize:13, color:"#065F46" }}>Rapport validé par {selected.rapport_radiologue}</strong>
                <div style={{ fontSize:11, color:"#059669" }}>Résultats transmis au dossier patient et aux services concernés.</div>
              </div>
            </div>
          )}
          <div style={{ display:"flex", gap:8, marginTop:16, flexWrap:"wrap" }}>
            <button className="cbtn cbtn-ghost cbtn-sm" onClick={()=>setSelected(null)}>Fermer</button>
            {selected.statut==="planifiee" && <button className="cbtn cbtn-teal cbtn-sm" onClick={()=>{setSelected(null);setMainTab("realisation");}}>▶ Commencer l'examen</button>}
            {selected.rapport_statut==="valide" && <button className="cbtn cbtn-green cbtn-sm">📄 Voir le rapport</button>}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── PLANNING ─────────────────────────────────────────────────
function Planning({ demandes }) {
  const [vue, setVue] = useState("semaine");
  const planifiees = demandes.filter(d => d.statut==="planifiee" && d.date_planif);

  const heures = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
  const jours  = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];

  return (
    <div className="fu">
      <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:16, flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:4, background:"#EEF4FF", borderRadius:10, padding:4 }}>
          {[["jour","Jour"],["semaine","Semaine"],["mois","Mois"]].map(([v,l])=>(
            <button key={v} onClick={()=>setVue(v)} className={`cbtn cbtn-sm ${vue===v?"cbtn-primary":"cbtn-ghost"}`} style={{ border:"none" }}>{l}</button>
          ))}
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {SALLES.map(s=>(
            <span key={s} className="cbdg teal">{s}</span>
          ))}
        </div>
        <button className="cbtn cbtn-teal" style={{ marginLeft:"auto" }}>+ Planifier examen</button>
      </div>

      <div className="echo-card">
        <div className="echo-card-hdr">
          <h3>📅 Planning des échographies — Semaine du 09 juin 2026</h3>
          <div style={{ display:"flex", gap:8 }}>
            <button className="cbtn cbtn-ghost cbtn-sm">◀ Préc.</button>
            <button className="cbtn cbtn-ghost cbtn-sm">Suiv. ▶</button>
          </div>
        </div>
        <div style={{ overflowX:"auto", padding:"0 0 4px" }}>
          {/* Grille semaine simplifiée */}
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:700 }}>
            <thead>
              <tr style={{ background:"linear-gradient(to right,#F8FAFD,#EEF4FF)" }}>
                <th style={{ padding:"10px 14px", width:80, fontSize:11, fontWeight:700, color:"var(--cm)", borderBottom:"1.5px solid var(--cbr)", textAlign:"left" }}>Heure</th>
                {jours.map(j=>(
                  <th key={j} style={{ padding:"10px 14px", fontSize:11, fontWeight:700, color:"var(--cm)", borderBottom:"1.5px solid var(--cbr)", textAlign:"center" }}>{j}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heures.map((h,hi) => (
                <tr key={h} style={{ borderBottom:"1px solid #F3F7FF" }}>
                  <td style={{ padding:"8px 14px", fontSize:11, fontWeight:600, color:"var(--cm)", background:"#FAFBFF" }}>{h}</td>
                  {jours.map((j,ji) => {
                    const slot = planifiees.find(d => {
                      const dt = new Date(d.date_planif);
                      const hh = `${String(dt.getHours()).padStart(2,"0")}:00`;
                      return hh===h && dt.getDay()-1===ji;
                    });
                    return (
                      <td key={j} style={{ padding:"6px 8px", verticalAlign:"top", minWidth:110 }}>
                        {slot ? (
                          <div style={{ background: slot.priorite==="urgente"?"#FEF2F2":"#F0FDFC", border:`1.5px solid ${slot.priorite==="urgente"?"#FECACA":"#99F6E4"}`, borderRadius:8, padding:"6px 8px", cursor:"pointer", fontSize:11 }}>
                            <div style={{ fontWeight:700, color:"var(--cn)", marginBottom:2 }}>{slot.patient}</div>
                            <div style={{ color:"var(--cm)" }}>{TYPES_ECHO.find(t=>t.label===slot.type)?.icon} {slot.type}</div>
                            <div style={{ fontSize:10, color:"var(--cm)", marginTop:2 }}>{slot.echographiste?.split(" ").pop()}</div>
                            {slot.priorite==="urgente" && <span className="cbdg red" style={{ fontSize:9, padding:"1px 6px", marginTop:3, display:"inline-flex" }}>🚨 Urgent</span>}
                          </div>
                        ) : (
                          <div style={{ height:52, borderRadius:8, border:"1.5px dashed #E2EAF4", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#CBD5E1", fontSize:16, transition:"all .15s" }}
                            onMouseEnter={e=>e.currentTarget.style.borderColor="var(--ct)"}
                            onMouseLeave={e=>e.currentTarget.style.borderColor="#E2EAF4"}>
                            +
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Légende */}
      <div style={{ display:"flex", gap:12, marginTop:12, flexWrap:"wrap" }}>
        {[["#F0FDFC","#99F6E4","Normale"],["#FFF7ED","#FDE68A","Semi-urgent"],["#FEF2F2","#FECACA","Urgente"]].map(([bg,border,l])=>(
          <div key={l} style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:16, height:16, borderRadius:4, background:bg, border:`1.5px solid ${border}` }} />
            <span style={{ fontSize:12, color:"var(--cm)", fontWeight:500 }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── RÉALISATION EXAMEN ───────────────────────────────────────
function Realisation({ demandes }) {
  const [step, setStep] = useState(0);
  const [selectedDemande, setSelectedDemande] = useState(demandes.find(d=>d.statut==="planifiee")||null);
  const [typeEcho, setTypeEcho] = useState(null);
  const [images, setImages] = useState([]);
  const [observations, setObservations] = useState({});
  const dragRef = useRef(false);

  const STEPS_R = [
    { label:"Sélection demande", icon:"📋" },
    { label:"Patient",           icon:"👤" },
    { label:"Type & Organes",    icon:"🩺" },
    { label:"Images",            icon:"🖼️" },
    { label:"Compte rendu",      icon:"📝" },
    { label:"Validation",        icon:"✅" },
  ];

  const selDem = selectedDemande;
  const te = typeEcho ? TYPES_ECHO.find(t=>t.id===typeEcho) : (selDem ? TYPES_ECHO.find(t=>t.label===selDem.type) : null);

  return (
    <div className="fu">
      {/* Steps */}
      <div className="steps" style={{ marginBottom:24 }}>
        {STEPS_R.map((s,i)=>(
          <div key={s.label} className={`step ${i<step?"done":i===step?"active":""}`} onClick={()=>i<=step&&setStep(i)}>
            <div className="step-dot">{i<step?"✓":s.icon}</div>
            <div className="step-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Step 0 : Sélection demande ── */}
      {step===0 && (
        <div>
          <div className="echo-card" style={{ marginBottom:14 }}>
            <div className="echo-card-hdr"><h3>📋 Sélectionner la demande à réaliser</h3></div>
            <div style={{ padding:20, display:"flex", flexDirection:"column", gap:10 }}>
              {demandes.filter(d=>d.statut==="planifiee"||d.statut==="en_attente").map(d => {
                const te2 = TYPES_ECHO.find(t=>t.label===d.type);
                const pr = PRIORITES.find(p=>p.v===d.priorite);
                return (
                  <div key={d.id}
                    onClick={()=>setSelectedDemande(d)}
                    style={{ border:`2px solid ${selectedDemande?.id===d.id?"var(--ct)":"var(--cbr)"}`, background:selectedDemande?.id===d.id?"#F0FDFC":"#FAFBFF", borderRadius:14, padding:"14px 16px", cursor:"pointer", transition:"all .2s", display:"flex", alignItems:"center", gap:14 }}>
                    <div style={{ width:46, height:46, borderRadius:12, background:te2?.bg||"#EFF6FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>{te2?.icon||"🩺"}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, color:"var(--cn)", fontSize:14 }}>{d.patient} <span style={{ fontSize:11, color:"var(--cm)", fontWeight:400 }}>· {d.age} ans</span></div>
                      <div style={{ fontSize:12, color:"var(--cm)", marginTop:2 }}>{d.type} — {d.sous_type} · {d.source}</div>
                      <div style={{ fontSize:11, color:"var(--cm)", marginTop:2, fontStyle:"italic" }}>{d.motif}</div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
                      <span className={`cbdg ${pr?.cls||"gray"}`}>{pr?.l}</span>
                      <span style={{ fontFamily:"monospace", fontSize:11, color:"var(--cb)", fontWeight:700 }}>{d.numero}</span>
                    </div>
                    {selectedDemande?.id===d.id && <span className="cbdg teal">✓ Sélectionnée</span>}
                  </div>
                );
              })}
              {demandes.filter(d=>d.statut==="planifiee"||d.statut==="en_attente").length===0 && (
                <div style={{ textAlign:"center", color:"var(--cm)", padding:"30px 0", fontSize:13 }}>Aucune demande à réaliser actuellement</div>
              )}
            </div>
          </div>
          <button className="cbtn cbtn-teal" disabled={!selectedDemande} onClick={()=>setStep(1)}>Continuer →</button>
        </div>
      )}

      {/* ── Step 1 : Patient ── */}
      {step===1 && selDem && (
        <div>
          <div style={{ background:"linear-gradient(135deg,var(--cn),var(--cn2),#1B4F9E)", borderRadius:16, padding:"20px 24px", marginBottom:16, display:"flex", gap:18, alignItems:"center", flexWrap:"wrap", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:-30, right:-30, width:120, height:120, background:"radial-gradient(circle,rgba(14,165,160,.2),transparent 70%)", borderRadius:"50%" }} />
            <div style={{ width:56, height:56, borderRadius:14, background:"rgba(255,255,255,.15)", border:"1.5px solid rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>
              {selDem.sexe==="F"?"👩":"👨"}
            </div>
            <div style={{ flex:1, position:"relative" }}>
              <div style={{ fontSize:20, fontWeight:800, color:"#fff" }}>{selDem.patient}</div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,.65)", marginTop:4, display:"flex", gap:16, flexWrap:"wrap" }}>
                <span>🎂 {selDem.age} ans</span>
                <span>📋 {selDem.dossier}</span>
                <span>🏥 {selDem.source}</span>
                <span style={{ fontFamily:"monospace", fontWeight:700 }}>{selDem.numero}</span>
              </div>
            </div>
            {selDem.priorite==="urgente" && (
              <div style={{ background:"rgba(220,38,38,.3)", border:"1.5px solid rgba(220,38,38,.5)", borderRadius:10, padding:"8px 14px", color:"#FCA5A5", fontSize:12, fontWeight:700 }}>🚨 URGENT</div>
            )}
          </div>
          <div className="echo-g2">
            <div className="echo-card">
              <div className="echo-card-hdr"><h3>📋 Informations de la demande</h3></div>
              <div style={{ padding:20, display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <DField label="Type d'échographie" value={`${te?.icon||""} ${selDem.type} — ${selDem.sous_type}`} />
                <DField label="Médecin prescripteur" value={selDem.medecin_presc} />
                <DField label="Service source" value={selDem.source} />
                <DField label="Échographiste assigné" value={selDem.echographiste||"Non assigné"} />
                <DField label="Salle" value={selDem.salle||"Non assignée"} />
                <DField label="Date planifiée" value={selDem.date_planif ? fmtDate(selDem.date_planif) : "—"} />
                <DField label="Motif clinique" value={selDem.motif} full />
              </div>
            </div>
            <div className="echo-card">
              <div className="echo-card-hdr"><h3>⚙️ Paramètres d'examen</h3></div>
              <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
                <div>
                  <label className="clbl req">Échographiste réalisant</label>
                  <select className="cinp">
                    {ECHOGRAPHISTES.map(e=><option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="clbl req">Salle d'échographie</label>
                  <select className="cinp">
                    {SALLES.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="clbl">Appareillage utilisé</label>
                  <input className="cinp" placeholder="Echographe GE Logiq, Philips Affiniti..." />
                </div>
                <div>
                  <label className="clbl">Heure de début</label>
                  <input type="datetime-local" className="cinp" defaultValue={now()} />
                </div>
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:10, marginTop:16 }}>
            <button className="cbtn cbtn-ghost" onClick={()=>setStep(0)}>← Retour</button>
            <button className="cbtn cbtn-teal" onClick={()=>setStep(2)}>Continuer →</button>
          </div>
        </div>
      )}

      {/* ── Step 2 : Type & Organes ── */}
      {step===2 && (
        <div>
          <div className="echo-card" style={{ marginBottom:16 }}>
            <div className="echo-card-hdr"><h3>🩺 Type d'échographie</h3></div>
            <div style={{ padding:20, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12 }}>
              {TYPES_ECHO.map(t=>(
                <div key={t.id} className={`organ-card ${typeEcho===t.id?"selected":""}`}
                  onClick={()=>setTypeEcho(t.id)}
                  style={{ borderColor:typeEcho===t.id?t.color:"var(--cbr)", background:typeEcho===t.id?t.bg:"#FAFBFF" }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>{t.icon}</div>
                  <div style={{ fontWeight:700, fontSize:13, color:typeEcho===t.id?t.color:"var(--cn)" }}>{t.label}</div>
                  <div style={{ fontSize:11, color:"var(--cm)", marginTop:4 }}>{t.subtypes.join(", ")}</div>
                  {typeEcho===t.id && (
                    <div style={{ marginTop:8 }}>
                      <span style={{ background:t.bg, color:t.color, border:`1px solid ${t.border}`, borderRadius:99, padding:"2px 10px", fontSize:11, fontWeight:700 }}>✓ Sélectionné</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          {typeEcho && (
            <div className="echo-card" style={{ marginBottom:16 }}>
              <div className="echo-card-hdr"><h3>🫁 Organes / Zones à examiner</h3></div>
              <div style={{ padding:20, display:"flex", flexWrap:"wrap", gap:8 }}>
                {TYPES_ECHO.find(t=>t.id===typeEcho)?.subtypes.map(st=>(
                  <div key={st} style={{ border:"1.5px solid var(--cbr)", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:13, fontWeight:600, color:"var(--cn)", background:"#FAFBFF", transition:"all .2s" }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--ct)";e.currentTarget.style.background="#F0FDFC";}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--cbr)";e.currentTarget.style.background="#FAFBFF";}}>
                    ✓ {st}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display:"flex", gap:10 }}>
            <button className="cbtn cbtn-ghost" onClick={()=>setStep(1)}>← Retour</button>
            <button className="cbtn cbtn-teal" onClick={()=>setStep(3)}>Continuer →</button>
          </div>
        </div>
      )}

      {/* ── Step 3 : Images ── */}
      {step===3 && (
        <div>
          <div className="echo-card" style={{ marginBottom:16 }}>
            <div className="echo-card-hdr">
              <h3>🖼️ Gestion des images échographiques</h3>
              <div style={{ display:"flex", gap:8 }}>
                <span className="cbdg teal">{images.length} image(s)</span>
                <button className="cbtn cbtn-ghost cbtn-sm">+ Vidéo</button>
                <button className="cbtn cbtn-ghost cbtn-sm">+ PDF</button>
              </div>
            </div>
            <div style={{ padding:20 }}>
              {/* Zone d'upload */}
              <div className="upload-zone" style={{ marginBottom:16 }}
                onClick={()=>document.getElementById("echo-file-input").click()}
                onDragOver={e=>{e.preventDefault();dragRef.current=true;}}
                onDrop={e=>{
                  e.preventDefault();
                  const files = Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith("image/"));
                  if(files.length) {
                    const readers = files.map(f => new Promise(res=>{
                      const r=new FileReader();
                      r.onload=ev=>res({name:f.name,url:ev.target.result,id:Date.now()+Math.random(),annot:""});
                      r.readAsDataURL(f);
                    }));
                    Promise.all(readers).then(imgs=>setImages(p=>[...p,...imgs]));
                  }
                }}>
                <input id="echo-file-input" type="file" accept="image/*" multiple style={{ display:"none" }} onChange={e=>{
                  const files = Array.from(e.target.files);
                  const readers = files.map(f => new Promise(res=>{
                    const r=new FileReader();
                    r.onload=ev=>res({name:f.name,url:ev.target.result,id:Date.now()+Math.random(),annot:""});
                    r.readAsDataURL(f);
                  }));
                  Promise.all(readers).then(imgs=>setImages(p=>[...p,...imgs]));
                }} />
                <div style={{ fontSize:40, marginBottom:10 }}>🖼️</div>
                <div style={{ fontWeight:700, color:"var(--cn)", marginBottom:4 }}>Glisser-déposer des images échographiques</div>
                <div style={{ fontSize:12, color:"var(--cm)" }}>ou cliquez pour parcourir · JPEG, PNG, DICOM · max 50 Mo</div>
              </div>
              {/* Galerie */}
              {images.length>0 ? (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12 }}>
                  {images.map((img,i)=>(
                    <div key={img.id} className="img-thumb">
                      <img src={img.url} alt={img.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      <div className="img-thumb-overlay">
                        <button className="cbtn cbtn-ghost cbtn-sm" style={{ background:"rgba(255,255,255,.9)", color:"var(--cn)", fontSize:11 }}>🔍 Zoom</button>
                        <button className="cbtn cbtn-danger cbtn-sm" style={{ fontSize:11 }} onClick={()=>setImages(p=>p.filter(x=>x.id!==img.id))}>✕</button>
                      </div>
                      <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"rgba(11,30,59,.7)", padding:"4px 8px" }}>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,.8)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>Image {i+1}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign:"center", color:"var(--cm)", fontSize:13, padding:"20px 0" }}>
                  Aucune image chargée — importez des images depuis l'appareil d'échographie
                </div>
              )}
            </div>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button className="cbtn cbtn-ghost" onClick={()=>setStep(2)}>← Retour</button>
            <button className="cbtn cbtn-teal" onClick={()=>setStep(4)}>Continuer vers le compte rendu →</button>
          </div>
        </div>
      )}

      {/* ── Step 4 : Compte rendu ── */}
      {step===4 && (
        <div>
          <div className="echo-card" style={{ marginBottom:16 }}>
            <div className="echo-card-hdr">
              <h3>📝 Compte rendu d'échographie</h3>
              <div style={{ display:"flex", gap:8 }}>
                <span className="cbdg teal">{selDem?.patient}</span>
                {te && <span style={{ color:te.color, fontSize:13, fontWeight:700 }}>{te.icon} {te.label}</span>}
              </div>
            </div>
            <div style={{ padding:20 }}>

              {/* Infos de l'examen */}
              <div style={{ background:"#F8FAFD", border:"1.5px solid var(--cbr)", borderRadius:12, padding:"12px 16px", marginBottom:20, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12 }}>
                <DField label="Date de l'examen" value={fmtDate(new Date())} />
                <DField label="Échographiste" value={selDem?.echographiste||ECHOGRAPHISTES[0]} />
                <DField label="Type" value={`${te?.icon||""} ${selDem?.type||""}`} />
                <DField label="Salle" value={selDem?.salle||SALLES[0]} />
              </div>

              {/* Sections du CR */}
              {te?.subtypes.map(organe => (
                <div key={organe} className="cr-section">
                  <div className="cr-section-hdr" style={{ borderLeft:`4px solid ${te.color}` }}>
                    {te.icon} {organe}
                  </div>
                  <div className="cr-section-body">
                    <div className="echo-g2" style={{ gap:12, marginBottom:12 }}>
                      <div>
                        <label className="clbl">Taille / Dimensions</label>
                        <input className="cinp" placeholder="Ex: 12 × 8 cm, normal" value={observations[`${organe}_taille`]||""} onChange={e=>setObservations(o=>({...o,[`${organe}_taille`]:e.target.value}))} />
                      </div>
                      <div>
                        <label className="clbl">Aspect général</label>
                        <input className="cinp" placeholder="Ex: Structure homogène, Aspect normal" value={observations[`${organe}_aspect`]||""} onChange={e=>setObservations(o=>({...o,[`${organe}_aspect`]:e.target.value}))} />
                      </div>
                    </div>
                    <div>
                      <label className="clbl">Anomalies détectées</label>
                      <textarea className="cinp" rows={2} placeholder={`Décrire les anomalies observées sur ${organe.toLowerCase()} ou indiquer 'RAS'`} value={observations[`${organe}_anomalies`]||""} onChange={e=>setObservations(o=>({...o,[`${organe}_anomalies`]:e.target.value}))} />
                    </div>
                  </div>
                </div>
              ))}

              {/* Conclusion */}
              <div className="cr-section">
                <div className="cr-section-hdr" style={{ borderLeft:"4px solid var(--cb)", background:"linear-gradient(to right,#EFF6FF,#DBEAFE)" }}>
                  🔍 Conclusion diagnostique
                </div>
                <div className="cr-section-body">
                  <div style={{ marginBottom:14 }}>
                    <label className="clbl req">Conclusion principale</label>
                    <textarea className="cinp" rows={3} placeholder="Synthèse diagnostique, impression générale de l'examen..." value={observations.conclusion||""} onChange={e=>setObservations(o=>({...o,conclusion:e.target.value}))} />
                  </div>
                  <div className="echo-g2" style={{ gap:12 }}>
                    <div>
                      <label className="clbl">Recommandations</label>
                      <textarea className="cinp" rows={2} placeholder="Examens complémentaires, suivi préconisé..." value={observations.recommandations||""} onChange={e=>setObservations(o=>({...o,recommandations:e.target.value}))} />
                    </div>
                    <div>
                      <label className="clbl">Examens complémentaires suggérés</label>
                      <textarea className="cinp" rows={2} placeholder="Autre echo, IRM, biopsie..." value={observations.examens_compl||""} onChange={e=>setObservations(o=>({...o,examens_compl:e.target.value}))} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Signature */}
              <div style={{ background:"#F8FAFD", border:"1.5px solid var(--cbr)", borderRadius:12, padding:"14px 16px", marginTop:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:"var(--cn)", marginBottom:4 }}>Signature électronique du radiologue</div>
                    <div style={{ display:"flex", gap:8, marginTop:8 }}>
                      <select className="cinp" style={{ width:"auto" }}>
                        {RADIOLOGUES.map(r=><option key={r}>{r}</option>)}
                      </select>
                      <button className="cbtn cbtn-primary cbtn-sm">🔐 Signer</button>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:11, color:"var(--cm)" }}>Date et heure</div>
                    <div style={{ fontWeight:700, color:"var(--cn)" }}>{new Date().toLocaleString("fr-FR",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button className="cbtn cbtn-ghost" onClick={()=>setStep(3)}>← Retour</button>
            <button className="cbtn cbtn-teal" onClick={()=>setStep(5)}>Soumettre à validation →</button>
          </div>
        </div>
      )}

      {/* ── Step 5 : Validation ── */}
      {step===5 && (
        <div>
          <div className="al-teal" style={{ marginBottom:16, display:"flex", gap:12 }}>
            <span style={{ fontSize:22 }}>📨</span>
            <div>
              <strong style={{ color:"var(--ct)", fontSize:14 }}>Compte rendu soumis pour validation</strong>
              <div style={{ fontSize:12, color:"#0F766E", marginTop:4 }}>Le rapport a été transmis au radiologue pour relecture et validation électronique.</div>
            </div>
          </div>
          <div className="echo-g2" style={{ marginBottom:16 }}>
            <div className="echo-card">
              <div className="echo-card-hdr"><h3>✅ Validation médicale</h3></div>
              <div style={{ padding:20 }}>
                <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
                  {STATUTS_RAPPORT.map(s=>(
                    <div key={s.v} style={{ border:"1.5px solid var(--cbr)", borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", gap:12, cursor:"pointer", transition:"all .2s" }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor="var(--ct)"}
                      onMouseLeave={e=>e.currentTarget.style.borderColor="var(--cbr)"}>
                      <span className={`cbdg ${s.cls}`}>{s.l}</span>
                      <span style={{ fontSize:12, color:"var(--cm)" }}>
                        {s.v==="brouillon"&&"Rapport en cours de rédaction"}
                        {s.v==="en_validation"&&"En attente de signature radiologue"}
                        {s.v==="valide"&&"Signé électroniquement — transmis"}
                        {s.v==="rejete"&&"Refusé — corrections demandées"}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button className="cbtn cbtn-green">✅ Valider le rapport</button>
                  <button className="cbtn cbtn-danger">❌ Rejeter</button>
                </div>
              </div>
            </div>
            <div className="echo-card">
              <div className="echo-card-hdr"><h3>📡 Transmission automatique</h3></div>
              <div style={{ padding:20 }}>
                <div style={{ fontSize:12, color:"var(--cm)", marginBottom:14 }}>Après validation, les résultats seront automatiquement transmis à :</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {[
                    { icon:"📁", label:"Dossier Patient",   desc:"Historique & rapport PDF" },
                    { icon:"🩺", label:"Consultation",      desc:"Résultat ajouté au diagnostic" },
                    { icon:"🤰", label:"Maternité",         desc:"Suivi de grossesse mis à jour" },
                    { icon:"💰", label:"Facturation",       desc:"Acte généré automatiquement" },
                    { icon:"📱", label:"Portail Patient",   desc:"Disponible en ligne" },
                  ].map(item=>(
                    <div key={item.label} style={{ display:"flex", gap:10, alignItems:"center", background:"#F8FAFD", borderRadius:10, padding:"10px 14px", border:"1.5px solid var(--cbr)" }}>
                      <span style={{ fontSize:20 }}>{item.icon}</span>
                      <div>
                        <div style={{ fontWeight:700, fontSize:13, color:"var(--cn)" }}>{item.label}</div>
                        <div style={{ fontSize:11, color:"var(--cm)" }}>{item.desc}</div>
                      </div>
                      <span className="pulse-dot" style={{ marginLeft:"auto" }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button className="cbtn cbtn-ghost" onClick={()=>setStep(4)}>← Modifier le rapport</button>
            <button className="cbtn cbtn-primary">🖨️ Imprimer le rapport</button>
            <button className="cbtn cbtn-ghost">📧 Envoyer par email</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FACTURATION ECHOGRAPHIE ──────────────────────────────────
function Facturation({ demandes }) {
  const ACTES = [
    { id:"simple",    label:"Échographie simple",    prix:15000, count: demandes.filter(d=>!["Doppler","Cardiaque"].includes(d.type)).length },
    { id:"specialise",label:"Échographie spécialisée",prix:25000, count: demandes.filter(d=>d.type==="Gynécologique"||d.type==="Obstétricale").length },
    { id:"doppler",   label:"Doppler",               prix:35000, count: demandes.filter(d=>d.type==="Doppler").length },
    { id:"cardio",    label:"Échocardiographie",     prix:50000, count: demandes.filter(d=>d.type==="Cardiaque").length },
  ];
  const total = ACTES.reduce((s,a)=>s+a.prix*a.count,0);

  return (
    <div className="fu">
      <div className="echo-g2" style={{ marginBottom:16 }}>
        <div className="echo-card">
          <div className="echo-card-hdr"><h3>💰 Actes et tarifs</h3></div>
          <div style={{ padding:20 }}>
            <table className="echo-tbl">
              <thead><tr><th>Acte</th><th style={{ textAlign:"right" }}>Tarif</th><th style={{ textAlign:"right" }}>Nb</th><th style={{ textAlign:"right" }}>Total</th></tr></thead>
              <tbody>
                {ACTES.map(a=>(
                  <tr key={a.id}>
                    <td style={{ fontWeight:600, color:"var(--cn)" }}>{a.label}</td>
                    <td style={{ textAlign:"right", color:"var(--cm)" }}>{a.prix.toLocaleString("fr-FR")} F</td>
                    <td style={{ textAlign:"right" }}><span className="cbdg blue">{a.count}</span></td>
                    <td style={{ textAlign:"right", fontWeight:700, color:"var(--cn)" }}>{(a.prix*a.count).toLocaleString("fr-FR")} F</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:"linear-gradient(to right,#EEF4FF,#DBEAFE)" }}>
                  <td colSpan={3} style={{ padding:"14px", fontWeight:800, color:"var(--cn)" }}>TOTAL</td>
                  <td style={{ textAlign:"right", fontWeight:800, fontSize:18, color:"var(--cb)", padding:"14px" }}>{total.toLocaleString("fr-FR")} <span style={{ fontSize:12 }}>CFA</span></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <div className="echo-card">
          <div className="echo-card-hdr"><h3>🏥 Gestion assurance</h3></div>
          <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <label className="clbl">Mode de facturation</label>
              <select className="cinp">
                <option>💵 Paiement direct</option>
                <option>🏥 Assurance maladie</option>
                <option>🆓 Exonéré</option>
                <option>🤝 Tiers payant</option>
              </select>
            </div>
            <div>
              <label className="clbl">Compagnie d'assurance</label>
              <input className="cinp" placeholder="Nom de la compagnie..." />
            </div>
            <div>
              <label className="clbl">Numéro de police</label>
              <input className="cinp" placeholder="N° police d'assurance..." />
            </div>
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <button className="cbtn cbtn-teal">📄 Générer la facture</button>
              <button className="cbtn cbtn-ghost">🖨️ Imprimer le reçu</button>
            </div>
          </div>
        </div>
      </div>

      {/* Table de facturation */}
      <div className="echo-card">
        <div className="echo-card-hdr">
          <h3>📋 Historique des factures</h3>
          <button className="cbtn cbtn-ghost cbtn-sm">📊 Exporter</button>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table className="echo-tbl">
            <thead><tr><th>Patient</th><th>Type</th><th>Acte</th><th>Montant</th><th>Paiement</th><th>Actions</th></tr></thead>
            <tbody>
              {demandes.filter(d=>d.statut==="realisee"||d.statut==="validee"||d.rapport_statut==="valide").map(d=>{
                const acte = d.type==="Cardiaque"?ACTES[3]:d.type==="Doppler"?ACTES[2]:(d.type==="Gynécologique"||d.type==="Obstétricale")?ACTES[1]:ACTES[0];
                return (
                  <tr key={d.id}>
                    <td style={{ fontWeight:600, color:"var(--cn)" }}>{d.patient}</td>
                    <td><span style={{ fontSize:12 }}>{TYPES_ECHO.find(t=>t.label===d.type)?.icon} {d.type}</span></td>
                    <td style={{ fontSize:12, color:"var(--cm)" }}>{acte.label}</td>
                    <td style={{ fontWeight:700, color:"var(--cb)" }}>{acte.prix.toLocaleString("fr-FR")} F</td>
                    <td><span className="cbdg green">✅ Payé</span></td>
                    <td>
                      <div style={{ display:"flex", gap:6 }}>
                        <button className="cbtn cbtn-ghost cbtn-sm">🖨️ Reçu</button>
                        <button className="cbtn cbtn-ghost cbtn-sm">📧 Envoyer</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── STATISTIQUES ─────────────────────────────────────────────
function Statistiques({ demandes }) {
  const byType = TYPES_ECHO.map(t=>({ ...t, count:demandes.filter(d=>d.type===t.label).length })).filter(t=>t.count>0);
  const bySource = SERVICES_SOURCE.map(s=>({ name:s, count:demandes.filter(d=>d.source===s).length })).filter(s=>s.count>0);
  const totalRevenu = demandes.filter(d=>d.statut!=="annulee").length * 25000;

  return (
    <div className="fu">
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
        {[
          { label:"Total examens",    val:demandes.length,   icon:"🔬", color:"blue"   },
          { label:"Recettes estimées",val:`${totalRevenu.toLocaleString("fr-FR")} F`, icon:"💰", color:"green" },
          { label:"Taux de validation",val:`${demandes.length>0?Math.round(demandes.filter(d=>d.rapport_statut==="valide").length/demandes.length*100):0}%`,icon:"✅",color:"teal"},
          { label:"Urgences traitées",val:demandes.filter(d=>d.priorite==="urgente").length, icon:"🚨", color:"red" },
        ].map((k,i)=>(
          <div key={i} className={`echo-kpi ${k.color}`}>
            <div className={`kpi-icon ${k.color}`}>{k.icon}</div>
            <div className="kpi-val">{k.val}</div>
            <div className="kpi-lbl">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="echo-g2" style={{ marginBottom:16 }}>
        <div className="echo-card">
          <div className="echo-card-hdr"><h3>📊 Examens par type</h3></div>
          <div style={{ padding:20 }}>
            {byType.map(t=>{
              const pct = demandes.length>0?Math.round(t.count/demandes.length*100):0;
              return (
                <div key={t.id} style={{ marginBottom:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:"var(--cn)" }}>{t.icon} {t.label}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:t.color }}>{t.count} exam. ({pct}%)</span>
                  </div>
                  <div style={{ background:"#EEF4FF", borderRadius:99, height:8, overflow:"hidden" }}>
                    <div style={{ height:"100%", borderRadius:99, background:t.color, width:`${pct}%`, transition:"width .6s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="echo-card">
          <div className="echo-card-hdr"><h3>🏥 Examens par service prescripteur</h3></div>
          <div style={{ padding:20 }}>
            {bySource.map(s=>{
              const pct = demandes.length>0?Math.round(s.count/demandes.length*100):0;
              return (
                <div key={s.name} style={{ marginBottom:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:"var(--cn)" }}>{s.name}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:"var(--cb)" }}>{s.count} ({pct}%)</span>
                  </div>
                  <div style={{ background:"#EEF4FF", borderRadius:99, height:6, overflow:"hidden" }}>
                    <div style={{ height:"100%", borderRadius:99, background:"var(--cb)", width:`${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="echo-card">
        <div className="echo-card-hdr">
          <h3>📈 Rapport d'activité mensuel</h3>
          <button className="cbtn cbtn-ghost cbtn-sm">📊 Exporter PDF</button>
        </div>
        <div style={{ padding:20 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12 }}>
            {["Jan","Fév","Mar","Avr","Mai","Jun"].map((m,i)=>{
              const cnt = Math.round(demandes.length * (0.6+Math.random()*0.8));
              const pct = Math.min(100, Math.round(cnt/20*100));
              return (
                <div key={m} style={{ textAlign:"center" }}>
                  <div style={{ height:80, display:"flex", alignItems:"flex-end", justifyContent:"center", marginBottom:6 }}>
                    <div style={{ width:36, borderRadius:"6px 6px 0 0", background:i===5?"var(--ct)":"#BFDBFE", height:`${pct}%`, minHeight:10, transition:"height .5s" }} />
                  </div>
                  <div style={{ fontSize:12, fontWeight:600, color:"var(--cn)" }}>{cnt}</div>
                  <div style={{ fontSize:11, color:"var(--cm)" }}>{m}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── COMPOSANT NOUVELLE DEMANDE (Modal) ───────────────────────
function NouvelleDemandeModal({ open, onClose, onAdd }) {
  const [form, setForm] = useState({
    patient:"", dossier:"", age:"", sexe:"F",
    source:SERVICES_SOURCE[0], medecin_presc:ECHOGRAPHISTES[0],
    type:"obstet", sous_type:"",
    motif:"", priorite:"normale",
  });
  const te = TYPES_ECHO.find(t=>t.id===form.type);

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd({
      patient: form.patient,
      dossier: form.dossier||genNum("DOS"),
      age: parseInt(form.age)||25,
      sexe: form.sexe,
      source: form.source,
      medecin_presc: form.medecin_presc,
      date_prescription: new Date().toISOString().split("T")[0],
      type: te?.label||"Abdominale",
      sous_type: form.sous_type||te?.subtypes[0]||"",
      motif: form.motif,
      priorite: form.priorite,
      statut: "en_attente",
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="➕ Nouvelle demande d'échographie" maxWidth={620}>
      <form onSubmit={handleSubmit}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
          <div>
            <label className="clbl req">Nom du patient</label>
            <input className="cinp" required value={form.patient} onChange={e=>setForm(f=>({...f,patient:e.target.value}))} placeholder="Prénom NOM" />
          </div>
          <div>
            <label className="clbl">N° dossier</label>
            <input className="cinp" value={form.dossier} onChange={e=>setForm(f=>({...f,dossier:e.target.value}))} placeholder="DOS-XXXX-XXXX" />
          </div>
          <div>
            <label className="clbl">Âge</label>
            <input type="number" className="cinp" value={form.age} onChange={e=>setForm(f=>({...f,age:e.target.value}))} placeholder="Âge en années" />
          </div>
          <div>
            <label className="clbl">Sexe</label>
            <select className="cinp" value={form.sexe} onChange={e=>setForm(f=>({...f,sexe:e.target.value}))}>
              <option value="F">Féminin</option>
              <option value="M">Masculin</option>
            </select>
          </div>
          <div>
            <label className="clbl req">Service prescripteur</label>
            <select className="cinp" value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))}>
              {SERVICES_SOURCE.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="clbl req">Médecin prescripteur</label>
            <input className="cinp" value={form.medecin_presc} onChange={e=>setForm(f=>({...f,medecin_presc:e.target.value}))} placeholder="Dr. Prénom NOM" />
          </div>
          <div>
            <label className="clbl req">Type d'échographie</label>
            <select className="cinp" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value,sous_type:""}))}>
              {TYPES_ECHO.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="clbl">Sous-type</label>
            <select className="cinp" value={form.sous_type} onChange={e=>setForm(f=>({...f,sous_type:e.target.value}))}>
              <option value="">— Sélectionner —</option>
              {(te?.subtypes||[]).map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="clbl req">Priorité</label>
            <select className="cinp" value={form.priorite} onChange={e=>setForm(f=>({...f,priorite:e.target.value}))}>
              {PRIORITES.map(p=><option key={p.v} value={p.v}>{p.l}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label className="clbl req">Motif clinique</label>
          <textarea className="cinp" required rows={3} value={form.motif} onChange={e=>setForm(f=>({...f,motif:e.target.value}))} placeholder="Décrire le contexte clinique et la raison de la demande d'échographie..." />
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button type="button" className="cbtn cbtn-ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="cbtn cbtn-teal" style={{ marginLeft:"auto" }}>➕ Créer la demande</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────
export default function Echographie() {
  const dispatch  = useDispatch();
  const demandes  = useSelector(selectDemandesList);
  const [mainTab, setMainTab] = useState("dashboard");
  const [modalNouv, setModalNouv] = useState(false);

  useEffect(() => {
    dispatch(fetchEchographieStats());
    dispatch(fetchDemandes({ limit: 100 }));
  }, [dispatch]);

  const TABS = [
    { id:"dashboard",   label:"Tableau de bord", icon:"📊" },
    { id:"demandes",    label:"Demandes",         icon:"📋", badge: demandes.filter(d=>d.statut==="en_attente").length },
    { id:"planning",    label:"Planning",         icon:"📅" },
    { id:"realisation", label:"Réalisation",      icon:"🔬", badge: demandes.filter(d=>d.statut==="planifiee").length },
    { id:"resultats",   label:"Résultats",        icon:"📄" },
    { id:"facturation", label:"Facturation",      icon:"💰" },
    { id:"statistiques",label:"Statistiques",     icon:"📈" },
  ];

  const urgentes = demandes.filter(d=>d.priorite==="urgente"&&d.statut!=="validee"&&d.statut!=="annulee").length;

  return (
    <>
      <style>{CSS}</style>
      <div className="echo">

        {/* ── TOPBAR ── */}
        <div className="echo-top">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap", position:"relative", zIndex:2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:54, height:54, borderRadius:14, background:"rgba(255,255,255,.12)", border:"1.5px solid rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>
                🔬
              </div>
              <div>
                <div style={{ fontSize:21, fontWeight:700, color:"#fff", letterSpacing:-.3 }}>Module Échographie</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.55)", marginTop:2, display:"flex", gap:12, flexWrap:"wrap" }}>
                  <span>{demandes.length} demande(s) · {demandes.filter(d=>d.statut==="planifiee").length} planifiée(s)</span>
                  {urgentes>0 && <span style={{ color:"#FCA5A5", fontWeight:700 }}>🚨 {urgentes} urgente(s)</span>}
                  <span className="pulse-dot" style={{ width:6, height:6, background:"#34D399" }} />
                  <span style={{ color:"rgba(255,255,255,.4)" }}>Temps réel</span>
                </div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {/* Badges liaisons rapides */}
              <div style={{ display:"flex", gap:4 }}>
                {LIAISONS.slice(0,4).map(l=>(
                  <div key={l.label} style={{ background:"rgba(255,255,255,.1)", border:"1px solid rgba(255,255,255,.2)", borderRadius:8, padding:"5px 10px", fontSize:11, color:"rgba(255,255,255,.8)", cursor:"pointer", fontWeight:600, display:"flex", alignItems:"center", gap:5 }}>
                    {l.icon} {l.label}
                  </div>
                ))}
              </div>
              <button className="cbtn cbtn-teal" onClick={()=>setModalNouv(true)}>+ Nouvelle demande</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="echo-tabs">
            {TABS.map(t=>(
              <button key={t.id} className={`echo-tab ${mainTab===t.id?"active":""}`} onClick={()=>setMainTab(t.id)}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
                {t.badge>0 && <span className="echo-tab-badge">{t.badge}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div style={{ padding:24 }}>
          {mainTab==="dashboard"    && <Dashboard demandes={demandes} />}
          {mainTab==="demandes"     && <Demandes demandes={demandes} onNewDemande={()=>setModalNouv(true)} setMainTab={setMainTab} />}
          {mainTab==="planning"     && <Planning demandes={demandes} />}
          {mainTab==="realisation"  && <Realisation demandes={demandes} />}
          {mainTab==="facturation"  && <Facturation demandes={demandes} />}
          {mainTab==="statistiques" && <Statistiques demandes={demandes} />}
          {mainTab==="resultats"    && (
            <div className="fu echo-card" style={{ padding:40, textAlign:"center" }}>
              <div style={{ fontSize:48, marginBottom:16 }}>📄</div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--cn)", marginBottom:8 }}>Résultats & Rapports</div>
              <div style={{ fontSize:13, color:"var(--cm)", marginBottom:20, maxWidth:480, margin:"0 auto 20px" }}>
                Les rapports validés sont disponibles ici et automatiquement transmis au dossier patient, à la consultation prescriptrice et aux modules liés.
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:10, justifyContent:"center" }}>
                {demandes.filter(d=>d.rapport_statut==="valide").map(d=>(
                  <div key={d.id} style={{ background:"#F0FDFC", border:"1.5px solid #99F6E4", borderRadius:14, padding:"14px 18px", minWidth:220, textAlign:"left" }}>
                    <div style={{ fontWeight:700, color:"var(--cn)" }}>{d.patient}</div>
                    <div style={{ fontSize:12, color:"var(--cm)", margin:"4px 0" }}>{TYPES_ECHO.find(t=>t.label===d.type)?.icon} {d.type}</div>
                    <span className="cbdg green">✅ Validé</span>
                    <div style={{ display:"flex", gap:6, marginTop:10 }}>
                      <button className="cbtn cbtn-teal cbtn-sm">📄 Rapport</button>
                      <button className="cbtn cbtn-ghost cbtn-sm">📧 Envoyer</button>
                    </div>
                  </div>
                ))}
                {demandes.filter(d=>d.rapport_statut==="valide").length===0 && (
                  <div style={{ color:"var(--cm)", fontSize:13 }}>Aucun rapport validé pour le moment</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── MODAL NOUVELLE DEMANDE ── */}
        <NouvelleDemandeModal
          open={modalNouv}
          onClose={()=>setModalNouv(false)}
          onAdd={d=>{ dispatch(createDemande(d)); setMainTab("demandes"); }}
        />
      </div>
    </>
  );
}