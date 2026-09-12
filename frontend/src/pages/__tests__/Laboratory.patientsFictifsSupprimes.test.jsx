// LAB-02 (correction du 12 sept. 2026, audit indépendant) — un échec de
// /patients injectait silencieusement 2 patients fictifs ("Jean Dupont",
// "Marie Paul"), sélectionnables comme réels dans la "Nouvelle demande".
// Ce test prouve qu'un échec réseau se traduit désormais par une liste
// honnêtement vide (jamais ces noms), avec une erreur explicite.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Laboratory from '../Laboratory.jsx';

const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: (...a) => toastError(...a) }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/laboratory?')) return Promise.resolve({ data: { results: [], total: 0 } });
    if (url.startsWith('/patients?')) return Promise.reject(new Error('network down'));
    return Promise.resolve({ data: {} });
  });
});

test('un échec de /patients ne présente jamais de patients fictifs sélectionnables — liste vide, erreur honnête', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><Laboratory /></MemoryRouter>);
  await screen.findByText('Tableau de bord');

  await user.click((await screen.findAllByRole('button', { name: /Nouvelle demande/ }))[0]);
  const dialog = await screen.findByRole('dialog');

  expect(dialog.textContent).not.toContain('Jean Dupont');
  expect(dialog.textContent).not.toContain('Marie Paul');
  expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Impossible de charger la liste des patients'));
});
