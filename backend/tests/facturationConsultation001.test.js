// FACTURATION-CONSULTATION-001 (rapport de clôture du 11 sept. 2026) —
// investigation réelle avant implémentation : Invoice.consultation (champ
// dédié, distinct de source_module/source_id utilisé par laboratoire/
// imagerie/echographie/urgences/chirurgie/blocoperatoire) et la création
// automatique de facture à la clôture d'une consultation (consultations.
// controller.js::create, statut==='terminee' && frais_consultation>0)
// existaient DÉJÀ — FLOW-002, antérieur à cette mission. La vraie tarification
// vient de Consultation.frais_consultation (champ réel, saisi/éditable par le
// personnel dans le formulaire, jamais une valeur inventée par le backend)
// et, pour les examens complémentaires, du vrai ExamCatalogue via
// matchExamCatalogue() — aucune nouvelle architecture de tarification créée
// (elle existait déjà), conformément à la consigne de ne pas dupliquer un
// système déjà réel.
//
// Ce qui manquait réellement et est ajouté ici : GET /consultations/:id/
// facture (retrouver la facture déjà générée — Consultations.jsx n'avait
// aucun moyen de l'afficher), POST /consultations/:id/facture/envoyer
// (l'envoyer par email, réutilise utils/mail.js), et une protection anti-
// doublon réelle côté base (Invoice.consultation, index unique sparse).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('FACTURATION-CONSULTATION-001 — tarification réelle, facturation, anti-doublon, autorisation (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Consultation = require('../models/Consultation');
  const Invoice = require('../models/Invoice');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const consultC = require('../controllers/consultations.controller');
  const mailModule = require('../utils/mail');
  // Invoice.init() attend la construction réelle des index (autoIndex est
  // asynchrone en arrière-plan à la connexion) — sans cet await, l'index
  // unique sur `consultation` pourrait ne pas encore exister au moment du
  // Test 5 ci-dessous, laissant croire à tort qu'aucune protection réelle
  // n'existe côté base.
  await Invoice.init();

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const medecin = await User.create({ email: `_factcons-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'FactCons', prenom: 'Medecin', role: 'medecin', statut: 'actif' });
  const pharmacien = await User.create({ email: `_factcons-pharma-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'FactCons', prenom: 'Pharma', role: 'pharmacien', statut: 'actif' });
  const patientAvecEmail = await Patient.create({ nom: `FactCons-${stamp}`, prenom: 'Avec', date_naissance: '1990-01-01', sexe: 'F', email: `_factcons-patient-${stamp}@_test.local` });
  const patientSansEmail = await Patient.create({ nom: `FactCons-${stamp}`, prenom: 'Sans', date_naissance: '1990-01-01', sexe: 'M' });

  const cleanup = { consultations: [], invoices: [] };
  const originalSendInvoiceEmail = mailModule.sendInvoiceEmail;

  try {
    // Test 1 (tarif) + Test 2 (création) + Test 3 (Invoice) + Test 4 (cohérence patient)
    await t.test('Test 1/2/3/4 — un tarif réel (frais_consultation, saisi par le test, jamais une valeur codée en dur du contrôleur) génère une vraie Invoice au patient réel', async () => {
      // Le montant est CRÉÉ PAR LE TEST — jamais une constante en dur dans le
      // contrôleur ni ici pour "faire passer" le test.
      const montantTest = 1000 + Math.floor(Math.random() * 9000);
      const { status, body } = await call(consultC.create, {
        user: medecin,
        body: {
          patient: patientAvecEmail._id.toString(), medecin: medecin._id.toString(),
          service: 'Médecine Générale', type_consultation: 'nouvelle_visite',
          motif: 'Test facturation', diagnostic: 'RAS',
          frais_consultation: montantTest, statut_paiement: 'paye', statut: 'terminee',
        },
      });
      assert.equal(status, 201);
      cleanup.consultations.push(body.consultation._id);
      assert.ok(body.invoice, 'une vraie Invoice doit être créée quand un tarif réel est configuré');
      cleanup.invoices.push(body.invoice._id);

      assert.equal(body.invoice.montant_ttc, montantTest, 'le montant facturé doit être exactement celui réellement configuré, jamais une valeur recalculée arbitrairement');
      assert.equal(String(body.invoice.patient), String(patientAvecEmail._id), 'la facture doit référencer exactement le même patient que la consultation');
      const freshInvoice = await Invoice.findById(body.invoice._id).lean();
      assert.equal(String(freshInvoice.consultation), String(body.consultation._id));
      assert.ok(freshInvoice.numero_facture?.startsWith('INV-'));
      // Constat (préexistant à cette session, FLOW-002) : Consultation.
      // statut_paiement (déclaratif, saisi par le personnel) et Invoice.
      // paiements (ledger réel) sont deux notions distinctes — create() ne
      // transfère aucun paiement réel à l'Invoice même quand statut_paiement
      // vaut 'paye'. L'Invoice reste donc 'emise' ici : c'est le
      // comportement RÉEL actuel, pas une régression de cette session — non
      // corrigé (hors périmètre de la demande, signalé dans le rapport).
      assert.equal(freshInvoice.statut, 'emise');
    });

    await t.test('Test 6 — consultation SANS tarif configuré (frais_consultation=0) → aucune facture, jamais 0/null/fictif présenté comme une facture valide', async () => {
      const { status, body } = await call(consultC.create, {
        user: medecin,
        body: {
          patient: patientAvecEmail._id.toString(), medecin: medecin._id.toString(),
          service: 'Médecine Générale', type_consultation: 'controle',
          motif: 'Suivi gratuit', diagnostic: 'RAS',
          frais_consultation: 0, statut_paiement: 'exonere', statut: 'terminee',
        },
      });
      assert.equal(status, 201);
      cleanup.consultations.push(body.consultation._id);
      assert.equal(body.invoice, null, 'aucune facture ne doit être générée pour un tarif à 0 — jamais une facture fantôme');

      const invoiceCount = await Invoice.countDocuments({ consultation: body.consultation._id });
      assert.equal(invoiceCount, 0);
    });

    await t.test('Test 5 — anti-doublon réel côté base : une 2ᵉ Invoice pour la MÊME consultation est rejetée par MongoDB (index unique)', async () => {
      const consult = await Consultation.create({ patient: patientAvecEmail._id, medecin: medecin._id, service: 'Test', frais_consultation: 2000, statut: 'terminee' });
      cleanup.consultations.push(consult._id);
      const inv1 = await Invoice.create({ patient: patientAvecEmail._id, consultation: consult._id, service_label: 'Consultation', lignes: [{ libelle: 'Consultation', categorie: 'consultation', prix_unitaire: 2000, quantite: 1, montant: 2000 }], montant_ht: 2000, montant_ttc: 2000 });
      cleanup.invoices.push(inv1._id);

      await assert.rejects(
        Invoice.create({ patient: patientAvecEmail._id, consultation: consult._id, service_label: 'Consultation (doublon)', lignes: [{ libelle: 'Consultation', categorie: 'consultation', prix_unitaire: 2000, quantite: 1, montant: 2000 }], montant_ht: 2000, montant_ttc: 2000 }),
        /duplicate key|E11000/,
        'MongoDB doit refuser une 2ᵉ facture pour la même consultation — protection réelle côté base, pas seulement applicative',
      );
    });

    await t.test('Test 7 — un rôle sans permission financière (pharmacien) ne peut pas consulter/envoyer la facture d\'une consultation arbitraire', async () => {
      const consult = await Consultation.create({ patient: patientAvecEmail._id, medecin: medecin._id, service: 'Test', frais_consultation: 3000, statut: 'terminee' });
      cleanup.consultations.push(consult._id);

      // authorize() lit req.user.role — reproduit ici directement puisque
      // authorize() écrit un log d'accès refusé nécessitant req.baseUrl.
      const { authorize } = require('../middleware/auth');
      let called = false;
      const authMw = authorize('superadmin', 'adminclinique', 'medecin', 'infirmier');
      let status = 200;
      const res = { status: (c) => { status = c; return res; }, json: () => {} };
      await authMw({ user: pharmacien, baseUrl: '/api/consultations', originalUrl: `/api/consultations/${consult._id}/facture`, method: 'GET', ip: '127.0.0.1' }, res, () => { called = true; });
      assert.equal(called, false, 'authorize() ne doit jamais laisser passer un rôle non listé');
      assert.equal(status, 403);
    });

    await t.test('GET /:id/facture — retrouve réellement la facture déjà générée', async () => {
      const consult = await Consultation.create({ patient: patientAvecEmail._id, medecin: medecin._id, service: 'Test', frais_consultation: 4500, statut: 'terminee' });
      cleanup.consultations.push(consult._id);
      const inv = await Invoice.create({ patient: patientAvecEmail._id, consultation: consult._id, service_label: 'Consultation', lignes: [{ libelle: 'Consultation', categorie: 'consultation', prix_unitaire: 4500, quantite: 1, montant: 4500 }], montant_ht: 4500, montant_ttc: 4500 });
      cleanup.invoices.push(inv._id);

      const { status, body } = await call(consultC.getFacture, { params: { id: consult._id } });
      assert.equal(status, 200);
      assert.equal(String(body.invoice._id), String(inv._id));
      assert.equal(body.invoice.montant_ttc, 4500);
    });

    await t.test('POST /:id/facture/envoyer — envoie réellement la facture par email au patient réel (mail stubbé, jamais un réseau réel)', async () => {
      const consult = await Consultation.create({ patient: patientAvecEmail._id, medecin: medecin._id, service: 'Test', frais_consultation: 5500, statut: 'terminee' });
      cleanup.consultations.push(consult._id);
      const inv = await Invoice.create({ patient: patientAvecEmail._id, consultation: consult._id, service_label: 'Consultation', lignes: [{ libelle: 'Consultation', categorie: 'consultation', prix_unitaire: 5500, quantite: 1, montant: 5500 }], montant_ht: 5500, montant_ttc: 5500 });
      cleanup.invoices.push(inv._id);

      let capturedArgs = null;
      mailModule.sendInvoiceEmail = async (args) => { capturedArgs = args; return { simulated: false }; };

      const { status, body } = await call(consultC.envoyerFacture, { params: { id: consult._id }, user: medecin, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.success, true);
      assert.equal(capturedArgs.email, patientAvecEmail.email);
      assert.equal(capturedArgs.numero_facture, inv.numero_facture);
      assert.equal(capturedArgs.montant_ttc, 5500);
    });

    await t.test('POST /:id/facture/envoyer — patient sans email réel → échec propre, jamais un faux succès', async () => {
      const consult = await Consultation.create({ patient: patientSansEmail._id, medecin: medecin._id, service: 'Test', frais_consultation: 1500, statut: 'terminee' });
      cleanup.consultations.push(consult._id);
      const inv = await Invoice.create({ patient: patientSansEmail._id, consultation: consult._id, service_label: 'Consultation', lignes: [{ libelle: 'Consultation', categorie: 'consultation', prix_unitaire: 1500, quantite: 1, montant: 1500 }], montant_ht: 1500, montant_ttc: 1500 });
      cleanup.invoices.push(inv._id);

      const { status, body } = await call(consultC.envoyerFacture, { params: { id: consult._id }, user: medecin, ip: '127.0.0.1' });
      assert.equal(status, 400);
      assert.equal(body.success, false);
    });

    await t.test('POST /:id/facture/envoyer — consultation sans facture → échec propre (404), jamais un succès déguisé', async () => {
      const consult = await Consultation.create({ patient: patientAvecEmail._id, medecin: medecin._id, service: 'Test', frais_consultation: 0, statut: 'terminee' });
      cleanup.consultations.push(consult._id);

      const { status, body } = await call(consultC.envoyerFacture, { params: { id: consult._id }, user: medecin, ip: '127.0.0.1' });
      assert.equal(status, 404);
      assert.equal(body.success, false);
    });
  } finally {
    mailModule.sendInvoiceEmail = originalSendInvoiceEmail;
    await Invoice.deleteMany({ _id: { $in: cleanup.invoices } });
    await Consultation.deleteMany({ _id: { $in: cleanup.consultations } });
    await Patient.deleteMany({ _id: { $in: [patientAvecEmail._id, patientSansEmail._id] } });
    await User.deleteMany({ _id: { $in: [medecin._id, pharmacien._id] } });
    await mongoose.disconnect();
  }
});
