// MODULE AI — sous-module Laboratoire (implémentation réelle). Le panneau
// "🔬 Laboratoire IA" affichait "🚧 Fonctionnalité en cours de
// développement" à la place d'interprétations biologiques et d'une
// tendance entièrement fabriquées (Sous-phase 5.6). Prouve que le panneau
// est désormais réellement câblé : sélection patient → dispatch réel →
// affichage des vraies données renvoyées par /ai/lab-insights/:patientId,
// jamais une donnée statique.
//
// Monte le vrai composant AI.jsx avec les vrais reducers ; seule la
// frontière réseau (`../../api`) est simulée.
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

const PATIENT = { _id: 'pat-lab-1', nom: 'Ngoma', prenom: 'Synthétique', numero_dossier: 'DOS-SYN-01' };
const LAB_INSIGHTS_RESPONSE = {
  success: true,
  patient_context: { nom: 'Synthétique Ngoma', numero_dossier: 'DOS-SYN-01' },
  historique_count: 3,
  derniere_analyse: {
    date: '2026-09-15T00:00:00.000Z',
    interpretation: [
      { exam: 'Glycémie', valeur: '1.42', reference: '0.70 – 1.10', statut: 'anormal' },
      { exam: 'Cholestérol', valeur: '3.1', reference: '< 2.0', statut: 'critique' },
    ],
  },
  trend: { analyte: 'Glycémie', reference: '0.70 – 1.10', labels: ['18/07', '17/08', '15/09'], data: [0.95, 1.15, 1.42] },
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
    if (url.startsWith('/patients')) return Promise.resolve({ data: { patients: [PATIENT], total: 1 } });
    if (url === '/ai/lab-insights/pat-lab-1') return Promise.resolve({ data: LAB_INSIGHTS_RESPONSE });
    return Promise.resolve({ data: {} });
  });
});

async function goToLaboratoireSection(user) {
  await user.click(await screen.findByRole('button', { name: /Modules IA/ }));
  await user.click(await screen.findByRole('button', { name: /Laboratoire IA/ }));
}

test('AI/Laboratoire — sélection patient + analyse affiche les vraies données, jamais le placeholder "en cours de développement"', async () => {
  const user = userEvent.setup();
  renderAI();
  await goToLaboratoireSection(user);

  expect(screen.queryByText(/en cours de développement/)).not.toBeInTheDocument();

  const select = await screen.findByRole('combobox');
  await waitFor(() => expect(screen.getByText(/Synthétique Ngoma/)).toBeInTheDocument());
  await user.selectOptions(select, 'pat-lab-1');
  await user.click(screen.getByRole('button', { name: /Analyser les résultats labo/ }));

  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/lab-insights/pat-lab-1'));

  // Preuves positives : les vraies interprétations et la vraie tendance
  // renvoyées par le backend apparaissent.
  expect(await screen.findByText('Glycémie')).toBeInTheDocument();
  expect(screen.getByText(/1\.42.*normale : 0\.70 – 1\.10/)).toBeInTheDocument();
  expect(screen.getByText('Cholestérol')).toBeInTheDocument();
  expect(screen.getByText('Critique')).toBeInTheDocument();
  expect(screen.getByText(/Comparaison historique/)).toBeInTheDocument();
});

test('AI/Laboratoire — patient sans résultat labo : état vide honnête, jamais une donnée inventée', async () => {
  api.get.mockImplementation((url) => {
    if (url === '/ai/stats') return Promise.resolve({ data: { success: true, stats: {} } });
    if (url === '/ai/alerts') return Promise.resolve({ data: { alerts: { labo_critiques: [], imagerie_urgentes: [], predictions_en_attente: [] } } });
    if (url.startsWith('/patients')) return Promise.resolve({ data: { patients: [PATIENT], total: 1 } });
    if (url === '/ai/lab-insights/pat-lab-1') return Promise.resolve({ data: { success: true, patient_context: { nom: 'Synthétique Ngoma' }, historique_count: 0, derniere_analyse: null, trend: null } });
    return Promise.resolve({ data: {} });
  });
  const user = userEvent.setup();
  renderAI();
  await goToLaboratoireSection(user);

  const select = await screen.findByRole('combobox');
  await waitFor(() => expect(screen.getByText(/Synthétique Ngoma/)).toBeInTheDocument());
  await user.selectOptions(select, 'pat-lab-1');
  await user.click(screen.getByRole('button', { name: /Analyser les résultats labo/ }));

  expect(await screen.findByText('Aucun résultat de laboratoire complété pour ce patient.')).toBeInTheDocument();
});
