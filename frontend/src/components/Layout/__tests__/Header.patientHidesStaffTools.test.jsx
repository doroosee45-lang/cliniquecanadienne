// QUICK-ACTIONS-001 (audit du 12 sept. 2026) — la recherche patient
// (GET /patients/search) et le panneau Assistant IA (POST /ai/chat) sont
// tous deux réservés au personnel côté backend (patients.routes.js::CAN_READ
// et ai.routes.js exclu explicitement 'patient'), mais Header.jsx les
// affichait à tout utilisateur connecté sans condition de rôle : un patient
// voyait un champ de recherche et un bouton IA qui échouaient silencieusement
// (403) à chaque utilisation. Masqués pour ce rôle — le patient a déjà son
// propre Assistant IA réel et scopé dans Portal.jsx (POST /portal/ai/chat).
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Header from '../Header.jsx';

vi.mock('../../../contexts/SocketContext', () => ({
  useSocket: () => ({ socket: null, connected: false }),
}));
vi.mock('../../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));
vi.mock('../../../api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { notifications: [], unread: 0 } })), post: vi.fn(), put: vi.fn() },
}));

let mockRole = 'patient';
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Patient', role: mockRole } }),
}));

function renderHeader() {
  return render(<MemoryRouter><Header title="Mon espace patient" onMenuToggle={() => {}} /></MemoryRouter>);
}

test('un compte patient ne voit plus la recherche patient ni le bouton Assistant IA du personnel', () => {
  mockRole = 'patient';
  renderHeader();
  expect(screen.queryByPlaceholderText('Rechercher patient...')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Assistant IA')).not.toBeInTheDocument();
});

test('non-régression — un compte médecin voit toujours la recherche patient et le bouton Assistant IA', () => {
  mockRole = 'medecin';
  renderHeader();
  expect(screen.getByPlaceholderText('Rechercher patient...')).toBeInTheDocument();
  expect(screen.getByLabelText('Assistant IA')).toBeInTheDocument();
});
