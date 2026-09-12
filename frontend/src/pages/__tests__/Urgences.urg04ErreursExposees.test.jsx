// URG-04 (correction du 12 sept. 2026, audit indépendant) — aucune
// distinction n'existait entre erreur réseau, absence de données et état
// réellement vide, pour la liste comme pour le dossier d'une urgence.
// (1) selectUrgencesError était déjà réellement renseigné par
// fetchUrgences.rejected, mais jamais lu. (2) fetchDossierData utilisait
// Promise.allSettled et substituait silencieusement [] à toute section
// (soins/prescriptions/examens/historique) dont le sous-fetch échouait
// réellement — indiscernable d'un patient qui n'a réellement rien
// enregistré. Ce test prouve que les deux échecs sont désormais signalés
// explicitement à l'utilisateur.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import urgencesReducer from '../../store/slices/urgencesSlice';
import Urgences from '../Urgences.jsx';

const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: (...a) => toastError(...a), loading: vi.fn(() => 'toast-id') }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const URG_FIXTURE = {
  _id: 'urg-1', numero: 'URG-2026-0001', patient_nom: 'Jean Mabiala',
  niveau_triage: 'orange', statut: 'attente', motif: 'Douleur thoracique',
  date_arrivee: new Date().toISOString(),
};

function renderUrgences() {
  const store = configureStore({ reducer: { urgences: urgencesReducer } });
  return render(<Provider store={store}><MemoryRouter><Urgences /></MemoryRouter></Provider>);
}

test('URG-04 — un échec réel de chargement de la liste des urgences est signalé explicitement', async () => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/urgences?')) return Promise.reject({ response: { data: { message: 'Erreur serveur réelle' } } });
    if (url === '/urgences/stats') return Promise.resolve({ data: { kpis: {}, triageMap: {}, chart: {} } });
    return Promise.resolve({ data: {} });
  });
  renderUrgences();

  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Erreur serveur réelle'));
  });
});

test('URG-04 — un échec réel d\'une section du dossier (soins) est signalé explicitement, jamais une simple liste vide', async () => {
  vi.clearAllMocks();
  const user = userEvent.setup();
  api.get.mockImplementation((url) => {
    if (url === '/urgences/stats') return Promise.resolve({ data: { kpis: {}, triageMap: {}, chart: {} } });
    if (url.startsWith('/urgences?')) return Promise.resolve({ data: { urgences: [URG_FIXTURE], total: 1 } });
    if (url === '/ambulances') return Promise.resolve({ data: { ambulances: [] } });
    if (url === '/urgences/urg-1') return Promise.resolve({ data: { invoice: null } });
    if (url === '/urgences/urg-1/soins') return Promise.reject({ response: { data: { message: 'Erreur serveur réelle' } } });
    if (url.startsWith('/urgences/urg-1/')) return Promise.resolve({ data: {} });
    return Promise.resolve({ data: {} });
  });
  renderUrgences();

  const rows = await screen.findAllByText('Jean Mabiala');
  const row = rows.map((el) => el.closest('.urgence-row')).find(Boolean);
  await user.click(row);

  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('soins'));
  });
});
