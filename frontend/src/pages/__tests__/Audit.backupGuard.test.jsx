// P1-02 (audit du 11 sept. 2026) — POST /settings/backup est
// authorize('superadmin') strict côté backend (settings.routes.js), mais le
// bouton "Sauvegarder" de Audit.jsx était accessible sans aucune garde à un
// compte adminclinique (Sidebar/App.jsx l'autorisent sur cette page via
// ROLES.admin) : il recevait systématiquement un 403 au clic. Ce test prouve
// qu'un compte adminclinique voit désormais ce bouton réellement désactivé
// (jamais un bouton qui échouera toujours), tandis qu'un compte superadmin
// le voit actif — le backend reste dans tous les cas l'autorité finale,
// cette garde n'est qu'une cohérence d'affichage (même schéma que P1-01,
// Administration.userManagementGuard.test.jsx).
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

let mockRole = 'adminclinique';
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Admin', role: mockRole } }),
}));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

function renderAudit() {
  const store = configureStore({ reducer: { audit: auditReducer } });
  return render(<Provider store={store}><Audit /></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/audit?')) return Promise.resolve({ data: { events: [], total: 0 } });
    if (url === '/audit/connexions') return Promise.resolve({ data: { connexions: [] } });
    if (url === '/audit/stats') return Promise.resolve({ data: { activite_7j: { labels: [], data: [] }, activite_30j: { labels: [], data: [] }, connexions_heure: { labels: [], data: [] }, top_utilisateurs: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('adminclinique voit le bouton "Sauvegarder" réellement désactivé — POST /settings/backup n\'est jamais appelé', async () => {
  const user = userEvent.setup();
  mockRole = 'adminclinique';
  renderAudit();

  // Le bouton "Sauvegarder" vit dans l'onglet "Statistiques".
  await user.click(await screen.findByRole('button', { name: /Statistiques/ }));
  const backupBtn = await screen.findByRole('button', { name: /Sauvegarder/ });
  expect(backupBtn).toBeDisabled();

  await user.click(backupBtn);
  expect(api.post).not.toHaveBeenCalled();
});

test('superadmin voit le bouton "Sauvegarder" actif', async () => {
  const user = userEvent.setup();
  mockRole = 'superadmin';
  renderAudit();

  await user.click(await screen.findByRole('button', { name: /Statistiques/ }));
  const backupBtn = await screen.findByRole('button', { name: /Sauvegarder/ });
  expect(backupBtn).not.toBeDisabled();
});
