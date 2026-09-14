// ANOM-URG-02 (audit métier du 13 sept. 2026, Phase 4) — "Saisir" (onglet
// Examens d'un dossier urgences) utilisait window.prompt() : aucune
// validation, jamais utilisable en environnement de test/automatisé, ni
// accessible. Remplacé par une vraie modale contrôlée, même correctif déjà
// appliqué à Hospitalization.jsx (HOSP-04, voir
// Hospitalization.hosp04ModaleResultat.test.jsx) pour le même besoin exact.
// Ce test prouve qu'aucun window.prompt n'est plus jamais invoqué, et que
// la saisie réelle de l'utilisateur dans la modale est bien transmise au
// backend et reflétée dans l'onglet.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import urgencesReducer from '../../store/slices/urgencesSlice';
import Urgences from '../Urgences.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const URG_FIXTURE = {
  _id: 'urg-1', numero: 'URG-2026-0001', patient_nom: 'Jean Mabiala',
  niveau_triage: 'orange', statut: 'soins', motif: 'Douleur thoracique',
  date_arrivee: new Date().toISOString(),
};
const EXAMEN_SANS_RESULTAT = { _id: 'exam-1', designation: 'NFS complète', type: 'labo', statut: 'attente', date: new Date().toISOString() };

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
    if (url === '/urgences/urg-1/examens') return Promise.resolve({ data: { examens: [EXAMEN_SANS_RESULTAT] } });
    if (url.startsWith('/urgences/urg-1/')) return Promise.resolve({ data: {} });
    return Promise.resolve({ data: {} });
  });
  api.put.mockResolvedValue({ data: { examen: { ...EXAMEN_SANS_RESULTAT, resultat: 'GB 7200/mm3, Hb 13.4 g/dL — normal', statut: 'resultat' } } });
});

test('ANOM-URG-02 — aucun window.prompt, la saisie réelle dans la modale est transmise et affichée', async () => {
  const promptSpy = vi.spyOn(window, 'prompt');
  const user = userEvent.setup();
  renderUrgences();

  const rows = await screen.findAllByText('Jean Mabiala');
  const row = rows.map((el) => el.closest('.urgence-row')).find(Boolean);
  await user.click(row);

  await user.click(await screen.findByRole('button', { name: /Examens/ }));
  await screen.findByText(/NFS complète/);
  await user.click(await screen.findByRole('button', { name: /^Saisir$/ }));

  const dialog = await screen.findByRole('dialog');
  const textarea = dialog.querySelector('textarea');
  expect(textarea).toBeTruthy();
  await user.type(textarea, 'GB 7200/mm3, Hb 13.4 g/dL — normal');
  await user.click(screen.getByRole('button', { name: /Enregistrer/ }));

  await waitFor(() => expect(api.put).toHaveBeenCalledWith(
    '/urgences/urg-1/examens/exam-1',
    { resultat: 'GB 7200/mm3, Hb 13.4 g/dL — normal', statut: 'resultat' },
  ));
  await screen.findByText('GB 7200/mm3, Hb 13.4 g/dL — normal');
  expect(promptSpy).not.toHaveBeenCalled();
});

test('ANOM-URG-02 — le bouton Enregistrer reste désactivé tant qu\'aucun résultat n\'est saisi (non-régression validation)', async () => {
  const user = userEvent.setup();
  renderUrgences();

  const rows = await screen.findAllByText('Jean Mabiala');
  const row = rows.map((el) => el.closest('.urgence-row')).find(Boolean);
  await user.click(row);

  await user.click(await screen.findByRole('button', { name: /Examens/ }));
  await screen.findByText(/NFS complète/);
  await user.click(await screen.findByRole('button', { name: /^Saisir$/ }));

  await screen.findByRole('dialog');
  const saveBtn = screen.getByRole('button', { name: /Enregistrer/ });
  expect(saveBtn).toBeDisabled();
  expect(api.put).not.toHaveBeenCalled();
});
