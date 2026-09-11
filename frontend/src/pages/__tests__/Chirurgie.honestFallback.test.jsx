// Phase 7 (audit du 11 sept. 2026) — Chirurgie.jsx fabriquait des données
// sur échec réel du serveur, présentées comme réelles :
// 1. loadStats() : un échec réel de GET /chirurgie/stats fixait
//    "Taux complications" à 8.3% codé en dur, jamais une vraie mesure.
// 2. loadDossier() : un échec réel de GET /chirurgie/:id remplissait le
//    bilan biologique/imagerie et les relevés postopératoires d'un dossier
//    avec des valeurs médicales entièrement inventées (Hb, glycémie,
//    température, tension...), sans aucune indication d'échec — un(e)
//    clinicien(ne) aurait vu des données cliniques plausibles mais fausses.
// Corrigé : sur échec réel, état vide honnête + erreur signalée, jamais de
// donnée médicale ou statistique fabriquée.
//
// Monte le vrai composant Chirurgie.jsx ; seule la frontière réseau
// (`../../api`) et useRealtimeRefresh sont simulées.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import chirurgieReducer from '../../store/slices/chirurgieSlice';
import Chirurgie from '../Chirurgie.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const DOSSIER_FIXTURE = {
  _id: 'chir-1', patient_nom: 'Doe Jane', diagnostic_chirurgical: 'Hernie', statut: 'preoperatoire',
  chirurgien_nom: 'Dr Test', ia_risque_niveau: 'faible', ia_risque_score: 20,
};

function renderChirurgie() {
  const store = configureStore({ reducer: { chirurgie: chirurgieReducer } });
  return render(<Provider store={store}><MemoryRouter><Chirurgie /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/chirurgie/stats')) return Promise.reject(new Error('Erreur serveur réelle'));
    if (url.startsWith('/chirurgie/') && url !== '/chirurgie/stats') return Promise.reject(new Error('Erreur serveur réelle'));
    if (url.startsWith('/chirurgie?')) return Promise.resolve({ data: { dossiers: [DOSSIER_FIXTURE], total: 1 } });
    if (url.startsWith('/patients?')) return Promise.resolve({ data: { patients: [] } });
    if (url.startsWith('/admin/users?')) return Promise.resolve({ data: { users: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('un échec réel de /chirurgie/stats affiche 0%, jamais le taux fabriqué 8.3%', async () => {
  renderChirurgie();
  await screen.findByText('Taux complications');
  expect(screen.getByText('0%')).toBeInTheDocument();
  expect(screen.queryByText('8.3%')).not.toBeInTheDocument();
});

test('un échec réel de /chirurgie/:id affiche un bilan vide, jamais des valeurs médicales inventées', async () => {
  const user = userEvent.setup();
  renderChirurgie();

  await user.click(await screen.findByRole('button', { name: /Dossiers chirurgicaux/ }));
  await user.click(await screen.findByRole('button', { name: /Ouvrir/ }));

  // La section dossier doit bien s'afficher (openDossier() a déjà
  // positionné currentDossier avec le vrai objet de la liste avant
  // l'échec du chargement détaillé) — sans quoi les assertions ci-dessous
  // seraient trivialement vraies même sans le correctif. "Doe Jane"
  // apparaît aussi dans la ligne de la liste, d'où findAllByText.
  await screen.findByText('🤖 Score IA Risque');

  // Preuve non négociable : aucune des valeurs fabriquées (biologie,
  // imagerie, relevés postopératoires) ne doit jamais apparaître.
  expect(screen.queryByText(/12\.5 g\/dL/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Hernie inguinale droite confirmée/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Amoxicilline/)).not.toBeInTheDocument();
  expect(screen.queryByText(/bonne_evolution|transit rétabli/)).not.toBeInTheDocument();
});
