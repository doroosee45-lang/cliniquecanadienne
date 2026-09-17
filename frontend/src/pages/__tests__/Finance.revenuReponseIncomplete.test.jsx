// Vague 4 (audit global des données fictives, 17 sept. 2026) —
// addRevenu() insérait silencieusement un faux revenu local (id
// `Date.now()`, référence re-générée côté client par Math.random()) dans
// la liste affichée si jamais la réponse serveur ne contenait pas
// `data.revenu` — alors même que finance.controller.js::createRevenu
// renvoie toujours ce champ sur un vrai 201 (dérivé de la vraie Invoice
// créée). Un tel repli n'est donc jamais censé se déclencher en usage
// normal, mais s'il se déclenchait (réponse malformée), il affichait un
// succès et une donnée fabriquée à la place d'un vrai échec — même classe
// de défaut déjà corrigée ailleurs dans ce projet (Prescriptions.jsx::
// loadPatients, Correction 7 : repli honnête, jamais une donnée inventée).
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Finance from '../Finance.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') } }));
import toast from 'react-hot-toast';

vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

function renderFinance() {
  return render(<MemoryRouter><Finance /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(() => Promise.resolve({ data: {} }));
});

async function openRevenuModal(user) {
  await user.click(await screen.findByRole('button', { name: 'Revenus' }));
  await user.click(await screen.findByRole('button', { name: /Enregistrer revenu/ }));
}

test('addRevenu — réponse serveur sans `revenu` (201 malformé) : erreur honnête affichée, jamais un faux revenu inséré dans la liste', async () => {
  const user = userEvent.setup();
  api.post.mockResolvedValue({ data: { success: true } }); // pas de champ `revenu` — scénario anormal simulé
  renderFinance();

  await openRevenuModal(user);
  await user.type(screen.getByPlaceholderText('Nom du patient'), 'Patient Test');
  await user.type(screen.getByPlaceholderText('Ex: 25000'), '25000');
  await user.click(screen.getByRole('button', { name: /^Enregistrer$/ }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/incomplète/)));
  expect(toast.success).not.toHaveBeenCalled();
  // La modale reste ouverte (pas de faux succès qui la fermerait) — le champ
  // saisi doit toujours être visible.
  expect(screen.getByPlaceholderText('Nom du patient')).toHaveValue('Patient Test');
});

test('addRevenu — réponse serveur réelle et complète : le vrai revenu renvoyé par le serveur est affiché, succès réel', async () => {
  const user = userEvent.setup();
  api.post.mockResolvedValue({ data: { success: true, revenu: {
    _id: 'inv-real-1', reference: 'FAC-2026-00042', date: '2026-09-17', patient: 'Patient Test', service: 'Consultation', montant: 25000, mode: 'especes', statut: 'paye',
  } } });
  renderFinance();

  await openRevenuModal(user);
  await user.type(screen.getByPlaceholderText('Nom du patient'), 'Patient Test');
  await user.type(screen.getByPlaceholderText('Ex: 25000'), '25000');
  await user.click(screen.getByRole('button', { name: /^Enregistrer$/ }));

  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect(await screen.findByText(/FAC-2026-00042/)).toBeInTheDocument();
});
