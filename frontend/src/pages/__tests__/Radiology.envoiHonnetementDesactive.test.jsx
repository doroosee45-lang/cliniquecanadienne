// FE-BUG-019 (Correction 4, audit indépendant du 6 sept. 2026) — "Envoyer au
// médecin"/"Envoyer au patient" (section Validation, examen déjà validé)
// affichaient un faux succès (toast.success sans appel réseau), alors que
// des boutons jumeaux du même fichier ("Générer"/"Envoyer" des documents,
// plus bas dans la section Documents) étaient déjà honnêtement désactivés
// pour la même raison (aucun mécanisme d'envoi réel n'existe). Corrigé pour
// suivre exactement le même motif : disabled + title explicite + toast
// neutre "en cours de développement", jamais de faux succès.
//
// Monte le vrai composant Radiology.jsx ; seule la frontière réseau
// (`../../api`) et useRealtimeRefresh sont simulées.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Radiology from '../Radiology.jsx';

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  fn.success = vi.fn();
  fn.error = vi.fn();
  return { default: fn };
});
import toast from 'react-hot-toast';

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const EXAMEN_LISTE = {
  _id: 'exam-1', numero: 'IMG-TEST-001', patient_nom: 'Jane Doe',
  type_categorie: 'radiographie', type_examen: 'Thorax', statut: 'valide', priorite: 'normale',
};
const EXAMEN_DETAIL = {
  ...EXAMEN_LISTE,
  statut: 'valide', radiologue: 'Dr. Test', date_validation: '2026-01-15',
};

function renderRadiology() {
  return render(<MemoryRouter><Radiology /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/radiology/exam-1')) return Promise.resolve({ data: { examen: EXAMEN_DETAIL } });
    if (url.startsWith('/radiology?')) return Promise.resolve({ data: { examens: [EXAMEN_LISTE], total: 1 } });
    return Promise.resolve({ data: {} });
  });
});

test('"Envoyer au médecin"/"Envoyer au patient" (examen validé) sont honnêtement désactivés, jamais un faux succès', async () => {
  const user = userEvent.setup();
  renderRadiology();

  await user.click(await screen.findByRole('button', { name: /Liste des examens/ }));
  await user.click(await screen.findByRole('button', { name: 'Ouvrir' }));
  await user.click(await screen.findByRole('button', { name: /Validation/ }));

  const sendMedecinBtn = await screen.findByRole('button', { name: /Envoyer au médecin/ });
  const sendPatientBtn = await screen.findByRole('button', { name: /Envoyer au patient/ });

  expect(sendMedecinBtn).toBeDisabled();
  expect(sendPatientBtn).toBeDisabled();
  expect(sendMedecinBtn).toHaveAttribute('title', expect.stringContaining('aucun envoi réel'));
  expect(sendPatientBtn).toHaveAttribute('title', expect.stringContaining('aucun envoi réel'));

  // Preuve non négociable : même désactivé, on ne doit jamais afficher un
  // faux succès si le clic se produit malgré tout (bouton disabled côté
  // navigateur, mais on vérifie ici l'absence de tout appel réseau ET
  // l'absence de toast.success trompeur).
  await user.click(sendMedecinBtn, { skipPointerEventsCheck: true }).catch(() => {});
  expect(toast.success).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});
