// BLOC-02 (correction du 12 sept. 2026, audit indépendant) —
// loadInterventions()/loadStats() ne signalaient un échec réel de
// chargement qu'à la console (console.error), jamais à l'utilisateur :
// une liste/des salles vides sur échec réseau étaient indiscernables d'un
// bloc réellement sans intervention/salle. Ce test prouve que ces deux
// échecs sont désormais signalés explicitement.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Blocoperatoire from '../Blocoperatoire.jsx';

const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: (...a) => toastError(...a) }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

function renderBloc() {
  return render(<MemoryRouter><Blocoperatoire /></MemoryRouter>);
}

test('BLOC-02 — un échec réel de chargement du planning et des salles est signalé explicitement, jamais silencieux', async () => {
  api.get.mockImplementation((url) => {
    if (url.startsWith('/blocoperatoire/planning')) return Promise.reject({ response: { data: { message: 'Erreur serveur réelle planning' } } });
    if (url === '/blocoperatoire/salles') return Promise.reject({ response: { data: { message: 'Erreur serveur réelle salles' } } });
    if (url.startsWith('/patients?')) return Promise.resolve({ data: { patients: [] } });
    return Promise.resolve({ data: {} });
  });
  renderBloc();

  await screen.findByText('Tableau de bord');
  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('planning du bloc opératoire'));
  });
  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('salles du bloc opératoire'));
  });
});
