// PEDI-02 (correction du 12 sept. 2026, audit indépendant) —
// pediatrieSlice.js renseignait déjà réellement state.error à l'échec de
// fetchEnfants, mais selectPediatrieError n'était même pas importé par
// Pediatrie.jsx : un échec réseau produisait une liste vide indiscernable
// d'une base réellement sans enfant. Ce test prouve qu'un échec réel de
// chargement est désormais signalé explicitement à l'utilisateur.
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import pediatrieReducer from '../../store/slices/pediatrieSlice';
import Pediatrie from '../Pediatrie.jsx';

const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: (...a) => toastError(...a) }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

function renderPediatrie() {
  const store = configureStore({ reducer: { pediatrie: pediatrieReducer } });
  return render(<Provider store={store}><MemoryRouter><Pediatrie /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/pediatrie/enfants')) return Promise.reject({ response: { data: { message: 'Erreur serveur réelle' } } });
    if (url.startsWith('/pediatrie/consultations')) return Promise.resolve({ data: { consultations: [], total: 0 } });
    if (url.startsWith('/pediatrie/urgences')) return Promise.resolve({ data: { urgences: [], total: 0 } });
    if (url.startsWith('/pediatrie/stats')) return Promise.resolve({ data: { stats: {}, repartitionAge: [], topPatho: [], chart: {} } });
    return Promise.resolve({ data: {} });
  });
});

test('PEDI-02 — un échec réel de chargement des enfants est signalé explicitement, jamais une liste vide silencieuse', async () => {
  renderPediatrie();

  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Erreur serveur réelle'));
  });
});
