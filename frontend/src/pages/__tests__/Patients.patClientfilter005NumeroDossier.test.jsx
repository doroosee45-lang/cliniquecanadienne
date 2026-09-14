// PAT-CLIENTFILTER-005 (audit métier du 13 sept. 2026, Phase 4) — le filtre
// de recherche côté client comparait `${p.prenom} ${p.nom} ${p.numero}`,
// mais `numero` n'existe pas sur le document Patient (le champ réel est
// `numero_dossier`, voir Patient.js) : ce fragment de la recherche client
// était un no-op silencieux. Sans conséquence grave (la recherche réelle
// est déjà faite côté serveur), mais une fois qu'une page de résultats est
// chargée, retaper une recherche par numéro de dossier ne filtrait plus
// rien client-side tant qu'une nouvelle requête serveur n'était pas
// déclenchée. Ce test prouve que le filtre client reconnaît désormais
// réellement numero_dossier.
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

const PATIENTS_FIXTURE = [
  { _id: 'p1', nom: 'Mabiala', prenom: 'Jean', numero_dossier: 'DOS-2026-0042', statut: 'actif' },
  { _id: 'p2', nom: 'Nzoumba', prenom: 'Marie', numero_dossier: 'DOS-2026-0099', statut: 'actif' },
];

function renderPatients() {
  const store = configureStore({ reducer: { patients: patientsReducer } });
  return render(<Provider store={store}><MemoryRouter><Patients /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    const u = new URL(url, 'http://x');
    if (u.pathname === '/patients') return Promise.resolve({ data: { patients: PATIENTS_FIXTURE, total: 2 } });
    return Promise.resolve({ data: {} });
  });
});

test('PAT-CLIENTFILTER-005 — la recherche client par numéro de dossier filtre réellement la liste déjà chargée', async () => {
  const user = userEvent.setup();
  renderPatients();

  await screen.findByText('DOS-2026-0042');
  await screen.findByText('DOS-2026-0099');

  const searchInput = screen.getByPlaceholderText(/Nom, prénom, n° dossier/);
  await user.type(searchInput, '0099');

  expect(screen.queryByText('DOS-2026-0042')).not.toBeInTheDocument();
  expect(screen.getByText('DOS-2026-0099')).toBeInTheDocument();
});

test('PAT-CLIENTFILTER-005 — non-régression — la recherche par nom/prénom continue de fonctionner', async () => {
  const user = userEvent.setup();
  renderPatients();

  await screen.findByText('DOS-2026-0042');
  const searchInput = screen.getByPlaceholderText(/Nom, prénom, n° dossier/);
  await user.type(searchInput, 'mabiala');

  expect(screen.getByText('DOS-2026-0042')).toBeInTheDocument();
  expect(screen.queryByText('DOS-2026-0099')).not.toBeInTheDocument();
});
