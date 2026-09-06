import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import { useRealtimeRefresh } from "../hooks/useRealtimeRefresh";
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

// ─── CSS Medical Navy + Teal ──────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.db * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --dn:#0B1E3B; --dn2:#132744; --db:#1B4F9E;
  --dt:#0EA5A0; --dt2:#0D9490; --dr:#DC2626;
  --do:#D97706; --dg:#059669; --dp:#7C3AED;
  --dbr:#E2EAF4; --dm:#6B7A99; --dl:#EEF4FF; --ds:#F8FAFD;
  --sh:0 1px 3px rgba(11,30,59,.08); --shm:0 4px 16px rgba(11,30,59,.10); --shl:0 12px 40px rgba(11,30,59,.14);
}
.db-hero { background:linear-gradient(135deg,var(--dn) 0%,var(--dn2) 60%,#1B4F9E 100%); border-radius:20px; padding:24px 28px; position:relative; overflow:hidden; margin-bottom:24px; }
.db-hero::before { content:''; position:absolute; top:-60px; right:-60px; width:260px; height:260px; background:radial-gradient(circle,rgba(14,165,160,.2) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
.db-hero::after  { content:''; position:absolute; bottom:-80px; left:30%; width:220px; height:220px; background:radial-gradient(circle,rgba(27,79,158,.12) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
.db-card { background:#fff; border:1.5px solid var(--dbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; margin-bottom:20px; }
.db-card:hover { box-shadow:var(--shm); }
.db-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--dbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.db-card-hdr h3 { font-size:14px; font-weight:700; color:var(--dn); margin:0; display:flex; align-items:center; gap:8px; }
.db-card-hdr p { font-size:11px; color:var(--dm); margin:2px 0 0; }
.db-kpi { background:#fff; border:1.5px solid var(--dbr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:default; }
.db-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.db-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.db-kpi.blue::before   { background:var(--db); } .db-kpi.teal::before  { background:var(--dt); }
.db-kpi.red::before    { background:var(--dr); } .db-kpi.orange::before{ background:var(--do); }
.db-kpi.green::before  { background:var(--dg); } .db-kpi.purple::before{ background:var(--dp); }
.db-kpi.cyan::before   { background:#06B6D4; }   .db-kpi.pink::before  { background:#EC4899; }
.db-kpi.yellow::before { background:#EAB308; }
.dkpi-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; font-size:18px; }
.dkpi-icon.blue   { background:#EFF6FF; color:var(--db); } .dkpi-icon.teal  { background:#F0FDFC; color:var(--dt); }
.dkpi-icon.red    { background:#FEF2F2; color:var(--dr); } .dkpi-icon.orange{ background:#FFF7ED; color:var(--do); }
.dkpi-icon.green  { background:#ECFDF5; color:var(--dg); } .dkpi-icon.purple{ background:#F5F3FF; color:var(--dp); }
.dkpi-icon.cyan   { background:#ECFEFF; color:#06B6D4; }   .dkpi-icon.pink  { background:#FDF2F8; color:#EC4899; }
.dkpi-icon.yellow { background:#FEFCE8; color:#CA8A04; }
.dkpi-val { font-size:26px; font-weight:800; color:var(--dn); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.dkpi-lbl { font-size:11.5px; font-weight:600; color:var(--dm); }
.dkpi-sub { font-size:10.5px; color:#9CA3AF; margin-top:2px; display:flex; align-items:center; gap:4px; }
.dkpi-dot { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--dr); animation:dbpulse 2s infinite; }
@keyframes dbpulse { 0%,100%{opacity:1} 50%{opacity:.3} }
.dbdg { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.dbdg.red    { background:#FEF2F2; color:var(--dr); border:1px solid #FECACA; }
.dbdg.orange { background:#FFF7ED; color:var(--do); border:1px solid #FED7AA; }
.dbdg.green  { background:#ECFDF5; color:var(--dg); border:1px solid #A7F3D0; }
.dbdg.blue   { background:#EFF6FF; color:var(--db); border:1px solid #BFDBFE; }
.dbdg.teal   { background:#F0FDFC; color:var(--dt); border:1px solid #99F6E4; }
.dbdg.purple { background:#F5F3FF; color:var(--dp); border:1px solid #DDD6FE; }
.dbdg.gray   { background:#F9FAFB; color:#4B5563;   border:1px solid #E5E7EB; }
.dbdg.yellow { background:#FEFCE8; color:#CA8A04;   border:1px solid #FEF08A; }
.al-danger { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--dr); border-radius:14px; padding:14px 18px; }
.al-warn   { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--do); border-radius:14px; padding:14px 18px; }
.al-info   { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; border-left:4px solid var(--db); border-radius:14px; padding:14px 18px; }
.al-success{ background:linear-gradient(135deg,#ECFDF5,#D1FAE5); border:1.5px solid #A7F3D0; border-left:4px solid var(--dg); border-radius:14px; padding:14px 18px; }
.db-prog { background:#EEF4FF; border-radius:99px; height:7px; overflow:hidden; }
.db-prog-f { height:100%; border-radius:99px; transition:width .6s; }
.dbtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; text-decoration:none; }
.dbtn-primary { background:var(--db); color:#fff; } .dbtn-primary:hover { background:#174391; transform:translateY(-1px); }
.dbtn-teal    { background:var(--dt); color:#fff; } .dbtn-teal:hover    { background:var(--dt2); transform:translateY(-1px); }
.dbtn-ghost   { background:transparent; color:var(--dm); border:1.5px solid var(--dbr); }
.dbtn-ghost:hover { background:var(--dl); color:var(--dn); }
.dbtn-sm { padding:6px 13px; font-size:12px; }
.qa-btn { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; width:100%; height:100%; min-height:92px; box-sizing:border-box; padding:14px 10px; border-radius:14px; border:1.5px solid var(--dbr); background:#fff; cursor:pointer; transition:all .2s; font-family:'Poppins',sans-serif; font-size:11px; font-weight:600; color:var(--dm); text-align:center; }
.qa-btn:hover { border-color:var(--dt); background:var(--dl); color:var(--dn); transform:translateY(-2px); box-shadow:var(--shm); }
.qa-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:20px; }
.db-tbl { width:100%; border-collapse:collapse; }
.db-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.db-tbl th { padding:10px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--dm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--dbr); white-space:nowrap; }
.db-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.db-tbl tbody tr:last-child td { border-bottom:none; }
.db-tbl tbody tr:hover { background:#F8FAFF; }
.role-crown { background:linear-gradient(135deg,#F59E0B,#D97706); padding:3px 10px; border-radius:99px; font-size:11px; font-weight:700; color:#fff; display:inline-flex; align-items:center; gap:5px; }
.sys-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.sys-dot.ok { background:var(--dg); box-shadow:0 0 0 3px rgba(5,150,105,.2); }
.sys-dot.warn { background:var(--do); box-shadow:0 0 0 3px rgba(215,119,6,.2); }
.sys-dot.error { background:var(--dr); box-shadow:0 0 0 3px rgba(220,38,38,.2); animation:dbpulse 1.5s infinite; }
.rdv-item { display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid #F3F7FF; }
.rdv-time { font-weight:700; font-size:13px; color:var(--dn); min-width:48px; }
.rdv-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.stat-row { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid #F3F7FF; }
.stat-row:last-child { border-bottom:none; }
.user-avatar { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; color:#fff; flex-shrink:0; }
.trend-up   { color:var(--dg); font-size:11px; font-weight:700; display:flex; align-items:center; gap:2px; }
.trend-down { color:var(--dr); font-size:11px; font-weight:700; display:flex; align-items:center; gap:2px; }
@keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
.fu { animation:fadeUp .35s ease both; }
.d1{animation-delay:.05s}.d2{animation-delay:.1s}.d3{animation-delay:.15s}
.d4{animation-delay:.2s}.d5{animation-delay:.25s}.d6{animation-delay:.3s}
/* Patient-specific styles */
.pat-timeline-dot { width:12px; height:12px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 0 3px rgba(14,165,160,.3); background:var(--dt); flex-shrink:0; }
.pat-card-accent { border-left:4px solid var(--dt); }
.health-ring { width:80px; height:80px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:28px; flex-shrink:0; }
`;

// ─── Helpers ─────────────────────────────────────────────────
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const fmtNum   = (n) => n >= 1000000 ? `${(n/1000000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(0)}k` : String(n ?? 0);
const fmtCFA   = (n) => Number(n||0).toLocaleString("fr-FR") + " CFA";
const today    = new Date().toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
const todayFmt = today.charAt(0).toUpperCase() + today.slice(1);

function Empty({ icon="📭", msg="Aucune donnée disponible" }) {
  return (
    <div style={{ textAlign:"center", padding:"28px 16px", color:"#9CA3AF" }}>
      <div style={{ fontSize:28, marginBottom:8 }}>{icon}</div>
      <div style={{ fontSize:12, fontWeight:600 }}>{msg}</div>
    </div>
  );
}

const ROLE_CFG = {
  superadmin:     { icon:"👑", label:"Super Administrateur",  color:"#F59E0B", bg:"#FEF3C7" },
  adminclinique:  { icon:"🏥", label:"Admin Clinique",         color:"#7C3AED", bg:"#F5F3FF" },
  medecin:        { icon:"👨‍⚕️", label:"Médecin",               color:"#1B4F9E", bg:"#EFF6FF" },
  sage_femme:     { icon:"🤰", label:"Sage-femme",             color:"#EC4899", bg:"#FDF2F8" },
  infirmier:      { icon:"💉", label:"Infirmier(e)",            color:"#06B6D4", bg:"#ECFEFF" },
  laborantin:     { icon:"🔬", label:"Laborantin(e)",           color:"#059669", bg:"#ECFDF5" },
  radiologue:     { icon:"🩻", label:"Radiologue",              color:"#6366F1", bg:"#EEF2FF" },
  pharmacien:     { icon:"💊", label:"Pharmacien(ne)",          color:"#D97706", bg:"#FFF7ED" },
  comptable:      { icon:"💰", label:"Comptable",               color:"#EAB308", bg:"#FEFCE8" },
  receptionniste: { icon:"📋", label:"Réceptionniste",          color:"#EC4899", bg:"#FDF2F8" },
  patient:        { icon:"🧑‍⚕️", label:"Patient",                color:"#0EA5A0", bg:"#F0FDFC" },
};

// ─── Chart components ─────────────────────────────────────────
function LineChart({ labels, datasets, height=200 }) {
  const ref = useRef(null);
  const cRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (cRef.current) cRef.current.destroy();
      cRef.current = new window.Chart(ref.current, {
        type:"line", data:{ labels, datasets },
        options:{ responsive:true, maintainAspectRatio:true, interaction:{ mode:"index", intersect:false },
          plugins:{ legend:{ display:datasets.length>1, position:"top", labels:{ font:{size:11,family:"'Poppins',sans-serif"}, usePointStyle:true, boxWidth:8 } }, tooltip:{ backgroundColor:"#0B1E3B", padding:12, cornerRadius:10 } },
          scales:{ x:{ grid:{display:false}, ticks:{font:{size:10},color:"#9CA3AF"}, border:{display:false} }, y:{ beginAtZero:true, grid:{color:"rgba(0,0,0,.04)"}, ticks:{font:{size:10},color:"#9CA3AF",precision:0}, border:{display:false} } } },
      });
    });
    return () => { if (cRef.current) cRef.current.destroy(); };
  }, [labels, datasets]);
  return <canvas ref={ref} style={{ maxHeight:height }} />;
}

function BarChart({ labels, data, colors, height=180 }) {
  const ref = useRef(null);
  const cRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (cRef.current) cRef.current.destroy();
      cRef.current = new window.Chart(ref.current, {
        type:"bar",
        data:{ labels, datasets:[{ data, backgroundColor:colors||`#1B4F9E26`, borderColor:colors?"transparent":"#1B4F9E", borderWidth:colors?0:2, borderRadius:8, borderSkipped:false }] },
        options:{ responsive:true, maintainAspectRatio:true, plugins:{ legend:{display:false}, tooltip:{backgroundColor:"#0B1E3B",padding:10,cornerRadius:10} }, scales:{ x:{grid:{display:false},ticks:{font:{size:10},color:"#9CA3AF"},border:{display:false}}, y:{beginAtZero:true,grid:{color:"rgba(0,0,0,.04)"},ticks:{font:{size:10},color:"#9CA3AF",precision:0},border:{display:false}} } },
      });
    });
    return () => { if (cRef.current) cRef.current.destroy(); };
  }, [labels, data, colors]);
  return <canvas ref={ref} style={{ maxHeight:height }} />;
}

function KpiCard({ color, icon, value, label, sub, urgent, trend, trendUp, onClick }) {
  return (
    <div className={`db-kpi ${color} fu`} onClick={onClick} style={{ cursor:onClick?"pointer":"default" }}>
      {urgent && <div className="dkpi-dot" />}
      <div className={`dkpi-icon ${color}`}>{icon}</div>
      <div className="dkpi-val">{value}</div>
      <div className="dkpi-lbl">{label}</div>
      {(sub || trend !== undefined) && (
        <div className="dkpi-sub">
          {trend !== undefined && <span className={trendUp?"trend-up":"trend-down"}>{trendUp?"↑":"↓"}{Math.abs(trend)}%</span>}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </div>
  );
}

function Prog({ pct, color }) {
  return <div className="db-prog"><div className="db-prog-f" style={{ width:`${Math.min(100,pct||0)}%`, background:color }} /></div>;
}

function Badge({ cls, children }) { return <span className={`dbdg ${cls}`}>{children}</span>; }

// ─── Quick actions ────────────────────────────────────────────
const QUICK_ACTIONS = {
  superadmin:     [{ icon:"➕", label:"Nouveau patient", color:"#EFF6FF", to:"/patients" },{ icon:"📅", label:"Rendez-vous", color:"#F0FDFC", to:"/appointments" },{ icon:"🩺", label:"Consultations", color:"#ECFDF5", to:"/consultations" },{ icon:"👥", label:"Utilisateurs", color:"#F5F3FF", to:"/administration" },{ icon:"🏥", label:"Hospitalisations", color:"#FEF2F2", to:"/hospitalization" },{ icon:"🧪", label:"Laboratoire", color:"#ECFDF5", to:"/laboratory" },{ icon:"💊", label:"Pharmacie", color:"#FFF7ED", to:"/pharmacy" },{ icon:"💰", label:"Finance", color:"#FEFCE8", to:"/finance" },{ icon:"📊", label:"Rapports", color:"#EEF2FF", to:"/analytics" }],
  adminclinique:  [{ icon:"➕", label:"Nouveau patient", color:"#EFF6FF", to:"/patients" },{ icon:"📅", label:"Nouveau RDV", color:"#F0FDFC", to:"/appointments" },{ icon:"🩺", label:"Consultation", color:"#ECFDF5", to:"/consultations" },{ icon:"💊", label:"Ordonnance", color:"#FFF7ED", to:"/prescriptions" },{ icon:"🏥", label:"Hospitalisation", color:"#FEF2F2", to:"/hospitalization" },{ icon:"💰", label:"Finance", color:"#FEFCE8", to:"/finance" },{ icon:"🧪", label:"Laboratoire", color:"#F5F3FF", to:"/laboratory" },{ icon:"🩻", label:"Imagerie", color:"#EEF2FF", to:"/radiology" },{ icon:"📊", label:"Analytics", color:"#FDF2F8", to:"/analytics" },{ icon:"⚙️", label:"Paramètres", color:"#FFF7ED", to:"/settings" }],
  medecin:        [{ icon:"🩺", label:"Consultation", color:"#EFF6FF", to:"/consultations" },{ icon:"💊", label:"Ordonnance", color:"#F0FDFC", to:"/prescriptions" },{ icon:"📅", label:"Mes RDV", color:"#ECFDF5", to:"/appointments" },{ icon:"👥", label:"Mes patients", color:"#FFF7ED", to:"/patients" },{ icon:"🏥", label:"Hospitalisation", color:"#FEF2F2", to:"/hospitalization" },{ icon:"🔬", label:"Labo", color:"#ECFDF5", to:"/laboratory" },{ icon:"🩻", label:"Imagerie", color:"#EEF2FF", to:"/radiology" },{ icon:"🤖", label:"IA", color:"#F5F3FF", to:"/ai" }],
  sage_femme:     [{ icon:"🤰", label:"Grossesses", color:"#FDF2F8", to:"/maternite" },{ icon:"👶", label:"Accouchements", color:"#F0FDFC", to:"/maternite" },{ icon:"📋", label:"CPN", color:"#EFF6FF", to:"/maternite" },{ icon:"🔬", label:"Échographies", color:"#F5F3FF", to:"/maternite" },{ icon:"👥", label:"Nouveau-nés", color:"#FFF7ED", to:"/pediatrie" },{ icon:"💬", label:"Messagerie", color:"#ECFDF5", to:"/messages" }],
  infirmier:      [{ icon:"👥", label:"Patients", color:"#EFF6FF", to:"/patients" },{ icon:"🌡️", label:"Constantes", color:"#F0FDFC", to:"/hospitalization" },{ icon:"💉", label:"Soins", color:"#ECFDF5", to:"/hospitalization" },{ icon:"💊", label:"Médicaments", color:"#FFF7ED", to:"/pharmacy" },{ icon:"📋", label:"Fiche suivi", color:"#F5F3FF", to:"/hospitalization" },{ icon:"💬", label:"Messagerie", color:"#FDF2F8", to:"/messages" }],
  // AUDIT-ELEVE-1 — "Rapports"/"Analytics" pointaient vers /analytics,
  // strictement réservé à superadmin/adminclinique côté backend
  // (analytics.routes.js) : laborantin/pharmacien/comptable n'y ont aucun
  // accès réel, ni aujourd'hui ni après un simple élargissement de rôle
  // (la donnée elle-même n'est pas scoping-compatible avec un seul rôle
  // métier). Redirigés vers leur propre module, où leurs vraies statistiques
  // existent déjà (pharmaC.getStats, etc.) plutôt que vers une page qu'ils
  // ne pourront jamais ouvrir.
  laborantin:     [{ icon:"🔬", label:"Analyses", color:"#ECFDF5", to:"/laboratory" },{ icon:"📋", label:"Résultats", color:"#EFF6FF", to:"/laboratory" },{ icon:"🚨", label:"Critiques", color:"#FEF2F2", to:"/laboratory" },{ icon:"✅", label:"Valider", color:"#ECFDF5", to:"/laboratory" },{ icon:"📊", label:"Rapports", color:"#F5F3FF", to:"/laboratory" },{ icon:"💬", label:"Messagerie", color:"#FDF2F8", to:"/messages" }],
  // AUDIT-ELEVE-1 — "IA" pointait vers /ai, réservé à
  // superadmin/adminclinique/medecin (ai.routes.js) : radiologue n'y a aucun
  // accès. Ce rôle a déjà sa propre entrée "Anomalies IA" vers /radiology
  // juste au-dessus — la seconde entrée générique était un doublon cassé,
  // redirigée vers le même module réel plutôt que dupliquée ou supprimée.
  radiologue:     [{ icon:"🩻", label:"Examens", color:"#EEF2FF", to:"/radiology" },{ icon:"📝", label:"Compte rendu", color:"#EFF6FF", to:"/radiology" },{ icon:"🚨", label:"Anomalies IA", color:"#FEF2F2", to:"/radiology" },{ icon:"📅", label:"Planning", color:"#F0FDFC", to:"/radiology" },{ icon:"✅", label:"Valider", color:"#ECFDF5", to:"/radiology" },{ icon:"🤖", label:"IA", color:"#F5F3FF", to:"/radiology" }],
  pharmacien:     [{ icon:"💊", label:"Vente", color:"#FFF7ED", to:"/pharmacy" },{ icon:"📦", label:"Commandes", color:"#EFF6FF", to:"/pharmacy" },{ icon:"🚨", label:"Alertes stock", color:"#FEF2F2", to:"/pharmacy" },{ icon:"📋", label:"Inventaire", color:"#F5F3FF", to:"/pharmacy" },{ icon:"📊", label:"Rapports", color:"#FDF2F8", to:"/pharmacy" },{ icon:"💬", label:"Messagerie", color:"#F0FDFC", to:"/messages" }],
  receptionniste: [{ icon:"➕", label:"Nouveau patient", color:"#EFF6FF", to:"/patients" },{ icon:"📅", label:"Nouveau RDV", color:"#F0FDFC", to:"/appointments" },{ icon:"✅", label:"Confirmer RDV", color:"#ECFDF5", to:"/appointments" },{ icon:"📋", label:"Liste patients", color:"#FFF7ED", to:"/patients" },{ icon:"💬", label:"Messagerie", color:"#FDF2F8", to:"/messages" }],
  comptable:      [{ icon:"💰", label:"Factures", color:"#FEFCE8", to:"/finance" },{ icon:"📥", label:"Encaissement", color:"#ECFDF5", to:"/finance" },{ icon:"🏦", label:"Assurances", color:"#FFF7ED", to:"/finance" },{ icon:"📊", label:"Analytics", color:"#F5F3FF", to:"/finance" },{ icon:"📋", label:"Impayées", color:"#FEF2F2", to:"/finance" }],
  // ✅ Patient : actions limitées à son propre espace
  // AUDIT-DASHBOARD — Portal.jsx gère ses onglets par état local (setTab),
  // pas par sous-route ; App.jsx ne déclare que path="portal" (pas de "/*").
  // Toute cible /portal/xxx tombait donc sur la page 404. Seul /portal existe
  // réellement : le patient atterrit sur le portail et choisit l'onglet.
  patient:        [{ icon:"📅", label:"Mes RDV", color:"#F0FDFC", to:"/portal" },{ icon:"📋", label:"Mon dossier", color:"#EFF6FF", to:"/portal" },{ icon:"💊", label:"Ordonnances", color:"#FFF7ED", to:"/portal" },{ icon:"🔬", label:"Mes résultats", color:"#ECFDF5", to:"/portal" },{ icon:"💬", label:"Messages", color:"#FDF2F8", to:"/portal" },{ icon:"💳", label:"Mes factures", color:"#FEFCE8", to:"/portal" }],
};

// ════════════════════════════════════════════════════════════════
// ─── PATIENT DASHBOARD ──────────────────────────────────────────
// ════════════════════════════════════════════════════════════════
function PatientDashboard({ data, user, isMobile }) {
  const navigate = useNavigate();
  const kpis         = data?.kpis           || {};
  const prochainRdv  = data?.prochain_rdv   || null;
  const rdvListe     = data?.mes_rdv        || [];
  const ordonnances  = data?.ordonnances    || [];
  const resultats    = data?.resultats      || [];
  const factures     = data?.factures       || [];
  const alertes      = data?.alertes        || [];
  const constantes   = data?.constantes     || {};
  const medecin      = data?.medecin_ref    || null;
  const profilACompleter = data?.profil_a_completer || false;

  const stRdv = (s) => ({ confirme:"green", en_attente:"orange", annule:"red", termine:"gray" }[s] || "blue");
  const lbRdv = (s) => ({ confirme:"✅ Confirmé", en_attente:"⏳ En attente", annule:"❌ Annulé", termine:"✓ Passé" }[s] || s);

  return (
    <div>
      {/* AUDIT-D2 (ticket 0002) — c'est ici, pas Portal.jsx, que le patient
          voit réellement cette alerte en arrivant après connexion (Portal.jsx
          n'est atteint que par navigation explicite vers "Mon Espace
          Patient" — vérifié en Phase G2). Le formulaire de complétion vit
          uniquement sur /portal (pas de modale dupliquée ici) : le bouton y
          renvoie. */}
      {profilACompleter && (
        <div className="al-warn" style={{ marginBottom:20, display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ fontSize:20 }}>⚠</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#92400E" }}>Profil à compléter</div>
            <div style={{ fontSize:12, color:"#B45309" }}>Votre date de naissance et votre sexe sont manquants — merci de les renseigner pour finaliser votre dossier.</div>
          </div>
          <button className="dbtn dbtn-primary dbtn-sm" onClick={() => navigate("/portal")}>Compléter mon profil →</button>
        </div>
      )}

      {/* ── Prochain RDV — bannière mise en avant ── */}
      {prochainRdv ? (
        <div style={{ background:"linear-gradient(135deg,#0EA5A0 0%,#0B1E3B 100%)", borderRadius:18, padding:"20px 24px", marginBottom:20, display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
          <div style={{ width:56, height:56, borderRadius:14, background:"rgba(255,255,255,.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0 }}>📅</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.6)", fontWeight:600, textTransform:"uppercase", letterSpacing:.5 }}>Prochain rendez-vous</div>
            <div style={{ fontSize:17, fontWeight:700, color:"#fff", marginTop:2 }}>{prochainRdv.date} à {prochainRdv.heure}</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,.7)", marginTop:3 }}>{prochainRdv.type} · Dr. {prochainRdv.medecin}</div>
          </div>
          <button className="dbtn" style={{ background:"rgba(255,255,255,.15)", color:"#fff", border:"1.5px solid rgba(255,255,255,.3)" }} onClick={() => navigate("/portal")}>
            Voir tous mes RDV →
          </button>
        </div>
      ) : (
        <div className="al-info" style={{ marginBottom:20, display:"flex", gap:12, alignItems:"center" }}>
          <span style={{ fontSize:20 }}>📅</span>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#1E40AF" }}>Aucun rendez-vous à venir</div>
            <div style={{ fontSize:12, color:"#3B82F6" }}>Contactez la réception pour prendre un rendez-vous.</div>
          </div>
          <button className="dbtn dbtn-primary dbtn-sm" style={{ marginLeft:"auto" }} onClick={() => navigate("/portal")}>Prendre RDV</button>
        </div>
      )}

      {/* ── Alertes importantes ── */}
      {alertes.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
          {alertes.map((al, i) => (
            <div key={i} className={`al-${al.type === "error" ? "danger" : al.type === "warn" ? "warn" : "info"}`} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
              <span style={{ fontSize:18, flexShrink:0 }}>{al.type === "error" ? "🚨" : al.type === "warn" ? "⚠️" : "ℹ️"}</span>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--dn)" }}>{al.msg}</div>
                <div style={{ fontSize:10, color:"var(--dm)", marginTop:2 }}>{al.heure}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── KPIs patient ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14, marginBottom:24 }}>
        <KpiCard color="teal"   icon="📅" value={kpis.rdv_a_venir ?? 0}       label="RDV à venir"          sub="prochains" />
        <KpiCard color="blue"   icon="💊" value={kpis.ordonnances_actives ?? 0} label="Ordonnances actives"  sub="en cours" />
        <KpiCard color="green"  icon="🔬" value={kpis.resultats_disponibles ?? 0} label="Résultats disponibles" sub="à consulter" />
        <KpiCard color="orange" icon="💳" value={kpis.factures_impayees ?? 0}  label="Factures impayées"    urgent={kpis.factures_impayees > 0} sub="à régler" />
        <KpiCard color="purple" icon="📋" value={kpis.consultations_total ?? 0} label="Consultations"        sub="historique" />
        <KpiCard color="cyan"   icon="💬" value={kpis.messages_non_lus ?? 0}   label="Messages non lus"     sub="du médecin" />
      </div>

      {/* ── Constantes vitales + Médecin référent ── */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20, marginBottom:20 }}>

        {/* Constantes vitales */}
        <div className="db-card">
          <div className="db-card-hdr"><h3>❤️ Mes constantes vitales</h3><p>Dernière mesure enregistrée</p></div>
          <div style={{ padding:20 }}>
            {constantes.poids || constantes.tension || constantes.glycemie ? (
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                {[
                  { label:"Poids",        val:constantes.poids     ? constantes.poids+"  kg"   : "—", icon:"⚖️",  color:"#EFF6FF", c:"var(--db)" },
                  { label:"Tension",      val:constantes.tension   ? constantes.tension+" mmHg": "—", icon:"💓",  color:"#FEF2F2", c:"var(--dr)" },
                  { label:"Glycémie",     val:constantes.glycemie  ? constantes.glycemie+" g/L": "—", icon:"🩸",  color:"#FFF7ED", c:"var(--do)" },
                  { label:"Température",  val:constantes.temp      ? constantes.temp+"°C"       : "—", icon:"🌡️",  color:"#ECFDF5", c:"var(--dg)" },
                  { label:"Taille",       val:constantes.taille    ? constantes.taille+" cm"    : "—", icon:"📏",  color:"#F5F3FF", c:"var(--dp)" },
                  { label:"Fréq. card.",  val:constantes.fc        ? constantes.fc+" bpm"       : "—", icon:"🫀",  color:"#FDF2F8", c:"#EC4899" },
                ].map(({ label, val, icon, color, c }) => (
                  <div key={label} style={{ background:color, borderRadius:12, padding:"12px 14px" }}>
                    <div style={{ fontSize:18, marginBottom:4 }}>{icon}</div>
                    <div style={{ fontSize:16, fontWeight:800, color:c }}>{val}</div>
                    <div style={{ fontSize:10, color:"var(--dm)", fontWeight:600 }}>{label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon="❤️" msg="Aucune constante enregistrée" />
            )}
            {constantes.date && (
              <div style={{ fontSize:10, color:"var(--dm)", textAlign:"right", marginTop:10 }}>
                Mesurée le {fmtDate(constantes.date)}
              </div>
            )}
          </div>
        </div>

        {/* Médecin référent */}
        <div>
          <div className="db-card" style={{ marginBottom:16 }}>
            <div className="db-card-hdr"><h3>👨‍⚕️ Mon médecin référent</h3></div>
            <div style={{ padding:20 }}>
              {medecin ? (
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:56, height:56, borderRadius:14, background:"#EFF6FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0 }}>👨‍⚕️</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:"var(--dn)" }}>Dr. {medecin.nom} {medecin.prenom}</div>
                    <div style={{ fontSize:12, color:"var(--dt)", fontWeight:600, marginTop:2 }}>{medecin.specialite}</div>
                    {medecin.telephone && <div style={{ fontSize:11, color:"var(--dm)", marginTop:4 }}>📞 {medecin.telephone}</div>}
                  </div>
                </div>
              ) : (
                <Empty icon="👨‍⚕️" msg="Aucun médecin référent assigné" />
              )}
            </div>
          </div>

          {/* Ordonnances actives */}
          <div className="db-card">
            <div className="db-card-hdr"><h3>💊 Ordonnances actives</h3></div>
            <div style={{ padding:"8px 0" }}>
              {ordonnances.length === 0 ? (
                <div style={{ padding:"12px 20px" }}><Empty icon="💊" msg="Aucune ordonnance active" /></div>
              ) : ordonnances.slice(0, 3).map((o, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 20px", borderBottom:i < Math.min(ordonnances.length, 3) - 1 ? "1px solid var(--dbr)" : "" }}>
                  <div style={{ width:36, height:36, borderRadius:9, background:"#FFF7ED", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>💊</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--dn)" }}>{o.medicament}</div>
                    <div style={{ fontSize:11, color:"var(--dm)" }}>{o.posologie} · jusqu'au {fmtDate(o.fin)}</div>
                  </div>
                  <Badge cls="teal">Active</Badge>
                </div>
              ))}
              {ordonnances.length > 3 && (
                <div style={{ padding:"10px 20px" }}>
                  <button className="dbtn dbtn-ghost dbtn-sm" style={{ width:"100%" }} onClick={() => navigate("/portal")}>
                    Voir toutes ({ordonnances.length}) →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Résultats d'analyses + Historique RDV ── */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20, marginBottom:20 }}>

        {/* Résultats récents */}
        <div className="db-card">
          <div className="db-card-hdr">
            <div><h3>🔬 Mes résultats récents</h3><p>Analyses et examens</p></div>
            <button className="dbtn dbtn-ghost dbtn-sm" onClick={() => navigate("/portal")}>Voir tout</button>
          </div>
          <div style={{ padding:"8px 0" }}>
            {resultats.length === 0 ? (
              <div style={{ padding:"12px 20px" }}><Empty icon="🔬" msg="Aucun résultat disponible" /></div>
            ) : resultats.slice(0, 4).map((r, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 20px", borderBottom:i < Math.min(resultats.length, 4) - 1 ? "1px solid var(--dbr)" : "" }}>
                <div style={{ width:36, height:36, borderRadius:9, background:r.type === "laboratoire" ? "#ECFDF5" : "#EEF2FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                  {r.type === "laboratoire" ? "🔬" : "🩻"}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--dn)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.examen}</div>
                  <div style={{ fontSize:11, color:"var(--dm)" }}>{fmtDate(r.date)}</div>
                </div>
                <Badge cls={r.statut === "disponible" ? "green" : r.statut === "anormal" ? "orange" : "blue"}>
                  {r.statut === "disponible" ? "✅ Disponible" : r.statut === "anormal" ? "⚠ Anormal" : "⏳ En cours"}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Historique RDV */}
        <div className="db-card">
          <div className="db-card-hdr">
            <div><h3>📅 Mes rendez-vous</h3><p>{rdvListe.length} au total</p></div>
            <button className="dbtn dbtn-ghost dbtn-sm" onClick={() => navigate("/portal")}>Voir tout</button>
          </div>
          <div style={{ padding:"8px 0" }}>
            {rdvListe.length === 0 ? (
              <div style={{ padding:"12px 20px" }}><Empty icon="📅" msg="Aucun rendez-vous" /></div>
            ) : rdvListe.slice(0, 4).map((r, i) => (
              <div key={i} className="rdv-item" style={{ padding:"10px 20px" }}>
                <div className="rdv-time" style={{ minWidth:60 }}>{r.date ? fmtDate(r.date) : r.heure}</div>
                <div className="rdv-dot" style={{ background:{ confirme:"#059669", en_attente:"#D97706", annule:"#DC2626", termine:"#9CA3AF" }[r.statut] || "#1B4F9E" }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"var(--dn)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.type}</div>
                  <div style={{ fontSize:11, color:"var(--dm)" }}>Dr. {r.medecin}</div>
                </div>
                <Badge cls={stRdv(r.statut)}>{lbRdv(r.statut)}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Factures ── */}
      {factures.length > 0 && (
        <div className="db-card">
          <div className="db-card-hdr">
            <div><h3>💳 Mes factures</h3><p>Historique des paiements</p></div>
            <button className="dbtn dbtn-ghost dbtn-sm" onClick={() => navigate("/portal")}>Voir tout</button>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table className="db-tbl">
              <thead><tr><th>Date</th><th>Prestation</th><th>Montant</th><th>Statut</th></tr></thead>
              <tbody>
                {factures.slice(0, 5).map((f, i) => (
                  <tr key={i}>
                    <td style={{ color:"var(--dm)", fontSize:12 }}>{fmtDate(f.date)}</td>
                    <td style={{ fontWeight:600, color:"var(--dn)" }}>{f.prestation}</td>
                    <td style={{ fontWeight:700, color:"var(--dn)" }}>{fmtCFA(f.montant)}</td>
                    <td><Badge cls={f.statut === "payee" ? "green" : f.statut === "en_attente" ? "orange" : "red"}>{f.statut === "payee" ? "✅ Payée" : f.statut === "en_attente" ? "⏳ En attente" : "❌ Impayée"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Conseil santé personnalisé ── */}
      <div style={{ background:"linear-gradient(135deg,#F0FDFC,#ECFDF5)", border:"1.5px solid #A7F3D0", borderRadius:18, padding:"20px 24px", display:"flex", gap:16, alignItems:"flex-start" }}>
        <div style={{ width:48, height:48, borderRadius:12, background:"#ECFDF5", border:"2px solid #6EE7B7", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>💡</div>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:"#065F46", marginBottom:4 }}>Conseil santé du jour</div>
          <div style={{ fontSize:13, color:"#047857", lineHeight:1.6 }}>
            Pensez à bien suivre vos ordonnances et à ne pas manquer vos rendez-vous de suivi. En cas de symptômes inhabituels, contactez votre médecin référent.
          </div>
          <button className="dbtn dbtn-sm" style={{ background:"#059669", color:"#fff", marginTop:12, border:"none" }} onClick={() => navigate("/portal")}>
            💬 Contacter mon médecin
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ─── RADIOLOGUE DASHBOARD (complet) ────────────────────────────
// ════════════════════════════════════════════════════════════════
function RadiologueDashboard({ data, isMobile }) {
  const navigate = useNavigate();
  const kpis     = data?.kpis       || {};
  const examens  = data?.examens    || [];
  const alertes  = data?.alertes    || [];

  const stE = (s) => ({ valide:"green", en_cours:"teal", en_attente:"orange", anomalie:"red" }[s] || "gray");
  const lbE = (s) => ({ valide:"✅ Validé", en_cours:"🔄 En cours", en_attente:"⏳ En attente", anomalie:"⚠ Anomalie" }[s] || s);

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:14, marginBottom:24 }}>
        <KpiCard color="blue"   icon="🩻" value={kpis.examens_auj      ?? 0}   label="Examens du jour"       sub="programmés" />
        <KpiCard color="orange" icon="⏳" value={kpis.en_attente        ?? 0}    label="En attente"            sub="à réaliser" />
        <KpiCard color="teal"   icon="🔄" value={kpis.en_cours          ?? 0}    label="En cours"              sub="en analyse" />
        <KpiCard color="green"  icon="✅" value={kpis.rapports_rediges  ?? 0}    label="Rapports rédigés"      sub="validés" />
        <KpiCard color="red"    icon="🚨" value={kpis.anomalies         ?? 0}    label="Anomalies détectées"   urgent={kpis.anomalies > 0} />
      </div>

      {/* Alertes IA */}
      {alertes.length > 0 && alertes.map((al, i) => (
        <div key={i} className={`al-${al.type === "error" ? "danger" : al.type === "warn" ? "warn" : "info"}`} style={{ marginBottom:12, display:"flex", gap:10, alignItems:"flex-start" }}>
          <span style={{ fontSize:18, flexShrink:0 }}>{al.type === "error" ? "🚨" : al.type === "warn" ? "⚠️" : "🤖"}</span>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:"var(--dn)" }}>{al.msg}</div>
            <div style={{ fontSize:10, color:"var(--dm)", marginTop:2 }}>{al.heure}</div>
          </div>
        </div>
      ))}

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"2fr 1fr", gap:20, marginBottom:20 }}>
        {/* Liste examens */}
        <div className="db-card">
          <div className="db-card-hdr"><div><h3>🩻 Examens du jour</h3><p>{examens.length} à traiter</p></div></div>
          {examens.length === 0 ? <div style={{ padding:20 }}><Empty icon="🩻" msg="Aucun examen aujourd'hui" /></div> : (
            <div style={{ overflowX:"auto" }}>
              <table className="db-tbl">
                <thead><tr><th>Patient</th><th>Examen</th><th>Heure</th><th>Statut</th><th>Action</th></tr></thead>
                <tbody>
                  {examens.map((e, i) => (
                    <tr key={i} style={{ background: e.statut === "anomalie" ? "#FEF2F2" : "" }}>
                      <td style={{ fontWeight:600, color:"var(--dn)" }}>{e.patient}</td>
                      <td style={{ fontSize:12, color:"var(--dm)" }}>{e.type}</td>
                      <td style={{ fontWeight:600 }}>{e.heure}</td>
                      <td><Badge cls={stE(e.statut)}>{lbE(e.statut)}</Badge></td>
                      <td>
                        <button className="dbtn dbtn-primary dbtn-sm" style={{ fontSize:11 }} onClick={() => navigate("/radiology")}>
                          📝 CR
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* IA stats — dérivées des KPI réels ci-dessus (aucun calcul séparé de
            précision n'existe : voir dashboard.controller.js::radiologueStats) */}
        <div className="db-card">
          <div className="db-card-hdr"><h3>🤖 Assistance IA</h3></div>
          <div style={{ padding:20 }}>
            <div style={{ background:"linear-gradient(135deg,var(--dn),var(--dp))", borderRadius:14, padding:16, color:"#fff", textAlign:"center", marginBottom:16 }}>
              <div style={{ fontSize:28, marginBottom:4 }}>🤖</div>
              <div style={{ fontSize:13, fontWeight:700 }}>IA Radiologie active</div>
              <div style={{ fontSize:11, opacity:.7, marginTop:4 }}>Détection · Classification · Rapport</div>
            </div>
            {[
              ["Examens du jour", kpis.examens_auj ?? 0, "var(--dt)"],
              ["Anomalies détectées", kpis.anomalies ?? 0, "var(--dr)"],
            ].map(([l, v, c]) => (
              <div key={l} className="stat-row">
                <span style={{ fontSize:12, color:"var(--dm)" }}>{l}</span>
                <span style={{ fontWeight:700, color:c }}>{v}</span>
              </div>
            ))}
            {(kpis.anomalies ?? 0) > 0 && (
              <div style={{ marginTop:14, padding:"10px 12px", background:"#F0FDFC", borderRadius:10, fontSize:12, color:"var(--dt)", fontWeight:600 }}>
                💡 {kpis.anomalies} anomalie{kpis.anomalies > 1 ? "s" : ""} en attente de vérification
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ─── AUTRES DASHBOARDS (inchangés) ─────────────────────────────
// ════════════════════════════════════════════════════════════════
function SuperAdminDashboard({ data, isMobile }) {
  const navigate = useNavigate();
  const kpis        = data?.kpis                  || {};
  const sys         = data?.sys_status            || { db:"" };
  const uroles      = data?.users_par_role        || {};
  const alertes     = data?.alertes_crit          || [];
  const chartFin    = data?.chart_mois            || { labels:[], ca:[], dep:[] };
  const chartAct    = data?.chart_activite        || { labels:[], patients:[], consultations:[], rdv:[], hospitalisations:[] };
  const rdvListe    = data?.rdv_auj_liste         || [];
  const rdvStats    = data?.rdv_stats             || { total:0, confirmes:0, en_attente:0, termines:0, annules:0 };
  const consultsListe = data?.consultations_auj_liste || [];
  const urgences    = data?.urgences              || { nouvelles:0, en_cours:0, terminees:0 };
  const hospit      = data?.hospitalisation       || { admissions_auj:0, patients_actuels:0, sorties_auj:0 };
  const labo        = data?.laboratoire           || { demandes_auj:0, en_cours:0, critiques:0 };
  const imagerie    = data?.imagerie              || { examens_auj:0, en_attente:0, rapports_dispo:0 };
  const pharma      = data?.pharmacie             || { stock_faible:0, ruptures:0 };
  const connexions_echouees = data?.connexions_echouees ?? 0;
  const comptes_bloques     = data?.comptes_bloques ?? 0;

  const stRdv = (s) => ({ confirme:"green", en_attente:"orange", termine:"gray", annule:"red", arrive:"teal", en_consultation:"teal", planifie:"blue", reporte:"purple", absent:"red" }[s] || "blue");
  const lbRdv = (s) => ({ confirme:"✅ Confirmé", en_attente:"⏳ En attente", termine:"✓ Terminé", annule:"❌ Annulé", arrive:"🏥 Arrivé", en_consultation:"🩺 En cons.", planifie:"📅 Planifié", reporte:"↩️ Reporté", absent:"🚫 Absent" }[s] || s);
  // Cliquer sur une alerte ouvre le module correspondant — uniquement si la
  // route existe réellement dans App.jsx, jamais une route inventée.
  const alertRoute = (icon) => ({ "🔬":"/laboratory", "💊":"/pharmacy", "💰":"/finance", "🔒":"/administration", "🔐":"/audit" }[icon] || null);

  const vueGlobale = [
    { icon:"📅", title:"Rendez-vous",     to:"/appointments",   rows:[["Aujourd'hui", rdvStats.total],["Confirmés", rdvStats.confirmes],["En attente", rdvStats.en_attente]] },
    { icon:"🩺", title:"Consultations",   to:"/consultations",  rows:[["Aujourd'hui", kpis.consultations_auj ?? 0]] },
    { icon:"🏥", title:"Hospitalisation", to:"/hospitalization",rows:[["Admissions",  hospit.admissions_auj],["Hospitalisés", hospit.patients_actuels],["Sorties", hospit.sorties_auj]] },
    { icon:"🚨", title:"Urgences",        to:"/urgences",       rows:[["Nouvelles",   urgences.nouvelles],["En cours", urgences.en_cours],["Terminées", urgences.terminees]] },
    { icon:"🧪", title:"Laboratoire",     to:"/laboratory",     rows:[["Demandes",    labo.demandes_auj],["En cours", labo.en_cours],["Critiques", labo.critiques]] },
    { icon:"🩻", title:"Imagerie",        to:"/radiology",      rows:[["Examens",     imagerie.examens_auj],["En attente", imagerie.en_attente],["Rapports dispo.", imagerie.rapports_dispo]] },
    { icon:"💊", title:"Pharmacie",       to:"/pharmacy",       rows:[["Stocks faibles", pharma.stock_faible],["Ruptures", pharma.ruptures]] },
  ];

  const adminTotal = (uroles.superadmin ?? 0) + (uroles.adminclinique ?? 0);
  const roleBars = [
    ["Médecins",       uroles.medecin ?? 0],
    ["Infirmiers",     uroles.infirmier ?? 0],
    ["Laborantins",    uroles.laborantin ?? 0],
    ["Pharmaciens",    uroles.pharmacien ?? 0],
    ["Radiologues",    uroles.radiologue ?? 0],
    ["Comptables",     uroles.comptable ?? 0],
    ["Réception",      uroles.receptionniste ?? 0],
    ["Patients",       uroles.patient ?? 0],
    ["Administrateurs",adminTotal],
  ];

  return (
    <div>
      {/* ── Accès au Dashboard Global & Analytics (nouvelle vue, SuperAdmin uniquement) ── */}
      <div className="db-card fu" style={{ background:"linear-gradient(135deg,var(--dp),var(--db))", border:"none", marginBottom:20, cursor:"pointer" }} onClick={() => navigate("/analytics-global")}>
        <div style={{ padding:"16px 22px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:"rgba(255,255,255,.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>📊</div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:"#fff" }}>Dashboard Global &amp; Analytics</div>
              <div style={{ fontSize:11.5, color:"rgba(255,255,255,.75)" }}>Vue stratégique : finance, maternité, ordonnances, activité clinique</div>
            </div>
          </div>
          <span className="dbtn" style={{ background:"rgba(255,255,255,.18)", color:"#fff", border:"1.5px solid rgba(255,255,255,.3)" }}>Ouvrir →</span>
        </div>
      </div>

      {/* ── KPI principaux ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14, marginBottom:24 }}>
        <KpiCard color="blue"   icon="👥"    value={fmtNum(kpis.patients_total)}          label="Total patients"        sub="base active"           onClick={() => navigate("/patients")} />
        <KpiCard color="teal"   icon="📅"    value={kpis.rdv_auj ?? 0}                    label="RDV aujourd'hui"       sub={`${rdvStats.confirmes||0} confirmés`} onClick={() => navigate("/appointments")} />
        <KpiCard color="green"  icon="🩺"    value={kpis.consultations_auj ?? 0}          label="Consultations auj."   sub="aujourd'hui"           onClick={() => navigate("/consultations")} />
        <KpiCard color="orange" icon="🏥"    value={kpis.hospitalisations ?? 0}           label="Patients hospitalisés" sub="en cours"              onClick={() => navigate("/hospitalization")} />
        <KpiCard color="red"    icon="🚨"    value={kpis.urgences_en_cours ?? 0}          label="Urgences en cours"    urgent={kpis.urgences_en_cours > 0} onClick={() => navigate("/urgences")} />
        <KpiCard color="purple" icon="👨‍⚕️" value={kpis.users_connectes ?? 0}             label="Personnel connecté"   sub={`${kpis.users_total ?? 0} au total`} onClick={() => navigate("/administration")} />
        <KpiCard color="cyan"   icon="💰"    value={fmtNum(kpis.revenus_auj)+" CFA"}      label="Revenus du jour"                                   onClick={() => navigate("/finance")} />
        <KpiCard color="yellow" icon="📋"    value={fmtNum(kpis.factures_impayees)+" CFA"} label="Factures impayées"   urgent={kpis.factures_impayees > 0} onClick={() => navigate("/finance")} />
      </div>

      {/* ── Rendez-vous du jour + Consultations du jour ── */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20, marginBottom:20 }}>
        <div className="db-card">
          <div className="db-card-hdr">
            <div><h3>📅 Rendez-vous du jour</h3><p>{rdvStats.total} au total</p></div>
            <button className="dbtn dbtn-ghost dbtn-sm" onClick={() => navigate("/appointments")}>Voir tous →</button>
          </div>
          <div style={{ display:"flex", gap:8, padding:"10px 20px 0", flexWrap:"wrap" }}>
            <Badge cls="green">✅ {rdvStats.confirmes} confirmés</Badge>
            <Badge cls="orange">⏳ {rdvStats.en_attente} en attente</Badge>
            <Badge cls="gray">✓ {rdvStats.termines} terminés</Badge>
            <Badge cls="red">❌ {rdvStats.annules} annulés</Badge>
          </div>
          <div style={{ padding:"8px 0" }}>
            {rdvListe.length === 0 ? <div style={{ padding:"12px 20px" }}><Empty icon="📅" msg="Aucun rendez-vous aujourd'hui" /></div> : rdvListe.map((r,i)=>(
              <div key={i} className="rdv-item" style={{ padding:"10px 20px" }}>
                <div className="rdv-time">{r.heure}</div>
                <div className="rdv-dot" style={{ background:{ confirme:"#059669", en_attente:"#D97706", termine:"#9CA3AF", annule:"#DC2626" }[r.statut]||"#1B4F9E" }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--dn)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.patient} · {r.medecin}</div>
                  <div style={{ fontSize:11, color:"var(--dm)" }}>{r.service}</div>
                </div>
                <Badge cls={stRdv(r.statut)}>{lbRdv(r.statut)}</Badge>
              </div>
            ))}
          </div>
        </div>
        <div className="db-card">
          <div className="db-card-hdr">
            <div><h3>🩺 Consultations du jour</h3><p>{consultsListe.length} aujourd'hui</p></div>
            <button className="dbtn dbtn-ghost dbtn-sm" onClick={() => navigate("/consultations")}>Voir toutes →</button>
          </div>
          <div style={{ padding:"8px 0" }}>
            {consultsListe.length === 0 ? <div style={{ padding:"12px 20px" }}><Empty icon="🩺" msg="Aucune consultation aujourd'hui" /></div> : consultsListe.map((c,i)=>(
              <div key={i} className="rdv-item" style={{ padding:"10px 20px" }}>
                <div className="rdv-time">{c.heure}</div>
                <div className="rdv-dot" style={{ background:{ termine:"#059669", en_cours:"#0EA5A0", suspendue:"#D97706" }[c.statut]||"#9CA3AF" }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--dn)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.patient} · {c.medecin}</div>
                  <div style={{ fontSize:11, color:"var(--dm)" }}>{c.service}</div>
                </div>
                <Badge cls={c.statut==="termine"?"green":c.statut==="en_cours"?"teal":"orange"}>{c.statut==="termine"?"✅ Terminée":c.statut==="en_cours"?"🔄 En cours":"⏸ Suspendue"}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Vue médicale globale ── */}
      <div className="db-card">
        <div className="db-card-hdr"><h3>🏥 Vue médicale globale</h3><p>Aujourd'hui, par module</p></div>
        <div style={{ padding:16, display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(auto-fit,minmax(170px,1fr))", gap:12 }}>
          {vueGlobale.map((b) => (
            <div key={b.title} onClick={() => navigate(b.to)} style={{ border:"1.5px solid var(--dbr)", borderRadius:14, padding:"12px 14px", cursor:"pointer", transition:"all .2s" }}
                 onMouseEnter={(e)=>{e.currentTarget.style.borderColor="var(--dt)"; e.currentTarget.style.background="var(--dl)";}}
                 onMouseLeave={(e)=>{e.currentTarget.style.borderColor="var(--dbr)"; e.currentTarget.style.background="transparent";}}>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--dn)", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>{b.icon} {b.title}</div>
              {b.rows.map(([l,v]) => (
                <div key={l} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--dm)", marginBottom:3 }}>
                  <span>{l}</span><span style={{ fontWeight:700, color:"var(--dn)" }}>{v ?? 0}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Graphiques analytiques ── */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20, marginBottom:20, marginTop:20 }}>
        <div className="db-card">
          <div className="db-card-hdr"><div><h3>📈 Activité médicale — 7 jours</h3><p>Patients, consultations, RDV, hospitalisations</p></div></div>
          <div style={{ padding:20 }}>
            <LineChart height={200} labels={chartAct.labels} datasets={[
              { label:"Patients",       data:chartAct.patients,         borderColor:"#1B4F9E", backgroundColor:"rgba(27,79,158,.08)",  tension:.4, fill:false, pointRadius:3 },
              { label:"Consultations",  data:chartAct.consultations,    borderColor:"#0EA5A0", backgroundColor:"rgba(14,165,160,.08)", tension:.4, fill:false, pointRadius:3 },
              { label:"RDV",            data:chartAct.rdv,              borderColor:"#7C3AED", backgroundColor:"rgba(124,58,237,.08)", tension:.4, fill:false, pointRadius:3 },
              { label:"Hospitalisations", data:chartAct.hospitalisations, borderColor:"#D97706", backgroundColor:"rgba(217,119,6,.08)", tension:.4, fill:false, pointRadius:3, borderDash:[4,4] },
            ]}/>
          </div>
        </div>
        <div className="db-card">
          <div className="db-card-hdr"><div><h3>💰 Évolution financière — 12 mois</h3><p>CA vs Dépenses</p></div></div>
          <div style={{ padding:20 }}>
            <LineChart height={200} labels={chartFin.labels} datasets={[
              { label:"CA", data:chartFin.ca, borderColor:"#059669", backgroundColor:"rgba(5,150,105,.1)", tension:.4, fill:false, pointRadius:3, pointBackgroundColor:"#059669" },
              { label:"Dépenses", data:chartFin.dep, borderColor:"#DC2626", backgroundColor:"rgba(220,38,38,.08)", tension:.4, fill:false, borderDash:[4,4], pointRadius:2, pointBackgroundColor:"#DC2626" },
            ]}/>
          </div>
        </div>
      </div>

      {/* ── Utilisateurs par rôle + Alertes ── */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20, marginBottom:20 }}>
        <div className="db-card">
          <div className="db-card-hdr"><h3>👥 Utilisateurs par rôle</h3></div>
          <div style={{ padding:20 }}>
            <BarChart height={190} labels={roleBars.map(([l])=>l)} data={roleBars.map(([,v])=>v)}
              colors={["#1B4F9E","#0EA5A0","#059669","#D97706","#6366F1","#EAB308","#EC4899","#7C3AED","#DC2626"]} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 20px", marginTop:16 }}>
              {roleBars.map(([l,v]) => (
                <div key={l} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0", borderBottom:"1px solid #F3F7FF" }}>
                  <span style={{ color:"var(--dm)" }}>{l}</span><span style={{ fontWeight:700, color:"var(--dn)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="db-card">
          <div className="db-card-hdr"><h3>🔔 Alertes & Attention</h3></div>
          <div style={{ padding:14 }}>
            {alertes.length === 0 ? <Empty icon="✅" msg="Aucune alerte — tout est sous contrôle" /> : alertes.map((al,i)=>{
              const route = alertRoute(al.icon);
              return (
                <div key={i} className={`al-${al.type==="error"?"danger":al.type==="warn"?"warn":"info"}`}
                     style={{ marginBottom:10, display:"flex", gap:10, cursor:route?"pointer":"default" }}
                     onClick={route ? () => navigate(route) : undefined}>
                  <span>{al.type==="error"?"🔴":al.type==="warn"?"🟠":"🔵"}</span>
                  <div><div style={{ fontSize:12, fontWeight:600, color:"var(--dn)" }}>{al.msg}</div><div style={{ fontSize:10, color:"var(--dm)" }}>{al.heure}</div></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Surveillance système ── */}
      <div className="db-card">
        <div className="db-card-hdr"><h3>🖥️ Surveillance système</h3><p>Disque, CPU, RAM et sauvegardes ne sont pas encore instrumentés</p></div>
        <div style={{ padding:20 }}>
          <div className="stat-row">
            <div style={{ display:"flex", alignItems:"center", gap:10 }}><span>🗄️</span><span style={{ fontSize:13, fontWeight:600, color:"var(--dn)" }}>Base de données</span></div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div className={`sys-dot ${sys.db || "warn"}`} />
              <span style={{ fontSize:12, color:"var(--dm)" }}>{sys.db === "ok" ? "Opérationnelle" : "Problème détecté"}</span>
            </div>
          </div>
          <div className="stat-row">
            <div style={{ display:"flex", alignItems:"center", gap:10 }}><span>🔐</span><span style={{ fontSize:13, fontWeight:600, color:"var(--dn)" }}>Connexions échouées (aujourd'hui)</span></div>
            <Badge cls={connexions_echouees > 0 ? "orange" : "green"}>{connexions_echouees}</Badge>
          </div>
          <div className="stat-row">
            <div style={{ display:"flex", alignItems:"center", gap:10 }}><span>🔒</span><span style={{ fontSize:13, fontWeight:600, color:"var(--dn)" }}>Comptes suspendus</span></div>
            <Badge cls={comptes_bloques > 0 ? "orange" : "green"}>{comptes_bloques}</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ data, isMobile }) {
  const navigate = useNavigate();
  const kpis = data?.kpis || {}; const consults = data?.consults || {}; const hospit = data?.hospit || {};
  const chirurgie = data?.chirurgie || {}; const rdv = data?.rdv || {}; const pharma = data?.pharmacie || {};
  const pers = data?.personnel || {}; const alertes = data?.alertes || []; const rdvListe = data?.rdv_auj || [];
  const chart = data?.chart_semaine || { labels:[], consults:[], revenus:[] };
  const stRdv = (s) => ({ termine:"green", en_cours:"teal", en_attente:"orange", programme:"blue", annule:"red" }[s]||"gray");
  const lbRdv = (s) => ({ termine:"✅ Terminé", en_cours:"🔄 En cours", en_attente:"⏳ En attente", programme:"📅 Programmé", annule:"❌ Annulé" }[s]||s);
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
        <KpiCard color="blue"   icon="👥" value={kpis.patients_auj}     label="Patients du jour"    sub="enregistrés" />
        <KpiCard color="teal"   icon="📅" value={kpis.rdv_auj}          label="RDV du jour"         sub={`${rdv.confirmes||0} confirmés`} />
        <KpiCard color="green"  icon="🩺" value={kpis.consultations_auj} label="Consultations"      sub={`${consults.en_cours||0} en cours`} />
        <KpiCard color="orange" icon="🛏️" value={kpis.hospit_en_cours}   label="Hospitalisations"   sub={`${hospit.occupation_lits||0}% occupation`} />
        <KpiCard color="purple" icon="🧪" value={kpis.labo_auj}          label="Analyses labo"      sub="aujourd'hui" />
        <KpiCard color="cyan"   icon="💰" value={fmtNum(kpis.revenus_auj)+" CFA"} label="Revenus du jour" />
      </div>
      {alertes.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:12, marginBottom:20 }}>
          {alertes.map((al,i)=>(
            <div key={i} className={`al-${al.type==="error"?"danger":al.type==="warn"?"warn":"info"}`} style={{ display:"flex", gap:10 }}>
              <span style={{ fontSize:18 }}>{al.icon}</span>
              <div><div style={{ fontSize:12, fontWeight:700, color:"var(--dn)" }}>{al.msg}</div><div style={{ fontSize:10, color:"var(--dm)" }}>{al.heure}</div></div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20, marginBottom:20 }}>
        <div className="db-card">
          <div className="db-card-hdr"><div><h3>📈 Activité clinique — 7 jours</h3></div></div>
          <div style={{ padding:20 }}><LineChart height={180} labels={chart.labels} datasets={[{ label:"Consultations", data:chart.consults, borderColor:"#0EA5A0", backgroundColor:"rgba(14,165,160,.1)", tension:.4, fill:true, pointRadius:4, pointBackgroundColor:"#0EA5A0" }]}/></div>
        </div>
        <div className="db-card">
          <div className="db-card-hdr"><h3>📅 RDV du jour</h3></div>
          <div style={{ padding:"8px 0" }}>
            {rdvListe.length === 0 ? <Empty icon="📅" msg="Aucun RDV aujourd'hui" /> : rdvListe.map((r,i)=>(
              <div key={i} className="rdv-item" style={{ padding:"10px 20px" }}>
                <div className="rdv-time">{r.heure}</div>
                <div className="rdv-dot" style={{ background:{ termine:"#059669", en_cours:"#0EA5A0", en_attente:"#D97706", programme:"#1B4F9E", annule:"#DC2626" }[r.statut]||"#6B7A99" }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--dn)" }}>{r.patient}</div>
                  <div style={{ fontSize:11, color:"var(--dm)" }}>{r.type} · {r.medecin}</div>
                </div>
                <Badge cls={stRdv(r.statut)}>{lbRdv(r.statut)}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
        <div className="db-card">
          <div className="db-card-hdr"><h3>💊 Pharmacie</h3></div>
          <div style={{ padding:20 }}>
            {[["Stocks faibles",pharma.stock_faible,"orange","⚠️"],["Produits expirés",pharma.expires,"red","🚨"],["Commandes en attente",pharma.commandes_attente,"blue","📦"]].map(([l,v,c,ic])=>(
              <div key={l} className="stat-row">
                <div style={{ display:"flex", alignItems:"center", gap:8 }}><span>{ic}</span><span style={{ fontSize:12, color:"var(--dm)" }}>{l}</span></div>
                <Badge cls={c}>{v}</Badge>
              </div>
            ))}
          </div>
        </div>
        <div className="db-card">
          <div className="db-card-hdr"><h3>👔 Personnel présent</h3></div>
          <div style={{ padding:20 }}>
            {[["Médecins",pers.medecins_presents,"var(--db)","👨‍⚕️"],["Infirmiers",pers.infirmiers_presents,"var(--dt)","💉"],["Laborantins",pers.laborantins_presents,"var(--dg)","🔬"],["Administratifs",pers.admin_presents,"var(--dm)","📋"]].map(([l,v,c,ic])=>(
              <div key={l} className="stat-row">
                <div style={{ display:"flex", alignItems:"center", gap:8 }}><span>{ic}</span><span style={{ fontSize:12, color:"var(--dm)" }}>{l}</span></div>
                <span style={{ fontWeight:800, fontSize:16, color:c }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop:10, padding:"8px 10px", background:"#FFF7ED", borderRadius:8, fontSize:12, color:"var(--do)" }}>⚠ {pers.absents||0} absent(s) · {pers.conges||0} en congé</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MedecinDashboard({ data, user, isMobile }) {
  const kpis = data?.kpis || {}; const consults = data?.consults_auj || []; const hospit = data?.hospit_patients || [];
  const alertes = data?.alertes || []; const ia = data?.ia_stats || {};
  const stC = (s) => ({ termine:"green", en_cours:"teal", en_attente:"orange", programme:"blue" }[s]||"gray");
  const lbC = (s) => ({ termine:"✅ Terminé", en_cours:"🔄 En cours", en_attente:"⏳ Attente", programme:"📅 Programmé" }[s]||s);
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
        <KpiCard color="blue"   icon="👥" value={kpis.mes_patients}        label="Mes patients"      sub="dossiers actifs" />
        <KpiCard color="teal"   icon="🩺" value={kpis.mes_consults_auj}    label="Consultations auj." sub="programmées" />
        <KpiCard color="orange" icon="📅" value={kpis.mes_rdv_auj}         label="RDV du jour"       sub="confirmés" />
        <KpiCard color="green"  icon="💊" value={kpis.mes_ordonnances_auj}  label="Ordonnances"      sub="créées aujourd'hui" />
        <KpiCard color="purple" icon="🛏️" value={kpis.mes_hospit}          label="Hospitalisés"      sub="sous ma charge" />
        <KpiCard color="red"    icon="🔪" value={kpis.mes_chirurgies}      label="Chirurgies"        sub="ce mois" />
        <KpiCard color="orange" icon="🚑" value={kpis.mes_urgences ?? 0}   label="Urgences"          sub="sous ma responsabilité" />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
        <div className="db-card">
          <div className="db-card-hdr"><div><h3>📅 Mes consultations du jour</h3><p>{consults.length} patients</p></div></div>
          <div style={{ padding:"8px 0" }}>
            {consults.length === 0 ? <div style={{ padding:"12px 20px" }}><Empty icon="📅" msg="Aucune consultation aujourd'hui" /></div> : consults.map((c,i)=>(
              <div key={i} className="rdv-item" style={{ padding:"10px 20px" }}>
                <div className="rdv-time">{c.heure}</div>
                <div className="rdv-dot" style={{ background:{ termine:"#059669", en_cours:"#0EA5A0", en_attente:"#D97706", programme:"#1B4F9E" }[c.statut]||"#9CA3AF" }} />
                <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:13, fontWeight:600, color:"var(--dn)" }}>{c.patient}</div><div style={{ fontSize:11, color:"var(--dm)" }}>{c.motif}</div></div>
                <Badge cls={stC(c.statut)}>{lbC(c.statut)}</Badge>
              </div>
            ))}
          </div>
        </div>
        <div>
          {/* AUDIT-DASHBOARD — alertes (résultats labo critiques de mes
              patients, dashboard.controller.js::medecinStats) était calculé
              réellement mais jamais affiché ici. */}
          {alertes.length > 0 && (
            <div className="db-card" style={{ marginBottom:16 }}>
              <div className="db-card-hdr"><h3>🔔 Alertes — Résultats critiques</h3></div>
              <div style={{ padding:14 }}>
                {alertes.map((al,i)=>(
                  <div key={i} className="al-danger" style={{ marginBottom:10, display:"flex", gap:10 }}>
                    <span>🚨</span>
                    <div><div style={{ fontSize:12, fontWeight:700, color:"var(--dn)" }}>{al.msg}</div><div style={{ fontSize:10, color:"var(--dm)" }}>{al.heure}</div></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="db-card" style={{ marginBottom:16 }}>
            <div className="db-card-hdr"><h3>🛏️ Mes patients hospitalisés</h3></div>
            <div style={{ padding:16 }}>
              {hospit.length === 0 ? <Empty icon="🛏️" msg="Aucun patient hospitalisé sous votre charge" /> : hospit.map((h,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:i<hospit.length-1?"1px solid var(--dbr)":"" }}>
                  <div style={{ width:36, height:36, borderRadius:"50%", background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>👤</div>
                  <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:600, color:"var(--dn)" }}>{h.nom}</div><div style={{ fontSize:11, color:"var(--dm)" }}>Chambre {h.chambre} · J+{h.jours}</div></div>
                  <Badge cls="blue">🛏️ Hospitalisé</Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="db-card">
            <div className="db-card-hdr"><h3>🤖 IA — Mes statistiques</h3></div>
            <div style={{ padding:16 }}>
              {[["Diagnostics assistés",ia.diagnostics_assistes,"var(--dt)"],["Alertes risque",ia.alertes_risque,"var(--dr)"],["Interactions méd.",ia.interactions_detectees,"var(--do)"],["Taux précision IA",(ia.taux_precision||0)+"%","var(--dg)"]].map(([l,v,c])=>(
                <div key={l} className="stat-row"><span style={{ fontSize:12, color:"var(--dm)" }}>{l}</span><span style={{ fontWeight:700, color:c }}>{v}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ─── SAGE-FEMME DASHBOARD ───────────────────────────────────────
// ════════════════════════════════════════════════════════════════
// AUDIT-ADMIN-P1 — sage_femme retombait silencieusement sur la config et
// les raccourcis du rôle "patient" (fallback ROLE_CFG[role]||ROLE_CFG.patient
// à la ligne où rc est calculé) faute d'entrée dédiée, et n'affichait aucune
// carte KPI (aucune des branches du switch de rendu ne correspondait à ce
// rôle). Même structure que MedecinDashboard, alimentée par
// dashboard.controller.js::sageFemmeStats.
function SageFemmeDashboard({ data, isMobile }) {
  const kpis = data?.kpis || {};
  const cpnAuj = data?.cpn_auj || [];
  const risque = data?.grossesses_a_risque || [];
  const alertes = data?.alertes || [];
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
        <KpiCard color="purple" icon="🤰" value={kpis.mes_grossesses_suivies}  label="Grossesses suivies" sub="actives" />
        <KpiCard color="teal"   icon="👶" value={kpis.mes_accouchements_mois}  label="Accouchements"      sub="ce mois" />
        <KpiCard color="orange" icon="📋" value={kpis.cpn_aujourdhui}          label="CPN aujourd'hui"    sub="réalisées" />
        <KpiCard color="red"    icon="⚠️" value={kpis.patientes_risque_eleve}  label="Risque élevé"       sub="à surveiller" urgent={kpis.patientes_risque_eleve > 0} />
        <KpiCard color="blue"   icon="📅" value={kpis.accouchements_prevus_7j} label="Accouchements prévus" sub="sous 7 jours" />
        <KpiCard color="green"  icon="🍼" value={kpis.suivis_postnatal_actifs} label="Suivis postnatal"   sub="en cours" />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
        <div className="db-card">
          <div className="db-card-hdr"><div><h3>📋 CPN réalisées aujourd'hui</h3><p>{cpnAuj.length} consultation(s)</p></div></div>
          <div style={{ padding:"8px 0" }}>
            {cpnAuj.length === 0 ? <div style={{ padding:"12px 20px" }}><Empty icon="📋" msg="Aucune CPN réalisée aujourd'hui" /></div> : cpnAuj.map((c,i)=>(
              <div key={i} className="rdv-item" style={{ padding:"10px 20px" }}>
                <div className="rdv-time">{c.heure}</div>
                <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:13, fontWeight:600, color:"var(--dn)" }}>{c.patiente}</div><div style={{ fontSize:11, color:"var(--dm)" }}>Terme : {c.terme}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div>
          {alertes.length > 0 && (
            <div className="db-card" style={{ marginBottom:16 }}>
              <div className="db-card-hdr"><h3>🔔 Alertes — Grossesses à risque</h3></div>
              <div style={{ padding:14 }}>
                {alertes.map((al,i)=>(
                  <div key={i} className="al-danger" style={{ marginBottom:10, display:"flex", gap:10 }}>
                    <span>🚨</span>
                    <div style={{ fontSize:12, fontWeight:700, color:"var(--dn)" }}>{al.msg}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="db-card">
            <div className="db-card-hdr"><h3>⚠️ Grossesses à risque élevé</h3></div>
            <div style={{ padding:16 }}>
              {risque.length === 0 ? <Empty icon="✅" msg="Aucune grossesse à risque élevé sous votre suivi" /> : risque.map((g,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:i<risque.length-1?"1px solid var(--dbr)":"" }}>
                  <div style={{ width:36, height:36, borderRadius:"50%", background:"#FDF2F8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🤰</div>
                  <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:600, color:"var(--dn)" }}>{g.patiente}</div><div style={{ fontSize:11, color:"var(--dm)" }}>DPA : {g.dpa}</div></div>
                  <Badge cls="red">Risque {g.niveau_risque}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfirmierDashboard({ data, isMobile }) {
  const kpis = data?.kpis || {}; const alertes = data?.alertes || []; const planning = data?.planning || [];
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
        <KpiCard color="blue"   icon="🛏️" value={kpis.patients_surveilles}     label="Patients surveillés"  sub="sous ma charge" />
        <KpiCard color="teal"   icon="💉" value={kpis.soins_auj}               label="Soins du jour"        sub="effectués" />
        <KpiCard color="orange" icon="🌡️" value={kpis.temperatures_a_prendre}  label="Températures"         sub="à prendre" urgent />
        <KpiCard color="green"  icon="💊" value={kpis.medicaments_a_distribuer} label="Médicaments"          sub="à distribuer" />
        <KpiCard color="purple" icon="🩹" value={kpis.pansements}              label="Pansements"           sub="à effectuer" />
        <KpiCard color="red"    icon="📋" value={kpis.constantes_a_noter}      label="Constantes"           sub="à noter" />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
        <div className="db-card">
          <div className="db-card-hdr"><h3>📋 Planning du jour</h3></div>
          <div style={{ padding:"8px 0" }}>
            {planning.length === 0 ? (
              <div style={{ padding:"12px 20px" }}>
                <Empty icon="📋" msg="Plan de soins structuré non disponible — fonctionnalité pas encore implémentée" />
              </div>
            ) : planning.map((p,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 20px", borderBottom:i<planning.length-1?"1px solid var(--dbr)":"" }}>
                <div className="rdv-time">{p.heure}</div>
                <div style={{ width:22, height:22, borderRadius:"50%", background:p.fait?"#ECFDF5":"#F3F4F6", border:`2px solid ${p.fait?"#059669":"#D1D5DB"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>{p.fait?"✓":""}</div>
                <div style={{ flex:1, fontSize:13, color:p.fait?"var(--dm)":"var(--dn)", fontWeight:p.fait?400:600, textDecoration:p.fait?"line-through":"none" }}>{p.tache}</div>
                <Badge cls={p.fait?"green":"orange"}>{p.fait?"Fait":"À faire"}</Badge>
              </div>
            ))}
          </div>
        </div>
        <div className="db-card">
          <div className="db-card-hdr"><h3>🔔 Alertes patients</h3></div>
          <div style={{ padding:14 }}>
            {alertes.map((al,i)=>(
              <div key={i} className={`al-${al.type==="error"?"danger":al.type==="warn"?"warn":"info"}`} style={{ marginBottom:10, display:"flex", gap:10 }}>
                <span>{al.type==="error"?"🚨":"⚠️"}</span>
                <div><div style={{ fontSize:12, fontWeight:700, color:"var(--dn)" }}>{al.msg}</div><div style={{ fontSize:10, color:"var(--dm)" }}>{al.heure}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LaborantinDashboard({ data, isMobile }) {
  const navigate = useNavigate();
  const kpis = data?.kpis || {}; const urgentes = data?.analyses_urgentes || []; const alertes = data?.alertes || [];
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
        <KpiCard color="blue"   icon="🔬" value={kpis.analyses_auj}          label="Analyses du jour"      sub="total" />
        <KpiCard color="orange" icon="⏳" value={kpis.en_cours}              label="En cours"              sub="en labo" />
        <KpiCard color="green"  icon="✅" value={kpis.terminees}             label="Terminées"             sub="résultats dispo" />
        <KpiCard color="red"    icon="🚨" value={kpis.critiques}             label="Résultats critiques"   urgent sub="à notifier" />
        <KpiCard color="purple" icon="📋" value={kpis.en_attente_validation}  label="À valider"             sub="en attente" />
      </div>
      {alertes.map((al,i)=>(<div key={i} className={`al-${al.type==="error"?"danger":"warn"}`} style={{ marginBottom:10, display:"flex", gap:10 }}><span>{al.type==="error"?"🚨":"⚠️"}</span><div><div style={{ fontSize:12, fontWeight:700, color:"var(--dn)" }}>{al.msg}</div><div style={{ fontSize:10, color:"var(--dm)" }}>{al.heure}</div></div></div>))}
      <div className="db-card">
        <div className="db-card-hdr"><h3>🚨 Analyses urgentes</h3></div>
        {urgentes.length === 0 ? <div style={{ padding:20 }}><Empty icon="✅" msg="Aucune analyse urgente en attente" /></div> : (
          <div style={{ overflowX:"auto" }}>
            <table className="db-tbl">
              <thead><tr><th>Patient</th><th>Examen</th><th>Valeur</th><th>Statut</th><th>Action</th></tr></thead>
              <tbody>{urgentes.map((a,i)=>(<tr key={i} style={{ background:a.statut==="critique"?"#FEF2F2":"" }}><td style={{ fontWeight:600 }}>{a.patient}</td><td style={{ fontSize:12, color:"var(--dm)" }}>{a.examen}</td><td style={{ fontWeight:700, color:a.statut==="critique"?"var(--dr)":"var(--do)" }}>{a.valeur}</td><td><Badge cls={a.statut==="critique"?"red":a.statut==="anormal"?"orange":"yellow"}>{a.statut}</Badge></td>{/* Correction FE-BUG-014 — "🔔 Notifier" promettait une notification
    réelle au médecin prescripteur ; en réalité ce bouton n'a jamais fait
    que naviguer vers /laboratory (aucune action de notification n'est
    déclenchée). analyses_urgentes (dashboard.controller.js) ne renvoie
    d'ailleurs aucun _id de LabResult exploitable pour brancher une vraie
    notification depuis cette ligne sans changement de schéma de réponse,
    hors périmètre de cette correction. Libellé rendu honnête : ouvre
    simplement le module Laboratoire, où l'acquittement réel existe déjà. */}
<td><button className="dbtn dbtn-primary dbtn-sm" style={{ fontSize:11 }} onClick={()=>navigate("/laboratory")}>👁 Ouvrir</button></td></tr>))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PharmacienDashboard({ data, isMobile }) {
  const kpis = data?.kpis || {}; const alertes = data?.alertes || []; const topMeds = data?.top_meds || [];
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
        <KpiCard color="blue"   icon="💊" value={kpis.medicaments_total}  label="Références"         sub="médicaments actifs" />
        <KpiCard color="red"    icon="🚨" value={kpis.ruptures}           label="Ruptures de stock"  urgent={kpis.ruptures>0} />
        <KpiCard color="orange" icon="⚠️" value={kpis.stocks_faibles}     label="Stocks faibles"     sub="sous le seuil" />
        <KpiCard color="yellow" icon="⏰" value={kpis.expires}            label="Lots périmés"       urgent={kpis.expires>0} />
        <KpiCard color="teal"   icon="💉" value={kpis.dispensations_auj}  label="Dispensations auj." sub="ordonnances" />
        <KpiCard color="green"  icon="💰" value={fmtNum(kpis.ventes_auj)+" CFA"} label="Ventes du jour" />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
        <div className="db-card"><div className="db-card-hdr"><h3>🔔 Alertes pharmacie</h3></div><div style={{ padding:14 }}>{alertes.map((al,i)=>(<div key={i} className={`al-${al.type==="error"?"danger":al.type==="warn"?"warn":"info"}`} style={{ marginBottom:10, display:"flex", gap:10 }}><span>{al.type==="error"?"🚨":al.type==="warn"?"⚠️":"ℹ️"}</span><div><div style={{ fontSize:12, fontWeight:700, color:"var(--dn)" }}>{al.msg}</div><div style={{ fontSize:10, color:"var(--dm)" }}>{al.heure}</div></div></div>))}</div></div>
        <div className="db-card"><div className="db-card-hdr"><h3>💊 Top médicaments</h3></div><div style={{ padding:20 }}>{topMeds.length === 0 ? <Empty icon="💊" msg="Aucune dispensation sur les 7 derniers jours" /> : topMeds.map(([med,nb],i)=>(<div key={med} style={{ marginBottom:12 }}><div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}><span style={{ color:"var(--dm)", fontWeight:600 }}>{med}</span><span style={{ fontWeight:700 }}>{nb} u.</span></div><Prog pct={Math.round(nb/(topMeds[0]?.[1]||1)*100)} color={["var(--db)","var(--dt)","var(--dg)","var(--dp)"][i]||"var(--dm)"} /></div>))}</div></div>
      </div>
    </div>
  );
}

function ReceptionDashboard({ data, isMobile }) {
  const navigate = useNavigate();
  const kpis = data?.kpis || {}; const rdvListe = data?.rdv_prochains || [];
  const stR = (s) => ({ en_attente:"orange", confirme:"green", annule:"red" }[s]||"gray");
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:14, marginBottom:24 }}>
        <KpiCard color="blue"   icon="👥" value={kpis.patients_auj}      label="Patients du jour"  />
        <KpiCard color="green"  icon="✅" value={kpis.rdv_confirmes}     label="RDV confirmés"     sub="aujourd'hui" />
        <KpiCard color="orange" icon="⏳" value={kpis.en_attente}        label="En attente"        urgent sub="à confirmer" />
        <KpiCard color="red"    icon="❌" value={kpis.absents}           label="Patients absents"  />
        <KpiCard color="teal"   icon="📁" value={kpis.nouveaux_dossiers} label="Nouveaux dossiers" />
        <KpiCard color="purple" icon="💬" value={kpis.messages}          label="Messages"          sub="non lus" />
      </div>
      <div className="db-card">
        <div className="db-card-hdr"><div><h3>📅 Prochains rendez-vous</h3><p>{rdvListe.length} à venir</p></div></div>
        {rdvListe.length === 0 ? <div style={{ padding:20 }}><Empty icon="📅" msg="Aucun rendez-vous à venir" /></div> : (
          <div style={{ overflowX:"auto" }}>
            <table className="db-tbl">
              <thead><tr><th>Heure</th><th>Patient</th><th>Médecin</th><th>Type</th><th>Statut</th><th>Action</th></tr></thead>
              {/* Correction FE-BUG-014 — "Confirmer" et "📞" ne faisaient
                  tous deux que naviguer vers /appointments : aucune
                  confirmation de RDV ni aucun appel téléphonique réel
                  n'était déclenché (rdv_prochains, dashboard.controller.js,
                  ne renvoie même aucun numéro de téléphone ni _id de
                  rendez-vous exploitable depuis cette ligne). Les deux
                  boutons redondants sont remplacés par un unique bouton
                  honnête qui ouvre le module Rendez-vous, où la
                  confirmation réelle se fait déjà. */}
              <tbody>{rdvListe.map((r,i)=>(<tr key={i}><td style={{ fontWeight:700 }}>{r.heure}</td><td style={{ fontWeight:600 }}>{r.patient}</td><td style={{ fontSize:12, color:"var(--dm)" }}>{r.medecin}</td><td><Badge cls="blue">{r.type}</Badge></td><td><Badge cls={stR(r.statut)}>{r.statut==="en_attente"?"⏳ Attente":r.statut==="confirme"?"✅ Confirmé":"❌ Annulé"}</Badge></td><td><button className="dbtn dbtn-ghost dbtn-sm" style={{ fontSize:11 }} onClick={()=>navigate("/appointments")}>👁 Ouvrir</button></td></tr>))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ComptableDashboard({ data, isMobile }) {
  const kpis = data?.kpis || {}; const alertes = data?.alertes || []; const chart = data?.chart || { labels:[], revenus:[] };
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
        <KpiCard color="green"  icon="💰" value={fmtNum(kpis.revenus_auj)+" CFA"}    label="Revenus du jour"     />
        <KpiCard color="red"    icon="💸" value={fmtNum(kpis.depenses_auj)+" CFA"}   label="Dépenses du jour"    />
        <KpiCard color="teal"   icon="📈" value={fmtNum(kpis.benefice_auj)+" CFA"}   label="Bénéfice du jour"    />
        <KpiCard color="orange" icon="⏰" value={fmtNum(kpis.factures_imp)+" CFA"}   label="Factures impayées"   urgent />
        <KpiCard color="purple" icon="🏦" value={fmtNum(kpis.creances_assur)+" CFA"} label="Créances assurances" />
        <KpiCard color="blue"   icon="🧾" value={kpis.paiements_auj}                  label="Paiements du jour"   />
      </div>
      {alertes.map((al,i)=>(<div key={i} className={`al-${al.type==="error"?"danger":al.type==="warn"?"warn":"info"}`} style={{ marginBottom:10, display:"flex", gap:10 }}><span>{al.type==="error"?"🚨":al.type==="warn"?"⚠️":"ℹ️"}</span><div><div style={{ fontSize:12, fontWeight:700, color:"var(--dn)" }}>{al.msg}</div></div></div>))}
      <div className="db-card"><div className="db-card-hdr"><div><h3>📊 Revenus — 7 jours</h3></div></div><div style={{ padding:20 }}><BarChart labels={chart.labels} data={chart.revenus} height={180} /></div></div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ─── MAIN DASHBOARD ─────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════
export default function Dashboard() {
  let authData = null;
  try { authData = useAuth(); } catch {}
  const user     = authData?.user || { prenom:"Utilisateur", nom:"", role:"patient" };
  const navigate = useNavigate();

  const [stats, setStats]           = useState(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => { const fn = () => setIsMobile(window.innerWidth <= 599); window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn); }, []);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const role = user?.role || "patient";
  const rc   = ROLE_CFG[role] || ROLE_CFG.patient;

  // ── Socket.IO (temps réel) ───────────────────────────────────
  const { connected, activities } = useSocket();

  // ── Load dashboard data ──────────────────────────────────────
  // AUDIT — un dispatch Redux parallèle (fetchDashboardData) appelait le
  // MÊME endpoint que loadData() ci-dessous à chaque montage/changement de
  // rôle, sans jamais être rebranché sur le rafraîchissement temps réel
  // (polling/Socket.IO), et sans qu'aucun autre composant de l'app ne lise
  // jamais ce slice (vérifié par recherche exhaustive des sélecteurs) :
  // double appel réseau systématique pour un résultat jamais exploité
  // ailleurs. Retiré au profit du seul flux réellement complet (celui-ci),
  // qui gère déjà le repli portail patient, les erreurs et le temps réel.
  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let result;
      try {
        const { data } = await api.get(`/dashboard/${role}`);
        result = data.stats ?? data ?? {};
      } catch (specificErr) {
        if (specificErr?.response?.status === 404) {
          // ── Patient : utilise le portail patient si dispo ──
          if (role === "patient") {
            try {
              const { data } = await api.get("/portal/dashboard");
              result = data.stats ?? data ?? {};
            } catch {
              result = {};
            }
          } else {
            const { data } = await api.get("/dashboard");
            result = data.stats ?? data ?? {};
          }
        } else { throw specificErr; }
      }
      setStats(result);
    } catch (err) {
      setError(err?.response?.data?.message || "Impossible de charger les données.");
      setStats(null);
    } finally { setLoading(false); setLastUpdate(new Date()); }
  }, [role]);

  useEffect(() => { loadData(); }, [loadData]);

  // Polling de sécurité (30s) + refetch immédiat sur dashboard:refresh —
  // même hook partagé que le reste des pages (AUDIT-DASHBOARD : Dashboard.jsx
  // réimplémentait la même logique en inline, aucune différence de
  // comportement, juste dupliquée localement).
  useRealtimeRefresh(loadData);

  const quickActions = QUICK_ACTIONS[role] || QUICK_ACTIONS.patient;

  // ── Loading skeleton ─────────────────────────────────────────
  if (loading) return (
    <>
      <style>{CSS}</style>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
      <div className="db">
        <div style={{ background:"linear-gradient(135deg,#0B1E3B,#132744)", borderRadius:20, padding:"24px 28px", marginBottom:24, display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ width:60, height:60, borderRadius:16, background:"rgba(255,255,255,.08)" }} />
          <div style={{ flex:1 }}>
            <div style={{ width:120, height:12, background:"rgba(255,255,255,.1)", borderRadius:6, marginBottom:10 }} />
            <div style={{ width:220, height:18, background:"rgba(255,255,255,.15)", borderRadius:6 }} />
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
          {[1,2,3,4,5,6].map(i=>(<div key={i} style={{ background:"#fff", border:"1.5px solid #E2EAF4", borderRadius:18, padding:"18px 20px" }}><div style={{ width:42, height:42, borderRadius:10, background:"#F0F4FF", marginBottom:12 }} /><div style={{ width:"60%", height:22, background:"#F0F4FF", borderRadius:6 }} /></div>))}
        </div>
        <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:12, padding:20 }}>
          <div style={{ width:32, height:32, borderRadius:"50%", border:"3px solid #0EA5A0", borderTopColor:"transparent", animation:"spin 1s linear infinite" }} />
          <span style={{ color:"#6B7A99", fontSize:14, fontWeight:600 }}>Chargement…</span>
        </div>
      </div>
    </>
  );

  if (error && !stats) return (
    <>
      <style>{CSS}</style>
      <div className="db">
        <div style={{ background:"#fff", border:"1.5px solid #FECACA", borderRadius:20, padding:"48px 32px", textAlign:"center", maxWidth:500, margin:"0 auto" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
          <div style={{ fontSize:18, fontWeight:700, color:"#0B1E3B", marginBottom:10 }}>Impossible de charger les données</div>
          <div style={{ fontSize:14, color:"#6B7A99", marginBottom:24 }}>{error}</div>
          <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
            <button className="dbtn dbtn-primary" onClick={loadData}>🔄 Réessayer</button>
            <a href="/" className="dbtn dbtn-ghost">🏠 Accueil</a>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="db">

        {/* ── HERO WELCOME ── */}
        <div className="db-hero fu">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap", position:"relative", zIndex:2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:16 }}>
              <div style={{ width:60, height:60, borderRadius:16, background:`${rc.color}22`, border:`2px solid ${rc.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0 }}>
                {rc.icon}
              </div>
              <div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.6)", fontWeight:600, textTransform:"uppercase", letterSpacing:.5 }}>Bienvenue,</div>
                <div style={{ fontSize:22, fontWeight:700, color:"#fff", letterSpacing:-.3, marginTop:2 }}>
                  {role === "medecin" ? "Dr. " : ""}{user?.prenom} {user?.nom}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6, flexWrap:"wrap" }}>
                  <span className="role-crown" style={{ background:`linear-gradient(135deg,${rc.color},${rc.color}99)` }}>{rc.icon} {rc.label}</span>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,.5)" }}>· {todayFmt}</span>
                </div>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
              {/* ✅ Patient : pas de "Système opérationnel" — message personnalisé */}
              {role === "patient" ? (
                <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(14,165,160,.25)", border:"1px solid rgba(14,165,160,.4)", borderRadius:10, padding:"6px 14px" }}>
                  <span style={{ fontSize:14 }}>🏥</span>
                  <span style={{ fontSize:12, fontWeight:600, color:"#6EE7B7" }}>Portail patient</span>
                </div>
              ) : (
                <div style={{ display:"flex", alignItems:"center", gap:6, background: connected ? "rgba(5,150,105,.25)" : "rgba(107,122,153,.2)", border: connected ? "1px solid rgba(5,150,105,.4)" : "1px solid rgba(255,255,255,.15)", borderRadius:10, padding:"6px 14px" }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background: connected ? "#34D399" : "#9CA3AF", animation: connected ? "dbpulse 2s infinite" : "none" }} />
                  <span style={{ fontSize:12, fontWeight:600, color: connected ? "#6EE7B7" : "rgba(255,255,255,.5)" }}>{connected ? "Temps réel actif" : "Actualisation auto"}</span>
                </div>
              )}
              <button className="dbtn dbtn-ghost" style={{ color:"#fff", borderColor:"rgba(255,255,255,.3)", fontSize:12 }} onClick={loadData}>🔄 Actualiser</button>
              <div style={{ fontSize:11, color:"rgba(255,255,255,.4)" }}>
                {lastUpdate.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}
              </div>
            </div>
          </div>
        </div>

        {/* ── ROLE-BASED CONTENT ── */}
        {/* AUDIT-DASHBOARD-HIERARCHIE — ordre : état global (hero ci-dessus) →
            KPI/détail/analytique/alertes (propres à chaque rôle) → activité
            récente → actions rapides. Auparavant Actions rapides + Activité
            récente s'affichaient AVANT le contenu principal du rôle, ce qui
            reléguait les KPI (l'information la plus importante) après deux
            blocs génériques. Réordonnancement pur (mêmes composants, mêmes
            props, mêmes données) — s'applique uniformément aux 11 rôles
            (sage_femme ajouté, AUDIT-ADMIN-P1). */}
        <div className="fu d2">
          {role === "superadmin"     && <SuperAdminDashboard data={stats} isMobile={isMobile} />}
          {role === "adminclinique"  && <AdminDashboard data={stats} user={user} isMobile={isMobile} />}
          {role === "medecin"        && <MedecinDashboard data={stats} user={user} isMobile={isMobile} />}
          {role === "sage_femme"     && <SageFemmeDashboard data={stats} isMobile={isMobile} />}
          {role === "infirmier"      && <InfirmierDashboard data={stats} isMobile={isMobile} />}
          {role === "laborantin"     && <LaborantinDashboard data={stats} isMobile={isMobile} />}
          {role === "pharmacien"     && <PharmacienDashboard data={stats} isMobile={isMobile} />}
          {role === "receptionniste" && <ReceptionDashboard data={stats} isMobile={isMobile} />}
          {role === "comptable"      && <ComptableDashboard data={stats} isMobile={isMobile} />}
          {role === "radiologue"     && <RadiologueDashboard data={stats} isMobile={isMobile} />}
          {/* ✅ Patient — dashboard dédié, données personnelles uniquement */}
          {role === "patient"        && <PatientDashboard data={stats} user={user} isMobile={isMobile} />}
        </div>

        {/* ── ACTIVITÉ RÉCENTE (staff uniquement) — flux réel activity:new ── */}
        {role !== "patient" && (
          <div className="db-card fu d1" style={{ marginBottom:20 }}>
            <div className="db-card-hdr">
              <h3>
                <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:"#34D399", display:"inline-block", animation:"dbpulse 1.5s infinite" }} />
                  Activité récente
                </span>
              </h3>
              <p>{activities.length} événement{activities.length > 1 ? "s" : ""} récent{activities.length > 1 ? "s" : ""}</p>
            </div>
            {activities.length === 0 ? (
              <div style={{ padding:"20px 20px" }}><Empty icon="⚡" msg="Aucune activité récente." /></div>
            ) : (
              <div style={{ maxHeight:280, overflowY:"auto", padding:"10px 0" }}>
                {activities.slice(0, 10).map((a) => (
                  <div key={a.id} style={{ display:"flex", gap:12, padding:"10px 20px", animation:"fadeUp .3s ease both" }}>
                    <div className="pat-timeline-dot" style={{ marginTop:5 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", gap:10 }}>
                        <span style={{ fontSize:12, fontWeight:700, color:"#0B1E3B" }}>{a.icon ? `${a.icon} ` : ""}{a.action}</span>
                        <span style={{ fontSize:10.5, color:"#9CA3AF", flexShrink:0 }}>{new Date(a.timestamp).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" })}</span>
                      </div>
                      {a.detail && <div style={{ fontSize:11.5, color:"#374151", marginTop:2 }}>{a.detail}</div>}
                      {(a.module || a.userName) && (
                        <div style={{ fontSize:10.5, color:"#9CA3AF", marginTop:2, textTransform:"uppercase", letterSpacing:.3 }}>
                          {a.module || a.userName}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── QUICK ACTIONS ── */}
        <div className="db-card fu d1">
          <div className="db-card-hdr">
            <h3>⚡ {role === "patient" ? "Mon espace patient" : "Actions rapides"}</h3>
            <p>{role === "patient" ? "Accès à vos services de santé" : "Raccourcis vers les fonctions principales"}</p>
          </div>
          <div style={{ padding:16, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(118px,1fr))", gap:10 }}>
            {quickActions.map((qa, i) => (
              <button key={i} className="qa-btn" onClick={() => qa.to ? navigate(qa.to) : toast.error("Route non définie")}>
                <div className="qa-icon" style={{ background:qa.color }}>{qa.icon}</div>
                <span style={{ lineHeight:1.3 }}>{qa.label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}