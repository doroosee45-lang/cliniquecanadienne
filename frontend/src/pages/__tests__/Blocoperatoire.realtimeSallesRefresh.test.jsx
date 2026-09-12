// REALTIME-SALLES-001 (rapport de clôture du 11 sept. 2026) — NEW-007 a unifié
// la source des salles sur loadStats()/`salles` (état local), mais seule
// loadInterventions() était câblée sur useRealtimeRefresh : un changement
// d'occupation de salle depuis un AUTRE poste (entrée/sortie de salle,
// blocoperatoireController.js::entreeSalle/sortieSalle) n'était donc jamais
// répercuté ici. loadStats() est désormais elle aussi câblée sur
// useRealtimeRefresh (même mécanisme dashboard:refresh, aucun second système
// temps réel, aucun doublon de fetch avec loadInterventions — deux fonctions
// distinctes). Ce test capture les fonctions réellement passées au hook
// (simulé) et prouve que celle rattachée aux salles recharge bien
// /blocoperatoire/salles, pas /blocoperatoire/planning.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Blocoperatoire from '../Blocoperatoire.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

// Set (pas un tableau) : le composant se re-rend plusieurs fois pendant le
// chargement initial, et le hook simulé — appelé directement dans le corps
// du rendu, pas dans un effet — s'exécute à chaque fois. loadInterventions/
// loadStats sont des useCallback stables (deps figées), donc la même
// référence de fonction est repassée à chaque re-rendu : un Set déduplique
// naturellement vers les 2 véritables call-sites, un tableau non.
const capturedRefreshFns = new Set();
vi.mock('../../hooks/useRealtimeRefresh', () => ({
  useRealtimeRefresh: (fn) => { capturedRefreshFns.add(fn); },
}));

const SALLE_REELLE = { id: 'BO-9', nom: 'Salle 9 — Test réel' };

function renderBloc() {
  return render(<MemoryRouter><Blocoperatoire /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedRefreshFns.clear();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/blocoperatoire/planning')) return Promise.resolve({ data: { planning: [] } });
    if (url === '/blocoperatoire/salles') return Promise.resolve({ data: { salles: [SALLE_REELLE] } });
    if (url.startsWith('/patients')) return Promise.resolve({ data: { patients: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('loadStats (salles) est réellement câblée sur le rafraîchissement temps réel — un événement dashboard:refresh d\'un autre poste recharge réellement les salles', async () => {
  renderBloc();
  await screen.findByText('Tableau de bord');

  // useRealtimeRefresh(loadInterventions) ET useRealtimeRefresh(loadStats)
  // doivent toutes deux avoir été appelées — la seconde est le correctif.
  expect(capturedRefreshFns.size).toBe(2);

  api.get.mockClear();
  // Simule ce que ferait un vrai événement dashboard:refresh reçu d'un
  // autre poste (entreeSalle/sortieSalle) : appelle chaque fonction câblée.
  await Promise.all([...capturedRefreshFns].map(fn => fn()));

  const sallesCalls = api.get.mock.calls.filter(([url]) => url === '/blocoperatoire/salles');
  expect(sallesCalls.length).toBeGreaterThan(0);
  const interventionsCalls = api.get.mock.calls.filter(([url]) => url.startsWith('/blocoperatoire/planning'));
  expect(interventionsCalls.length).toBeGreaterThan(0);
});
