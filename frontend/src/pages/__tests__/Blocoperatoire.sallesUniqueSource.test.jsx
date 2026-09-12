// NEW-007 (rapport de correction du 11 sept. 2026) — dispatch(fetchBlocPlanning({}))
// dupliquait loadInterventions() (retiré, même famille que NEW-006).
// dispatch(fetchSalles()) était un cas différent : même endpoint
// (/blocoperatoire/salles) que loadStats() (état local `salles`), mais
// reduxSalles était réellement lu par 2 sélecteurs de salle + 1 repli du
// tableau de bord — pas un simple import mort. loadStats() est la source
// réellement tenue à jour (rappelée après chaque mutation réelle) ; le
// dispatch Redux, jamais rafraîchi après son unique appel au montage,
// pouvait diverger (une salle mise à jour dans le panneau d'occupation
// temps réel restait périmée dans les sélecteurs). Les 3 lectures de
// reduxSalles sont désormais rebranchées sur `salles`, seule source.
//
// Monte le vrai composant Blocoperatoire.jsx ; seule la frontière réseau
// (`../../api`) et useRealtimeRefresh sont simulées.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Blocoperatoire from '../Blocoperatoire.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const SALLE_REELLE = { id: 'BO-9', nom: 'Salle 9 — Test unique source' };

function renderBloc() {
  return render(<MemoryRouter><Blocoperatoire /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/blocoperatoire/planning')) return Promise.resolve({ data: { planning: [] } });
    if (url === '/blocoperatoire/salles') return Promise.resolve({ data: { salles: [SALLE_REELLE] } });
    if (url.startsWith('/patients')) return Promise.resolve({ data: { patients: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('un seul appel réel à /blocoperatoire/salles au montage — jamais un double chargement concurrent', async () => {
  renderBloc();
  await screen.findByText('Tableau de bord');

  const sallesCalls = api.get.mock.calls.filter(([url]) => url === '/blocoperatoire/salles');
  expect(sallesCalls).toHaveLength(1);
});

test('le sélecteur de salle "Nouvelle intervention" affiche la vraie salle chargée — jamais deux sources pouvant diverger', async () => {
  const user = userEvent.setup();
  renderBloc();
  await screen.findByText('Tableau de bord');

  const [newInterventionBtn] = await screen.findAllByRole('button', { name: /Nouvelle intervention/ });
  await user.click(newInterventionBtn);
  const dialog = await screen.findByRole('dialog');
  const label = within(dialog).getByText('Salle attribuée');
  const select = label.closest('div').querySelector('select');

  // Preuve non négociable : la vraie salle chargée (une seule fois) doit
  // apparaître dans le sélecteur — jamais le repli statique BO-1/BO-2/BO-3
  // affiché quand aucune vraie donnée n'est disponible.
  expect(within(select).getByText('Salle 9 — Test unique source')).toBeInTheDocument();
});
