import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MustChangePasswordGate from './MustChangePasswordGate';

const PAGE_TITLES = {
  '/':               'Tableau de bord',
  '/patients':       'Patients',
  '/appointments':   'Rendez-vous',
  '/consultations':  'Consultations',
  '/prescriptions':  'Ordonnances',
  '/hospitalization': 'Hospitalisation',
  '/chirurgie':       'Chirurgie',
  '/blocoperatoire':  'Bloc Opératoire',
  '/urgences':        'Urgences',
  '/pediatrie':       'Pédiatrie',
  '/maternite':       'Maternité',
  '/echographie':     'Échographie',
  '/laboratory':      'Laboratoire',
  '/radiology':      'Imagerie Médicale',
  '/pharmacy':       'Pharmacie',
  '/hr':             'Ressources Humaines',
  '/finance':        'Finance & Facturation',
  '/messages':       'Messagerie',
  '/ai':             'Intelligence Artificielle',
  '/archive':        'Archivage',
  '/audit':          "Journal d'Audit",
  '/analytics':      'Analytics',
  '/administration': 'Administration',
  '/settings':       'Paramètres',
  '/portal':         'Mon Espace Patient',
};

const getTitle = (pathname) => {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (/^\/patients\/.+/.test(pathname)) return 'Fiche Patient';
  if (/^\/finance\/.+\/print/.test(pathname)) return 'Impression Facture';
  return 'Clinique Canadienne';
};

export default function Layout() {
  // Deux états distincts plutôt qu'un seul booléen partagé : sur mobile/
  // tablette (< 1024px), la sidebar est masquée par défaut et le
  // hamburger la révèle temporairement (overlay) ; sur grand écran
  // (≥ 1024px), elle est visible par défaut et le même bouton la replie
  // pour libérer l'espace de contenu — deux comportements par défaut
  // opposés, impossibles à représenter proprement avec un seul state.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const location = useLocation();
  const title = getTitle(location.pathname);

  // ARCH-006 (audit du 11 sept. 2026) — closeSidebar() forçait aussi
  // setDesktopCollapsed(true), pas seulement setMobileOpen(false). Ça
  // n'était pas "sans effet sur le mode qui n'est pas affiché" comme le
  // disait l'ancien commentaire : sur grand écran, ça repliait réellement
  // la sidebar. Comme cette fonction s'exécute à CHAQUE changement de route
  // (effet ci-dessous) et à chaque clic sur un lien du menu (Sidebar.jsx
  // appelle onClose), la sidebar desktop se repliait après pratiquement
  // toute navigation — contredisant le comportement documenté juste
  // au-dessus (repliée uniquement via le bouton hamburger, pas par défaut).
  // Seul le volet mobile (overlay temporaire) doit se refermer après un
  // clic sur un lien ; le repli desktop reste une préférence utilisateur
  // pilotée exclusivement par toggleSidebar.
  const closeMobileSidebar = () => setMobileOpen(false);

  // Après un clic sur un lien (Sidebar appelle onClose immédiatement, avant
  // même que la navigation ne se termine) ET en filet de sécurité pour tout
  // changement de route qui ne passerait pas par ce clic (navigation
  // programmatique, bouton précédent/suivant du navigateur) — sinon la
  // sidebar peut rester ouverte sur mobile après un changement de page.
  useEffect(() => { closeMobileSidebar(); }, [location.pathname]);

  // 1024px = seuil `lg:` de Tailwind, déjà utilisé par le CSS de la sidebar.
  const toggleSidebar = () => {
    if (window.innerWidth >= 1024) setDesktopCollapsed(v => !v);
    else setMobileOpen(v => !v);
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <MustChangePasswordGate />
      <Sidebar isOpen={mobileOpen} collapsed={desktopCollapsed} onClose={closeMobileSidebar} />
      <div className={`main-content ${desktopCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header title={title} onMenuToggle={toggleSidebar} />
        <main className="p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
