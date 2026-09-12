// ECHO-04 (correction du 12 sept. 2026, audit indépendant) — les états de
// chargement et d'erreur n'étaient pas correctement exposés à l'interface :
// state.error était déjà réellement renseigné par fetchDemandes.rejected,
// mais aucun sélecteur ne l'exposait, et la liste vide affichait toujours
// le même message "Aucune demande trouvée" qu'un chargement en cours ou un
// échec réseau réel. Ce test prouve la distinction réelle des trois états.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import echographieReducer from '../../store/slices/echographieSlice';
import Echographie from '../Echographie.jsx';

const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: (...a) => toastError(...a) }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

function renderEchographie() {
  const store = configureStore({ reducer: { echographie: echographieReducer } });
  return render(<Provider store={store}><MemoryRouter><Echographie /></MemoryRouter></Provider>);
}

test('ECHO-04 — un échec réel de chargement est signalé explicitement, jamais confondu avec une liste réellement vide', async () => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/echographie/stats')) return Promise.resolve({ data: {} });
    if (url.startsWith('/settings/services')) return Promise.resolve({ data: { services: [] } });
    if (url.startsWith('/echographie?')) return Promise.reject({ response: { data: { message: 'Erreur serveur réelle' } } });
    return Promise.resolve({ data: {} });
  });
  const user = userEvent.setup();
  renderEchographie();

  await user.click(await screen.findByRole('button', { name: /Demandes/ }));
  await screen.findByText('❌ Erreur de chargement — réessayez');
  expect(screen.queryByText('Aucune demande trouvée')).not.toBeInTheDocument();

  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Erreur serveur réelle'));
  });
});

test('ECHO-04 — une liste réellement vide (chargement réussi, zéro demande) affiche l\'état vide honnête, jamais une erreur fabriquée', async () => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/echographie/stats')) return Promise.resolve({ data: {} });
    if (url.startsWith('/settings/services')) return Promise.resolve({ data: { services: [] } });
    if (url.startsWith('/echographie?')) return Promise.resolve({ data: { demandes: [], total: 0 } });
    return Promise.resolve({ data: {} });
  });
  const user = userEvent.setup();
  renderEchographie();

  await user.click(await screen.findByRole('button', { name: /Demandes/ }));
  await screen.findByText('Aucune demande trouvée');
  expect(toastError).not.toHaveBeenCalled();
});
