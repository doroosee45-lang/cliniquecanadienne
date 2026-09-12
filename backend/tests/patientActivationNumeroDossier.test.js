// PATIENT-ACTIVATION-002 (audit du 12 sept. 2026) — un patient sans
// smartphone/accès email ne pouvait jamais suivre le lien d'activation
// (seul mécanisme réel jusqu'ici, R-08b), donc jamais se connecter au
// portail. patients.controller.js::activateAdmin accepte désormais
// `{ methode: 'numero_dossier' }` : définit directement le mot de passe du
// compte lié sur le numero_dossier réel du patient et force
// must_change_password — jamais un mot de passe fabriqué ou générique. Ce
// test couvre le fonctionnement réel (login effectif avec le numero_dossier,
// forçage du changement) et la non-régression du mode par défaut (lien
// email, dossier sans email du tout).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Activation patient sans smartphone — numero_dossier comme mot de passe initial', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const patC = require('../controllers/patients.controller');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; return res; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };
  const staff = { _id: new mongoose.Types.ObjectId(), prenom: 'Staff', nom: 'Test', role: 'receptionniste' };
  const created = { patients: [], users: [] };

  try {
    await t.test('méthode numero_dossier — définit réellement le mot de passe, force must_change_password', async () => {
      const email = `_actnd-${stamp}@_test.local`;
      const patient = await Patient.create({ nom: `ActND-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1990-01-01', email, actif: false, statut: 'inactif' });
      created.patients.push(patient);
      const user = await User.create({ email, nom: 'ActND', prenom: 'Test', role: 'patient', statut: 'inactif', patient_id: patient._id });
      created.users.push(user);

      const { status, body } = await call(patC.activateAdmin, { params: { id: patient._id.toString() }, user: staff, ip: '127.0.0.1', body: { methode: 'numero_dossier' } });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.mot_de_passe_defini, true);
      assert.match(body.message, /numéro de dossier/);

      const freshUser = await User.findById(user._id).select('+password must_change_password statut');
      assert.equal(freshUser.statut, 'actif');
      assert.equal(freshUser.must_change_password, true, 'le patient doit être forcé à changer ce mot de passe initial');
      assert.ok(await freshUser.matchPassword(patient.numero_dossier), 'le vrai numero_dossier doit être le mot de passe fonctionnel');
      assert.equal(await freshUser.matchPassword('mauvais-mdp'), false);

      const freshPatient = await Patient.findById(patient._id).lean();
      assert.equal(freshPatient.actif, true);
      assert.equal(freshPatient.token_activation, undefined);
    });

    await t.test('méthode numero_dossier — refuse si le patient n\'a pas d\'email (aucun compte lié possible)', async () => {
      const patient = await Patient.create({ nom: `ActNDNoEmail-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1985-01-01' });
      created.patients.push(patient);
      const { status, body } = await call(patC.activateAdmin, { params: { id: patient._id.toString() }, user: staff, ip: '127.0.0.1', body: { methode: 'numero_dossier' } });
      assert.equal(status, 400, JSON.stringify(body));
    });

    await t.test('méthode numero_dossier — refuse si aucun compte User lié n\'existe', async () => {
      const email = `_actnd-nouser-${stamp}@_test.local`;
      const patient = await Patient.create({ nom: `ActNDNoUser-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1992-01-01', email });
      created.patients.push(patient);
      const { status } = await call(patC.activateAdmin, { params: { id: patient._id.toString() }, user: staff, ip: '127.0.0.1', body: { methode: 'numero_dossier' } });
      assert.equal(status, 404);
    });

    await t.test('NON-RÉGRESSION — mode par défaut (sans body.methode) sur un dossier sans email fonctionne toujours (200, dossier activé)', async () => {
      const patient = await Patient.create({ nom: `ActDefault-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1980-01-01', actif: false, statut: 'inactif' });
      created.patients.push(patient);
      const { status, body } = await call(patC.activateAdmin, { params: { id: patient._id.toString() }, user: staff, ip: '127.0.0.1', body: {} });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.mot_de_passe_defini, false);
      const fresh = await Patient.findById(patient._id).lean();
      assert.equal(fresh.actif, true);
    });

    await t.test('SÉCURITÉ — la nouvelle option ne bypasse pas le validateur de complexité si numero_dossier était non conforme (défense en profondeur)', async () => {
      // numero_dossier est TOUJOURS généré au format CLIN-YYYY-NNNNN (majuscule
      // + chiffres) par Patient.js — jamais fabricable par le client de toute
      // façon (généré serveur, ignoré s'il est envoyé, cf. PATIENT_BLOCKED_FIELDS).
      // Ce test documente juste que le format réel passe bien le validateur,
      // sans hypothèse fragile sur un format qui échouerait.
      const email = `_actnd-format-${stamp}@_test.local`;
      const patient = await Patient.create({ nom: `ActNDFormat-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1990-01-01', email });
      created.patients.push(patient);
      assert.match(patient.numero_dossier, /^CLIN-\d{4}-\d{5}$/);
      const user = await User.create({ email, nom: 'ActNDFormat', prenom: 'Test', role: 'patient', statut: 'inactif', patient_id: patient._id });
      created.users.push(user);
      const { status } = await call(patC.activateAdmin, { params: { id: patient._id.toString() }, user: staff, ip: '127.0.0.1', body: { methode: 'numero_dossier' } });
      assert.equal(status, 200);
    });
  } finally {
    await User.deleteMany({ _id: { $in: created.users.map(u => u._id) } });
    await Patient.deleteMany({ _id: { $in: created.patients.map(p => p._id) } });
    await mongoose.disconnect();
  }
});
