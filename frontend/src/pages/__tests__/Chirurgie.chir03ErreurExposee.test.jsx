// CHIR-03 (correction du 12 sept. 2026, audit indépendant) —
// loadDossiers()/loadStats() ne signalaient un échec réel de chargement
// qu'à la console (console.error), jamais à l'utilisateur : une liste
// vide / des KPIs à zéro sur échec réseau étaient indiscernables d'un
// service réellement sans dossier chirurgical. Ce test prouve que ces
// deux échecs sont désormais signalés explicitement.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Chirurgie from '../Chirurgie.jsx';

const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: (...a) => toastError(...a) }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

function renderChirurgie() {
  return render(<MemoryRouter><Chirurgie /></MemoryRouter>);
}

test('CHIR-03 — un échec réel de chargement des dossiers et des statistiques est signalé explicitement, jamais silencieux', async () => {
  api.get.mockImplementation((url) => {
    if (url.startsWith('/chirurgie/stats')) return Promise.reject({ response: { data: { message: 'Erreur serveur réelle stats' } } });
    if (url.startsWith('/chirurgie?')) return Promise.reject({ response: { data: { message: 'Erreur serveur réelle dossiers' } } });
    if (url.startsWith('/patients?')) return Promise.resolve({ data: { patients: [] } });
    if (url.startsWith('/admin/users?')) return Promise.resolve({ data: { users: [] } });
    return Promise.resolve({ data: {} });
  });
  renderChirurgie();

  await screen.findByText('Tableau de bord');
  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('dossiers chirurgicaux'));
  });
  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('statistiques chirurgicales'));
  });
});
