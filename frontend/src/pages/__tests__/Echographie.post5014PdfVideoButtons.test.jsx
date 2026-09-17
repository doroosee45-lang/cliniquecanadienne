// POST5-014 (audit indépendant post-Phase 5, 14 sept. 2026) — l'étape
// "Images" de l'assistant échographie affichait deux boutons "+ Vidéo" et
// "+ PDF" sans le moindre onClick. "+ PDF" est désormais réellement câblé
// (le backend accepte déjà .pdf sur cette même route d'upload — middleware/
// upload.js::fileFilter, partagé avec les images d'examen — seul le filtre
// client-side les rejetait silencieusement) : sélectionner un PDF l'ajoute
// bien aux fichiers en attente. "+ Vidéo" est retiré plutôt que branché sur
// une fonctionnalité qui n'existe pas (aucune extension vidéo autorisée
// nulle part côté backend) — jamais un bouton mort laissé en place, jamais
// une fonctionnalité simulée.
//
// Monte le vrai composant Echographie.jsx ; seule la frontière réseau
// (`../../api`) et useRealtimeRefresh sont simulées.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import echographieReducer from '../../store/slices/echographieSlice';
import Echographie from '../Echographie.jsx';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';
vi.mock('../../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: () => {} }));

const DEMANDE_PLANIFIEE = {
  _id: 'echo-1', id: 'echo-1', numero: 'ECH-1', patient_nom: 'Jane Doe', patient: 'Jane Doe', type: 'Obstétricale',
  statut: 'planifiee', images: [],
};

function renderEchographie() {
  const store = configureStore({ reducer: { echographie: echographieReducer } });
  return render(<Provider store={store}><MemoryRouter><Echographie /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/echographie/stats')) return Promise.resolve({ data: {} });
    if (url.startsWith('/echographie?')) return Promise.resolve({ data: { demandes: [DEMANDE_PLANIFIEE], total: 1 } });
    if (url.startsWith('/settings/services')) return Promise.resolve({ data: { services: [] } });
    return Promise.resolve({ data: {} });
  });
});

test('POST5-014 — "+ Vidéo" a disparu (aucun support backend réel), "+ PDF" ajoute réellement un fichier PDF aux fichiers en attente', async () => {
  const user = userEvent.setup();
  renderEchographie();

  // Atteint l'étape 3 (Images) via le fil normal de l'assistant, onglet
  // "Réalisation" : la demande "planifiee" est auto-sélectionnée à l'étape 0.
  await user.click(await screen.findByRole('button', { name: /Réalisation/ }));
  await screen.findByText('Jane Doe');
  await user.click(screen.getByRole('button', { name: 'Continuer →' }));
  await user.click(screen.getByRole('button', { name: 'Continuer →' }));
  await user.click(screen.getByRole('button', { name: 'Continuer →' }));

  await screen.findByText(/Gestion des images échographiques/);

  expect(screen.queryByRole('button', { name: /Vidéo/ })).not.toBeInTheDocument();

  const pdfBtn = screen.getByRole('button', { name: '+ PDF' });
  expect(pdfBtn).toBeInTheDocument();

  const pdfFile = new File(['%PDF-1.4 contenu factice'], 'rapport-externe.pdf', { type: 'application/pdf' });
  const pdfInput = document.getElementById('echo-pdf-input');
  expect(pdfInput).toBeTruthy();
  await user.upload(pdfInput, pdfFile);

  expect(await screen.findByText('rapport-externe.pdf')).toBeInTheDocument();
  expect(screen.getByText('En attente d\'enregistrement')).toBeInTheDocument();
});
