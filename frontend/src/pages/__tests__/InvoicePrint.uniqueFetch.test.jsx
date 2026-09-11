// INV-001 (audit du 11 sept. 2026) — InvoicePrint.jsx appelait directement
// Promise.all([api.get(`/finance/${id}`), api.get('/settings')]) dans un
// useEffect séparé, EN PLUS de dispatch(fetchInvoiceForPrint(id)) qui
// exécute exactement le même appel via Redux (invoicePrintSlice.js) — deux
// chargements concurrents de la même facture à chaque montage, chacun
// écrivant dans sa propre source de vérité (état local vs Redux). Corrigé :
// Redux est la seule source, le fetch direct dupliqué est supprimé.
//
// Monte le vrai composant InvoicePrint.jsx avec le vrai reducer
// invoicePrintSlice ; seule la frontière réseau (`../../api`) est simulée.
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import invoicePrintReducer from '../../store/slices/invoicePrintSlice';
import InvoicePrint from '../InvoicePrint.jsx';

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

const INVOICE_FIXTURE = {
  _id: 'inv-1', numero_facture: 'FAC-2026-0001', statut: 'emise',
  date_facture: '2026-09-01T00:00:00.000Z', date_echeance: '2026-09-15T00:00:00.000Z',
  patient: { nom: 'Doe', prenom: 'Jane', numero_dossier: 'CLIN-2026-00099' },
  lignes: [{ libelle: 'Consultation', categorie: 'Acte', quantite: 1, prix_unitaire: 15000, montant: 15000 }],
  montant_ht: 15000, montant_ttc: 15000, tva: 0, montant_assurance: 0, montant_paye: 0, montant_restant: 15000,
  paiements: [],
};

function renderInvoicePrint() {
  const store = configureStore({ reducer: { invoicePrint: invoicePrintReducer } });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/finance/print/inv-1']}>
        <Routes><Route path="/finance/print/:id" element={<InvoicePrint />} /></Routes>
      </MemoryRouter>
    </Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url === '/finance/inv-1') return Promise.resolve({ data: { invoice: INVOICE_FIXTURE } });
    if (url === '/settings') return Promise.resolve({ data: { settings: [{ cle: 'nom_clinique', valeur: 'Clinique Test' }] } });
    return Promise.resolve({ data: {} });
  });
});

test('un seul appel réel à /finance/:id et /settings au montage — jamais un double chargement concurrent', async () => {
  renderInvoicePrint();

  await screen.findAllByText('FAC-2026-0001');

  const financeCalls = api.get.mock.calls.filter(([url]) => url === '/finance/inv-1');
  const settingsCalls = api.get.mock.calls.filter(([url]) => url === '/settings');
  expect(financeCalls).toHaveLength(1);
  expect(settingsCalls).toHaveLength(1);
});

test('la facture réellement chargée (Redux) s\'affiche correctement', async () => {
  renderInvoicePrint();

  expect(await screen.findAllByText('FAC-2026-0001')).not.toHaveLength(0);
  expect(screen.getByText('Clinique Test')).toBeInTheDocument();
  expect(screen.getAllByText(/Jane/).length).toBeGreaterThan(0);
});
