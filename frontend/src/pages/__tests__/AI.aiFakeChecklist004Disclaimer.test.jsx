// AI-FAKE-CHECKLIST-004 (audit métier du 13 sept. 2026, Phase 4) — le
// panneau "🔒 Sécurité & Protection des données" (onglet Paramètres)
// affichait 4 lignes de conformité (journalisation, anonymisation, audit
// trail, chiffrement) sous forme de tableau littéral câblé en dur, jamais
// dérivé d'un état réel vérifié dynamiquement (aucun appel API) — risque de
// faux sentiment de conformité RGPD/sécurité si présenté sans réserve. Ce
// test prouve que le panneau porte désormais explicitement la mention
// "déclaratif, non vérifié automatiquement", sans quoi rien n'a changé
// visuellement (les indicateurs eux-mêmes restent corrects en pratique,
// seule l'apparence de vérification dynamique est corrigée).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import aiReducer from '../../store/slices/aiSlice';
import AI from '../AI.jsx';
import api from '../../api';

vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
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

test('AI-FAKE-CHECKLIST-004 — le panneau Sécurité est explicitement libellé "déclaratif, non vérifié automatiquement"', async () => {
  const user = userEvent.setup();
  renderAI();

  await user.click(await screen.findByRole('button', { name: /Paramètres/ }));
  await screen.findByText(/Sécurité & Protection des données/);

  await screen.findByText(/Déclaratif — non vérifié automatiquement/);
  // Non-régression : les 4 indicateurs eux-mêmes restent affichés,
  // uniquement leur cadre de présentation a changé.
  expect(screen.getByText('Journalisation complète des analyses IA')).toBeInTheDocument();
  expect(screen.getByText('Anonymisation des données pour la recherche')).toBeInTheDocument();
  expect(screen.getByText('Audit trail activé')).toBeInTheDocument();
  expect(screen.getByText('Chiffrement des échanges IA')).toBeInTheDocument();
});
