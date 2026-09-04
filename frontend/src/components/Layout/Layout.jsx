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

  // Ferme la sidebar quel que soit le mode actif (overlay mobile ou repli
  // desktop) — les deux setters sont sans effet sur le mode qui n'est pas
  // affiché, donc appeler les deux sans savoir lequel est actif est sûr et
  // évite de refaire un test window.innerWidth ici aussi.
  const closeSidebar = () => { setMobileOpen(false); setDesktopCollapsed(true); };

  // Après un clic sur un lien (Sidebar appelle onClose immédiatement, avant
  // même que la navigation ne se termine) ET en filet de sécurité pour tout
  // changement de route qui ne passerait pas par ce clic (navigation
  // programmatique, bouton précédent/suivant du navigateur) — sinon la
  // sidebar peut rester ouverte/dépliée après un changement de page.
  useEffect(() => { closeSidebar(); }, [location.pathname]);

  // 1024px = seuil `lg:` de Tailwind, déjà utilisé par le CSS de la sidebar.
  const toggleSidebar = () => {
    if (window.innerWidth >= 1024) setDesktopCollapsed(v => !v);
    else setMobileOpen(v => !v);
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <MustChangePasswordGate />
      <Sidebar isOpen={mobileOpen} collapsed={desktopCollapsed} onClose={closeSidebar} />
      <div className={`main-content ${desktopCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header title={title} onMenuToggle={toggleSidebar} />
        <main className="p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
