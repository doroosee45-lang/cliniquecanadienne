// HOSP-01 (correction du 12 sept. 2026, audit indépendant) — les
// chambres/lits étaient récupérées deux fois : une fois via
// dispatch(fetchRooms()) (état Redux `rooms`, alimentant le sélecteur
// chambre→lit du formulaire d'admission), et une seconde fois via un appel
// direct api.get("/hospitalization/rooms") local à loadLits() (état local
// `lits`, alimentant l'onglet "Chambres & Lits") — deux copies indépendantes
// de la même donnée, chacune rafraîchie par des actions différentes
// (createHosp() ne rafraîchissait que fetchRooms(), discharge() ne
// rafraîchissait que loadLits()), pouvant donc diverger. Ce test prouve
// qu'un seul appel réel à /hospitalization/rooms a lieu au montage, et que
// l'onglet "Chambres & Lits" reflète bien les vraies données (dérivées de
// la même source unique), jamais un second fetch.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import hospitalizationReducer from '../../store/slices/hospitalizationSlice';
import Hospitalization from '../Hospitalization.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const ROOMS_FIXTURE = [
  { _id: 'room-1', numero: 'CH-101', service: { nom: 'Cardiologie' }, lits: [
    { _id: 'bed-1', numero: 'L1', statut: 'occupe', type: 'standard', patient_actuel: { prenom: 'Jean', nom: 'Mabiala' } },
    { _id: 'bed-2', numero: 'L2', statut: 'libre', type: 'standard' },
  ] },
];

function renderHospitalization() {
  const store = configureStore({ reducer: { hospitalization: hospitalizationReducer } });
  return render(<Provider store={store}><MemoryRouter><Hospitalization /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/hospitalization?')) return Promise.resolve({ data: { hospitalizations: [], total: 0 } });
    if (url === '/hospitalization/stats') return Promise.resolve({ data: { stats: {} } });
    if (url.startsWith('/patients?')) return Promise.resolve({ data: { patients: [] } });
    if (url === '/hospitalization/rooms') return Promise.resolve({ data: { rooms: ROOMS_FIXTURE } });
    return Promise.resolve({ data: {} });
  });
});

test('HOSP-01 — un seul appel réel à /hospitalization/rooms au montage, "Chambres & Lits" reflète la même source unique', async () => {
  const user = userEvent.setup();
  renderHospitalization();
  await screen.findByText('Tableau de bord');

  await user.click(await screen.findByRole('button', { name: /Chambres & Lits/ }));
  await screen.findAllByText(/CH-101/);

  const callsRooms = api.get.mock.calls.filter(([url]) => url === '/hospitalization/rooms');
  expect(callsRooms).toHaveLength(1, 'un seul fetch réel de /hospitalization/rooms doit avoir lieu, jamais un second fetch indépendant pour ce même onglet');

  // Les vraies données du lit occupé (dérivées de la même source `rooms`)
  // apparaissent réellement dans l'onglet Chambres & Lits.
  await screen.findByText(/Jean Mabiala/);
});
