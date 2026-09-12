// FE-ADM-04 (correction du 12 sept. 2026, audit indépendant) — Audit.jsx
// dispatchait fetchAuditLogs (Redux) en plus de loadEvents() (état local,
// seule source réellement lue par tout le reste du fichier) : double
// récupération pure de /audit à chaque montage. Le thunk lui-même
// attendait en plus un champ `logs` que l'API réelle ne renvoie jamais
// (toujours `events`) — reduxLogs/reduxTotal n'étaient lus par aucun code
// de ce fichier. Ce test prouve qu'un seul appel réel à /audit a
// désormais lieu au montage.
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import Audit from '../Audit.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Admin', role: 'superadmin' } }),
}));

function renderAudit() {
  return render(<Audit />);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/audit?')) return Promise.resolve({ data: { events: [], total: 0 } });
    if (url === '/audit/connexions') return Promise.resolve({ data: { connexions: [] } });
    if (url === '/audit/suspects') return Promise.resolve({ data: { suspects: [] } });
    if (url === '/audit/stats') {
      return Promise.resolve({
        data: {
          activite_7j: { labels: [], data: [] },
          activite_30j: { labels: [], data: [] },
          connexions_heure: { labels: [], data: [] },
          top_utilisateurs: [],
        },
      });
    }
    return Promise.resolve({ data: {} });
  });
});

test('FE-ADM-04 — un seul appel réel à /audit au montage, jamais un second via un dispatch orphelin', async () => {
  renderAudit();
  await screen.findByText('Journal d\'Audit');

  const auditCalls = api.get.mock.calls.filter(([url]) => url.startsWith('/audit?'));
  expect(auditCalls).toHaveLength(1);
});
