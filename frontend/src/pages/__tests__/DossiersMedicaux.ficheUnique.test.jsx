// FICHE-UNIQUE-001 (13 sept. 2026) — la liste affichait auparavant une ligne
// par événement médical (une même patiente pouvait apparaître 3-4 fois :
// une ligne "Laboratoire", une ligne "Consultation"...). Ce test monte le
// vrai composant + le vrai reducer Redux (dossiersMedicauxSlice, pas
// mocké) ; seule la frontière réseau (`../../api`) est simulée, avec 3
// événements réels appartenant à la MÊME patiente, de types différents.
// Preuve non négociable : la liste principale ne montre plus qu'UNE seule
// ligne pour cette patiente, et "Ouvrir" affiche ses 3 événements
// regroupés en sections par type dans une fiche unique.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import DossiersMedicaux from '../DossiersMedicaux.jsx';
import dossiersMedicauxReducer from '../../store/slices/dossiersMedicauxSlice';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const SAME_PATIENT_ID = 'patient-1';
const RECORDS = [
  { patientId: SAME_PATIENT_ID, patientNom: 'Nguema Marie', type: 'laboratoire', recordId: 'lab-1', date: '2026-09-10', resume: 'NFS complète', praticien: 'Dr Obiang', statut: 'termine', tabTarget: 'labo', moduleRoute: '/laboratory' },
  { patientId: SAME_PATIENT_ID, patientNom: 'Nguema Marie', type: 'consultation', recordId: 'consult-1', date: '2026-09-05', resume: 'Suivi tension', praticien: 'Dr Obiang', statut: 'terminee', tabTarget: 'consult', moduleRoute: '/consultations' },
  { patientId: SAME_PATIENT_ID, patientNom: 'Nguema Marie', type: 'ordonnance', recordId: 'ord-1', date: '2026-09-01', resume: 'Paracétamol', praticien: 'Dr Obiang', statut: 'active', tabTarget: 'ordos', moduleRoute: '/prescriptions' },
  { patientId: 'patient-2', patientNom: 'Mboumba Jean', type: 'hospitalisation', recordId: 'hosp-1', date: '2026-08-20', resume: 'Observation', praticien: 'Dr Obiang', statut: 'sorti', tabTarget: 'hospi', moduleRoute: '/hospitalization' },
];

vi.mock('../../api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url.startsWith('/medical-records/search')) {
        return Promise.resolve({ data: { results: RECORDS, total: RECORDS.length, page: 1, limit: 200, sourcesTruncated: [] } });
      }
      if (url.startsWith('/admin/users')) return Promise.resolve({ data: { users: [] } });
      return Promise.resolve({ data: {} });
    }),
  },
}));

function renderPage() {
  const store = configureStore({ reducer: { dossiersMedicaux: dossiersMedicauxReducer } });
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <DossiersMedicaux />
      </MemoryRouter>
    </Provider>
  );
}

test('un patient avec plusieurs événements de types différents n\'apparaît qu\'une seule fois dans la liste', async () => {
  renderPage();
  await screen.findByText('2 patients trouvés');
  const rows = await screen.findAllByText('Nguema Marie');
  expect(rows).toHaveLength(1);
  await screen.findByText('Mboumba Jean');
});

test('"Ouvrir" affiche une fiche unique avec les 3 événements regroupés en sections par type', async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByText('Nguema Marie');

  const row = screen.getByText('Nguema Marie').closest('tr');
  await user.click(within(row).getByRole('button', { name: /Ouvrir/ }));

  const dialog = await screen.findByRole('dialog');
  await within(dialog).findByText('3 événements au dossier');
  // Les 3 types réels doivent apparaître comme des SECTIONS de la fiche,
  // jamais comme des lignes indépendantes du tableau principal.
  await within(dialog).findByText('NFS complète');
  await within(dialog).findByText('Suivi tension');
  await within(dialog).findByText('Paracétamol');
  // Le patient d'un autre regroupement ne doit jamais apparaître ici.
  expect(within(dialog).queryByText('Observation')).not.toBeInTheDocument();
});

test('quand sourcesTruncated signale ce type pour ce patient, la fiche recharge l\'historique complet ciblé (jamais une troncature silencieuse)', async () => {
  const api = (await import('../../api')).default;
  const REFRESHED_LAB_1 = { patientId: SAME_PATIENT_ID, patientNom: 'Nguema Marie', type: 'laboratoire', recordId: 'lab-1', date: '2026-09-10', resume: 'NFS complète', praticien: 'Dr Obiang', statut: 'termine', tabTarget: 'labo', moduleRoute: '/laboratory' };
  const REFRESHED_LAB_2 = { patientId: SAME_PATIENT_ID, patientNom: 'Nguema Marie', type: 'laboratoire', recordId: 'lab-2-plus-ancien', date: '2026-01-01', resume: 'Analyse plus ancienne, absente de la recherche large tronquée', praticien: 'Dr Obiang', statut: 'termine', tabTarget: 'labo', moduleRoute: '/laboratory' };

  api.get.mockImplementation((url) => {
    if (url.startsWith('/medical-records/search?patientId=')) {
      return Promise.resolve({ data: { results: [REFRESHED_LAB_1, REFRESHED_LAB_2], total: 2, page: 1, limit: 500, sourcesTruncated: [] } });
    }
    if (url.startsWith('/medical-records/search')) {
      return Promise.resolve({ data: { results: RECORDS, total: RECORDS.length, page: 1, limit: 200, sourcesTruncated: ['laboratoire'] } });
    }
    if (url.startsWith('/admin/users')) return Promise.resolve({ data: { users: [] } });
    return Promise.resolve({ data: {} });
  });

  const user = userEvent.setup();
  renderPage();
  await screen.findByText(/Recherche très large/);

  const row = await screen.findByText('Nguema Marie');
  await user.click(within(row.closest('tr')).getByRole('button', { name: /Ouvrir/ }));
  const dialog = await screen.findByRole('dialog');

  // Preuve non négociable : l'analyse plus ancienne, absente de la
  // recherche large tronquée, apparaît bien après le rechargement ciblé.
  await within(dialog).findByText('Analyse plus ancienne, absente de la recherche large tronquée');
  await within(dialog).findByText(/historique complet de ce patient a été rechargé/);
});

test('la fiche se ferme et n\'affiche plus rien', async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByText('Nguema Marie');
  const row = screen.getByText('Nguema Marie').closest('tr');
  await user.click(within(row).getByRole('button', { name: /Ouvrir/ }));
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: /Fermer/ }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
