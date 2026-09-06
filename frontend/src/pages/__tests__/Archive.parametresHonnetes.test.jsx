// FE-BUG-016 (audit indépendant du 6 sept. 2026) — deux problèmes dans
// l'onglet "Paramètres d'archivage" :
//  a) le bouton "💾 Enregistrer" affichait un succès (toast.success) sans
//     aucun appel réseau. Vérifié avant correction : chaque réglage (Toggle
//     "actif", "durée") persiste DÉJÀ réellement à chaque changement via
//     updateConfigField() → PUT /archives/config (mécanisme préexistant,
//     Correction 4/FE-BUG-006) — le bouton était donc un doublon trompeur,
//     retiré plutôt que "corrigé" par un faux appel supplémentaire.
//  b) le champ "Heure d'exécution" n'avait pas de onChange et n'était
//     jamais pris en compte — le job réel (archiveHarvestJob.js) tourne à
//     une heure FIXE côté serveur (cron.schedule('0 3 * * *')), non
//     configurable aujourd'hui. Désactivé honnêtement plutôt que simulé.
//
// Monte le vrai composant Archive.jsx avec le vrai reducer archiveSlice ;
// seule la frontière réseau (`../../api`) est simulée.
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import archiveReducer from '../../store/slices/archiveSlice';
import Archive from '../Archive.jsx';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));
import toast from 'react-hot-toast';

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../api';

const CONFIG_FIXTURE = { actif: true, duree: '1an', consultations: true, hospitalisations: true, factures: true, examens: true };

function renderArchive() {
  const store = configureStore({ reducer: { archive: archiveReducer } });
  return render(<Provider store={store}><Archive /></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/archives/config')) return Promise.resolve({ data: { config: CONFIG_FIXTURE } });
    if (url.startsWith('/archives?')) return Promise.resolve({ data: { archives: [], total: 0 } });
    return Promise.resolve({ data: {} });
  });
  api.put.mockResolvedValue({ data: { config: CONFIG_FIXTURE } });
});

test('onglet "Paramètres d\'archivage" : aucun faux bouton "Enregistrer", "Heure d\'exécution" honnêtement désactivée', async () => {
  const user = userEvent.setup();
  renderArchive();

  await user.click(await screen.findByRole('button', { name: 'Paramètres d\'archivage' }));
  await screen.findByText(/Configuration des règles d'archivage automatique/);

  // (a) preuve non négociable : plus de bouton factice affichant un succès
  // sans appel réseau.
  expect(screen.queryByRole('button', { name: /Enregistrer/ })).not.toBeInTheDocument();

  // (b) le champ reste présent (information utile) mais honnêtement non
  // interactif — jamais un champ contrôlé qui prétendrait persister une
  // valeur qui ne serait en réalité écrite nulle part.
  const heureInput = screen.getByDisplayValue('03:00');
  expect(heureInput).toBeDisabled();

  // Le vrai mécanisme de persistance (déjà existant, Correction 4/FE-BUG-006)
  // continue de fonctionner pour les réglages qui, eux, sont réellement
  // sauvegardés — preuve que retirer le bouton "Enregistrer" ne prive pas
  // l'utilisateur d'une vraie persistance.
  const actifRow = screen.getByText('Activer l\'archivage automatique').closest('div').parentElement.parentElement;
  await user.click(within(actifRow).getByRole('checkbox'));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/archives/config', expect.objectContaining({ actif: false })));
  expect(toast.success).not.toHaveBeenCalledWith(expect.stringContaining('Paramètres enregistrés'));
});
