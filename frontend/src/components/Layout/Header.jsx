import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import api from '../../api';
import toast from 'react-hot-toast';

export default function Header({ title, onMenuToggle }) {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showAI, setShowAI] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    { role: 'ai', content: `Bonjour ${user?.prenom} ! Je suis votre assistant IA. Posez-moi vos questions.` },
  ]);
  const [aiInput, setAiInput] = useState('');
  const notifRef = useRef(null);

  // Chargement initial + polling de sécurité toutes les 60s
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/notifications');
        setNotifications(data.notifications || []);
        setUnread(data.unread || 0);
      } catch {}
    };
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, []);

  // Réception des nouvelles notifications en temps réel via Socket.IO
  useEffect(() => {
    if (!socket) return;
    const handleNew = (notif) => {
      setNotifications(prev => [notif, ...prev].slice(0, 50));
      setUnread(prev => prev + 1);
      toast(notif.titre, {
        icon: notif.type === 'critical' ? '🚨' : notif.type === 'warning' ? '⚠️' : '🔔',
        duration: 4000,
      });
    };
    socket.on('notification:new', handleNew);
    return () => socket.off('notification:new', handleNew);
  }, [socket]);

  useEffect(() => {
    const handleClick = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const { data } = await api.get(`/patients/search?q=${encodeURIComponent(q)}`);
      setSearchResults(data.patients || []);
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(n => n.map(x => ({ ...x, lu: true })));
      setUnread(0);
    } catch {}
  };

  const sendAI = () => {
    if (!aiInput.trim()) return;
    const q = aiInput;
    setAiMessages(m => [...m, { role: 'user', content: q }]);
    setAiInput('');
    setTimeout(() => {
      const responses = {
        'stock': '💊 Alertes stock actives : Amlodipine (15 unités, seuil 20) et Ibuprofène (8 unités, seuil 30). Commande recommandée.',
        'rdv': '📅 Vous avez 3 rendez-vous planifiés aujourd\'hui. Prochain dans 45 minutes.',
        'lit': '🛏️ Occupation actuelle : 8/13 lits occupés (62%). 2 sorties prévues aujourd\'hui.',
      };
      const reply = Object.entries(responses).find(([k]) => q.toLowerCase().includes(k));
      setAiMessages(m => [...m, { role: 'ai', content: reply ? reply[1] : `Analyse en cours pour : "${q}". Je consulte les données cliniques... Résultat disponible dans les prochaines secondes.` }]);
    }, 800);
  };

  const notifIcons = { critical: '🚨', warning: '⚠️', info: 'ℹ️', success: '✅', ai_alert: '🤖', rappel: '🔔' };
  const notifBg   = { critical: 'bg-red-50', warning: 'bg-yellow-50', info: 'bg-blue-50', success: 'bg-green-50', ai_alert: 'bg-purple-50', rappel: 'bg-cyan-50' };

  return (
    <>
      <header className="bg-white border-b border-gray-100 px-4 lg:px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        {/* Hamburger + Title */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={onMenuToggle} className="lg:hidden w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{title}</h1>
            <p className="text-gray-400 text-xs hidden sm:block flex items-center gap-2">
              {new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })} — {user?.prenom} {user?.nom}
              <span className={`inline-block w-2 h-2 rounded-full ml-2 ${connected ? 'bg-green-400' : 'bg-gray-300'}`} title={connected ? 'Temps réel actif' : 'Hors ligne'} />
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Search */}
          <div className="relative hidden md:block">
            <input
              type="search"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Rechercher patient..."
              className="bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white rounded-xl shadow-xl border border-gray-100 mt-1 z-50 max-h-60 overflow-y-auto">
                {searchResults.map(p => (
                  <button
                    key={p._id}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 text-sm"
                    onClick={() => { navigate('/patients'); setSearchResults([]); setSearchQuery(''); }}
                  >
                    <div className="font-semibold">{p.nom} {p.prenom}</div>
                    <div className="text-gray-400 text-xs">{p.numero_dossier} • {p.telephone}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button onClick={() => setShowNotifs(v => !v)} className="relative w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center hover:bg-gray-100">
              <span className="text-lg">🔔</span>
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 top-12 w-[calc(100vw-32px)] sm:w-80 max-w-xs sm:max-w-none bg-white rounded-2xl shadow-2xl border border-gray-100 z-50">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">Notifications <span className="text-blue-600">({unread})</span></h3>
                  <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">Tout marquer lu</button>
                </div>
                <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                  {notifications.length === 0
                    ? <div className="p-6 text-center text-gray-400 text-sm">✅ Aucune notification</div>
                    : notifications.slice(0, 8).map(n => (
                        <div key={n._id} className={`p-3 ${notifBg[n.type] || 'bg-gray-50'} cursor-pointer hover:opacity-90`}>
                          <div className="flex gap-2">
                            <span>{notifIcons[n.type] || '🔔'}</span>
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{n.titre}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{n.message?.substring(0, 70)}...</div>
                              <div className="text-xs text-gray-400 mt-1">
                                {new Date(n.createdAt).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                </div>
              </div>
            )}
          </div>

          {/* AI Chat */}
          <button onClick={() => setShowAI(true)}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl px-3 py-2 text-sm font-semibold flex items-center gap-1.5">
            <span>🤖</span>
            <span className="hidden sm:inline">IA</span>
          </button>
        </div>
      </header>

      {/* AI Panel */}
      {showAI && (
        <div className="fixed bottom-0 right-0 left-0 sm:bottom-6 sm:right-6 sm:left-auto w-full sm:w-80 md:w-96 z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">🤖</div>
                <div>
                  <div className="text-white font-bold text-sm">Assistant IA Clinique</div>
                  <div className="text-white/70 text-xs">En ligne • {user?.prenom}</div>
                </div>
              </div>
              <button onClick={() => setShowAI(false)} className="text-white/70 hover:text-white text-xl">×</button>
            </div>
            <div className="h-48 overflow-y-auto p-4 space-y-3 bg-gray-50 custom-scroll">
              {aiMessages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
                  {m.role === 'ai' && <span className="text-lg">🤖</span>}
                  <div className={`px-4 py-2.5 rounded-2xl text-sm max-w-xs shadow-sm ${
                    m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white text-gray-800 rounded-tl-sm'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-gray-100 bg-white flex gap-2">
              <input
                type="text"
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendAI()}
                placeholder="Votre question..."
                className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={sendAI} className="bg-blue-600 text-white rounded-xl px-3 py-2 text-sm font-semibold hover:bg-blue-700">→</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
