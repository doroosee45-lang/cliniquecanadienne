// FE-BUG-020 (Correction 5, audit indépendant du 6 sept. 2026) —
// Pediatrie.jsx::ModalVaccination.submit() dispatchait un addVaccination()
// par vaccin sélectionné dans une boucle, sans jamais vérifier
// fulfilled.match individuellement (contrairement à createEnfant/
// createConsultation/addMesureCroissance/addMaladieChronique dans ce même
// fichier, qui le font tous) : un échec partiel (ex. 1 vaccin sur 2) était
// donc affiché comme un succès total. Corrigé : chaque résultat est
// vérifié, et un échec partiel affiche un compte-rendu honnête au lieu
// d'un faux succès global.
//
// Monte le vrai composant Pediatrie.jsx avec le vrai reducer
// pediatrieSlice ; seule la frontière réseau (`../../api`) et
// useRealtimeRefresh sont simulées.
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import pediatrieReducer from '../../store/slices/pediatrieSlice';
import Pediatrie from '../Pediatrie.jsx';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
import toast from 'react-hot-toast';

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const ENFANT_FIXTURE = { _id: 'enfant-1', prenom: 'Jane', nom: 'Doe', vaccinations: [] };

function renderPediatrie() {
  const store = configureStore({ reducer: { pediatrie: pediatrieReducer } });
  return render(<Provider store={store}><MemoryRouter><Pediatrie /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/pediatrie/enfants?')) return Promise.resolve({ data: { enfants: [ENFANT_FIXTURE], total: 1 } });
    if (url.startsWith('/pediatrie/consultations')) return Promise.resolve({ data: { consultations: [], total: 0 } });
    if (url.startsWith('/pediatrie/urgences')) return Promise.resolve({ data: { urgences: [], total: 0 } });
    if (url.startsWith('/pediatrie/stats')) return Promise.resolve({ data: { stats: {}, repartitionAge: [], topPatho: [], chart: {} } });
    return Promise.resolve({ data: {} });
  });
});

test('un échec partiel réel (1 vaccin sur 2) affiche un compte-rendu honnête, jamais un succès total trompeur', async () => {
  const user = userEvent.setup();
  // BCG réussit réellement, Polio échoue réellement — preuve que la boucle
  // vérifie bien CHAQUE appel individuellement, pas seulement le dernier.
  api.post.mockImplementation((url, body) => {
    if (body.vaccin === 'Polio') return Promise.reject({ response: { data: { message: 'Erreur serveur réelle sur Polio' } } });
    return Promise.resolve({ data: { enfant: { ...ENFANT_FIXTURE, vaccinations: [{ vaccin: body.vaccin, dose: body.dose }] } } });
  });

  renderPediatrie();
  await user.click(await screen.findByRole('button', { name: /Vaccinations/ }));
  await user.click(await screen.findByRole('button', { name: /Nouvelle vaccination/ }));

  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByText('BCG').closest('.vacc-cell'));
  await user.click(within(dialog).getByText('Polio').closest('.vacc-cell'));
  await user.click(within(dialog).getByRole('button', { name: /Enregistrer/ }));

  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post).toHaveBeenCalledWith('/pediatrie/enfants/enfant-1/vaccinations', { vaccin: 'BCG', dose: '1 dose(s)' });
  expect(api.post).toHaveBeenCalledWith('/pediatrie/enfants/enfant-1/vaccinations', { vaccin: 'Polio', dose: '3 dose(s)' });

  // Preuve non négociable : jamais un message prétendant que les 2
  // vaccinations ont réussi alors qu'une seule a réellement persisté.
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('1/2')));
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Polio'));
  expect(toast.success).not.toHaveBeenCalledWith(expect.stringContaining('2 vaccination'));
});
