// APPT-01 (correction du 12 sept. 2026, audit indépendant) — la liste
// locale `rdvs` (pilote tout l'affichage : tableau, calendrier, KPIs) ne se
// resynchronisait avec Redux que lorsque la nouvelle liste n'était PAS
// vide (`reduxRdvs.length > 0`). Un rafraîchissement légitime renvoyant une
// liste vide (rendez-vous réellement supprimés/déplacés ailleurs) laissait
// donc l'ancien contenu affiché indéfiniment comme s'il était toujours
// actuel. Ce test prouve qu'un vrai rafraîchissement temps réel (capturé via
// useRealtimeRefresh simulé) qui renvoie désormais une liste vide fait
// réellement disparaître le rendez-vous affiché.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import appointmentsReducer from '../../store/slices/appointmentsSlice';
import Appointments from '../Appointments.jsx';
import api from '../../api';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

let capturedRefresh = null;
vi.mock('../../hooks/useRealtimeRefresh', () => ({
  useRealtimeRefresh: (fn) => { capturedRefresh = fn; },
}));

const RDV_FIXTURE = {
  _id: 'rdv-1', patient: { _id: 'pat-1', nom: 'Doe', prenom: 'Jane' }, patient_nom: 'Jane Doe',
  medecin: { _id: 'med-1', nom: 'Kimbou', prenom: 'Alain' }, date_heure: '2026-09-15T10:00:00.000Z',
  type: 'consultation', statut: 'confirme', duree_minutes: 30,
};

function renderAppointments() {
  const store = configureStore({ reducer: { appointments: appointmentsReducer } });
  return render(<Provider store={store}><MemoryRouter><Appointments /></MemoryRouter></Provider>);
}

let listeActuelle;
beforeEach(() => {
  vi.clearAllMocks();
  capturedRefresh = null;
  listeActuelle = [RDV_FIXTURE];
  api.get.mockImplementation((url) => {
    if (url.startsWith('/appointments?')) return Promise.resolve({ data: { appointments: listeActuelle, total: listeActuelle.length } });
    if (url.startsWith('/admin/users')) return Promise.resolve({ data: { users: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('un rafraîchissement réel renvoyant une liste vide fait réellement disparaître les rendez-vous affichés, jamais une liste obsolète', async () => {
  const user = userEvent.setup();
  renderAppointments();

  await user.click(await screen.findByRole('button', { name: /Liste des RDV/ }));
  await screen.findByText('Jane Doe');
  expect(typeof capturedRefresh).toBe('function');

  // Simule ce qu'un vrai événement temps réel déclencherait : les rendez-vous
  // ont réellement été supprimés/déplacés côté serveur — la prochaine
  // requête renvoie honnêtement une liste vide.
  listeActuelle = [];
  await capturedRefresh();

  await waitFor(() => expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument());
});
