// ARCH-006 (audit du 11 sept. 2026) — closeSidebar() (appelée à chaque
// changement de route ET à chaque clic sur un lien du menu) forçait
// setDesktopCollapsed(true) en plus de setMobileOpen(false), malgré le
// commentaire affirmant que les deux setters étaient "sans effet sur le
// mode qui n'est pas affiché" : sur grand écran (≥1024px), la sidebar se
// repliait réellement après quasiment toute navigation, contredisant le
// comportement documenté juste au-dessus ("visible par défaut, repliée
// uniquement via le bouton hamburger"). Corrigé : seul le volet mobile se
// referme après une navigation ; le repli desktop reste piloté uniquement
// par toggleSidebar (clic explicite sur le hamburger).
//
// Monte le vrai Layout.jsx (Sidebar + Header + Outlet réels) sous une vraie
// largeur d'écran desktop simulée (window.innerWidth) ; seules les
// frontières réseau/contexte sont simulées.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { vi } from 'vitest';
import Layout from '../Layout.jsx';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Medecin', role: 'medecin' }, setUser: () => {} }),
}));
vi.mock('../../../contexts/SocketContext', () => ({
  useSocket: () => ({ socket: null, connected: false }),
}));
vi.mock('../../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../../../api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: {} })), put: vi.fn() },
}));

function PageA() { return <div>Contenu Page A<Link to="/b">Aller à B</Link></div>; }
function PageB() { return <div>Contenu Page B</div>; }

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<PageA />} />
          <Route path="b" element={<PageB />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  // Seuil desktop réel utilisé par Layout.jsx::toggleSidebar (>= 1024px).
  window.innerWidth = 1280;
});

test('sur desktop, naviguer d\'une page à l\'autre ne replie jamais la sidebar toute seule', async () => {
  const user = userEvent.setup();
  renderLayout();

  const nav = await screen.findByLabelText('Navigation principale');
  expect(nav.className).not.toContain('collapsed');

  await user.click(screen.getByText('Aller à B'));
  await screen.findByText('Contenu Page B');

  // Preuve non négociable : la navigation seule ne doit jamais ajouter la
  // classe "collapsed" — c'est exactement le bug corrigé.
  expect(nav.className).not.toContain('collapsed');
});
