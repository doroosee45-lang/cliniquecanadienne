// URG-001 (audit du 11 sept. 2026) — les champs du panneau Triage/Constantes/
// Examen clinique appelaient setCurrentUrg(u => ({...})) directement, sans
// jamais passer par dispatch() : setCurrentUrg est l'action-creator brute
// (state.currentUrg = action.payload), pas un setState local — l'appel ne
// faisait donc rien, et le reducer patchCurrentUrg (conçu pour ce cas exact)
// n'était jamais utilisé. Conséquence réelle : cliquer "Enregistrer" relisait
// currentUrg.temperature depuis le state Redux JAMAIS modifié par la saisie,
// et renvoyait donc la valeur d'origine au serveur — un faux succès silencieux
// (toast "✅ Dossier mis à jour" affiché, mais rien de ce qui a été tapé n'est
// jamais parti). Corrigé : chaque onChange dispatch désormais
// patchCurrentUrg({champ: valeur}). Ce test prouve la chaîne complète
// UI → dispatch(patchCurrentUrg) → currentUrg (Redux) → bouton Enregistrer
// → PUT /urgences/:id avec la VRAIE valeur saisie dans le payload — pas
// seulement que l'input affiche ce qu'on y tape.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import urgencesReducer from '../../store/slices/urgencesSlice';
import Urgences from '../Urgences.jsx';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') },
}));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const URG_FIXTURE = {
  _id: 'urg-1', numero: 'URG-2026-0001', patient_nom: 'Jean Mabiala',
  niveau_triage: 'orange', statut: 'attente', motif: 'Douleur thoracique',
  date_arrivee: new Date().toISOString(), medecin: '', infirmier: '',
  temperature: null, pouls: null, tension_sys: null, tension_dia: null, spo2: null, glycemie: null,
  antecedents: '', allergies: '', traitements_cours: '', observations: '', diagnostic_provisoire: '',
  examens: [],
};

function renderUrgences() {
  const store = configureStore({ reducer: { urgences: urgencesReducer } });
  return render(<Provider store={store}><MemoryRouter><Urgences /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url === '/urgences/stats') return Promise.resolve({ data: { kpis: {}, triageMap: {}, chart: {} } });
    if (url.startsWith('/urgences?')) return Promise.resolve({ data: { urgences: [URG_FIXTURE], total: 1 } });
    if (url === '/ambulances') return Promise.resolve({ data: { ambulances: [] } });
    if (url === '/urgences/urg-1') return Promise.resolve({ data: { invoice: null } });
    if (url.startsWith('/urgences/urg-1/')) return Promise.resolve({ data: {} });
    return Promise.resolve({ data: {} });
  });
});

test('la température saisie dans le panneau Triage est réellement transmise au serveur, pas la valeur d\'origine', async () => {
  const user = userEvent.setup();
  api.put.mockResolvedValue({ data: { urgence: { ...URG_FIXTURE, temperature: '39.2' } } });

  renderUrgences();

  // Ouvre le dossier depuis la file d'attente du dashboard (openDossier()).
  // "Jean Mabiala" apparaît aussi ailleurs sur le dashboard (résumé KPI) —
  // on cible précisément la ligne cliquable de la file d'attente (.urgence-row).
  const rows = await screen.findAllByText('Jean Mabiala');
  const row = rows.map((el) => el.closest('.urgence-row')).find(Boolean);
  await user.click(row);

  // Le panneau Triage & Constantes est la section par défaut à l'ouverture.
  const tempInput = await screen.findByPlaceholderText('37.0');
  await user.clear(tempInput);
  await user.type(tempInput, '39.2');

  await user.click(screen.getByRole('button', { name: /Enregistrer les constantes/ }));

  // Preuve non négociable : la valeur RÉELLEMENT saisie (39.2), pas la
  // valeur d'origine (null), doit apparaître dans le payload envoyé au
  // serveur — c'est exactement ce que le bug empêchait (currentUrg.temperature
  // restait figé à sa valeur d'ouverture du dossier).
  await waitFor(() => expect(api.put).toHaveBeenCalledWith(
    '/urgences/urg-1',
    expect.objectContaining({ temperature: '39.2' }),
  ));
});

test('le diagnostic provisoire saisi dans l\'examen clinique est réellement transmis au serveur', async () => {
  const user = userEvent.setup();
  api.put.mockResolvedValue({ data: { urgence: URG_FIXTURE } });

  renderUrgences();
  const rows = await screen.findAllByText('Jean Mabiala');
  const row = rows.map((el) => el.closest('.urgence-row')).find(Boolean);
  await user.click(row);

  await user.click(await screen.findByRole('button', { name: /Examen clinique/ }));
  const diagInput = await screen.findByPlaceholderText(/Appendicite aiguë suspecte/);
  await user.type(diagInput, 'Suspicion de péricardite');

  await user.click(screen.getByRole('button', { name: /^Enregistrer$/ }));

  await waitFor(() => expect(api.put).toHaveBeenCalledWith(
    '/urgences/urg-1',
    expect.objectContaining({ diagnostic_provisoire: 'Suspicion de péricardite' }),
  ));
});
