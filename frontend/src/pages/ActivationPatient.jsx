import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";

const PASSWORD_RULES = [
  { test: (v) => v.length >= 6, label: "Au moins 6 caractères" },
  { test: (v) => /[A-Z]/.test(v), label: "Au moins une majuscule" },
  { test: (v) => /[0-9]/.test(v), label: "Au moins un chiffre" },
];

export default function ActivationPatient() {
  const { token } = useParams();
  const navigate   = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | form | success | error
  const [info,   setInfo]   = useState({});
  const [password, setPassword]   = useState("");
  const [confirm,  setConfirm]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setInfo({ message: "Lien d'activation invalide." }); return; }

    api.get(`/patients/activate/${token}`)
      .then(({ data }) => {
        setStatus("form");
        setInfo({ prenom: data.prenom, nom: data.nom });
      })
      .catch((err) => {
        setStatus("error");
        setInfo({ message: err.response?.data?.message || "Lien d'activation invalide ou expiré." });
      });
  }, [token]);

  const rulesOk = PASSWORD_RULES.every(r => r.test(password));
  const matchOk = password.length > 0 && password === confirm;

  const submit = async (e) => {
    e.preventDefault();
    if (!rulesOk || !matchOk) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const { data } = await api.post(`/patients/activate/${token}`, { password });
      setStatus("success");
      setInfo({ prenom: data.prenom, nom: data.nom });
    } catch (err) {
      setSubmitError(err.response?.data?.message || "Erreur lors de l'activation. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  const s = {
    page: { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
            background:"linear-gradient(135deg,#0B1E3B 0%,#132744 60%,#1B4F9E 100%)", padding:24 },
    box:  { background:"#fff", borderRadius:20, padding:40, maxWidth:480, width:"100%",
            textAlign:"center", boxShadow:"0 24px 60px rgba(11,30,59,.25)" },
    logo: { fontSize:22, fontWeight:800, color:"#0B1E3B", marginBottom:4 },
    sub:  { fontSize:12, color:"#6B7A99", marginBottom:32 },
    ico:  { fontSize:64, lineHeight:1, marginBottom:20 },
    h:    { fontSize:20, fontWeight:700, color:"#0B1E3B", marginBottom:10 },
    p:    { fontSize:14, color:"#374151", lineHeight:1.7, marginBottom:24 },
    btn:  { display:"inline-block", background:"#0EA5A0", color:"#fff", textDecoration:"none",
            padding:"14px 32px", borderRadius:10, fontWeight:700, fontSize:14,
            cursor:"pointer", border:"none", fontFamily:"sans-serif", width:"100%" },
    err:  { background:"#FEF2F2", border:"1.5px solid #FECACA", borderRadius:12,
            padding:"16px 20px", color:"#DC2626", fontSize:13, marginBottom:20 },
    ok:   { background:"#ECFDF5", border:"1.5px solid #A7F3D0", borderRadius:12,
            padding:"16px 20px", color:"#065F46", fontSize:13, marginBottom:20 },
    input:{ width:"100%", padding:"12px 14px", borderRadius:10, border:"1.5px solid #E2EAF4",
            fontSize:14, marginBottom:10, fontFamily:"sans-serif", boxSizing:"border-box" },
    rules:{ textAlign:"left", fontSize:12, color:"#6B7A99", marginBottom:18, lineHeight:1.9 },
  };

  return (
    <div style={s.page}>
      <div style={s.box}>
        <div style={s.logo}>🏥 Clinique Canadienne</div>
        <div style={s.sub}>Portail patient · MediSync</div>

        {status === "loading" && (
          <>
            <div style={s.ico}>⏳</div>
            <div style={s.h}>Vérification en cours…</div>
            <div style={s.p}>Validation de votre lien d'activation, veuillez patienter.</div>
          </>
        )}

        {status === "form" && (
          <>
            <div style={s.ico}>🔐</div>
            <div style={s.h}>Bonjour {info.prenom} {info.nom} !</div>
            <div style={s.p}>Choisissez votre mot de passe pour activer votre compte et accéder au portail patient.</div>
            {submitError && <div style={s.err}>{submitError}</div>}
            <form onSubmit={submit} style={{ textAlign:"left" }}>
              <input
                type="password" placeholder="Mot de passe" value={password}
                onChange={(e) => setPassword(e.target.value)} style={s.input} autoFocus
              />
              <input
                type="password" placeholder="Confirmer le mot de passe" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} style={s.input}
              />
              <div style={s.rules}>
                {PASSWORD_RULES.map((r) => (
                  <div key={r.label} style={{ color: password.length === 0 ? "#6B7A99" : (r.test(password) ? "#059669" : "#DC2626") }}>
                    {password.length === 0 ? "•" : (r.test(password) ? "✓" : "✗")} {r.label}
                  </div>
                ))}
                <div style={{ color: confirm.length === 0 ? "#6B7A99" : (matchOk ? "#059669" : "#DC2626") }}>
                  {confirm.length === 0 ? "•" : (matchOk ? "✓" : "✗")} Les deux mots de passe correspondent
                </div>
              </div>
              <button type="submit" style={{ ...s.btn, opacity: (!rulesOk || !matchOk || submitting) ? 0.5 : 1, cursor: (!rulesOk || !matchOk || submitting) ? "not-allowed" : "pointer" }} disabled={!rulesOk || !matchOk || submitting}>
                {submitting ? "Activation..." : "✅ Activer mon compte"}
              </button>
            </form>
          </>
        )}

        {status === "success" && (
          <>
            <div style={s.ico}>✅</div>
            <div style={s.h}>Compte activé !</div>
            <div style={s.ok}>
              Bienvenue <strong>{info.prenom} {info.nom}</strong> !<br/>
              Votre dossier patient est maintenant actif.
            </div>
            <div style={s.p}>Vous pouvez désormais vous connecter au portail patient avec le mot de passe que vous venez de définir.</div>
            <button style={s.btn} onClick={() => navigate("/login")}>
              Se connecter au portail →
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div style={s.ico}>❌</div>
            <div style={s.h}>Lien invalide ou expiré</div>
            <div style={s.err}>{info.message}</div>
            <div style={s.p}>
              Le lien d'activation est valable <strong>24 heures</strong> après la création du dossier.
              Contactez la réception de la clinique pour recevoir un nouveau lien.
            </div>
            <button style={{ ...s.btn, background:"#1B4F9E" }} onClick={() => navigate("/login")}>
              Retour à l'accueil
            </button>
          </>
        )}
      </div>
    </div>
  );
}
