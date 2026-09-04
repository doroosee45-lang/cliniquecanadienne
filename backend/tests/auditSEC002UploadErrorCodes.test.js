// SEC-002 (audit indépendant du 4 sept. 2026) — un fichier rejeté par
// fileFilter (extension hors whitelist) ou par multer lui-même (taille
// dépassée) tombait dans la branche générique de errorHandler.js et
// renvoyait 500 au lieu de 400. La whitelist elle-même fonctionnait déjà
// (pas de bypass possible) — seul le code HTTP retourné était faux.
//
// Ce test tourne EXCLUSIVEMENT contre le serveur isolé (tests/helpers/
// isolatedServer.js — vrai server.js, vrai multer, vrai errorHandler),
// via de vraies requêtes HTTP multipart/form-data avec un vrai cookie de
// session, sur la vraie route POST /patients/:id/photo — jamais un appel
// direct à errorHandler avec un objet Error fabriqué à la main.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const PASSWORD = 'SEC002TestPass1!';
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

test('SEC-002 — un fichier rejeté par upload/photo reçoit un vrai 400, jamais un 500 (serveur isolé, vraie requête HTTP)', { skip: !mongodExists() && 'mongod introuvable — infrastructure de serveur isolé indisponible' }, async (t) => {
  let server = null;
  let connected = false;
  const created = { users: [], patients: [] };

  try {
    server = await startIsolatedServer();
    await mongoose.connect(server.mongoUri);
    connected = true;
    const User = require('../models/User');
    const Patient = require('../models/Patient');

    const stamp = Date.now();
    const patient = await Patient.create({ nom: `Sec002-${stamp}`, prenom: 'P', date_naissance: '1988-04-12', sexe: 'F' });
    created.patients.push(patient._id);
    const medecin = await User.create({ email: `_sec002-medecin-${stamp}@_test.local`, password: PASSWORD, nom: 'Test', prenom: 'Medecin', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);

    const cookie = await login(server.baseUrl, medecin.email);
    const uploadUrl = `${server.baseUrl}/patients/${patient._id}/photo`;

    await t.test('extension interdite (.exe) → 400 réel avec message exploitable, jamais 500', async () => {
      const form = new FormData();
      form.append('photo', new Blob([Buffer.from('MZ-fake-binary-content')], { type: 'application/octet-stream' }), 'virus.exe');
      const res = await fetch(uploadUrl, withTimeout({ method: 'POST', headers: { Cookie: cookie }, body: form }));
      assert.equal(res.status, 400, 'un fichier au format interdit doit produire un vrai 400, pas un 500 générique');
      const body = await res.json();
      assert.equal(body.success, false);
      assert.match(body.message, /[Ff]ormat|autorisé/, 'le message doit être exploitable (indiquer le problème de format)');
      assert.doesNotMatch(body.message, /[A-Za-z]:\\|\/home\/|\/usr\/|node_modules|\.js:\d/, 'le message ne doit fuiter aucun détail de chemin/fichier serveur');
    });

    await t.test('fichier dépassant la taille max (>5 Mo) → 400 réel (MulterError), jamais 500', async () => {
      const tropGros = Buffer.alloc(6 * 1024 * 1024, 1); // 6 Mo > limite de 5 Mo (uploadPatientPhoto)
      const form = new FormData();
      form.append('photo', new Blob([tropGros], { type: 'image/png' }), 'photo-enorme.png');
      const res = await fetch(uploadUrl, withTimeout({ method: 'POST', headers: { Cookie: cookie }, body: form }));
      assert.equal(res.status, 400, 'un fichier trop volumineux doit produire un vrai 400 (MulterError), pas un 500 générique');
      const body = await res.json();
      assert.equal(body.success, false);
      assert.match(body.message, /volumineux|taille/i);
    });

    await t.test('contrôle négatif — un fichier réellement conforme (png, taille normale) est toujours accepté (200)', async () => {
      const form = new FormData();
      form.append('photo', new Blob([Buffer.from('fake-but-small-png-bytes')], { type: 'image/png' }), 'photo-normale.png');
      const res = await fetch(uploadUrl, withTimeout({ method: 'POST', headers: { Cookie: cookie }, body: form }));
      assert.equal(res.status, 200, 'la whitelist ne doit pas être devenue plus restrictive : un vrai fichier conforme doit toujours passer');
    });
  } finally {
    if (connected) {
      const User = require('../models/User');
      const Patient = require('../models/Patient');
      await User.deleteMany({ _id: { $in: created.users } });
      await Patient.deleteMany({ _id: { $in: created.patients } });
      await mongoose.disconnect();
    }
    if (server) await server.stop();
  }
});
