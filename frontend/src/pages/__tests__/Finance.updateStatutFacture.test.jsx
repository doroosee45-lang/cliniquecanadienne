// QA-002 — FE-BUG-001 (emplacement 2/5) : Finance.jsx::updateStatutFacture
// avalait silencieusement l'échec réel de PUT /finance/:id (catch vide
// "/* local */"), puis mettait quand même à jour le statut local ET
// affichait un succès. Corrigé : l'état local (et le toast) ne changent
// que si l'appel réussit réellement ; sinon, une vraie erreur est affichée
// et le statut local reste inchangé.
//
// Monte le vrai composant Finance.jsx — updateStatutFacture est un appel
// axios direct (pas un thunk Redux) ; seule la frontière réseau (`../../api`)
// est simulée.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import financeReducer from '../../store/slices/financeSlice';
import Finance from '../Finance.jsx';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') },
}));
import toast from 'react-hot-toast';

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const FACTURE_FIXTURE = {
  _id: 'fact-1', numero: 'FAC-TEST-001', patient: 'Patient Test',
  service: 'Cardiologie', montant: 15000, echeance: '2026-12-31', statut: 'emise',
};

function renderFinance() {
  const store = configureStore({ reducer: { finance: financeReducer } });
  return render(<Provider store={store}><MemoryRouter><Finance /></MemoryRouter></Provider>);
}

async function openFacturationTab(user) {
  await user.click(await screen.findByRole('button', { name: 'Facturation' }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Payer/ })).toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/finance/factures')) return Promise.resolve({ data: { invoices: [FACTURE_FIXTURE] } });
    return Promise.resolve({ data: {} });
  });
});

test('PUT /finance/:id échoue réellement (500) → vraie erreur affichée, le statut local ne change pas', async () => {
  const user = userEvent.setup();
  api.put.mockRejectedValue({ response: { data: { message: 'Erreur serveur réelle' } } });

  renderFinance();
  await openFacturationTab(user);
  await user.click(screen.getByRole('button', { name: /Payer/ }));

  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/finance/fact-1', { statut: 'payee' }));

  // Preuve non négociable : jamais de faux succès sur un échec réel.
  expect(toast.success).not.toHaveBeenCalled();
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  // Le bouton "Payer" doit rester affiché — c'est exactement le bug corrigé
  // (le statut passait à "payé" localement malgré l'échec réel du serveur).
  expect(screen.getByRole('button', { name: /Payer/ })).toBeInTheDocument();
});

test('contrôle négatif — PUT /finance/:id réussit réellement → vrai succès, le bouton "Payer" disparaît', async () => {
  const user = userEvent.setup();
  api.put.mockResolvedValue({ data: { success: true } });

  renderFinance();
  await openFacturationTab(user);
  await user.click(screen.getByRole('button', { name: /Payer/ }));

  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/finance/fact-1', { statut: 'payee' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect(toast.error).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole('button', { name: /Payer/ })).not.toBeInTheDocument());
});
