// QA-002 — FE-BUG-001 (emplacement 4/5) : Administration.jsx::saveSettings
// affichait "✅ Paramètres enregistrés (local)" sur TOUT échec réel de
// l'enregistrement (POST /settings par paramètre). Corrigé : un vrai
// toast.error est affiché sur échec réel, jamais un succès déguisé.
//
// Monte le vrai composant Administration.jsx — saveSettings est un appel
// axios direct ; seule la frontière réseau (`../../api`) est simulée.
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

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

function renderAdministration() {
  const store = configureStore({ reducer: { administration: administrationReducer } });
  return render(<Provider store={store}><Administration /></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockRejectedValue(new Error('réseau indisponible'));
});

test('POST /settings échoue réellement (500) → vraie erreur affichée, jamais un succès déguisé', async () => {
  const user = userEvent.setup();
  api.post.mockRejectedValue({ response: { data: { message: 'Erreur serveur réelle' } } });

  renderAdministration();
  await user.click(await screen.findByRole('button', { name: 'Paramètres' }));
  await user.click(await screen.findByRole('button', { name: /Enregistrer les paramètres/ }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', expect.any(Object)));

  // Preuve non négociable : jamais de succès affiché (déguisé "(local)" ou
  // non) sur un échec réel — c'est exactement le bug corrigé.
  expect(toast.success).not.toHaveBeenCalled();
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
});

test('contrôle négatif — POST /settings réussit réellement → vrai succès affiché', async () => {
  const user = userEvent.setup();
  api.post.mockResolvedValue({ data: { setting: { cle: 'x', valeur: 'y' } } });

  renderAdministration();
  await user.click(await screen.findByRole('button', { name: 'Paramètres' }));
  await user.click(await screen.findByRole('button', { name: /Enregistrer les paramètres/ }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', expect.any(Object)));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect(toast.error).not.toHaveBeenCalled();
});
