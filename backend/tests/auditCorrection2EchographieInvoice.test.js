// Correction 2 — module 3/6 (relecture du 6 sept. 2026) — l'onglet
// "Facturation" d'Echographie.jsx est un tableau de bord agrégé calculant un
// total depuis ACTES, une grille tarifaire codée en dur (15000/25000/35000/
// 50000 par catégorie), déconnectée du vrai catalogue et marquant toute
// demande réalisée/validée "✅ Payé" sans qu'aucune facture n'existe jamais
// réellement en base — même écart que Laboratoire/Radiology (Correction 1/2).
//
// Source de tarif réelle vérifiée avant d'en inventer une : ExamCatalogue
// (type:'imagerie'), déjà réellement peuplée avec des entrées d'échographie
// (utils/seed.js : Échographie abdominale/obstétricale/cardiaque). Ce test
// crée ses propres entrées de catalogue (jamais les données de seed.js
// réelles) pour rester indépendant et reproductible.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Correction 2 (Echographie) — saveRapport() génère une vraie Invoice depuis le vrai tarif ExamCatalogue, jamais un montant inventé', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Echographie = require('../models/Echographie');
  const ExamCatalogue = require('../models/ExamCatalogue');
  const Invoice = require('../models/Invoice');
  const echoC = require('../controllers/echographieController');

  const stamp = Date.now();
  const created = { patients: [], users: [], demandes: [], invoices: [], examens_catalogue: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const medecin = await User.create({ email: `_correction2-echo-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'Correction2', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);
    const radiologue = await User.create({ email: `_correction2-echo-rad-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Radio', prenom: 'Correction2', role: 'radiologue', statut: 'actif' });
    created.users.push(radiologue._id);

    const examECH = await ExamCatalogue.create({ code: `ECH-C2-${stamp}`, nom: `Échographie Test Correction2 ${stamp}`, type: 'imagerie', prix: 21000, statut: 'actif' });
    created.examens_catalogue.push(examECH._id);

    await t.test('demande référençant un vrai examen du catalogue, rapport validé → vraie Invoice au montant exact', async () => {
      const patient = await Patient.create({ nom: `T-CORRECTION2-ECHO-1-${stamp}`, prenom: 'P', date_naissance: '1988-02-02', sexe: 'F' });
      created.patients.push(patient._id);

      const { status: sCreate, body: bCreate } = await call(echoC.create, {
        body: { patient: patient._id.toString(), patient_nom: 'Test Correction2', examen: examECH._id.toString(), type: 'Abdominale', sous_type: 'Foie', motif: 'Test Correction2' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(sCreate, 201, JSON.stringify(bCreate));
      const demandeId = bCreate.demande._id;
      created.demandes.push(demandeId);

      const { status, body } = await call(echoC.saveRapport, {
        params: { id: demandeId },
        body: { rapport_texte: 'RAS', conclusion: 'Normal', recommandations: '', rapport_statut: 'valide' },
        user: radiologue, ip: '127.0.0.1',
      });
      assert.equal(status, 200, JSON.stringify(body));
      assert.ok(body.invoice, 'la réponse doit inclure la facture générée automatiquement');
      created.invoices.push(body.invoice._id);

      const freshInvoice = await Invoice.findOne({ source_module: 'echographie', source_id: demandeId });
      assert.ok(freshInvoice, 'une Invoice doit exister en base, liée à cette demande');
      assert.equal(freshInvoice.montant_ttc, 21000, 'le montant doit être exactement le vrai tarif ExamCatalogue, jamais une valeur inventée (pas 15000/25000/35000/50000 codés en dur)');
      assert.equal(freshInvoice.lignes[0].libelle, `Échographie Test Correction2 ${stamp}`);

      const { body: bGet } = await call(echoC.getOne, { params: { id: demandeId } });
      assert.equal(String(bGet.invoice._id), String(freshInvoice._id));

      const { body: bFactures } = await call(echoC.getFactures, {});
      assert.ok(bFactures.invoices.some(i => String(i._id) === String(freshInvoice._id)), 'GET /echographie/factures doit exposer cette vraie facture');
    });

    await t.test('LIMITE DOCUMENTÉE — demande en texte libre (pas de référence réelle au catalogue, ex: Doppler/Mammaire sans équivalent) → aucune facture inventée', async () => {
      const patient = await Patient.create({ nom: `T-CORRECTION2-ECHO-2-${stamp}`, prenom: 'P', date_naissance: '1992-06-06', sexe: 'M' });
      created.patients.push(patient._id);

      const { status: sCreate, body: bCreate } = await call(echoC.create, {
        body: { patient: patient._id.toString(), patient_nom: 'Test Correction2 Legacy', type: 'Doppler', sous_type: 'Artériel', motif: 'Doppler sans équivalent catalogue' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(sCreate, 201);
      const demandeId = bCreate.demande._id;
      created.demandes.push(demandeId);

      const { status, body } = await call(echoC.saveRapport, {
        params: { id: demandeId },
        body: { rapport_texte: 'RAS', conclusion: 'Normal', recommandations: '', rapport_statut: 'valide' },
        user: radiologue, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.equal(body.invoice, null, 'sans référence réelle au catalogue, aucune facture ne doit être fabriquée avec un tarif inventé');

      const freshInvoice = await Invoice.findOne({ source_module: 'echographie', source_id: demandeId });
      assert.equal(freshInvoice, null);
    });
  } finally {
    await Invoice.deleteMany({ _id: { $in: created.invoices } });
    await Echographie.deleteMany({ _id: { $in: created.demandes } });
    await ExamCatalogue.deleteMany({ _id: { $in: created.examens_catalogue } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
