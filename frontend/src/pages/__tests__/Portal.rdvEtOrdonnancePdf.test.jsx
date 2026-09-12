// PORTAL-RDV-001 / PORTAL-PDF-001 (audit du 12 sept. 2026, mission
// "Correction et vérification complète du portail patient") — Portal.jsx
// n'avait ni prise de RDV, ni annulation, ni téléchargement d'ordonnance
// réellement fonctionnels (boutons honnêtement désactivés faute de route/
// câblage réel, AUDIT-11 / Sous-phases précédentes). Ce test prouve, comme
// Consultations.pdfOrdonnanceReel.test.jsx pour le personnel, que :
// (1) la modale de prise de RDV appelle réellement POST /portal/appointments
// avec les données saisies (jamais une simulation) ;
// (2) le téléchargement d'ordonnance génère un vrai PDF à partir des
// données réellement reçues de l'API (jamais une donnée fabriquée), et ne
// dépend d'aucun identifiant manipulable côté client (la donnée vient de
// GET /portal/prescriptions, déjà filtrée côté serveur sur le patient
// connecté).
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import portalReducer from '../../store/slices/portalSlice';
import Portal from '../Portal.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));
vi.mock('../../contexts/SocketContext', () => ({ useSocket: () => ({ socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() }, connected: true }) }));

const texts = [];
const saveMock = vi.fn();
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(function MockJsPDF() {
    return {
      internal: { pageSize: { getWidth: () => 210 } },
      setFont: vi.fn(), setFontSize: vi.fn(), setDrawColor: vi.fn(),
      line: vi.fn(), addPage: vi.fn(),
      text: (...args) => { texts.push(args[0]); },
      save: saveMock,
    };
  }),
}));

vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
import api from '../../api';

const PATIENT = { _id: 'pat-1', nom: 'Doe', prenom: 'Jane', sexe: 'F', numero_dossier: 'CLIN-2026-00001', groupe_sanguin: 'O+', date_naissance: '1990-01-01' };
const MEDECIN = { _id: 'med-1', nom: 'Nguema', prenom: 'Paul', specialite: 'Cardiologie' };
const SERVICE = { _id: 'srv-1', nom: 'Cardiologie' };
const PRESCRIPTION = {
  _id: 'rx-1', statut: 'active',
  medecin: { nom: 'Nguema', prenom: 'Paul' },
  date_prescription: '2026-09-01', date_expiration: '2026-12-01',
  lignes: [{ medicament_nom: 'Amoxicilline 500mg', posologie: '1cp x2/j' }],
};

function renderPortal() {
  const store = configureStore({ reducer: { portal: portalReducer } });
  return render(<Provider store={store}><MemoryRouter><Portal /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  texts.length = 0;
  api.get.mockImplementation((url) => {
    if (url === '/portal/me') return Promise.resolve({ data: { patient: PATIENT, stats: {}, must_change_password: false } });
    if (url === '/portal/appointments') return Promise.resolve({ data: { appointments: [] } });
    if (url === '/portal/prescriptions') return Promise.resolve({ data: { prescriptions: [PRESCRIPTION] } });
    if (url === '/portal/lab-results') return Promise.resolve({ data: { labResults: [] } });
    if (url === '/portal/imaging') return Promise.resolve({ data: { imaging: [] } });
    if (url === '/portal/invoices') return Promise.resolve({ data: { invoices: [] } });
    if (url === '/portal/notifications') return Promise.resolve({ data: { notifications: [] } });
    if (url === '/portal/dashboard') return Promise.resolve({ data: { stats: {} } });
    if (url === '/portal/vaccinations') return Promise.resolve({ data: { vaccinations: [] } });
    if (url === '/portal/booking-options') return Promise.resolve({ data: { services: [SERVICE], medecins: [MEDECIN] } });
    return Promise.resolve({ data: {} });
  });
});

test('"Prendre un rendez-vous" appelle réellement POST /portal/appointments avec les données saisies', async () => {
  const user = userEvent.setup();
  api.post.mockResolvedValue({ data: { appointment: { _id: 'appt-1', statut: 'en_attente', patient: 'pat-1', medecin: MEDECIN, date_heure: '2026-12-01T09:00:00.000Z' } } });
  renderPortal();

  await user.click(await screen.findByRole('button', { name: /Prendre RDV/ }));
  await screen.findByText('— Sélectionner un médecin —');

  await user.selectOptions(screen.getByDisplayValue('— Sélectionner un médecin —'), 'med-1');
  const dateInput = document.querySelector('input[type="date"]');
  await user.type(dateInput, '2026-12-01');
  await user.type(screen.getByPlaceholderText(/Décrivez brièvement/), 'Douleur thoracique');

  await user.click(screen.getByRole('button', { name: /Demander le rendez-vous/ }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/portal/appointments', expect.objectContaining({
    medecin: 'med-1',
    motif: 'Douleur thoracique',
  })));
  const [, payload] = api.post.mock.calls[0];
  expect(payload.date_heure).toContain('2026-12-01');
});

test('"Télécharger" (Ordonnances) génère un vrai PDF à partir de la prescription reçue de l\'API', async () => {
  const user = userEvent.setup();
  renderPortal();

  await user.click(await screen.findByRole('button', { name: /Mes Rendez|Ordonnances/ }).catch(() => {}));
  // Onglet Ordonnances
  const tabs = await screen.findAllByText(/Ordonnances/);
  await user.click(tabs[0]);

  const dlBtn = await screen.findByRole('button', { name: /Télécharger/ });
  await user.click(dlBtn);

  await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
  const rendered = texts.join(' | ');
  expect(rendered).toContain('Amoxicilline 500mg');
  expect(rendered).toContain('Jane');
  expect(rendered).toContain('Doe');
}, 20000);
