// Correction 2 — module 2/6 (relecture du 6 sept. 2026) — l'onglet
// "Facturation" de Radiology.jsx calculait un montant côté client depuis
// TARIFS, une grille tarifaire codée en dur — le même pattern déjà corrigé
// pour le Laboratoire (Correction 1/Correction 5, Phase précédente).
//
// Source de tarif réelle vérifiée avant d'en inventer une : ExamCatalogue
// (type:'imagerie'), déjà exposée par GET /radiology/catalogue et déjà
// réellement peuplée (utils/seed.js). Ce test crée ses propres entrées de
// catalogue (jamais les données de seed.js réelles) pour rester
// indépendant et reproductible.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Correction 2 (Radiology) — validation() génère une vraie Invoice depuis le vrai tarif ExamCatalogue, jamais un montant inventé', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const ImagingResult = require('../models/ImagingResult');
  const ExamCatalogue = require('../models/ExamCatalogue');
  const Invoice = require('../models/Invoice');
  const radioC = require('../controllers/radiology.controller');

  const stamp = Date.now();
  const created = { patients: [], users: [], examens: [], invoices: [], examens_catalogue: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const medecin = await User.create({ email: `_correction2-radio-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'Correction2', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);
    const radiologue = await User.create({ email: `_correction2-radio-rad-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Radio', prenom: 'Correction2', role: 'radiologue', statut: 'actif' });
    created.users.push(radiologue._id);

    const examRX = await ExamCatalogue.create({ code: `RX-C2-${stamp}`, nom: 'Radio Thorax Test Correction2', type: 'imagerie', prix: 16000, statut: 'actif' });
    created.examens_catalogue.push(examRX._id);

    await t.test('examen réel du catalogue, validé → vraie Invoice au montant exact', async () => {
      const patient = await Patient.create({ nom: `T-CORRECTION2-1-${stamp}`, prenom: 'P', date_naissance: '1988-02-02', sexe: 'M' });
      created.patients.push(patient._id);

      const { status: sCreate, body: bCreate } = await call(radioC.create, {
        body: { patient: patient._id.toString(), examen: examRX._id.toString(), type_categorie: 'radiologie', type_examen: examRX.nom, patient_nom: 'Test Correction2' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(sCreate, 201, JSON.stringify(bCreate));
      const examenId = bCreate.examen._id;
      created.examens.push(examenId);

      // SPEC-07 (correction du 12 sept. 2026) — validation() exige
      // désormais réellement que l'examen ait été réalisé (saveCR), jamais
      // une validation directe d'un examen encore programme.
      const sCR = await call(radioC.saveCR, { params: { id: examenId }, body: { compte_rendu: 'RAS' }, user: radiologue, ip: '127.0.0.1' });
      assert.equal(sCR.status, 200, JSON.stringify(sCR.body));

      const { status, body } = await call(radioC.validation, {
        params: { id: examenId }, body: { radiologue: radiologue._id.toString(), signature: 'sig-test' }, user: radiologue, ip: '127.0.0.1',
      });
      assert.equal(status, 200, JSON.stringify(body));
      assert.ok(body.invoice, 'la réponse doit inclure la facture générée automatiquement');
      created.invoices.push(body.invoice._id);

      const freshInvoice = await Invoice.findOne({ source_module: 'imagerie', source_id: examenId });
      assert.ok(freshInvoice, 'une Invoice doit exister en base, liée à cet examen');
      assert.equal(freshInvoice.montant_ttc, 16000, 'le montant doit être exactement le vrai tarif ExamCatalogue, jamais une valeur inventée');
      assert.equal(freshInvoice.lignes[0].libelle, 'Radio Thorax Test Correction2');

      const { body: bGet } = await call(radioC.getOne, { params: { id: examenId } });
      assert.equal(String(bGet.invoice._id), String(freshInvoice._id));
    });

    await t.test('LIMITE DOCUMENTÉE — examen en texte libre (pas de référence réelle au catalogue) → aucune facture inventée', async () => {
      const patient = await Patient.create({ nom: `T-CORRECTION2-2-${stamp}`, prenom: 'P', date_naissance: '1992-06-06', sexe: 'F' });
      created.patients.push(patient._id);

      const { status: sCreate, body: bCreate } = await call(radioC.create, {
        body: { patient: patient._id.toString(), type_categorie: 'scanner', type_examen: 'Scanner cérébral (texte libre, pas de vrai catalogue)', patient_nom: 'Test Correction2 Legacy' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(sCreate, 201);
      const examenId = bCreate.examen._id;
      created.examens.push(examenId);

      const sCR = await call(radioC.saveCR, { params: { id: examenId }, body: { compte_rendu: 'RAS' }, user: radiologue, ip: '127.0.0.1' });
      assert.equal(sCR.status, 200, JSON.stringify(sCR.body));

      const { status, body } = await call(radioC.validation, {
        params: { id: examenId }, body: { radiologue: radiologue._id.toString(), signature: 'sig-test' }, user: radiologue, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.equal(body.invoice, null, 'sans référence réelle au catalogue, aucune facture ne doit être fabriquée avec un tarif inventé');

      const freshInvoice = await Invoice.findOne({ source_module: 'imagerie', source_id: examenId });
      assert.equal(freshInvoice, null);
    });
  } finally {
    await Invoice.deleteMany({ _id: { $in: created.invoices } });
    await ImagingResult.deleteMany({ _id: { $in: created.examens } });
    await ExamCatalogue.deleteMany({ _id: { $in: created.examens_catalogue } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
