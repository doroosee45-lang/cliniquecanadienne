// PDF-ORD-001 (rapport de clôture du 11 sept. 2026) — "Télécharger PDF"
// (modale Ordonnance) était désactivé (AUDIT-3.2 ne concernait que la
// facturation/impression, un périmètre distinct) alors que jsPDF est déjà
// une dépendance réelle du projet. Génère désormais un vrai PDF à partir des
// mêmes données que l'aperçu écran (form.prescriptions, form.patient_*,
// medecinLabel(form.medecin)) — ce test prouve que le contenu réellement
// saisi (médicament, patient) atteint bien le générateur PDF, jamais une
// donnée fabriquée, et que jsPDF n'est appelé qu'après un vrai clic.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import consultationsReducer from '../../store/slices/consultationsSlice';
import Consultations from '../Consultations.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

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

import api from '../../api';

const PATIENT_FIXTURE = { _id: 'pat-1', nom: 'Doe', prenom: 'Jane', sexe: 'F', numero_dossier: 'CLIN-2026-00001' };

function renderConsultations() {
  const store = configureStore({ reducer: { consultations: consultationsReducer } });
  return render(<Provider store={store}><MemoryRouter><Consultations /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  texts.length = 0;
  api.get.mockImplementation((url) => {
    if (url.startsWith('/consultations?')) return Promise.resolve({ data: { consultations: [], total: 0 } });
    if (url.startsWith('/patients?'))      return Promise.resolve({ data: { patients: [PATIENT_FIXTURE] } });
    if (url === '/settings/services')      return Promise.resolve({ data: { services: [{ _id: 's1', nom: 'Médecine Générale', statut: 'actif' }] } });
    return Promise.resolve({ data: {} });
  });
});

test('"Télécharger PDF" génère réellement un PDF à partir des données saisies (patient + médicament réels)', async () => {
  const user = userEvent.setup();
  renderConsultations();

  const [newConsultBtn] = await screen.findAllByRole('button', { name: /Nouvelle consultation/ });
  await user.click(newConsultBtn);
  await user.click(await screen.findByRole('button', { name: /Sélectionner un patient/ }));
  await user.click(await screen.findByRole('button', { name: /Sélectionner →/ }));

  await user.click(await screen.findByRole('button', { name: /Prescriptions/ }));
  await user.click(await screen.findByRole('button', { name: /Première prescription/ }));
  await user.type(screen.getByPlaceholderText(/Paracétamol 500mg/), 'Amoxicilline 500mg');
  await user.type(screen.getByPlaceholderText(/1 comprimé/), '1cp x2/j');
  await user.click(screen.getByRole('button', { name: /Ajouter à l'ordonnance/ }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  await user.click(await screen.findByRole('button', { name: /Aperçu ordonnance/ }));
  const dlBtn = await screen.findByRole('button', { name: /Télécharger PDF/ });
  expect(dlBtn).not.toBeDisabled();
  await user.click(dlBtn);

  await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
  const rendered = texts.join(' | ');
  expect(rendered).toContain('Amoxicilline 500mg');
  expect(rendered).toContain('Jane');
  expect(rendered).toContain('Doe');
}, 20000);
