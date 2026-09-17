// Mission harmonisation sélection patient (17 sept. 2026) — Vague 3.
// Sélectionner un patient existant dans le menu "Patient existant" du
// formulaire d'admission ne renseignait jusqu'ici que patient_id : les
// champs affichés (Nom complet, Date de naissance, Sexe, Téléphone)
// restaient un texte libre totalement indépendant, pouvant afficher un nom
// sans aucun rapport avec le patient réellement sélectionné avant l'envoi.
// Le backend (POST5-016, urgencesController.js::create) dérive déjà
// patient_nom du vrai Patient référencé et ignore tout texte client dès
// qu'un patient_id réel est fourni — donc jamais de dossier réellement
// incohérent en base — mais ce test prouve que le FORMULAIRE reflète
// désormais lui aussi immédiatement le vrai patient sélectionné, sans
// appel réseau supplémentaire (liste déjà chargée), sur le même principe
// que Consultations.jsx::selectPatient.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import urgencesReducer from '../../store/slices/urgencesSlice';
import Urgences from '../Urgences.jsx';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') },
}));
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';

const PATIENT_REEL = {
  _id: 'pat-reel-1', nom: 'Nguema', prenom: 'Sylvie', numero_dossier: 'DOS-0042',
  date_naissance: '1992-04-15T00:00:00.000Z', sexe: 'F', telephone: '067000001',
};

function renderUrgences() {
  const store = configureStore({ reducer: { urgences: urgencesReducer } });
  return render(<Provider store={store}><MemoryRouter><Urgences /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url === '/urgences/stats') return Promise.resolve({ data: { kpis: {}, triageMap: {}, chart: {} } });
    if (url.startsWith('/urgences?')) return Promise.resolve({ data: { urgences: [], total: 0 } });
    if (url === '/ambulances') return Promise.resolve({ data: { ambulances: [] } });
    if (url === '/patients?limit=500') return Promise.resolve({ data: { patients: [PATIENT_REEL] } });
    return Promise.resolve({ data: {} });
  });
});

test('sélectionner un patient existant recopie immédiatement ses vrais champs dans le formulaire, jamais un texte sans rapport', async () => {
  const user = userEvent.setup();
  renderUrgences();

  await user.click((await screen.findAllByRole('button', { name: /Nouveau patient/ }))[0]);

  // Le select "Patient existant" est le premier combobox du formulaire,
  // repéré par son option de tête plutôt qu'un id (aucun id/aria-label
  // posé dans le composant).
  const selects = await screen.findAllByRole('combobox');
  const patientSelect = selects.find(s => within(s).queryByText('— Sélectionner un patient —'));
  expect(patientSelect).toBeTruthy();

  await user.selectOptions(patientSelect, 'pat-reel-1');

  expect(screen.getByPlaceholderText('Nom et prénom du patient')).toHaveValue('Sylvie Nguema');
  expect(document.querySelector('input[type="date"]')).toHaveValue('1992-04-15');
  const sexeSelect = selects.find(s => within(s).queryByText('Femme'));
  expect(sexeSelect).toHaveValue('femme');
});

test('intake non identifié (aucun patient existant) : les champs restent un texte libre éditable, comportement inchangé', async () => {
  const user = userEvent.setup();
  renderUrgences();

  await user.click((await screen.findAllByRole('button', { name: /Nouveau patient/ }))[0]);

  const nomInput = screen.getByPlaceholderText('Nom et prénom du patient');
  await user.type(nomInput, 'Patient Non Identifié');
  expect(nomInput).toHaveValue('Patient Non Identifié');
});
