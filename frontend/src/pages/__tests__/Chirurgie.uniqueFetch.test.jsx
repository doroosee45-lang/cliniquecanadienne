// NEW-006 (rapport de correction du 11 sept. 2026) — dispatch(fetchSurgeries({}))
// dupliquait à chaque montage la même requête que loadDossiers() (api.get
// direct), sans que reduxSurgeries/reduxTotal/reduxStats/createSurgery/
// updateSurgery ne soient jamais lus ni appelés nulle part — vérifié par
// recherche projet-wide (aucun autre fichier ne les consomme). Le dispatch
// Redux orphelin est retiré ; l'état local (déjà pourvu de pagination/
// recherche/filtre/erreur) reste la seule source.
//
// Monte le vrai composant Chirurgie.jsx ; seule la frontière réseau
// (`../../api`) et useRealtimeRefresh sont simulées.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Chirurgie from '../Chirurgie.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

function renderChirurgie() {
  return render(<MemoryRouter><Chirurgie /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/chirurgie/stats')) return Promise.resolve({ data: { kpis: {} } });
    if (url.startsWith('/chirurgie?')) return Promise.resolve({ data: { dossiers: [], total: 0 } });
    if (url.startsWith('/patients?')) return Promise.resolve({ data: { patients: [] } });
    if (url.startsWith('/admin/users?')) return Promise.resolve({ data: { users: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('un seul appel réel à /chirurgie au montage — jamais un double chargement concurrent (Redux orphelin retiré)', async () => {
  renderChirurgie();
  await screen.findByText('Tableau de bord');

  const dossiersCalls = api.get.mock.calls.filter(([url]) => url.startsWith('/chirurgie?'));
  expect(dossiersCalls).toHaveLength(1);
});
