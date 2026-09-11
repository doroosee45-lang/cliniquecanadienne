// ECH-001 (audit du 11 sept. 2026) — l'onglet Planning affichait un en-tête
// codé en dur ("Semaine du 09 juin 2026", toujours identique) et les
// boutons "◀ Préc."/"Suiv. ▶" n'avaient aucun onClick — la navigation entre
// semaines était entièrement factice. La grille elle-même comparait les
// créneaux par seul jour-de-semaine (sans vérifier la semaine réelle), donc
// deux demandes réelles le même jour de semaine mais des semaines
// différentes se seraient superposées dans la même cellule.
//
// Ce test fige la date système (vi.setSystemTime) pour vérifier une plage
// de semaine réellement calculée, prouve que "Suiv. ▶"/"◀ Préc." changent
// réellement l'en-tête affiché, et qu'un créneau réel n'apparaît QUE dans
// la semaine à laquelle il appartient réellement (jamais recopié dans une
// autre semaine par erreur de correspondance jour-de-semaine).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import echographieReducer from '../../store/slices/echographieSlice';
import Echographie from '../Echographie.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

// Lundi 8 juin 2026 (fixture réelle : Lundi de la semaine du 09/06/2026
// codée en dur dans l'ancien en-tête, choisie pour comparaison directe).
const DEMANDE_CETTE_SEMAINE = {
  _id: 'echo-1', numero: 'ECH-1', patient: 'Jane Doe', type: 'Obstétricale',
  statut: 'planifiee', priorite: 'normale', echographiste: 'Dr Test',
  date_planif: '2026-06-08T09:00:00.000Z', // lundi de "cette" semaine, 09:00
};
// Même jour de semaine (lundi) et même heure, mais la semaine SUIVANTE —
// ne doit jamais apparaître dans la grille de "cette" semaine.
const DEMANDE_SEMAINE_SUIVANTE = {
  _id: 'echo-2', numero: 'ECH-2', patient: 'Autre Patient', type: 'Obstétricale',
  statut: 'planifiee', priorite: 'normale', echographiste: 'Dr Test',
  date_planif: '2026-06-15T09:00:00.000Z',
};

function renderEchographie() {
  const store = configureStore({ reducer: { echographie: echographieReducer } });
  return render(<Provider store={store}><MemoryRouter><Echographie /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z')); // mercredi de "cette" semaine
  api.get.mockImplementation((url) => {
    if (url.startsWith('/echographie/stats')) return Promise.resolve({ data: {} });
    if (url.startsWith('/echographie?')) return Promise.resolve({ data: { demandes: [DEMANDE_CETTE_SEMAINE, DEMANDE_SEMAINE_SUIVANTE], total: 2 } });
    if (url.startsWith('/settings/services')) return Promise.resolve({ data: { services: [] } });
    return Promise.resolve({ data: {} });
  });
});

afterEach(() => { vi.useRealTimers(); });

test('l\'en-tête affiche la vraie semaine courante et navigue réellement', async () => {
  const user = userEvent.setup();
  renderEchographie();
  await user.click(await screen.findByRole('button', { name: /Planning/ }));

  expect(await screen.findByText(/08 juin au 13 juin 2026/)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /Suiv\. ▶/ }));
  expect(await screen.findByText(/15 juin au 20 juin 2026/)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /◀ Préc\./ }));
  await user.click(screen.getByRole('button', { name: /◀ Préc\./ }));
  expect(await screen.findByText(/01 juin au 06 juin 2026/)).toBeInTheDocument();
});

test('un créneau réel n\'apparaît que dans sa propre semaine, jamais dans une autre semaine au même jour', async () => {
  const user = userEvent.setup();
  renderEchographie();
  await user.click(await screen.findByRole('button', { name: /Planning/ }));

  expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
  expect(screen.queryByText('Autre Patient')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /Suiv\. ▶/ }));
  expect(await screen.findByText('Autre Patient')).toBeInTheDocument();
  expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
});
