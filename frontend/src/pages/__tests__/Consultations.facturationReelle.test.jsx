// FACTURATION-CONSULTATION-001 (rapport de clôture du 11 sept. 2026) —
// consultations.controller.js::create génère déjà réellement une Invoice à
// la clôture (FLOW-002, antérieur à cette session) depuis le vrai tarif
// Consultation.frais_consultation, mais rien côté frontend ne permettait de
// la retrouver/l'imprimer/l'envoyer. Ce test prouve que ConsultationDetail
// (fiche d'une consultation déjà enregistrée) appelle réellement
// GET /consultations/:id/facture puis POST .../facture/envoyer — jamais un
// bouton visuellement actif sans vrai appel backend.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import consultationsReducer from '../../store/slices/consultationsSlice';
import Consultations from '../Consultations.jsx';
import api from '../../api';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const printReceiptMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../utils/receipt58mm', () => ({ printReceipt58mm: (...args) => printReceiptMock(...args) }));

const PATIENT_FIXTURE = { _id: 'pat-1', nom: 'Doe', prenom: 'Jane', sexe: 'F', numero_dossier: 'CLIN-2026-00001', email: 'jane.doe@_test.local' };
const CONSULT_FIXTURE = {
  _id: 'cons-1', numero: 'CONS-2026-0001', statut: 'terminee', date_consultation: '2026-09-01T10:00:00.000Z',
  patient: PATIENT_FIXTURE, medecin: { _id: 'med-1', nom: 'Kimbou', prenom: 'Alain' },
  diagnostic: 'RAS', frais_consultation: 7000, statut_paiement: 'paye',
};
const INVOICE_FIXTURE = {
  _id: 'inv-1', numero_facture: 'INV-2026-00042', statut: 'emise', date_facture: '2026-09-01T10:05:00.000Z',
  montant_ht: 7000, montant_ttc: 7000, montant_paye: 0, montant_restant: 7000,
  lignes: [{ libelle: 'Consultation médicale', categorie: 'consultation', prix_unitaire: 7000, quantite: 1, montant: 7000 }],
};

function renderConsultations() {
  const store = configureStore({ reducer: { consultations: consultationsReducer } });
  return render(<Provider store={store}><MemoryRouter><Consultations /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/consultations?'))     return Promise.resolve({ data: { consultations: [CONSULT_FIXTURE], total: 1 } });
    if (url === '/consultations/cons-1/facture') return Promise.resolve({ data: { invoice: INVOICE_FIXTURE } });
    if (url.startsWith('/patients?'))           return Promise.resolve({ data: { patients: [] } });
    if (url === '/settings/services')           return Promise.resolve({ data: { services: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('la fiche détaillée retrouve réellement la facture déjà générée et l\'imprime avec les vraies données', async () => {
  const user = userEvent.setup();
  renderConsultations();

  await user.click(await screen.findByRole('button', { name: /Voir détail/ }));
  const printBtn = await screen.findByRole('button', { name: /Imprimer la facture INV-2026-00042/ });

  await user.click(printBtn);
  await waitFor(() => expect(printReceiptMock).toHaveBeenCalledTimes(1));
  const receiptArg = printReceiptMock.mock.calls[0][0];
  assertReceipt(receiptArg);
});

function assertReceipt(receiptArg) {
  expect(receiptArg.docNumber).toBe('INV-2026-00042');
  expect(receiptArg.lines[0].label).toBe('Consultation médicale');
  expect(receiptArg.totals.find(t => t.label === 'TOTAL TTC').value).toBe(7000);
}

test('"Envoyer au patient" appelle réellement POST /consultations/:id/facture/envoyer', async () => {
  const user = userEvent.setup();
  api.post.mockResolvedValue({ data: { success: true, message: 'Facture envoyée à jane.doe@_test.local.' } });
  renderConsultations();

  await user.click(await screen.findByRole('button', { name: /Voir détail/ }));
  const sendBtn = await screen.findByRole('button', { name: /Envoyer au patient/ });
  expect(sendBtn).not.toBeDisabled();

  await user.click(sendBtn);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/consultations/cons-1/facture/envoyer'));
});

test('aucune facture générée (tarif à 0 à la clôture) → message honnête, jamais un bouton actif sans vraie facture', async () => {
  const user = userEvent.setup();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/consultations?'))     return Promise.resolve({ data: { consultations: [{ ...CONSULT_FIXTURE, frais_consultation: 0 }], total: 1 } });
    if (url === '/consultations/cons-1/facture') return Promise.resolve({ data: { invoice: null } });
    return Promise.resolve({ data: {} });
  });
  renderConsultations();

  await user.click(await screen.findByRole('button', { name: /Voir détail/ }));
  await screen.findByText(/Aucune facture — aucun tarif n'avait été configuré/);
  expect(screen.queryByRole('button', { name: /Imprimer la facture/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Envoyer au patient/ })).not.toBeInTheDocument();
});
