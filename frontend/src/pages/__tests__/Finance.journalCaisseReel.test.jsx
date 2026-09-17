// Vague 4 (audit global des données fictives, 17 sept. 2026) — l'onglet
// Caisse affichait un "Journal de caisse du jour" entièrement codé en dur :
// 4 lignes avec des noms de patients et numéros de facture inventés
// ("Consultation Jean Dupont — FAC-2026-0041", "Labo Marie Paul —
// FAC-2026-0040"), et un solde qui ne correspondait même pas
// arithmétiquement à ses propres lignes fabriquées. Prouve que le journal
// affiche désormais les vrais paiements/dépenses du jour (déjà chargés
// réellement pour les onglets Paiements/Dépenses), que les anciens noms
// fabriqués n'apparaissent plus jamais, et qu'une journée sans mouvement
// réel affiche un état honnête plutôt qu'une ligne de remplissage.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Finance from '../Finance.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';

function renderFinance() {
  return render(<MemoryRouter><Finance /></MemoryRouter>);
}

const todayIso = () => new Date().toISOString();

function mockApi({ paiements = [], depenses = [], solde_caisse = 0 }) {
  api.get.mockImplementation((url) => {
    if (url.startsWith('/finance/kpis')) return Promise.resolve({ data: { success: true, solde_caisse, stats: {} } });
    if (url.startsWith('/finance/paiements')) return Promise.resolve({ data: { paiements } });
    if (url.startsWith('/finance/depenses')) return Promise.resolve({ data: { depenses } });
    return Promise.resolve({ data: {} });
  });
}

beforeEach(() => { vi.clearAllMocks(); });

test('Caisse — le journal affiche les vrais paiements/dépenses du jour, jamais les anciens noms fabriqués', async () => {
  const user = userEvent.setup();
  mockApi({
    paiements: [{ _id: 'p1', date: todayIso(), heure: '09:15', patient: 'Antoine Nkoghe', facture: 'FAC-REEL-0001', montant: 12000, mode: 'especes' }],
    depenses: [{ _id: 'd1', date: todayIso(), description: 'Achat gants latex', categorie: 'Fournitures médicales', montant: 4000, statut: 'paye' }],
    solde_caisse: 8000,
  });
  renderFinance();

  await user.click(await screen.findByRole('button', { name: 'Caisse' }));

  expect(await screen.findByText(/Antoine Nkoghe/)).toBeInTheDocument();
  expect(screen.getByText(/FAC-REEL-0001/)).toBeInTheDocument();
  expect(screen.getByText(/Achat gants latex/)).toBeInTheDocument();

  // Carte "Solde de caisse actuel" — mêmes vrais totaux du jour que le
  // journal (12000 encaissé, 4000 décaissé), jamais les anciens chiffres
  // fabriqués (450000/120000/85000, identiques quelle que soit la donnée réelle).
  const norm = (s) => s.replace(/[^\d]/g, '');
  const caisseItems = document.querySelectorAll('.caisse-item');
  expect([...caisseItems].some(el => norm(el.textContent) === '12000')).toBe(true);
  expect([...caisseItems].some(el => norm(el.textContent) === '4000')).toBe(true);
  expect([...caisseItems].some(el => norm(el.textContent) === '450000')).toBe(false);

  // Les anciennes lignes/chiffres fabriqués ne doivent plus jamais apparaître.
  expect(screen.queryByText(/Jean Dupont/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Marie Paul/)).not.toBeInTheDocument();
  expect(screen.queryByText(/FAC-2026-0041/)).not.toBeInTheDocument();
  expect(screen.queryByText(/FAC-2026-0040/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Solde d'ouverture/)).not.toBeInTheDocument();
});

test('Caisse — aucun mouvement réel aujourd\'hui : état honnête affiché, jamais une ligne de remplissage', async () => {
  const user = userEvent.setup();
  mockApi({ paiements: [], depenses: [], solde_caisse: 0 });
  renderFinance();

  await user.click(await screen.findByRole('button', { name: 'Caisse' }));

  expect(await screen.findByText(/Aucun mouvement de caisse enregistré aujourd'hui/)).toBeInTheDocument();
  expect(screen.queryByText(/Jean Dupont/)).not.toBeInTheDocument();
});
