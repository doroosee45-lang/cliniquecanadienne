// POST5-015 (audit indépendant post-Phase 5, 14 sept. 2026) — complément
// de Dashboard.post5015RulesOfHooks.test.jsx : prouve que le remplacement
// de useAuth() (try/catch) par useAuthSafe() n'a introduit aucune
// dégradation silencieuse dans l'usage normal (un vrai utilisateur, via un
// vrai <AuthProvider>) — le nom réel doit toujours s'afficher, jamais le
// repli générique "Utilisateur".
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import AuthContext from '../../contexts/AuthContext';
import Dashboard from '../Dashboard.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/SocketContext', () => ({
  useSocket: () => ({ connected: false, activities: [], socket: null }),
}));
vi.mock('../../api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: {} })) } }));

test('POST5-015 — non-régression : avec un vrai AuthProvider, le vrai utilisateur est affiché, jamais le repli générique', async () => {
  render(
    <AuthContext.Provider value={{ user: { prenom: 'Alice', nom: 'Ndala', role: 'medecin' } }}>
      <MemoryRouter><Dashboard /></MemoryRouter>
    </AuthContext.Provider>
  );
  expect(await screen.findByText(/Alice/)).toBeInTheDocument();
  expect(screen.queryByText(/^Utilisateur$/)).not.toBeInTheDocument();
});
