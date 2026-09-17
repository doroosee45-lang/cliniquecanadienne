// MODULE AI — onglet "Base de connaissances" (implémentation réelle). Il
// affichait "🚧 Fonctionnalité en cours de développement" à la place
// d'articles déjà fabriqués et retirés en Sous-phase 5.6. Prouve que
// l'onglet charge et affiche automatiquement les vraies références
// renvoyées par /ai/knowledge-base, et que la recherche filtre
// réellement la liste affichée, jamais une recherche décorative.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import aiReducer from '../../store/slices/aiSlice';
import patientsReducer from '../../store/slices/patientsSlice';
import AI from '../AI.jsx';
import api from '../../api';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
Element.prototype.scrollIntoView = vi.fn();

vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const KB_RESPONSE = {
  success: true,
  total: 2,
  items: [
    { categorie: 'examen', id: 'ex-1', titre: 'Bilan lipidique', soustitre: 'Laboratoire', detail: 'Cholestérol total, HDL, LDL, triglycérides', meta: ['9 000 CFA', 'Délai : 24h'], tags: ['bilan lipidique', 'laboratoire'] },
    { categorie: 'interaction', id: 'interaction-2', titre: 'warfarine + aspirine', soustitre: 'Risque elevé', detail: 'AINS + anticoagulant : risque hémorragique majeur.', meta: ['Risque : elevé'], tags: ['warfarine', 'aspirine'] },
  ],
};

function renderAI() {
  const store = configureStore({ reducer: { ai: aiReducer, patients: patientsReducer } });
  return render(<Provider store={store}><MemoryRouter><AI /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url === '/ai/stats') return Promise.resolve({ data: { success: true, stats: {} } });
    if (url === '/ai/alerts') return Promise.resolve({ data: { alerts: { labo_critiques: [], imagerie_urgentes: [], predictions_en_attente: [] } } });
    if (url === '/ai/knowledge-base') return Promise.resolve({ data: KB_RESPONSE });
    return Promise.resolve({ data: {} });
  });
});

test('AI/Base de connaissances — charge automatiquement les vraies références, jamais le placeholder', async () => {
  const user = userEvent.setup();
  renderAI();

  await user.click(await screen.findByRole('button', { name: 'Base de connaissances' }));

  expect(screen.queryByText(/en cours de développement/)).not.toBeInTheDocument();
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/knowledge-base'));

  expect(await screen.findByText(/Bilan lipidique/)).toBeInTheDocument();
  expect(screen.getByText(/warfarine \+ aspirine/)).toBeInTheDocument();
});

test('AI/Base de connaissances — la recherche filtre réellement la liste affichée', async () => {
  const user = userEvent.setup();
  renderAI();

  await user.click(await screen.findByRole('button', { name: 'Base de connaissances' }));
  await screen.findByText(/Bilan lipidique/);

  const search = screen.getByPlaceholderText(/Rechercher un examen/);
  await user.type(search, 'warfarine');

  expect(screen.queryByText(/Bilan lipidique/)).not.toBeInTheDocument();
  expect(screen.getByText(/warfarine \+ aspirine/)).toBeInTheDocument();
});
