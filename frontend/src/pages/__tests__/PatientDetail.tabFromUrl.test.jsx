// Module « Dossiers Médicaux » — un résultat de recherche doit ouvrir
// directement l'onglet concerné de PatientDetail.jsx (ex. ?tab=labo), au
// lieu de toujours retomber sur 'info' et obliger l'utilisateur à
// re-cliquer. Vérifie le comportement réel : le vrai onglet Laboratoire est
// actif dès le montage et sa vraie requête réseau part sans aucun clic,
// et un ?tab= invalide/inconnu retombe honnêtement sur 'info' (jamais un
// onglet vide/blanc affiché).
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';
import PatientDetail from '../PatientDetail.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

const REAL_PATIENT = {
  _id: 'p1', nom: 'Test', prenom: 'Patient', sexe: 'M',
  numero_dossier: 'DOS-001', statut: 'actif', actif: true,
};

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/patients/:id" element={<PatientDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url === '/patients/p1') return Promise.resolve({ data: { patient: REAL_PATIENT } });
    if (url.startsWith('/laboratory')) return Promise.resolve({ data: { results: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('?tab=labo ouvre directement l\'onglet Laboratoire, sans clic', async () => {
  renderAt('/patients/p1?tab=labo');

  await screen.findByRole('heading', { name: 'Patient Test' });
  const laboBtn = await screen.findByRole('button', { name: /Laboratoire/i });
  expect(laboBtn.className).toMatch(/bg-blue-600/);

  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/laboratory?patient=p1&limit=15'));
});

test('?tab= inconnu retombe honnêtement sur l\'onglet Informations', async () => {
  renderAt('/patients/p1?tab=un-onglet-qui-n-existe-pas');

  await screen.findByRole('heading', { name: 'Patient Test' });
  const infoBtn = await screen.findByRole('button', { name: /Informations/i });
  expect(infoBtn.className).toMatch(/bg-blue-600/);
  expect(api.get).not.toHaveBeenCalledWith(expect.stringMatching(/^\/laboratory/));
});
