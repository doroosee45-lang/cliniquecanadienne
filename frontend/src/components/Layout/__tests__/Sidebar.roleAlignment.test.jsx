// Phase 3 (audit du 11 sept. 2026) — alignement Backend↔Guard↔Sidebar.
// Plusieurs entrées du menu restaient masquées à des rôles que le backend
// (authorize()) ET la Guard de route (App.jsx::ROLES) autorisaient déjà
// réellement : sage_femme sur Urgences/Échographie, infirmier sur
// Laboratoire/Imagerie/Chirurgie/Bloc opératoire/Pharmacie, adminclinique
// sur le Journal d'audit. Un lien absent du menu pour un rôle qui a un
// accès backend réel n'est pas une protection — c'est une page que
// l'utilisateur ne peut atteindre qu'en tapant l'URL de mémoire, ce qui
// est pire pour l'ergonomie sans rien apporter à la sécurité (le backend
// reste l'autorité finale dans tous les cas).
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Sidebar from '../Sidebar.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

let mockRole = 'sage_femme';
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Role', role: mockRole }, logout: vi.fn() }),
}));

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar isOpen collapsed={false} onClose={() => {}} />
    </MemoryRouter>
  );
}

test('sage_femme voit désormais Urgences et Échographie', () => {
  mockRole = 'sage_femme';
  renderSidebar();
  expect(screen.getByText('Urgences')).toBeInTheDocument();
  expect(screen.getByText('Échographie')).toBeInTheDocument();
});

test('infirmier voit désormais Laboratoire, Imagerie, Chirurgie, Bloc Opératoire et Pharmacie', () => {
  mockRole = 'infirmier';
  renderSidebar();
  expect(screen.getByText('Laboratoire')).toBeInTheDocument();
  expect(screen.getByText('Imagerie')).toBeInTheDocument();
  expect(screen.getByText('Chirurgie')).toBeInTheDocument();
  expect(screen.getByText('Bloc Opératoire')).toBeInTheDocument();
  expect(screen.getByText('Pharmacie')).toBeInTheDocument();
});

test('adminclinique voit désormais le Journal d\'audit', () => {
  mockRole = 'adminclinique';
  renderSidebar();
  expect(screen.getByText("Journal d'audit")).toBeInTheDocument();
});

test('contrôle négatif — un rôle non concerné (comptable) ne voit toujours pas ces liens', () => {
  mockRole = 'comptable';
  renderSidebar();
  expect(screen.queryByText('Urgences')).not.toBeInTheDocument();
  expect(screen.queryByText('Laboratoire')).not.toBeInTheDocument();
  expect(screen.queryByText('Chirurgie')).not.toBeInTheDocument();
  expect(screen.queryByText("Journal d'audit")).not.toBeInTheDocument();
});
