// CHIR-04 (correction du 12 sept. 2026, audit indépendant) — le sélecteur
// "Salle opératoire prévue" (formulaire Programmation) proposait "Bloc
// 1".."Bloc 4"/"Salle urgences", des valeurs qui ne correspondent à
// AUCUNE salle réelle du bloc opératoire (SALLES_BLOC/GET
// /blocoperatoire/salles n'a que BO-1/BO-2/BO-3, déjà utilisées
// correctement par Blocoperatoire.jsx). Ce test prouve que Chirurgie.jsx
// charge et propose désormais la même vraie liste de salles.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Chirurgie from '../Chirurgie.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const DOSSIER = {
  _id: 'chir-1', numero: 'CHIR-2026-0001', patient_nom: 'Jean Mabiala', statut: 'consultation',
  type_intervention: 'Appendicectomie', niveau_urgence: 'electif',
};
const SALLES_REELLES = [
  { id: 'BO-1', nom: 'Salle 1 — Chirurgie générale' },
  { id: 'BO-2', nom: 'Salle 2 — Orthopédie' },
  { id: 'BO-3', nom: 'Salle 3 — Urgences / Polyvalent' },
];

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
    if (url === '/blocoperatoire/salles') return Promise.resolve({ data: { salles: SALLES_REELLES } });
    return Promise.resolve({ data: {} });
  });
});

test('CHIR-04 — le sélecteur de salle propose les vraies salles (BO-1/BO-2/BO-3), jamais "Bloc 1..4"/"Salle urgences"', async () => {
  const user = userEvent.setup();
  renderChirurgie();

  await user.click(await screen.findByRole('button', { name: /Dossiers chirurgicaux/ }));
  await user.click(await screen.findByRole('button', { name: /Ouvrir/ }));
  await user.click(await screen.findByRole('button', { name: /Programmation/ }));

  const select = await screen.findByDisplayValue('— Sélectionner —');
  expect(within(select).getByText('Salle 1 — Chirurgie générale')).toBeInTheDocument();
  expect(within(select).getByText('Salle 2 — Orthopédie')).toBeInTheDocument();
  expect(within(select).getByText('Salle 3 — Urgences / Polyvalent')).toBeInTheDocument();
  expect(within(select).queryByText('Bloc 1')).not.toBeInTheDocument();
  expect(within(select).queryByText('Salle urgences')).not.toBeInTheDocument();

  await user.selectOptions(select, 'BO-2');
  expect(select.value).toBe('BO-2');
});
