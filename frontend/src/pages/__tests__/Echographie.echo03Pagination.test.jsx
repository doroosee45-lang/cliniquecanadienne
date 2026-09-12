// ECHO-03 (correction du 12 sept. 2026, audit indépendant) — la liste des
// demandes d'échographie rechargeait toujours limit:100 sans page réelle :
// au-delà de 100 demandes réelles, la page suivante n'était jamais
// atteignable, aucune pagination réelle n'existait dans l'interface
// (total/page étaient pourtant déjà exposés par echographieSlice.js,
// jamais lus par Echographie.jsx). Ce test prouve qu'avec plus de 100
// demandes réelles, un vrai bouton "Suivant" apparaît et charge réellement
// la page 2.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import echographieReducer from '../../store/slices/echographieSlice';
import Echographie from '../Echographie.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

function renderEchographie() {
  const store = configureStore({ reducer: { echographie: echographieReducer } });
  return render(<Provider store={store}><MemoryRouter><Echographie /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/echographie/stats')) return Promise.resolve({ data: {} });
    if (url.startsWith('/settings/services')) return Promise.resolve({ data: { services: [] } });
    if (url.startsWith('/echographie?')) {
      const u = new URL(url, 'http://x');
      const page = u.searchParams.get('page');
      if (page === '2') {
        return Promise.resolve({ data: { demandes: [{ _id: 'e101', id: 'e101', numero: 'ECH-0101', patient_nom: 'Page2Seule', statut: 'en_attente', priorite: 'normale', type: 'Abdominale' }], total: 150 } });
      }
      return Promise.resolve({ data: { demandes: [{ _id: 'e1', id: 'e1', numero: 'ECH-0001', patient_nom: 'Page1Seule', statut: 'en_attente', priorite: 'normale', type: 'Abdominale' }], total: 150 } });
    }
    return Promise.resolve({ data: {} });
  });
});

test('ECHO-03 — au-delà de 100 demandes réelles, "Suivant" charge réellement la page 2', async () => {
  const user = userEvent.setup();
  renderEchographie();

  await user.click(await screen.findByRole('button', { name: /Demandes/ }));
  await screen.findByText('ECH-0001');
  await screen.findByText(/Page 1 \/ 2 · 150 demandes/);
  expect(screen.queryByText('ECH-0101')).not.toBeInTheDocument();

  await user.click(await screen.findByRole('button', { name: /Suivant/ }));

  await screen.findByText('ECH-0101');
  expect(screen.queryByText('ECH-0001')).not.toBeInTheDocument();
  await screen.findByText(/Page 2 \/ 2 · 150 demandes/);
});
