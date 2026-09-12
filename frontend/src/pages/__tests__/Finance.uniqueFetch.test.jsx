// NEW-006 (rapport de correction du 11 sept. 2026) — dispatch(fetchInvoices({}))
// + dispatch(fetchFinanceStats()) appelaient à chaque montage /finance?...
// et /finance/stats — deux endpoints entièrement distincts de ceux
// réellement utilisés par loadData() (Promise.allSettled sur /finance/
// revenus, /depenses, /factures, /paiements, /assurances, /salaires,
// /kpis, tous api.get directs) — sans que reduxInvoices/reduxStats (ni
// createInvoice/recordPayment, également importés mais jamais appelés) ne
// soient jamais lus/utilisés nulle part. Vérifié par recherche
// projet-wide : deux appels réseau à des endpoints jamais consultés par
// l'affichage, purement gaspillés. Les deux dispatches Redux orphelins
// sont retirés.
//
// Monte le vrai composant Finance.jsx ; seule la frontière réseau
// (`../../api`) et useRealtimeRefresh sont simulées.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Finance from '../Finance.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

function renderFinance() {
  return render(<MemoryRouter><Finance /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(() => Promise.resolve({ data: {} }));
});

test('plus jamais d\'appel au thunk Redux mort (/finance?, /finance/stats) — Redux orphelin retiré, la vraie source (loadData) fonctionne toujours', async () => {
  renderFinance();
  await screen.findByText('Tableau de bord');

  // Preuve non négociable : ces deux endpoints n'ont jamais été consultés
  // par le moindre affichage — reduxInvoices/reduxStats n'étaient jamais
  // lus. Ils ne doivent plus jamais être appelés.
  expect(api.get.mock.calls.some(([url]) => url.startsWith('/finance?'))).toBe(false);
  expect(api.get.mock.calls.some(([url]) => url === '/finance/stats')).toBe(false);

  // La vraie source (loadData) doit toujours fonctionner intégralement.
  expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/finance/revenus'));
  expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/finance/factures'));
  expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/finance/kpis'));
});
