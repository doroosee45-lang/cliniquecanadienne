// FE-ADM-01 (correction du 12 sept. 2026, audit indépendant) —
// Administration.jsx dispatchait fetchUsers/fetchServices/
// fetchSystemSettings (Redux) en plus de loadAll() (état local, seule
// source réellement lue par le reste du fichier) : double récupération
// pure de /admin/users et /settings/services, et fetchSystemSettings
// ciblait en plus /admin/settings, une route qui n'a jamais existé (404
// systématique à chaque montage, jamais lu nulle part, jamais signalé).
// Ce test prouve qu'un seul appel réel a désormais lieu pour chaque
// endpoint réel, et qu'aucun appel n'est plus jamais fait vers la route
// inexistante /admin/settings.
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import Administration from '../Administration.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') } }));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Admin', role: 'superadmin' } }),
}));

vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';

function renderAdministration() {
  return render(<Administration />);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/admin/users')) return Promise.resolve({ data: { users: [] } });
    if (url.startsWith('/settings/services')) return Promise.resolve({ data: { services: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('FE-ADM-01 — un seul appel réel à /admin/users et /settings/services, jamais un second via un dispatch orphelin ; /admin/settings (route inexistante) n\'est plus jamais appelée', async () => {
  renderAdministration();
  await screen.findByText('Administration');

  const usersCalls = api.get.mock.calls.filter(([url]) => url.startsWith('/admin/users'));
  const servicesCalls = api.get.mock.calls.filter(([url]) => url.startsWith('/settings/services'));
  const settingsCalls = api.get.mock.calls.filter(([url]) => url.startsWith('/admin/settings'));

  expect(usersCalls).toHaveLength(1);
  expect(servicesCalls).toHaveLength(1);
  expect(settingsCalls).toHaveLength(0);
});
