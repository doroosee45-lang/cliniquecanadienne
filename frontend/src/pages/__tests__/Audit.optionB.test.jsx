// FORCE-LOGOUT-001 (rapport de clôture du 11 sept. 2026) — le bouton
// "Forcer" (déconnexion forcée d'une session active) avait été désactivé
// honnêtement en 5.7 : aucun mécanisme réel de révocation de session/JWT
// individuelle n'existait (middleware/auth.js ne vérifiait que la signature
// du token et User.statut). Un vrai mécanisme existe désormais
// (User.tokenVersion, POST /settings/users/:id/force-logout) — ce test
// prouve que le bouton appelle réellement cette route (jamais un
// setConnexions local sans effet), réservé au superadmin, et honnêtement
// désactivé quand aucun utilisateur réel n'a pu être résolu pour la session
// (utilisateur_id absent — ex. entrée IP seule).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import auditReducer from '../../store/slices/auditSlice';
import Audit from '../Audit.jsx';

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

let mockRole = 'superadmin';
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Admin', get role() { return mockRole; } } }),
}));

const SESSION_FIXTURE = {
  _id: 'sess-1', utilisateur_id: 'user-real-1', utilisateur: 'Jean Test', email: 'jean@test.local', role: 'medecin',
  heure_connexion: '2026-09-06T08:00:00.000Z', statut: 'actif',
  ip: '10.0.0.1', device: 'Chrome / Windows', localisation: 'Brazzaville',
};
const SESSION_SANS_COMPTE = {
  _id: 'sess-2', utilisateur_id: null, utilisateur: 'Inconnu', email: '—', role: '—',
  heure_connexion: '2026-09-06T08:05:00.000Z', statut: 'actif',
  ip: '10.0.0.2', device: 'Chrome / Windows', localisation: 'Brazzaville',
};

function renderAudit() {
  const store = configureStore({ reducer: { audit: auditReducer } });
  return render(<Provider store={store}><Audit /></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRole = 'superadmin';
  api.get.mockImplementation((url) => {
    if (url.startsWith('/audit?'))          return Promise.resolve({ data: { events: [], total: 0 } });
    if (url === '/audit/connexions')        return Promise.resolve({ data: { connexions: [SESSION_FIXTURE, SESSION_SANS_COMPTE] } });
    if (url === '/audit/stats')             return Promise.resolve({ data: { activite_7j: { labels: [], data: [] }, activite_30j: { labels: [], data: [] }, connexions_heure: { labels: [], data: [] }, top_utilisateurs: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('le bouton "Forcer" appelle réellement POST /settings/users/:id/force-logout (superadmin)', async () => {
  const user = userEvent.setup();
  api.post.mockResolvedValue({ data: { success: true, message: 'Session de jean@test.local révoquée — reconnexion requise.', tokenVersion: 1 } });
  renderAudit();

  await user.click(await screen.findByRole('button', { name: /Connexions/ }));
  const [forcerBtn] = await screen.findAllByRole('button', { name: /Forcer/ });
  expect(forcerBtn).not.toBeDisabled();

  await user.click(forcerBtn);
  expect(api.post).toHaveBeenCalledWith('/settings/users/user-real-1/force-logout');
});

test('"Forcer" reste honnêtement désactivé quand aucun compte réel n\'a pu être résolu pour la session (IP seule)', async () => {
  const user = userEvent.setup();
  renderAudit();

  await user.click(await screen.findByRole('button', { name: /Connexions/ }));
  const forcerBtns = await screen.findAllByRole('button', { name: /Forcer/ });
  // La 2ᵉ session (utilisateur_id null) n'a pas de compte réel résolu.
  expect(forcerBtns[1]).toBeDisabled();

  await user.click(forcerBtns[1], { skipPointerEventsCheck: true }).catch(() => {});
  expect(api.post).not.toHaveBeenCalled();
});

test('"Forcer" n\'est jamais affiché pour un rôle non-superadmin (adminclinique) — même protection que le reste des mutations utilisateur', async () => {
  const user = userEvent.setup();
  mockRole = 'adminclinique';
  renderAudit();

  await user.click(await screen.findByRole('button', { name: /Connexions/ }));
  await screen.findByText('Jean Test');
  expect(screen.queryByRole('button', { name: /Forcer/ })).not.toBeInTheDocument();
});
