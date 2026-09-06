// QA-005 (audit indépendant du 6 sept. 2026) — Login.jsx (la porte
// d'entrée de toute l'application, la page la plus critique en sécurité)
// n'avait jusqu'ici AUCUN test dédié, contrairement à 11 autres pages déjà
// couvertes. Priorité choisie ici plutôt qu'une page arbitraire, pour une
// couverture réellement utile et non artificielle.
//
// Monte le vrai AuthProvider (contexts/AuthContext.jsx) — pas un mock du
// contexte — avec Login.jsx dedans : seule la frontière réseau (`../../api`)
// est simulée. Vérifie le comportement réel attendu d'une page de login :
// échec réel → message d'erreur réel, jamais de faux succès ni de
// navigation ; succès réel → navigation réelle vers la page d'accueil.
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { vi } from 'vitest';
import { AuthProvider } from '../../contexts/AuthContext';
import Login from '../Login.jsx';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
import toast from 'react-hot-toast';

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

function Home() { return <div>Accueil réel — connecté</div>; }

function renderLogin() {
  return render(
    <GoogleOAuthProvider clientId="test-client-id.apps.googleusercontent.com">
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Home />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // fetchMe() s'exécute au montage de AuthProvider — simule "non connecté"
  // (comportement réel d'un visiteur non authentifié arrivant sur /login).
  api.get.mockImplementation((url) => {
    if (url === '/auth/me') return Promise.reject({ response: { status: 401 } });
    return Promise.resolve({ data: {} });
  });
});

async function fillAndSubmit(user) {
  await screen.findByRole('button', { name: /Se connecter/i });
  const emailInput = document.querySelector('input[type="email"]');
  const passwordInput = document.querySelector('input[type="password"]');
  await user.type(emailInput, 'medecin@test.local');
  await user.type(passwordInput, 'motdepasse123');
  await user.click(screen.getByRole('button', { name: /Se connecter/i }));
}

test('identifiants réels incorrects (401 réel du serveur) — vrai message d\'erreur, jamais de faux succès ni de navigation', async () => {
  const user = userEvent.setup();
  api.post.mockRejectedValue({ response: { data: { message: 'Email ou mot de passe incorrect.' } } });

  renderLogin();
  await fillAndSubmit(user);

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'medecin@test.local', password: 'motdepasse123' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Email ou mot de passe incorrect.'));
  expect(toast.success).not.toHaveBeenCalled();
  // Preuve non négociable : toujours sur /login, jamais navigué vers l'accueil.
  expect(screen.queryByText('Accueil réel — connecté')).not.toBeInTheDocument();
});

test('identifiants réels corrects (200 réel du serveur) — connexion réelle, navigation réelle vers l\'accueil', async () => {
  const user = userEvent.setup();
  const REAL_USER = { _id: 'u1', nom: 'Test', prenom: 'Medecin', email: 'medecin@test.local', role: 'medecin' };
  api.post.mockResolvedValue({ data: { success: true, user: REAL_USER } });

  renderLogin();
  await fillAndSubmit(user);

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'medecin@test.local', password: 'motdepasse123' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect(toast.error).not.toHaveBeenCalled();
  // Preuve non négociable : navigation réelle déclenchée par le vrai
  // succès serveur, via le vrai react-router (pas un mock de useNavigate).
  await waitFor(() => expect(screen.getByText('Accueil réel — connecté')).toBeInTheDocument());
});

test('champs vides — aucun appel réseau, message d\'erreur honnête', async () => {
  renderLogin();
  const submitBtn = await screen.findByRole('button', { name: /Se connecter/i });
  // Même limite jsdom/user-event que rencontrée ailleurs dans cette suite
  // (Echographie/Prescriptions) : userEvent.click() sur un bouton submit ne
  // déclenche pas toujours l'événement "submit" natif — fireEvent.submit()
  // exerce le même vrai onSubmit={handleSubmit}, sans affaiblir la preuve.
  fireEvent.submit(submitBtn.closest('form'));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Remplissez tous les champs.'));
  expect(api.post).not.toHaveBeenCalled();
});
