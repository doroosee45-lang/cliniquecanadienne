// Correction 13 (relecture du 6 sept. 2026, DATA-001) — Echographie.patient
// était une String libre (aucun populate() possible, malgré required:true),
// tandis que patient_ref (la vraie référence) restait optionnel. Fusionnés
// en un seul champ de référence réelle : `patient` (ObjectId, ref:'Patient',
// required) ; le libellé texte autrefois porté par `patient` vit désormais
// sous `patient_nom`.
//
// Deux choses vérifiées contre la vraie base (données propres à ce test,
// nettoyées après) :
//  1) echographieController.js::create refuse désormais toute saisie libre
//     et exige un vrai Patient — jamais de String acceptée.
//  2) Le script de migration (utils/migrate-echographie-patient-ref.js) migre
//     réellement un document pré-existant avec patient_ref -> patient
//     (référence promue), et préserve sans invention le libellé d'un document
//     sans aucune référence pré-existante (patient retiré, patient_nom
//     conservé) — jamais de patient fabriqué. Idempotent sur un document déjà
//     migré.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('Correction 13 (DATA-001) — Echographie.patient référence réelle + migration', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Echographie = require('../models/Echographie');
  const echoC = require('../controllers/echographieController');

  const stamp = Date.now();
  const created = { patients: [], demandes: [] };
  const rawCollection = mongoose.connection.collection('echographies');

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const patient = await Patient.create({ nom: `T-CORRECTION13-${stamp}`, prenom: 'P', date_naissance: '1982-04-04', sexe: 'M' });
    created.patients.push(patient._id);

    await t.test('create() refuse une saisie libre (String) au lieu d\'un vrai Patient — jamais accepté', async () => {
      const { status, body } = await call(echoC.create, {
        body: { patient: 'Nom Saisi Librement', motif: 'Test' },
        user: { _id: new mongoose.Types.ObjectId(), prenom: 'T', nom: 'Test', role: 'medecin' }, ip: '127.0.0.1',
      });
      assert.equal(status, 400, JSON.stringify(body));
      assert.equal(body.success, false);
    });

    await t.test('create() avec un vrai Patient -> référence réelle persistée, patient_nom conservé pour l\'affichage', async () => {
      const { status, body } = await call(echoC.create, {
        body: { patient: patient._id.toString(), patient_nom: 'Nom Réel Affiché', motif: 'Test Correction13' },
        user: { _id: new mongoose.Types.ObjectId(), prenom: 'T', nom: 'Test', role: 'medecin' }, ip: '127.0.0.1',
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.demandes.push(body.demande._id);

      const fresh = await Echographie.findById(body.demande._id).lean();
      assert.equal(String(fresh.patient), String(patient._id));
      assert.equal(fresh.patient_nom, 'Nom Réel Affiché');
    });

    await t.test('migration — document avec patient_ref pré-existant : référence promue vers patient, libellé préservé', async () => {
      const insertResult = await rawCollection.insertOne({
        numero: `ECH-TEST13-A-${stamp}`, patient: 'Ancien Libellé A', patient_ref: patient._id,
        statut: 'en_attente', createdAt: new Date(), updatedAt: new Date(),
      });
      const docId = insertResult.insertedId;
      created.demandes.push(docId);

      execFileSync('node', [path.join(__dirname, '..', 'utils', 'migrate-echographie-patient-ref.js')], { encoding: 'utf8' });

      const fresh = await rawCollection.findOne({ _id: docId });
      assert.equal(String(fresh.patient), String(patient._id), 'patient_ref doit avoir été promu vers patient');
      assert.equal(fresh.patient_nom, 'Ancien Libellé A', 'le libellé doit être préservé, jamais perdu');
      assert.equal(fresh.patient_ref, undefined, 'patient_ref doit avoir été retiré (fusionné)');
    });

    await t.test('migration — document SANS aucune référence pré-existante : jamais de patient inventé, libellé préservé', async () => {
      const insertResult = await rawCollection.insertOne({
        numero: `ECH-TEST13-B-${stamp}`, patient: 'Ancien Libellé B (orphelin)',
        statut: 'en_attente', createdAt: new Date(), updatedAt: new Date(),
      });
      const docId = insertResult.insertedId;
      created.demandes.push(docId);

      execFileSync('node', [path.join(__dirname, '..', 'utils', 'migrate-echographie-patient-ref.js')], { encoding: 'utf8' });

      const fresh = await rawCollection.findOne({ _id: docId });
      assert.equal(fresh.patient, undefined, 'aucune référence ne doit être fabriquée quand aucune n\'existait avant');
      assert.equal(fresh.patient_nom, 'Ancien Libellé B (orphelin)', 'le libellé doit rester lisible, jamais perdu');
    });

    await t.test('migration — idempotente : un document déjà migré (patient déjà ObjectId) n\'est pas retouché', async () => {
      const insertResult = await rawCollection.insertOne({
        numero: `ECH-TEST13-C-${stamp}`, patient: patient._id, patient_nom: 'Déjà Migré',
        statut: 'en_attente', createdAt: new Date(), updatedAt: new Date(),
      });
      const docId = insertResult.insertedId;
      created.demandes.push(docId);

      execFileSync('node', [path.join(__dirname, '..', 'utils', 'migrate-echographie-patient-ref.js')], { encoding: 'utf8' });

      const fresh = await rawCollection.findOne({ _id: docId });
      assert.equal(String(fresh.patient), String(patient._id), 'un document déjà migré ne doit pas être altéré par une ré-exécution');
      assert.equal(fresh.patient_nom, 'Déjà Migré');
    });
  } finally {
    await rawCollection.deleteMany({ _id: { $in: created.demandes } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
