// QA-002 — FE-BUG-001 (emplacement 5/5) : Archive.jsx::confirmDelete
// affichait un faux succès ET retirait la ligne de la liste locale même
// quand la suppression réelle (DELETE /archives/:id) échouait — l'utilisateur
// voyait le dossier disparaître alors qu'il existait toujours en base.
// Corrigé (commit e02a11e) : la liste locale et le toast de succès ne sont
// appliqués que sur deleteArchive.fulfilled réel.
//
// Ce test monte le vrai composant Archive.jsx avec le vrai réducteur Redux
// archiveSlice (le vrai thunk deleteArchive s'exécute réellement, pending →
// rejected/fulfilled) — seule la frontière réseau (`../../api`) est simulée,
// jamais la logique applicative elle-même.
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import archiveReducer from '../../store/slices/archiveSlice';
import Archive from '../Archive.jsx';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));
import toast from 'react-hot-toast';

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

const ARCHIVE_FIXTURE = {
  _id: 'arc-1', reference: 'ARC-TEST-001', patient_nom: 'Test Patient',
  archive_par: 'Dr Test', categorie: 'documents', service: 'Cardiologie',
  date_archive: '2026-01-15', nb_docs: 3, taille: '2.1 Mo', statut: 'archivé',
  source_model: 'Document',
};

function renderArchive() {
  const store = configureStore({ reducer: { archive: archiveReducer } });
  return render(<Provider store={store}><Archive /></Provider>);
}

async function openDeleteModal(user) {
  await waitFor(() => expect(screen.getByTitle('Supprimer définitivement')).toBeInTheDocument());
  await user.click(screen.getByTitle('Supprimer définitivement'));
  const dialog = await screen.findByRole('dialog');
  return dialog;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/archives?')) return Promise.resolve({ data: { archives: [ARCHIVE_FIXTURE], total: 1 } });
    return Promise.resolve({ data: {} });
  });
});

test('DELETE /archives/:id échoue réellement (500) → aucun faux succès, la ligne reste visible', async () => {
  const user = userEvent.setup();
  api.delete.mockRejectedValue({ response: { data: { message: 'Erreur serveur réelle' } } });

  renderArchive();
  const dialog = await openDeleteModal(user);
  await user.click(within(dialog).getByRole('button', { name: /Supprimer définitivement/ }));

  await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/archives/arc-1'));

  // Preuve non négociable : jamais de toast.success sur un échec réel.
  expect(toast.success).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalled();
  // La ligne du tableau doit rester visible — c'est exactement le bug
  // corrigé (la ligne disparaissait de la liste locale malgré l'échec
  // réel). Requête scopée sur l'icône de suppression de la LIGNE (title,
  // absent du bouton de confirmation de la modale) : sans ambiguïté avec
  // le texte de la modale d'échec, restée ouverte, qui cite aussi la
  // référence de l'archive.
  await waitFor(() => expect(screen.getByTitle('Supprimer définitivement')).toBeInTheDocument());
});

test('contrôle négatif — DELETE /archives/:id réussit réellement → vrai succès, la ligne disparaît', async () => {
  const user = userEvent.setup();
  api.delete.mockResolvedValue({ data: { success: true } });

  renderArchive();
  const dialog = await openDeleteModal(user);
  await user.click(within(dialog).getByRole('button', { name: /Supprimer définitivement/ }));

  await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/archives/arc-1'));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect(toast.error).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByText('ARC-TEST-001')).not.toBeInTheDocument());
});
