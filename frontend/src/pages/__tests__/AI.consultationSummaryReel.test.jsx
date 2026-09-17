// MODULE AI — sous-module Administratif (implémentation réelle,
// partielle et assumée comme telle). Le panneau "📋 Administratif"
// affichait "🚧 Fonctionnalité en cours de développement" à la place de 8
// boutons "Générer" décoratifs (Sous-phase 5.6). Prouve que "Résumé de
// consultation" (le seul des 8 réellement implémenté) charge la vraie
// liste de consultations du patient sélectionné et affiche le vrai
// résumé renvoyé par le backend — et que les 7 autres documents sont
// honnêtement listés "Non implémenté", jamais des boutons morts.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import aiReducer from '../../store/slices/aiSlice';
import patientsReducer from '../../store/slices/patientsSlice';
import AI from '../AI.jsx';
import api from '../../api';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
Element.prototype.scrollIntoView = vi.fn();

vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const PATIENT = { _id: 'pat-admin-1', nom: 'Loemba', prenom: 'Synthétique', numero_dossier: 'DOS-SYN-03' };
const CONSULTATION = { _id: 'cons-1', date_consultation: '2026-09-10T00:00:00.000Z', diagnostic: 'Paludisme simple (synthétique)' };

function renderAI() {
  const store = configureStore({ reducer: { ai: aiReducer, patients: patientsReducer } });
  return render(<Provider store={store}><MemoryRouter><AI /></MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url === '/ai/stats') return Promise.resolve({ data: { success: true, stats: {} } });
    if (url === '/ai/alerts') return Promise.resolve({ data: { alerts: { labo_critiques: [], imagerie_urgentes: [], predictions_en_attente: [] } } });
    if (url.startsWith('/patients')) return Promise.resolve({ data: { patients: [PATIENT], total: 1 } });
    if (url.startsWith('/consultations?patient=pat-admin-1')) return Promise.resolve({ data: { consultations: [CONSULTATION], total: 1 } });
    return Promise.resolve({ data: {} });
  });
  api.post.mockImplementation((url) => {
    if (url === '/ai/consultation-summary/cons-1') return Promise.resolve({ data: { success: true, synthese: 'Patient présentant une fièvre synthétique, diagnostic de paludisme simple posé. Traitement antipaludéen prescrit. Ce résumé est une aide à la rédaction et doit être relu et validé par le médecin avant tout usage officiel.', simulated: false } });
    return Promise.resolve({ data: {} });
  });
});

async function goToAdministratifSection(user) {
  await user.click(await screen.findByRole('button', { name: /Modules IA/ }));
  await user.click(await screen.findByRole('button', { name: /Administratif/ }));
}

test('AI/Administratif — Résumé de consultation charge la vraie consultation et affiche le vrai résumé, jamais le placeholder', async () => {
  const user = userEvent.setup();
  renderAI();
  await goToAdministratifSection(user);

  expect(screen.queryByText(/en cours de développement/)).not.toBeInTheDocument();

  const selects = await screen.findAllByRole('combobox');
  await user.selectOptions(selects[0], 'pat-admin-1');

  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/consultations?patient=pat-admin-1&limit=20'));
  const allSelects = await screen.findAllByRole('combobox');
  await user.selectOptions(allSelects[1], 'cons-1');

  await user.click(screen.getByRole('button', { name: /Générer le résumé/ }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ai/consultation-summary/cons-1'));

  expect(await screen.findByText(/Patient présentant une fièvre synthétique/)).toBeInTheDocument();
});

test('AI/Administratif — les 7 autres documents sont honnêtement marqués "Non implémenté", jamais des boutons décoratifs', async () => {
  const user = userEvent.setup();
  renderAI();
  await goToAdministratifSection(user);

  const badges = screen.getAllByText('Non implémenté');
  expect(badges.length).toBe(6);
  expect(screen.getByText('Certificat médical')).toBeInTheDocument();
  expect(screen.getByText('Courrier de liaison')).toBeInTheDocument();
});
