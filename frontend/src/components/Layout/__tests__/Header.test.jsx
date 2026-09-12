// CHAT-001 (rapport de clôture du 11 sept. 2026) — ARCH-004 (audit du 11
// sept. 2026) avait honnêtement désactivé ce panneau : il répondait
// auparavant via un setTimeout() et un dictionnaire de mots-clés codés en
// dur (un utilisateur tapant "stock" recevait de faux chiffres précis et
// plausibles présentés comme réels), sans jamais interroger de backend.
// POST /ai/chat existe désormais réellement (backend/controllers/
// ai.controller.js::chat, réutilise utils/openai.js::generateReport()) — ce
// test prouve que le panneau appelle réellement cette route (jamais un
// setTimeout ni une réponse fabriquée côté client), affiche la vraie
// réponse renvoyée par le serveur, et affiche le message réel du serveur
// (jamais un succès inventé) quand celui-ci signale un échec/mode simulé.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Header from '../Header.jsx';
import api from '../../../api';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Medecin', role: 'medecin' } }),
}));
vi.mock('../../../contexts/SocketContext', () => ({
  useSocket: () => ({ socket: null, connected: false }),
}));
vi.mock('../../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

vi.mock('../../../api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { notifications: [], unread: 0 } })), post: vi.fn(), put: vi.fn() },
}));

function renderHeader() {
  return render(<MemoryRouter><Header title="Tableau de bord" onMenuToggle={() => {}} /></MemoryRouter>);
}

afterEach(() => { api.post.mockReset(); });

test('le panneau IA envoie réellement la question à POST /ai/chat et affiche la vraie réponse du serveur', async () => {
  const user = userEvent.setup();
  api.post.mockResolvedValue({ data: { success: true, reply: 'Le paludisme se manifeste par fièvre et frissons.', disclaimer: 'Réponse générée par IA — à titre informatif — non validée médicalement.' } });
  renderHeader();

  await screen.findByLabelText('Assistant IA');
  await user.click(screen.getByLabelText('Assistant IA'));

  const input = screen.getByPlaceholderText('Posez votre question…');
  expect(input).not.toBeDisabled();
  await user.type(input, 'Quels sont les signes du paludisme ?');
  await user.click(screen.getByRole('button', { name: 'Envoyer' }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ai/chat', expect.objectContaining({ message: 'Quels sont les signes du paludisme ?' })));
  expect(await screen.findByText('Le paludisme se manifeste par fièvre et frissons.')).toBeInTheDocument();
  // Le champ se vide réellement après un envoi réussi — jamais un envoi factice.
  expect(input).toHaveValue('');
});

test('le panneau IA affiche le vrai message du serveur (jamais un succès inventé) quand le service IA est indisponible', async () => {
  const user = userEvent.setup();
  api.post.mockResolvedValue({ data: { success: false, simulated: true, message: 'Assistant IA indisponible — OPENAI_API_KEY non configurée sur le serveur.' } });
  renderHeader();

  await user.click(await screen.findByLabelText('Assistant IA'));
  await user.type(screen.getByPlaceholderText('Posez votre question…'), 'Test');
  await user.click(screen.getByRole('button', { name: 'Envoyer' }));

  expect(await screen.findByText(/Assistant IA indisponible — OPENAI_API_KEY non configurée/)).toBeInTheDocument();
  // Jamais un chiffre fabriqué (stock/lits/RDV) présenté comme réel.
  expect(screen.queryByText(/Alertes stock actives/)).not.toBeInTheDocument();
  expect(screen.queryByText(/lits occupés/)).not.toBeInTheDocument();
});
