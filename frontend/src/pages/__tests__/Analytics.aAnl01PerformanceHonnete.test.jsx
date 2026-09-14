// A-ANL-01 (audit métier du 13 sept. 2026, Phase 4) — l'onglet "Performance"
// affichait deux blocs entièrement fictifs : "Satisfaction patient détaillée"
// (7 critères + score global "87/100", tableau littéral codé en dur) et
// "Temps de prise en charge" (graphique alimenté par TEMPS_PRISE_CHARGE_DATASETS,
// des valeurs fixes jamais issues d'une requête API) — aucun modèle Mongoose
// (Satisfaction/Survey/Feedback/Pointage) n'existe côté backend pour ces
// données. Contrairement au reste de ce contrôleur (explicitement audité
// pour éliminer toute estimation fabriquée), ces deux blocs ne variaient
// jamais selon l'activité réelle. Retirés et remplacés par un message
// honnête "fonctionnalité en cours de développement", même convention déjà
// appliquée à l'onglet "Présences" de HR.jsx. Ce test prouve qu'aucun
// chiffre fabriqué ("87/100", "92%", etc.) n'est plus jamais affiché.
//
// Monte le vrai composant Analytics.jsx avec le vrai reducer analyticsSlice ;
// seule la frontière réseau (`../../api`) et les dépendances lourdes non
// pertinentes sont simulées.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import analyticsReducer from '../../store/slices/analyticsSlice';
import Analytics from '../Analytics.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') } }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'superadmin' } }) }));

function renderAnalytics() {
  const store = configureStore({ reducer: { analytics: analyticsReducer } });
  return render(<Provider store={store}><MemoryRouter><Analytics /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/analytics/stats')) return Promise.resolve({ data: { kpi: {}, trends: {} } });
    if (url.startsWith('/analytics/financial')) return Promise.resolve({ data: {} });
    if (url.startsWith('/analytics/patients')) return Promise.resolve({ data: {} });
    if (url.startsWith('/analytics')) return Promise.resolve({ data: { charts: {} } });
    if (url.startsWith('/settings/services')) return Promise.resolve({ data: { services: [] } });
    if (url.startsWith('/settings/users')) return Promise.resolve({ data: { users: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('A-ANL-01 — onglet Performance : plus aucun chiffre fabriqué de satisfaction/délai, message honnête à la place', async () => {
  const user = userEvent.setup();
  renderAnalytics();

  await user.click(await screen.findByRole('button', { name: /Performance/ }));
  await screen.findByText(/Satisfaction patient détaillée/);
  await screen.findByText(/Temps de prise en charge/);

  // Preuves non négociables : aucun des chiffres fictifs historiques ne
  // doit plus jamais apparaître.
  expect(screen.queryByText(/87\/100/)).not.toBeInTheDocument();
  expect(screen.queryByText('Accueil & réception')).not.toBeInTheDocument();
  expect(screen.queryByText('Attente moy.')).not.toBeInTheDocument();
  expect(screen.queryByText('46 min')).not.toBeInTheDocument();

  // Message honnête présent pour les deux blocs (même convention que
  // HR.jsx::Présences), jamais une donnée qui prétend être mesurée.
  const honestMessages = screen.getAllByText(/Fonctionnalité en cours de développement/);
  expect(honestMessages.length).toBeGreaterThanOrEqual(2);
});
