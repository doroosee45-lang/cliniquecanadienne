// QA-002 — FE-BUG-001 (emplacement 1/5) : Urgences.jsx, le formulaire de
// "Nouvelle mission ambulance" affichait un faux succès ("✅ Mission ambulance
// ... assignée") ET fermait la modale même quand l'assignation réelle
// (POST /ambulances/missions, assignMissionThunk) échouait réellement.
// Corrigé (commit 78e2fd3) : sur rejet, un vrai toast.error est affiché et
// la modale reste ouverte (formAmb conservé).
//
// Monte le vrai composant Urgences.jsx avec le vrai réducteur Redux
// urgencesSlice (le vrai thunk assignMission s'exécute réellement, y compris
// son reducer assignMission.fulfilled qui pousse action.payload — un objet
// {ambulance:...} côté réponse réelle du backend — dans state.ambulances) —
// seule la frontière réseau (`../../api`) est simulée.
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import urgencesReducer from '../../store/slices/urgencesSlice';
import Urgences from '../Urgences.jsx';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') },
}));
import toast from 'react-hot-toast';

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

// useRealtimeRefresh exige un <SocketProvider> réel (socket.io-client, connexion
// réseau) — hors sujet pour ce test (comportement sur échec réel d'un dispatch),
// neutralisé plutôt que reconstruit.
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

// Laisse les effets de montage (fetchUrgencesStats/fetchUrgences/
// fetchAmbulances, tous mockés en promesses déjà résolues) se terminer et
// s'appliquer avant toute interaction.
async function settle() {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

async function renderUrgences() {
  const store = configureStore({ reducer: { urgences: urgencesReducer } });
  const utils = render(<Provider store={store}><MemoryRouter><Urgences /></MemoryRouter></Provider>);
  await settle();
  return utils;
}

async function openAmbulanceForm(user) {
  await user.click(await screen.findByRole('button', { name: 'Ambulances' }));
  await user.click(await screen.findByRole('button', { name: /Nouvelle mission/ }));
  const destination = await screen.findByPlaceholderText("Adresse d'intervention");
  await user.type(destination, "12 rue du Test");
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/urgences?'))   return Promise.resolve({ data: { urgences: [], total: 0 } });
    if (url === '/ambulances')          return Promise.resolve({ data: { ambulances: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('POST /ambulances/missions échoue réellement (500) → vrai échec affiché, la modale reste ouverte', async () => {
  const user = userEvent.setup();
  api.post.mockRejectedValue({ response: { data: { message: 'Erreur serveur réelle' } } });

  await renderUrgences();
  await openAmbulanceForm(user);
  await user.click(screen.getByRole('button', { name: /Dispatcher/ }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ambulances/missions', expect.any(Object)));

  // Preuve non négociable : jamais de faux succès sur un échec réel.
  expect(toast.success).not.toHaveBeenCalled();
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  // La modale doit rester ouverte — c'est exactement le bug corrigé (elle
  // se fermait malgré l'échec réel, laissant croire à une mission assignée).
  expect(screen.getByPlaceholderText("Adresse d'intervention")).toBeInTheDocument();
  await settle();
});

test('contrôle négatif — POST /ambulances/missions réussit réellement → vrai succès, la modale se ferme', async () => {
  const user = userEvent.setup();
  api.post.mockResolvedValue({ data: { ambulance: { numero: 'AMB-01', conducteur: 'Test', destination: '12 rue du Test', statut: 'en_mission' } } });

  await renderUrgences();
  await openAmbulanceForm(user);
  await user.click(screen.getByRole('button', { name: /Dispatcher/ }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ambulances/missions', expect.any(Object)));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect(toast.error).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByPlaceholderText("Adresse d'intervention")).not.toBeInTheDocument());
  await settle();
});
