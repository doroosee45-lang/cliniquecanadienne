// ACCES-PHARMACIE-001 (correction du 13 sept. 2026) — le module Pharmacie
// est désormais exclusivement réservé à pharmacien (+ infirmier, inchangé) :
// ROLES.pharmacie (App.jsx) n'inclut plus 'medecin'. Même principe que
// FE-INFRA-02 (App.feInfra02PatientsAppointmentsGuard.test.jsx) : monte la
// vraie App (vrai App.jsx, vrai AppRoutes/Guard/ROLES), navigue directement
// vers /pharmacy par son URL, et prouve qu'un médecin est réellement refusé
// (même mécanisme que les autres routes protégées), tandis qu'un pharmacien
// atteint toujours la vraie page.
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App.jsx';

const toastError = vi.fn();
vi.mock('react-hot-toast', () => {
  const toastFn = Object.assign(vi.fn(), { success: vi.fn(), error: (...a) => toastError(...a) });
  return { default: toastFn, toast: toastFn, Toaster: () => null };
});

vi.mock('../api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url.startsWith('/pharmacy')) return Promise.resolve({ data: { medications: [], total: 0 } });
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn(), put: vi.fn(), delete: vi.fn(),
  },
}));

vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }) }));

let mockRole = 'medecin';
vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ user: { _id: 'u1', prenom: 'Test', nom: 'Role', role: mockRole }, loading: false, logout: vi.fn() }),
}));

function renderAppAt(path) {
  const store = configureStore({ reducer: {} });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </Provider>
  );
}

beforeEach(() => { toastError.mockClear(); });

test('ACCES-PHARMACIE-001 — un compte role:medecin est réellement refusé sur /pharmacy (URL directe)', async () => {
  mockRole = 'medecin';
  renderAppAt('/pharmacy');
  await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Accès non autorisé')));
  expect(screen.queryByText('Module Pharmacie')).not.toBeInTheDocument();
});

test('ACCES-PHARMACIE-001 — un pharmacien atteint toujours /pharmacy, jamais de refus (non-régression)', async () => {
  mockRole = 'pharmacien';
  renderAppAt('/pharmacy');
  await screen.findByText('Module Pharmacie', {}, { timeout: 15000 });
  expect(toastError).not.toHaveBeenCalled();
});
