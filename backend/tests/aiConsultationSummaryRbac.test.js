// MODULE AI — sous-module Administratif : preuve RBAC réelle (HTTP) pour
// POST /ai/consultation-summary/:consultationId. Un rôle non listé dans
// ai.routes.js ne doit jamais pouvoir appeler cet endpoint directement,
// même en connaissant l'URL.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const PASSWORD = 'AiAdminRbacTestPass1!';
const FETCH_TIMEOUT_MS = 15000;
const withTimeout = (opts) => ({ ...opts, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

async function login(baseUrl, email) {
  const res = await fetch(`${baseUrl}/auth/login`, withTimeout({
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  }));
  if (res.status !== 200) throw new Error(`login ${email} a échoué (${res.status})`);
  return (res.headers.get('set-cookie') || '').split(';')[0];
}

test('AI/Administratif — POST /ai/consultation-summary/:id réellement protégé par rôle (serveur isolé, vraies requêtes HTTP)', { skip: !mongodExists() && 'mongod introuvable — infrastructure de serveur isolé indisponible' }, async (t) => {
  let server = null;
  let connected = false;
  const created = { users: [], patients: [], consultations: [] };

  try {
    server = await startIsolatedServer();
    await mongoose.connect(server.mongoUri);
    connected = true;
    const User = require('../models/User');
    const Patient = require('../models/Patient');
    const Consultation = require('../models/Consultation');

    const stamp = Date.now();
    const medecin = await User.create({ email: `_aiadmin-medecin-${stamp}@_test.local`, password: PASSWORD, nom: 'T', prenom: 'Medecin', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);
    const laborantin = await User.create({ email: `_aiadmin-labo-${stamp}@_test.local`, password: PASSWORD, nom: 'T', prenom: 'Labo', role: 'laborantin', statut: 'actif' });
    created.users.push(laborantin._id);
    const patient = await Patient.create({ nom: `AIAdminRbac-${stamp}`, prenom: 'Synthetique', sexe: 'F', date_naissance: '1990-01-01' });
    created.patients.push(patient._id);
    const consultation = await Consultation.create({ patient: patient._id, medecin: medecin._id, diagnostic: 'Test synthétique' });
    created.consultations.push(consultation._id);

    await t.test('rôle non autorisé (laborantin) — appel direct de l\'API refusé (403)', async () => {
      const cookie = await login(server.baseUrl, laborantin.email);
      const res = await fetch(`${server.baseUrl}/ai/consultation-summary/${consultation._id}`, withTimeout({ method: 'POST', headers: { Cookie: cookie } }));
      assert.equal(res.status, 403, 'un rôle non listé dans ai.routes.js doit être rejeté par le backend lui-même');
    });

    await t.test('non authentifié — appel direct sans cookie refusé (401)', async () => {
      const res = await fetch(`${server.baseUrl}/ai/consultation-summary/${consultation._id}`, withTimeout({ method: 'POST' }));
      assert.equal(res.status, 401);
    });
  } finally {
    for (const id of created.consultations) { try { await require('../models/Consultation').findByIdAndDelete(id); } catch {} }
    for (const id of created.patients) { try { await require('../models/Patient').findByIdAndDelete(id); } catch {} }
    for (const id of created.users) { try { await require('../models/User').findByIdAndDelete(id); } catch {} }
    if (connected) await mongoose.disconnect();
    if (server) await server.stop();
  }
});
