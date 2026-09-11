// P1-01 (audit du 11 sept. 2026) — POST/PUT/DELETE /settings/users sont
// authorize('superadmin') strict côté backend, mais cette page (accessible
// à adminclinique via ROLES.admin, App.jsx) affichait "Ajouter/Nouvel
// utilisateur", "Modifier" et "Activer/Désactiver" sans aucune garde : un
// compte adminclinique voyait ces actions puis recevait systématiquement
// un 403 au clic. Ce test prouve qu'un compte adminclinique ne voit plus
// ces trois actions (jamais un bouton qui échouera toujours), tandis qu'un
// compte superadmin les voit toujours — le backend reste dans tous les cas
// l'autorité finale, cette garde n'est qu'une cohérence d'affichage.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import administrationReducer from '../../store/slices/administrationSlice';
import Administration from '../Administration.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

let mockRole = 'adminclinique';
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Admin', role: mockRole } }),
}));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

const USER_FIXTURE = { _id: 'u1', prenom: 'Marie', nom: 'Nzoumba', email: 'marie@test.local', role: 'medecin', statut: 'actif' };

function renderAdministration() {
  const store = configureStore({ reducer: { administration: administrationReducer } });
  return render(<Provider store={store}><Administration /></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url === '/admin/users') return Promise.resolve({ data: { users: [USER_FIXTURE] } });
    return Promise.resolve({ data: {} });
  });
});

test('adminclinique ne voit ni "Ajouter utilisateur", ni "Modifier", ni "Activer/Désactiver"', async () => {
  const user = userEvent.setup();
  mockRole = 'adminclinique';
  renderAdministration();

  // La table Utilisateurs vit dans l'onglet "gestion" — accessible depuis
  // le raccourci "Gérer →" de la carte "Utilisateurs récents" (dashboard).
  const gererBtns = await screen.findAllByText('Gérer →');
  await user.click(gererBtns[0]);

  await screen.findByText('Marie Nzoumba');

  expect(screen.queryByRole('button', { name: /Ajouter utilisateur/ })).not.toBeInTheDocument();
  expect(screen.queryByTitle('Réinitialiser mot de passe')).toBeInTheDocument(); // pas restreint, doit rester visible
});

test('superadmin voit toujours "Ajouter utilisateur"', async () => {
  const user = userEvent.setup();
  mockRole = 'superadmin';
  renderAdministration();

  const gererBtns = await screen.findAllByText('Gérer →');
  await user.click(gererBtns[0]);

  await screen.findByText('Marie Nzoumba');
  expect(await screen.findByRole('button', { name: /Ajouter utilisateur/ })).toBeInTheDocument();
});
