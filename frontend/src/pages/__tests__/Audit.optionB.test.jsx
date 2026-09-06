// QA-002 — échantillon représentatif d'une désactivation honnête (Option B,
// chantier Sous-phase 5.x). Audit.jsx : le bouton "Forcer" (déconnexion
// forcée d'une session active) a été désactivé honnêtement en 5.7 — aucun
// mécanisme réel de révocation de session/JWT individuelle n'existe dans ce
// système (middleware/auth.js ne vérifie que la signature du token et
// User.statut). Ce test protège contre une réactivation accidentelle future
// (ex. un développeur qui retire `disabled` en pensant "corriger" un bouton
// qui semble cassé, sans réaliser qu'aucune route réelle ne le soutient).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import auditReducer from '../../store/slices/auditSlice';
import Audit from '../Audit.jsx';

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const SESSION_FIXTURE = {
  _id: 'sess-1', utilisateur: 'Jean Test', email: 'jean@test.local', role: 'medecin',
  heure_connexion: '2026-09-06T08:00:00.000Z', statut: 'actif',
  ip: '10.0.0.1', device: 'Chrome / Windows', localisation: 'Brazzaville',
};

function renderAudit() {
  const store = configureStore({ reducer: { audit: auditReducer } });
  return render(<Provider store={store}><Audit /></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/audit?'))          return Promise.resolve({ data: { events: [], total: 0 } });
    if (url === '/audit/connexions')        return Promise.resolve({ data: { connexions: [SESSION_FIXTURE] } });
    // Même forme que l'état initial du composant (Audit.jsx) — un simple
    // {} remplacerait entièrement `stats` (setStats(data) sans fusion) et
    // ferait planter les graphiques qui lisent stats.activite_7j.labels.
    if (url === '/audit/stats')             return Promise.resolve({ data: { activite_7j: { labels: [], data: [] }, activite_30j: { labels: [], data: [] }, connexions_heure: { labels: [], data: [] }, top_utilisateurs: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('le bouton "Forcer" (déconnexion forcée) reste désactivé — aucune route réelle ne le soutient', async () => {
  const user = userEvent.setup();
  renderAudit();

  await user.click(await screen.findByRole('button', { name: /Connexions/ }));
  const forcerBtn = await screen.findByRole('button', { name: /Forcer/ });

  // Preuve non négociable : le bouton doit rester réellement désactivé
  // (attribut HTML disabled, pas seulement visuellement grisé par CSS).
  expect(forcerBtn).toBeDisabled();

  // Un clic sur un bouton HTML disabled ne déclenche jamais son onClick —
  // aucun appel réseau ne doit donc jamais en résulter, même par accident.
  await user.click(forcerBtn);
  expect(api.post).not.toHaveBeenCalled();
  expect(api.put).not.toHaveBeenCalled();
  expect(api.delete).not.toHaveBeenCalled();
});
