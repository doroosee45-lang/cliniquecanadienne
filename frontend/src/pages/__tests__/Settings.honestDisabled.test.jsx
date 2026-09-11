// SET-001/002/003 (audit du 11 sept. 2026) — trois endpoints backend
// inexistants appelés par Settings.jsx (/admin/logs, POST /settings/test-smtp,
// POST /settings/regenerate-key), chacun échouant systématiquement (ou,
// pour les logs, retombant silencieusement sur une liste vide). Ce fichier
// prouve : (a) l'onglet Audit & Journaux interroge désormais le vrai
// système d'audit (/audit) et affiche ses vrais champs ; (b) le bouton
// "Tester la connexion SMTP" est réellement désactivé, plus aucun faux
// diagnostic (succès ou échec) affiché ; (c) la carte "Clé API" affiche
// honnêtement qu'aucune clé n'a jamais été émise, boutons désactivés,
// jamais un appel vers une route inexistante.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Settings from '../Settings.jsx';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
import toast from 'react-hot-toast';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Admin', role: 'superadmin' } }),
}));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

const AUDIT_EVENT = {
  _id: 'evt-1', utilisateur: 'Jean Dupont', role: 'medecin', module: 'patients',
  action: 'update', description: 'Utilisateur modifié : jean@test.local',
  ip: '127.0.0.1', date: '2026-09-11T10:00:00.000Z', risque: 'faible', resultat: 'Succès',
};

function renderSettings() {
  return render(<MemoryRouter><Settings /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url === '/settings') return Promise.resolve({ data: { settings: [] } });
    if (url.startsWith('/audit')) return Promise.resolve({ data: { success: true, total: 1, events: [AUDIT_EVENT] } });
    return Promise.resolve({ data: {} });
  });
});

test('Audit & Journaux interroge le vrai système d\'audit (/audit), jamais /admin/logs', async () => {
  const user = userEvent.setup();
  renderSettings();

  await user.click(await screen.findByRole('button', { name: /Audit & Journaux/ }));

  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/audit?limit=50'));
  expect(api.get).not.toHaveBeenCalledWith(expect.stringContaining('/admin/logs'));

  // Les vrais champs renvoyés par audit.controller.js::formatLog doivent
  // être affichés — jamais une donnée fabriquée.
  expect(await screen.findByText('Jean Dupont')).toBeInTheDocument();
  expect(screen.getByText('patients')).toBeInTheDocument();
});

test('"Tester la connexion SMTP" est réellement désactivé — jamais de faux diagnostic', async () => {
  const user = userEvent.setup();
  renderSettings();

  await user.click(await screen.findByRole('button', { name: 'Notifications' }));

  const btn = await screen.findByRole('button', { name: /Tester la connexion SMTP/ });
  expect(btn).toBeDisabled();

  // Un clic sur un bouton disabled ne déclenche aucun handler React — preuve
  // supplémentaire qu'aucun appel réseau ni toast (succès ou échec) ne peut
  // en résulter.
  await user.click(btn);
  expect(api.post).not.toHaveBeenCalledWith('/settings/test-smtp');
  expect(toast.success).not.toHaveBeenCalled();
  expect(toast.error).not.toHaveBeenCalled();
});

test('la carte "Clé API" n\'affiche aucune clé fabriquée et ses actions sont désactivées', async () => {
  const user = userEvent.setup();
  renderSettings();

  await user.click(await screen.findByRole('button', { name: 'Intégrations API' }));

  expect(await screen.findByText(/Aucune clé API n'a encore été émise/)).toBeInTheDocument();
  expect(screen.queryByDisplayValue(/sk_live_/)).not.toBeInTheDocument();

  const regenBtn = screen.getByRole('button', { name: /Régénérer/ });
  expect(regenBtn).toBeDisabled();
  await user.click(regenBtn);
  expect(api.post).not.toHaveBeenCalledWith('/settings/regenerate-key');
});
