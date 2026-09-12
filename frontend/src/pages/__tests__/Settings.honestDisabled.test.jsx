// SET-001/002/003 (audit du 11 sept. 2026) — trois endpoints backend
// inexistants appelés par Settings.jsx (/admin/logs, POST /settings/test-smtp,
// POST /settings/regenerate-key), chacun échouant systématiquement (ou,
// pour les logs, retombant silencieusement sur une liste vide). Ce fichier
// prouve : (a) l'onglet Audit & Journaux interroge désormais le vrai
// système d'audit (/audit) et affiche ses vrais champs ; (b) [mis à jour le
// 11 sept. 2026, NEW-001] "Tester la connexion SMTP" est désormais réel —
// POST /settings/test-smtp existe et exécute un vrai transporter.verify() —
// le bouton reste actif et affiche un vrai succès/échec selon la réponse
// serveur, jamais un diagnostic fictif ; (c) la carte "Clé API" affiche
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

test('"Tester la connexion SMTP" exécute un vrai test réseau — succès réel affiché après un vrai succès serveur', async () => {
  const user = userEvent.setup();
  api.post.mockImplementation((url) => {
    if (url === '/settings/test-smtp') return Promise.resolve({ data: { success: true, message: 'Connexion SMTP vérifiée avec succès (smtp.test.local).', source: 'settings' } });
    return Promise.resolve({ data: {} });
  });
  renderSettings();

  await user.click(await screen.findByRole('button', { name: 'Notifications' }));
  const btn = await screen.findByRole('button', { name: /Tester la connexion SMTP/ });
  expect(btn).not.toBeDisabled();

  await user.click(btn);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings/test-smtp'));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('vérifiée avec succès')));
  expect(toast.error).not.toHaveBeenCalled();
});

test('"Tester la connexion SMTP" — un vrai échec serveur affiche une vraie erreur, jamais un succès déguisé', async () => {
  const user = userEvent.setup();
  api.post.mockImplementation((url) => {
    if (url === '/settings/test-smtp') return Promise.resolve({ data: { success: false, message: 'Échec de la connexion SMTP.', source: 'env' } });
    return Promise.resolve({ data: {} });
  });
  renderSettings();

  await user.click(await screen.findByRole('button', { name: 'Notifications' }));
  const btn = await screen.findByRole('button', { name: /Tester la connexion SMTP/ });

  await user.click(btn);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings/test-smtp'));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Échec de la connexion SMTP')));
  expect(toast.success).not.toHaveBeenCalled();
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
