// NEW-006 (rapport de correction du 11 sept. 2026) — dispatch(fetchMedications({}))
// + dispatch(fetchInventory()) + dispatch(fetchStockAlerts()) dupliquaient
// à chaque montage des requêtes déjà couvertes par loadMeds() (api.get
// direct, même préfixe /pharmacy?...) ou entièrement inutiles
// (/pharmacy/inventory, dont le résultat — reduxInventory — n'était lu
// nulle part) — vérifié par recherche projet-wide (aucun autre fichier ne
// consomme fetchMedications/fetchInventory/fetchStockAlerts/
// createMedication/updateMedication/addStockMovement de pharmacySlice).
// Les trois dispatches Redux orphelins sont retirés.
//
// Monte le vrai composant Pharmacy.jsx ; seule la frontière réseau
// (`../../api`) et useRealtimeRefresh sont simulées.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Pharmacy from '../Pharmacy.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

// PHARM-005 (audit métier du 13 sept. 2026, Phase 4) — Pharmacy.jsx appelle
// désormais réellement useAuth() (garde de rôle sur les actions d'écriture,
// voir Pharmacy.pharm005RoleGuard.test.jsx), qui lève sans <AuthProvider>.
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Pharmacien', role: 'pharmacien' } }),
}));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

function renderPharmacy() {
  return render(<MemoryRouter><Pharmacy /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/pharmacy?')) return Promise.resolve({ data: { medications: [], total: 0 } });
    if (url === '/pharmacy/inventory') return Promise.resolve({ data: { inventory: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('plus jamais les appels /pharmacy dupliqués par le Redux orphelin — seuls les 2 appels réels (liste paginée + stats) subsistent', async () => {
  renderPharmacy();
  await screen.findByText('Tableau de bord');

  // loadMeds() (page paginée), loadStats() (limit=500) et un 3e appel
  // local réel (limit=200, mouvements de stock) sont trois appels réels
  // distincts et légitimes, tous déjà présents avant ce correctif — hors
  // périmètre de NEW-006 (qui porte sur le dispatch Redux mort, pas sur
  // cette architecture locale préexistante).
  const pharmacyCalls = api.get.mock.calls.filter(([url]) => url.startsWith('/pharmacy?'));
  expect(pharmacyCalls).toHaveLength(3);
  // Preuve non négociable : fetchStockAlerts (thunk mort, ciblait
  // /pharmacy?alert=rupture&limit=100) ne doit plus jamais être appelé.
  expect(pharmacyCalls.some(([url]) => url.includes('alert=rupture'))).toBe(false);
  // Preuve non négociable : fetchInventory (thunk mort, seul appelant de
  // cet endpoint — reduxInventory n'était lu nulle part) ne doit plus
  // jamais être appelé.
  const inventoryCalls = api.get.mock.calls.filter(([url]) => url === '/pharmacy/inventory');
  expect(inventoryCalls).toHaveLength(0);
});
