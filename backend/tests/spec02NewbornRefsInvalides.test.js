// SPEC-02 (correction du 12 sept. 2026, audit indépendant) —
// maternityController.js::createNewborn acceptait n'importe quel
// grossesse_id/accouchement_id fabriqué ou orphelin sans la moindre
// vérification, créant un Newborn référençant un dossier grossesse ou un
// accouchement qui n'existe pas. Ce test prouve que ces références sont
// désormais réellement vérifiées contre la base — rejetées si invalides
// ou inexistantes, jamais silencieusement acceptées.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('SPEC-02 — grossesse_id/accouchement_id fabriqués ou orphelins sont rejetés à la création du nouveau-né', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const Pregnancy = require('../models/Pregnancy');
  const Delivery = require('../models/Delivery');
  const Newborn = require('../models/Newborn');
  const User = require('../models/User');
  const maternityC = require('../controllers/maternityController');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const user = { _id: new mongoose.Types.ObjectId() };
  const created = { newborns: [], pregnancies: [], deliveries: [], patients: [] };

  try {
    await t.test('grossesse_id fabriqué (format invalide) est rejeté', async () => {
      const { status } = await call(maternityC.createNewborn, {
        user, ip: '127.0.0.1',
        body: { prenom: 'Bebe', sexe: 'F', grossesse_id: 'pas-un-objectid' },
      });
      assert.equal(status, 400);
      assert.equal(await Newborn.countDocuments({ prenom: 'Bebe', mere_nom: undefined }), 0);
    });

    await t.test('grossesse_id orphelin (ObjectId valide mais aucun dossier réel) est rejeté', async () => {
      const { status } = await call(maternityC.createNewborn, {
        user, ip: '127.0.0.1',
        body: { prenom: 'Bebe2', sexe: 'M', grossesse_id: new mongoose.Types.ObjectId().toString() },
      });
      assert.equal(status, 404);
    });

    await t.test('accouchement_id orphelin (ObjectId valide mais aucun accouchement réel) est rejeté', async () => {
      const { status } = await call(maternityC.createNewborn, {
        user, ip: '127.0.0.1',
        body: { prenom: 'Bebe3', sexe: 'F', accouchement_id: new mongoose.Types.ObjectId().toString() },
      });
      assert.equal(status, 404);
    });

    await t.test('un grossesse_id ET un accouchement_id réellement existants sont acceptés et persistés', async () => {
      const patient = await Patient.create({ nom: `Spec02-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1995-01-01' });
      created.patients.push(patient._id);
      const grossesse = await Pregnancy.create({ patient_id: patient._id, patient_nom: patient.nom, patient_prenom: patient.prenom, date_debut: new Date() });
      created.pregnancies.push(grossesse._id);
      const delivery = await Delivery.create({ grossesse_id: grossesse._id, patient_id: patient._id, date_heure: new Date(), type_accouchement: 'voie_basse' });
      created.deliveries.push(delivery._id);

      const { status, body } = await call(maternityC.createNewborn, {
        user, ip: '127.0.0.1',
        body: { prenom: 'Bebe4', sexe: 'F', grossesse_id: grossesse._id.toString(), accouchement_id: delivery._id.toString() },
      });
      assert.equal(status, 201, JSON.stringify(body));
      created.newborns.push(body.nouveau_ne._id);
      const fresh = await Newborn.findById(body.nouveau_ne._id).lean();
      assert.equal(String(fresh.grossesse_id), String(grossesse._id));
      assert.equal(String(fresh.accouchement_id), String(delivery._id));
      assert.equal(String(fresh.patient_id), String(patient._id), 'patient_id doit être dérivé de la grossesse réelle, jamais fabriqué par le client');
    });

    await t.test('patient_id fabriqué directement par le client (sans passer par une grossesse réelle) est ignoré', async () => {
      const patientFantome = new mongoose.Types.ObjectId();
      const { status, body } = await call(maternityC.createNewborn, {
        user, ip: '127.0.0.1',
        body: { prenom: 'Bebe5', sexe: 'M', patient_id: patientFantome.toString() },
      });
      assert.equal(status, 201);
      created.newborns.push(body.nouveau_ne._id);
      const fresh = await Newborn.findById(body.nouveau_ne._id).lean();
      assert.notEqual(String(fresh.patient_id), String(patientFantome), 'patient_id ne doit jamais être accepté directement du client');
      assert.equal(fresh.patient_id, undefined);
    });
  } finally {
    await Newborn.deleteMany({ _id: { $in: created.newborns } });
    await Delivery.deleteMany({ _id: { $in: created.deliveries } });
    await Pregnancy.deleteMany({ _id: { $in: created.pregnancies } });
    await Patient.deleteMany({ _id: { $in: created.patients } });
    await mongoose.disconnect();
  }
});
