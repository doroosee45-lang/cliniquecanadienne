// FE-BUG-017 (audit indépendant du 6 sept. 2026) — le bouton "Sauvegarder la
// check-list" affichait un succès inconditionnel (toast.success) juste après
// avoir déclenché updateInterv() SANS l'attendre : en cas d'échec réel du
// serveur, l'utilisateur voyait à la fois l'erreur réelle de updateInterv()
// ET ce faux succès contradictoire.
//
// Corrigé : le toast local redondant est retiré — updateInterv() gère déjà
// honnêtement son propre succès/échec (vérifié dans sa définition), le
// bouton suit maintenant le même motif que les 4 autres boutons
// "Enregistrer" de ce fichier (disabled={saving}, aucun toast local).
//
// Monte le vrai composant Blocoperatoire.jsx ; seule la frontière réseau
// (`../../api`) est simulée.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import blocoperatoireReducer from '../../store/slices/blocoperatoireSlice';
import Blocoperatoire from '../Blocoperatoire.jsx';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
import toast from 'react-hot-toast';

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const INTERV_FIXTURE = {
  _id: 'bloc-1', numero: 'BLOC-2026-0001', statut: 'programmee',
  patient_nom: 'Jane Doe', type_intervention: 'Appendicectomie', checklist_done: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/blocoperatoire/planning?')) return Promise.resolve({ data: { planning: [INTERV_FIXTURE], total: 1 } });
    if (url.startsWith('/blocoperatoire/salles')) return Promise.resolve({ data: { salles: [] } });
    if (url.startsWith('/patients')) return Promise.resolve({ data: { patients: [] } });
    if (url.startsWith('/blocoperatoire/bloc-1/facture')) return Promise.resolve({ data: { invoice: null } });
    return Promise.resolve({ data: {} });
  });
});

function renderBloc() {
  const store = configureStore({ reducer: { blocoperatoire: blocoperatoireReducer } });
  return render(<Provider store={store}><MemoryRouter><Blocoperatoire /></MemoryRouter></Provider>);
}

async function openChecklist(user) {
  renderBloc();
  await user.click(await screen.findByRole('button', { name: /Ouvrir/ }));
  await user.click(await screen.findByRole('button', { name: /Check-list/ }));
  return screen.findByRole('button', { name: /Sauvegarder la check-list/ });
}

test('échec réel du serveur : aucun faux succès affiché en plus de l\'erreur réelle', async () => {
  const user = userEvent.setup();
  api.put.mockRejectedValue({ response: { data: { message: 'Erreur serveur réelle' } } });

  const saveBtn = await openChecklist(user);
  await user.click(saveBtn);

  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/blocoperatoire/planning/bloc-1', expect.any(Object)));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  // Preuve non négociable : plus de toast.success fabriqué en plus de
  // l'erreur réelle affichée par updateInterv().
  expect(toast.success).not.toHaveBeenCalled();
});

test('contrôle négatif — succès réel du serveur : le vrai message de updateInterv() s\'affiche', async () => {
  const user = userEvent.setup();
  api.put.mockResolvedValue({ data: { intervention: { ...INTERV_FIXTURE, checklist_done: true } } });

  const saveBtn = await openChecklist(user);
  await user.click(saveBtn);

  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/blocoperatoire/planning/bloc-1', expect.any(Object)));
  await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
  expect(toast.error).not.toHaveBeenCalled();
});
