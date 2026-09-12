// RADIO-03 (correction du 12 sept. 2026, audit indépendant) — sélectionner
// des fichiers dans le sélecteur natif (aucun appel réseau) affichait déjà
// un toast "✅ image(s) importée(s)" et fermait la modale, avant même que
// archiveImages() (bouton "Archiver") n'ait envoyé quoi que ce soit au
// serveur — un succès affiché pour une action qui n'avait pas encore eu
// lieu. Ce test prouve qu'aucun succès n'est plus annoncé à la simple
// sélection, et que seul l'archivage réellement abouti (requête réseau
// résolue) déclenche un vrai toast de succès.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Radiology from '../Radiology.jsx';

const toastSuccess = vi.fn();
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: (...a) => toastSuccess(...a), error: vi.fn() }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const EXAMEN = { _id: 'exam-1', numero: 'IMG-TEST-001', patient_nom: 'Jane Doe', patient: 'pat-1', type_categorie: 'radiographie', type_examen: 'Thorax', statut: 'valide', priorite: 'normale', images: [] };

function renderRadiology() {
  return render(<MemoryRouter><Radiology /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/radiology/exam-1')) return Promise.resolve({ data: { examen: EXAMEN } });
    if (url.startsWith('/radiology?')) return Promise.resolve({ data: { examens: [EXAMEN], total: 1 } });
    return Promise.resolve({ data: {} });
  });
  api.post.mockResolvedValue({ data: { images: [{ path: '/uploads/x.jpg' }] } });
});

test('RADIO-03 — la sélection locale de fichiers n\'annonce jamais un succès avant l\'archivage réel', async () => {
  const user = userEvent.setup();
  renderRadiology();

  await user.click(await screen.findByRole('button', { name: /Liste des examens/ }));
  await user.click(await screen.findByRole('button', { name: 'Ouvrir' }));
  await user.click(await screen.findByRole('button', { name: /Images/ }));
  await user.click(await screen.findByRole('button', { name: /Importer images/ }));

  const dialog = await screen.findByRole('dialog');
  const fileInput = dialog.querySelector('#img-upload-input');
  const fichier = new File(['contenu'], 'radio.jpg', { type: 'image/jpeg' });
  await user.upload(fileInput, fichier);

  // Sélection purement locale : aucun succès ne doit être annoncé, la
  // modale doit rester ouverte pour laisser l'utilisateur déclencher
  // l'archivage réel.
  expect(toastSuccess).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeInTheDocument();

  // L'archivage réel (bouton "Archiver") est le seul chemin qui envoie
  // réellement la requête et n'annonce un succès qu'une fois résolue.
  await user.click(await screen.findByRole('button', { name: /Archiver/ }));
  await vi.waitFor(() => expect(api.post).toHaveBeenCalledWith('/radiology/exam-1/images', expect.anything(), expect.anything()));
  await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('archivée')));
});
