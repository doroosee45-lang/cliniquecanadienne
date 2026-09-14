// POST5-001 (audit indépendant post-Phase 5, 14 sept. 2026) — CRITIQUE,
// reproduit en direct pendant l'audit. echographieController.js::create
// persistait `{...req.body}` sans aucun filtre : un rôle non habilité à
// valider un compte-rendu (infirmier/sage_femme, entre autres) pouvait
// soumettre directement statut:'validee'/rapport_radiologue/rapport_texte/
// conclusion en un seul appel POST /echographie, sans jamais passer par
// PUT /:id/rapport (réservé à radiologue/superadmin) — un rapport d'imagerie
// entièrement fabriqué, attribué à un radiologue fictif, jamais soumis au
// vrai circuit de validation.
//
// Ce test tourne EXCLUSIVEMENT contre le serveur isolé (vrai server.js, vrai
// routeur, vrai middleware authorize()), via de vraies requêtes HTTP avec un
// vrai cookie de session obtenu par un vrai POST /auth/login — même méthode
// que auditSEC010MessagesGroupsRoleGuard.test.js.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const PASSWORD = 'Post5001TestPass1!';
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

test('POST5-001 — POST /echographie ignore les champs de validation réservés, même envoyés par un rôle non habilité (serveur isolé, vraie requête HTTP)', { skip: !mongodExists() && 'mongod introuvable — infrastructure de serveur isolé indisponible' }, async (t) => {
  let server = null;
  let connected = false;
  const created = { users: [], patients: [], echographies: [] };

  try {
    server = await startIsolatedServer();
    await mongoose.connect(server.mongoUri);
    connected = true;
    const User = require('../models/User');
    const Patient = require('../models/Patient');
    const Echographie = require('../models/Echographie');

    const stamp = Date.now();
    const infirmier = await User.create({
      email: `_post5001-inf-${stamp}@_test.local`, password: PASSWORD,
      nom: 'Attaquant', prenom: 'Infirmier', role: 'infirmier', statut: 'actif',
    });
    created.users.push(infirmier._id);
    const radiologue = await User.create({
      email: `_post5001-radio-${stamp}@_test.local`, password: PASSWORD,
      nom: 'Legitime', prenom: 'Radiologue', role: 'radiologue', statut: 'actif',
    });
    created.users.push(radiologue._id);
    const patient = await Patient.create({ nom: `POST5001-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1990-01-01' });
    created.patients.push(patient._id);

    const cookieInf = await login(server.baseUrl, infirmier.email);
    const cookieRadio = await login(server.baseUrl, radiologue.email);

    let fabricatedId;
    await t.test('infirmier — mass-assignment (statut/rapport/conclusion) est ignoré, jamais persisté, même si la création elle-même réussit', async () => {
      const res = await fetch(`${server.baseUrl}/echographie`, withTimeout({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieInf },
        body: JSON.stringify({
          patient: String(patient._id), patient_nom: 'Test POST5001',
          type: 'Abdominale', motif: 'Test', priorite: 'normale',
          // Champs réservés au circuit de validation — jamais acceptés à la création :
          statut: 'validee',
          rapport_statut: 'valide',
          rapport_radiologue: 'Dr. Fabrique (jamais authentifié)',
          rapport_texte: 'RAS — fabriqué par un infirmier sans revue radiologue',
          conclusion: 'RAS — FABRIQUE PAR INFIRMIER SANS REVUE RADIOLOGUE',
          recommandations: 'Aucune',
        }),
      }));
      // La création elle-même reste autorisée pour ce rôle (il a le droit de
      // soumettre une demande) — seuls les champs de validation doivent être
      // neutralisés, jamais un 403 générique qui masquerait le vrai correctif.
      assert.equal(res.status, 201, 'la création normale d\'une demande doit rester possible pour ce rôle');
      const body = await res.json();
      fabricatedId = body.demande._id;
      created.echographies.push(fabricatedId);

      // Preuve MongoDB — pas seulement la réponse HTTP.
      const fresh = await Echographie.findById(fabricatedId).lean();
      assert.ok(fresh, 'le document doit réellement exister en base');
      assert.equal(fresh.statut, 'en_attente', 'statut doit rester en_attente, jamais validee, quel que soit ce que le client a envoyé');
      assert.equal(fresh.rapport_statut, undefined, 'rapport_statut ne doit jamais être persisté à la création');
      assert.equal(fresh.rapport_radiologue, undefined, 'rapport_radiologue ne doit jamais être persisté à la création');
      assert.equal(fresh.rapport_texte, undefined, 'rapport_texte ne doit jamais être persisté à la création');
      assert.equal(fresh.conclusion, undefined, 'conclusion ne doit jamais être persistée à la création');
      assert.equal(fresh.recommandations, undefined, 'recommandations ne doit jamais être persistée à la création');
    });

    await t.test('infirmier — accès direct à PUT /:id/rapport reste refusé (403), autre vecteur déjà fermé', async () => {
      const res = await fetch(`${server.baseUrl}/echographie/${fabricatedId}/rapport`, withTimeout({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookieInf },
        body: JSON.stringify({ rapport_statut: 'valide', conclusion: 'Tentative directe' }),
      }));
      assert.equal(res.status, 403);
      const fresh = await Echographie.findById(fabricatedId).lean();
      assert.equal(fresh.statut, 'en_attente', 'toujours non validé après la tentative directe refusée');
    });

    await t.test('radiologue — workflow normal (planifier puis valider un vrai rapport) fonctionne toujours et produit un état réel', async () => {
      const planifRes = await fetch(`${server.baseUrl}/echographie/${fabricatedId}/planifier`, withTimeout({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookieRadio },
        body: JSON.stringify({ date_planif: new Date().toISOString(), echographiste: 'Dr. Legitime', salle: 'Salle 2' }),
      }));
      assert.equal(planifRes.status, 200);

      const rapportRes = await fetch(`${server.baseUrl}/echographie/${fabricatedId}/rapport`, withTimeout({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookieRadio },
        body: JSON.stringify({ rapport_statut: 'valide', rapport_texte: 'Examen réel, sans anomalie détectée.', conclusion: 'RAS' }),
      }));
      assert.equal(rapportRes.status, 200, 'le radiologue légitime doit toujours pouvoir valider un vrai rapport');
      const body = await rapportRes.json();
      assert.equal(body.demande.statut, 'validee');

      const fresh = await Echographie.findById(fabricatedId).lean();
      assert.equal(fresh.statut, 'validee');
      assert.equal(fresh.rapport_statut, 'valide');
      assert.equal(fresh.rapport_texte, 'Examen réel, sans anomalie détectée.');
      assert.equal(fresh.conclusion, 'RAS');
    });

    await t.test('non-régression — une demande légitime (aucun champ réservé envoyé) est créée normalement', async () => {
      const res = await fetch(`${server.baseUrl}/echographie`, withTimeout({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieInf },
        body: JSON.stringify({ patient: String(patient._id), patient_nom: 'Test POST5001 B', type: 'Obstétricale', motif: 'Suivi', priorite: 'urgente', source: 'Consultation', medecin_presc: 'Dr. X' }),
      }));
      assert.equal(res.status, 201);
      const body = await res.json();
      created.echographies.push(body.demande._id);
      assert.equal(body.demande.statut, 'en_attente');
      assert.equal(body.demande.type, 'Obstétricale');
      assert.equal(body.demande.priorite, 'urgente');
      const fresh = await Echographie.findById(body.demande._id).lean();
      assert.equal(fresh.motif, 'Suivi');
    });
  } finally {
    if (connected) {
      const Echographie = require('../models/Echographie');
      const Invoice = require('../models/Invoice');
      const User = require('../models/User');
      const Patient = require('../models/Patient');
      await Invoice.deleteMany({ source_module: 'echographie', source_id: { $in: created.echographies } });
      await Echographie.deleteMany({ _id: { $in: created.echographies } });
      await User.deleteMany({ _id: { $in: created.users } });
      await Patient.deleteMany({ _id: { $in: created.patients } });
      await mongoose.disconnect();
    }
    if (server) await server.stop();
  }
});
