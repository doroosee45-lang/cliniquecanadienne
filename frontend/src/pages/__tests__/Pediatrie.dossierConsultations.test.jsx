// PED-001 (audit du 11 sept. 2026) — le tableau "Consultations récentes" du
// dossier d'un enfant (Pediatrie.jsx, onglet "dossier") filtrait sur
// `c.enfant`, un champ qui n'a jamais existé sur PediatricConsultation
// (schéma réel : `child_id`, requis — backend/models/PediatricConsultation.js
// et controllers/pediatrieController.js::getOne, qui fait
// .populate('child_id', ...)). Le filtre comparait donc toujours `undefined`
// à l'_id de l'enfant et n'affichait jamais aucune consultation, même
// quand des consultations réelles existaient pour cet enfant.
//
// Monte le vrai composant Pediatrie.jsx avec le vrai reducer pediatrieSlice ;
// seule la frontière réseau (`../../api`) et useRealtimeRefresh sont simulées.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import pediatrieReducer from '../../store/slices/pediatrieSlice';
import Pediatrie from '../Pediatrie.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const ENFANT_FIXTURE = { _id: 'enfant-1', prenom: 'Jane', nom: 'Doe', numero: 'PED-001', sexe: 'F', vaccinations: [], mesures_croissance: [] };
// Forme réelle renvoyée par pediatrieController.js::getConsultations —
// child_id est peuplé (populate('child_id', ...)), jamais un champ `enfant`.
const CONSULTATION_FIXTURE = {
  _id: 'consult-1',
  child_id: { _id: 'enfant-1', prenom: 'Jane', nom: 'Doe' },
  motif: 'Fièvre',
  date: '2026-09-01T08:00:00.000Z',
  medecin: 'Dr Test',
};

function renderPediatrie() {
  const store = configureStore({ reducer: { pediatrie: pediatrieReducer } });
  return render(<Provider store={store}><MemoryRouter><Pediatrie /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/pediatrie/enfants?')) return Promise.resolve({ data: { enfants: [ENFANT_FIXTURE], total: 1 } });
    if (url.startsWith('/pediatrie/consultations')) return Promise.resolve({ data: { consultations: [CONSULTATION_FIXTURE], total: 1 } });
    if (url.startsWith('/pediatrie/urgences')) return Promise.resolve({ data: { urgences: [], total: 0 } });
    if (url.startsWith('/pediatrie/stats')) return Promise.resolve({ data: { stats: {}, repartitionAge: [], topPatho: [], chart: {} } });
    return Promise.resolve({ data: {} });
  });
});

test('une consultation réelle du dossier apparaît dans "Consultations récentes"', async () => {
  const user = userEvent.setup();
  renderPediatrie();

  await user.click(await screen.findByRole('button', { name: /Patients/ }));
  await user.click(await screen.findByRole('button', { name: /Ouvrir/ }));

  await screen.findByText('🩺 Consultations récentes');
  expect(screen.queryByText('Aucune consultation enregistrée')).not.toBeInTheDocument();
  expect(await screen.findByText('Fièvre')).toBeInTheDocument();
});
