// HOSP-04 (correction du 12 sept. 2026, audit indépendant) — "Saisir
// résultat" (onglet Examens d'un dossier d'hospitalisation) utilisait
// window.prompt() : aucune validation, jamais utilisable en environnement
// de test/automatisé, ni accessible. Remplacé par une vraie modale
// contrôlée (formulaire, validation required, gestion d'erreur réelle).
// Ce test prouve qu'aucun window.prompt n'est plus jamais invoqué, et que
// la saisie réelle de l'utilisateur dans la modale est bien transmise au
// backend et reflétée dans l'onglet.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import hospitalizationReducer from '../../store/slices/hospitalizationSlice';
import Hospitalization from '../Hospitalization.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const HOSP_FIXTURE = {
  _id: 'hosp-1', numero: 'HOSP-2026-0001', patient_nom: 'Jean Mabiala',
  motif_entree: 'Test', statut: 'en_cours', date_entree: new Date().toISOString(),
};
const EXAMEN_SANS_RESULTAT = { _id: 'exam-1', designation: 'NFS complète', date: new Date().toISOString(), statut: 'attente', type: 'labo' };

function renderHospitalization() {
  const store = configureStore({ reducer: { hospitalization: hospitalizationReducer } });
  return render(<Provider store={store}><MemoryRouter><Hospitalization /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/hospitalization?')) return Promise.resolve({ data: { hospitalizations: [HOSP_FIXTURE], total: 1 } });
    if (url === '/hospitalization/stats') return Promise.resolve({ data: { stats: {} } });
    if (url.startsWith('/patients?')) return Promise.resolve({ data: { patients: [] } });
    if (url === '/hospitalization/rooms') return Promise.resolve({ data: { rooms: [] } });
    if (url === '/hospitalization/hosp-1/examens') return Promise.resolve({ data: { examens: [EXAMEN_SANS_RESULTAT] } });
    return Promise.resolve({ data: {} });
  });
  api.put.mockResolvedValue({ data: { examen: { ...EXAMEN_SANS_RESULTAT, resultat: 'Hémoglobine normale, leucocytes normaux', statut: 'resultat' } } });
});

test('HOSP-04 — aucun window.prompt, la saisie réelle dans la modale est transmise et affichée', async () => {
  const promptSpy = vi.spyOn(window, 'prompt');
  const user = userEvent.setup();
  renderHospitalization();
  await screen.findByText('Tableau de bord');

  await user.click(await screen.findByRole('button', { name: /Toutes les admissions/ }));
  await user.click((await screen.findAllByRole('button', { name: /Ouvrir/ }))[0]);
  await user.click(await screen.findByRole('button', { name: /Examens/ }));
  await screen.findByText(/NFS complète/);
  await user.click(await screen.findByRole('button', { name: /Saisir résultat/ }));

  const dialog = await screen.findByRole('dialog');
  const textarea = dialog.querySelector('textarea');
  expect(textarea).toBeTruthy();
  await user.type(textarea, 'Hémoglobine normale, leucocytes normaux');
  await user.click(screen.getByRole('button', { name: /Enregistrer/ }));

  await waitFor(() => expect(api.put).toHaveBeenCalledWith(
    '/hospitalization/hosp-1/examens/exam-1',
    { resultat: 'Hémoglobine normale, leucocytes normaux', statut: 'resultat' },
  ));
  await screen.findByText('Hémoglobine normale, leucocytes normaux');
  expect(promptSpy).not.toHaveBeenCalled();
});
