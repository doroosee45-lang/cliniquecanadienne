// AUDIT-ADMIN-P2 — chemin dédié de création patient depuis Administration.jsx.
// Le garde-fou (refuseRolePatient, déjà committé) bloque la création d'un
// compte role:'patient' via le formulaire staff générique (createUser/
// updateUser). Ce test couvre l'autre moitié du point : le nouveau bouton
// "Nouveau patient" d'Administration.jsx appelle le même POST /patients réel
// (patients.controller.js::create) que le module Patients — aucune logique
// dupliquée, dossier Patient + compte User (role:'patient') lié créés
// normalement quand un email est fourni.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Administration Point 2 — chemin dédié POST /patients (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const patientsC = require('../controllers/patients.controller');

  const stamp = Date.now();
  const superadmin = { _id: new mongoose.Types.ObjectId(), role: 'superadmin', prenom: 'P2', nom: 'Test' };
  const created = { patients: [], users: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('création via le même contrôleur réel que Patients.jsx — dossier + compte lié créés', async () => {
      const email = `_p2-dedie-${stamp}@_test.local`;
      const { status, body } = await call(patientsC.create, {
        body: { nom: 'DédiéP2', prenom: 'Patient', date_naissance: '1990-05-01', sexe: 'F', telephone: '+242060000001', email },
        user: superadmin, ip: '127.0.0.1', headers: {},
      });
      assert.equal(status, 201);
      created.patients.push(body.patient._id);
      assert.ok(body.patient.numero_dossier, 'un vrai numéro de dossier doit être généré');

      const linkedUser = await User.findOne({ email });
      assert.ok(linkedUser, 'un compte User lié doit être créé quand un email est fourni');
      assert.equal(linkedUser.role, 'patient');
      assert.equal(linkedUser.patient_id.toString(), body.patient._id.toString());
      assert.equal(linkedUser.statut, 'inactif', 'inactif tant que le lien d\'activation n\'a pas été suivi');
      created.users.push(linkedUser._id);
    });

    await t.test('sans email — dossier créé, aucun compte User fabriqué', async () => {
      const { status, body } = await call(patientsC.create, {
        body: { nom: 'DédiéP2SansEmail', prenom: 'Patient', date_naissance: '1985-03-01', sexe: 'M' },
        user: superadmin, ip: '127.0.0.1', headers: {},
      });
      assert.equal(status, 201);
      created.patients.push(body.patient._id);
    });

    await t.test('doublon (même nom/prénom/date de naissance) — 409, jamais un second dossier créé', async () => {
      const { status, body } = await call(patientsC.create, {
        body: { nom: 'DédiéP2', prenom: 'Patient', date_naissance: '1990-05-01', sexe: 'F' },
        user: superadmin, ip: '127.0.0.1', headers: {},
      });
      assert.equal(status, 409);
      assert.equal(body.patient_id.toString(), created.patients[0].toString());
    });
  } finally {
    for (const id of created.users) await User.findByIdAndDelete(id);
    for (const id of created.patients) await Patient.findByIdAndDelete(id);
    await mongoose.disconnect();
  }
});
