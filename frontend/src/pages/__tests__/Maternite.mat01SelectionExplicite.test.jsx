// MAT-01 (correction du 12 sept. 2026, audit indépendant) — les boutons
// génériques d'en-tête ("➕ Nouvelle CPN", "➕ Admettre patiente", "➕
// Déclarer accouchement", "➕ Nouvelle consultation") ouvraient la modale
// déjà silencieusement liée à grossesses[0] — la première grossesse de la
// base, jamais celle voulue par l'utilisateur — dès qu'au moins une
// grossesse existait. Un acte clinique pouvait donc être enregistré sur
// la mauvaise patiente sans aucun avertissement. Ce test prouve qu'avec
// deux grossesses réelles en base, le bouton générique n'attribue plus
// jamais l'acte à la première par défaut : une sélection explicite est
// désormais exigée, et l'acte part bien vers la patiente réellement
// choisie (la seconde, jamais la première).
//
// Monte le vrai composant Maternite.jsx avec le vrai reducer
// materniteSlice ; seule la frontière réseau (`../../api`) et
// useRealtimeRefresh sont simulées.
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import materniteReducer from '../../store/slices/materniteSlice';
import Maternite from '../Maternite.jsx';

const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: (...a) => toastError(...a) } }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const GROSSESSE_1 = { _id: 'gross-1', numero: 'GR-0001', patient_prenom: 'Marie', patient_nom: 'Nzoumba', statut: 'suivi', niveau_risque: 'normal', cpns: [] };
const GROSSESSE_2 = { _id: 'gross-2', numero: 'GR-0002', patient_prenom: 'Aicha', patient_nom: 'Traore', statut: 'suivi', niveau_risque: 'normal', cpns: [] };

function renderMaternite() {
  const store = configureStore({ reducer: { maternite: materniteReducer } });
  return render(<Provider store={store}><MemoryRouter><Maternite /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/maternite/grossesses?')) return Promise.resolve({ data: { grossesses: [GROSSESSE_1, GROSSESSE_2], total: 2 } });
    if (url.startsWith('/maternite/accouchements')) return Promise.resolve({ data: { accouchements: [], total: 0 } });
    if (url.startsWith('/maternite/nouveau-nes')) return Promise.resolve({ data: { nouveaunes: [], total: 0 } });
    if (url.startsWith('/maternite/stats')) return Promise.resolve({ data: {} });
    return Promise.resolve({ data: {} });
  });
  api.post.mockResolvedValue({ data: { grossesse: { ...GROSSESSE_2, cpns: [{ _id: 'cpn-1', terme: 20 }] } } });
});

test('MAT-01 — le bouton générique "Nouvelle CPN" n\'attribue jamais silencieusement l\'acte à grossesses[0]', async () => {
  const user = userEvent.setup();
  renderMaternite();

  await user.click(await screen.findByRole('button', { name: /Consultations CPN/ }));
  await user.click(await screen.findByRole('button', { name: /➕ Nouvelle CPN/ }));

  const dialog = await screen.findByRole('dialog');
  // Le titre honnête générique s'affiche tant qu'aucune patiente n'est choisie —
  // jamais le nom de la première grossesse de la base (Marie Nzoumba).
  expect(within(dialog).getByText(/— Patiente$/)).toBeInTheDocument();

  // Le vrai sélecteur liste les deux vraies grossesses.
  const select = within(dialog).getByRole('combobox', { name: /Patiente \/ dossier grossesse/ });
  expect(within(select).getByText(/Marie Nzoumba/)).toBeInTheDocument();
  expect(within(select).getByText(/Aicha Traore/)).toBeInTheDocument();

  // Tenter d'enregistrer sans avoir choisi de patiente est refusé — jamais
  // un envoi silencieux vers la première grossesse de la base.
  const submitBtn = within(dialog).getByRole('button', { name: /Enregistrer CPN/ });
  expect(submitBtn).toBeDisabled();

  // Sélection explicite de la SECONDE grossesse (jamais la première par défaut).
  await user.selectOptions(select, 'gross-2');
  await screen.findByText(/Aicha Traore/, { selector: 'h2' });
  expect(submitBtn).not.toBeDisabled();
  await user.click(submitBtn);

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/maternite/grossesses/gross-2/cpn', expect.anything()));
  expect(api.post).not.toHaveBeenCalledWith('/maternite/grossesses/gross-1/cpn', expect.anything());
});
