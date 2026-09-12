// PAT-04 (correction du 12 sept. 2026, audit indépendant) — patientsSlice.js
// renseignait déjà réellement state.error à l'échec de fetchPatients, mais
// selectPatientsError n'était jamais importé par Patients.jsx : un échec
// réseau produisait une liste de patients vide, indiscernable d'une base
// réellement sans patient. Ce test prouve qu'un échec réel de chargement
// est désormais signalé explicitement à l'utilisateur.
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import patientsReducer from '../../store/slices/patientsSlice';
import Patients from '../Patients.jsx';

const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: (...a) => toastError(...a) }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

function renderPatients() {
  const store = configureStore({ reducer: { patients: patientsReducer } });
  return render(<Provider store={store}><MemoryRouter><Patients /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/patients?')) return Promise.reject({ response: { data: { message: 'Erreur serveur réelle' } } });
    return Promise.resolve({ data: {} });
  });
});

test('PAT-04 — un échec réel de chargement des patients est signalé explicitement, jamais une liste vide silencieuse', async () => {
  renderPatients();

  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Erreur serveur réelle'));
  });
});
