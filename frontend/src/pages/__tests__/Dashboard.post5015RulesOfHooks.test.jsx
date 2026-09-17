// POST5-015 (audit indépendant post-Phase 5, 14 sept. 2026) — Dashboard.jsx
// appelait useAuth() à l'intérieur d'un try/catch pour tolérer un rendu
// isolé sans <AuthProvider>, en violation de react-hooks/rules-of-hooks —
// même motif que LAB-HOOKS-001 (Laboratory.jsx, déjà corrigé). Remplacé par
// useAuthSafe() (useContext direct, jamais conditionnel), qui renvoie null
// sans lever en l'absence de provider. Ce test prouve que Dashboard.jsx
// rend désormais réellement sans planter hors <AuthProvider> (le scénario
// que le try/catch prétendait couvrir) et retombe honnêtement sur
// l'utilisateur générique par défaut — jamais une exception non gérée.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Dashboard from '../Dashboard.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/SocketContext', () => ({
  useSocket: () => ({ connected: false, activities: [], socket: null }),
}));
vi.mock('../../api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: {} })) } }));

function renderDashboard() {
  return render(<MemoryRouter><Dashboard /></MemoryRouter>);
}

test('POST5-015 — Dashboard.jsx rend réellement sans <AuthProvider>, jamais une violation des Rules of Hooks', async () => {
  // Aucun mock de '../../contexts/AuthContext' ici : useAuthSafe() (vrai
  // useContext) doit renvoyer null tout seul, sans lever, exactement le
  // scénario que l'ancien try{useAuth()}catch{} prétendait couvrir — mais
  // sans jamais appeler un hook dans un bloc try/catch.
  expect(() => renderDashboard()).not.toThrow();
  expect(await screen.findByText(/Utilisateur/)).toBeInTheDocument();
});
