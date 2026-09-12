// MAT-02 (correction du 12 sept. 2026, audit indépendant) —
// materniteSlice.js renseignait déjà réellement state.error à l'échec de
// fetchGrossesses, et selectMaterniteError était même déjà importé par
// Maternite.jsx, mais jamais invoqué : un échec réseau produisait une
// liste vide indiscernable d'une base réellement sans grossesse. Ce test
// prouve qu'un échec réel de chargement est désormais signalé
// explicitement à l'utilisateur.
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import materniteReducer from '../../store/slices/materniteSlice';
import Maternite from '../Maternite.jsx';

const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: (...a) => toastError(...a) }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

function renderMaternite() {
  const store = configureStore({ reducer: { maternite: materniteReducer } });
  return render(<Provider store={store}><MemoryRouter><Maternite /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/maternite/grossesses?')) return Promise.reject({ response: { data: { message: 'Erreur serveur réelle' } } });
    if (url.startsWith('/maternite/accouchements')) return Promise.resolve({ data: { accouchements: [], total: 0 } });
    if (url.startsWith('/maternite/nouveau-nes')) return Promise.resolve({ data: { nouveaunes: [], total: 0 } });
    if (url.startsWith('/maternite/stats')) return Promise.resolve({ data: {} });
    return Promise.resolve({ data: {} });
  });
});

test('MAT-02 — un échec réel de chargement des grossesses est signalé explicitement, jamais une liste vide silencieuse', async () => {
  renderMaternite();

  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Erreur serveur réelle'));
  });
});
