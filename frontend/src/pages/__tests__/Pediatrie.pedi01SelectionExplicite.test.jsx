// PEDI-01 (correction du 12 sept. 2026, audit indépendant) — les boutons
// génériques d'en-tête ("➕ Nouvelle consultation", "🚨 Admettre en
// urgence") ouvraient la modale déjà silencieusement liée à enfants[0] —
// le premier enfant de la base, jamais celui voulu par l'utilisateur — dès
// qu'au moins un enfant existait. Une admission d'urgence (ou une
// consultation) pouvait donc être enregistrée sur le mauvais enfant sans
// aucun avertissement. Ce test prouve qu'avec deux enfants réels en base,
// le bouton générique n'attribue plus jamais l'acte au premier par
// défaut : une sélection explicite est désormais exigée, et l'acte part
// bien vers l'enfant réellement choisi (le second, jamais le premier).
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

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const ENFANT_1 = { _id: 'enfant-1', prenom: 'Jane', nom: 'Doe', vaccinations: [] };
const ENFANT_2 = { _id: 'enfant-2', prenom: 'Paul', nom: 'Mabiala', vaccinations: [] };

function renderPediatrie() {
  const store = configureStore({ reducer: { pediatrie: pediatrieReducer } });
  return render(<Provider store={store}><MemoryRouter><Pediatrie /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/pediatrie/enfants?')) return Promise.resolve({ data: { enfants: [ENFANT_1, ENFANT_2], total: 2 } });
    if (url.startsWith('/pediatrie/consultations')) return Promise.resolve({ data: { consultations: [], total: 0 } });
    if (url.startsWith('/pediatrie/urgences')) return Promise.resolve({ data: { urgences: [], total: 0 } });
    if (url.startsWith('/pediatrie/stats')) return Promise.resolve({ data: { stats: {}, repartitionAge: [], topPatho: [], chart: {} } });
    return Promise.resolve({ data: {} });
  });
  api.post.mockResolvedValue({ data: { consultation: { _id: 'c1' } } });
});

test('PEDI-01 — "🚨 Admettre en urgence" n\'attribue jamais silencieusement l\'acte à enfants[0]', async () => {
  const user = userEvent.setup();
  renderPediatrie();

  await user.click(await screen.findByRole('button', { name: /Urgences/ }));
  await user.click(await screen.findByRole('button', { name: /Admettre en urgence/ }));

  const dialog = await screen.findByRole('dialog');
  // Titre honnête générique tant qu'aucun enfant n'est choisi — jamais le
  // nom du premier enfant de la base (Jane Doe).
  expect(within(dialog).getByRole('heading').textContent).not.toContain('Jane Doe');

  const select = within(dialog).getByRole('combobox', { name: 'Enfant' });
  expect(within(select).getByText(/Jane Doe/)).toBeInTheDocument();
  expect(within(select).getByText(/Paul Mabiala/)).toBeInTheDocument();

  await user.type(within(dialog).getByPlaceholderText(/Paludisme simple/), 'Bronchiolite');

  // Tenter d'enregistrer sans avoir choisi d'enfant est refusé — jamais un
  // envoi silencieux vers le premier enfant de la base.
  const submitBtn = within(dialog).getByRole('button', { name: /Enregistrer/ });
  expect(submitBtn).toBeDisabled();

  // Sélection explicite du SECOND enfant (jamais le premier par défaut).
  await user.selectOptions(select, 'enfant-2');
  await screen.findByText(/Paul Mabiala/, { selector: 'h2' });
  expect(submitBtn).not.toBeDisabled();
  await user.click(submitBtn);

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/pediatrie/consultations', expect.objectContaining({ child_id: 'enfant-2' })));
  expect(api.post).not.toHaveBeenCalledWith('/pediatrie/consultations', expect.objectContaining({ child_id: 'enfant-1' }));
});
