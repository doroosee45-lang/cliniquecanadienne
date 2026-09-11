// ECH-002 (audit du 11 sept. 2026) — le bouton "📄 Rapport" de l'onglet
// Résultats n'avait aucun onClick : aucune action ne se produisait au clic,
// contrairement au bouton "📧 Envoyer" juste à côté qui fonctionne
// réellement. echographieController.js::getAll ne restreint aucun champ
// (pas de .select()) : rapport_texte/conclusion/recommandations sont déjà
// présents sur chaque demande de cette liste — la même donnée réelle déjà
// utilisée par sendEchoReportEmail, désormais affichée dans une modale de
// lecture au clic sur "Rapport", sans aucune nouvelle route backend ni
// donnée fabriquée.
//
// Monte le vrai composant Echographie.jsx avec le vrai reducer
// echographieSlice ; seule la frontière réseau (`../../api`) et
// useRealtimeRefresh sont simulées.
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

const DEMANDE_VALIDEE = {
  _id: 'echo-1', id: 'echo-1', numero: 'ECH-1', patient_nom: 'Jane Doe', type: 'Obstétricale',
  statut: 'realisee', rapport_statut: 'valide', rapport_radiologue: 'Dr Amina Cherif',
  rapport_texte: 'Grossesse évolutive, biométrie normale pour le terme.',
  conclusion: 'Examen normal.', recommandations: 'Contrôle dans 4 semaines.',
};

function renderEchographie() {
  const store = configureStore({ reducer: { echographie: echographieReducer } });
  return render(<Provider store={store}><MemoryRouter><Echographie /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/echographie/stats')) return Promise.resolve({ data: {} });
    if (url.startsWith('/echographie?')) return Promise.resolve({ data: { demandes: [DEMANDE_VALIDEE], total: 1 } });
    if (url.startsWith('/settings/services')) return Promise.resolve({ data: { services: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('le bouton "Rapport" ouvre le vrai compte rendu enregistré (jamais un rapport vide/fictif)', async () => {
  const user = userEvent.setup();
  renderEchographie();

  await user.click(await screen.findByRole('button', { name: /Résultats|Rapports/ }));
  await user.click(await screen.findByRole('button', { name: /Rapport/, hidden: false }));

  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('Grossesse évolutive, biométrie normale pour le terme.');
  expect(dialog).toHaveTextContent('Examen normal.');
  expect(dialog).toHaveTextContent('Contrôle dans 4 semaines.');
  expect(dialog).toHaveTextContent('Dr Amina Cherif');
});
