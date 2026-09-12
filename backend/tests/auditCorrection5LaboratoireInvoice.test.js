// Correction 5 — module 1/6 (relecture du 5 sept. 2026) — l'onglet
// "Facturation" de Laboratory.jsx calculait un montant côté client depuis un
// catalogue d'examens codé en dur (tarifs fixes arbitraires), sans lien réel
// avec le module Finance — le pattern déjà dénoncé par l'audit pour
// Consultations/Hospitalisation (FLOW-002, Phase 0).
//
// Source de tarif réelle vérifiée avant d'en inventer une : ExamCatalogue
// (déjà réel, déjà exposé par GET /laboratory/catalogue, déjà peuplé par
// utils/seed.js). Ce test crée ses propres entrées de catalogue (jamais les
// données de seed.js réelles) pour rester indépendant et reproductible.
//
// Chaque assertion relit une VRAIE entrée en base (Invoice.findOne après
// l'action), jamais l'objet en mémoire renvoyé par le contrôleur.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Correction 5 (Laboratoire) — validate() génère une vraie Invoice depuis le vrai tarif ExamCatalogue, jamais un montant inventé', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const LabResult = require('../models/LabResult');
  const ExamCatalogue = require('../models/ExamCatalogue');
  const Invoice = require('../models/Invoice');
  const labC = require('../controllers/laboratory.controller');

  const stamp = Date.now();
  const created = { patients: [], users: [], labresults: [], invoices: [], examens: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const medecin = await User.create({ email: `_correction5-lab-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'Correction5', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);
    const laborantin = await User.create({ email: `_correction5-lab-tech-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Labo', prenom: 'Correction5', role: 'laborantin', statut: 'actif' });
    created.users.push(laborantin._id);

    const examNFS = await ExamCatalogue.create({ code: `NFS-C5-${stamp}`, nom: 'NFS Test Correction5', type: 'laboratoire', prix: 5500, statut: 'actif' });
    created.examens.push(examNFS._id);
    const examGLYC = await ExamCatalogue.create({ code: `GLYC-C5-${stamp}`, nom: 'Glycémie Test Correction5', type: 'laboratoire', prix: 3500, statut: 'actif' });
    created.examens.push(examGLYC._id);

    await t.test('analyse avec de vrais examens du catalogue, validée → vraie Invoice au montant exact (somme des vrais tarifs)', async () => {
      const patient = await Patient.create({ nom: `T-CORRECTION5-1-${stamp}`, prenom: 'P', date_naissance: '1985-05-05', sexe: 'F' });
      created.patients.push(patient._id);

      const { status: sCreate, body: bCreate } = await call(labC.create, {
        body: { patient: patient._id.toString(), examens_demandes: [examNFS._id.toString(), examGLYC._id.toString()], patient_nom: 'Test Correction5' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(sCreate, 201, JSON.stringify(bCreate));
      const labId = bCreate.result._id;
      created.labresults.push(labId);

      // SPEC-07 (correction du 12 sept. 2026) — validate() exige désormais
      // réellement statut:'termine' (résultats saisis), jamais une
      // validation directe d'une analyse encore en_attente.
      const sSaisie = await call(labC.saisirResultats, { params: { id: labId }, body: { resultats: { nfs: 'normal' } }, user: laborantin, ip: '127.0.0.1' });
      assert.equal(sSaisie.status, 200, JSON.stringify(sSaisie.body));

      const { status, body } = await call(labC.validate, {
        params: { id: labId }, body: { resultats: { nfs: 'normal' }, est_critique: false }, user: laborantin, ip: '127.0.0.1',
      });
      assert.equal(status, 200, JSON.stringify(body));
      assert.ok(body.invoice, 'la réponse doit inclure la facture générée automatiquement');
      created.invoices.push(body.invoice._id);

      const attendu = 5500 + 3500;
      const freshInvoice = await Invoice.findOne({ source_module: 'laboratoire', source_id: labId });
      assert.ok(freshInvoice, 'une Invoice doit exister en base, liée à cette analyse');
      assert.equal(freshInvoice.montant_ttc, attendu, 'le montant doit être exactement la somme des vrais tarifs ExamCatalogue, jamais une valeur inventée');
      assert.equal(freshInvoice.lignes.length, 2);
      assert.ok(freshInvoice.lignes.some(l => l.libelle === 'NFS Test Correction5' && l.montant === 5500));
      assert.ok(freshInvoice.lignes.some(l => l.libelle === 'Glycémie Test Correction5' && l.montant === 3500));

      // GET /laboratory/:id doit aussi renvoyer cette même vraie facture
      const { body: bGet } = await call(labC.getOne, { params: { id: labId } });
      assert.equal(String(bGet.invoice._id), String(freshInvoice._id));
    });

    await t.test('LIMITE DOCUMENTÉE — examens_demandes sans ObjectId réel (texte libre / ancien format) → aucune facture inventée', async () => {
      const patient = await Patient.create({ nom: `T-CORRECTION5-2-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      created.patients.push(patient._id);

      const { status: sCreate, body: bCreate } = await call(labC.create, {
        body: { patient: patient._id.toString(), examens_demandes: ['nfs', 'glycemie'], patient_nom: 'Test Correction5 Legacy' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(sCreate, 201);
      const labId = bCreate.result._id;
      created.labresults.push(labId);

      const sSaisie = await call(labC.saisirResultats, { params: { id: labId }, body: { resultats: {} }, user: laborantin, ip: '127.0.0.1' });
      assert.equal(sSaisie.status, 200, JSON.stringify(sSaisie.body));

      const { status, body } = await call(labC.validate, {
        params: { id: labId }, body: { resultats: {}, est_critique: false }, user: laborantin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.equal(body.invoice, null, 'sans référence réelle au catalogue, aucune facture ne doit être fabriquée avec un tarif inventé');

      const freshInvoice = await Invoice.findOne({ source_module: 'laboratoire', source_id: labId });
      assert.equal(freshInvoice, null);
    });
  } finally {
    await Invoice.deleteMany({ _id: { $in: created.invoices } });
    await LabResult.deleteMany({ _id: { $in: created.labresults } });
    await ExamCatalogue.deleteMany({ _id: { $in: created.examens } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
