// Phase 10.2 — test de charge sur les endpoints les plus sollicités
// (dashboard, patients, consultations), demandé explicitement en clôture de
// Phase 10.1. Tourne exclusivement contre le serveur isolé
// (tests/helpers/isolatedServer.js — vrai server.js, vraie base MongoDB
// locale jetable) : jamais le cluster Atlas partagé, jamais un serveur de
// développement laissé allumé — cf. l'incident de résidu de test découvert
// avant la Phase 10 (npm test exécuté pendant qu'un serveur dev tournait).
//
// Volume calibré pour rester sous le rate-limiter global de server.js
// (2000 req/15min en développement, app.use('/api/', limiter)) : 300
// requêtes par endpoint × 3 endpoints = 900, avec marge. Le but n'est pas de
// déclencher le rate-limiter (qui est un vrai garde-fou de production, pas
// un obstacle à contourner) mais de mesurer le comportement sous charge
// concurrente réaliste.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const PASSWORD = 'LoadTestT102Phase10!';
const SEED_PATIENTS = 80;
const SEED_CONSULTATIONS = 80;

const ENDPOINTS = [
  { name: 'Tableau de bord', path: '/dashboard' },
  { name: 'Patients',        path: '/patients' },
  { name: 'Consultations',   path: '/consultations' },
];

async function login(baseUrl, email) {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (res.headers.get('set-cookie') || '').split(';')[0];
}

test('Phase 10.2 — test de charge dashboard/patients/consultations (serveur isolé)', { skip: !mongodExists() && 'mongod introuvable — infrastructure Phase 10 indisponible' }, async (t) => {
  let server;

  try {
    await t.test('démarrage du serveur isolé, compte médecin, jeu de données représentatif', async () => {
      server = await startIsolatedServer();
      const mongoose = require('mongoose');
      await mongoose.connect(server.mongoUri);
      const User = require('../models/User');
      const Patient = require('../models/Patient');
      const Consultation = require('../models/Consultation');

      const medecin = await User.create({ email: '_p102.medecin@_test.local', password: PASSWORD, nom: 'P102', prenom: 'Medecin', role: 'medecin', statut: 'actif' });

      const stamp = Date.now();
      // Patient.create() (pas insertMany) — numero_dossier est généré dans
      // un hook pre('save') que insertMany() n'exécute jamais, laissant le
      // champ (unique) à null sur chaque document et provoquant une
      // collision d'index dès le second document.
      const createdPatients = await Promise.all(
        Array.from({ length: SEED_PATIENTS }, (_, i) => Patient.create({
          nom: `P102-${stamp}-${i}`, prenom: 'Charge', date_naissance: '1985-01-01', sexe: i % 2 === 0 ? 'M' : 'F', telephone: `06${String(i).padStart(8, '0')}`,
        }))
      );

      const consultations = createdPatients.slice(0, SEED_CONSULTATIONS).map((p, i) => ({
        patient: p._id, medecin: medecin._id, patient_nom: p.nom, motif_consultation: 'Suivi charge T10.2', anamnese: `Consultation de charge #${i}`, statut: 'terminee',
      }));
      await Consultation.insertMany(consultations);

      await mongoose.disconnect();
    });

    let cookie;
    await t.test('connexion médecin', async () => {
      cookie = await login(server.baseUrl, '_p102.medecin@_test.local');
      assert.ok(cookie, 'la connexion doit réussir avant de lancer la charge');
    });

    const autocannon = require('autocannon');
    const results = [];

    for (const { name, path } of ENDPOINTS) {
      await t.test(`charge — ${name} (${path})`, async () => {
        const result = await autocannon({
          url: `${server.baseUrl}${path}`,
          amount: 300,
          connections: 20,
          headers: { Cookie: cookie },
        });
        results.push({ name, path, result });

        console.log(`\n[T10.2] ${name} (${path}) — ${result.requests.average.toFixed(1)} req/s moy., latence p50=${result.latency.p50}ms p99=${result.latency.p99}ms, ${result['2xx']}/${result.requests.total} en 2xx`);

        assert.equal(result.errors, 0, `${name} : aucune erreur de connexion attendue (obtenu ${result.errors})`);
        assert.equal(result.timeouts, 0, `${name} : aucun timeout attendu (obtenu ${result.timeouts})`);
        assert.equal(result.non2xx, 0, `${name} : toutes les réponses doivent être 2xx sous charge (obtenu ${result.non2xx} non-2xx sur ${result.requests.total})`);
      });
    }

    await t.test('rapport de synthèse', () => {
      console.log('\n[T10.2] ── Synthèse test de charge (300 req × 20 connexions par endpoint) ──');
      for (const { name, result } of results) {
        console.log(`  ${name.padEnd(20)} p50=${String(result.latency.p50).padStart(4)}ms  p99=${String(result.latency.p99).padStart(4)}ms  ${result.requests.average.toFixed(1).padStart(6)} req/s`);
      }
    });
  } finally {
    if (server) await server.stop();
  }
});
