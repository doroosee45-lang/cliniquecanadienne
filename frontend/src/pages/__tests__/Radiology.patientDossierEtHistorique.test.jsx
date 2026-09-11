// Phase 7 (audit du 11 sept. 2026) — dans le panneau "Infos patient" d'un
// examen ouvert, "Voir dossier complet" et "📋 Historique imagerie"
// n'avaient aucun onClick — deux clics sans le moindre effet. currentExamen.
// patient est le même id brut déjà comparé ailleurs sur cette page (ligne
// ~1056, x.patient === currentExamen.patient) : /patients/:id existe déjà
// (App.jsx). Le second bouton cible le panneau "Historique des examens du
// patient", déjà affiché (jamais masqué) juste en dessous.
//
// Monte le vrai composant Radiology.jsx ; seule la frontière réseau
// (`../../api`) et useRealtimeRefresh sont simulées.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';
import { vi } from 'vitest';
import radiologyReducer from '../../store/slices/radiologySlice';
import Radiology from '../Radiology.jsx';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const EXAMEN_LISTE = {
  _id: 'exam-1', numero: 'IMG-TEST-001', patient_nom: 'Jane Doe', patient: 'pat-real-77',
  type_categorie: 'radiographie', type_examen: 'Thorax', statut: 'valide', priorite: 'normale',
};
const EXAMEN_DETAIL = { ...EXAMEN_LISTE };

function LandedOnPatient() {
  const { id } = useParams();
  return <div>Landed on {id}</div>;
}

function renderRadiology() {
  const store = configureStore({ reducer: { radiology: radiologyReducer } });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/radiology']}>
        <Routes>
          <Route path="/radiology" element={<Radiology />} />
          <Route path="/patients/:id" element={<LandedOnPatient />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/radiology/exam-1')) return Promise.resolve({ data: { examen: EXAMEN_DETAIL } });
    if (url.startsWith('/radiology?')) return Promise.resolve({ data: { examens: [EXAMEN_LISTE], total: 1 } });
    return Promise.resolve({ data: {} });
  });
});

async function openExamenInfosTab(user) {
  await user.click(await screen.findByRole('button', { name: /Liste des examens/ }));
  await user.click(await screen.findByRole('button', { name: 'Ouvrir' }));
  await user.click(await screen.findByRole('button', { name: /👤 Patient/ }));
}

test('"Voir dossier complet" ouvre la vraie fiche du patient de l\'examen', async () => {
  const user = userEvent.setup();
  renderRadiology();
  await openExamenInfosTab(user);

  await user.click(await screen.findByRole('button', { name: /Voir dossier complet/ }));
  expect(await screen.findByText('Landed on pat-real-77')).toBeInTheDocument();
});

test('"Historique imagerie" défile réellement vers le panneau déjà affiché', async () => {
  const user = userEvent.setup();
  const scrollSpy = vi.fn();
  Element.prototype.scrollIntoView = scrollSpy;
  renderRadiology();
  await openExamenInfosTab(user);

  await user.click(await screen.findByRole('button', { name: /Historique imagerie/ }));
  expect(scrollSpy).toHaveBeenCalled();
});
