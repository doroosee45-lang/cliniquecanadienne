// Correction 2 — module 4/6 (relecture du 6 sept. 2026) — l'onglet
// "Facturation" d'Urgences.jsx calculait un montant entièrement inventé :
// tarifs fixes par catégorie d'acte (Consultation 20000, Triage 5000,
// Soins infirmiers 8000/soin, Médicaments 15000/prescription, Analyses
// 12000/examen, Imagerie 35000/examen) et un "payé = 60% du total", une
// formule totalement arbitraire — sans qu'aucune Invoice n'existe jamais en
// base. Pire que Laboratoire/Radiology/Echographie : ici aucune vraie
// source de tarif n'existait auparavant pour aucun des trois sous-types
// d'actes (soins/prescriptions/examens).
//
// Sources de tarif réelles vérifiées avant d'en inventer une :
// - examens (labo/imagerie) → ExamCatalogue (déjà réel, déjà utilisé par
//   Laboratory/Radiology/Echographie).
// - prescriptions de type medicament → Medication.prix_vente (catalogue
//   pharmacie réel, déjà peuplé).
// - soins infirmiers (soins[]) → AUCUNE source réelle n'existe dans ce
//   codebase pour les actes infirmiers d'urgence. Documenté ci-dessous,
//   jamais inventé : exclus de la facture réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Correction 2 (Urgences) — update() génère une vraie Invoice à la clôture de l\'épisode depuis les vrais tarifs ExamCatalogue/Medication, jamais des montants inventés', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Urgence = require('../models/Urgence');
  const ExamCatalogue = require('../models/ExamCatalogue');
  const Medication = require('../models/Medication');
  const Invoice = require('../models/Invoice');
  const urgC = require('../controllers/urgencesController');

  const stamp = Date.now();
  const created = { patients: [], users: [], urgences: [], invoices: [], catalogue: [], medicaments: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const medecin = await User.create({ email: `_correction2-urg-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'Correction2', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);

    const examLabo = await ExamCatalogue.create({ code: `LB-C2URG-${stamp}`, nom: 'Bilan Test Correction2 Urgences', type: 'laboratoire', prix: 9000, statut: 'actif' });
    created.catalogue.push(examLabo._id);
    const med = await Medication.create({ nom_commercial: `Medicament Test Correction2 ${stamp}`, prix_vente: 4500, statut: 'disponible' });
    created.medicaments.push(med._id);

    await t.test('épisode avec examen + médicament réels du catalogue, clôturé (sortie) → vraie Invoice au montant exact, soins exclus', async () => {
      const patient = await Patient.create({ nom: `T-CORRECTION2-URG-1-${stamp}`, prenom: 'P', date_naissance: '1980-01-01', sexe: 'M' });
      created.patients.push(patient._id);

      const { status: sCreate, body: bCreate } = await call(urgC.create, {
        body: { patient: patient._id.toString(), patient_nom: 'Test Correction2 Urgences', motif: 'Douleur test', niveau_triage: 'orange' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(sCreate, 201, JSON.stringify(bCreate));
      const urgenceId = bCreate.urgence._id;
      created.urgences.push(urgenceId);

      await call(urgC.addExamen, { params: { id: urgenceId }, body: { type: 'labo', designation: examLabo.nom, examen: examLabo._id.toString() }, user: medecin, ip: '127.0.0.1' });
      await call(urgC.addPrescription, { params: { id: urgenceId }, body: { type: 'medicament', designation: med.nom_commercial, medicament: med._id.toString() }, user: medecin, ip: '127.0.0.1' });
      // Soin infirmier — aucun catalogue réel équivalent, ne doit jamais apparaître dans la facture.
      await call(urgC.addSoin, { params: { id: urgenceId }, body: { acte: 'Pansement test', personnel: 'Infirmier Test' }, user: medecin, ip: '127.0.0.1' });

      const { status, body } = await call(urgC.update, {
        params: { id: urgenceId }, body: { statut: 'sorti', decision: 'retour_domicile' }, user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 200, JSON.stringify(body));
      assert.ok(body.invoice, 'la réponse doit inclure la facture générée automatiquement');
      created.invoices.push(body.invoice._id);

      const freshInvoice = await Invoice.findOne({ source_module: 'urgences', source_id: urgenceId });
      assert.ok(freshInvoice, 'une Invoice doit exister en base, liée à ce dossier urgences');
      assert.equal(freshInvoice.montant_ttc, 13500, 'le montant doit être exactement 9000 (examen réel) + 4500 (médicament réel) = 13500, jamais les tarifs inventés (20000/5000/8000/15000/12000/35000) ni la formule "60% payé"');
      const libelles = freshInvoice.lignes.map(l => l.libelle);
      assert.ok(libelles.includes('Bilan Test Correction2 Urgences'));
      assert.ok(libelles.includes(med.nom_commercial));
      assert.ok(!libelles.some(l => /Pansement/i.test(l)), 'le soin infirmier ne doit jamais apparaître dans la facture (aucun tarif réel disponible)');

      const { body: bGet } = await call(urgC.getOne, { params: { id: urgenceId } });
      assert.equal(String(bGet.invoice._id), String(freshInvoice._id));
    });

    await t.test('LIMITE DOCUMENTÉE — épisode avec seulement des soins infirmiers (aucun examen/médicament réel) → aucune facture inventée', async () => {
      const patient = await Patient.create({ nom: `T-CORRECTION2-URG-2-${stamp}`, prenom: 'P', date_naissance: '1975-05-05', sexe: 'F' });
      created.patients.push(patient._id);

      const { status: sCreate, body: bCreate } = await call(urgC.create, {
        body: { patient: patient._id.toString(), patient_nom: 'Test Correction2 Urgences Legacy', motif: 'Contrôle test', niveau_triage: 'vert' },
        user: medecin, ip: '127.0.0.1',
      });
      assert.equal(sCreate, 201);
      const urgenceId = bCreate.urgence._id;
      created.urgences.push(urgenceId);

      await call(urgC.addSoin, { params: { id: urgenceId }, body: { acte: 'Surveillance test', personnel: 'Infirmier Test' }, user: medecin, ip: '127.0.0.1' });
      // Prescription en texte libre, sans référence réelle au catalogue Medication.
      await call(urgC.addPrescription, { params: { id: urgenceId }, body: { type: 'medicament', designation: 'Médicament en texte libre (legacy)' }, user: medecin, ip: '127.0.0.1' });

      const { status, body } = await call(urgC.update, {
        params: { id: urgenceId }, body: { statut: 'sorti', decision: 'retour_domicile' }, user: medecin, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      assert.equal(body.invoice, null, 'sans aucun examen/médicament référençant réellement le catalogue, aucune facture ne doit être fabriquée');

      const freshInvoice = await Invoice.findOne({ source_module: 'urgences', source_id: urgenceId });
      assert.equal(freshInvoice, null);
    });

    await t.test('LIMITE DOCUMENTÉE — transition vers "hospitalise" → aucune facture Urgences (déjà facturé par Hospitalization)', async () => {
      const patient = await Patient.create({ nom: `T-CORRECTION2-URG-3-${stamp}`, prenom: 'P', date_naissance: '1965-03-03', sexe: 'M' });
      created.patients.push(patient._id);

      const { body: bCreate } = await call(urgC.create, {
        body: { patient: patient._id.toString(), patient_nom: 'Test Correction2 Urgences Hosp', motif: 'Grave test', niveau_triage: 'rouge' },
        user: medecin, ip: '127.0.0.1',
      });
      const urgenceId = bCreate.urgence._id;
      created.urgences.push(urgenceId);

      await call(urgC.addExamen, { params: { id: urgenceId }, body: { type: 'labo', designation: examLabo.nom, examen: examLabo._id.toString() }, user: medecin, ip: '127.0.0.1' });

      const { body } = await call(urgC.update, {
        params: { id: urgenceId }, body: { statut: 'hospitalise', decision: 'hospitalisation' }, user: medecin, ip: '127.0.0.1',
      });
      assert.equal(body.invoice, null, 'hospitalise ne doit jamais générer de facture Urgences — la facturation continue sous Hospitalization');
      const freshInvoice = await Invoice.findOne({ source_module: 'urgences', source_id: urgenceId });
      assert.equal(freshInvoice, null);
    });
  } finally {
    await Invoice.deleteMany({ _id: { $in: created.invoices } });
    await Urgence.deleteMany({ _id: { $in: created.urgences } });
    await ExamCatalogue.deleteMany({ _id: { $in: created.catalogue } });
    await Medication.deleteMany({ _id: { $in: created.medicaments } });
    await User.deleteMany({ _id: { $in: created.users } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
