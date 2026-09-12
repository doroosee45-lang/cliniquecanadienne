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

// FE-INFRA-03 (correction du 12 sept. 2026, audit indépendant) — le lien
// "Patients" était resté sur une liste plus étroite que
// patients.routes.js::CAN_READ (backend) : sage_femme/laborantin/
// radiologue/pharmacien/comptable avaient déjà un accès backend réel en
// lecture au dossier patient, sans jamais pouvoir atteindre ce lien.
test('FE-INFRA-03 — sage_femme, laborantin, radiologue, pharmacien et comptable voient désormais Patients', () => {
  for (const role of ['sage_femme', 'laborantin', 'radiologue', 'pharmacien', 'comptable']) {
    mockRole = role;
    const { unmount } = renderSidebar();
    expect(screen.getByText('Patients')).toBeInTheDocument();
    unmount();
  }
});

test('FE-INFRA-03 — un rôle réellement sans accès backend (patient) ne voit toujours pas Patients (non-régression)', () => {
  mockRole = 'patient';
  renderSidebar();
  expect(screen.queryByText('Patients')).not.toBeInTheDocument();
});

// Correction 2 (relecture du 12 sept. 2026) — le lien "Rendez-vous" pointait
// vers /appointments (Guard App.jsx::ROLES.appointments, qui exclut
// 'patient') mais restait affiché à tout rôle (roles: null), y compris un
// compte patient : cliquer ce lien produisait systématiquement "Accès non
// autorisé" alors que Portal.jsx a son propre onglet "Mes Rendez-vous"
// pleinement fonctionnel.
test('Correction 2 — un compte patient ne voit plus "Rendez-vous" (lien mort vers /appointments, Guard staff)', () => {
  mockRole = 'patient';
  renderSidebar();
  expect(screen.queryByText('Rendez-vous')).not.toBeInTheDocument();
});

test('Correction 2 — le personnel autorisé par le Guard (médecin) voit toujours "Rendez-vous" (non-régression)', () => {
  mockRole = 'medecin';
  renderSidebar();
  expect(screen.getByText('Rendez-vous')).toBeInTheDocument();
});
