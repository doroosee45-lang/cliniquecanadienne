import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function ResetPassword() {
  const { token }    = useParams();
  const navigate     = useNavigate();
  const { setUser }  = useAuth();

  const [form, setForm]       = useState({ password: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (form.password !== form.confirm) { setError('Les mots de passe ne correspondent pas.'); return; }

    setLoading(true);
    try {
      const { data } = await api.post(`/auth/reset-password/${token}`, { password: form.password });
      if (data.user) setUser(data.user);
      setSuccess(true);
      setTimeout(() => navigate('/'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Lien invalide ou expiré.');
    } finally {
      setLoading(false);
    }
  };

  const pStrength = () => {
    const p = form.password;
    if (!p) return { score: 0, label: '', color: '#E2EAF4' };
    let s = 0;
    if (p.length >= 6)  s++;
    if (p.length >= 10) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    if (s <= 1) return { score: s, label: 'Faible', color: '#DC2626' };
    if (s <= 3) return { score: s, label: 'Moyen',  color: '#D97706' };
    return { score: s, label: 'Fort',  color: '#059669' };
  };
  const strength = pStrength();

  const s = {
    page: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(145deg,#0B1E3B 0%,#132744 50%,#0D3060 100%)', padding:20, fontFamily:"'Poppins',sans-serif" },
    card: { background:'#fff', borderRadius:24, boxShadow:'0 24px 60px rgba(11,30,59,.25)', width:'100%', maxWidth:420, overflow:'hidden' },
    hdr:  { background:'linear-gradient(135deg,#0B1E3B 0%,#1B4F9E 100%)', padding:'28px 32px 22px', textAlign:'center' },
    body: { padding:'28px 32px 32px' },
    lbl:  { fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:6 },
    btn:  { width:'100%', padding:13, borderRadius:12, border:'none', background:'linear-gradient(135deg,#0B1E3B,#1B4F9E)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 16px rgba(27,79,158,.35)' },
  };

  const PwdInput = ({ name, placeholder, label }) => (
    <div style={{ marginBottom:16 }}>
      <label style={s.lbl}>{label}</label>
      <div style={{ position:'relative' }}>
        <div style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'#9CA3AF' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        </div>
        <input type={showPwd ? 'text' : 'password'} required placeholder={placeholder}
          value={form[name]} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
          style={{ width:'100%', padding:'11px 42px 11px 40px', borderRadius:10, border:'1.5px solid #E2EAF4', background:'#F8FAFD', fontSize:13, color:'#0B1E3B', outline:'none', boxSizing:'border-box' }}
          onFocus={e => e.target.style.borderColor='#0EA5A0'}
          onBlur={e  => e.target.style.borderColor='#E2EAF4'}
        />
        {name === 'password' && (
          <button type="button" onClick={() => setShowPwd(v => !v)}
            style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', padding:0 }}>
            {showPwd
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            }
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Header */}
        <div style={s.hdr}>
          <div style={{ width:52, height:52, borderRadius:14, background:'rgba(255,255,255,.15)', border:'2px solid rgba(255,255,255,.25)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
            </svg>
          </div>
          <div style={{ fontSize:17, fontWeight:800, color:'#fff' }}>Nouveau mot de passe</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,.55)', marginTop:2 }}>Clinique Canadienne · MediSync</div>
        </div>

        {/* Body */}
        <div style={s.body}>
          {success ? (
            <div style={{ textAlign:'center', padding:'10px 0' }}>
              <div style={{ fontSize:52, marginBottom:16 }}>✅</div>
              <h3 style={{ fontSize:18, fontWeight:800, color:'#0B1E3B', marginBottom:8 }}>Mot de passe modifié !</h3>
              <div style={{ background:'#ECFDF5', border:'1.5px solid #A7F3D0', borderRadius:12, padding:'14px 18px', fontSize:13, color:'#065F46' }}>
                Votre mot de passe a été réinitialisé avec succès. Vous allez être redirigé…
              </div>
            </div>
          ) : (
            <>
              <p style={{ fontSize:13, color:'#6B7A99', marginBottom:20, lineHeight:1.7 }}>
                Choisissez un nouveau mot de passe sécurisé pour votre compte.
              </p>

              <form onSubmit={handleSubmit}>
                <PwdInput name="password" placeholder="Nouveau mot de passe" label="Nouveau mot de passe"/>

                {/* Barre de force */}
                {form.password && (
                  <div style={{ marginTop:-10, marginBottom:14 }}>
                    <div style={{ display:'flex', gap:4, marginBottom:4 }}>
                      {[1,2,3,4,5].map(i => (
                        <div key={i} style={{ flex:1, height:4, borderRadius:4, background: i <= strength.score ? strength.color : '#E2EAF4', transition:'background .3s' }}/>
                      ))}
                    </div>
                    <div style={{ fontSize:11, color:strength.color, fontWeight:600 }}>Sécurité : {strength.label}</div>
                  </div>
                )}

                <PwdInput name="confirm" placeholder="Confirmer le mot de passe" label="Confirmer le mot de passe"/>

                {/* Critères */}
                <div style={{ background:'#F8FAFD', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:11, color:'#6B7A99' }}>
                  {[
                    [form.password.length >= 6, 'Minimum 6 caractères'],
                    [/[A-Z]/.test(form.password), 'Au moins une majuscule'],
                    [/[0-9]/.test(form.password), 'Au moins un chiffre'],
                    [form.password === form.confirm && form.confirm.length > 0, 'Les mots de passe correspondent'],
                  ].map(([ok, label]) => (
                    <div key={label} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                      <span style={{ color: ok ? '#059669' : '#D1D5DB', fontSize:13 }}>{ok ? '✓' : '○'}</span>
                      <span style={{ color: ok ? '#059669' : '#9CA3AF' }}>{label}</span>
                    </div>
                  ))}
                </div>

                {error && (
                  <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'10px 14px', fontSize:12, color:'#DC2626', marginBottom:14 }}>
                    ❌ {error}
                  </div>
                )}

                <button type="submit" disabled={loading} style={{ ...s.btn, opacity:loading?.7:1 }}>
                  {loading
                    ? <><span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,.3)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin .8s linear infinite', display:'inline-block' }}/> Réinitialisation...</>
                    : '🔑 Réinitialiser le mot de passe'}
                </button>
              </form>
            </>
          )}

          <div style={{ textAlign:'center', marginTop:20, paddingTop:16, borderTop:'1px solid #F3F4F6' }}>
            <Link to="/login" style={{ fontSize:13, color:'#1B4F9E', fontWeight:600, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6 }}>
              ← Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
