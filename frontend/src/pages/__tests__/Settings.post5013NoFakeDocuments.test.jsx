// POST5-013 (audit indépendant post-Phase 5, 14 sept. 2026) — l'onglet
// "Informations clinique" affichait une carte "Documents officiels" avec 3
// documents réglementaires entièrement fabriqués (licence d'exploitation,
// agrément ministériel, certificat ISO 9001 — numéros de référence et
// dates d'expiration en dur) et un badge "✅ Valide/❌ Expiré" calculé sur
// ces dates fictives, présentés comme des informations réelles de
// conformité réglementaire. Aucun modèle ne persiste de document
// réglementaire d'établissement — retirée plutôt que remplacée par une
// autre donnée inventée (même précédent que "Modules actifs", POST5-011).
//
// Monte le vrai composant Settings.jsx ; seule la frontière réseau
// (`../../api`) est simulée.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Settings from '../Settings.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Admin', role: 'superadmin' } }),
}));
vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

function renderSettings() {
  return render(<MemoryRouter><Settings /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url === '/settings') return Promise.resolve({ data: { settings: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('POST5-013 — la carte "Documents officiels" fabriquée a disparu, aucune autre donnée inventée à sa place', async () => {
  renderSettings();

  // L'onglet "Informations clinique" est actif par défaut — attend le
  // rendu réel de la section avant de vérifier son absence.
  await screen.findByText(/Informations de la clinique/);

  expect(screen.queryByText('Documents officiels')).not.toBeInTheDocument();
  expect(screen.queryByText(/Licence d'exploitation/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Agrément Ministère Santé/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Certificat ISO 9001/)).not.toBeInTheDocument();
  expect(screen.queryByText('EXP-2024-CG-001')).not.toBeInTheDocument();
  expect(screen.queryByText(/AGR-MS-2024-042/)).not.toBeInTheDocument();
  expect(screen.queryByText(/ISO-9001-2024/)).not.toBeInTheDocument();
  expect(screen.queryByText('✅ Valide')).not.toBeInTheDocument();
  expect(screen.queryByText('❌ Expiré')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Mettre à jour/ })).not.toBeInTheDocument();

  // Non-régression : le reste de l'onglet (champs réels liés à /settings)
  // reste intact.
  expect(screen.getByText(/Logo & identité visuelle/)).toBeInTheDocument();
});
