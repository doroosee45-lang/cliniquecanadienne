// PORTAL-DOSSIER-001 (audit du 12 sept. 2026, mission "Compléter Mon dossier
// du portail patient") — "Mon dossier" (onglet Profil de Portal.jsx)
// n'affichait ni consultations, ni hospitalisations, ni documents réels.
// Ce test prouve que les trois sections affichent bien les données reçues de
// l'API (jamais une donnée fabriquée), et que le téléchargement d'un document
// déclenche réellement une navigation vers l'endpoint sécurisé
// GET /portal/documents/:id/download avec le bon identifiant.
import { render, screen, waitFor, within } from '@testing-library/react';
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
vi.mock('jspdf', () => ({ default: vi.fn() }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), defaults: { baseURL: '/api' } } }));
import api from '../../api';

const PATIENT = { _id: 'pat-1', nom: 'Doe', prenom: 'Jane', sexe: 'F', numero_dossier: 'CLIN-2026-00001' };
const CONSULTATION = { _id: 'cons-1', medecin: { nom: 'Nguema', prenom: 'Paul', specialite: 'Cardiologie' }, date_consultation: '2026-08-01', diagnostic: 'Hypertension légère', statut: 'terminee' };
const HOSPITALIZATION = { _id: 'hosp-1', date_entree: '2026-07-01', date_sortie: '2026-07-05', service_nom: 'Chirurgie', motif_entree: 'Appendicite aiguë', statut: 'sorti' };
const DOCUMENT = { _id: 'doc-1', nom: 'Certificat médical.pdf', type: 'certificat', taille: 20480, createdAt: '2026-08-10' };

function renderPortal() {
  const store = configureStore({ reducer: { portal: portalReducer } });
  return render(<Provider store={store}><MemoryRouter><Portal /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  window.open = vi.fn();
  api.get.mockImplementation((url) => {
    if (url === '/portal/me') return Promise.resolve({ data: { patient: PATIENT, stats: {}, must_change_password: false } });
    if (url === '/portal/appointments') return Promise.resolve({ data: { appointments: [] } });
    if (url === '/portal/prescriptions') return Promise.resolve({ data: { prescriptions: [] } });
    if (url === '/portal/lab-results') return Promise.resolve({ data: { labResults: [] } });
    if (url === '/portal/imaging') return Promise.resolve({ data: { imaging: [] } });
    if (url === '/portal/invoices') return Promise.resolve({ data: { invoices: [] } });
    if (url === '/portal/notifications') return Promise.resolve({ data: { notifications: [] } });
    if (url === '/portal/dashboard') return Promise.resolve({ data: { stats: {} } });
    if (url === '/portal/vaccinations') return Promise.resolve({ data: { vaccinations: [] } });
    if (url === '/portal/consultations') return Promise.resolve({ data: { consultations: [CONSULTATION] } });
    if (url === '/portal/hospitalizations') return Promise.resolve({ data: { hospitalizations: [HOSPITALIZATION] } });
    if (url === '/portal/documents') return Promise.resolve({ data: { documents: [DOCUMENT] } });
    return Promise.resolve({ data: {} });
  });
});

test('"Mon dossier" affiche les vraies consultations, hospitalisations et documents reçus de l\'API', async () => {
  const user = userEvent.setup();
  renderPortal();

  await user.click(await screen.findByRole('button', { name: /Mon Profil/ }));
  await screen.findByText('Hypertension légère');
  expect(screen.getByText(/Nguema/)).toBeInTheDocument();
  expect(screen.getByText('Appendicite aiguë')).toBeInTheDocument();
  expect(screen.getByText('Certificat médical.pdf')).toBeInTheDocument();
});

test('"Télécharger" (document) ouvre réellement GET /portal/documents/:id/download avec le bon identifiant', async () => {
  const user = userEvent.setup();
  renderPortal();

  await user.click(await screen.findByRole('button', { name: /Mon Profil/ }));
  const docText = await screen.findByText('Certificat médical.pdf');
  const docRow = docText.parentElement.parentElement;
  const dlBtn = within(docRow).getByRole('button', { name: /Télécharger/ });
  await user.click(dlBtn);

  await waitFor(() => expect(window.open).toHaveBeenCalledWith('/api/portal/documents/doc-1/download', '_blank'));
});
