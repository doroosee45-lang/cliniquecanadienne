// MAT-001 (audit du 11 sept. 2026) — l'historique CPN du dossier grossesse
// affichait des colonnes "SA" et "TA" lisant `c.sa`/`c.ta`, deux champs qui
// n'ont jamais existé sur CPNSchema (backend/models/Pregnancy.js) : les
// champs réels sont `terme` (semaines d'aménorrhée) et `tension_sys`/
// `tension_dia`. De plus, ModalCPN ne proposait même pas de champ "Terme"
// à la saisie — le terme n'aurait jamais pu être réellement disponible,
// quel que soit l'affichage utilisé. Corrigé : le champ "Terme (SA)" est
// désormais saisi (même schéma que ModalEcho, qui le fait déjà plus bas
// dans ce fichier) et envoyé au backend, et l'historique lit les vrais
// champs `terme`/`tension_sys`/`tension_dia` au lieu de `sa`/`ta`.
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

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const GROSSESSE_FIXTURE = {
  _id: 'gross-1', patient_prenom: 'Marie', patient_nom: 'Nzoumba',
  statut: 'suivi', niveau_risque: 'normal', gestite: 1, parite: 0,
  // CPN existante — forme réelle de CPNSchema (terme + tension_sys/dia),
  // jamais `sa`/`ta`.
  cpns: [{ _id: 'cpn-1', date: '2026-09-01T08:00:00.000Z', terme: 22, tension_sys: 118, tension_dia: 74, poids: 68, medecin: 'Dr Test' }],
};

function renderMaternite() {
  const store = configureStore({ reducer: { maternite: materniteReducer } });
  return render(<Provider store={store}><MemoryRouter><Maternite /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/maternite/grossesses?')) return Promise.resolve({ data: { grossesses: [GROSSESSE_FIXTURE], total: 1 } });
    if (url.startsWith('/maternite/accouchements')) return Promise.resolve({ data: { accouchements: [], total: 0 } });
    if (url.startsWith('/maternite/nouveau-nes')) return Promise.resolve({ data: { nouveaunes: [], total: 0 } });
    if (url.startsWith('/maternite/stats')) return Promise.resolve({ data: {} });
    return Promise.resolve({ data: {} });
  });
});

async function openDossier(user) {
  await user.click(await screen.findByRole('button', { name: /Femmes enceintes/ }));
  await user.click(await screen.findByRole('button', { name: /Ouvrir/ }));
}

test('une CPN réelle affiche son vrai terme et sa vraie tension, jamais "—" pour des données existantes', async () => {
  const user = userEvent.setup();
  renderMaternite();
  await openDossier(user);

  await screen.findByRole('heading', { name: /Consultations CPN/ });
  expect(await screen.findByText('22 SA')).toBeInTheDocument();
  expect(await screen.findByText('118/74')).toBeInTheDocument();
});

test('le formulaire "Ajouter" une CPN envoie réellement le terme saisi', async () => {
  const user = userEvent.setup();
  api.post.mockResolvedValue({ data: { grossesse: { ...GROSSESSE_FIXTURE, cpns: [...GROSSESSE_FIXTURE.cpns, { _id: 'cpn-2', terme: 24 }] } } });

  renderMaternite();
  await openDossier(user);

  const cpnHeading = await screen.findByRole('heading', { name: /Consultations CPN/ });
  const cpnCard = cpnHeading.closest('.mat-card');
  await user.click(within(cpnCard).getByRole('button', { name: /➕ Ajouter/ }));
  const dialog = await screen.findByRole('dialog', { name: /Consultation Prénatale/ });
  await user.type(within(dialog).getByPlaceholderText('Ex: 22'), '24');
  await user.click(within(dialog).getByRole('button', { name: /Enregistrer/ }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/maternite/grossesses/gross-1/cpn', expect.objectContaining({ terme: 24 })));
});
