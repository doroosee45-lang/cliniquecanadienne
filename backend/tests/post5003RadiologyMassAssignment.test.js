// POST5-003 (audit indépendant post-Phase 5, 14 sept. 2026) — HAUTE,
// reproduit en direct pendant l'audit. radiology.controller.js::create
// construisait `statut: req.body.statut || 'programme'` : un rôle non-
// radiologue (medecin/infirmier, autorisés sur POST /radiology —
// radiology.routes.js) pouvait créer un examen directement statut:'valide',
// sans jamais passer par saveCR()/validation() (réservées à radiologue/
// superadmin) — un tel examen devient immédiatement visible dans le
// portail patient (portal.controller.js::getImaging, filtre statut in
// ['rapporte','valide']), comme un résultat réellement validé.
//
// Ce test tourne EXCLUSIVEMENT contre le serveur isolé (vrai server.js, vrai
// routeur, vrai middleware authorize()), via de vraies requêtes HTTP avec un
// vrai cookie de session obtenu par un vrai POST /auth/login.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const PASSWORD = 'Post5003TestPass1!';
const FETCH_TIMEOUT_MS = 10000;
const withTimeout = (opts) => ({ ...opts, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

async function login(baseUrl, email) {
  const res = await fetch(`${baseUrl}/auth/login`, withTimeout({
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  }));
  if (res.status !== 200) throw new Error(`login ${email} a échoué (${res.status})`);
  return (res.headers.get('set-cookie') || '').split(';')[0];
}

test('POST5-003 — POST /radiology force toujours statut:programme à la création, même si le client envoie statut:valide (serveur isolé, vraie requête HTTP)', { skip: !mongodExists() && 'mongod introuvable — infrastructure de serveur isolé indisponible' }, async (t) => {
  let server = null;
  let connected = false;
  const created = { users: [], patients: [], imagingresults: [] };

  try {
    server = await startIsolatedServer();
    await mongoose.connect(server.mongoUri);
    connected = true;
    const User = require('../models/User');
    const Patient = require('../models/Patient');
    const ImagingResult = require('../models/ImagingResult');

    const stamp = Date.now();
    const infirmier = await User.create({ email: `_p5003-inf-${stamp}@_test.local`, password: PASSWORD, nom: 'Attaquant', prenom: 'Infirmier', role: 'infirmier', statut: 'actif' });
    created.users.push(infirmier._id);
    const radiologue = await User.create({ email: `_p5003-radio-${stamp}@_test.local`, password: PASSWORD, nom: 'Legitime', prenom: 'Radiologue', role: 'radiologue', statut: 'actif' });
    created.users.push(radiologue._id);
    const patient = await Patient.create({ nom: `P5003-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1988-01-01' });
    created.patients.push(patient._id);

    const cookieInf = await login(server.baseUrl, infirmier.email);
    const cookieRadio = await login(server.baseUrl, radiologue.email);

    let fabricatedId;
    await t.test('infirmier — statut envoyé "valide" à la création est ignoré, l\'examen naît toujours "programme"', async () => {
      const res = await fetch(`${server.baseUrl}/radiology`, withTimeout({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieInf },
        body: JSON.stringify({
          patient: String(patient._id), patient_nom: 'Test POST5003',
          type_examen: 'Radio thorax', motif: 'Test',
          statut: 'valide',
        }),
      }));
      assert.equal(res.status, 201, 'la création normale d\'un examen doit rester possible pour ce rôle');
      const body = await res.json();
      fabricatedId = body.examen._id;
      created.imagingresults.push(fabricatedId);
      assert.equal(body.examen.statut, 'programme', 'la réponse HTTP elle-même ne doit jamais refléter le statut fabriqué');

      const fresh = await ImagingResult.findById(fabricatedId).lean();
      assert.ok(fresh, 'le document doit réellement exister en base');
      assert.equal(fresh.statut, 'programme', 'statut doit rester programme en base, jamais valide, quel que soit ce que le client a envoyé');

      // Preuve d'impact : le filtre réel du portail patient
      // (portal.controller.js::getImaging, statut in ['rapporte','valide'])
      // ne peut donc plus jamais matcher ce document fabriqué.
      assert.ok(!['rapporte', 'valide'].includes(fresh.statut), 'ne doit jamais être visible dans le portail patient tant que non réellement rapporté/validé');
    });

    await t.test('non-régression — le workflow normal (créer → compte-rendu → valider par un radiologue) fonctionne toujours', async () => {
      const crRes = await fetch(`${server.baseUrl}/radiology/${fabricatedId}/cr`, withTimeout({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookieRadio },
        body: JSON.stringify({ compte_rendu: 'Examen réel réalisé', conclusion: 'RAS', operateur: 'Dr. Legitime' }),
      }));
      assert.equal(crRes.status, 200);

      const validRes = await fetch(`${server.baseUrl}/radiology/${fabricatedId}/validation`, withTimeout({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookieRadio },
        body: JSON.stringify({}),
      }));
      assert.equal(validRes.status, 200, 'un radiologue légitime doit toujours pouvoir valider un examen réellement réalisé');
      const body = await validRes.json();
      assert.equal(body.examen.statut, 'valide');

      const fresh = await ImagingResult.findById(fabricatedId).lean();
      assert.equal(fresh.statut, 'valide');
    });

    await t.test('non-régression — une création légitime sans champ statut envoyé reste "programme" par défaut', async () => {
      const res = await fetch(`${server.baseUrl}/radiology`, withTimeout({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieInf },
        body: JSON.stringify({ patient: String(patient._id), patient_nom: 'Test POST5003 B', type_examen: 'Scanner', motif: 'Suivi' }),
      }));
      assert.equal(res.status, 201);
      const body = await res.json();
      created.imagingresults.push(body.examen._id);
      assert.equal(body.examen.statut, 'programme');
    });
  } finally {
    if (connected) {
      const ImagingResult = require('../models/ImagingResult');
      const Invoice = require('../models/Invoice');
      const User = require('../models/User');
      const Patient = require('../models/Patient');
      await Invoice.deleteMany({ source_module: 'imagerie', source_id: { $in: created.imagingresults } });
      await ImagingResult.deleteMany({ _id: { $in: created.imagingresults } });
      await User.deleteMany({ _id: { $in: created.users } });
      await Patient.deleteMany({ _id: { $in: created.patients } });
      await mongoose.disconnect();
    }
    if (server) await server.stop();
  }
});
