// Correction 4 — pont Consultations::examens_complementaires ↔ Laboratoire/
// Radiology. Avant ce correctif, examens_complementaires était stocké en
// texte libre sur Consultation sans jamais créer de LabResult/ImagingResult
// réel — aucun pont vers les modules Laboratoire/Radiology, malgré le champ
// consultation déjà présent sur ces deux modèles depuis FLOW-003 (Correction
// 12). Ce test prouve : (1) un examen reconnu par la correspondance exacte
// curatée (utils/examLibelleVersCatalogue.js — même liste que la
// facturation Sous-phase 5.7) génère un vrai LabResult ou ImagingResult, lié
// à la vraie consultation ET au vrai patient ; (2) un examen en texte libre
// sans correspondance n'est jamais rattaché artificiellement — retourné
// honnêtement dans examens_non_pontes, aucun document fabriqué pour lui.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Correction 4 — clôture de consultation crée réellement LabResult/ImagingResult pour les examens reconnus', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const ExamCatalogue = require('../models/ExamCatalogue');
  const Consultation = require('../models/Consultation');
  const LabResult = require('../models/LabResult');
  const ImagingResult = require('../models/ImagingResult');
  const consultationsC = require('../controllers/consultations.controller');

  const stamp = Date.now();
  const created = { patients: [], users: [], catalogues: [], consultations: [], labResults: [], imagingResults: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const patient = await Patient.create({ nom: 'Test4', prenom: `Pont${stamp}`, sexe: 'F', date_naissance: '1990-01-01' });
    created.patients.push(patient._id);
    const medecin = await User.create({ email: `_correction4-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Medecin', prenom: 'Test4', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);

    // Catalogue réel dédié à ce test (nom, contenu, type) — mêmes libellés
    // cibles que la correspondance curatée réelle, pas de la seed data
    // partagée (isolation vis-à-vis de la base Atlas partagée).
    const catNFS = await ExamCatalogue.create({ nom: 'Numération Formule Sanguine', code: `NFS-T4-${stamp}`, type: 'laboratoire', prix: 5500, statut: 'actif' });
    const catRX = await ExamCatalogue.create({ nom: 'Radiographie thoracique', code: `RX-T4-${stamp}`, type: 'imagerie', prix: 15000, statut: 'actif' });
    created.catalogues.push(catNFS._id, catRX._id);

    let consultationId;

    await t.test('consultation clôturée avec 3 examens (2 reconnus, 1 texte libre sans correspondance) → LabResult + ImagingResult réels créés, le 3e honnêtement non ponté', async () => {
      const { status, body } = await call(consultationsC.create, {
        user: medecin, ip: '127.0.0.1',
        body: {
          patient: patient._id, medecin: medecin._id, service: 'Médecine générale', statut: 'terminee',
          examens_complementaires: [
            { type: 'biologie', libelle: 'NFS complète', priorite: 'urgent', note: 'Suspicion anémie' },
            { type: 'imagerie', libelle: 'Radiographie thorax', priorite: 'normal', note: 'Toux persistante' },
            { type: 'autre', libelle: 'Examen inventé sans correspondance catalogue', priorite: 'normal' },
          ],
        },
      });
      assert.equal(status, 201, JSON.stringify(body));
      consultationId = body.consultation._id;
      created.consultations.push(consultationId);

      assert.equal(body.lab_results.length, 1, 'un seul examen reconnu de type laboratoire');
      assert.equal(body.imaging_results.length, 1, 'un seul examen reconnu de type imagerie');
      assert.deepEqual(body.examens_non_pontes, ['Examen inventé sans correspondance catalogue']);
      created.labResults.push(...body.lab_results);
      created.imagingResults.push(...body.imaging_results);

      // Preuve la plus stricte : relecture indépendante en base (pas la
      // réponse HTTP qui pourrait mentir), vérifiant le vrai lien
      // consultation + patient + catalogue, pas un document orphelin.
      // Base Atlas réelle partagée entre sessions : la seed data réelle
      // (utils/seed.js) peut déjà contenir un ExamCatalogue de même nom que
      // celui créé ici pour ce test — ExamCatalogue.find() peut donc
      // légitimement faire correspondre l'un ou l'autre. Preuve stricte sur
      // ce qui compte réellement : le catalogue réellement rattaché a le
      // bon nom ET le bon type (laboratoire), pas nécessairement l'_id
      // exact de l'entrée créée par ce test.
      const lab = await LabResult.findById(body.lab_results[0]).lean();
      assert.ok(lab, 'le LabResult doit réellement exister en base');
      assert.equal(String(lab.consultation), String(consultationId));
      assert.equal(String(lab.patient), String(patient._id));
      assert.ok(lab.examen, 'doit référencer un vrai document ExamCatalogue');
      const catLab = await ExamCatalogue.findById(lab.examen).lean();
      assert.equal(catLab.type, 'laboratoire');
      assert.equal((catLab.nom || '').toLowerCase(), 'numération formule sanguine');
      assert.equal(lab.priorite, 'urgente');
      assert.equal(lab.statut, 'en_attente');

      const img = await ImagingResult.findById(body.imaging_results[0]).lean();
      assert.ok(img, "l'ImagingResult doit réellement exister en base");
      assert.equal(String(img.consultation), String(consultationId));
      assert.equal(String(img.patient), String(patient._id));
      assert.ok(img.examen, 'doit référencer un vrai document ExamCatalogue');
      const catImg = await ExamCatalogue.findById(img.examen).lean();
      assert.equal(catImg.type, 'imagerie');
      assert.equal((catImg.nom || '').toLowerCase(), 'radiographie thoracique');
      assert.equal(img.type_examen, 'Radiographie thorax');
      assert.equal(img.statut, 'programme');
    });

    await t.test('aucun LabResult/ImagingResult fantôme créé pour le texte libre sans correspondance', async () => {
      const orphanLab = await LabResult.findOne({ consultation: consultationId, commentaires: /inventé/ });
      const orphanImg = await ImagingResult.findOne({ consultation: consultationId, type_examen: /inventé/ });
      assert.equal(orphanLab, null);
      assert.equal(orphanImg, null);
      // Un seul de chaque a réellement été créé pour cette consultation —
      // pas un 3e document fabriqué pour combler le texte libre non reconnu.
      const totalLab = await LabResult.countDocuments({ consultation: consultationId });
      const totalImg = await ImagingResult.countDocuments({ consultation: consultationId });
      assert.equal(totalLab, 1);
      assert.equal(totalImg, 1);
    });

    await t.test('une consultation sans examens_complementaires ne crée rien (pas de régression du chemin sans examens)', async () => {
      const { status, body } = await call(consultationsC.create, {
        user: medecin, ip: '127.0.0.1',
        body: { patient: patient._id, medecin: medecin._id, service: 'Médecine générale', statut: 'terminee' },
      });
      assert.equal(status, 201);
      created.consultations.push(body.consultation._id);
      assert.deepEqual(body.lab_results, []);
      assert.deepEqual(body.imaging_results, []);
      assert.deepEqual(body.examens_non_pontes, []);
    });
  } finally {
    await LabResult.deleteMany({ _id: { $in: created.labResults } });
    await ImagingResult.deleteMany({ _id: { $in: created.imagingResults } });
    await Consultation.deleteMany({ _id: { $in: created.consultations } });
    await ExamCatalogue.deleteMany({ _id: { $in: created.catalogues } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await User.deleteMany({ _id: { $in: created.users } });
    await mongoose.disconnect();
  }
});
