// URG-01 + URG-02 (correction du 12 sept. 2026, audit indépendant) — le
// panneau "Lits disponibles" affichait 4 zones et des chiffres entièrement
// inventés (aucune donnée réelle, aucune zone de ce type dans le modèle) ;
// la "Courbe d'évolution" de la surveillance affichait 8 points de
// température fabriqués, dans le dossier réel d'un patient. Ce test prouve
// que "Lits disponibles" reflète désormais réellement GET /hospitalization/
// rooms (vrais types de chambre, vraie occupation), et que la courbe
// fabriquée a été remplacée par un état honnête (aucune donnée inventée).
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import urgencesReducer from '../../store/slices/urgencesSlice';
import Urgences from '../Urgences.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') } }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const URG_FIXTURE = {
  _id: 'urg-1', numero: 'URG-2026-0001', patient_nom: 'Jean Mabiala',
  niveau_triage: 'orange', statut: 'attente', motif: 'Douleur thoracique',
  date_arrivee: new Date().toISOString(), medecin: '', infirmier: '',
  temperature: 38.4, pouls: null, tension_sys: null, tension_dia: null, spo2: null, glycemie: null,
  antecedents: '', allergies: '', traitements_cours: '', observations: '', diagnostic_provisoire: '',
  examens: [],
};
const ROOMS_FIXTURE = [
  { _id: 'r1', type: 'reanimation', lits: [{ statut: 'libre' }, { statut: 'occupe' }] },
  { _id: 'r2', type: 'standard', lits: [{ statut: 'libre' }, { statut: 'libre' }, { statut: 'occupe' }] },
];

function renderUrgences() {
  const store = configureStore({ reducer: { urgences: urgencesReducer } });
  return render(<Provider store={store}><MemoryRouter><Urgences /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url === '/urgences/stats') return Promise.resolve({ data: { kpis: {}, triageMap: {}, chart: {} } });
    if (url.startsWith('/urgences?')) return Promise.resolve({ data: { urgences: [URG_FIXTURE], total: 1 } });
    if (url === '/ambulances') return Promise.resolve({ data: { ambulances: [] } });
    if (url === '/urgences/urg-1') return Promise.resolve({ data: { invoice: null } });
    if (url.startsWith('/urgences/urg-1/')) return Promise.resolve({ data: {} });
    if (url === '/hospitalization/rooms') return Promise.resolve({ data: { rooms: ROOMS_FIXTURE } });
    return Promise.resolve({ data: {} });
  });
});

test('URG-01 — "Lits disponibles" reflète réellement GET /hospitalization/rooms, jamais les 4 zones fictives d\'origine', async () => {
  renderUrgences();

  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/hospitalization/rooms'));
  // Vrai type de chambre (Room.type), avec la vraie occupation calculée :
  // réanimation 1 libre/2, standard 2 libres/3.
  await screen.findByText('Réanimation');
  await screen.findByText('1/2');
  await screen.findByText('Standard');
  await screen.findByText('2/3');

  // Les 4 zones fictives d'origine ne doivent plus jamais apparaître.
  expect(screen.queryByText('Salle soins')).not.toBeInTheDocument();
  expect(screen.queryByText('Observation')).not.toBeInTheDocument();
  expect(screen.queryByText('Soins intens.')).not.toBeInTheDocument();
});

test('URG-01 — en l\'absence de données de chambres, affiche honnêtement un état vide, jamais un chiffre inventé', async () => {
  api.get.mockImplementation((url) => {
    if (url === '/hospitalization/rooms') return Promise.reject(new Error('network'));
    if (url === '/urgences/stats') return Promise.resolve({ data: { kpis: {}, triageMap: {}, chart: {} } });
    if (url.startsWith('/urgences?')) return Promise.resolve({ data: { urgences: [URG_FIXTURE], total: 1 } });
    return Promise.resolve({ data: {} });
  });
  renderUrgences();
  await screen.findByText('Aucune donnée de lit disponible.');
});

test('URG-02 — la courbe de température fabriquée a été remplacée par un état honnête, jamais une valeur inventée', async () => {
  const user = userEvent.setup();
  renderUrgences();

  const rows = await screen.findAllByText('Jean Mabiala');
  const row = rows.map((el) => el.closest('.urgence-row')).find(Boolean);
  await user.click(row);
  await user.click(await screen.findByRole('button', { name: /Surveillance/ }));

  await screen.findByText(/Aucun historique de constantes disponible/);
  // La vraie mesure ponctuelle (38.4°C, déjà réelle) reste affichée.
  await screen.findByText('38.4°C');
  // Les valeurs fabriquées d'origine ne doivent plus jamais apparaître.
  expect(screen.queryByText('37.2')).not.toBeInTheDocument();
  expect(screen.queryByText(/Dernières 4 heures/)).not.toBeInTheDocument();
});
