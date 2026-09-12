// NEW-006 (rapport de correction du 11 sept. 2026) — dispatch(fetchPrescriptions({}))
// dupliquait à chaque montage la même requête que loadOrds() (api.get
// direct, même préfixe /prescriptions?...), sans que reduxOrdonnances/
// reduxTotal ne soient jamais lus nulle part — vérifié par recherche
// projet-wide (aucun autre fichier ne consomme fetchPrescriptions/
// selectPrescriptions/selectPrescriptionsLoading/selectPrescriptionsTotal
// de prescriptionsSlice — Urgences.jsx importe un sélecteur homonyme mais
// distinct, depuis urgencesSlice). Le dispatch Redux orphelin est retiré.
//
// Monte le vrai composant Prescriptions.jsx ; seule la frontière réseau
// (`../../api`) et useRealtimeRefresh sont simulées.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Prescriptions from '../Prescriptions.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

function renderPrescriptions() {
  return render(<MemoryRouter><Prescriptions /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/prescriptions?')) return Promise.resolve({ data: { prescriptions: [], total: 0 } });
    return Promise.resolve({ data: {} });
  });
});

test('un seul appel réel à /prescriptions au montage — jamais un double chargement concurrent (Redux orphelin retiré)', async () => {
  renderPrescriptions();
  await screen.findByText('Tableau de bord');

  const calls = api.get.mock.calls.filter(([url]) => url.startsWith('/prescriptions?'));
  expect(calls).toHaveLength(1);
});
