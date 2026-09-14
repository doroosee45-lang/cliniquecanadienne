// LAB-RADIO-SEARCH-001 (audit métier du 13 sept. 2026, Phase 4) —
// Laboratory.jsx/Radiology.jsx envoient déjà ?q=... depuis leur barre de
// recherche, mais laboratory.controller.js::getAll et radiology.controller
// .js::getAll ne lisaient jamais ce paramètre : la recherche était purement
// décorative, aucun résultat n'était jamais exclu quel que soit le texte
// saisi. Corrigé sur le même pattern que echographieController.js::getAll
// (déjà fonctionnel) : regex insensible à la casse sur les champs texte
// réels du schéma.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('LAB-RADIO-SEARCH-001 — laboratory.controller.js::getAll filtre réellement sur q (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  require('../models/User');
  const LabResult = require('../models/LabResult');
  const labC = require('../controllers/laboratory.controller');

  const stamp = Date.now();
  const cleanup = [];
  const call = async (query) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await labC.getAll({ query }, res, (err) => { if (err) throw err; });
    return { status, body };
  };
  const ids = (body) => body.results.map(r => String(r._id));

  try {
    const patient1 = await Patient.create({ nom: `T-LAB-Q1-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
    const patient2 = await Patient.create({ nom: `T-LAB-Q2-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F' });
    const rx1 = await LabResult.create({ patient: patient1._id, patient_nom: `Nzuzi-Alpha-${stamp}`, numero: `LAB-Q1-${stamp}`, medecin_prescripteur_nom: 'Dr Mvouama' });
    cleanup.push(() => LabResult.findByIdAndDelete(rx1._id));
    const rx2 = await LabResult.create({ patient: patient2._id, patient_nom: `Boukaka-Beta-${stamp}`, numero: `LAB-Q2-${stamp}`, medecin_prescripteur_nom: 'Dr Samba' });
    cleanup.push(() => LabResult.findByIdAndDelete(rx2._id));
    // Patients supprimés en dernier — LabResult les référence encore (hook
    // pre('findOneAndDelete') de Patient, DB-001).
    cleanup.push(() => Patient.findByIdAndDelete(patient1._id));
    cleanup.push(() => Patient.findByIdAndDelete(patient2._id));

    await t.test('q vide — aucun filtre appliqué, les deux résultats apparaissent', async () => {
      const { status, body } = await call({ q: '' });
      assert.equal(status, 200);
      assert.ok(ids(body).includes(String(rx1._id)));
      assert.ok(ids(body).includes(String(rx2._id)));
    });

    await t.test('q exact sur le nom patient — retrouve uniquement le bon document', async () => {
      const { status, body } = await call({ q: `Nzuzi-Alpha-${stamp}` });
      assert.equal(status, 200);
      assert.ok(ids(body).includes(String(rx1._id)), 'le document recherché doit apparaître');
      assert.ok(!ids(body).includes(String(rx2._id)), 'un document non correspondant ne doit pas apparaître');
    });

    await t.test('q partiel — retrouve le document par sous-chaîne', async () => {
      const { body } = await call({ q: 'Boukaka' });
      assert.ok(ids(body).includes(String(rx2._id)));
      assert.ok(!ids(body).includes(String(rx1._id)));
    });

    await t.test('q sur le numéro — retrouve le bon document', async () => {
      const { body } = await call({ q: `LAB-Q1-${stamp}` });
      assert.ok(ids(body).includes(String(rx1._id)));
    });

    await t.test('q sur le médecin prescripteur — retrouve le bon document', async () => {
      const { body } = await call({ q: 'Mvouama' });
      assert.ok(ids(body).includes(String(rx1._id)));
      assert.ok(!ids(body).includes(String(rx2._id)));
    });

    await t.test('q sans résultat — aucun des deux documents ne doit apparaître', async () => {
      const { status, body } = await call({ q: `AucuneCorrespondance-${stamp}` });
      assert.equal(status, 200);
      assert.ok(!ids(body).includes(String(rx1._id)));
      assert.ok(!ids(body).includes(String(rx2._id)));
    });

    await t.test('q avec caractères spéciaux regex — ne plante jamais, traité comme texte littéral', async () => {
      const { status } = await call({ q: '(test)[+*.?]' });
      assert.equal(status, 200, 'un caractère spécial regex ne doit jamais provoquer une 500');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});

test('LAB-RADIO-SEARCH-001 — radiology.controller.js::getAll filtre réellement sur q, y compris par nom d\'examen (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  require('../models/Patient');
  require('../models/User');
  const ImagingResult = require('../models/ImagingResult');
  const radioC = require('../controllers/radiology.controller');

  const stamp = Date.now();
  const cleanup = [];
  const call = async (query) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await radioC.getAll({ query }, res, (err) => { if (err) throw err; });
    return { status, body };
  };
  const ids = (body) => body.examens.map(r => String(r._id));

  try {
    const img1 = await ImagingResult.create({ patient_nom: `Loubaki-${stamp}`, numero: `RAD-Q1-${stamp}`, type_examen: `Échographie abdominale ${stamp}` });
    cleanup.push(() => ImagingResult.findByIdAndDelete(img1._id));
    const img2 = await ImagingResult.create({ patient_nom: `Malonga-${stamp}`, numero: `RAD-Q2-${stamp}`, type_examen: `Radiographie thorax ${stamp}` });
    cleanup.push(() => ImagingResult.findByIdAndDelete(img2._id));

    await t.test('q exact sur le nom patient — retrouve uniquement le bon document', async () => {
      const { body } = await call({ q: `Loubaki-${stamp}` });
      assert.ok(ids(body).includes(String(img1._id)));
      assert.ok(!ids(body).includes(String(img2._id)));
    });

    await t.test('q sur le type d\'examen (« Patient, examen... » annoncé par l\'UI) — retrouve le bon document', async () => {
      const { body } = await call({ q: `Radiographie thorax ${stamp}` });
      assert.ok(ids(body).includes(String(img2._id)));
      assert.ok(!ids(body).includes(String(img1._id)));
    });

    await t.test('q partiel sur le numéro — retrouve le bon document', async () => {
      const { body } = await call({ q: 'RAD-Q1' });
      assert.ok(ids(body).includes(String(img1._id)));
    });

    await t.test('q sans résultat — liste vide pour ces deux documents', async () => {
      const { status, body } = await call({ q: `AucuneCorrespondance-${stamp}` });
      assert.equal(status, 200);
      assert.ok(!ids(body).includes(String(img1._id)));
      assert.ok(!ids(body).includes(String(img2._id)));
    });

    await t.test('q avec caractères spéciaux regex — ne plante jamais', async () => {
      const { status } = await call({ q: '[abc)(+' });
      assert.equal(status, 200);
    });

    await t.test('non-régression — sans q, les deux documents apparaissent toujours (filtre statut/type_categorie inchangés)', async () => {
      const { status, body } = await call({});
      assert.equal(status, 200);
      assert.ok(ids(body).includes(String(img1._id)));
      assert.ok(ids(body).includes(String(img2._id)));
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
