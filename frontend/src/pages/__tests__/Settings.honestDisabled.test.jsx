// SET-001/002/003 (audit du 11 sept. 2026) — trois endpoints backend
// inexistants appelés par Settings.jsx (/admin/logs, POST /settings/test-smtp,
// POST /settings/regenerate-key), chacun échouant systématiquement (ou,
// pour les logs, retombant silencieusement sur une liste vide). Ce fichier
// prouve : (a) l'onglet Audit & Journaux interroge désormais le vrai
// système d'audit (/audit) et affiche ses vrais champs ; (b) la carte "Clé
// API" affiche honnêtement qu'aucune clé n'a jamais été émise, boutons
// désactivés, jamais un appel vers une route inexistante.
// MIGRATION-RESEND (13 sept. 2026) — "Tester la connexion SMTP" (b, ajouté
// par NEW-001 le 11 sept. 2026) a été retiré avec le reste de la
// configuration SMTP applicative : Resend n'a pas d'équivalent (une seule
// clé API serveur, RESEND_API_KEY, aucune connexion à "tester" séparément
// d'un envoi réel) — POST /settings/test-smtp n'existe plus, testé ci-avant
// par les 2 tests supprimés ici.
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

// MIGRATION-RESEND — la carte email n'a plus de bouton de test ni de champs
// host/port/user/pass : seule une note informative renvoie à RESEND_API_KEY
// (variable d'environnement serveur), jamais un appel /settings/test-smtp.
test('la carte e-mail (Resend) n\'affiche plus aucun champ SMTP ni bouton de test', async () => {
  const user = userEvent.setup();
  renderSettings();

  await user.click(await screen.findByRole('button', { name: 'Notifications' }));

  expect(screen.queryByRole('button', { name: /Tester la connexion SMTP/ })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Serveur SMTP/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Mot de passe SMTP/)).not.toBeInTheDocument();
  expect(await screen.findByText(/RESEND_API_KEY/)).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalledWith('/settings/test-smtp');
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
