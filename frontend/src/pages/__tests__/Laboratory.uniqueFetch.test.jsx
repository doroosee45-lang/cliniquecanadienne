// NEW-006 (rapport de correction du 11 sept. 2026) — dispatch(fetchLabResults({}))
// + dispatch(fetchCriticalResults()) dupliquaient à chaque montage la même
// requête que loadAnalyses() (api.get direct, même préfixe /laboratory?...),
// sans que reduxAnalyses/reduxCritical/reduxTotal ne soient jamais lus nulle
// part — vérifié par recherche projet-wide. Les deux dispatches Redux
// orphelins sont retirés.
//
// Monte le vrai composant Laboratory.jsx ; seule la frontière réseau
// (`../../api`) et useRealtimeRefresh sont simulées.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Laboratory from '../Laboratory.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

function renderLaboratory() {
  return render(<MemoryRouter><Laboratory /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/laboratory?')) return Promise.resolve({ data: { results: [], total: 0 } });
    return Promise.resolve({ data: {} });
  });
});

test('un seul appel réel à /laboratory au montage — jamais un double (ou triple) chargement concurrent (Redux orphelin retiré)', async () => {
  renderLaboratory();
  await screen.findByText('Tableau de bord');

  const calls = api.get.mock.calls.filter(([url]) => url.startsWith('/laboratory?'));
  expect(calls).toHaveLength(1);
});
