// POST5-002 (audit indépendant post-Phase 5, 14 sept. 2026) — CRITIQUE,
// reproduit en direct pendant l'audit. laboratory.controller.js::validate,
// radiology.controller.js::validation et echographieController.js::
// saveRapport lisaient le statut courant (`avant`), le vérifiaient en
// mémoire JS, puis écrivaient sans aucun filtre atomique sur ce même
// statut avant de générer une Invoice — deux requêtes concurrentes (double-
// clic, retry réseau, deux membres du personnel en même temps) passaient
// toutes deux le contrôle avant qu'aucune écriture n'ait abouti, chacune
// générant sa propre facture pour le même acte.
//
// Correctif : filtre de garde `statut` sur l'écriture elle-même
// (findOneAndUpdate), même principe que pharmacy.controller.js::dispenser
// et hospitalization.controller.js::discharge (déjà protégés). Ce test
// prouve, contre un vrai serveur isolé et une vraie base MongoDB, que sur 2
// requêtes HTTP réellement concurrentes, exactement une réussit et
// exactement une Invoice est créée — pour les 3 modules concernés.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const PASSWORD = 'Post5002TestPass1!';
const FETCH_TIMEOUT_MS = 10000;
const withTimeout = (opts) => ({ ...opts, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

async function login(baseUrl, email) {
  const res = await fetch(`${baseUrl}/auth/login`, withTimeout({
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  }));
  if (res.status !== 200) throw new Error(`login ${email} a échoué (${res.status})`);
  return (res.headers.get('set-cookie') || '').split(';')[0];
}

test('POST5-002 — deux validations concurrentes du même acte ne produisent jamais deux factures (serveur isolé, vraies requêtes HTTP concurrentes, base réelle)', { skip: !mongodExists() && 'mongod introuvable — infrastructure de serveur isolé indisponible' }, async (t) => {
  let server = null;
  let connected = false;
  const created = { users: [], patients: [], catalogue: [], labresults: [], imagingresults: [], echographies: [] };

  try {
    server = await startIsolatedServer();
    await mongoose.connect(server.mongoUri);
    connected = true;
    const User = require('../models/User');
    const Patient = require('../models/Patient');
    const ExamCatalogue = require('../models/ExamCatalogue');
    const LabResult = require('../models/LabResult');
    const ImagingResult = require('../models/ImagingResult');
    const Echographie = require('../models/Echographie');
    const Invoice = require('../models/Invoice');

    const stamp = Date.now();
    const laborantin = await User.create({ email: `_p5002-labo-${stamp}@_test.local`, password: PASSWORD, nom: 'T', prenom: 'Labo', role: 'laborantin', statut: 'actif' });
    created.users.push(laborantin._id);
    const radiologue = await User.create({ email: `_p5002-radio-${stamp}@_test.local`, password: PASSWORD, nom: 'T', prenom: 'Radio', role: 'radiologue', statut: 'actif' });
    created.users.push(radiologue._id);
    const patient = await Patient.create({ nom: `P5002-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1985-01-01' });
    created.patients.push(patient._id);

    const examLabo = await ExamCatalogue.create({ code: `P5002-LABO-${stamp}`, nom: `Test Labo ${stamp}`, type: 'laboratoire', prix: 5000, statut: 'actif' });
    created.catalogue.push(examLabo._id);
    const examImg = await ExamCatalogue.create({ code: `P5002-IMG-${stamp}`, nom: `Test Imagerie ${stamp}`, type: 'imagerie', prix: 8000, statut: 'actif' });
    created.catalogue.push(examImg._id);
    const examEcho = await ExamCatalogue.create({ code: `P5002-ECHO-${stamp}`, nom: `Échographie Test ${stamp}`, type: 'imagerie', prix: 6000, statut: 'actif' });
    created.catalogue.push(examEcho._id);

    const cookieLabo = await login(server.baseUrl, laborantin.email);
    const cookieRadio = await login(server.baseUrl, radiologue.email);

    await t.test('Laboratoire — 2 validations concurrentes → exactement 1 succès, exactement 1 facture', async () => {
      const lab = await LabResult.create({
        patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`,
        examens_demandes: [String(examLabo._id)], statut: 'termine',
        resultats: [{ parametre: 'Glycémie', valeur: '5.2', unite: 'mmol/L' }],
      });
      created.labresults.push(lab._id);

      const fire = () => fetch(`${server.baseUrl}/laboratory/${lab._id}/validate`, withTimeout({
        method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookieLabo },
        body: JSON.stringify({ resultats: [{ parametre: 'Glycémie', valeur: '5.2', unite: 'mmol/L' }] }),
      }));
      const [r1, r2] = await Promise.all([fire(), fire()]);
      const statuses = [r1.status, r2.status].sort();
      assert.deepEqual(statuses, [200, 409], `exactement une des deux requêtes concurrentes doit réussir (200) et l'autre doit être rejetée (409) — reçu ${JSON.stringify(statuses)}`);

      const freshLab = await LabResult.findById(lab._id).lean();
      assert.equal(freshLab.statut, 'valide');
      const invoiceCount = await Invoice.countDocuments({ source_module: 'laboratoire', source_id: lab._id });
      assert.equal(invoiceCount, 1, 'exactement une facture doit exister pour cet acte, jamais deux');
    });

    await t.test('Radiologie — 2 validations concurrentes → exactement 1 succès, exactement 1 facture', async () => {
      const img = await ImagingResult.create({
        patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`,
        examen: examImg._id, type_examen: 'Test Imagerie', statut: 'rapporte',
      });
      created.imagingresults.push(img._id);

      const fire = () => fetch(`${server.baseUrl}/radiology/${img._id}/validation`, withTimeout({
        method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookieRadio },
        body: JSON.stringify({}),
      }));
      const [r1, r2] = await Promise.all([fire(), fire()]);
      const statuses = [r1.status, r2.status].sort();
      assert.deepEqual(statuses, [200, 409], `exactement une des deux requêtes concurrentes doit réussir — reçu ${JSON.stringify(statuses)}`);

      const freshImg = await ImagingResult.findById(img._id).lean();
      assert.equal(freshImg.statut, 'valide');
      const invoiceCount = await Invoice.countDocuments({ source_module: 'imagerie', source_id: img._id });
      assert.equal(invoiceCount, 1, 'exactement une facture doit exister pour cet acte, jamais deux');
    });

    await t.test('Échographie — 2 validations concurrentes → exactement 1 succès, exactement 1 facture', async () => {
      const echo = await Echographie.create({
        patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`,
        examen: examEcho._id, type: 'Test', statut: 'realisee',
      });
      created.echographies.push(echo._id);

      const fire = () => fetch(`${server.baseUrl}/echographie/${echo._id}/rapport`, withTimeout({
        method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookieRadio },
        body: JSON.stringify({ rapport_statut: 'valide', rapport_texte: 'Examen réel', conclusion: 'RAS' }),
      }));
      const [r1, r2] = await Promise.all([fire(), fire()]);
      const statuses = [r1.status, r2.status].sort();
      assert.deepEqual(statuses, [200, 409], `exactement une des deux requêtes concurrentes doit réussir — reçu ${JSON.stringify(statuses)}`);

      const freshEcho = await Echographie.findById(echo._id).lean();
      assert.equal(freshEcho.statut, 'validee');
      const invoiceCount = await Invoice.countDocuments({ source_module: 'echographie', source_id: echo._id });
      assert.equal(invoiceCount, 1, 'exactement une facture doit exister pour cet acte, jamais deux');
    });

    await t.test('non-régression — une deuxième tentative SÉQUENTIELLE (non concurrente) après validation reste également refusée', async () => {
      const lab = await LabResult.create({
        patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`,
        examens_demandes: [String(examLabo._id)], statut: 'termine',
        resultats: [{ parametre: 'Glycémie', valeur: '5.0', unite: 'mmol/L' }],
      });
      created.labresults.push(lab._id);

      const r1 = await fetch(`${server.baseUrl}/laboratory/${lab._id}/validate`, withTimeout({
        method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookieLabo },
        body: JSON.stringify({ resultats: [{ parametre: 'Glycémie', valeur: '5.0', unite: 'mmol/L' }] }),
      }));
      assert.equal(r1.status, 200);
      const r2 = await fetch(`${server.baseUrl}/laboratory/${lab._id}/validate`, withTimeout({
        method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookieLabo },
        body: JSON.stringify({ resultats: [{ parametre: 'Glycémie', valeur: '5.0', unite: 'mmol/L' }] }),
      }));
      // Séquentielle (pas concurrente) : `avant` est relu APRÈS que la
      // première écriture a déjà abouti, donc c'est la précondition
      // métier pré-existante (avant.statut !== 'termine', SPEC-07) qui
      // rejette ici — 400, pas 409. Le 409 est spécifiquement réservé à la
      // fenêtre de course concurrente (voir les 3 tests ci-dessus) ; les
      // deux chemins convergent vers le même résultat non négociable :
      // jamais une deuxième facture.
      assert.equal(r2.status, 400);
      const invoiceCount = await Invoice.countDocuments({ source_module: 'laboratoire', source_id: lab._id });
      assert.equal(invoiceCount, 1);
    });

    await t.test('non-régression — un acte DIFFÉRENT n\'est jamais affecté par la garde d\'un autre acte (deux résultats distincts, deux factures distinctes)', async () => {
      const labA = await LabResult.create({ patient: patient._id, patient_nom: 'A', examens_demandes: [String(examLabo._id)], statut: 'termine', resultats: [] });
      const labB = await LabResult.create({ patient: patient._id, patient_nom: 'B', examens_demandes: [String(examLabo._id)], statut: 'termine', resultats: [] });
      created.labresults.push(labA._id, labB._id);

      const rA = await fetch(`${server.baseUrl}/laboratory/${labA._id}/validate`, withTimeout({ method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookieLabo }, body: JSON.stringify({ resultats: [] }) }));
      const rB = await fetch(`${server.baseUrl}/laboratory/${labB._id}/validate`, withTimeout({ method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookieLabo }, body: JSON.stringify({ resultats: [] }) }));
      assert.equal(rA.status, 200);
      assert.equal(rB.status, 200);
      const invA = await Invoice.countDocuments({ source_module: 'laboratoire', source_id: labA._id });
      const invB = await Invoice.countDocuments({ source_module: 'laboratoire', source_id: labB._id });
      assert.equal(invA, 1);
      assert.equal(invB, 1);
    });

    await t.test('non-régression — comportement normal (non concurrent) : refus si le statut préalable est incorrect', async () => {
      const labEnAttente = await LabResult.create({ patient: patient._id, patient_nom: 'C', examens_demandes: [], statut: 'en_attente' });
      created.labresults.push(labEnAttente._id);
      const r = await fetch(`${server.baseUrl}/laboratory/${labEnAttente._id}/validate`, withTimeout({ method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookieLabo }, body: JSON.stringify({}) }));
      assert.equal(r.status, 400, 'doit rester 400 (précondition métier), pas 409, pour ce cas non lié à la concurrence');
    });
  } finally {
    if (connected) {
      const Invoice = require('../models/Invoice');
      const LabResult = require('../models/LabResult');
      const ImagingResult = require('../models/ImagingResult');
      const Echographie = require('../models/Echographie');
      const ExamCatalogue = require('../models/ExamCatalogue');
      const User = require('../models/User');
      const Patient = require('../models/Patient');
      await Invoice.deleteMany({ source_id: { $in: [...created.labresults, ...created.imagingresults, ...created.echographies] } });
      await LabResult.deleteMany({ _id: { $in: created.labresults } });
      await ImagingResult.deleteMany({ _id: { $in: created.imagingresults } });
      await Echographie.deleteMany({ _id: { $in: created.echographies } });
      await ExamCatalogue.deleteMany({ _id: { $in: created.catalogue } });
      await User.deleteMany({ _id: { $in: created.users } });
      await Patient.deleteMany({ _id: { $in: created.patients } });
      await mongoose.disconnect();
    }
    if (server) await server.stop();
  }
});
