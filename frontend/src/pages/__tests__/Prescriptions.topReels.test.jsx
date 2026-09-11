// Phase 7 (audit du 11 sept. 2026) — "Médicaments les plus prescrits" et
// "Top prescripteurs" (Dashboard) étaient deux tableaux codés en dur
// ("Paracétamol" 38%, "Dr. Martin Leblanc" 42...), jamais recalculés depuis
// les vraies ordonnances déjà chargées par loadOrds — les mêmes chiffres
// fictifs s'affichaient en permanence, juxtaposés à de vrais KPIs sur le
// même tableau de bord. Corrigé : agrégé depuis `ordonnances`, même
// principe que buildOrdonnancesParMois (déjà réel sur cette page).
//
// Monte le vrai composant Prescriptions.jsx avec le vrai reducer
// prescriptionsSlice ; seule la frontière réseau (`../../api`) et
// useRealtimeRefresh sont simulées.
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import prescriptionsReducer from '../../store/slices/prescriptionsSlice';
import Prescriptions from '../Prescriptions.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

// 2 ordonnances réelles du Dr Amina Diallo (Cardiologie), toutes deux
// prescrivant Doliprane — donc Doliprane doit apparaître à 100% (2/2) et
// le Dr Amina Diallo doit apparaître avec 2 ordonnances : des chiffres
// impossibles à obtenir par coïncidence avec l'ancien tableau fictif
// (qui citait "Paracétamol"/"Dr. Martin Leblanc", jamais ces noms-ci).
// `medecin` reflète la forme réelle backend (Prescription.medecin est un
// ObjectId ref('User'), peuplé — Prescriptions.jsx::normalizeOrd construit
// "Dr. {prenom} {nom}" à partir de cet objet peuplé, jamais d'une chaîne).
const ORDS_FIXTURE = [
  { _id: 'ord-1', numero_rx: 'RX-1', patient_nom: 'Jane Doe', medecin: { prenom: 'Amina', nom: 'Diallo', specialite: 'Cardiologie' }, statut: 'publiee', lignes: [{ medicament: 'Doliprane' }] },
  { _id: 'ord-2', numero_rx: 'RX-2', patient_nom: 'John Roe', medecin: { prenom: 'Amina', nom: 'Diallo', specialite: 'Cardiologie' }, statut: 'publiee', lignes: [{ medicament: 'Doliprane' }] },
];

function renderPrescriptions() {
  const store = configureStore({ reducer: { prescriptions: prescriptionsReducer } });
  return render(<Provider store={store}><MemoryRouter><Prescriptions /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/prescriptions?')) return Promise.resolve({ data: { prescriptions: ORDS_FIXTURE, total: 2 } });
    return Promise.resolve({ data: {} });
  });
});

test('le dashboard affiche les vrais médicaments/prescripteurs calculés depuis les ordonnances réelles, jamais les valeurs fictives d\'origine', async () => {
  renderPrescriptions();

  expect(await screen.findByText('Doliprane')).toBeInTheDocument();
  // "Dr. Amina Diallo" apparaît aussi dans le tableau "Ordonnances
  // récentes" plus bas sur la même page — findAllByText, pas une
  // ambiguïté du correctif lui-même.
  expect((await screen.findAllByText('Dr. Amina Diallo')).length).toBeGreaterThan(0);
  expect(screen.getByText('Cardiologie')).toBeInTheDocument();

  // Preuve non négociable : aucune des valeurs fictives d'origine.
  expect(screen.queryByText('Paracétamol')).not.toBeInTheDocument();
  expect(screen.queryByText('Dr. Martin Leblanc')).not.toBeInTheDocument();
  expect(screen.queryByText(/^42$/)).not.toBeInTheDocument();
});

test('sans ordonnance réelle, le dashboard affiche un état vide honnête, jamais les valeurs fictives', async () => {
  api.get.mockImplementation((url) => {
    if (url.startsWith('/prescriptions?')) return Promise.resolve({ data: { prescriptions: [], total: 0 } });
    return Promise.resolve({ data: {} });
  });
  renderPrescriptions();

  expect((await screen.findAllByText('Aucune ordonnance enregistrée.')).length).toBeGreaterThan(0);
  expect(screen.queryByText('Paracétamol')).not.toBeInTheDocument();
  expect(screen.queryByText('Dr. Martin Leblanc')).not.toBeInTheDocument();
});
