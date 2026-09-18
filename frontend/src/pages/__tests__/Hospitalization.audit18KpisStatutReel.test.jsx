// AUDIT-18-2 (audit manuel complet du module, 18 sept. 2026) — computeKpis
// utilisait des valeurs (attente/hospitalise/observation) qui n'existent
// jamais réellement dans Hospitalization.statut (enum réel : en_cours/
// sorti/transfere/decede) : un séjour réel (statut:'en_cours') n'était
// jamais compté, le KPI "En cours" (anciennement "Hospitalisés" +
// "En observation") restait figé à 0 quelle que soit la réalité des
// données. Prouve que le KPI reflète désormais un vrai séjour en_cours.
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import hospitalizationReducer from '../../store/slices/hospitalizationSlice';
import Hospitalization from '../Hospitalization.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') }) }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const HOSP_FIXTURE = [
  { _id: 'h1', numero: 'HOSP-0001', statut: 'en_cours', patient: { prenom: 'Antoine', nom: 'Nkoghe', numero_dossier: 'DOS-1' }, date_entree: new Date().toISOString(), motif_entree: 'Test' },
  { _id: 'h2', numero: 'HOSP-0002', statut: 'sorti', patient: { prenom: 'Marie', nom: 'Test', numero_dossier: 'DOS-2' }, date_entree: new Date().toISOString(), date_sortie: new Date().toISOString(), motif_entree: 'Test' },
];

function renderHospitalization() {
  const store = configureStore({ reducer: { hospitalization: hospitalizationReducer } });
  return render(<Provider store={store}><MemoryRouter><Hospitalization /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/hospitalization?')) return Promise.resolve({ data: { hospitalizations: HOSP_FIXTURE, total: HOSP_FIXTURE.length } });
    if (url === '/hospitalization/stats') return Promise.resolve({ data: { stats: {} } });
    if (url.startsWith('/patients?')) return Promise.resolve({ data: { patients: [] } });
    if (url === '/hospitalization/rooms') return Promise.resolve({ data: { rooms: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('AUDIT-18-2 — le KPI "En cours" reflète réellement un séjour statut:"en_cours", jamais figé à 0', async () => {
  renderHospitalization();
  await screen.findByText('Tableau de bord');

  // Le vrai patient en_cours doit apparaître dans le tableau "Patients
  // actuellement hospitalisés" (dérivé du même vrai statut).
  await screen.findByText('Antoine Nkoghe');

  // "En cours" apparaît deux fois à l'écran une fois les données réelles
  // chargées : le libellé du KPI (.kpi-lbl-ho) ET le badge de statut de la
  // ligne du tableau (.hbdg) — c'est justement la preuve que STATUT_HOSP
  // reconnaît désormais réellement "en_cours" au lieu d'afficher le texte
  // brut. On cible explicitement le KPI pour vérifier son compte.
  const enCoursOccurrences = await screen.findAllByText('En cours');
  const kpiLabel = enCoursOccurrences.find(el => el.className === 'kpi-lbl-ho');
  expect(kpiLabel, 'le KPI "En cours" doit exister (STATUT_HOSP/computeKpis doivent utiliser les vraies valeurs d\'enum)').toBeTruthy();
  const kpiCard = kpiLabel.closest('.ho-kpi');
  expect(kpiCard.textContent).toContain('1');

  // Le badge de statut doit être un vrai badge reconnu ("En cours"), jamais
  // le texte brut de l'enum faute d'entrée dans STATUT_HOSP.
  const badge = enCoursOccurrences.find(el => el.className.includes('hbdg'));
  expect(badge, 'le badge de statut doit afficher le libellé humain "En cours", pas rester non reconnu').toBeTruthy();
  expect(screen.queryByText('en_cours')).not.toBeInTheDocument();
});

test('AUDIT-18-2 — non-régression : le KPI "Sortis" reste réellement calculé', async () => {
  renderHospitalization();
  await screen.findByText('Tableau de bord');
  const sortisOccurrences = await screen.findAllByText('Sortis');
  const kpiLabel = sortisOccurrences.find(el => el.className === 'kpi-lbl-ho');
  expect(kpiLabel).toBeTruthy();
  const kpiCard = kpiLabel.closest('.ho-kpi');
  expect(kpiCard.textContent).toContain('1');
});
