// Phase 7 (audit du 11 sept. 2026) — "Envoyer à la pharmacie" (onglet
// Prescriptions) et "Envoyer au service" (onglet Examens compl.) n'avaient
// aucun onClick — deux clics sans le moindre effet, sans aucune indication.
// consultations.routes.js n'expose que du CRUD (GET/POST/PUT/DELETE), aucune
// route d'envoi dédiée : même situation déjà traitée honnêtement sur cette
// même page pour la section Facturation (AUDIT-3.2, désactivé + tooltip),
// appliquée ici à l'identique.
//
// Monte le vrai composant Consultations.jsx avec le vrai reducer
// consultationsSlice ; seule la frontière réseau (`../../api`) et
// useRealtimeRefresh sont simulées.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import consultationsReducer from '../../store/slices/consultationsSlice';
import Consultations from '../Consultations.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const PATIENT_FIXTURE = { _id: 'pat-1', nom: 'Doe', prenom: 'Jane', sexe: 'F', numero_dossier: 'CLIN-2026-00001' };

function renderConsultations() {
  const store = configureStore({ reducer: { consultations: consultationsReducer } });
  return render(<Provider store={store}><MemoryRouter><Consultations /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/consultations?'))  return Promise.resolve({ data: { consultations: [], total: 0 } });
    if (url.startsWith('/patients?'))       return Promise.resolve({ data: { patients: [PATIENT_FIXTURE] } });
    if (url === '/settings/services')       return Promise.resolve({ data: { services: [{ _id: 's1', nom: 'Médecine Générale', statut: 'actif' }] } });
    return Promise.resolve({ data: {} });
  });
});

async function startNewConsultation(user) {
  const [newConsultBtn] = await screen.findAllByRole('button', { name: /Nouvelle consultation/ });
  await user.click(newConsultBtn);
  await user.click(await screen.findByRole('button', { name: /Sélectionner un patient/ }));
  await user.click(await screen.findByRole('button', { name: /Sélectionner →/ }));
}

test('"Envoyer à la pharmacie" est honnêtement désactivé, jamais un clic sans effet silencieux', async () => {
  const user = userEvent.setup();
  renderConsultations();
  await startNewConsultation(user);

  await user.click(await screen.findByRole('button', { name: /Prescriptions/ }));
  await user.click(await screen.findByRole('button', { name: /Première prescription/ }));
  const dialog = await screen.findByRole('dialog');
  await user.type(screen.getByPlaceholderText(/Paracétamol 500mg/), 'Doliprane 1000mg');
  await user.type(screen.getByPlaceholderText(/1 comprimé/), '1cp x3/j');
  await user.click(screen.getByRole('button', { name: /Ajouter à l'ordonnance/ }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  const sendBtn = await screen.findByRole('button', { name: /Envoyer à la pharmacie/ });
  expect(sendBtn).toBeDisabled();
  expect(sendBtn).toHaveAttribute('title', expect.stringContaining('momentanément indisponible'));

  await user.click(sendBtn, { skipPointerEventsCheck: true }).catch(() => {});
  expect(api.post).not.toHaveBeenCalledWith(expect.stringContaining('pharmacie'), expect.anything());
});

test('"Envoyer au service" est honnêtement désactivé, jamais un clic sans effet silencieux', async () => {
  const user = userEvent.setup();
  renderConsultations();
  await startNewConsultation(user);

  await user.click(await screen.findByRole('button', { name: /Examens compl\./ }));
  await user.click(await screen.findByRole('button', { name: /NFS complète/ }));

  const sendBtn = await screen.findByRole('button', { name: /Envoyer au service/ });
  expect(sendBtn).toBeDisabled();
  expect(sendBtn).toHaveAttribute('title', expect.stringContaining('momentanément indisponible'));
});
