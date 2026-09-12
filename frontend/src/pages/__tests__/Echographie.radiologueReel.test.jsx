// Phase 7 (audit du 11 sept. 2026) — ECHOGRAPHISTES/RADIOLOGUES étaient deux
// listes de noms fictifs codées en dur ("Dr. Amina Cherif", "Dr.
// Jean-Pierre Mbemba"...), utilisées comme options réelles des sélecteurs
// "Planifier un examen" et "Échographiste réalisant", ET comme valeur par
// défaut d'un formulaire qui écrit réellement en base — même classe de bug
// que MAT-002 (Maternite.jsx). models/User.js n'a pas de rôle
// "échographiste" distinct : "radiologue" couvre déjà réellement l'imagerie
// (radiology.routes.js ET echographie.routes.js::CAN l'autorisent tous
// deux) — remplacé par GET /admin/users?role=radiologue, même source que
// MAT-002, jamais un autre nom inventé.
//
// Monte le vrai composant Echographie.jsx ; seule la frontière réseau
// (`../../api`) et useRealtimeRefresh sont simulées.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import echographieReducer from '../../store/slices/echographieSlice';
import Echographie from '../Echographie.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const RADIOLOGUE_FIXTURE = { _id: 'rad-1', prenom: 'Aline', nom: 'Mabiala', role: 'radiologue' };
const DEMANDE_EN_ATTENTE = {
  _id: 'echo-1', numero: 'ECH-1', patient_nom: 'Jane Doe', type: 'Obstétricale',
  statut: 'en_attente',
};

function renderEchographie() {
  const store = configureStore({ reducer: { echographie: echographieReducer } });
  return render(<Provider store={store}><MemoryRouter><Echographie /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/echographie/stats')) return Promise.resolve({ data: {} });
    if (url.startsWith('/echographie?')) return Promise.resolve({ data: { demandes: [DEMANDE_EN_ATTENTE], total: 1 } });
    if (url.startsWith('/settings/services')) return Promise.resolve({ data: { services: [] } });
    if (url.startsWith('/admin/users?role=radiologue')) return Promise.resolve({ data: { users: [RADIOLOGUE_FIXTURE] } });
    return Promise.resolve({ data: {} });
  });
});

test('le sélecteur "Planifier un examen" propose un vrai radiologue, jamais les noms fictifs d\'origine', async () => {
  const user = userEvent.setup();
  renderEchographie();

  await user.click(await screen.findByRole('button', { name: /Planning/ }));
  await user.click(await screen.findByRole('button', { name: /Planifier examen/ }));
  const dialog = await screen.findByRole('dialog');

  const label = within(dialog).getByText('Échographiste');
  const select = label.closest('div').querySelector('select');
  expect(select.textContent).toContain('Aline');
  expect(select.textContent).toContain('Mabiala');
  expect(select.textContent).not.toContain('Amina Cherif');
  expect(select.textContent).not.toContain('Paul Nkoma');

  // Preuve non négociable : aucun nom fictif présélectionné par défaut —
  // l'utilisateur doit choisir explicitement dans la vraie liste.
  expect(select.value).toBe('');
});
