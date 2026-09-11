// QA-002 — FE-BUG-001 (emplacement 3/5) : Administration.jsx::saveUser
// fabriquait un faux utilisateur local (_id: Date.now().toString()) et
// affichait "Créé (local)" quand la création réelle (POST /admin/users)
// échouait réellement. Corrigé : plus aucune fabrication de données sur
// échec, une vraie erreur est affichée, la liste n'est modifiée que par un
// vrai succès (suivi de loadAll()).
//
// Monte le vrai composant Administration.jsx — saveUser est un appel axios
// direct ; seule la frontière réseau (`../../api`) est simulée.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import administrationReducer from '../../store/slices/administrationSlice';
import Administration from '../Administration.jsx';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') },
}));
import toast from 'react-hot-toast';

// P1-01 — "Nouvel utilisateur" est désormais réservé à isSuperadmin (le
// backend l'exige déjà, authorize('superadmin') strict) ; ce test exerce
// précisément ce flux de création, donc un compte superadmin réel est le
// bon persona à simuler ici — pas un contournement de la garde.
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Superadmin', role: 'superadmin' } }),
}));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

function renderAdministration() {
  const store = configureStore({ reducer: { administration: administrationReducer } });
  return render(<Provider store={store}><Administration /></Provider>);
}

async function openNewUserModal(user) {
  await user.click(await screen.findByRole('button', { name: 'Gestion & Opérations' }));
  await user.click(await screen.findByRole('button', { name: /Nouvel utilisateur/ }));
  await user.type(await screen.findByPlaceholderText('Prénom'), 'Test');
  await user.type(screen.getByPlaceholderText('Nom de famille'), 'Regression');
  await user.type(screen.getByPlaceholderText('email@clinique.cg'), `test-${Date.now()}@clinique.cg`);
  await user.type(screen.getByPlaceholderText('Minimum 8 caractères'), 'Xx1aaaaa!');
}

beforeEach(() => {
  vi.clearAllMocks();
  // api.get renvoie systématiquement un échec (allSettled) → repli DEMO_USERS
  // réel du composant, pas une fabrication de ce test : loadAll() a déjà ce
  // filet de sécurité pour son propre chargement, indépendant du bug testé
  // ici (qui porte sur l'ÉCRITURE, saveUser, pas la lecture).
  api.get.mockRejectedValue(new Error('réseau indisponible'));
});

test('POST /admin/users échoue réellement (500) → vraie erreur affichée, aucun faux compte créé', async () => {
  const user = userEvent.setup();
  api.post.mockRejectedValue({ response: { data: { message: 'Erreur serveur réelle' } } });

  renderAdministration();
  await openNewUserModal(user);
  await user.click(screen.getByRole('button', { name: 'Créer le compte' }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/users', expect.objectContaining({ prenom: 'Test', nom: 'Regression' })));

  // Preuve non négociable : jamais de faux succès sur un échec réel.
  expect(toast.success).not.toHaveBeenCalled();
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  // Aucun faux utilisateur "Test Regression" ne doit apparaître dans la
  // liste — c'est exactement le bug corrigé (un compte local fabriqué
  // apparaissait malgré l'échec réel de la création).
  expect(screen.queryByText('Test Regression')).not.toBeInTheDocument();
  // La modale doit rester ouverte pour permettre de corriger/réessayer.
  expect(screen.getByRole('button', { name: 'Créer le compte' })).toBeInTheDocument();
});

test('contrôle négatif — POST /admin/users réussit réellement → vrai succès, modale fermée', async () => {
  const user = userEvent.setup();
  api.post.mockResolvedValue({ data: { user: { _id: 'u1', prenom: 'Test', nom: 'Regression', role: 'medecin' } } });

  renderAdministration();
  await openNewUserModal(user);
  await user.click(screen.getByRole('button', { name: 'Créer le compte' }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/users', expect.objectContaining({ prenom: 'Test', nom: 'Regression' })));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect(toast.error).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Créer le compte' })).not.toBeInTheDocument());
});
