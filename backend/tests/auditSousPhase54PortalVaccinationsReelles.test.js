// Sous-phase 5.4 (relecture du 6 sept. 2026) — Portal.jsx affichait "Mon
// Carnet Vaccinal" à partir de VACCINS, une constante 100% statique (4
// vaccins et dates entièrement inventés — Grippe saisonnière, COVID-19,
// Tétanos, Hépatite B "en retard"), identique pour absolument tout patient
// connecté, quelle que soit sa réalité clinique.
//
// Seule source réelle de vaccination dans ce système : Child.vaccinations[]
// (module Pédiatrie — vaccin/date/rappel_prevu réels). Un patient adulte
// sans dossier pédiatrique lié n'a réellement aucune vaccination enregistrée
// : portal.controller.js::getVaccinations doit alors renvoyer un tableau
// vide, jamais une simulation.
//
// Preuve avec 2 patients ayant un dossier pédiatrique réel distinct (chacun
// doit voir SES propres vaccinations, pas les mêmes valeurs fixes pour tout
// le monde) + 1 patient sans dossier pédiatrique (état vide honnête).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Sous-phase 5.4 (Portal) — vaccinations réelles, différentes selon le patient', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Child = require('../models/Child');
  const portalC = require('../controllers/portal.controller');

  const stamp = Date.now();
  const created = { patients: [], users: [], children: [] };

  const call = async (user) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await portalC.getVaccinations({ user }, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    // Patient A : dossier pédiatrique réel avec 2 vaccinations réelles.
    const patientA = await Patient.create({ nom: `T54A-${stamp}`, prenom: 'P', date_naissance: '2018-01-01', sexe: 'M' });
    created.patients.push(patientA._id);
    const userA = await User.create({ email: `_54portal-userA-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'UserA', prenom: 'P', role: 'patient', statut: 'actif', patient_id: patientA._id });
    created.users.push(userA._id);
    const childA = await Child.create({
      nom: `T54A-${stamp}`, prenom: 'P', date_naissance: '2018-01-01', sexe: 'M', patient_id: patientA._id,
      vaccinations: [
        { vaccin: 'BCG Test54', date: new Date('2018-02-01'), rappel_prevu: null },
        { vaccin: 'DTC Test54', date: new Date('2018-04-01'), rappel_prevu: new Date('2020-01-01') }, // rappel passé -> en retard
      ],
    });
    created.children.push(childA._id);

    // Patient B : dossier pédiatrique réel distinct, une seule vaccination à jour.
    const patientB = await Patient.create({ nom: `T54B-${stamp}`, prenom: 'P', date_naissance: '2019-05-05', sexe: 'F' });
    created.patients.push(patientB._id);
    const userB = await User.create({ email: `_54portal-userB-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'UserB', prenom: 'P', role: 'patient', statut: 'actif', patient_id: patientB._id });
    created.users.push(userB._id);
    const childB = await Child.create({
      nom: `T54B-${stamp}`, prenom: 'P', date_naissance: '2019-05-05', sexe: 'F', patient_id: patientB._id,
      vaccinations: [
        { vaccin: 'ROR Test54', date: new Date('2019-08-01'), rappel_prevu: new Date('2035-01-01') }, // rappel futur -> à jour
      ],
    });
    created.children.push(childB._id);

    // Patient C : aucun dossier pédiatrique lié.
    const patientC = await Patient.create({ nom: `T54C-${stamp}`, prenom: 'P', date_naissance: '1975-03-03', sexe: 'M' });
    created.patients.push(patientC._id);
    const userC = await User.create({ email: `_54portal-userC-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'UserC', prenom: 'P', role: 'patient', statut: 'actif', patient_id: patientC._id });
    created.users.push(userC._id);

    await t.test('Patient A — 2 vraies vaccinations, jamais les 4 vaccins fictifs (Grippe/COVID/Tétanos/Hépatite B)', async () => {
      const { status, body } = await call(userA);
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.vaccinations.length, 2);
      const noms = body.vaccinations.map(v => v.vaccin);
      assert.ok(noms.includes('BCG Test54') && noms.includes('DTC Test54'));
      assert.ok(!noms.some(n => ['Grippe saisonnière', 'COVID-19 (rappel)', 'Tétanos (DTP)', 'Hépatite B'].includes(n)), 'ne doit jamais renvoyer les vaccins fictifs codés en dur côté frontend');
    });

    await t.test('Patient B — vaccinations réellement différentes de celles du Patient A', async () => {
      const { status, body } = await call(userB);
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.vaccinations.length, 1);
      assert.equal(body.vaccinations[0].vaccin, 'ROR Test54');
    });

    await t.test('Patient C — aucun dossier pédiatrique lié -> tableau vide honnête, jamais une simulation', async () => {
      const { status, body } = await call(userC);
      assert.equal(status, 200, JSON.stringify(body));
      assert.deepEqual(body.vaccinations, []);
    });
  } finally {
    await Child.deleteMany({ _id: { $in: created.children } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
