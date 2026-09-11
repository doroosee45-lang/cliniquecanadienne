// ARCH-005 (audit du 11 sept. 2026) — chaque résultat de la recherche
// patient du Header est un vrai patient (GET /patients/search renvoie de
// vrais documents avec un vrai _id), mais le clic sur un résultat
// naviguait toujours vers la liste générale /patients, jamais vers la
// fiche réelle du patient cliqué (/patients/:id, route déjà réelle —
// App.jsx, PatientDetail.jsx) : impossible d'ouvrir directement le bon
// dossier depuis une recherche qui l'a pourtant déjà trouvé.
//
// Monte le vrai composant Header.jsx ; seule la frontière réseau
// (`../../../api`) et les contextes Auth/Socket sont simulés. Une route
// factice /patients/:id capture le paramètre réellement reçu par la
// navigation pour prouver qu'il s'agit du bon patient, pas juste que
// l'URL "ressemble" à la bonne.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';
import { vi } from 'vitest';
import Header from '../Header.jsx';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { prenom: 'Test', nom: 'Medecin', role: 'medecin' } }),
}));
vi.mock('../../../contexts/SocketContext', () => ({
  useSocket: () => ({ socket: null, connected: false }),
}));
vi.mock('../../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

vi.mock('../../../api', () => ({
  default: { get: vi.fn(), put: vi.fn() },
}));
import api from '../../../api';

const PATIENT_FIXTURE = { _id: 'pat-real-42', nom: 'Doe', prenom: 'Jane', numero_dossier: 'CLIN-2026-00099', telephone: '074000000' };

function LandedOnPatient() {
  const { id } = useParams();
  return <div>Landed on {id}</div>;
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Header title="Tableau de bord" onMenuToggle={() => {}} />} />
        <Route path="/patients" element={<div>Liste générale des patients</div>} />
        <Route path="/patients/:id" element={<LandedOnPatient />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/patients/search')) return Promise.resolve({ data: { patients: [PATIENT_FIXTURE] } });
    if (url.startsWith('/notifications')) return Promise.resolve({ data: { notifications: [], unread: 0 } });
    return Promise.resolve({ data: {} });
  });
});

test('cliquer un résultat de recherche ouvre la vraie fiche du patient trouvé, pas la liste générale', async () => {
  const user = userEvent.setup();
  renderApp();

  const input = await screen.findByLabelText('Rechercher un patient');
  await user.type(input, 'Doe');

  const result = await screen.findByText('Doe Jane');
  await user.click(result);

  expect(await screen.findByText('Landed on pat-real-42')).toBeInTheDocument();
  expect(screen.queryByText('Liste générale des patients')).not.toBeInTheDocument();
});
