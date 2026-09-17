// POST6-001 (audit final, 17 sept. 2026) — le tableau de bord IA affichait
// 4 "patients à risque" (André Mboula, Paul Nguema, Jean Dupont, Marie
// Paul — noms/scores/motifs entièrement inventés) et 6 "recommandations du
// jour" tout aussi fabriquées (dont un chiffre "510 000 CFA de créances"
// jamais calculé). Prouve que le tableau de bord charge désormais les
// vraies données renvoyées par /ai/dashboard-highlights, que les anciens
// noms fabriqués n'apparaissent plus jamais dans le code ni à l'écran, et
// qu'une réponse réelle sans anomalie affiche un état honnête plutôt
// qu'une valeur de remplissage.
import { render, screen, waitFor } from '@testing-library/react';
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

const HIGHLIGHTS_RESPONSE = {
  success: true,
  patients_risque: [
    { patient_id: 'p1', nom: 'Synthetique Test', score: 80, niveau: 'critique', motif: 'Hyperthermie sévère + Tachycardie sévère' },
  ],
  recommandations: [
    { priorite: 'eleve', module: 'Laboratoire', detail: '2 résultat(s) biologique(s) critique(s) en attente de validation médicale' },
  ],
};

const HIGHLIGHTS_EMPTY_RESPONSE = { success: true, patients_risque: [], recommandations: [] };

function renderAI() {
  const store = configureStore({ reducer: { ai: aiReducer, patients: patientsReducer } });
  return render(<Provider store={store}><MemoryRouter><AI /></MemoryRouter></Provider>);
}

function mockApi(highlightsResponse) {
  api.get.mockImplementation((url) => {
    if (url === '/ai/stats') return Promise.resolve({ data: { success: true, stats: {} } });
    if (url === '/ai/alerts') return Promise.resolve({ data: { alerts: { labo_critiques: [], imagerie_urgentes: [], predictions_en_attente: [] } } });
    if (url === '/ai/dashboard-highlights') return Promise.resolve({ data: highlightsResponse });
    return Promise.resolve({ data: {} });
  });
}

beforeEach(() => { vi.clearAllMocks(); });

test('POST6-001 — le tableau de bord affiche les vraies données de /ai/dashboard-highlights, jamais les anciens noms fabriqués', async () => {
  mockApi(HIGHLIGHTS_RESPONSE);
  renderAI();

  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/dashboard-highlights'));

  expect(await screen.findByText('Synthetique Test')).toBeInTheDocument();
  expect(screen.getByText(/Hyperthermie sévère \+ Tachycardie sévère/)).toBeInTheDocument();
  expect(screen.getByText(/résultat\(s\) biologique\(s\) critique\(s\)/)).toBeInTheDocument();

  // Les 4 noms fabriqués retirés en POST6-001 ne doivent plus jamais apparaître.
  expect(screen.queryByText(/André Mboula/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Paul Nguema/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Jean Dupont/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Marie Paul/)).not.toBeInTheDocument();
  expect(screen.queryByText(/510 000/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Calculés par l'IA aujourd'hui/)).not.toBeInTheDocument();
});

test('POST6-001 — aucune anomalie réelle détectée : état honnête affiché, jamais une entrée de remplissage', async () => {
  mockApi(HIGHLIGHTS_EMPTY_RESPONSE);
  renderAI();

  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/dashboard-highlights'));

  expect(await screen.findByText(/Aucun patient à risque élevé détecté actuellement/)).toBeInTheDocument();
  expect(screen.getByText(/Aucun point d'attention détecté actuellement/)).toBeInTheDocument();
  expect(screen.queryByText(/André Mboula/)).not.toBeInTheDocument();
});
