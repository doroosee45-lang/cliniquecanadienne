// LAB-03 (correction du 12 sept. 2026, audit indépendant) — le formulaire
// de validation exigeait "Technicien de laboratoire *"/"Biologiste
// responsable *" en champs texte libre requis, mais la saisie n'était
// jamais persistée (technicien est un ObjectId ref User côté schéma,
// biologiste n'existait pas du tout) : l'utilisateur croyait enregistrer
// une identité officielle qui disparaissait silencieusement. Ce test
// prouve que ces champs texte ont disparu et que l'écran affiche
// désormais l'identité réelle (le technicien réellement enregistré à la
// saisie des résultats, le biologiste = l'utilisateur réellement connecté).
//
// Monte le vrai AuthProvider (contexts/AuthContext.jsx), comme
// Login.authentification.test.jsx — seule la frontière réseau (`../../api`)
// est simulée.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from '../../contexts/AuthContext';
import Laboratory from '../Laboratory.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const ANALYSE = {
  _id: 'lab-1', numero: 'LAB-2026-0001', patient_nom: 'Fatima Nzila', patient_dossier: 'DOS-001',
  service_demandeur: 'Urgences', examens_demandes: [], date_demande: new Date().toISOString(),
  statut: 'termine', resultats: [], technicien_nom: 'Alice Nzeba',
};

function renderLaboratory() {
  return render(<AuthProvider><MemoryRouter><Laboratory /></MemoryRouter></AuthProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url === '/auth/me') return Promise.resolve({ data: { user: { _id: 'u-bio', nom: 'Okemba', prenom: 'Paul', role: 'laborantin' } } });
    if (url.startsWith('/laboratory?')) return Promise.resolve({ data: { results: [ANALYSE], total: 1 } });
    if (url === '/laboratory/lab-1') return Promise.resolve({ data: { result: ANALYSE, invoice: null } });
    if (url.startsWith('/patients?')) return Promise.resolve({ data: { patients: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('LAB-03 — la validation n\'exige plus de texte libre "Technicien"/"Biologiste" jamais persisté, elle affiche l\'identité réelle', async () => {
  const user = userEvent.setup();
  renderLaboratory();
  await screen.findByText('Tableau de bord');

  await user.click(await screen.findByRole('button', { name: /Liste des analyses/ }));
  await user.click(await screen.findByRole('button', { name: /Ouvrir/ }));
  await user.click(await screen.findByRole('button', { name: /Validation/ }));

  // Les anciens champs texte requis ont disparu.
  expect(screen.queryByPlaceholderText('Nom du technicien')).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText('Dr. Nom du biologiste')).not.toBeInTheDocument();

  // Le vrai technicien (enregistré à la saisie des résultats) est affiché.
  await screen.findByText('Alice Nzeba');
  // Le vrai biologiste signataire (l'utilisateur réellement connecté) est affiché.
  await screen.findByText('Paul Okemba');
});
