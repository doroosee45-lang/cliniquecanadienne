// QA-002 — FE-BUG-003 : Consultations.jsx, le <select> "Mode de paiement"
// n'avait ni value ni onChange — la sélection de l'utilisateur n'était
// jamais lue, et le payload de création ne l'incluait pas (le champ
// mode_paiement n'existait même pas dans le schéma Consultation). Corrigé
// (commit 4546bc2) : select contrôlé, champ inclus dans le payload envoyé.
// Preuve de persistance réelle déjà couverte côté backend
// (auditCorrection1ModePaiementConsultation.test.js) — ce test-ci vérifie
// spécifiquement que le FRONTEND transmet réellement la valeur choisie par
// l'utilisateur dans le payload, pas une régression de la persistance
// elle-même.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import consultationsReducer from '../../store/slices/consultationsSlice';
import Consultations from '../Consultations.jsx';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const PATIENT_FIXTURE = { _id: 'pat-1', nom: 'Doe', prenom: 'Jane', sexe: 'F', numero_dossier: 'CLIN-2026-00001' };

function renderConsultations() {
  const store = configureStore({ reducer: { consultations: consultationsReducer } });
  return render(<Provider store={store}><MemoryRouter><Consultations /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/consultations?'))  return Promise.resolve({ data: { consultations: [], total: 0 } });
    if (url.startsWith('/patients?'))       return Promise.resolve({ data: { patients: [PATIENT_FIXTURE] } });
    if (url === '/settings/services')       return Promise.resolve({ data: { services: [{ _id: 's1', nom: 'Médecine Générale', statut: 'actif' }] } });
    return Promise.resolve({ data: {} });
  });
  api.post.mockResolvedValue({ data: { consultation: { _id: 'c1' } } });
});

test('le mode de paiement sélectionné par l\'utilisateur est réellement transmis dans le payload de création', async () => {
  const user = userEvent.setup();
  renderConsultations();

  // Deux boutons "Nouvelle consultation" coexistent (Hero + état vide de la
  // liste) — le premier suffit, peu importe lequel est cliqué.
  const [newConsultBtn] = await screen.findAllByRole('button', { name: /Nouvelle consultation/ });
  await user.click(newConsultBtn);
  await user.click(await screen.findByRole('button', { name: /Sélectionner un patient/ }));
  await user.click(await screen.findByRole('button', { name: /Sélectionner →/ }));

  // Service obligatoire côté client (handleSave) avant de pouvoir enregistrer
  // — vit dans la section "Consultation", pas "Patient".
  // Note : le nom accessible de ces onglets concatène icône+libellé sans
  // espace ("📋Consultation") — requête en regex plutôt qu'en chaîne exacte.
  await user.click(screen.getByRole('button', { name: /Consultation$/ }));
  const serviceSelect = await screen.findByDisplayValue('Sélectionner un service…');
  await user.selectOptions(serviceSelect, 'Médecine Générale');

  await user.click(screen.getByRole('button', { name: /Facturation/ }));
  // Requête scopée sur la valeur actuellement affichée du <select> mode de
  // paiement (aucun label accessible associé dans le JSX actuel — même
  // limite d'accessibilité que les autres <select> de cette page).
  const modePaiementSelect = screen.getByDisplayValue('💵 Espèces');
  await user.selectOptions(modePaiementSelect, 'mobile');

  await user.click(screen.getByRole('button', { name: /Finaliser la consultation/ }));

  // Preuve non négociable : la valeur choisie par l'utilisateur ("mobile"),
  // pas la valeur par défaut, doit réellement apparaître dans le payload
  // envoyé — c'est exactement ce qui manquait avant le correctif FE-BUG-003.
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/consultations', expect.objectContaining({ mode_paiement: 'mobile' })));
});
