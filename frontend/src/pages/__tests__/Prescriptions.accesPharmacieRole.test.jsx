// ACCES-PHARMACIE-001 (correction du 13 sept. 2026) — l'onglet "Pharmacie"
// de la modale d'ordonnance (stock réel + délivrance, GET /pharmacy) était
// affiché à n'importe quel rôle pouvant ouvrir Prescriptions.jsx, medecin
// inclus : un médecin pouvait consulter des données du module Pharmacie qui
// ne le concernent pas. Réservé désormais aux mêmes rôles que le backend
// (pharmacy.routes.js::CAN_READ, désormais sans 'medecin').
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Prescriptions from '../Prescriptions.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

let mockRole = 'medecin';
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: mockRole } }),
}));

const ORD_FIXTURE = {
  _id: 'ord-1', numero_rx: 'RX-TEST-001', patient_nom: 'Jane Doe',
  medecin: 'Dr Test', statut: 'publiee', medicaments: [{ medicament: 'Paracétamol' }],
};

function renderPrescriptions() {
  return render(<MemoryRouter><Prescriptions /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/prescriptions?')) return Promise.resolve({ data: { prescriptions: [ORD_FIXTURE], total: 1 } });
    return Promise.resolve({ data: {} });
  });
});

async function openOrdonnance(user) {
  await user.click(await screen.findByRole('button', { name: /Historique/ }));
  await user.click(await screen.findByTitle("Voir l'ordonnance"));
}

test('un médecin ne voit pas l\'onglet "Pharmacie" dans une ordonnance ouverte', async () => {
  mockRole = 'medecin';
  const user = userEvent.setup();
  renderPrescriptions();
  await openOrdonnance(user);

  await screen.findByRole('button', { name: /Validation/ }); // la modale est bien ouverte
  expect(screen.queryByRole('button', { name: /Pharmacie/ })).not.toBeInTheDocument();
  // Défense en profondeur : même si l'onglet était forcé par un autre biais,
  // aucun appel réel à /pharmacy ne doit jamais partir pour ce rôle.
  expect(api.get.mock.calls.some(([url]) => url.startsWith('/pharmacy'))).toBe(false);
});

test('un pharmacien voit bien l\'onglet "Pharmacie" et peut y accéder', async () => {
  mockRole = 'pharmacien';
  const user = userEvent.setup();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/prescriptions?')) return Promise.resolve({ data: { prescriptions: [ORD_FIXTURE], total: 1 } });
    if (url.startsWith('/pharmacy')) return Promise.resolve({ data: { medications: [] } });
    return Promise.resolve({ data: {} });
  });
  renderPrescriptions();
  await openOrdonnance(user);

  const pharmacieTab = await screen.findByRole('button', { name: /Pharmacie/ });
  await user.click(pharmacieTab);
  await screen.findByText(/Liaison Pharmacie/);
});

test('un infirmier voit également l\'onglet "Pharmacie" (accès backend déjà existant, inchangé)', async () => {
  mockRole = 'infirmier';
  const user = userEvent.setup();
  renderPrescriptions();
  await openOrdonnance(user);
  await screen.findByRole('button', { name: /Pharmacie/ });
});
