// NEW-006 (rapport de correction du 11 sept. 2026) — dispatch(fetchRadiologyExams({}))
// dupliquait à chaque montage la même requête que loadExamens() (api.get
// direct, même préfixe /radiology?...), sans que reduxExamens/reduxTotal
// ne soient jamais lus nulle part — vérifié par recherche projet-wide. Le
// dispatch Redux orphelin est retiré.
//
// Monte le vrai composant Radiology.jsx ; seule la frontière réseau
// (`../../api`) et useRealtimeRefresh sont simulées.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Radiology from '../Radiology.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

function renderRadiology() {
  return render(<MemoryRouter><Radiology /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/radiology?')) return Promise.resolve({ data: { examens: [], total: 0 } });
    return Promise.resolve({ data: {} });
  });
});

test('un seul appel réel à /radiology au montage — jamais un double chargement concurrent (Redux orphelin retiré)', async () => {
  renderRadiology();
  await screen.findByText('Tableau de bord');

  const calls = api.get.mock.calls.filter(([url]) => url.startsWith('/radiology?'));
  expect(calls).toHaveLength(1);
});
