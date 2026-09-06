// FE-BUG-013 (Correction 2, audit indépendant du 6 sept. 2026) — le bouton
// "PDF" de la section "Revenus par source médicale" n'était qu'un
// toast.success("📄 Export PDF") sans la moindre génération réelle — le seul
// des 5 boutons signalés qui l'était vraiment (les 4 autres exports Excel/CSV
// utilisaient déjà les vraies données Redux via une variable locale qui
// masque une constante DEMO_* de portée module restée vide/morte — vérifié
// avant correction, voir le rapport de Correction 2).
//
// Monte le vrai composant Analytics.jsx avec le vrai reducer analyticsSlice ;
// seule la frontière réseau (`../../api`) et les dépendances lourdes non
// pertinentes (useAuth, useRealtimeRefresh) sont simulées. jsPDF/autotable
// sont simulés pour capturer leur contenu réel sans générer de vrai binaire
// PDF en environnement de test — mais le contenu passé aux mocks est celui
// réellement produit par exportMedicalPDF à partir des données Redux.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import analyticsReducer from '../../store/slices/analyticsSlice';
import Analytics from '../Analytics.jsx';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') },
}));
import toast from 'react-hot-toast';

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'superadmin' } }) }));

const saveMock = vi.fn();
vi.mock('jspdf', () => {
  function jsPDF() {
    this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 }, getNumberOfPages: () => 1 };
  }
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

const autoTableMock = vi.fn((doc) => { doc.lastAutoTable = { finalY: (doc.lastAutoTable?.finalY || 30) + 20 }; });
vi.mock('jspdf-autotable', () => ({ default: (...args) => autoTableMock(...args) }));

// Données réelles (simulées côté API, mais c'est exactement la forme que
// GET /analytics renvoie réellement — voir analyticsSlice.js::fetchAnalyticsReport)
const REVENUS = { labels: ['Consultation', 'Laboratoire'], data: [500000, 150000], colors: ['#1B4F9E', '#0EA5A0'], trends: [] };
const PATHOLOGIES = [
  { maladie: 'Paludisme', nb: 42, pct: 30, color: '#DC2626' },
  { maladie: 'Grippe', nb: 20, pct: 15, color: '#D97706' },
];

function renderAnalytics() {
  const store = configureStore({ reducer: { analytics: analyticsReducer } });
  return render(<Provider store={store}><MemoryRouter><Analytics /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/analytics/stats')) return Promise.resolve({ data: { kpi: {}, trends: {} } });
    if (url.startsWith('/analytics/financial')) return Promise.resolve({ data: {} });
    if (url.startsWith('/analytics/patients')) return Promise.resolve({ data: {} });
    if (url.startsWith('/analytics')) return Promise.resolve({ data: { charts: { revenus_par_service: REVENUS, top_pathologies: PATHOLOGIES } } });
    if (url.startsWith('/settings/services')) return Promise.resolve({ data: { services: [] } });
    if (url.startsWith('/settings/users')) return Promise.resolve({ data: { users: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('bouton "PDF" (Activité médicale) génère réellement un PDF avec les vraies données Redux, pas un faux succès', async () => {
  const user = userEvent.setup();
  renderAnalytics();

  await user.click(await screen.findByRole('button', { name: /Activité médicale/ }));
  await waitFor(() => expect(screen.getByText('Revenus par source médicale')).toBeInTheDocument());

  const card = screen.getByText('Revenus par source médicale').closest('.anl-card');
  const pdfButton = within(card).getByRole('button', { name: /PDF/ });
  await user.click(pdfButton);

  // Preuve non négociable : un vrai document est construit (autoTable
  // appelé deux fois : revenus + pathologies) et sauvegardé — jamais
  // seulement un toast affiché sans génération.
  await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
  expect(autoTableMock).toHaveBeenCalledTimes(2);

  const revenusCallOpts = autoTableMock.mock.calls[0][1];
  expect(revenusCallOpts.body).toEqual([
    ['Consultation', (500000).toLocaleString('fr-FR')],
    ['Laboratoire', (150000).toLocaleString('fr-FR')],
  ]);

  const pathologiesCallOpts = autoTableMock.mock.calls[1][1];
  expect(pathologiesCallOpts.body).toEqual([
    [1, 'Paludisme', 42, '30%'],
    [2, 'Grippe', 20, '15%'],
  ]);

  // Le nom de fichier confirme qu'il s'agit bien de l'export PDF de cette
  // section (pas une réutilisation accidentelle d'un autre export).
  expect(saveMock).toHaveBeenCalledWith(expect.stringMatching(/^analytics-medical-\d{4}-\d{2}-\d{2}\.pdf$/));
  expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('PDF exporté'));
});
