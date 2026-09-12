// APPT-04 (correction du 12 sept. 2026, audit indépendant) —
// appointmentsSlice.js renseignait déjà réellement state.error à l'échec de
// fetchAppointments, mais aucun sélecteur ne l'exposait et Appointments.jsx
// ne le lisait jamais : un échec réseau produisait une liste de rendez-vous
// vide, indiscernable d'une journée réellement sans rendez-vous. Ce test
// prouve qu'un échec réel de chargement est désormais signalé
// explicitement à l'utilisateur.
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import appointmentsReducer from '../../store/slices/appointmentsSlice';
import Appointments from '../Appointments.jsx';

const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: (...a) => toastError(...a) }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

function renderAppointments() {
  const store = configureStore({ reducer: { appointments: appointmentsReducer } });
  return render(<Provider store={store}><MemoryRouter><Appointments /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/appointments?')) return Promise.reject({ response: { data: { message: 'Erreur serveur réelle' } } });
    return Promise.resolve({ data: {} });
  });
});

test('APPT-04 — un échec réel de chargement des rendez-vous est signalé explicitement, jamais une liste vide silencieuse', async () => {
  renderAppointments();
  await screen.findByText('Tableau de bord');

  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Erreur serveur réelle'));
  });
});
