// NEW-006 (rapport de correction du 11 sept. 2026) — dispatch(fetchStaff({}))
// dupliquait au montage la même requête que loadEmployes() (api.get direct),
// sans que reduxStaff ne soit jamais lu nulle part — vérifié par recherche
// projet-wide (fetchStaff/selectStaff/selectHRLoading inutilisés ailleurs).
// Pire : refreshHR (le vrai mécanisme de rafraîchissement temps réel)
// redispatchait ce même thunk mort au lieu d'appeler loadEmployes() — la
// vraie liste d'employés n'était donc jamais rafraîchie par le temps réel.
// Corrigé : dispatch mort retiré, refreshHR appelle réellement loadEmployes().
//
// Monte le vrai composant HR.jsx ; seule la frontière réseau (`../../api`)
// est simulée. useRealtimeRefresh est simulé pour capturer la fonction de
// rafraîchissement réellement passée, et prouver qu'elle appelle bien
// loadEmployes (pas le thunk Redux mort).
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import HR from '../HR.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

let capturedRefresh = null;
vi.mock('../../hooks/useRealtimeRefresh', () => ({
  useRealtimeRefresh: (fn) => { capturedRefresh = fn; },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Admin', role: 'adminclinique' } }),
}));

function renderHR() {
  return render(<HR />);
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedRefresh = null;
  api.get.mockImplementation((url) => {
    if (url.startsWith('/hr?')) return Promise.resolve({ data: { staff: [] } });
    if (url.startsWith('/hr/schedules')) return Promise.resolve({ data: { schedules: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('un seul appel réel à /hr au montage, et plus jamais le fetchStaff mort vers /hr/staff', async () => {
  renderHR();
  await screen.findByText('Tableau de bord');

  const staffCalls = api.get.mock.calls.filter(([url]) => url.startsWith('/hr?'));
  expect(staffCalls).toHaveLength(1);
  // Preuve non négociable : fetchStaff (thunk Redux mort, cible réellement
  // /hr/staff?..., différent de /hr?limit=1000) ne doit plus jamais être
  // appelé au montage — sinon une charge réseau gaspillée pour une donnée
  // jamais lue (reduxStaff n'était consommé nulle part).
  const deadThunkCalls = api.get.mock.calls.filter(([url]) => url.startsWith('/hr/staff'));
  expect(deadThunkCalls).toHaveLength(0);
});

test('le rafraîchissement temps réel (refreshHR) recharge réellement la vraie liste d\'employés', async () => {
  renderHR();
  await screen.findByText('Tableau de bord');
  expect(typeof capturedRefresh).toBe('function');

  api.get.mockClear();
  capturedRefresh();

  // Preuve non négociable : le rafraîchissement temps réel doit réellement
  // recharger /hr (la vraie liste), pas seulement le thunk Redux mort qui
  // n'alimentait aucun affichage.
  await new Promise(r => setTimeout(r, 0));
  const staffCallsAfterRefresh = api.get.mock.calls.filter(([url]) => url.startsWith('/hr?'));
  expect(staffCallsAfterRefresh.length).toBeGreaterThan(0);
});
