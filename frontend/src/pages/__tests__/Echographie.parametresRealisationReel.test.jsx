// PARAM-ECHO-001 (rapport de clôture du 11 sept. 2026) — le groupe
// "Paramètres d'examen" de Realisation (Échographiste réalisant / Salle
// d'échographie / Appareillage utilisé / Heure de début) n'avait aucun
// value/onChange : deux sélecteurs présentaient les vraies valeurs
// assignées mais toute correction saisie était perdue (jamais soumise),
// deux champs (Appareillage/Heure de début) n'ont aucun champ correspondant
// dans le modèle Echographie. Corrigé : echographiste/salle (déjà de vrais
// champs du modèle) sont désormais pré-remplis avec la vraie valeur
// assignée et une correction est réellement transmise à
// PUT /echographie/:id/rapport à la soumission — jamais une donnée
// inventée. Appareillage/Heure de début, faute de champ modèle réel, sont
// honnêtement désactivés plutôt que silencieusement ignorés.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import echographieReducer from '../../store/slices/echographieSlice';
import Echographie from '../Echographie.jsx';
import api from '../../api';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const RADIOLOGUE_FIXTURE_1 = { _id: 'rad-1', prenom: 'Aline', nom: 'Mabiala', role: 'radiologue' };
const RADIOLOGUE_FIXTURE_2 = { _id: 'rad-2', prenom: 'Paul', nom: 'Nzalé', role: 'radiologue' };
const DEMANDE_PLANIFIEE = {
  _id: 'echo-1', numero: 'ECH-1', patient_nom: 'Jane Doe', type: 'Obstétricale', sous_type: 'Grossesse',
  statut: 'planifiee', echographiste: 'Aline Mabiala', salle: 'Salle Écho 1', age: 30, sexe: 'F',
};

function renderEchographie() {
  const store = configureStore({ reducer: { echographie: echographieReducer } });
  return render(<Provider store={store}><MemoryRouter><Echographie /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/echographie/stats'))         return Promise.resolve({ data: {} });
    if (url.startsWith('/echographie?'))               return Promise.resolve({ data: { demandes: [DEMANDE_PLANIFIEE], total: 1 } });
    if (url.startsWith('/settings/services'))          return Promise.resolve({ data: { services: [] } });
    if (url.startsWith('/admin/users?role=radiologue')) return Promise.resolve({ data: { users: [RADIOLOGUE_FIXTURE_1, RADIOLOGUE_FIXTURE_2] } });
    return Promise.resolve({ data: {} });
  });
  api.put.mockResolvedValue({ data: { demande: { ...DEMANDE_PLANIFIEE, rapport_statut: 'en_validation' } } });
});

test('le formulaire "Paramètres d\'examen" pré-remplit les vraies valeurs assignées et transmet réellement une correction à la soumission', async () => {
  const user = userEvent.setup();
  renderEchographie();

  await user.click(await screen.findByRole('button', { name: /Réalisation/ }));
  await user.click(await screen.findByRole('button', { name: /Continuer →/ }));

  // getByDisplayValue sur un <select> matche le texte affiché de l'option
  // sélectionnée ("Dr. Prénom Nom"), pas la value brute ("Prénom Nom").
  const select = await screen.findByDisplayValue('Dr. Aline Mabiala');
  expect(select).toBeInTheDocument();
  expect(select.value).toBe('Aline Mabiala');
  expect(screen.getByDisplayValue('Salle Écho 1')).toBeInTheDocument();

  // Champs sans champ modèle réel : honnêtement désactivés, jamais une
  // saisie qui semble fonctionner mais n'est jamais persistée.
  expect(screen.getByPlaceholderText(/Non persisté/)).toBeDisabled();

  // Corrige le réalisateur effectif — un vrai radiologue de la liste.
  await user.selectOptions(select, 'Paul Nzalé');

  await user.click(screen.getByRole('button', { name: 'Continuer →' }));
  await user.click(screen.getByRole('button', { name: 'Continuer →' }));
  await user.click(screen.getByRole('button', { name: /Continuer vers le compte rendu/ }));
  await user.click(screen.getByRole('button', { name: /Soumettre à validation/ }));

  await waitFor(() => expect(api.put).toHaveBeenCalledWith(
    '/echographie/echo-1/rapport',
    expect.objectContaining({ echographiste: 'Paul Nzalé' }),
  ));
  // La salle n'a pas été changée — ne doit jamais être renvoyée (jamais une
  // valeur non modifiée réémise inutilement).
  const [, body] = api.put.mock.calls[0];
  expect(body.salle).toBeUndefined();
}, 20000);
