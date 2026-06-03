import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { setError('Veuillez saisir votre adresse email.'); return; }
    setError(''); setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const inp = {
    width:'100%',
    padding:'13px 13px 13px 42px',
    borderRadius:12,
    border:'1.5px solid rgba(255,255,255,.12)',
    background:'rgba(255,255,255,.07)',
    fontSize:16,
    color:'#fff',
    outline:'none',
    boxSizing:'border-box',
    fontFamily:"'Poppins',sans-serif",
    transition:'border-color .2s, box-shadow .2s, background .2s',
    WebkitTextFillColor:'#fff',
  };

  const onFocus = (e) => {
    e.target.style.borderColor = '#0EA5A0';
    e.target.style.boxShadow   = '0 0 0 3px rgba(14,165,160,.18)';
    e.target.style.background  = 'rgba(255,255,255,.10)';
  };
  const onBlur = (e) => {
    e.target.style.borderColor = 'rgba(255,255,255,.12)';
    e.target.style.boxShadow   = 'none';
    e.target.style.background  = 'rgba(255,255,255,.07)';
  };

  return (
    <div style={{
      minHeight:'100vh',
      display:'flex',
      alignItems:'center',
      justifyContent:'center',
      background:'linear-gradient(145deg,#0B1E3B 0%,#132744 50%,#0B1E3B 100%)',
      padding:20,
      fontFamily:"'Poppins',sans-serif",
      position:'relative',
      overflow:'hidden',
    }}>

      {/* ── Décors cercles ── */}
      {[300,500,700].map((d,i) => (
        <div key={i} style={{ position:'absolute', top:'50%', left:'50%', width:d, height:d, borderRadius:'50%', border:`1px solid rgba(14,165,160,${.06-i*.015})`, transform:'translate(-50%,-50%)', pointerEvents:'none' }}/>
      ))}
      <div style={{ position:'absolute', top:-100, right:-100, width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,rgba(14,165,160,.13) 0%,transparent 70%)', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', bottom:-80, left:'15%', width:320, height:320, borderRadius:'50%', background:'radial-gradient(circle,rgba(27,79,158,.18) 0%,transparent 70%)', pointerEvents:'none' }}/>

      {/* ── Card verre sombre ── */}
      <div style={{
        background:'rgba(255,255,255,.06)',
        backdropFilter:'blur(20px)',
        WebkitBackdropFilter:'blur(20px)',
        borderRadius:24,
        border:'1.5px solid rgba(255,255,255,.12)',
        boxShadow:'0 24px 60px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.1)',
        width:'100%',
        maxWidth:420,
        overflow:'hidden',
        position:'relative',
        zIndex:2,
      }}>

        {/* Header */}
        <div style={{
          borderBottom:'1.5px solid rgba(255,255,255,.08)',
          padding:'26px 28px 20px',
          background:'rgba(14,165,160,.08)',
          textAlign:'center',
        }}>
          <div style={{ width:54, height:54, borderRadius:14, background:'rgba(255,255,255,.1)', border:'1.5px solid rgba(255,255,255,.18)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', boxShadow:'0 4px 16px rgba(0,0,0,.2)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:4 }}>
            <div style={{ width:3, height:18, borderRadius:2, background:'linear-gradient(to bottom,#0EA5A0,#1B4F9E)', flexShrink:0 }}/>
            <div style={{ fontSize:18, fontWeight:800, color:'#fff' }}>Mot de passe oublié</div>
          </div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.45)', fontWeight:600 }}>Clinique Canadienne · MediSync</div>
        </div>

        {/* Body */}
        <div style={{ padding:'26px 28px 30px' }}>
          {!sent ? (
            <>
              <p style={{ fontSize:13, color:'rgba(255,255,255,.55)', marginBottom:22, lineHeight:1.75 }}>
                Saisissez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </p>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom:18 }}>
                  <label style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,.55)', display:'block', marginBottom:7, letterSpacing:.3 }}>
                    Adresse email
                  </label>
                  <div style={{ position:'relative' }}>
                    <div style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,.35)', pointerEvents:'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    </div>
                    <input
                      type="email" required placeholder="votre@email.com"
                      value={email} onChange={e => setEmail(e.target.value)}
                      style={inp} onFocus={onFocus} onBlur={onBlur}
                    />
                  </div>
                </div>

                {error && (
                  <div style={{ background:'rgba(220,38,38,.15)', border:'1px solid rgba(220,38,38,.35)', borderRadius:10, padding:'10px 14px', fontSize:12, color:'#FCA5A5', marginBottom:16 }}>
                    ❌ {error}
                  </div>
                )}

                <button type="submit" disabled={loading} style={{
                  width:'100%', padding:'14px 20px', borderRadius:12, border:'none',
                  background:'linear-gradient(135deg,#0EA5A0,#1B4F9E)',
                  color:'#fff', fontSize:14, fontWeight:700,
                  cursor:loading ? 'not-allowed' : 'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  opacity:loading ? .7 : 1,
                  boxShadow:'0 4px 20px rgba(14,165,160,.35)',
                  transition:'opacity .2s, transform .15s',
                  fontFamily:"'Poppins',sans-serif",
                }}
                  onMouseOver={e => { if(!loading) e.currentTarget.style.transform='translateY(-1px)'; }}
                  onMouseOut={e  => { e.currentTarget.style.transform='none'; }}
                >
                  {loading
                    ? <><span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,.3)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin .8s linear infinite', display:'inline-block', flexShrink:0 }}/> Envoi en cours…</>
                    : '📧 Envoyer le lien de réinitialisation'
                  }
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign:'center', padding:'10px 0' }}>
              <div style={{ fontSize:52, marginBottom:16 }}>✉️</div>
              <h3 style={{ fontSize:18, fontWeight:800, color:'#fff', marginBottom:10 }}>Email envoyé !</h3>
              <div style={{ background:'rgba(5,150,105,.15)', border:'1.5px solid rgba(5,150,105,.35)', borderRadius:12, padding:'14px 18px', marginBottom:16, fontSize:13, color:'#6EE7B7', lineHeight:1.7 }}>
                Si l'adresse <strong style={{ color:'#fff' }}>{email}</strong> est enregistrée dans notre système, vous recevrez un email avec un lien de réinitialisation valable <strong style={{ color:'#fff' }}>1 heure</strong>.
              </div>
              <p style={{ fontSize:12, color:'rgba(255,255,255,.35)', lineHeight:1.7 }}>
                Vérifiez également vos spams.<br/>
                Le lien expire dans 1 heure.
              </p>
            </div>
          )}

          {/* Retour connexion */}
          <div style={{ textAlign:'center', marginTop:22, paddingTop:16, borderTop:'1px solid rgba(255,255,255,.08)' }}>
            <Link to="/login" style={{ fontSize:13, color:'#0EA5A0', fontWeight:600, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6, transition:'opacity .15s' }}
              onMouseOver={e => e.currentTarget.style.opacity='.75'}
              onMouseOut={e  => e.currentTarget.style.opacity='1'}
            >
              ← Retour à la connexion
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform:rotate(360deg) } }
        input::placeholder { color:rgba(255,255,255,.3) !important; }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0px 1000px rgba(19,39,68,.95) inset !important;
          -webkit-text-fill-color:#fff !important;
          caret-color:#fff;
        }
      `}</style>
    </div>
  );
}