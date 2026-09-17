// MODULE AI — sous-module Rendez-vous (implémentation réelle). Le panneau
// "📅 Rendez-vous" affichait "🚧 Fonctionnalité en cours de
// développement" à la place d'une prévision d'affluence et d'une charge
// par médecin entièrement fabriquées (Sous-phase 5.6). Prouve que le
// panneau charge et affiche désormais les vraies données renvoyées par
// /ai/rdv-insights, automatiquement à l'ouverture de la section (données
// agrégées sur toute la clinique, aucun patient à sélectionner).
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

const RDV_INSIGHTS_RESPONSE = {
  success: true,
  semaine: { debut: '2026-09-14T00:00:00.000Z', fin: '2026-09-21T00:00:00.000Z', labels: ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'], data: [3, 0, 5, 0, 2, 0, 0] },
  charge_medecins: [
    { medecin: 'Dr. Alpha Test', nb: 6 },
    { medecin: 'Dr. Beta Test', nb: 4 },
  ],
  total_semaine: 10,
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
    if (url === '/ai/rdv-insights') return Promise.resolve({ data: RDV_INSIGHTS_RESPONSE });
    return Promise.resolve({ data: {} });
  });
});

test('AI/Rendez-vous — la section charge automatiquement les vraies données, jamais le placeholder ni une prévision fabriquée', async () => {
  const user = userEvent.setup();
  renderAI();

  await user.click(await screen.findByRole('button', { name: /Modules IA/ }));
  await user.click(await screen.findByRole('button', { name: /Rendez-vous/ }));

  expect(screen.queryByText(/en cours de développement/)).not.toBeInTheDocument();

  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/rdv-insights'));

  expect(await screen.findByText('Dr. Alpha Test')).toBeInTheDocument();
  expect(screen.getByText('6 RDV')).toBeInTheDocument();
  expect(screen.getByText('Dr. Beta Test')).toBeInTheDocument();
  expect(screen.getByText('4 RDV')).toBeInTheDocument();
  expect(screen.getByText(/10 rendez-vous au total/)).toBeInTheDocument();
});
