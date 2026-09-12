// PORTAL-MSG-001 (audit du 12 sept. 2026, mission "Correction stricte de la
// messagerie patient") — l'onglet "Messagerie" était honnêtement désactivé
// (Correction 3). Réactivé en réutilisant GET /messages, GET /messages/:id,
// POST /messages/:id/send (existants, non modifiés) + POST /portal/messages
// et GET /portal/messages/contacts (nouveaux, portal.controller.js). Ce test
// prouve que l'onglet charge réellement les conversations/contacts depuis
// l'API, ouvre une conversation, affiche les vrais messages, et qu'envoyer un
// message appelle réellement POST /messages/:id/send avec le bon contenu —
// jamais une simulation.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import portalReducer from '../../store/slices/portalSlice';
import Portal from '../Portal.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));
vi.mock('../../contexts/SocketContext', () => ({ useSocket: () => ({ socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() }, connected: true }) }));
vi.mock('jspdf', () => ({ default: vi.fn() }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), defaults: { baseURL: '/api' } } }));
import api from '../../api';

const PATIENT = { _id: 'pat-1', nom: 'Doe', prenom: 'Jane', sexe: 'F', numero_dossier: 'CLIN-2026-00001' };
const CONTACT = { _id: 'med-1', nom: 'Nguema', prenom: 'Paul', role: 'medecin', specialite: 'Cardiologie' };
const CONVERSATION = { _id: 'conv-1', type: 'direct', membres: [{ _id: 'med-1', nom: 'Nguema', prenom: 'Paul', role: 'medecin' }, { _id: 'pat-1', nom: 'Doe', prenom: 'Jane', role: 'patient' }], dernier_message_apercu: 'Bonjour', dernier_message: '2026-09-01T10:00:00.000Z' };
const MESSAGE_DOC = { _id: 'msg-1', contenu: 'Bonjour docteur', expediteur: { _id: 'pat-1', nom: 'Doe', prenom: 'Jane', role: 'patient' }, date_envoi: '2026-09-01T10:00:00.000Z' };

function renderPortal() {
  const store = configureStore({ reducer: { portal: portalReducer } });
  return render(<Provider store={store}><MemoryRouter><Portal /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
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
    if (url === '/portal/consultations') return Promise.resolve({ data: { consultations: [] } });
    if (url === '/portal/hospitalizations') return Promise.resolve({ data: { hospitalizations: [] } });
    if (url === '/portal/documents') return Promise.resolve({ data: { documents: [] } });
    if (url === '/portal/messages/contacts') return Promise.resolve({ data: { contacts: [CONTACT] } });
    if (url === '/messages') return Promise.resolve({ data: { conversations: [CONVERSATION] } });
    if (url === '/messages/conv-1') return Promise.resolve({ data: { messages: [MESSAGE_DOC] } });
    return Promise.resolve({ data: {} });
  });
});

test('Messagerie — charge les vraies conversations et affiche les vrais messages en ouvrant une conversation', async () => {
  const user = userEvent.setup();
  renderPortal();

  await user.click(await screen.findByRole('button', { name: /Messagerie/ }));
  await screen.findByText(/Nguema/);
  await user.click(screen.getByText('Bonjour'));

  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/messages/conv-1'));
  await screen.findByText('Bonjour docteur');
});

test('Envoyer un message appelle réellement POST /messages/:id/send avec le contenu saisi', async () => {
  const user = userEvent.setup();
  api.post.mockResolvedValue({ data: { message: { _id: 'msg-2', contenu: 'Une question sur mon traitement', expediteur: { _id: 'pat-1', role: 'patient' }, date_envoi: new Date().toISOString() } } });
  renderPortal();

  await user.click(await screen.findByRole('button', { name: /Messagerie/ }));
  await user.click(await screen.findByText('Bonjour'));
  await screen.findByText('Bonjour docteur');

  const input = screen.getByPlaceholderText('Écrire un message…');
  await user.type(input, 'Une question sur mon traitement');
  await user.click(screen.getByRole('button', { name: 'Envoyer' }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/messages/conv-1/send', { contenu: 'Une question sur mon traitement' }));
  await screen.findByText('Une question sur mon traitement');
});

test('Nouveau message — le destinataire vient réellement de GET /portal/messages/contacts, et POST /portal/messages ouvre la conversation', async () => {
  const user = userEvent.setup();
  api.post.mockResolvedValue({ data: { conversation: CONVERSATION } });
  renderPortal();

  await user.click(await screen.findByRole('button', { name: /Messagerie/ }));
  await user.click(await screen.findByRole('button', { name: /Nouveau message/ }));

  const select = await screen.findByRole('combobox');
  await waitFor(() => expect(select.querySelector('option[value="med-1"]')).not.toBeNull());
  await user.selectOptions(select, 'med-1');
  await user.click(screen.getByRole('button', { name: /Ouvrir la conversation/ }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/portal/messages', { userId: 'med-1' }));
});
