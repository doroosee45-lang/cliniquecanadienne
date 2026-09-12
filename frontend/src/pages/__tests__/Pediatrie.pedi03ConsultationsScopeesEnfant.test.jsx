// PEDI-03 (correction du 12 sept. 2026, audit indépendant) — le panneau
// "Consultations récentes" du dossier d'un enfant filtrait le snapshot
// global des 50 dernières consultations de TOUTE la clinique : une
// consultation réelle plus ancienne de cet enfant, poussée hors des 50
// plus récentes par d'autres enfants, n'apparaissait jamais dans son
// contexte alors qu'elle existe réellement en base. Ce test prouve que le
// panneau charge désormais réellement les consultations de CET enfant
// (GET /pediatrie/consultations?child_id=...), jamais un filtre sur un
// snapshot global tronqué.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import pediatrieReducer from '../../store/slices/pediatrieSlice';
import Pediatrie from '../Pediatrie.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const ENFANT = { _id: 'enfant-vieux', prenom: 'Ancien', nom: 'Patient', date_naissance: '2015-01-01', sexe: 'M', vaccinations: [] };
// La consultation réelle de cet enfant est ANCIENNE — absente des "50
// dernières" globales (simulées vides ici), mais bien réelle en base pour
// cet enfant précis.
const CONSULTATION_ANCIENNE_DE_CET_ENFANT = {
  _id: 'consult-ancienne', child_id: 'enfant-vieux', motif: 'Bilan ancien réel', type: 'consultation',
  date: '2020-01-01T00:00:00.000Z', medecin: 'Dr Test',
};

function renderPediatrie() {
  const store = configureStore({ reducer: { pediatrie: pediatrieReducer } });
  return render(<Provider store={store}><MemoryRouter><Pediatrie /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/pediatrie/enfants')) return Promise.resolve({ data: { enfants: [ENFANT], total: 1 } });
    // Snapshot global des 50 dernières consultations : ne contient PAS la
    // consultation ancienne de cet enfant (poussée hors des 50 plus
    // récentes par d'autres enfants).
    if (url.startsWith('/pediatrie/consultations?child_id=enfant-vieux')) {
      return Promise.resolve({ data: { consultations: [CONSULTATION_ANCIENNE_DE_CET_ENFANT], total: 1 } });
    }
    if (url.startsWith('/pediatrie/consultations')) return Promise.resolve({ data: { consultations: [], total: 0 } });
    if (url.startsWith('/pediatrie/urgences')) return Promise.resolve({ data: { urgences: [], total: 0 } });
    if (url.startsWith('/pediatrie/stats')) return Promise.resolve({ data: { stats: {}, repartitionAge: [], topPatho: [], chart: {} } });
    return Promise.resolve({ data: {} });
  });
});

test('PEDI-03 — le dossier d\'un enfant affiche réellement ses consultations, même absentes des 50 dernières globales', async () => {
  const user = userEvent.setup();
  renderPediatrie();

  await user.click(await screen.findByRole('button', { name: /Patients/ }));
  await user.click(await screen.findByRole('button', { name: /Ouvrir/ }));

  await vi.waitFor(() => {
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/pediatrie/consultations?child_id=enfant-vieux'));
  });
  await screen.findByText('Bilan ancien réel');
});
