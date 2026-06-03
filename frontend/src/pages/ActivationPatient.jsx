import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";

export default function ActivationPatient() {
  const { token } = useParams();
  const navigate   = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [info,   setInfo]   = useState({});

  useEffect(() => {
    if (!token) { setStatus("error"); setInfo({ message: "Lien d'activation invalide." }); return; }

    api.get(`/patients/activate/${token}`)
      .then(({ data }) => {
        setStatus("success");
        setInfo({ prenom: data.prenom, nom: data.nom, message: data.message });
      })
      .catch((err) => {
        setStatus("error");
        setInfo({ message: err.response?.data?.message || "Lien d'activation invalide ou expiré." });
      });
  }, [token]);

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
            cursor:"pointer", border:"none", fontFamily:"sans-serif" },
    err:  { background:"#FEF2F2", border:"1.5px solid #FECACA", borderRadius:12,
            padding:"16px 20px", color:"#DC2626", fontSize:13, marginBottom:20 },
    ok:   { background:"#ECFDF5", border:"1.5px solid #A7F3D0", borderRadius:12,
            padding:"16px 20px", color:"#065F46", fontSize:13, marginBottom:20 },
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

        {status === "success" && (
          <>
            <div style={s.ico}>✅</div>
            <div style={s.h}>Compte activé !</div>
            <div style={s.ok}>
              Bienvenue <strong>{info.prenom} {info.nom}</strong> !<br/>
              Votre dossier patient est maintenant actif.
            </div>
            <div style={s.p}>
              Vous pouvez désormais vous connecter au portail patient avec le mot de passe temporaire
              reçu par email. <strong>Pensez à le changer dès votre première connexion.</strong>
            </div>
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
