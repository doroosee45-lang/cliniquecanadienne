// POST5-005 (audit indépendant post-Phase 5, 14 sept. 2026) — MOYENNE,
// même classe de bug que POST5-002 (laboratoire/imagerie/echographie),
// fenêtre plus étroite. urgencesController.js::update générait une Invoice
// à la clôture réelle d'un dossier urgences (statut terminal facturable),
// gardée uniquement par `const dejaFacture = await Invoice.findOne(...)`
// suivi de `if (!dejaFacture) { Invoice.create(...) }` — lecture puis
// écriture non atomiques. Deux clôtures concurrentes du même dossier
// pouvaient toutes deux lire dejaFacture === null avant qu'aucune
// insertion n'ait abouti, produisant deux factures pour le même épisode.
//
// Corrigé au niveau base (pas seulement applicatif) : index unique+sparse
// sur Invoice.{source_module, source_id} (models/Invoice.js), même
// précédent déjà établi pour `consultation`
// (FACTURATION-CONSULTATION-001). Le contrôleur capture l'erreur de clé
// dupliquée (E11000) de la requête perdante et renvoie la facture déjà
// créée par le gagnant, jamais un doublon ni une erreur 500 — la
// transition de statut elle-même (u.save()) reste acquise dans tous les
// cas.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startIsolatedServer, mongodExists } = require('./helpers/isolatedServer');

const PASSWORD = 'Post5005TestPass1!';
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

test('POST5-005 — deux clôtures concurrentes du même dossier urgences ne produisent jamais deux factures (serveur isolé, vraies requêtes HTTP concurrentes, base réelle)', { skip: !mongodExists() && 'mongod introuvable — infrastructure de serveur isolé indisponible' }, async (t) => {
  let server = null;
  let connected = false;
  const created = { users: [], patients: [], urgences: [], catalogue: [] };

  try {
    server = await startIsolatedServer();
    await mongoose.connect(server.mongoUri);
    connected = true;
    const User = require('../models/User');
    const Patient = require('../models/Patient');
    const ExamCatalogue = require('../models/ExamCatalogue');
    const Urgence = require('../models/Urgence');
    const Invoice = require('../models/Invoice');

    const stamp = Date.now();
    const medecin = await User.create({ email: `_p5005-med-${stamp}@_test.local`, password: PASSWORD, nom: 'T', prenom: 'Medecin', role: 'medecin', statut: 'actif' });
    created.users.push(medecin._id);
    const patient = await Patient.create({ nom: `P5005-${stamp}`, prenom: 'Test', sexe: 'M', date_naissance: '1985-01-01' });
    created.patients.push(patient._id);
    const examCat = await ExamCatalogue.create({ code: `P5005-${stamp}`, nom: `Test Urgences ${stamp}`, type: 'laboratoire', prix: 4000, statut: 'actif' });
    created.catalogue.push(examCat._id);

    const cookie = await login(server.baseUrl, medecin.email);

    await t.test('2 clôtures concurrentes (statut → sorti) → exactement 1 facture pour ce dossier', async () => {
      const urg = await Urgence.create({
        patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`,
        numero: `URG-P5005-${stamp}`, motif: 'Test', statut: 'soins', niveau_triage: 'orange',
        examens: [{ type: 'labo', designation: 'Test', statut: 'resultat', examen: examCat._id }],
      });
      created.urgences.push(urg._id);

      const fire = () => fetch(`${server.baseUrl}/urgences/${urg._id}`, withTimeout({
        method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ statut: 'sorti' }),
      }));
      const [r1, r2] = await Promise.all([fire(), fire()]);
      assert.equal(r1.status, 200, 'les deux requêtes doivent réussir — seule la génération de facture en double est empêchée, pas la clôture elle-même');
      assert.equal(r2.status, 200);
      const b1 = await r1.json();
      const b2 = await r2.json();
      assert.ok(b1.invoice, 'la première réponse doit porter une facture (générée ou déjà existante du concurrent)');
      assert.ok(b2.invoice, 'la seconde réponse doit également porter une facture — jamais null à cause de la course perdue');
      assert.equal(String(b1.invoice._id), String(b2.invoice._id), 'les deux réponses doivent référencer LA MÊME facture, jamais deux factures distinctes');

      const freshUrg = await Urgence.findById(urg._id).lean();
      assert.equal(freshUrg.statut, 'sorti', 'la transition de statut elle-même reste acquise dans tous les cas');

      const invoiceCount = await Invoice.countDocuments({ source_module: 'urgences', source_id: urg._id });
      assert.equal(invoiceCount, 1, 'exactement une facture doit exister pour ce dossier, jamais deux');
    });

    await t.test('non-régression — une clôture séquentielle unique (non concurrente) continue de générer une facture normalement', async () => {
      const urg = await Urgence.create({
        patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}`,
        numero: `URG-P5005B-${stamp}`, motif: 'Test', statut: 'soins', niveau_triage: 'orange',
        examens: [{ type: 'labo', designation: 'Test', statut: 'resultat', examen: examCat._id }],
      });
      created.urgences.push(urg._id);

      const r = await fetch(`${server.baseUrl}/urgences/${urg._id}`, withTimeout({
        method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ statut: 'sorti' }),
      }));
      assert.equal(r.status, 200);
      const body = await r.json();
      assert.ok(body.invoice);
      assert.equal(body.invoice.montant_ht, 4000);

      const invoiceCount = await Invoice.countDocuments({ source_module: 'urgences', source_id: urg._id });
      assert.equal(invoiceCount, 1);
    });

    await t.test('non-régression — deux dossiers DIFFÉRENTS clôturés en même temps ne se bloquent jamais mutuellement (index sparse par source_id, jamais un verrou global)', async () => {
      const urgA = await Urgence.create({ patient: patient._id, patient_nom: 'A', numero: `URG-P5005C-${stamp}`, motif: 'Test', statut: 'soins', niveau_triage: 'orange', examens: [{ type: 'labo', designation: 'Test', statut: 'resultat', examen: examCat._id }] });
      const urgB = await Urgence.create({ patient: patient._id, patient_nom: 'B', numero: `URG-P5005D-${stamp}`, motif: 'Test', statut: 'soins', niveau_triage: 'orange', examens: [{ type: 'labo', designation: 'Test', statut: 'resultat', examen: examCat._id }] });
      created.urgences.push(urgA._id, urgB._id);

      const [rA, rB] = await Promise.all([
        fetch(`${server.baseUrl}/urgences/${urgA._id}`, withTimeout({ method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ statut: 'sorti' }) })),
        fetch(`${server.baseUrl}/urgences/${urgB._id}`, withTimeout({ method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ statut: 'sorti' }) })),
      ]);
      assert.equal(rA.status, 200);
      assert.equal(rB.status, 200);
      const invA = await Invoice.countDocuments({ source_module: 'urgences', source_id: urgA._id });
      const invB = await Invoice.countDocuments({ source_module: 'urgences', source_id: urgB._id });
      assert.equal(invA, 1);
      assert.equal(invB, 1);
    });
  } finally {
    if (connected) {
      const Invoice = require('../models/Invoice');
      const Urgence = require('../models/Urgence');
      const ExamCatalogue = require('../models/ExamCatalogue');
      const User = require('../models/User');
      const Patient = require('../models/Patient');
      await Invoice.deleteMany({ source_module: 'urgences', source_id: { $in: created.urgences } });
      await Urgence.deleteMany({ _id: { $in: created.urgences } });
      await ExamCatalogue.deleteMany({ _id: { $in: created.catalogue } });
      await User.deleteMany({ _id: { $in: created.users } });
      await Patient.deleteMany({ _id: { $in: created.patients } });
      await mongoose.disconnect();
    }
    if (server) await server.stop();
  }
});
