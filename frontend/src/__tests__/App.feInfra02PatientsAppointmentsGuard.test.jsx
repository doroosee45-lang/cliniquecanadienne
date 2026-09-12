// FE-INFRA-02 (correction du 12 sept. 2026, audit indépendant) —
// /patients, /patients/:id et /appointments n'avaient aucun Guard : un
// compte role:'patient' pouvait naviguer vers ces pages (bloquées ensuite
// uniquement par des 403 réels côté API, jamais un vrai blocage de
// navigation). Ce test monte la vraie App (vrai App.jsx, vrai
// AppRoutes/Guard/ROLES), seule la frontière réseau et les contextes
// temps réel/auth sont simulés, et prouve qu'un rôle non autorisé
// déclenche réellement le même mécanisme de refus que les 20+ autres
// routes déjà protégées (toast "Accès non autorisé" + redirection loin de
// la page), tandis qu'un rôle réellement autorisé par le backend
// (medecin) atteint toujours la page réelle.
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App.jsx';
import patientsReducer from '../store/slices/patientsSlice';
import appointmentsReducer from '../store/slices/appointmentsSlice';

const toastError = vi.fn();
vi.mock('react-hot-toast', () => {
  const toastFn = Object.assign(vi.fn(), { success: vi.fn(), error: (...a) => toastError(...a) });
  return { default: toastFn, toast: toastFn, Toaster: () => null };
});

vi.mock('../api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url.startsWith('/patients')) return Promise.resolve({ data: { patients: [], total: 0 } });
      if (url.startsWith('/appointments')) return Promise.resolve({ data: { appointments: [], total: 0 } });
      if (url.startsWith('/admin/users')) return Promise.resolve({ data: { users: [] } });
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn(), put: vi.fn(), delete: vi.fn(),
  },
}));

vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }) }));

let mockRole = 'patient';
vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ user: { _id: 'u1', prenom: 'Test', nom: 'Role', role: mockRole }, loading: false, logout: vi.fn() }),
}));

function renderAppAt(path) {
  const store = configureStore({ reducer: { patients: patientsReducer, appointments: appointmentsReducer } });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </Provider>
  );
}

beforeEach(() => { toastError.mockClear(); });

test('FE-INFRA-02 — un compte role:patient est réellement refusé sur /patients (même mécanisme que les routes déjà protégées)', async () => {
  mockRole = 'patient';
  renderAppAt('/patients');
  await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Accès non autorisé')));
  expect(screen.queryByText('Gestion des Patients')).not.toBeInTheDocument();
});

test('FE-INFRA-02 — un compte role:patient est réellement refusé sur /appointments', async () => {
  mockRole = 'patient';
  renderAppAt('/appointments');
  await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Accès non autorisé')));
});

test('FE-INFRA-02 — un rôle réellement autorisé par le backend (medecin) atteint toujours /patients, jamais de refus (non-régression)', async () => {
  mockRole = 'medecin';
  renderAppAt('/patients');
  await screen.findByText('Gestion des Patients');
  expect(toastError).not.toHaveBeenCalled();
});
