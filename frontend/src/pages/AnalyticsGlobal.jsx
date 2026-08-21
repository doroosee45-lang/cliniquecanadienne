import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useRealtimeRefresh } from "../hooks/useRealtimeRefresh";
import api from "../api";

// ─── Chart.js loader (même mécanisme que Dashboard.jsx — idempotent, window.Chart partagé) ──
function loadChartJs(cb) {
  if (window.Chart) { cb(); return; }
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
  s.onload = cb;
  document.head.appendChild(s);
}

// ─── Style — même langage visuel que le Dashboard SuperAdmin déjà validé ──
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.ag * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
.ag {
  --dn:#0B1E3B; --dn2:#132744; --db:#1B4F9E; --dt:#0EA5A0; --dt2:#0D9490;
  --dr:#DC2626; --do:#D97706; --dg:#059669; --dp:#7C3AED;
  --dbr:#E2EAF4; --dm:#6B7A99; --dl:#EEF4FF; --ds:#F8FAFD;
  --sh:0 1px 3px rgba(11,30,59,.08); --shm:0 4px 16px rgba(11,30,59,.10);
}
.ag-hero { background:linear-gradient(135deg,var(--dn) 0%,var(--dn2) 60%,#1B4F9E 100%); border-radius:20px; padding:24px 28px; margin-bottom:24px; position:relative; overflow:hidden; }
.ag-hero::before { content:''; position:absolute; top:-60px; right:-60px; width:260px; height:260px; background:radial-gradient(circle,rgba(14,165,160,.2) 0%,transparent 70%); border-radius:50%; }
.ag-card { background:#fff; border:1.5px solid var(--dbr); border-radius:16px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; }
.ag-card:hover { box-shadow:var(--shm); }
.ag-card-hdr { padding:14px 18px; border-bottom:1.5px solid var(--dbr); display:flex; align-items:center; justify-content:space-between; gap:10px; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.ag-card-hdr h3 { font-size:13.5px; font-weight:700; color:var(--dn); margin:0; display:flex; align-items:center; gap:8px; }
.ag-card-hdr p { font-size:10.5px; color:var(--dm); margin:2px 0 0; }
.ag-section-title { font-size:15px; font-weight:800; color:var(--dn); display:flex; align-items:center; gap:8px; margin:28px 0 14px; }
.ag-section-title:first-child { margin-top:0; }
.ag-kpi { background:#fff; border:1.5px solid var(--dbr); border-radius:16px; padding:16px 18px; box-shadow:var(--sh); transition:all .2s; position:relative; overflow:hidden; }
.ag-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.ag-kpi-top { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
.ag-kpi-icon { width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
.ag-kpi-lbl { font-size:11px; font-weight:700; color:var(--dm); text-transform:uppercase; letter-spacing:.4px; }
.ag-kpi-val { font-size:24px; font-weight:800; color:var(--dn); letter-spacing:-.5px; line-height:1; margin-bottom:6px; }
.ag-kpi-unit { font-size:13px; font-weight:600; color:var(--dm); margin-left:4px; }
.ag-trend { font-size:11.5px; font-weight:700; display:inline-flex; align-items:center; gap:3px; padding:2px 8px; border-radius:99px; margin-bottom:8px; }
.ag-trend.up { color:var(--dg); background:#ECFDF5; }
.ag-trend.down { color:var(--dr); background:#FEF2F2; }
.ag-kpi-spark { height:32px; margin:4px 0; }
.ag-kpi-period { font-size:10px; color:#9CA3AF; }
.ag-stat-row { display:flex; align-items:center; justify-content:space-between; padding:9px 0; border-bottom:1px solid #F3F7FF; font-size:12.5px; }
.ag-stat-row:last-child { border-bottom:none; }
.ag-stat-row .l { color:var(--dm); }
.ag-stat-row .v { font-weight:700; color:var(--dn); }
.ag-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.ag-badge.red    { background:#FEF2F2; color:var(--dr); border:1px solid #FECACA; }
.ag-badge.orange { background:#FFF7ED; color:var(--do); border:1px solid #FED7AA; }
.ag-badge.green  { background:#ECFDF5; color:var(--dg); border:1px solid #A7F3D0; }
.ag-badge.blue   { background:#EFF6FF; color:var(--db); border:1px solid #BFDBFE; }
.ag-empty { text-align:center; padding:26px 16px; color:#9CA3AF; }
.ag-empty .ic { font-size:26px; margin-bottom:8px; }
.ag-empty .msg { font-size:12px; font-weight:600; }
.ag-filter-btn { padding:7px 16px; border-radius:10px; border:1.5px solid rgba(255,255,255,.25); background:rgba(255,255,255,.08); color:rgba(255,255,255,.75); font-size:12.5px; font-weight:600; cursor:pointer; transition:all .2s; font-family:'Poppins',sans-serif; }
.ag-filter-btn.active { background:var(--dt); border-color:var(--dt); color:#fff; }
.ag-filter-btn:hover:not(.active) { background:rgba(255,255,255,.15); color:#fff; }
.al-danger { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--dr); border-radius:12px; padding:12px 16px; }
.al-warn   { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--do); border-radius:12px; padding:12px 16px; }
@keyframes agpulse { 0%,100%{opacity:1} 50%{opacity:.4} }
`;

const fmtCFA = (n) => Number(n || 0).toLocaleString("fr-FR") + " CFA";

function Empty({ icon = "📭", msg = "Aucune donnée disponible pour cette période." }) {
  return <div className="ag-empty"><div className="ic">{icon}</div><div className="msg">{msg}</div></div>;
}

// ─── Sparkline (mini line chart, sans axes) ─────────────────────
function Sparkline({ data, color = "#1B4F9E" }) {
  const ref = useRef(null); const cRef = useRef(null);
  useEffect(() => {
    if (!data || data.length === 0) return;
    loadChartJs(() => {
      if (!ref.current) return;
      if (cRef.current) cRef.current.destroy();
      cRef.current = new window.Chart(ref.current, {
        type: "line",
        data: { labels: data.map((_, i) => i), datasets: [{ data, borderColor: color, backgroundColor: `${color}18`, tension: .4, fill: true, pointRadius: 0, borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, animation: false,
          plugins: { legend: { display: false }, tooltip: { enabled: true, displayColors: false, callbacks: { title: () => "" } } },
          scales: { x: { display: false }, y: { display: false } },
        },
      });
    });
    return () => { if (cRef.current) cRef.current.destroy(); };
  }, [data, color]);
  if (!data || data.length === 0) return null;
  return <div className="ag-kpi-spark"><canvas ref={ref} /></div>;
}

function LineChart({ labels, datasets, height = 190 }) {
  const ref = useRef(null); const cRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (cRef.current) cRef.current.destroy();
      cRef.current = new window.Chart(ref.current, {
        type: "line", data: { labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: true, interaction: { mode: "index", intersect: false },
          plugins: { legend: { display: datasets.length > 1, position: "top", labels: { font: { size: 11, family: "'Poppins',sans-serif" }, usePointStyle: true, boxWidth: 8 } }, tooltip: { backgroundColor: "#0B1E3B", padding: 12, cornerRadius: 10 } },
          scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#9CA3AF", autoSkip: true, maxRotation: 0, maxTicksLimit: 8 }, border: { display: false } }, y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.04)" }, ticks: { font: { size: 10 }, color: "#9CA3AF", precision: 0 }, border: { display: false } } },
        },
      });
    });
    return () => { if (cRef.current) cRef.current.destroy(); };
  }, [labels, datasets]);
  return <canvas ref={ref} style={{ maxHeight: height }} />;
}

function Donut({ labels, data, colors, height = 190 }) {
  const ref = useRef(null); const cRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (cRef.current) cRef.current.destroy();
      cRef.current = new window.Chart(ref.current, {
        type: "doughnut",
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: "#fff" }] },
        options: { responsive: true, maintainAspectRatio: true, cutout: "68%", plugins: { legend: { position: "bottom", labels: { font: { size: 11, family: "'Poppins',sans-serif" }, usePointStyle: true, boxWidth: 8, padding: 12 } }, tooltip: { backgroundColor: "#0B1E3B", padding: 10, cornerRadius: 10 } } },
      });
    });
    return () => { if (cRef.current) cRef.current.destroy(); };
  }, [labels, data, colors]);
  return <canvas ref={ref} style={{ maxHeight: height }} />;
}

// ─── Carte KPI professionnelle (icône, valeur, tendance réelle, sparkline) ──
function KpiPro({ icon, color, label, value, unit, trend, sparkline, onClick }) {
  return (
    <div className="ag-kpi" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <div className="ag-kpi-top">
        <div className="ag-kpi-icon" style={{ background: `${color}18`, color }}>{icon}</div>
        <span className="ag-kpi-lbl">{label}</span>
      </div>
      <div className="ag-kpi-val">{value}{unit && <span className="ag-kpi-unit">{unit}</span>}</div>
      {trend && (
        <div className={`ag-trend ${trend.sens === "up" ? "up" : trend.sens === "down" ? "down" : ""}`}>
          {trend.sens === "up" ? "↗" : trend.sens === "down" ? "↘" : "→"} {trend.pct > 0 ? "+" : ""}{trend.pct.toLocaleString("fr-FR")} %
        </div>
      )}
      {sparkline && sparkline.some((v) => v > 0) && <Sparkline data={sparkline} color={color} />}
      <div className="ag-kpi-period">7 derniers jours</div>
    </div>
  );
}

const PERIODES = [
  { key: "jour", label: "Aujourd'hui" },
  { key: "7j",   label: "7 jours" },
  { key: "30j",  label: "30 jours" },
  { key: "12m",  label: "12 mois" },
];

export default function AnalyticsGlobal() {
  const navigate = useNavigate();
  const [periode, setPeriode] = useState("7j");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await api.get("/analytics/global", { params: { periode } });
      setStats(data);
    } catch (err) {
      setError(err?.response?.data?.message || "Impossible de charger les données.");
      setStats(null);
    } finally { setLoading(false); setLastUpdate(new Date()); }
  }, [periode]);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeRefresh(loadData);

  if (loading && !stats) return (
    <>
      <style>{CSS}</style>
      <div className="ag">
        <div className="ag-hero" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: "rgba(255,255,255,.08)", animation: "agpulse 1.5s infinite" }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: 260, height: 16, background: "rgba(255,255,255,.12)", borderRadius: 6, marginBottom: 10, animation: "agpulse 1.5s infinite" }} />
            <div style={{ width: 180, height: 12, background: "rgba(255,255,255,.08)", borderRadius: 6, animation: "agpulse 1.5s infinite" }} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="ag-kpi">
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "#F0F4FF", marginBottom: 10, animation: "agpulse 1.5s infinite" }} />
              <div style={{ width: "70%", height: 24, background: "#F0F4FF", borderRadius: 6, marginBottom: 8, animation: "agpulse 1.5s infinite" }} />
              <div style={{ width: "40%", height: 32, background: "#F8FAFD", borderRadius: 6, animation: "agpulse 1.5s infinite" }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, padding: 30 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", border: "3px solid #0EA5A0", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
          <span style={{ color: "#6B7A99", fontSize: 14, fontWeight: 600 }}>Chargement…</span>
        </div>
        <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
      </div>
    </>
  );

  if (error && !stats) return (
    <>
      <style>{CSS}</style>
      <div className="ag">
        <div style={{ background: "#fff", border: "1.5px solid #FECACA", borderRadius: 20, padding: "48px 32px", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
          <div style={{ fontSize: 42, marginBottom: 14 }}>⚠️</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#0B1E3B", marginBottom: 8 }}>Impossible de charger les données</div>
          <div style={{ fontSize: 13, color: "#6B7A99", marginBottom: 20 }}>{error}</div>
          <button className="ag-filter-btn active" style={{ color: "#fff" }} onClick={loadData}>🔄 Réessayer</button>
        </div>
      </div>
    </>
  );

  const kpis = stats?.kpis || {};
  const fin = stats?.finance || {};
  const anl = stats?.analytics || {};
  const mat = stats?.maternite || {};
  const ord = stats?.ordonnances || {};
  const alertes = stats?.alertes || [];
  const periodLabel = PERIODES.find((p) => p.key === periode)?.label || "";

  return (
    <>
      <style>{CSS}</style>
      <div className="ag">
        {/* ── HERO + FILTRES ── */}
        <div className="ag-hero">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", position: "relative", zIndex: 2 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: -.3 }}>📊 Dashboard Global &amp; Analytics</div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.65)", marginTop: 4 }}>Vue stratégique de la Clinique Canadienne de Souanké · Actualisé {lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {PERIODES.map((p) => (
                <button key={p.key} className={`ag-filter-btn ${periode === p.key ? "active" : ""}`} onClick={() => setPeriode(p.key)}>{p.label}</button>
              ))}
              <button className="ag-filter-btn" onClick={loadData}>🔄</button>
            </div>
          </div>
        </div>

        {/* ── KPI GLOBAUX ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginBottom: 8 }}>
          <KpiPro icon="💰" color="#059669" label="Revenus" value={fmtCFA(kpis.revenus?.valeur)} trend={kpis.revenus?.trend} sparkline={kpis.revenus?.sparkline} onClick={() => navigate("/finance")} />
          <KpiPro icon="👥" color="#1B4F9E" label="Patients actifs" value={kpis.patients_actifs?.valeur ?? 0} trend={kpis.patients_actifs?.trend} sparkline={kpis.patients_actifs?.sparkline} onClick={() => navigate("/patients")} />
          <KpiPro icon="🩺" color="#0EA5A0" label="Consultations médicales" value={kpis.consultations?.valeur ?? 0} trend={kpis.consultations?.trend} sparkline={kpis.consultations?.sparkline} onClick={() => navigate("/consultations")} />
          <KpiPro icon="📅" color="#7C3AED" label="RDV réalisés" value={kpis.rdv_realises?.valeur ?? 0} trend={kpis.rdv_realises?.trend} sparkline={kpis.rdv_realises?.sparkline} onClick={() => navigate("/appointments")} />
        </div>

        {/* ── FINANCE GLOBALE + ANALYTICS CLINIQUE ── */}
        <div className="ag-section-title">💰 Finance globale <span style={{ fontWeight: 500, fontSize: 11, color: "var(--dm)" }}>— {periodLabel}</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18, marginBottom: 8 }}>
          <div className="ag-card">
            <div className="ag-card-hdr"><div><h3>📈 Revenus / Dépenses</h3><p>{periodLabel}</p></div>
              <button className="ag-badge blue" style={{ cursor: "pointer", border: "none" }} onClick={() => navigate("/finance")}>Voir Finance →</button>
            </div>
            <div style={{ padding: 18 }}>
              <LineChart height={180} labels={fin.evolution?.labels || []} datasets={[
                { label: "Revenus", data: fin.evolution?.revenus || [], borderColor: "#059669", backgroundColor: "rgba(5,150,105,.1)", tension: .4, fill: true, pointRadius: 3, pointBackgroundColor: "#059669" },
                { label: "Dépenses", data: fin.evolution?.depenses || [], borderColor: "#DC2626", backgroundColor: "rgba(220,38,38,.06)", tension: .4, fill: false, borderDash: [4, 4], pointRadius: 2, pointBackgroundColor: "#DC2626" },
              ]} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginTop: 16 }}>
                {[["Revenus", fin.revenus, "var(--dg)"], ["Dépenses", fin.depenses, "var(--dr)"], ["Bénéfice", fin.benefice, "var(--db)"]].map(([l, v, c]) => (
                  <div key={l} style={{ background: "#F8FAFD", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: "var(--dm)", fontWeight: 700, textTransform: "uppercase" }}>{l}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: c }}>{fmtCFA(v)}</div>
                  </div>
                ))}
              </div>
              <div className="ag-stat-row"><span className="l">Paiements reçus ({periodLabel})</span><span className="v">{fin.paiements_recus ?? 0}</span></div>
              <div className="ag-stat-row"><span className="l">Factures impayées</span><span className="v">{fin.factures_impayees_count ?? 0} — {fmtCFA(fin.factures_impayees_montant)}</span></div>
            </div>
          </div>
          <div className="ag-card">
            <div className="ag-card-hdr"><h3>🥯 Revenus par service</h3></div>
            <div style={{ padding: 18 }}>
              {fin.revenus_par_service ? <Donut labels={fin.revenus_par_service.labels} data={fin.revenus_par_service.data} colors={fin.revenus_par_service.colors} /> : <Empty icon="🥯" />}
            </div>
          </div>
        </div>

        <div className="ag-section-title">📊 Analytics clinique <span style={{ fontWeight: 500, fontSize: 11, color: "var(--dm)" }}>— {periodLabel}</span></div>
        <div className="ag-card" style={{ marginBottom: 8 }}>
          <div className="ag-card-hdr"><div><h3>📈 Activité clinique</h3><p>Patients, consultations, RDV, hospitalisations — {periodLabel}</p></div></div>
          <div style={{ padding: 18 }}>
            <LineChart height={190} labels={anl.evolution?.labels || []} datasets={[
              { label: "Patients", data: anl.evolution?.patients || [], borderColor: "#1B4F9E", backgroundColor: "rgba(27,79,158,.06)", tension: .4, fill: false, pointRadius: 3 },
              { label: "Consultations", data: anl.evolution?.consultations || [], borderColor: "#0EA5A0", backgroundColor: "rgba(14,165,160,.06)", tension: .4, fill: false, pointRadius: 3 },
              { label: "RDV", data: anl.evolution?.rdv || [], borderColor: "#7C3AED", backgroundColor: "rgba(124,58,237,.06)", tension: .4, fill: false, pointRadius: 3 },
              { label: "Hospitalisations", data: anl.evolution?.hospitalisations || [], borderColor: "#D97706", backgroundColor: "rgba(217,119,6,.06)", tension: .4, fill: false, pointRadius: 3, borderDash: [4, 4] },
            ]} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginTop: 16 }}>
              {[
                ["Nouveaux patients", anl.patients_nouveaux, () => navigate("/patients")],
                ["Patients actifs", anl.patients_actifs, () => navigate("/patients")],
                ["Consultations", anl.consultations, () => navigate("/consultations")],
                ["RDV", anl.rdv, () => navigate("/appointments")],
                ["Hospitalisations", anl.hospitalisations, () => navigate("/hospitalization")],
                ["Urgences", anl.urgences, () => navigate("/urgences")],
                ["Labo", anl.labo, () => navigate("/laboratory")],
                ["Imagerie", anl.imagerie, () => navigate("/radiology")],
              ].map(([l, v, onClick]) => (
                <div key={l} onClick={onClick} style={{ background: "#F8FAFD", borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}>
                  <div style={{ fontSize: 10, color: "var(--dm)", fontWeight: 700, textTransform: "uppercase" }}>{l}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "var(--dn)" }}>{v ?? 0}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── MATERNITÉ ── */}
        <div className="ag-section-title">👶 Maternité <span style={{ fontWeight: 500, fontSize: 11, color: "var(--dm)" }}>— {periodLabel}</span></div>
        <div className="ag-card" style={{ marginBottom: 8 }}>
          <div className="ag-card-hdr"><div><h3>🤰 Suivi maternité</h3><p>Données réelles — Pregnancy / Delivery</p></div>
            <button className="ag-badge blue" style={{ cursor: "pointer", border: "none" }} onClick={() => navigate("/maternite")}>Module maternité →</button>
          </div>
          <div style={{ padding: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 18 }}>
              {[
                ["👶", "Grossesses en cours", mat.grossesses_en_cours],
                ["🤰", "Femmes suivies", mat.femmes_suivies],
                ["🍼", "Naissances", mat.naissances],
                ["🏥", "Accouchements", mat.accouchements],
              ].map(([icon, l, v]) => (
                <div key={l} style={{ background: "#F0FDFC", borderRadius: 12, padding: "12px 14px", border: "1px solid #99F6E4" }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: "var(--dn)" }}>{v ?? 0}</div>
                  <div style={{ fontSize: 10.5, color: "var(--dm)", fontWeight: 600 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: mat.repartition_accouchement ? "2fr 1fr" : "1fr", gap: 18 }}>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--dn)", marginBottom: 8 }}>Évolution des accouchements — {periodLabel}</div>
                <LineChart height={150} labels={mat.evolution?.labels || []} datasets={[{ label: "Accouchements", data: mat.evolution?.accouchements || [], borderColor: "#0EA5A0", backgroundColor: "rgba(14,165,160,.1)", tension: .4, fill: true, pointRadius: 3, pointBackgroundColor: "#0EA5A0" }]} />
              </div>
              {mat.repartition_accouchement && (
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--dn)", marginBottom: 8 }}>Voie basse / Césarienne</div>
                  <Donut height={150} labels={mat.repartition_accouchement.labels} data={mat.repartition_accouchement.data} colors={mat.repartition_accouchement.colors} />
                </div>
              )}
            </div>
            <div className="ag-stat-row" style={{ marginTop: 10 }}><span className="l">Consultations prénatales ({periodLabel})</span><span className="v">{mat.consultations_prenatales ?? 0}</span></div>
            <div className="ag-stat-row"><span className="l">Hospitalisations maternité</span><span className="v" style={{ color: "#9CA3AF", fontWeight: 600 }}>{mat.hospitalisations_maternite === null ? "Donnée non disponible" : mat.hospitalisations_maternite}</span></div>
          </div>
        </div>

        {/* ── ORDONNANCES + ACTIVITÉ MÉDICALE (résumé) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18, marginBottom: 8 }}>
          <div className="ag-card">
            <div className="ag-card-hdr"><div><h3>💊 Ordonnances &amp; prescriptions</h3><p>{periodLabel}</p></div>
              <button className="ag-badge blue" style={{ cursor: "pointer", border: "none" }} onClick={() => navigate("/prescriptions")}>Voir ordonnances →</button>
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
                {[["Total", ord.total], ["Actives", ord.actives], ["Terminées", ord.terminees], [periodLabel, ord.periode_count]].map(([l, v]) => (
                  <div key={l} style={{ background: "#F8FAFD", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "var(--dn)" }}>{v ?? 0}</div>
                    <div style={{ fontSize: 9.5, color: "var(--dm)", fontWeight: 600 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--dn)", marginBottom: 8 }}>Ordonnances — évolution ({periodLabel})</div>
              <LineChart height={140} labels={ord.evolution?.labels || []} datasets={[{ label: "Ordonnances", data: ord.evolution?.data || [], borderColor: "#7C3AED", backgroundColor: "rgba(124,58,237,.1)", tension: .4, fill: true, pointRadius: 3, pointBackgroundColor: "#7C3AED" }]} />
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--dn)", marginBottom: 8 }}>Top médicaments prescrits</div>
                {ord.top_medicaments ? ord.top_medicaments.map(([med, nb], i) => (
                  <div key={med} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3 }}><span style={{ color: "var(--dm)", fontWeight: 600 }}>{med}</span><span style={{ fontWeight: 700 }}>{nb}</span></div>
                    <div style={{ background: "#EEF4FF", borderRadius: 99, height: 6, overflow: "hidden" }}><div style={{ width: `${Math.round((nb / (ord.top_medicaments[0][1] || 1)) * 100)}%`, height: "100%", background: ["#1B4F9E", "#0EA5A0", "#059669", "#D97706", "#7C3AED"][i] || "var(--dm)" }} /></div>
                  </div>
                )) : <Empty icon="💊" />}
              </div>
            </div>
          </div>

          {/* ── ALERTES ── */}
          <div className="ag-card">
            <div className="ag-card-hdr"><h3>⚠️ Alertes importantes</h3></div>
            <div style={{ padding: 14 }}>
              {alertes.length === 0 ? <Empty icon="✅" msg="Aucune alerte — tout est sous contrôle" /> : alertes.map((al, i) => {
                const route = { "🔬": "/laboratory", "💊": "/pharmacy", "💰": "/finance", "🚨": "/urgences" }[al.icon] || null;
                return (
                  <div key={i} className={`al-${al.type === "error" ? "danger" : "warn"}`} style={{ marginBottom: 10, display: "flex", gap: 10, cursor: route ? "pointer" : "default" }} onClick={route ? () => navigate(route) : undefined}>
                    <span>{al.type === "error" ? "🔴" : "🟠"}</span>
                    <div><div style={{ fontSize: 12, fontWeight: 700, color: "var(--dn)" }}>{al.msg}</div><div style={{ fontSize: 10, color: "var(--dm)" }}>{al.heure}</div></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
