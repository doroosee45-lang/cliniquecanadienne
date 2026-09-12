// SPEC-10 (correction du 12 sept. 2026, audit indépendant) —
// pediatrieController.js::create ne validait jamais patient_id (accepté
// fabriqué/orphelin, ou totalement absent), alors que Pediatrie.jsx exige
// déjà réellement un patient existant. Et Child n'avait aucun lien de
// retour direct vers le Newborn d'origine (seul Newborn.child_id existait,
// dans le sens inverse). Ce test prouve les deux corrections.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('SPEC-10 — Child.patient_id réellement validé à la création ; lien direct Child.newborn_id posé par createChildDossier', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Child = require('../models/Child');
  const Newborn = require('../models/Newborn');
  const pedC = require('../controllers/pediatrieController');
  const matC = require('../controllers/maternityController');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'User' };
  const created = { patients: [], children: [], newborns: [] };

  try {
    await t.test('patient_id absent est refusé (400), aucun dossier anonyme créé', async () => {
      const avant = await Child.countDocuments({});
      const { status } = await call(pedC.create, { user, ip: '127.0.0.1', body: { nom: 'Sans', prenom: 'Patient', date_naissance: '2020-01-01', sexe: 'M' } });
      assert.equal(status, 400);
      assert.equal(await Child.countDocuments({}), avant);
    });

    await t.test('patient_id fabriqué/orphelin est refusé (404)', async () => {
      const { status } = await call(pedC.create, { user, ip: '127.0.0.1', body: { patient_id: new mongoose.Types.ObjectId().toString(), nom: 'Fantome', date_naissance: '2020-01-01', sexe: 'M' } });
      assert.equal(status, 404);
    });

    await t.test('patient_id réel et existant est accepté et persisté', async () => {
      const patient = await Patient.create({ nom: `Spec10-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '2020-01-01' });
      created.patients.push(patient._id);
      const { status, body } = await call(pedC.create, { user, ip: '127.0.0.1', body: { patient_id: patient._id.toString(), nom: patient.nom, date_naissance: '2020-01-01', sexe: 'M' } });
      assert.equal(status, 201, JSON.stringify(body));
      created.children.push(body.enfant._id);
      const fresh = await Child.findById(body.enfant._id).lean();
      assert.equal(String(fresh.patient_id), String(patient._id));
    });

    await t.test('createChildDossier() pose désormais un lien direct Child.newborn_id vers le Newborn d\'origine', async () => {
      const nb = await Newborn.create({ prenom: 'BebeSpec10', sexe: 'F', poids: 3000, taille: 49 });
      created.newborns.push(nb._id);
      const { status, body } = await call(matC.createChildDossier, { params: { id: nb._id.toString() }, user, ip: '127.0.0.1' });
      assert.equal(status, 201, JSON.stringify(body));
      created.children.push(body.enfant._id);
      const fresh = await Child.findById(body.enfant._id).lean();
      assert.equal(String(fresh.newborn_id), String(nb._id), 'Child.newborn_id doit référencer réellement le Newborn d\'origine — lien direct, pas seulement une recherche inverse');
    });
  } finally {
    await Child.deleteMany({ _id: { $in: created.children } });
    await Newborn.deleteMany({ _id: { $in: created.newborns } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
