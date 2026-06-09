// import { NavLink, useNavigate } from 'react-router-dom';
// import { useAuth } from '../../contexts/AuthContext';
// import toast from 'react-hot-toast';

// // ── Configuration des rôles ────────────────────────────────────────────────
// const ROLE_CONFIG = {
//   superadmin:     { icon: '👑', color: '#f59e0b', label: 'Super Admin' },
//   adminclinique:  { icon: '🏥', color: '#8b5cf6', label: 'Admin Clinique' },
//   medecin:        { icon: '👨‍⚕️', color: '#3b82f6', label: 'Médecin' },
//   infirmier:      { icon: '💉', color: '#06b6d4', label: 'Infirmier' },
//   laborantin:     { icon: '🔬', color: '#22c55e', label: 'Laborantin' },
//   radiologue:     { icon: '🩻', color: '#6366f1', label: 'Radiologue' },
//   pharmacien:     { icon: '💊', color: '#f97316', label: 'Pharmacien' },
//   comptable:      { icon: '💰', color: '#eab308', label: 'Comptable' },
//   receptionniste: { icon: '📋', color: '#ec4899', label: 'Réceptionniste' },
//   patient:        { icon: '🙍', color: '#6b7280', label: 'Patient' },
// };

// // ── Navigation par sections ────────────────────────────────────────────────
// // roles: null = visible pour tous les rôles connectés
// const NAV_SECTIONS = [
//   {
//     id: 'main',
//     label: null, // pas de titre pour la section principale
//     items: [
//       { to: '/',             label: 'Tableau de bord',    icon: '🏠', roles: null },
//     ],
//   },
//   {
//     id: 'clinique',
//     label: 'Clinique',
//     items: [
//       { to: '/patients',        label: 'Patients',          icon: '👥', roles: ['superadmin','adminclinique','medecin','infirmier','receptionniste'] },
//       { to: '/appointments',    label: 'Rendez-vous',       icon: '📅', roles: null },
//       { to: '/consultations',   label: 'Consultations',     icon: '🩺', roles: ['superadmin','medecin','infirmier'], ai: true },
//       { to: '/prescriptions',   label: 'Ordonnances',       icon: '📋', roles: ['superadmin','medecin','pharmacien','infirmier'] },
//       { to: '/hospitalization', label: 'Hospitalisation',   icon: '🛏️', roles: ['superadmin','adminclinique','medecin','infirmier'] },
//     ],
//   },
//   {
//     id: 'paraclinique',
//     label: 'Paraclinique',
//     items: [
//       { to: '/laboratory', label: 'Laboratoire', icon: '🔬', roles: ['superadmin','medecin','laborantin'] },
//       { to: '/radiology',  label: 'Imagerie',    icon: '🩻', roles: ['superadmin','medecin','radiologue'] },
//       { to: '/pharmacy',   label: 'Pharmacie',   icon: '💊', roles: ['superadmin','adminclinique','pharmacien','medecin'] },
//       { to: '/chirurgie',   label: 'Chirurgie',   icon: '🔪', roles: ['superadmin','adminclinique','medecin'] },
//       { to: '/blocoperatoire',   label: 'Bloc Opératoire',   icon: '🔪', roles: ['superadmin','adminclinique','medecin'] },
//     ],
//   },
//   {
//     id: 'gestion',
//     label: 'Gestion',
//     items: [
//       { to: '/hr',       label: 'Ressources Humaines', icon: '👔', roles: ['superadmin','adminclinique'] },
//       { to: '/finance',  label: 'Finance',              icon: '💰', roles: ['superadmin','adminclinique','comptable'] },
//       { to: '/messages', label: 'Messagerie',           icon: '💬', roles: null },
//     ],
//   },
//   {
//     id: 'intelligence',
//     label: 'Intelligence',
//     items: [
//       { to: '/ai',        label: 'Intelligence IA', icon: '🤖', roles: ['superadmin','adminclinique','medecin'], ai: true },
//       { to: '/analytics', label: 'Analytics',       icon: '📊', roles: ['superadmin','adminclinique'] },
//     ],
//   },
//   {
//     id: 'administration',
//     label: 'Administration',
//     items: [
//       { to: '/archive',        label: 'Archivage',         icon: '🗄️', roles: ['superadmin','adminclinique'] },
//       { to: '/administration', label: 'Administration',    icon: '🛡️', roles: ['superadmin','adminclinique'] },
//       { to: '/settings',       label: 'Paramètres',        icon: '⚙️', roles: ['superadmin','adminclinique'] },
//       { to: '/audit',          label: "Journal d'audit",   icon: '📋', roles: ['superadmin'] },
//     ],
//   },
//   {
//     id: 'patient',
//     label: null,
//     items: [
//       { to: '/portal', label: 'Mon Espace Patient', icon: '🙍', roles: ['patient'] },
//     ],
//   },
// ];

// // ── Composant ──────────────────────────────────────────────────────────────
// export default function Sidebar({ isOpen, onClose }) {
//   const { user, logout } = useAuth();
//   const navigate          = useNavigate();
//   const rc = ROLE_CONFIG[user?.role] || { icon: '👤', color: '#6b7280', label: user?.role };

//   const handleLogout = async () => {
//     try {
//       await logout();
//       navigate('/login');
//     } catch {
//       toast.error('Erreur lors de la déconnexion.');
//     }
//   };

//   // Filtre les items selon le rôle de l'utilisateur
//   const canSee = (item) => !item.roles || item.roles.includes(user?.role);

//   return (
//     <>
//       {/* Overlay mobile */}
//       {isOpen && (
//         <div
//           className="fixed inset-0 bg-black/50 z-40 lg:hidden"
//           onClick={onClose}
//         />
//       )}

//       <aside className={`sidebar ${isOpen ? 'open' : ''}`}>

//         {/* ── Logo ─────────────────────────────────────────────────────────── */}
//         <div className="p-5 border-b border-white/10 flex-shrink-0">
//           <div className="flex items-center gap-3">
//             <div
//               className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
//               style={{ background: '#2563eb' }}
//             >
//               <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
//                   d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
//               </svg>
//             </div>
//             <div>
//               <div className="text-white font-bold text-sm leading-tight">Clinique canadienne</div>
//               <div className="text-blue-400 text-xs">de Souanké</div>
//             </div>
//           </div>
//         </div>

//         {/* ── Utilisateur connecté ──────────────────────────────────────────── */}
//         <div className="p-4 border-b border-white/10 flex-shrink-0">
//           <div className="flex items-center gap-3">
//             <div
//               className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
//               style={{ background: `${rc.color}22`, border: `2px solid ${rc.color}55` }}
//             >
//               {rc.icon}
//             </div>
//             <div className="flex-1 min-w-0">
//               <div className="text-white text-sm font-semibold truncate">
//                 {user?.prenom} {user?.nom}
//               </div>
//               <div className="text-gray-400 text-xs">{rc.label}</div>
//             </div>
//             {/* Indicateur connecté */}
//             <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0 animate-pulse" />
//           </div>
//         </div>

//         {/* ── Navigation ───────────────────────────────────────────────────── */}
//         {/* min-h-0 est OBLIGATOIRE : flex items ont min-height:auto par défaut,
//             ce qui empêche overflow-y de fonctionner dans un conteneur flex */}
//         <nav className="flex-1 min-h-0 overflow-y-auto py-2 custom-scroll">
//           {NAV_SECTIONS.map((section) => {
//             // Filtrer les items visibles pour ce rôle
//             const visibleItems = section.items.filter(canSee);

//             // Cacher la section si aucun item n'est visible
//             if (visibleItems.length === 0) return null;

//             return (
//               <div key={section.id}>
//                 {/* Titre de section (si défini) */}
//                 {section.label && (
//                   <div className="px-4 pt-4 pb-1.5">
//                     <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">
//                       {section.label}
//                     </span>
//                   </div>
//                 )}

//                 {/* Items de la section */}
//                 <div className="space-y-0.5">
//                   {visibleItems.map((item) => (
//                     <NavLink
//                       key={item.to}
//                       to={item.to}
//                       end={item.to === '/'}
//                       onClick={onClose}
//                       className={({ isActive }) =>
//                         `sidebar-link ${isActive ? 'active' : ''}`
//                       }
//                     >
//                       <span className="text-base flex-shrink-0">{item.icon}</span>
//                       <span className="flex-1 truncate">{item.label}</span>
//                       {item.ai && (
//                         <span className="ai-badge flex-shrink-0">IA</span>
//                       )}
//                     </NavLink>
//                   ))}
//                 </div>
//               </div>
//             );
//           })}
//         </nav>

//         {/* ── Déconnexion ───────────────────────────────────────────────────── */}
//         <div className="p-3 border-t border-white/10 flex-shrink-0">
//           <button
//             onClick={handleLogout}
//             className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
//           >
//             <span>🚪</span>
//             <span>Déconnexion</span>
//           </button>
//         </div>

//       </aside>
//     </>
//   );
// }



import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

// ── Configuration des rôles ────────────────────────────────────────────────
const ROLE_CONFIG = {
  superadmin:     { icon: '👑', color: '#f59e0b', label: 'Super Admin' },
  adminclinique:  { icon: '🏥', color: '#8b5cf6', label: 'Admin Clinique' },
  medecin:        { icon: '👨‍⚕️', color: '#3b82f6', label: 'Médecin' },
  infirmier:      { icon: '💉', color: '#06b6d4', label: 'Infirmier' },
  laborantin:     { icon: '🔬', color: '#22c55e', label: 'Laborantin' },
  radiologue:     { icon: '🩻', color: '#6366f1', label: 'Radiologue' },
  pharmacien:     { icon: '💊', color: '#f97316', label: 'Pharmacien' },
  comptable:      { icon: '💰', color: '#eab308', label: 'Comptable' },
  receptionniste: { icon: '📋', color: '#ec4899', label: 'Réceptionniste' },
  patient:        { icon: '🙍', color: '#6b7280', label: 'Patient' },
};

// ── Rôles admins — voient TOUT automatiquement ─────────────────────────────
const ADMINS = ['superadmin', 'adminclinique'];

// Fusionne les admins avec les rôles spécifiques d'un item
const withAdmins = (...roles) => [...new Set([...ADMINS, ...roles])];

// ── Navigation par sections ────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    id: 'main',
    label: null,
    items: [
      { to: '/', label: 'Tableau de bord', icon: '🏠', roles: null },
    ],
  },
  {
    id: 'clinique',
    label: 'Clinique',
    items: [
      { to: '/patients',        label: 'Patients',        icon: '👥', roles: withAdmins('medecin','infirmier','receptionniste') },
      { to: '/appointments',    label: 'Rendez-vous',     icon: '📅', roles: null },
      { to: '/consultations',   label: 'Consultations',   icon: '🩺', roles: withAdmins('medecin','infirmier'), ai: true },
      { to: '/prescriptions',   label: 'Ordonnances',     icon: '📋', roles: withAdmins('medecin','pharmacien','infirmier') },
      { to: '/hospitalization', label: 'Hospitalisation', icon: '🛏️', roles: withAdmins('medecin','infirmier') },
    ],
  },
  {
    id: 'specialites',
    label: 'Spécialités',
    items: [
      { to: '/urgences',       label: 'Urgences',        icon: '🚨', roles: withAdmins('medecin','infirmier') },
      { to: '/pediatrie',      label: 'Pédiatrie',       icon: '👶', roles: withAdmins('medecin','infirmier') },
      { to: '/maternite',      label: 'Maternité',       icon: '🤱', roles: withAdmins('medecin','infirmier') },
      { to: '/chirurgie',      label: 'Chirurgie',       icon: '🔪', roles: withAdmins('medecin') },
      { to: '/blocoperatoire', label: 'Bloc Opératoire', icon: '🏥', roles: withAdmins('medecin') },
    ],
  },
  {
    id: 'paraclinique',
    label: 'Paraclinique',
    items: [
      { to: '/laboratory',  label: 'Laboratoire', icon: '🔬', roles: withAdmins('medecin','laborantin') },
      { to: '/radiology',   label: 'Imagerie',    icon: '🩻', roles: withAdmins('medecin','radiologue') },
      { to: '/echographie', label: 'Échographie', icon: '📡', roles: withAdmins('medecin','radiologue') },
      { to: '/pharmacy',    label: 'Pharmacie',   icon: '💊', roles: withAdmins('pharmacien','medecin') },
    ],
  },
  {
    id: 'gestion',
    label: 'Gestion',
    items: [
      { to: '/hr',       label: 'Ressources Humaines', icon: '👔', roles: ADMINS },
      { to: '/finance',  label: 'Finance',             icon: '💰', roles: withAdmins('comptable') },
      { to: '/messages', label: 'Messagerie',          icon: '💬', roles: null },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    items: [
      { to: '/ai',        label: 'Intelligence IA', icon: '🤖', roles: withAdmins('medecin'), ai: true },
      { to: '/analytics', label: 'Analytics',       icon: '📊', roles: ADMINS },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    items: [
      { to: '/archive',        label: 'Archivage',       icon: '🗄️', roles: ADMINS },
      { to: '/administration', label: 'Administration',  icon: '🛡️', roles: ADMINS },
      { to: '/settings',       label: 'Paramètres',      icon: '⚙️', roles: ADMINS },
      { to: '/audit',          label: "Journal d'audit", icon: '📋', roles: ['superadmin'] },
    ],
  },
  {
    id: 'patient',
    label: null,
    items: [
      { to: '/portal', label: 'Mon Espace Patient', icon: '🙍', roles: ['patient'] },
    ],
  },
];

// ── Composant ──────────────────────────────────────────────────────────────
export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const rc = ROLE_CONFIG[user?.role] || { icon: '👤', color: '#6b7280', label: user?.role };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      toast.error('Erreur lors de la déconnexion.');
    }
  };

  // Filtre les items selon le rôle de l'utilisateur
  const canSee = (item) => !item.roles || item.roles.includes(user?.role);

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>

        {/* ── Logo ─────────────────────────────────────────────────────────── */}
        <div className="p-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#2563eb' }}
            >
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-tight">Clinique canadienne</div>
              <div className="text-blue-400 text-xs">de Souanké</div>
            </div>
          </div>
        </div>

        {/* ── Utilisateur connecté ──────────────────────────────────────────── */}
        <div className="p-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: `${rc.color}22`, border: `2px solid ${rc.color}55` }}
            >
              {rc.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-semibold truncate">
                {user?.prenom} {user?.nom}
              </div>
              <div className="text-gray-400 text-xs">{rc.label}</div>
            </div>
            <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0 animate-pulse" />
          </div>
        </div>

        {/* ── Navigation ───────────────────────────────────────────────────── */}
        <nav className="flex-1 min-h-0 overflow-y-auto py-2 custom-scroll">
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter(canSee);
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.id}>
                {section.label && (
                  <div className="px-4 pt-4 pb-1.5">
                    <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">
                      {section.label}
                    </span>
                  </div>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `sidebar-link ${isActive ? 'active' : ''}`
                      }
                    >
                      <span className="text-base flex-shrink-0">{item.icon}</span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.ai && (
                        <span className="ai-badge flex-shrink-0">IA</span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* ── Déconnexion ───────────────────────────────────────────────────── */}
        <div className="p-3 border-t border-white/10 flex-shrink-0">
          <button
            onClick={handleLogout}
            className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <span>🚪</span>
            <span>Déconnexion</span>
          </button>
        </div>

      </aside>
    </>
  );
}