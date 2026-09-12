// PORTAL-DOSSIER-001 (audit du 12 sept. 2026, mission "Compléter Mon dossier
// du portail patient") — Consultation/Hospitalization/Document existent et
// sont réellement alimentés côté personnel, mais "Mon dossier" (Portal.jsx)
// n'exposait ni historique de consultations, ni hospitalisations, ni
// documents : aucun endpoint du portail patient ne les servait. Ce test
// couvre le fonctionnement réel (les bonnes données du bon patient) et
// surtout la règle de sécurité obligatoire : un patient A ne doit jamais
// pouvoir lire ou télécharger les consultations/hospitalisations/documents
// d'un patient B, même en devinant un identifiant réel.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

test('Mon dossier — consultations/hospitalisations/documents réels, scoping strict par patient', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Consultation = require('../models/Consultation');
  const Hospitalization = require('../models/Hospitalization');
  const DocumentModel = require('../models/Document');
  const portalC = require('../controllers/portal.controller');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null, downloaded = null;
    const res = {
      status: (c) => { status = c; return res; },
      json: (d) => { body = d; return res; },
      download: (p, name) => { downloaded = { path: p, name }; },
    };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body, downloaded };
  };

  const patientA = await Patient.create({ nom: `DossierA-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1990-01-01' });
  const patientB = await Patient.create({ nom: `DossierB-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1985-05-05' });
  const userA = await User.create({ email: `_dossier-a-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'A', prenom: 'Patient', role: 'patient', statut: 'actif', patient_id: patientA._id });
  const userB = await User.create({ email: `_dossier-b-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'B', prenom: 'Patient', role: 'patient', statut: 'actif', patient_id: patientB._id });
  const medecin = await User.create({ email: `_dossier-medecin-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'Test', role: 'medecin', statut: 'actif' });

  const consultA = await Consultation.create({ patient: patientA._id, medecin: medecin._id, diagnostic: `Diagnostic A ${stamp}`, anamnese: 'Anamnèse A', statut: 'terminee' });
  const consultB = await Consultation.create({ patient: patientB._id, medecin: medecin._id, diagnostic: `Diagnostic B ${stamp}`, statut: 'terminee' });

  const hospA = await Hospitalization.create({ patient: patientA._id, motif_entree: `Motif A ${stamp}`, medecin_responsable: medecin._id });
  const hospB = await Hospitalization.create({ patient: patientB._id, motif_entree: `Motif B ${stamp}`, medecin_responsable: medecin._id });

  const uploadsRoot = path.join(__dirname, '..', 'uploads');
  const docsDir = path.join(uploadsRoot, 'documents');
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
  const realFilename = `_dossier-test-${stamp}.txt`;
  const realFilePath = path.join(docsDir, realFilename);
  fs.writeFileSync(realFilePath, 'contenu réel du document de test');

  const docA = await DocumentModel.create({ nom: 'Certificat A.txt', type: 'certificat', fichier_path: `/uploads/documents/${realFilename}`, patient: patientA._id, created_by: medecin._id });
  const docB = await DocumentModel.create({ nom: 'Certificat B.txt', type: 'certificat', fichier_path: `/uploads/documents/${realFilename}`, patient: patientB._id, created_by: medecin._id });
  const docSansFichier = await DocumentModel.create({ nom: 'Doc orphelin.txt', type: 'autre', patient: patientA._id, created_by: medecin._id });

  try {
    await t.test('getConsultations — uniquement les consultations du patient connecté', async () => {
      const { status, body } = await call(portalC.getConsultations, { user: userA });
      assert.equal(status, 200, JSON.stringify(body));
      assert.ok(body.consultations.some(c => String(c._id) === String(consultA._id)));
      assert.ok(!body.consultations.some(c => String(c._id) === String(consultB._id)), 'la consultation de B ne doit jamais apparaître dans la liste de A');
    });

    await t.test('getHospitalizations — uniquement les hospitalisations du patient connecté', async () => {
      const { status, body } = await call(portalC.getHospitalizations, { user: userA });
      assert.equal(status, 200, JSON.stringify(body));
      assert.ok(body.hospitalizations.some(h => String(h._id) === String(hospA._id)));
      assert.ok(!body.hospitalizations.some(h => String(h._id) === String(hospB._id)), 'l\'hospitalisation de B ne doit jamais apparaître dans la liste de A');
    });

    await t.test('getDocuments — uniquement les documents du patient connecté, sans fichier_path/hash exposés', async () => {
      const { status, body } = await call(portalC.getDocuments, { user: userA });
      assert.equal(status, 200, JSON.stringify(body));
      assert.ok(body.documents.some(d => String(d._id) === String(docA._id)));
      assert.ok(!body.documents.some(d => String(d._id) === String(docB._id)), 'le document de B ne doit jamais apparaître dans la liste de A');
      const found = body.documents.find(d => String(d._id) === String(docA._id));
      assert.equal(found.fichier_path, undefined, 'le chemin de stockage interne ne doit jamais être exposé au frontend');
    });

    await t.test('downloadDocument — téléchargement réel du propre document, avec le vrai fichier sur disque', async () => {
      const { status, downloaded } = await call(portalC.downloadDocument, { user: userA, ip: '127.0.0.1', params: { id: docA._id } });
      assert.equal(status, 200);
      assert.ok(downloaded, 'res.download doit être appelé pour un document réellement possédé par le patient');
      assert.equal(downloaded.path, path.resolve(realFilePath));
      assert.equal(downloaded.name, 'Certificat A.txt');
    });

    await t.test('SÉCURITÉ CRITIQUE — patient A ne peut pas télécharger le document de patient B (403, jamais de fichier servi)', async () => {
      const { status, body, downloaded } = await call(portalC.downloadDocument, { user: userA, ip: '127.0.0.1', params: { id: docB._id } });
      assert.equal(status, 403, JSON.stringify(body));
      assert.equal(downloaded, null, 'le fichier de B ne doit jamais être servi à A');
    });

    await t.test('SÉCURITÉ — patient A ne peut pas lister/télécharger via un ID de consultation/hospitalisation inexistant ou d\'un autre patient', async () => {
      const { status: sC } = await call(portalC.downloadDocument, { user: userA, ip: '127.0.0.1', params: { id: '000000000000000000000000' } });
      assert.equal(sC, 404);
    });

    await t.test('document sans fichier réel associé → 404 honnête, jamais un fichier simulé', async () => {
      const { status, downloaded } = await call(portalC.downloadDocument, { user: userA, ip: '127.0.0.1', params: { id: docSansFichier._id } });
      assert.equal(status, 404);
      assert.equal(downloaded, null);
    });

    await t.test('ID invalide (pas un ObjectId) → 400', async () => {
      const { status } = await call(portalC.downloadDocument, { user: userA, ip: '127.0.0.1', params: { id: 'not-an-id' } });
      assert.equal(status, 400);
    });
  } finally {
    if (fs.existsSync(realFilePath)) fs.unlinkSync(realFilePath);
    await Consultation.deleteMany({ _id: { $in: [consultA._id, consultB._id] } });
    await Hospitalization.deleteMany({ _id: { $in: [hospA._id, hospB._id] } });
    await DocumentModel.deleteMany({ _id: { $in: [docA._id, docB._id, docSansFichier._id] } });
    await User.deleteMany({ _id: { $in: [userA._id, userB._id, medecin._id] } });
    await Patient.deleteMany({ _id: { $in: [patientA._id, patientB._id] } });
    await mongoose.disconnect();
  }
});
