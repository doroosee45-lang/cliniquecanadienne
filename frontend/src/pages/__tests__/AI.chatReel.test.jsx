// CHAT-001 (rapport de clôture du 11 sept. 2026) — la section "Chat IA"
// d'AI.jsx affichait un unique message statique "en cours de développement"
// et un champ désactivé, sans jamais interroger de backend. POST /ai/chat
// existe désormais réellement (backend/controllers/ai.controller.js::chat,
// réutilise utils/openai.js::generateReport(), déjà réel). Ce test prouve
// que le tab "Chat IA" transmet réellement la question saisie à cette route
// et affiche la vraie réponse du serveur — jamais un setTimeout ni une
// réponse fabriquée côté client.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import aiReducer from '../../store/slices/aiSlice';
import AI from '../AI.jsx';
import api from '../../api';

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

// jsdom n'implémente pas scrollIntoView (utilisé par AI.jsx pour faire
// défiler la conversation) — sans rapport avec CHAT-001, nécessaire pour
// que ce premier test montant réellement AI.jsx ne plante pas au montage.
Element.prototype.scrollIntoView = vi.fn();

function renderAI() {
  const store = configureStore({ reducer: { ai: aiReducer } });
  return render(<Provider store={store}><MemoryRouter><AI /></MemoryRouter></Provider>);
}

beforeEach(() => {
  api.get.mockImplementation((url) => {
    if (url === '/ai/stats') return Promise.resolve({ data: { alertes_risque: 0 } });
    if (url === '/ai/alerts') return Promise.resolve({ data: { alerts: { labo_critiques: [], imagerie_urgentes: [], predictions_en_attente: [] } } });
    return Promise.resolve({ data: {} });
  });
});
afterEach(() => { api.get.mockReset(); api.post.mockReset(); });

test('le tab Chat IA transmet réellement la question à POST /ai/chat et affiche la vraie réponse', async () => {
  const user = userEvent.setup();
  api.post.mockResolvedValue({
    data: { success: true, reply: 'La grippe se manifeste par fièvre, courbatures et toux.', disclaimer: 'Réponse générée par IA — à titre informatif — non validée médicalement.' },
  });
  renderAI();

  await user.click(await screen.findByRole('button', { name: /Chat IA/ }));
  const input = screen.getByPlaceholderText('Posez votre question…');
  expect(input).not.toBeDisabled();
  await user.type(input, 'Quels sont les signes de la grippe ?');
  await user.click(screen.getByRole('button', { name: 'Envoyer' }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ai/chat', expect.objectContaining({ message: 'Quels sont les signes de la grippe ?' })));
  expect(await screen.findByText(/La grippe se manifeste par fièvre, courbatures et toux\./)).toBeInTheDocument();
  expect(await screen.findByText(/Réponse générée par IA — à titre informatif — non validée médicalement\./)).toBeInTheDocument();
});

test('un échec réel du service IA affiche le vrai message du serveur, jamais un succès déguisé', async () => {
  const user = userEvent.setup();
  api.post.mockResolvedValue({ data: { success: false, message: 'Assistant IA indisponible — OPENAI_API_KEY non configurée sur le serveur.', simulated: true } });
  renderAI();

  await user.click(await screen.findByRole('button', { name: /Chat IA/ }));
  await user.type(screen.getByPlaceholderText('Posez votre question…'), 'Test');
  await user.click(screen.getByRole('button', { name: 'Envoyer' }));

  expect(await screen.findByText(/Assistant IA indisponible — OPENAI_API_KEY non configurée/)).toBeInTheDocument();
});
