// MODULE AI — sous-module Imagerie IA (implémentation réelle). Le panneau
// "🩻 Imagerie IA" affichait "🚧 Fonctionnalité en cours de
// développement" à la place d'un contenu diagnostique entièrement
// fabriqué (Sous-phase 5.6, point le plus sensible de l'audit). Prouve
// que le panneau affiche désormais le vrai compte-rendu du radiologue et
// une vraie comparaison, jamais un texte inventé, et jamais un score de
// confiance IA fabriqué.
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

const PATIENT = { _id: 'pat-img-1', nom: 'Mbemba', prenom: 'Synthétique', numero_dossier: 'DOS-SYN-02' };
const IMAGING_INSIGHTS_RESPONSE = {
  success: true,
  patient_context: { nom: 'Synthétique Mbemba', numero_dossier: 'DOS-SYN-02' },
  historique_count: 2,
  examens: [
    {
      id: 'ex-1', type_examen: 'Radiographie thorax', date: '2026-09-15T00:00:00.000Z', priorite: 'normale',
      anomalie_detectee: true, conclusion: 'Opacité basale droite, foyer infectieux probable.', compte_rendu: null,
      comparaison: { date: '2026-03-01T00:00:00.000Z', conclusion: 'Absence d\'opacité parenchymateuse. Examen normal.' },
    },
    {
      id: 'ex-2', type_examen: 'Échographie abdominale', date: '2026-09-10T00:00:00.000Z', priorite: 'urgente',
      anomalie_detectee: false, conclusion: null, compte_rendu: null, comparaison: null,
    },
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
    if (url.startsWith('/patients')) return Promise.resolve({ data: { patients: [PATIENT], total: 1 } });
    if (url === '/ai/imaging-insights/pat-img-1') return Promise.resolve({ data: IMAGING_INSIGHTS_RESPONSE });
    return Promise.resolve({ data: {} });
  });
});

async function goToImagerieSection(user) {
  await user.click(await screen.findByRole('button', { name: /Modules IA/ }));
  await user.click(await screen.findByRole('button', { name: /Imagerie IA/ }));
}

test('AI/Imagerie — sélection patient + analyse affiche le vrai compte-rendu et la vraie comparaison, jamais le placeholder ni un texte inventé', async () => {
  const user = userEvent.setup();
  renderAI();
  await goToImagerieSection(user);

  expect(screen.queryByText(/en cours de développement/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Appendicite/)).not.toBeInTheDocument();

  const select = await screen.findByRole('combobox');
  await waitFor(() => expect(screen.getByText(/Synthétique Mbemba/)).toBeInTheDocument());
  await user.selectOptions(select, 'pat-img-1');
  await user.click(screen.getByRole('button', { name: /Analyser les examens d'imagerie/ }));

  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/imaging-insights/pat-img-1'));

  expect(await screen.findByText('Opacité basale droite, foyer infectieux probable.')).toBeInTheDocument();
  expect(screen.getByText('Anomalie détectée')).toBeInTheDocument();
  expect(screen.getByText(/Absence d'opacité parenchymateuse\. Examen normal\./)).toBeInTheDocument();
  // Deuxième examen : aucun compte-rendu encore saisi -> état honnête, jamais un résultat inventé.
  expect(screen.getByText(/En attente du compte-rendu du radiologue/)).toBeInTheDocument();
  expect(screen.getByText(/Premier examen de ce type/)).toBeInTheDocument();
});
