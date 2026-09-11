// MAT-002 (audit du 11 sept. 2026) — les sélecteurs "Médecin responsable"
// (ModalDossier) et "Obstétricien" (ModalAccouchement) proposaient deux noms
// fictifs codés en dur ("Dr. Koffi", "Dr. Bello") — jamais des médecins
// réels du personnel. medecin_responsable/obstetricien sont de simples
// String côté backend (models/Pregnancy.js, models/Delivery.js), donc pas de
// migration de schéma nécessaire : seule la source de la liste devait
// changer, vers GET /admin/users?role=medecin (même source déjà utilisée
// pour le même besoin dans Chirurgie.jsx/Appointments.jsx/Patients.jsx).
//
// Monte le vrai composant Maternite.jsx avec le vrai reducer
// materniteSlice ; seule la frontière réseau (`../../api`) et
// useRealtimeRefresh sont simulées.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import materniteReducer from '../../store/slices/materniteSlice';
import Maternite from '../Maternite.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const MEDECIN_FIXTURE = { _id: 'med-1', prenom: 'Alice', nom: 'Mabiala', role: 'medecin' };

function renderMaternite() {
  const store = configureStore({ reducer: { maternite: materniteReducer } });
  return render(<Provider store={store}><MemoryRouter><Maternite /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/maternite/grossesses?')) return Promise.resolve({ data: { grossesses: [], total: 0 } });
    if (url.startsWith('/maternite/accouchements')) return Promise.resolve({ data: { accouchements: [], total: 0 } });
    if (url.startsWith('/maternite/nouveau-nes')) return Promise.resolve({ data: { nouveaunes: [], total: 0 } });
    if (url.startsWith('/maternite/stats')) return Promise.resolve({ data: {} });
    if (url.startsWith('/admin/users?role=medecin')) return Promise.resolve({ data: { users: [MEDECIN_FIXTURE] } });
    return Promise.resolve({ data: {} });
  });
});

test('ModalDossier propose un vrai médecin du personnel, jamais "Dr. Koffi"/"Dr. Bello"', async () => {
  const user = userEvent.setup();
  renderMaternite();

  await user.click(await screen.findByRole('button', { name: /Nouveau dossier/ }));
  const dialog = await screen.findByRole('dialog');
  const label = within(dialog).getByText('Médecin responsable');
  const select = label.closest('.mat-field').querySelector('select');

  expect(within(select).getByText('Dr. Alice Mabiala')).toBeInTheDocument();
  expect(within(select).queryByText(/Koffi/)).not.toBeInTheDocument();
  expect(within(select).queryByText(/Bello/)).not.toBeInTheDocument();
});
