// QA-002 — FE-BUG-004 : Prescriptions.jsx, "Nouvelle date d'expiration" /
// "Note de renouvellement" (modale renouvellement) et "Motif d'annulation"
// (modale annulation) étaient des champs non contrôlés — saisis puis jamais
// transmis (renewOrd()/cancelOrd() postaient sans body utile). Corrigé
// (commit 1870f59) : les 3 champs sont désormais contrôlés et inclus dans
// les payloads réels. Preuve de persistance réelle déjà couverte côté
// backend (auditCorrection2PrescriptionsRenewCancel.test.js) — ce test-ci
// vérifie spécifiquement que le FRONTEND transmet réellement les valeurs
// saisies par l'utilisateur dans les payloads, pas une régression de la
// persistance elle-même.
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Prescriptions from '../Prescriptions.jsx';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));
// ACCES-PHARMACIE-001 — Prescriptions.jsx lit désormais useAuth() pour
// n'afficher l'onglet "Pharmacie" qu'aux rôles y ayant réellement accès ;
// ce test ne porte pas sur les rôles, rôle à accès complet pour préserver
// le comportement déjà couvert ici.
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'superadmin' } }) }));

const ORD_FIXTURE = {
  _id: 'ord-1', numero_rx: 'RX-TEST-001', patient_nom: 'Jane Doe',
  medecin: 'Dr Test', statut: 'publiee', medicaments: [{ medicament: 'Paracétamol' }],
};

function renderPrescriptions() {
  return render(<MemoryRouter><Prescriptions /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/prescriptions?')) return Promise.resolve({ data: { prescriptions: [ORD_FIXTURE], total: 1 } });
    return Promise.resolve({ data: {} });
  });
});

test('la date et la note de renouvellement saisies sont réellement transmises dans le payload', async () => {
  const user = userEvent.setup();
  api.post.mockResolvedValue({ data: {} });

  renderPrescriptions();
  await user.click(await screen.findByRole('button', { name: /Historique/ }));
  await user.click(await screen.findByTitle('Renouveler'));

  const dialog = await screen.findByRole('dialog');
  // Aucun label accessible associé au champ date dans le JSX actuel (même
  // limite d'accessibilité que les <select> d'autres pages de ce projet) —
  // ciblé par son type, unique dans cette modale.
  const dateInput = dialog.querySelector('input[type="date"]');
  await user.type(dateInput, '2027-01-15');
  await user.type(within(dialog).getByPlaceholderText(/Raison du renouvellement/), 'Traitement à poursuivre');
  await user.click(within(dialog).getByRole('button', { name: /Confirmer le renouvellement/ }));

  // Preuve non négociable : la date ET la note réellement saisies par
  // l'utilisateur doivent apparaître dans le payload — c'est exactement ce
  // qui manquait avant le correctif FE-BUG-004 (champs non contrôlés).
  await waitFor(() => expect(api.post).toHaveBeenCalledWith(
    '/prescriptions/ord-1/renouveler',
    { date_expiration: '2027-01-15', note: 'Traitement à poursuivre' },
  ));
});

test('le motif d\'annulation saisi est réellement transmis dans le payload', async () => {
  const user = userEvent.setup();
  api.put.mockResolvedValue({ data: {} });

  renderPrescriptions();
  await user.click(await screen.findByRole('button', { name: /Historique/ }));
  await user.click(await screen.findByTitle("Voir l'ordonnance"));
  await user.click(await screen.findByRole('button', { name: /Validation/ }));
  await user.click(screen.getByRole('button', { name: /Annuler l'ordonnance/ }));

  const dialog = await screen.findByRole('dialog');
  await user.type(within(dialog).getByPlaceholderText(/Erreur de prescription/), 'Contre-indication découverte');
  await user.click(within(dialog).getByRole('button', { name: /Confirmer l'annulation/ }));

  // Preuve non négociable : le motif réellement saisi doit apparaître dans
  // le payload — avant le correctif, cancelOrd() postait sans body utile.
  await waitFor(() => expect(api.put).toHaveBeenCalledWith(
    '/prescriptions/ord-1/cancel',
    { motif: 'Contre-indication découverte' },
  ));
});
