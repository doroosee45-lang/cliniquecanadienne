// PHARM-005 (audit métier du 13 sept. 2026, Phase 4) — Pharmacy.jsx ne
// contenait aucune référence à useAuth/user.role : tous les boutons
// d'écriture (vente, mouvement, ajout catalogue, commande, réception,
// retrait...) restaient rendus et cliquables pour un infirmier, qui n'a
// accès à /pharmacy qu'en frontend (App.jsx) — le backend
// (pharmacy.routes.js::CAN_MANAGE) refuse déjà correctement toute écriture
// pour ce rôle (403, aucune donnée jamais modifiée). Même principe déjà
// établi pour Administration.jsx (P1-01, voir
// Administration.userManagementGuard.test.jsx) : ce test prouve qu'un
// compte infirmier ne voit plus ces actions comme utilisables (désactivées,
// avec info-bulle explicite), tandis qu'un compte pharmacien les voit
// toujours actives — le backend reste dans tous les cas l'autorité finale,
// cette garde n'est qu'une cohérence d'affichage.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Pharmacy from '../Pharmacy.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

let mockRole = 'infirmier';
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Infirmier', role: mockRole } }),
}));

vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

function renderPharmacy() {
  return render(<MemoryRouter><Pharmacy /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/pharmacy?')) return Promise.resolve({ data: { medications: [], total: 0 } });
    return Promise.resolve({ data: {} });
  });
});

test('PHARM-005 — un compte infirmier voit les actions d\'écriture pharmacie désactivées, jamais un bouton qui échouera toujours', async () => {
  mockRole = 'infirmier';
  renderPharmacy();
  await screen.findByText('Tableau de bord');

  const venteBtn = screen.getByRole('button', { name: 'Vente', exact: true });
  const mvtBtn    = screen.getByRole('button', { name: /Mouvement/ });
  const addMedBtn = screen.getByRole('button', { name: /Nouveau médicament/ });

  expect(venteBtn).toBeDisabled();
  expect(mvtBtn).toBeDisabled();
  expect(addMedBtn).toBeDisabled();
  expect(venteBtn).toHaveAttribute('title', expect.stringContaining('Réservé au personnel pharmacie'));
});

test('PHARM-005 — non-régression — un compte pharmacien voit ces mêmes actions toujours actives', async () => {
  mockRole = 'pharmacien';
  renderPharmacy();
  await screen.findByText('Tableau de bord');

  const venteBtn = screen.getByRole('button', { name: 'Vente', exact: true });
  const mvtBtn    = screen.getByRole('button', { name: /Mouvement/ });
  const addMedBtn = screen.getByRole('button', { name: /Nouveau médicament/ });

  expect(venteBtn).not.toBeDisabled();
  expect(mvtBtn).not.toBeDisabled();
  expect(addMedBtn).not.toBeDisabled();
});

test('PHARM-005 — non-régression — un compte adminclinique voit ces mêmes actions toujours actives', async () => {
  mockRole = 'adminclinique';
  renderPharmacy();
  await screen.findByText('Tableau de bord');

  expect(screen.getByRole('button', { name: 'Vente', exact: true })).not.toBeDisabled();
});
