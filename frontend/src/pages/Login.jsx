




// import { useState, useEffect } from 'react';
// import { useNavigate, Link } from 'react-router-dom';
// import { useAuth } from '../contexts/AuthContext';
// import { useGoogleLogin } from '@react-oauth/google';
// import axios from 'axios';
// import toast from 'react-hot-toast';

// // ─── Hook responsive ─────────────────────────────────────────
// function useIsMobile() {
//   const [mobile, setMobile] = useState(
//     typeof window !== 'undefined' ? window.innerWidth < 1024 : false
//   );
//   useEffect(() => {
//     const h = () => setMobile(window.innerWidth < 1024);
//     window.addEventListener('resize', h);
//     return () => window.removeEventListener('resize', h);
//   }, []);
//   return mobile;
// }

// // ─── Drapeaux SVG ────────────────────────────────────────────
// const FlagCongo = ({ size = 36 }) => (
//   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
//     <svg viewBox="0 0 30 20" width={size} height={Math.round(size * 0.67)}
//       style={{ borderRadius: 3, boxShadow: '0 1px 6px rgba(0,0,0,.4)', display: 'block' }}>
//       <polygon points="0,0 20,0 0,20"        fill="#009A44" />
//       <polygon points="20,0 30,0 10,20 0,20" fill="#FBDE4A" />
//       <polygon points="30,0 30,20 10,20"     fill="#DC241F" />
//     </svg>
//     <span style={{ fontSize: 9, color: 'rgba(255,255,255,.5)', fontWeight: 700, letterSpacing: .4 }}>CONGO</span>
//   </div>
// );

// const FlagCanada = ({ size = 36 }) => (
//   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
//     <svg viewBox="0 0 30 15" width={size} height={Math.round(size * 0.5)}
//       style={{ borderRadius: 3, boxShadow: '0 1px 6px rgba(0,0,0,.4)', display: 'block' }}>
//       <rect x="0"    y="0" width="7.5" height="15" fill="#D52B1E" />
//       <rect x="7.5"  y="0" width="15"  height="15" fill="#FFFFFF" />
//       <rect x="22.5" y="0" width="7.5" height="15" fill="#D52B1E" />
//       <polygon points="15,2 16,5.5 19.5,5.5 16.8,7.5 17.8,11 15,9 12.2,11 13.2,7.5 10.5,5.5 14,5.5" fill="#D52B1E" />
//       <rect x="14.1" y="11" width="1.8" height="2" fill="#D52B1E" />
//     </svg>
//     <span style={{ fontSize: 9, color: 'rgba(255,255,255,.5)', fontWeight: 700, letterSpacing: .4 }}>CANADA</span>
//   </div>
// );

// // ─── Icône Google ─────────────────────────────────────────────
// const GoogleIcon = () => (
//   <svg width="18" height="18" viewBox="0 0 24 24">
//     <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
//     <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
//     <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
//     <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
//   </svg>
// );

// const TESTIMONIALS = [
//   { initiales: 'AM', couleur: '#0EA5A0', nom: 'Amina Mouanda',   role: 'Patiente',           text: 'Un suivi médical exceptionnel. Le portail patient est très pratique.' },
//   { initiales: 'JN', couleur: '#1B4F9E', nom: 'Jean-Paul Ngoma', role: 'Patient hospitalisé', text: "L'équipe est professionnelle et le système rend tout transparent." },
//   { initiales: 'SC', couleur: '#7C3AED', nom: 'Sophie Célestin', role: 'Patiente',            text: 'Les rappels de rendez-vous par email sont très utiles. Excellent service.' },
// ];

// const FEATURES = [
//   { icon: '🏥', label: 'Gestion complète', desc: 'Patients, RDV, hospitalisations' },
//   { icon: '🤖', label: 'Intelligence IA',  desc: 'Aide au diagnostic clinique' },
//   { icon: '🔒', label: 'Sécurisé',         desc: 'JWT + rôles + audit complet' },
//   { icon: '📊', label: 'Analytics',        desc: 'Tableaux de bord en temps réel' },
// ];

// // ─── Composant Field ──────────────────────────────────────────
// function Field({ label, icon, children }) {
//   return (
//     <div style={{ marginBottom: 16 }}>
//       <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.55)', display: 'block', marginBottom: 7, letterSpacing: .3 }}>
//         {label}
//       </label>
//       <div style={{ position: 'relative' }}>
//         <div style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.35)', pointerEvents: 'none' }}>
//           {icon}
//         </div>
//         {children}
//       </div>
//     </div>
//   );
// }

// // ✅ Guard : récupère le clientId Vite — undefined si .env manquant
// const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// export default function Login() {
//   const isMobile = useIsMobile();
//   const [form, setForm]             = useState({ email: '', password: '' });
//   const [showPwd, setShowPwd]       = useState(false);
//   const [loading, setLoading]       = useState(false);
//   const [googleLoading, setGoogleLoading] = useState(false);

//   // ✅ fetchMe exposé depuis le contexte pour rafraîchir l'user après Google
//   const { login, fetchMe } = useAuth();
//   const navigate = useNavigate();

//   // ── Style input verre sombre ──
//   const inp = {
//     width: '100%',
//     padding: '13px 13px 13px 42px',
//     borderRadius: 12,
//     border: '1.5px solid rgba(255,255,255,.12)',
//     background: 'rgba(255,255,255,.07)',
//     fontSize: 16,
//     color: '#fff',
//     outline: 'none',
//     boxSizing: 'border-box',
//     fontFamily: "'Poppins',sans-serif",
//     transition: 'border-color .2s, box-shadow .2s, background .2s',
//     WebkitTextFillColor: '#fff',
//   };

//   const onFocus = (e) => {
//     e.target.style.borderColor = '#0EA5A0';
//     e.target.style.boxShadow   = '0 0 0 3px rgba(14,165,160,.18)';
//     e.target.style.background  = 'rgba(255,255,255,.10)';
//   };
//   const onBlur = (e) => {
//     e.target.style.borderColor = 'rgba(255,255,255,.12)';
//     e.target.style.boxShadow   = 'none';
//     e.target.style.background  = 'rgba(255,255,255,.07)';
//   };

//   // ── Connexion email / mot de passe ──
//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     if (!form.email || !form.password) { toast.error('Remplissez tous les champs.'); return; }
//     setLoading(true);
//     try {
//       await login(form.email, form.password);
//       toast.success('Connexion réussie !');
//       navigate('/');
//     } catch (err) {
//       toast.error(err.response?.data?.message || 'Email ou mot de passe incorrect.');
//     } finally { setLoading(false); }
//   };

//   // ── Connexion Google ──
//   // ✅ FIX PRINCIPAL : useGoogleLogin retourne directement la fonction trigger.
//   //    On NE l'appelle PAS ici — on l'assigne et on la passe à onClick.
//   const triggerGoogleLogin = useGoogleLogin({
//     onSuccess: async (tokenResponse) => {
//       setGoogleLoading(true);
//       try {
//         const res = await axios.post('/api/auth/google', {
//           access_token: tokenResponse.access_token,
//         });
//         const { token } = res.data;

//         // Stocker le token
//         sessionStorage.setItem('ms_token', token);
//         // ✅ Rafraîchir l'user dans le contexte via fetchMe
//         await fetchMe();

//         toast.success('Connexion Google réussie !');
//         navigate('/');
//       } catch (err) {
//         toast.error(err.response?.data?.message || 'Erreur lors de la connexion Google.');
//       } finally {
//         setGoogleLoading(false);
//       }
//     },
//     onError: (err) => {
//       console.error('Google OAuth error:', err);
//       toast.error('Erreur de connexion Google. Veuillez réessayer.');
//       setGoogleLoading(false);
//     },
//   });

//   // ── Style bouton principal ──
//   const btnPrimary = {
//     width: '100%',
//     padding: '14px 20px',
//     borderRadius: 12,
//     border: 'none',
//     background: loading
//       ? 'rgba(14,165,160,.5)'
//       : 'linear-gradient(135deg,#0EA5A0 0%,#0d9488 100%)',
//     color: '#fff',
//     fontSize: 14,
//     fontWeight: 700,
//     cursor: loading ? 'not-allowed' : 'pointer',
//     display: 'flex',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 8,
//     transition: 'all .2s',
//     fontFamily: "'Poppins',sans-serif",
//     boxShadow: '0 4px 16px rgba(14,165,160,.3)',
//     marginBottom: 14,
//   };

//   // ── Style bouton Google ──
//   const btnGoogle = {
//     width: '100%',
//     padding: '13px 20px',
//     borderRadius: 12,
//     border: '1.5px solid rgba(255,255,255,.12)',
//     background: googleLoading ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.07)',
//     color: '#fff',
//     fontSize: 13,
//     fontWeight: 600,
//     cursor: googleLoading ? 'not-allowed' : 'pointer',
//     display: 'flex',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 10,
//     transition: 'all .2s',
//     fontFamily: "'Poppins',sans-serif",
//   };

//   return (
//     <div style={{
//       minHeight: '100vh',
//       fontFamily: "'Poppins',sans-serif",
//       background: 'linear-gradient(145deg,#0B1E3B 0%,#132744 50%,#0B1E3B 100%)',
//       display: 'flex',
//       position: 'relative',
//       overflow: 'hidden',
//     }}>

//       {/* ── Décor global ── */}
//       {[300, 500, 700].map((d, i) => (
//         <div key={i} style={{ position: 'absolute', top: '50%', left: '50%', width: d, height: d, borderRadius: '50%', border: `1px solid rgba(14,165,160,${.06 - i * .015})`, transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />
//       ))}
//       <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(14,165,160,.13) 0%,transparent 70%)', pointerEvents: 'none' }} />
//       <div style={{ position: 'absolute', bottom: -80, left: '15%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle,rgba(27,79,158,.18) 0%,transparent 70%)', pointerEvents: 'none' }} />
//       <div style={{ position: 'absolute', top: '30%', left: '-5%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,rgba(14,165,160,.08) 0%,transparent 70%)', pointerEvents: 'none' }} />

//       {/* ══════ PANNEAU GAUCHE — desktop ══════ */}
//       {!isMobile && (
//         <div style={{ flex: '0 0 54%', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '44px 52px', zIndex: 2 }}>
//           <div>
//             <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 }}>
//               <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(14,165,160,.2)', border: '1.5px solid rgba(14,165,160,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(14,165,160,.25)', flexShrink: 0 }}>
//                 <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
//                   <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
//                 </svg>
//               </div>
//               <div style={{ flex: 1, minWidth: 0 }}>
//                 <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: -.3 }}>Clinique Canadienne</div>
//                 <div style={{ fontSize: 12, color: '#0EA5A0', fontWeight: 600 }}>de Souanké · Congo</div>
//               </div>
//               <div style={{ display: 'flex', gap: 10 }}>
//                 <FlagCongo size={34} /><FlagCanada size={34} />
//               </div>
//             </div>

//             <h2 style={{ fontSize: 34, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 12 }}>
//               Système d'information<br />
//               <span style={{ color: '#0EA5A0' }}>hospitalier</span> moderne
//             </h2>
//             <p style={{ fontSize: 14, color: 'rgba(255,255,255,.55)', marginBottom: 28, lineHeight: 1.7 }}>
//               Gestion complète de votre établissement avec l'intelligence artificielle au service de vos patients.
//             </p>

//             <div style={{ display: 'grid', gridTemplateColumns: isMobile?'1fr':'1fr 1fr', gap: 10 }}>
//               {FEATURES.map(f => (
//                 <div key={f.label} style={{ background: 'rgba(255,255,255,.05)', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(255,255,255,.08)', backdropFilter: 'blur(4px)' }}>
//                   <div style={{ fontSize: 20, marginBottom: 6 }}>{f.icon}</div>
//                   <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{f.label}</div>
//                   <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{f.desc}</div>
//                 </div>
//               ))}
//             </div>
//           </div>

//           {/* Témoignages */}
//           <div>
//             <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Ce que disent nos patients</div>
//             <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
//               {TESTIMONIALS.map((t, i) => (
//                 <div key={i} style={{ background: 'rgba(255,255,255,.05)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,.07)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
//                   <div style={{ width: 36, height: 36, borderRadius: 9, background: `${t.couleur}33`, border: `2px solid ${t.couleur}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: t.couleur, flexShrink: 0 }}>{t.initiales}</div>
//                   <div style={{ flex: 1, minWidth: 0 }}>
//                     <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{t.nom}</div>
//                     <div style={{ fontSize: 10, color: '#0EA5A0', margin: '1px 0 3px' }}>{t.role}</div>
//                     <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', lineHeight: 1.45 }}>"{t.text}"</div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ══════ PANNEAU DROIT — formulaire ══════ */}
//       <div style={{
//         flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
//         padding: isMobile ? '16px 12px 32px' : '24px 28px',
//         zIndex: 2, overflowY: 'auto',
//       }}>
//         <div style={{ width: '100%', maxWidth: isMobile ? 440 : 420 }}>

//           {/* ── Contenu mobile uniquement ── */}
//           {isMobile && (
//             <div style={{ marginBottom: 24 }}>
//               <div style={{ textAlign: 'center', marginBottom: 20 }}>
//                 <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(14,165,160,.2)', border: '1.5px solid rgba(14,165,160,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 12px 32px rgba(14,165,160,.3)' }}>
//                   <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
//                     <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
//                   </svg>
//                 </div>
//                 <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -.3, marginBottom: 4 }}>Clinique Canadienne</div>
//                 <div style={{ fontSize: 13, color: '#0EA5A0', fontWeight: 600, marginBottom: 16 }}>de Souanké · Système MediSync</div>
//                 <div style={{ display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'flex-start' }}>
//                   <FlagCongo size={40} /><FlagCanada size={40} />
//                 </div>
//               </div>

//               <div style={{ textAlign: 'center', marginBottom: 18, padding: '0 4px' }}>
//                 <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.3, marginBottom: 8 }}>
//                   Système d'information<br /><span style={{ color: '#0EA5A0' }}>hospitalier</span> moderne
//                 </h2>
//                 <p style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', lineHeight: 1.6, margin: 0 }}>
//                   Gestion complète avec l'intelligence artificielle au service de vos patients.
//                 </p>
//               </div>

//               <div style={{ display: 'grid', gridTemplateColumns: isMobile?'1fr':'1fr 1fr', gap: 8, marginBottom: 16 }}>
//                 {FEATURES.map(f => (
//                   <div key={f.label} style={{ background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,.09)' }}>
//                     <div style={{ fontSize: 18, marginBottom: 5 }}>{f.icon}</div>
//                     <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{f.label}</div>
//                     <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', lineHeight: 1.4 }}>{f.desc}</div>
//                   </div>
//                 ))}
//               </div>

//               <div>
//                 <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 10 }}>Ce que disent nos patients</div>
//                 <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
//                   {TESTIMONIALS.map((t, i) => (
//                     <div key={i} style={{ background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,.09)', minWidth: 210, flexShrink: 0 }}>
//                       <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
//                         <div style={{ width: 32, height: 32, borderRadius: 8, background: `${t.couleur}33`, border: `2px solid ${t.couleur}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: t.couleur, flexShrink: 0 }}>{t.initiales}</div>
//                         <div>
//                           <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{t.nom}</div>
//                           <div style={{ fontSize: 9, color: '#0EA5A0' }}>{t.role}</div>
//                         </div>
//                       </div>
//                       <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', lineHeight: 1.5 }}>"{t.text}"</div>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* ── Card verre sombre ── */}
//           <div style={{
//             background: 'rgba(255,255,255,.06)',
//             backdropFilter: 'blur(20px)',
//             WebkitBackdropFilter: 'blur(20px)',
//             borderRadius: 24,
//             border: '1.5px solid rgba(255,255,255,.12)',
//             boxShadow: '0 24px 60px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.1)',
//             overflow: 'hidden',
//             position: 'relative',
//           }}>

//             {/* Header card */}
//             <div style={{ borderBottom: '1.5px solid rgba(255,255,255,.08)', padding: '26px 28px 20px', background: 'rgba(14,165,160,.08)', textAlign: 'center' }}>
//               {isMobile && (
//                 <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 8 }}>
//                   <FlagCongo size={28} /><FlagCanada size={28} />
//                 </div>
//               )}
//               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
//                 <div style={{ width: 3, height: 20, borderRadius: 2, background: 'linear-gradient(to bottom,#0EA5A0,#1B4F9E)', flexShrink: 0 }} />
//                 <div style={{ fontSize: isMobile ? 17 : 18, fontWeight: 800, color: '#fff' }}>
//                   {isMobile ? 'Connexion' : 'Connexion à MediSync'}
//                 </div>
//               </div>
//               <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', fontWeight: 600 }}>
//                 Accédez à votre espace de travail sécurisé
//               </div>
//             </div>

//             {/* Corps du formulaire */}
//             <div style={{ padding: '26px 28px 28px' }}>

//               {/* ── Bouton Google ── */}
//               {/* ✅ Désactivé + message clair si VITE_GOOGLE_CLIENT_ID absent */}
//               <button
//                 type="button"
//                 onClick={GOOGLE_CLIENT_ID ? triggerGoogleLogin : undefined}
//                 disabled={googleLoading || !GOOGLE_CLIENT_ID}
//                 title={!GOOGLE_CLIENT_ID ? 'VITE_GOOGLE_CLIENT_ID manquant dans .env' : ''}
//                 style={{
//                   ...btnGoogle,
//                   opacity: !GOOGLE_CLIENT_ID ? 0.4 : 1,
//                   cursor: !GOOGLE_CLIENT_ID ? 'not-allowed' : googleLoading ? 'not-allowed' : 'pointer',
//                 }}
//                 onMouseOver={e => { if (!googleLoading && GOOGLE_CLIENT_ID) { e.currentTarget.style.background = 'rgba(255,255,255,.12)'; e.currentTarget.style.borderColor = 'rgba(14,165,160,.5)'; } }}
//                 onMouseOut={e  => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.12)'; }}
//               >
//                 {googleLoading
//                   ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .8s linear infinite' }} />
//                   : <GoogleIcon />
//                 }
//                 {googleLoading
//                   ? 'Connexion en cours…'
//                   : !GOOGLE_CLIENT_ID
//                     ? 'Google OAuth non configuré'
//                     : 'Continuer avec Google'
//                 }
//               </button>

//               {/* Séparateur */}
//               <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
//                 <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.1)' }} />
//                 <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', fontWeight: 700, letterSpacing: .8, textTransform: 'uppercase' }}>ou avec vos identifiants</span>
//                 <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.1)' }} />
//               </div>

//               {/* ── Formulaire email / mot de passe ── */}
//               <form onSubmit={handleSubmit}>
//                 {/* Email */}
//                 <Field label="Adresse email" icon={
//                   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
//                 }>
//                   <input
//                     type="email"
//                     required
//                     placeholder="votre@email.com"
//                     value={form.email}
//                     onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
//                     autoComplete="email"
//                     style={inp}
//                     onFocus={onFocus}
//                     onBlur={onBlur}
//                   />
//                 </Field>

//                 {/* Mot de passe */}
//                 <Field label="Mot de passe" icon={
//                   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
//                 }>
//                   <input
//                     type={showPwd ? 'text' : 'password'}
//                     required
//                     placeholder="••••••••"
//                     value={form.password}
//                     onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
//                     autoComplete="current-password"
//                     style={{ ...inp, padding: '13px 44px 13px 42px' }}
//                     onFocus={onFocus}
//                     onBlur={onBlur}
//                   />
//                   <button
//                     type="button"
//                     onClick={() => setShowPwd(v => !v)}
//                     style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', padding: 4, display: 'flex' }}
//                   >
//                     {showPwd
//                       ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
//                       : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
//                     }
//                   </button>
//                 </Field>

//                 {/* Mot de passe oublié */}
//                 <div style={{ textAlign: 'right', marginBottom: 20, marginTop: -6 }}>
//                   <Link to="/forgot-password" style={{ fontSize: 12, color: '#0EA5A0', fontWeight: 600, textDecoration: 'none' }}>
//                     Mot de passe oublié ?
//                   </Link>
//                 </div>

//                 {/* Bouton connexion principale */}
//                 <button type="submit" disabled={loading} style={btnPrimary}>
//                   {loading
//                     ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .8s linear infinite' }} />
//                     : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
//                   }
//                   {loading ? 'Connexion en cours…' : 'Se connecter'}
//                 </button>
//               </form>

//               {/* Footer */}
//               <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 18, lineHeight: 1.7 }}>
//                 En vous connectant, vous acceptez les conditions<br />d'utilisation de la Clinique Canadienne de Souanké.
//               </p>
//             </div>
//           </div>

//           {/* Copyright */}
//           <div style={{ textAlign: 'center', marginTop: 20 }}>
//             <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>© 2025 Clinique Canadienne de Souanké</span>
//           </div>
//         </div>
//       </div>

//       <style>{`
//         @keyframes spin { to { transform: rotate(360deg); } }
//         input::placeholder { color: rgba(255,255,255,.3) !important; }
//         input:-webkit-autofill {
//           -webkit-box-shadow: 0 0 0 100px rgba(11,30,59,.8) inset !important;
//           -webkit-text-fill-color: #fff !important;
//         }
//       `}</style>
//     </div>
//   );
// }




import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';
import api from '../api';
import toast from 'react-hot-toast';

// ─── Hook responsive ─────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 1024);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return mobile;
}

// ─── Drapeaux SVG ────────────────────────────────────────────
const FlagCongo = ({ size = 36 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
    <svg viewBox="0 0 30 20" width={size} height={Math.round(size * 0.67)}
      style={{ borderRadius: 3, boxShadow: '0 1px 6px rgba(0,0,0,.4)', display: 'block' }}>
      <polygon points="0,0 20,0 0,20"        fill="#009A44" />
      <polygon points="20,0 30,0 10,20 0,20" fill="#FBDE4A" />
      <polygon points="30,0 30,20 10,20"     fill="#DC241F" />
    </svg>
    <span style={{ fontSize: 9, color: 'rgba(255,255,255,.5)', fontWeight: 700, letterSpacing: .4 }}>CONGO</span>
  </div>
);

const FlagCanada = ({ size = 36 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
    <svg viewBox="0 0 30 15" width={size} height={Math.round(size * 0.5)}
      style={{ borderRadius: 3, boxShadow: '0 1px 6px rgba(0,0,0,.4)', display: 'block' }}>
      <rect x="0"    y="0" width="7.5" height="15" fill="#D52B1E" />
      <rect x="7.5"  y="0" width="15"  height="15" fill="#FFFFFF" />
      <rect x="22.5" y="0" width="7.5" height="15" fill="#D52B1E" />
      <polygon points="15,2 16,5.5 19.5,5.5 16.8,7.5 17.8,11 15,9 12.2,11 13.2,7.5 10.5,5.5 14,5.5" fill="#D52B1E" />
      <rect x="14.1" y="11" width="1.8" height="2" fill="#D52B1E" />
    </svg>
    <span style={{ fontSize: 9, color: 'rgba(255,255,255,.5)', fontWeight: 700, letterSpacing: .4 }}>CANADA</span>
  </div>
);

// ─── Icône Google ─────────────────────────────────────────────
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

// ─── Données ─────────────────────────────────────────────────
const TESTIMONIALS = [
  { initiales: 'AM', couleur: '#0EA5A0', nom: 'Amina Mouanda',   role: 'Patiente',           text: 'Un suivi médical exceptionnel. Le portail patient est très pratique.' },
  { initiales: 'JN', couleur: '#1B4F9E', nom: 'Jean-Paul Ngoma', role: 'Patient hospitalisé', text: "L'équipe est professionnelle et le système rend tout transparent." },
  { initiales: 'SC', couleur: '#7C3AED', nom: 'Sophie Célestin', role: 'Patiente',            text: 'Les rappels de rendez-vous par email sont très utiles. Excellent service.' },
];

const FEATURES = [
  { icon: '🏥', label: 'Gestion complète', desc: 'Patients, RDV, hospitalisations' },
  { icon: '🤖', label: 'Intelligence IA',  desc: 'Aide au diagnostic clinique' },
  { icon: '🔒', label: 'Sécurisé',         desc: 'JWT + rôles + audit complet' },
  { icon: '📊', label: 'Analytics',        desc: 'Tableaux de bord en temps réel' },
];

// Photos de l'équipe soignante (Unsplash — libres de droit)
const TEAM = [
  {
    url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=120&h=120&fit=crop&crop=faces&auto=format&q=80',
    nom: 'Dr. Amina K.',
    role: 'Médecin chef',
  },
  {
    url: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=120&h=120&fit=crop&crop=faces&auto=format&q=80',
    nom: 'Inf. Marie B.',
    role: 'Infirmière',
  },
  {
    url: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=120&h=120&fit=crop&crop=faces&auto=format&q=80',
    nom: 'Dr. Jean M.',
    role: 'Chirurgien',
  },
  {
    url: 'https://images.unsplash.com/photo-1638202993928-7267aad84c31?w=120&h=120&fit=crop&crop=faces&auto=format&q=80',
    nom: 'Inf. Claire D.',
    role: 'Infirmière',
  },
];

// URL photo de clinique en arrière-plan (Unsplash)
const BG_CLINIC_URL =
  'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1800&auto=format&q=75';

// ─── Composant Field ──────────────────────────────────────────
function Field({ label, icon, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.55)', display: 'block', marginBottom: 7, letterSpacing: .3 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.35)', pointerEvents: 'none' }}>
          {icon}
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Composant AvatarPhoto ────────────────────────────────────
function AvatarPhoto({ member, size = 72 }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: '2.5px solid rgba(14,165,160,.6)',
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: '0 4px 16px rgba(0,0,0,.45)',
        background: 'rgba(14,165,160,.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {!imgError ? (
          <img
            src={member.url}
            alt={member.nom}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: size * 0.35, fontWeight: 800, color: '#0EA5A0' }}>
            {member.nom.split(' ').map(w => w[0]).join('').slice(0, 2)}
          </span>
        )}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: size > 60 ? 11 : 10, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>{member.nom}</div>
        <div style={{ fontSize: size > 60 ? 9 : 8, color: '#0EA5A0', fontWeight: 600 }}>{member.role}</div>
      </div>
    </div>
  );
}

// ✅ Guard : récupère le clientId Vite — undefined si .env manquant
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function Login() {
  const isMobile = useIsMobile();
  const [form, setForm]                   = useState({ email: '', password: '' });
  const [showPwd, setShowPwd]             = useState(false);
  const [loading, setLoading]             = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [bgLoaded, setBgLoaded]           = useState(false);

  const { login, fetchMe } = useAuth();
  const navigate = useNavigate();

  // Préchargement de l'image de fond
  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.src = BG_CLINIC_URL;
  }, []);

  // ── Style input verre sombre ──
  const inp = {
    width: '100%',
    padding: '13px 13px 13px 42px',
    borderRadius: 12,
    border: '1.5px solid rgba(255,255,255,.12)',
    background: 'rgba(255,255,255,.07)',
    fontSize: 16,
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: "'Poppins',sans-serif",
    transition: 'border-color .2s, box-shadow .2s, background .2s',
    WebkitTextFillColor: '#fff',
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

  // ── Connexion email / mot de passe ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error('Remplissez tous les champs.'); return; }
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Connexion réussie !');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Email ou mot de passe incorrect.');
    } finally { setLoading(false); }
  };

  // ── Connexion Google ──
  const triggerGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        const res = await api.post('/auth/google', {
          access_token: tokenResponse.access_token,
        });
        const { token } = res.data;
        sessionStorage.setItem('ms_token', token);
        await fetchMe();
        toast.success('Connexion Google réussie !');
        navigate('/');
      } catch (err) {
        toast.error(err.response?.data?.message || 'Erreur lors de la connexion Google.');
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: (err) => {
      console.error('Google OAuth error:', err);
      toast.error('Erreur de connexion Google. Veuillez réessayer.');
      setGoogleLoading(false);
    },
  });

  // ── Style bouton principal ──
  const btnPrimary = {
    width: '100%',
    padding: '14px 20px',
    borderRadius: 12,
    border: 'none',
    background: loading
      ? 'rgba(14,165,160,.5)'
      : 'linear-gradient(135deg,#0EA5A0 0%,#0d9488 100%)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: loading ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'all .2s',
    fontFamily: "'Poppins',sans-serif",
    boxShadow: '0 4px 16px rgba(14,165,160,.3)',
    marginBottom: 14,
  };

  // ── Style bouton Google ──
  const btnGoogle = {
    width: '100%',
    padding: '13px 20px',
    borderRadius: 12,
    border: '1.5px solid rgba(255,255,255,.12)',
    background: googleLoading ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.07)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: googleLoading ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    transition: 'all .2s',
    fontFamily: "'Poppins',sans-serif",
  };

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: "'Poppins',sans-serif",
      display: 'flex',
      position: 'relative',
      overflow: 'hidden',
      background: '#0B1E3B',
    }}>

      {/* ══════ FOND PHOTO CLINIQUE ══════ */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        backgroundImage: bgLoaded ? `url(${BG_CLINIC_URL})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center 30%',
        backgroundRepeat: 'no-repeat',
        transition: 'opacity .8s ease',
        opacity: bgLoaded ? 1 : 0,
      }} />

      {/* Overlay gradient sombre pour lisibilité */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        background: isMobile
          ? 'linear-gradient(160deg, rgba(8,22,50,0.97) 0%, rgba(11,30,59,0.95) 100%)'
          : 'linear-gradient(100deg, rgba(8,22,50,0.96) 0%, rgba(11,30,59,0.92) 45%, rgba(9,20,46,0.85) 100%)',
      }} />

      {/* ── Décor cercles ── */}
      {[300, 500, 700].map((d, i) => (
        <div key={i} style={{ position: 'absolute', top: '50%', left: '50%', width: d, height: d, borderRadius: '50%', border: `1px solid rgba(14,165,160,${.06 - i * .015})`, transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 1 }} />
      ))}
      <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(14,165,160,.10) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 1 }} />
      <div style={{ position: 'absolute', bottom: -80, left: '15%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle,rgba(27,79,158,.15) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 1 }} />

      {/* ══════ PANNEAU GAUCHE — desktop ══════ */}
      {!isMobile && (
        <div style={{
          flex: '0 0 54%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '44px 52px',
          zIndex: 2,
        }}>
          {/* ── Logo + titre ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(14,165,160,.2)', border: '1.5px solid rgba(14,165,160,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(14,165,160,.25)', flexShrink: 0 }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: -.3 }}>Clinique Canadienne</div>
                <div style={{ fontSize: 12, color: '#0EA5A0', fontWeight: 600 }}>de Souanké · Congo</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <FlagCongo size={34} /><FlagCanada size={34} />
              </div>
            </div>

            <h2 style={{ fontSize: 34, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 12 }}>
              Système d'information<br />
              <span style={{ color: '#0EA5A0' }}>hospitalier</span> moderne
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.55)', marginBottom: 28, lineHeight: 1.7 }}>
              Gestion complète de votre établissement avec l'intelligence artificielle au service de vos patients.
            </p>

            {/* Features */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile?'1fr':'1fr 1fr', gap: 10, marginBottom: 28 }}>
              {FEATURES.map(f => (
                <div key={f.label} style={{ background: 'rgba(255,255,255,.05)', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(255,255,255,.08)', backdropFilter: 'blur(4px)' }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{f.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{f.label}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{f.desc}</div>
                </div>
              ))}
            </div>

            {/* ── Section équipe soignante ── */}
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>
                Notre équipe soignante
              </div>
              <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                {TEAM.map((m, i) => (
                  <AvatarPhoto key={i} member={m} size={72} />
                ))}
              </div>
            </div>
          </div>

          {/* ── Témoignages ── */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
              Ce que disent nos patients
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TESTIMONIALS.map((t, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,.05)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,.07)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: `${t.couleur}33`, border: `2px solid ${t.couleur}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: t.couleur, flexShrink: 0 }}>{t.initiales}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{t.nom}</div>
                    <div style={{ fontSize: 10, color: '#0EA5A0', margin: '1px 0 3px' }}>{t.role}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', lineHeight: 1.45 }}>"{t.text}"</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════ PANNEAU DROIT — formulaire ══════ */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '16px 12px 32px' : '24px 28px',
        zIndex: 2,
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: isMobile ? 440 : 420 }}>

          {/* ── Contenu mobile uniquement ── */}
          {isMobile && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(14,165,160,.2)', border: '1.5px solid rgba(14,165,160,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 12px 32px rgba(14,165,160,.3)' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                  </svg>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -.3, marginBottom: 4 }}>Clinique Canadienne</div>
                <div style={{ fontSize: 13, color: '#0EA5A0', fontWeight: 600, marginBottom: 16 }}>de Souanké · Système MediSync</div>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'flex-start' }}>
                  <FlagCongo size={40} /><FlagCanada size={40} />
                </div>
              </div>

              <div style={{ textAlign: 'center', marginBottom: 18, padding: '0 4px' }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.3, marginBottom: 8 }}>
                  Système d'information<br /><span style={{ color: '#0EA5A0' }}>hospitalier</span> moderne
                </h2>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', lineHeight: 1.6, margin: 0 }}>
                  Gestion complète avec l'intelligence artificielle au service de vos patients.
                </p>
              </div>

              {/* Features mobile */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile?'1fr':'1fr 1fr', gap: 8, marginBottom: 20 }}>
                {FEATURES.map(f => (
                  <div key={f.label} style={{ background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,.09)' }}>
                    <div style={{ fontSize: 18, marginBottom: 5 }}>{f.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{f.label}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', lineHeight: 1.4 }}>{f.desc}</div>
                  </div>
                ))}
              </div>

              {/* ── Équipe soignante mobile ── */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 12 }}>
                  Notre équipe soignante
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {TEAM.map((m, i) => (
                    <AvatarPhoto key={i} member={m} size={56} />
                  ))}
                </div>
              </div>

              {/* Témoignages mobile */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 10 }}>
                  Ce que disent nos patients
                </div>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                  {TESTIMONIALS.map((t, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,.09)', minWidth: 210, flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${t.couleur}33`, border: `2px solid ${t.couleur}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: t.couleur, flexShrink: 0 }}>{t.initiales}</div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{t.nom}</div>
                          <div style={{ fontSize: 9, color: '#0EA5A0' }}>{t.role}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', lineHeight: 1.5 }}>"{t.text}"</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Card verre sombre ── */}
          <div style={{
            background: 'rgba(255,255,255,.06)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 24,
            border: '1.5px solid rgba(255,255,255,.12)',
            boxShadow: '0 24px 60px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.1)',
            overflow: 'hidden',
            position: 'relative',
          }}>

            {/* Header card */}
            <div style={{ borderBottom: '1.5px solid rgba(255,255,255,.08)', padding: '26px 28px 20px', background: 'rgba(14,165,160,.08)', textAlign: 'center' }}>
              {isMobile && (
                <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 8 }}>
                  <FlagCongo size={28} /><FlagCanada size={28} />
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 3, height: 20, borderRadius: 2, background: 'linear-gradient(to bottom,#0EA5A0,#1B4F9E)', flexShrink: 0 }} />
                <div style={{ fontSize: isMobile ? 17 : 18, fontWeight: 800, color: '#fff' }}>
                  {isMobile ? 'Connexion' : 'Connexion à MediSync'}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', fontWeight: 600 }}>
                Accédez à votre espace de travail sécurisé
              </div>
            </div>

            {/* Corps du formulaire */}
            <div style={{ padding: '26px 28px 28px' }}>

              {/* ── Bouton Google ── */}
              <button
                type="button"
                onClick={GOOGLE_CLIENT_ID ? triggerGoogleLogin : undefined}
                disabled={googleLoading || !GOOGLE_CLIENT_ID}
                title={!GOOGLE_CLIENT_ID ? 'VITE_GOOGLE_CLIENT_ID manquant dans .env' : ''}
                style={{
                  ...btnGoogle,
                  opacity: !GOOGLE_CLIENT_ID ? 0.4 : 1,
                  cursor: !GOOGLE_CLIENT_ID ? 'not-allowed' : googleLoading ? 'not-allowed' : 'pointer',
                }}
                onMouseOver={e => { if (!googleLoading && GOOGLE_CLIENT_ID) { e.currentTarget.style.background = 'rgba(255,255,255,.12)'; e.currentTarget.style.borderColor = 'rgba(14,165,160,.5)'; } }}
                onMouseOut={e  => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.12)'; }}
              >
                {googleLoading
                  ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .8s linear infinite' }} />
                  : <GoogleIcon />
                }
                {googleLoading
                  ? 'Connexion en cours…'
                  : !GOOGLE_CLIENT_ID
                    ? 'Google OAuth non configuré'
                    : 'Continuer avec Google'
                }
              </button>

              {/* Séparateur */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.1)' }} />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', fontWeight: 700, letterSpacing: .8, textTransform: 'uppercase' }}>ou avec vos identifiants</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.1)' }} />
              </div>

              {/* ── Formulaire email / mot de passe ── */}
              <form onSubmit={handleSubmit}>
                {/* Email */}
                <Field label="Adresse email" icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                }>
                  <input
                    type="email"
                    required
                    placeholder="votre@email.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    autoComplete="email"
                    style={inp}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </Field>

                {/* Mot de passe */}
                <Field label="Mot de passe" icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                }>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    autoComplete="current-password"
                    style={{ ...inp, padding: '13px 44px 13px 42px' }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', padding: 4, display: 'flex' }}
                  >
                    {showPwd
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    }
                  </button>
                </Field>

                {/* Mot de passe oublié */}
                <div style={{ textAlign: 'right', marginBottom: 20, marginTop: -6 }}>
                  <Link to="/forgot-password" style={{ fontSize: 12, color: '#0EA5A0', fontWeight: 600, textDecoration: 'none' }}>
                    Mot de passe oublié ?
                  </Link>
                </div>

                {/* Bouton connexion principale */}
                <button type="submit" disabled={loading} style={btnPrimary}>
                  {loading
                    ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .8s linear infinite' }} />
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                  }
                  {loading ? 'Connexion en cours…' : 'Se connecter'}
                </button>
              </form>

              {/* Footer */}
              <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 18, lineHeight: 1.7 }}>
                En vous connectant, vous acceptez les conditions<br />d'utilisation de la Clinique Canadienne de Souanké.
              </p>
            </div>
          </div>

          {/* Copyright */}
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>© 2025 Clinique Canadienne de Souanké</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,.3) !important; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px rgba(11,30,59,.8) inset !important;
          -webkit-text-fill-color: #fff !important;
        }
      `}</style>
    </div>
  );
}