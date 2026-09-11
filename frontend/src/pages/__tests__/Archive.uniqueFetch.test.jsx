// ARC-001 (audit du 11 sept. 2026) — loadArchives()/loadStats()
// dispatchaient fetchArchives/fetchArchiveStats (Redux) EN PLUS de leur
// propre appel api.get() direct, à chaque montage et à chaque changement de
// page/recherche/filtre : deux requêtes GET /archives (et /archives/stats)
// concurrentes et identiques par chargement. Le résultat Redux n'était en
// réalité consommé nulle part d'utile — restoreArchive/deleteArchive
// mutent déjà directement l'état local `archives` après un vrai succès
// serveur, jamais via ce state Redux. Le fetch direct (avec sa
// normalisation a.reference||a.titre, AUDIT-GLOBAL) reste la seule source ;
// le dispatch Redux dupliqué est retiré.
//
// Monte le vrai composant Archive.jsx avec le vrai reducer archiveSlice ;
// seule la frontière réseau (`../../api`) est simulée.
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import archiveReducer from '../../store/slices/archiveSlice';
import Archive from '../Archive.jsx';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));

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

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/archives?')) return Promise.resolve({ data: { archives: [ARCHIVE_FIXTURE], total: 1 } });
    if (url === '/archives/stats') return Promise.resolve({ data: { kpis: {} } });
    return Promise.resolve({ data: {} });
  });
});

test('un seul appel réel à /archives et à /archives/stats au montage — jamais un double chargement concurrent', async () => {
  renderArchive();

  await screen.findByText('ARC-TEST-001');

  const archivesCalls = api.get.mock.calls.filter(([url]) => url.startsWith('/archives?'));
  const statsCalls = api.get.mock.calls.filter(([url]) => url === '/archives/stats');
  expect(archivesCalls).toHaveLength(1);
  expect(statsCalls).toHaveLength(1);
});
