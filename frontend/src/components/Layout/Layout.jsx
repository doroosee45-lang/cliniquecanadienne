import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const PAGE_TITLES = {
  '/':               'Tableau de bord',
  '/patients':       'Patients',
  '/appointments':   'Rendez-vous',
  '/consultations':  'Consultations',
  '/prescriptions':  'Ordonnances',
  '/hospitalization':'Hospitalisation',
  '/laboratory':     'Laboratoire',
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = getTitle(location.pathname);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header title={title} onMenuToggle={() => setSidebarOpen(v => !v)} />
        <main className="p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
