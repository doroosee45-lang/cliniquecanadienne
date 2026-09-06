// FE-BUG-015 (audit indépendant du 6 sept. 2026) — 6 actions d'Echographie.jsx
// (créer/planifier/annuler une demande, soumettre/valider/rejeter un
// rapport) dispatchaient un thunk Redux sans jamais l'attendre ni vérifier
// fulfilled/rejected : en cas d'échec réel du serveur, aucune erreur n'était
// affichée, et pour la création de demande, la modale se fermait quand même
// (faux succès visuel). Corrigé : chaque action attend réellement le
// résultat, n'affiche un succès qu'après un vrai succès serveur, affiche
// l'erreur réelle sinon, et ne ferme jamais prématurément la modale.
//
// Ce test couvre "createDemande" (le cas le plus visible : fermeture de
// modale) avec un échec réel simulé, puis un succès réel — représentatif
// des 6 corrections (même pattern `thunk.fulfilled.match(result)` partout).
// Monte le vrai composant Echographie.jsx avec le vrai reducer
// echographieSlice ; seule la frontière réseau (`../../api`) et
// useRealtimeRefresh sont simulées.
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import echographieReducer from '../../store/slices/echographieSlice';
import Echographie from '../Echographie.jsx';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
import toast from 'react-hot-toast';

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const SERVICE_FIXTURE = { _id: 'svc-1', nom: 'Maternité', statut: 'actif' };
const PATIENT_FIXTURE = { _id: 'pat-1', prenom: 'Jane', nom: 'Doe', numero_dossier: 'CLIN-2026-00099', sexe: 'F', date_naissance: '1990-01-01' };

function renderEchographie() {
  const store = configureStore({ reducer: { echographie: echographieReducer } });
  return render(<Provider store={store}><MemoryRouter><Echographie /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/echographie/stats')) return Promise.resolve({ data: {} });
    if (url.startsWith('/echographie?')) return Promise.resolve({ data: { demandes: [], total: 0 } });
    if (url.startsWith('/settings/services')) return Promise.resolve({ data: { services: [SERVICE_FIXTURE] } });
    if (url.startsWith('/patients/search')) return Promise.resolve({ data: { patients: [PATIENT_FIXTURE] } });
    return Promise.resolve({ data: {} });
  });
});

async function fillAndSubmit(user) {
  await user.click(await screen.findByRole('button', { name: /Nouvelle demande/ }));
  const dialog = await screen.findByRole('dialog');

  const searchInput = screen.getByRole('textbox', { name: /Rechercher un patient/ });
  await user.type(searchInput, 'Jane');
  const patientResult = await screen.findByText('Jane Doe');
  await user.click(patientResult);

  const serviceSelect = screen.getByDisplayValue('Sélectionner un service…');
  await user.selectOptions(serviceSelect, 'Maternité');

  // userEvent.click() sur le bouton submit ne déclenche pas de façon fiable
  // l'événement "submit" natif dans cet environnement jsdom/user-event —
  // fireEvent.submit() exerce le même chemin de code réel (le vrai
  // onSubmit={handleSubmit} du formulaire), sans affaiblir la preuve.
  const submitBtn = screen.getByRole('button', { name: /Créer la demande/ });
  fireEvent.submit(submitBtn.closest('form'));
  return dialog;
}

test('création de demande — échec réel du serveur : la modale reste ouverte, aucun faux succès', async () => {
  const user = userEvent.setup();
  api.post.mockRejectedValue({ response: { data: { message: 'Erreur serveur réelle' } } });

  renderEchographie();
  await fillAndSubmit(user);

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/echographie', expect.objectContaining({ patient: 'pat-1' })));

  // Preuve non négociable : jamais un succès affiché, jamais la modale
  // fermée sur un échec réel du serveur.
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erreur serveur réelle'));
  expect(toast.success).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

test('création de demande — succès réel du serveur : la modale se ferme, vrai succès affiché', async () => {
  const user = userEvent.setup();
  api.post.mockResolvedValue({ data: { demande: { _id: 'echo-1', numero: 'ECH-2026-0001', statut: 'en_attente' } } });

  renderEchographie();
  await fillAndSubmit(user);

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/echographie', expect.objectContaining({ patient: 'pat-1' })));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('créée')));
  expect(toast.error).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
