// CHIR-01 (correction du 12 sept. 2026, audit indépendant) — le bouton
// "Transmettre au bloc →" n'avait aucun onClick — un clic sans effet.
// Réutilise le vrai mécanisme de planification déjà construit et
// fonctionnel côté bloc opératoire (blocoperatoireController.js::
// createIntervention, branche dossier_id). Ce test prouve qu'il déclenche
// désormais réellement POST /blocoperatoire avec la salle/date déjà
// saisies dans le formulaire, jamais un clic sans effet.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Chirurgie from '../Chirurgie.jsx';

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: (...a) => toastSuccess(...a), error: (...a) => toastError(...a) }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const DOSSIER = {
  _id: 'chir-1', numero: 'CHIR-2026-0001', patient_nom: 'Jean Mabiala', statut: 'consultation',
  type_intervention: 'Appendicectomie', niveau_urgence: 'electif',
  salle_prevue: 'Bloc 2', date_intervention_prev: '2033-01-10',
};

function renderChirurgie() {
  return render(<MemoryRouter><Chirurgie /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/chirurgie/stats')) return Promise.resolve({ data: { kpis: {} } });
    if (url === '/chirurgie/chir-1') return Promise.resolve({ data: { dossier: DOSSIER } });
    if (url.startsWith('/chirurgie?')) return Promise.resolve({ data: { dossiers: [DOSSIER], total: 1 } });
    if (url.startsWith('/patients?')) return Promise.resolve({ data: { patients: [] } });
    if (url.startsWith('/admin/users?')) return Promise.resolve({ data: { users: [] } });
    return Promise.resolve({ data: {} });
  });
  api.post.mockResolvedValue({ data: { intervention: { ...DOSSIER, statut: 'preoperatoire' } } });
});

test('CHIR-01 — "Transmettre au bloc" déclenche réellement la planification bloc opératoire', async () => {
  const user = userEvent.setup();
  renderChirurgie();

  await user.click(await screen.findByRole('button', { name: /Dossiers chirurgicaux/ }));
  await user.click(await screen.findByRole('button', { name: /Ouvrir/ }));
  await user.click(await screen.findByRole('button', { name: /Programmation/ }));

  await user.click(await screen.findByRole('button', { name: /Transmettre au bloc/ }));

  await vi.waitFor(() => {
    expect(api.post).toHaveBeenCalledWith('/blocoperatoire', expect.objectContaining({
      dossier_id: 'chir-1', salle: 'Bloc 2', date_heure_op: '2033-01-10',
    }));
  });
  await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('transmis au bloc')));
});

test('CHIR-01 — sans salle/date renseignées, refuse honnêtement plutôt que d\'envoyer une transmission incomplète', async () => {
  const user = userEvent.setup();
  const dossierIncomplet = { ...DOSSIER, salle_prevue: '', date_intervention_prev: '' };
  api.get.mockImplementation((url) => {
    if (url.startsWith('/chirurgie/stats')) return Promise.resolve({ data: { kpis: {} } });
    if (url === '/chirurgie/chir-1') return Promise.resolve({ data: { dossier: dossierIncomplet } });
    if (url.startsWith('/chirurgie?')) return Promise.resolve({ data: { dossiers: [dossierIncomplet], total: 1 } });
    if (url.startsWith('/patients?')) return Promise.resolve({ data: { patients: [] } });
    if (url.startsWith('/admin/users?')) return Promise.resolve({ data: { users: [] } });
    return Promise.resolve({ data: {} });
  });
  renderChirurgie();

  await user.click(await screen.findByRole('button', { name: /Dossiers chirurgicaux/ }));
  await user.click(await screen.findByRole('button', { name: /Ouvrir/ }));
  await user.click(await screen.findByRole('button', { name: /Programmation/ }));
  await user.click(await screen.findByRole('button', { name: /Transmettre au bloc/ }));

  await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringContaining('salle')));
  expect(api.post).not.toHaveBeenCalled();
});
