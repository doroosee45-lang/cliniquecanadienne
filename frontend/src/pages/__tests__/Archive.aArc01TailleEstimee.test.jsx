// A-ARC-01 (audit métier du 13 sept. 2026, Phase 4) — kpis.taille_totale
// (archive.controller.js::getStats) est un volume synthétique (512 Ko par
// entrée archivée, jamais une vraie somme des tailles de fichiers —
// ArchiveEntry.taille n'est jamais renseigné par le moissonnage), mais
// était affiché à plusieurs endroits (badge catégories, export Excel, hero)
// sans jamais être libellé comme une estimation — seul un endroit de la
// page ("Utilisé (estimé)") le faisait déjà honnêtement. Ce test prouve que
// le badge et le hero affichent désormais tous deux "(estimé)", jamais une
// valeur présentée comme une mesure réelle.
//
// Monte le vrai composant Archive.jsx avec le vrai reducer archiveSlice ;
// seule la frontière réseau (`../../api`) est simulée.
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import archiveReducer from '../../store/slices/archiveSlice';
import Archive from '../Archive.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn(), loading: vi.fn() } }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';

const KPIS_FIXTURE = {
  total: 42, archives_mois: 5, taille_totale: '21.0 Mo', derniere_op: '13/09/2026',
  patients: 10, consultations: 8, hospitalisations: 4, labo: 6, imagerie: 3,
  examens: 9, chirurgies: 2, financier: 5, documents: 5, restaurations: 1,
};

function renderArchive() {
  const store = configureStore({ reducer: { archive: archiveReducer } });
  return render(<Provider store={store}><Archive /></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url === '/archives/stats') return Promise.resolve({ data: { kpis: KPIS_FIXTURE } });
    if (url.startsWith('/archives/config')) return Promise.resolve({ data: { config: {} } });
    if (url.startsWith('/archives?')) return Promise.resolve({ data: { archives: [], total: 0 } });
    return Promise.resolve({ data: {} });
  });
});

test('A-ARC-01 — la taille totale affichée est toujours explicitement libellée "(estimé)", jamais présentée comme une mesure réelle', async () => {
  renderArchive();

  await screen.findByText(/Répartition par catégorie/);
  await screen.findByText((_, el) => el?.textContent === '21.0 Mo total (estimé)');

  // Le hero (résumé en tête de page) doit également porter la mention.
  const heroDate = document.querySelector('.hero-date');
  expect(heroDate?.textContent || '').toContain('(estimé)');
  expect(heroDate?.textContent || '').toContain('21.0 Mo');
});
