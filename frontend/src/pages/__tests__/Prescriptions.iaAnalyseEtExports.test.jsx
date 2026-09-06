// FE-BUG-018 (Correction 3, audit indépendant du 6 sept. 2026) —
// Prescriptions.jsx avait 4 boutons factices :
//  - "Analyser" (interactions IA) : toast.success() sans aucun appel réseau.
//    Corrigé : réutilise le vrai sous-module IA déjà existant
//    (POST /ai/interactions, voir ai.controller.js::checkInteractions).
//  - "PDF"/"Excel"/"CSV" (Rapport détaillé) : toast.success() sans aucune
//    génération. Corrigé : mêmes vraies données que les cartes déjà
//    affichées (kpis, alimenté par GET /prescriptions/stats), même motif
//    jsPDF/xlsx déjà établi (Analytics.jsx, Maternite.jsx/Pediatrie.jsx).
//
// Monte le vrai composant Prescriptions.jsx avec le vrai reducer
// prescriptionsSlice ; seule la frontière réseau (`../../api`) et les
// dépendances lourdes non pertinentes (useRealtimeRefresh) sont simulées.
// jsPDF/autotable/xlsx sont simulés pour capturer leur contenu réel.
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import prescriptionsReducer from '../../store/slices/prescriptionsSlice';
import Prescriptions from '../Prescriptions.jsx';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
import toast from 'react-hot-toast';

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const saveMock = vi.fn();
vi.mock('jspdf', () => {
  function jsPDF() { this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 }, getNumberOfPages: () => 1 }; }
  jsPDF.prototype.setFillColor = function () { return this; };
  jsPDF.prototype.rect = function () { return this; };
  jsPDF.prototype.setTextColor = function () { return this; };
  jsPDF.prototype.setFontSize = function () { return this; };
  jsPDF.prototype.setFont = function () { return this; };
  jsPDF.prototype.text = function () { return this; };
  jsPDF.prototype.setPage = function () { return this; };
  jsPDF.prototype.save = function (filename) { saveMock(filename); };
  return { default: jsPDF };
});
const autoTableMock = vi.fn();
vi.mock('jspdf-autotable', () => ({ default: (...args) => autoTableMock(...args) }));

const xlsxWriteFileMock = vi.fn();
const xlsxSheetsMock = [];
vi.mock('xlsx', () => ({
  utils: {
    book_new: () => ({}),
    aoa_to_sheet: (rows) => rows,
    book_append_sheet: (wb, sheet, name) => xlsxSheetsMock.push({ name, sheet }),
  },
  writeFile: (wb, filename) => xlsxWriteFileMock(filename),
}));

const ORD_FIXTURE = {
  _id: 'ord-1', numero_rx: 'RX-TEST-001', patient_nom: 'Jane Doe', medecin: 'Dr Test',
  diagnostic: 'Grippe', statut: 'active', date_prescription: '2026-01-01', date_expiration: '2026-06-01',
  lignes: [{ id: 1, medicament: 'Paracétamol' }, { id: 2, medicament: 'Ibuprofène' }],
};

const STATS_FIXTURE = { mois: 12, chroniques: 3, interactions: 2, dispensees: 9, renouvellements_effectues: 4, annulees: 1 };

function renderPrescriptions() {
  const store = configureStore({ reducer: { prescriptions: prescriptionsReducer } });
  return render(<Provider store={store}><MemoryRouter><Prescriptions /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  xlsxSheetsMock.length = 0;
  api.get.mockImplementation((url) => {
    if (url.startsWith('/prescriptions?')) return Promise.resolve({ data: { prescriptions: [ORD_FIXTURE], total: 1 } });
    if (url.startsWith('/prescriptions/stats')) return Promise.resolve({ data: { stats: STATS_FIXTURE } });
    return Promise.resolve({ data: {} });
  });
  // jsdom n'implémente pas nativement URL.createObjectURL/revokeObjectURL.
  global.URL.createObjectURL = vi.fn(() => 'blob:mock');
  global.URL.revokeObjectURL = vi.fn();
});

test('"Analyser" appelle réellement POST /ai/interactions (réutilise le vrai sous-module IA) et affiche le résultat réel', async () => {
  const user = userEvent.setup();
  api.post.mockResolvedValue({ data: { success: true, warnings: [{ medicaments: ['paracétamol'], risque: 'elevé', description: 'Interaction réelle détectée' }], total_verifiees: 2, interactions_detectees: 1 } });

  renderPrescriptions();
  await user.click(await screen.findByRole('button', { name: '👁 Voir' }));
  await user.click(await screen.findByRole('button', { name: /Prescription/ }));

  const analyserBtn = await screen.findByRole('button', { name: /Analyser/ });
  await user.click(analyserBtn);

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ai/interactions', { medications: ['Paracétamol', 'Ibuprofène'], patientId: undefined }));
  await waitFor(() => expect(screen.getByText(/Interaction détectée : Interaction réelle détectée/)).toBeInTheDocument());
  expect(toast.error).toHaveBeenCalled();
});

test('exports PDF/Excel/CSV du "Rapport détaillé" génèrent réellement un fichier avec les vraies données kpis', async () => {
  const user = userEvent.setup();
  renderPrescriptions();

  await user.click(await screen.findByRole('button', { name: /Rapports/ }));
  const card = await screen.findByText(/Rapport détaillé/);
  const cardEl = card.closest('.ord-card');

  await user.click(within(cardEl).getByRole('button', { name: /PDF/ }));
  await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
  expect(autoTableMock).toHaveBeenCalledTimes(1);
  expect(autoTableMock.mock.calls[0][1].body).toEqual([
    ['Total prescriptions ce mois', 12],
    ['Ordonnances chroniques', 3],
    ['Interactions détectées par IA', 2],
    ['Ordonnances délivrées', 9],
    ['Renouvellements effectués', 4],
    ['Ordonnances annulées', 1],
  ]);

  await user.click(within(cardEl).getByRole('button', { name: /Excel/ }));
  await waitFor(() => expect(xlsxWriteFileMock).toHaveBeenCalledTimes(1));
  expect(xlsxSheetsMock[0].sheet).toEqual([
    ['Indicateur', 'Valeur'],
    ['Total prescriptions ce mois', 12],
    ['Ordonnances chroniques', 3],
    ['Interactions détectées par IA', 2],
    ['Ordonnances délivrées', 9],
    ['Renouvellements effectués', 4],
    ['Ordonnances annulées', 1],
  ]);

  await user.click(within(cardEl).getByRole('button', { name: /CSV/ }));
  await waitFor(() => expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1));
  const blob = global.URL.createObjectURL.mock.calls[0][0];
  const text = await blob.text();
  expect(text).toContain('Total prescriptions ce mois,12');
  expect(text).toContain('Ordonnances annulées,1');

  expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('PDF exporté'));
  expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Excel exporté'));
  expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('CSV exporté'));
});
