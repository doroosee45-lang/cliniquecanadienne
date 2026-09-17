// MODULE AI — sous-module Finance (implémentation réelle). Le panneau
// "💰 Finance IA" affichait "🚧 Fonctionnalité en cours de
// développement" à la place de prévisions financières et d'une
// détection d'anomalies entièrement fabriquées (Sous-phase 5.6). Prouve
// que le panneau charge et affiche automatiquement les vraies données
// renvoyées par /ai/finance-insights.
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

const FINANCE_INSIGHTS_RESPONSE = {
  success: true,
  evolution_ca: { labels: ['avr.','mai','juin','juil.','août','sept.'], data: [400000, 420000, 390000, 410000, 405000, 450000] },
  variation_ca_mois: 11,
  factures_impayees_30j: { count: 3, total: 245000 },
  depenses_en_hausse: [{ categorie: 'Maintenance', montant_mois: 80000, montant_mois_precedent: 30000 }],
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
    if (url === '/ai/finance-insights') return Promise.resolve({ data: FINANCE_INSIGHTS_RESPONSE });
    return Promise.resolve({ data: {} });
  });
});

test('AI/Finance — la section charge automatiquement les vraies données, jamais le placeholder ni une prévision fabriquée', async () => {
  const user = userEvent.setup();
  renderAI();

  await user.click(await screen.findByRole('button', { name: /Modules IA/ }));
  await user.click(await screen.findByRole('button', { name: /Finance IA/ }));

  expect(screen.queryByText(/en cours de développement/)).not.toBeInTheDocument();

  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/finance-insights'));

  expect(await screen.findByText(/\+11% par rapport au mois précédent/)).toBeInTheDocument();
  expect(screen.getByText(/Factures impayées > 30j/)).toBeInTheDocument();
  const norm = (s) => s.replace(/\s/g, '');
  expect(await screen.findByText((_, el) => norm(el.textContent) === '245000CFA·3dossier(s)')).toBeInTheDocument();
  expect(screen.getByText(/Dépenses Maintenance/)).toBeInTheDocument();
  expect(await screen.findByText((_, el) => norm(el.textContent) === '80000CFAcemois(vs30000CFAlemoisprécédent)')).toBeInTheDocument();
});
