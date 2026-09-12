// PAT-05b (correction du 12 sept. 2026, audit indépendant) — la liste
// patients rechargeait toujours page:1/limit:100 : au-delà de 100 patients
// réels, la page suivante n'était jamais atteignable, aucune pagination
// réelle n'existait dans l'interface (total/page étaient pourtant déjà
// exposés par patientsSlice.js, jamais lus par Patients.jsx). Ce test
// prouve qu'avec plus de 100 patients réels, un vrai bouton "Suivant"
// apparaît et charge réellement la page 2 (deuxième vrai patient, jamais
// visible auparavant).
//
// Monte le vrai composant Patients.jsx avec le vrai reducer patientsSlice ;
// seule la frontière réseau (`../../api`) et useRealtimeRefresh sont simulées.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import patientsReducer from '../../store/slices/patientsSlice';
import Patients from '../Patients.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
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
    const u = new URL(url, 'http://x');
    if (u.pathname === '/patients') {
      const page = u.searchParams.get('page');
      if (page === '2') {
        return Promise.resolve({ data: { patients: [{ _id: 'p101', nom: 'Page2Seul', prenom: 'Patient', numero_dossier: 'DOS-101', statut: 'actif' }], total: 150 } });
      }
      return Promise.resolve({ data: { patients: [{ _id: 'p1', nom: 'Page1Patient', prenom: 'Test', numero_dossier: 'DOS-001', statut: 'actif' }], total: 150 } });
    }
    return Promise.resolve({ data: {} });
  });
});

test('PAT-05b — au-delà de 100 patients réels, "Suivant" charge réellement la page 2 (jamais plafonné à la page 1)', async () => {
  const user = userEvent.setup();
  renderPatients();

  await screen.findByText('DOS-001');
  await screen.findByText(/Page 1 \/ 2 · 150 patients/);
  expect(screen.queryByText('DOS-101')).not.toBeInTheDocument();

  await user.click(await screen.findByRole('button', { name: /Suivant/ }));

  await screen.findByText('DOS-101');
  expect(screen.queryByText('DOS-001')).not.toBeInTheDocument();
  await screen.findByText(/Page 2 \/ 2 · 150 patients/);
});
