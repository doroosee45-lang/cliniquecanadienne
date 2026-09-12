// ECHO-01 (correction du 12 sept. 2026, audit indépendant) — dans la
// modale "👁 Détail" de l'onglet Demandes, le bouton "📄 Voir le rapport"
// (affiché quand rapport_statut==="valide") n'avait aucun onClick — deux
// clics sans effet, distinct du bouton "📄 Rapport" déjà corrigé (ECH-002)
// dans l'onglet Résultats. Ce test prouve qu'il ouvre désormais le même
// vrai visualiseur de rapport (déjà construit et fonctionnel), jamais un
// rapport vide ou fictif.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import echographieReducer from '../../store/slices/echographieSlice';
import Echographie from '../Echographie.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const DEMANDE_VALIDEE = {
  _id: 'echo-1', id: 'echo-1', numero: 'ECH-1', patient_nom: 'Jane Doe', patient: 'Jane Doe', type: 'Obstétricale',
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

test('ECHO-01 — "Voir le rapport" (modale Détail, onglet Demandes) ouvre le vrai rapport, jamais sans effet', async () => {
  const user = userEvent.setup();
  renderEchographie();

  await user.click(await screen.findByRole('button', { name: /Demandes/ }));
  await user.click(await screen.findByRole('button', { name: /Détail/ }));
  await user.click(await screen.findByRole('button', { name: /Voir le rapport/ }));

  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('Grossesse évolutive, biométrie normale pour le terme.');
  expect(dialog).toHaveTextContent('Examen normal.');
  expect(dialog).toHaveTextContent('Dr Amina Cherif');
});
