// POST5-014 (audit indépendant post-Phase 5, 14 sept. 2026) — la section
// Fournisseurs (Gestion & Opérations) affichait deux boutons "Modifier"
// et "Voir" sans le moindre handler : aucun clic n'avait le moindre effet
// (UX trompeuse). "Modifier" ouvre désormais la modale existante en mode
// édition (pré-remplie, appelle réellement PUT /admin/suppliers/:id,
// endpoint réel ajouté pour ce correctif — jamais un faux succès local) ;
// "Voir" ouvre une modale de détail en lecture seule à partir des données
// déjà chargées (aucun appel réseau superflu nécessaire).
//
// Monte le vrai composant Administration.jsx ; seule la frontière réseau
// (`../../api`) est simulée.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import administrationReducer from '../../store/slices/administrationSlice';
import Administration from '../Administration.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') } }));
import toast from 'react-hot-toast';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Superadmin', role: 'superadmin' } }),
}));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

const SUPPLIER = {
  _id: 'sup-1', nom: 'MedPharma Congo', contact: 'Jean K.', telephone: '+242060000010',
  email: 'contact@medpharma.cg', adresse: 'Brazzaville', produits: 'Médicaments génériques',
  montant_total: 450000, derniere_commande: '2026-08-01T00:00:00.000Z',
};

function renderAdministration() {
  const store = configureStore({ reducer: { administration: administrationReducer } });
  return render(<Provider store={store}><Administration /></Provider>);
}

async function goToFournisseurs(user) {
  await user.click(await screen.findByRole('button', { name: 'Gestion & Opérations' }));
  await user.click(await screen.findByRole('button', { name: /Fournisseurs/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url === '/admin/suppliers') return Promise.resolve({ data: { suppliers: [SUPPLIER] } });
    return Promise.resolve({ data: {} });
  });
});

test('POST5-014 — "Voir" affiche les vraies données du fournisseur, jamais un clic sans effet', async () => {
  const user = userEvent.setup();
  renderAdministration();
  await goToFournisseurs(user);

  await user.click(screen.getByRole('button', { name: 'Voir' }));

  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Jean K.')).toBeInTheDocument();
  expect(within(dialog).getByText('+242060000010')).toBeInTheDocument();
  expect(within(dialog).getByText('Médicaments génériques')).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalledWith(expect.stringContaining('/admin/suppliers/sup-1'));
});

test('POST5-014 — "Modifier" pré-remplit le vrai formulaire et appelle réellement PUT /admin/suppliers/:id, jamais un second POST', async () => {
  const user = userEvent.setup();
  api.put.mockResolvedValue({ data: { supplier: { ...SUPPLIER, contact: 'Nouveau Contact' } } });
  renderAdministration();
  await goToFournisseurs(user);

  await user.click(await screen.findByRole('button', { name: 'Modifier' }));

  const contactInput = await screen.findByPlaceholderText('Responsable commercial');
  expect(contactInput).toHaveValue('Jean K.');

  await user.clear(contactInput);
  await user.type(contactInput, 'Nouveau Contact');
  await user.click(screen.getByRole('button', { name: /Enregistrer les modifications/ }));

  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/suppliers/sup-1', expect.objectContaining({ contact: 'Nouveau Contact' })));
  expect(api.post).not.toHaveBeenCalledWith('/admin/suppliers', expect.anything());
  expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('modifié'));
});
