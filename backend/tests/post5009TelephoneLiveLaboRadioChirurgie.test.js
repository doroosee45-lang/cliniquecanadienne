// POST5-009 (audit indépendant post-Phase 5, 14 sept. 2026) — MOYENNE.
// Même classe qu'ANOM-MAT-01 (maternityController.js, déjà corrigé en
// Phase 4) : LabResult.telephone / ImagingResult.telephone /
// DossierChirurgical.telephone sont des copies figées du téléphone du
// Patient, écrites une seule fois à la création et jamais resynchronisées.
// Un dossier laboratoire/imagerie/chirurgical peut rester ouvert des
// semaines voire des mois, largement assez pour qu'un patient change de
// numéro entre-temps sans que le personnel ne le voie jamais — numéro de
// contact obsolète affiché comme actuel en cas d'urgence.
//
// Ce test prouve que getAll()/getOne() (laboratoire, radiologie) et
// getDossierById() (chirurgie) renvoient désormais le téléphone LIVE du
// Patient lié quand il est disponible, jamais la copie figée seule à la
// création.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const call = async (fn, req) => {
  let status = 200, body = null;
  const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
  await fn(req, res, (err) => { if (err) throw err; });
  return { status, body };
};

test('POST5-009 — téléphone live du Patient préféré à la copie figée (laboratoire, radiologie, chirurgie) (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const LabResult = require('../models/LabResult');
  const ImagingResult = require('../models/ImagingResult');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const laboC = require('../controllers/laboratory.controller');
  const radioC = require('../controllers/radiology.controller');
  const chirC = require('../controllers/chirurgieController');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'Medecin' };
  const cleanup = [];
  const ANCIEN = '+242060000001';
  const NOUVEAU = '+242060000002';

  try {
    const patient = await Patient.create({
      nom: `P5009-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1990-01-01', telephone: ANCIEN,
    });
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));

    await t.test('laboratoire — LabResult.telephone figé à la création, getAll/getOne renvoient le téléphone live après changement du Patient', async () => {
      const lab = await LabResult.create({ patient: patient._id, patient_nom: 'Test P5009', telephone: ANCIEN, statut: 'prescrit' });
      cleanup.push(() => LabResult.findByIdAndDelete(lab._id));
      // Confirme la copie figée en base — c'est la racine du problème.
      assert.equal((await LabResult.findById(lab._id).lean()).telephone, ANCIEN);

      await Patient.findByIdAndUpdate(patient._id, { telephone: NOUVEAU });

      const rOne = await call(laboC.getOne, { params: { id: String(lab._id) } });
      assert.equal(rOne.status, 200, JSON.stringify(rOne.body));
      assert.equal(rOne.body.result.telephone, NOUVEAU, 'getOne doit renvoyer le téléphone live du Patient, jamais la copie figée');

      const rAll = await call(laboC.getAll, { query: { patient: String(patient._id) } });
      assert.equal(rAll.status, 200, JSON.stringify(rAll.body));
      const found = rAll.body.results.find(x => String(x._id) === String(lab._id));
      assert.ok(found, 'le résultat doit apparaître dans getAll');
      assert.equal(found.telephone, NOUVEAU, 'getAll doit aussi renvoyer le téléphone live');
      // Non-régression : patient reste un ID dans la liste (jamais un objet
      // peuplé exposé avec nom/prénom/etc.), même s'il sérialise en objet
      // ObjectId côté Mongoose .lean() plutôt qu'en string brute.
      assert.equal(String(found.patient), String(patient._id));
      assert.equal(found.patient.nom, undefined, 'patient ne doit jamais être exposé comme objet peuplé ici');
    });

    await t.test('radiologie — ImagingResult.telephone figé à la création, getAll/getOne renvoient le téléphone live après changement du Patient', async () => {
      const exam = await ImagingResult.create({ patient: patient._id, patient_nom: 'Test P5009', telephone: ANCIEN, statut: 'programme', type_examen: 'Radio thorax' });
      cleanup.push(() => ImagingResult.findByIdAndDelete(exam._id));
      assert.equal((await ImagingResult.findById(exam._id).lean()).telephone, ANCIEN);

      const rOne = await call(radioC.getOne, { params: { id: String(exam._id) } });
      assert.equal(rOne.status, 200, JSON.stringify(rOne.body));
      assert.equal(rOne.body.examen.telephone, NOUVEAU, 'getOne doit renvoyer le téléphone live du Patient, jamais la copie figée');

      const rAll = await call(radioC.getAll, { query: { patient: String(patient._id) } });
      assert.equal(rAll.status, 200, JSON.stringify(rAll.body));
      const found = rAll.body.examens.find(x => String(x._id) === String(exam._id));
      assert.ok(found, 'l\'examen doit apparaître dans getAll');
      assert.equal(found.telephone, NOUVEAU, 'getAll doit aussi renvoyer le téléphone live');
      assert.equal(String(found.patient), String(patient._id));
      assert.equal(found.patient.nom, undefined, 'patient ne doit jamais être exposé comme objet peuplé ici');
    });

    await t.test('chirurgie — DossierChirurgical.telephone figé à la création, getDossierById renvoie le téléphone live après changement du Patient', async () => {
      const numero = `CHIR-TEST-${stamp}`;
      const dossier = await DossierChirurgical.create({
        numero, patient: patient._id, patient_nom: 'Test P5009', telephone: ANCIEN, statut: 'consultation',
      });
      cleanup.push(() => DossierChirurgical.findByIdAndDelete(dossier._id));
      assert.equal((await DossierChirurgical.findById(dossier._id).lean()).telephone, ANCIEN);

      const r = await call(chirC.getDossierById, { params: { id: String(dossier._id) } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.dossier.telephone, NOUVEAU, 'getDossierById doit renvoyer le téléphone live du Patient, jamais la copie figée');
      // Non-régression : patient reste un simple ID (jamais un objet peuplé exposé).
      assert.equal(String(r.body.dossier.patient), String(patient._id));
    });

    await t.test('non-régression — sans Patient peuplé (patient_id non résolu), la copie figée reste affichée telle quelle, jamais vidée', async () => {
      const orphanId = new mongoose.Types.ObjectId();
      const lab = await LabResult.create({ patient: orphanId, patient_nom: 'Orphelin', telephone: ANCIEN, statut: 'prescrit' });
      cleanup.push(() => LabResult.findByIdAndDelete(lab._id));
      const r = await call(laboC.getOne, { params: { id: String(lab._id) } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.result.telephone, ANCIEN, 'sans Patient réel lié, la copie figée reste affichée — jamais vidée ni inventée');
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await mongoose.disconnect();
  }
});
