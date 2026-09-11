// ARCH-004 (audit du 11 sept. 2026) — le widget "Assistant IA" du Header
// (monté sur TOUTES les pages authentifiées du personnel) répondait via un
// setTimeout() et un dictionnaire de mots-clés codés en dur, sans jamais
// interroger le moindre backend, et sans aucune mention "démonstration" —
// un utilisateur tapant "stock" recevait de faux chiffres précis et
// plausibles (stock pharmacie, occupation de lits) présentés comme réels.
// Ce test prouve : (a) le panneau ne présente plus aucune réponse fabriquée
// quel que soit le texte tapé (impossible d'ailleurs, le champ est
// désactivé), (b) le message honnête "en cours de développement" est bien
// affiché, à l'identique du traitement déjà appliqué à la même
// fonctionnalité dans AI.jsx.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Header from '../Header.jsx';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Medecin', role: 'medecin' } }),
}));
vi.mock('../../../contexts/SocketContext', () => ({
  useSocket: () => ({ socket: null, connected: false }),
}));
vi.mock('../../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

vi.mock('../../../api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { notifications: [], unread: 0 } })), put: vi.fn() },
}));

function renderHeader() {
  return render(<MemoryRouter><Header title="Tableau de bord" onMenuToggle={() => {}} /></MemoryRouter>);
}

test('le panneau IA n\'affiche aucune donnée fabriquée — champ désactivé, message honnête', async () => {
  renderHeader();

  await screen.findByLabelText('Assistant IA');
  await screen.getByLabelText('Assistant IA').click();

  // Le seul message présent est l'aveu explicite d'absence de vraie donnée —
  // jamais un chiffre de stock/lits/RDV inventé.
  const disclaimer = "Fonctionnalité en cours de développement — aucune donnée réelle n'est utilisée dans cette démonstration.";
  expect((await screen.findAllByText(disclaimer)).length).toBeGreaterThan(0);
  expect(screen.queryByText(/Alertes stock actives/)).not.toBeInTheDocument();
  expect(screen.queryByText(/lits occupés/)).not.toBeInTheDocument();
  expect(screen.queryByText(/rendez-vous planifiés/)).not.toBeInTheDocument();

  // Le champ de saisie et le bouton d'envoi sont réellement désactivés —
  // aucune interaction ne peut jamais produire de contenu fabriqué.
  const input = screen.getByPlaceholderText(disclaimer);
  expect(input).toBeDisabled();
  const sendBtn = screen.getByRole('button', { name: 'Envoyer' });
  expect(sendBtn).toBeDisabled();
});
