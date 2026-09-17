// POST5-014 (audit indépendant post-Phase 5, 14 sept. 2026) — l'onglet
// Audit affichait 6 boutons de filtre ("Tous"/"Entrées"/"Sorties"/
// "Dispensations"/"Ventes"/"Ajustements") sans le moindre onClick : "Tous"
// restait toujours visuellement actif, aucun clic n'avait le moindre
// effet sur le tableau affiché (UX trompeuse). Filtre désormais réellement
// le tableau (déjà réel, mouvements Medication.mouvements) selon le type
// cliqué.
//
// Monte le vrai composant Pharmacy.jsx ; seule la frontière réseau
// (`../../api`) et useRealtimeRefresh sont simulées.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Pharmacy from '../Pharmacy.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Pharmacien', role: 'pharmacien' } }),
}));
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';

async function renderPharmacyOnAudit() {
  const user = userEvent.setup();
  render(<MemoryRouter><Pharmacy /></MemoryRouter>);
  await screen.findByText('Tableau de bord');
  await user.click(screen.getByRole('button', { name: /Audit/i }));
  return user;
}

// "Ventes"/"Tous" sont ambigus avec d'autres boutons de la page (onglet
// principal "Ventes", etc.) — cible spécifiquement les puces de filtre de
// l'onglet Audit via leur classe pbtn-sm.
const filterBtn = (label) => screen.getAllByRole('button', { name: label }).find(b => b.className.includes('pbtn-sm'));

afterEach(() => { vi.clearAllMocks(); });

test('POST5-014 — les boutons de filtre Audit filtrent réellement le tableau, jamais un clic sans effet', async () => {
  api.get.mockImplementation((url) => {
    if (url.startsWith('/pharmacy?')) return Promise.resolve({ data: {
      medications: [
        { _id: 'm1', nom_commercial: 'MedVente', stock_actuel: 10, mouvements: [{ type: 'vente', quantite: 2, montant: 1000, date: new Date().toISOString() }] },
        { _id: 'm2', nom_commercial: 'MedEntree', stock_actuel: 10, mouvements: [{ type: 'entree', quantite: 5, date: new Date().toISOString() }] },
      ],
      total: 2,
    } });
    return Promise.resolve({ data: {} });
  });

  const user = await renderPharmacyOnAudit();
  const table = await screen.findByRole('table');

  // "Tous" (état initial) : les deux mouvements apparaissent.
  expect(within(table).getByText('MedVente')).toBeInTheDocument();
  expect(within(table).getByText('MedEntree')).toBeInTheDocument();

  await user.click(filterBtn('Ventes'));
  expect(within(table).getByText('MedVente')).toBeInTheDocument();
  expect(within(table).queryByText('MedEntree')).not.toBeInTheDocument();

  await user.click(filterBtn('Entrées'));
  expect(within(table).queryByText('MedVente')).not.toBeInTheDocument();
  expect(within(table).getByText('MedEntree')).toBeInTheDocument();

  await user.click(filterBtn('Tous'));
  expect(within(table).getByText('MedVente')).toBeInTheDocument();
  expect(within(table).getByText('MedEntree')).toBeInTheDocument();
});
