// POST5-012 (audit indépendant post-Phase 5, 14 sept. 2026) — l'onglet
// Rapports affichait 2 blocs entièrement fabriqués : "Consommation
// mensuelle" (BarChartCanvas alimenté par un tableau littéral codé en dur,
// ["Paracet.","Amoxic.","Artémét.","Métron.","Omépraz."]/[450,320,280,210,180])
// et "Revenus par catégorie" (5 montants fixes par catégorie), jamais issus
// d'une requête réelle — des décisions de gestion de stock pouvaient se
// baser sur ces chiffres fictifs. Ce test prouve que les deux blocs sont
// désormais calculés depuis les vrais mouvements Medication.mouvements
// (mois en cours), et qu'une base sans mouvement affiche un état vide
// honnête plutôt qu'un graphique fabriqué.
//
// Monte le vrai composant Pharmacy.jsx ; seule la frontière réseau
// (`../../api`) et useRealtimeRefresh sont simulées.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Pharmacy from '../Pharmacy.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Pharmacien', role: 'pharmacien' } }),
}));
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

// BarChartCanvas (Chart.js) dessine sur un <canvas> — non inspectable via
// des requêtes DOM sur du texte. Stub minimal de window.Chart (même esprit
// que le stub cloudinary.v2.url déjà utilisé ailleurs pour observer des
// données réelles sans appel réseau réel) : capture uniquement la config
// passée au constructeur, ne fabrique ni ne masque aucun calcul métier.
let lastChartConfig = null;
window.Chart = class {
  constructor(_ctx, config) { lastChartConfig = config; }
  destroy() {}
};

async function renderPharmacyOnRapports() {
  const user = userEvent.setup();
  render(<MemoryRouter><Pharmacy /></MemoryRouter>);
  await screen.findByText('Tableau de bord');
  await user.click(screen.getByRole('button', { name: /Rapports/i }));
}

const debutMois = new Date();
debutMois.setDate(1);
debutMois.setHours(0, 0, 0, 0);
const auj = new Date(debutMois.getTime() + 3 * 3600 * 1000).toISOString();
const moisDernier = new Date(debutMois.getTime() - 5 * 24 * 3600 * 1000).toISOString();

afterEach(() => { vi.clearAllMocks(); });

test('POST5-012 — "Consommation mensuelle" et "Revenus par catégorie" reflètent les vrais mouvements du mois, jamais [450,320,280,210,180] ni les 5 montants fixes codés en dur', async () => {
  api.get.mockImplementation((url) => {
    if (url.startsWith('/pharmacy?')) return Promise.resolve({ data: {
      medications: [
        {
          _id: 'm1', nom_commercial: 'Paracétamol500', categorie: 'Analgésiques', stock_actuel: 100, prix_vente: 500,
          mouvements: [
            { type: 'vente', quantite: 20, montant: 10000, date: auj },
            { type: 'vente', quantite: 5, montant: 2500, date: moisDernier },
          ],
        },
        {
          _id: 'm2', nom_commercial: 'Amoxicilline', categorie: 'Antibiotiques', stock_actuel: 50, prix_vente: 800,
          mouvements: [
            { type: 'dispensation', quantite: 12, date: auj },
            { type: 'vente', quantite: 3, montant: 2400, date: auj },
          ],
        },
      ],
      total: 2,
    } });
    return Promise.resolve({ data: {} });
  });

  await renderPharmacyOnRapports();
  await screen.findByText(/Rapports disponibles/);

  // Preuve positive — "Consommation mensuelle" (canvas Chart.js, inspecté
  // via le stub window.Chart) : labels/data réellement calculés depuis les
  // mouvements du mois (Amoxicilline 12 dispensation + 3 vente = 15,
  // Paracétamol500 20 vente ce mois-ci — la vente du mois dernier, 5, est
  // exclue), jamais le tableau fabriqué.
  expect(lastChartConfig).toBeTruthy();
  expect(lastChartConfig.data.labels).toEqual(['Paracétamol500', 'Amoxicilline']);
  expect(lastChartConfig.data.datasets[0].data).toEqual([20, 15]);
  expect(lastChartConfig.data.labels).not.toEqual(['Paracet.','Amoxic.','Artémét.','Métron.','Omépraz.']);
  expect(lastChartConfig.data.datasets[0].data).not.toEqual([450,320,280,210,180]);

  // Preuve positive — "Revenus par catégorie" (DOM réel, ventes du mois
  // uniquement : la vente 2500 du mois dernier de Paracétamol500 est
  // exclue) : Analgésiques ce mois-ci = 10000, Antibiotiques = 2400.
  await screen.findByText('Analgésiques');
  await screen.findByText('Antibiotiques');
  const montantText = (content) => content.replace(/\s/g, '');
  await screen.findByText((_, el) => montantText(el.textContent) === '10000CFA');
  await screen.findByText((_, el) => montantText(el.textContent) === '2400CFA');

  // Preuve non négociable : plus aucune trace des libellés/valeurs fabriqués.
  expect(screen.queryByText('Paracet.')).not.toBeInTheDocument();
  expect(screen.queryByText('Artémét.')).not.toBeInTheDocument();
  expect(screen.queryByText('Antipaludéens')).not.toBeInTheDocument();
  expect(screen.queryByText('Solutés')).not.toBeInTheDocument();
});

test('POST5-012 — base sans mouvement de consommation ce mois-ci : état vide honnête, jamais un graphique fabriqué', async () => {
  api.get.mockImplementation((url) => {
    if (url.startsWith('/pharmacy?')) return Promise.resolve({ data: {
      medications: [
        { _id: 'm1', nom_commercial: 'StockDormant', categorie: 'Antibiotiques', stock_actuel: 10, prix_vente: 100, mouvements: [] },
      ],
      total: 1,
    } });
    return Promise.resolve({ data: {} });
  });

  await renderPharmacyOnRapports();
  await screen.findByText(/Rapports disponibles/);

  expect(await screen.findByText('Aucun mouvement de consommation enregistré ce mois-ci.')).toBeInTheDocument();
  expect(await screen.findByText('Aucune vente enregistrée ce mois-ci.')).toBeInTheDocument();
  expect(screen.queryByText('450')).not.toBeInTheDocument();
});
