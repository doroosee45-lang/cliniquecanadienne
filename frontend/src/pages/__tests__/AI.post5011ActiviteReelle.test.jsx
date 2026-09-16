// POST5-011 (audit indépendant post-Phase 5, 14 sept. 2026) — l'onglet
// Tableau de bord de l'Assistant IA affichait "Activité IA — 7 derniers
// jours" depuis un tableau littéral codé en dur ([12,18,9,24,16,7,4]), et
// "Modules actifs" (pourcentages "Assistant médical 95%", etc.) sans
// aucune source réelle ni définition de ce que ces pourcentages
// mesureraient. Le graphique est désormais alimenté par
// ai.controller.js::getStats (agrégation réelle) ; "Modules actifs" est
// retiré, jamais remplacé par une autre valeur inventée.
//
// Monte le vrai composant AI.jsx avec le vrai reducer aiSlice ; seule la
// frontière réseau (`../../api`) est simulée.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import aiReducer from '../../store/slices/aiSlice';
import patientsReducer from '../../store/slices/patientsSlice';
import AI from '../AI.jsx';
import api from '../../api';

vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
Element.prototype.scrollIntoView = vi.fn();

function renderAI() {
  // patients requis depuis que l'onglet "Analyse patient" (fonctionnalité
  // réelle de l'utilisateur, préservée telle quelle) lit selectPatients au
  // montage du composant — sans rapport avec POST5-011.
  const store = configureStore({ reducer: { ai: aiReducer, patients: patientsReducer } });
  return render(<Provider store={store}><MemoryRouter><AI /></MemoryRouter></Provider>);
}

beforeEach(() => {
  api.get.mockImplementation((url) => {
    if (url === '/ai/stats') return Promise.resolve({
      data: { success: true, stats: {
        analyses_mois: 7, alertes_risque: 0, diagnostics: 2, interactions: 1, patients_analyses: 3,
        activite_7j: { labels: ['Ven', 'Sam', 'Dim', 'Lun', 'Mar', 'Mer', 'Jeu'], data: [1, 0, 0, 2, 3, 1, 5] },
      } },
    });
    if (url === '/ai/alerts') return Promise.resolve({ data: { alerts: { labo_critiques: [], imagerie_urgentes: [], predictions_en_attente: [] } } });
    return Promise.resolve({ data: {} });
  });
});
afterEach(() => { api.get.mockReset(); });

test('POST5-011 — le graphique Activité IA utilise les vraies données Redux, "Modules actifs" fabriqué a disparu', async () => {
  renderAI();

  await screen.findByText(/Activité IA/);

  // Preuves non négociables : plus aucune trace du panneau fabriqué.
  expect(screen.queryByText('Modules actifs')).not.toBeInTheDocument();
  expect(screen.queryByText('Assistant médical')).not.toBeInTheDocument();
  expect(screen.queryByText('Finance IA')).not.toBeInTheDocument();
  expect(screen.queryByText('Inactif')).not.toBeInTheDocument();

  // Preuve positive : le graphique existe toujours et reçoit les vraies
  // données Redux (vérifié via les KPI réels affichés à côté, alimentés
  // par la même réponse /ai/stats — la preuve la plus fiable sans
  // introspecter le canvas/SVG interne de BarChart).
  await screen.findByText('7'); // analyses_mois réel
});
