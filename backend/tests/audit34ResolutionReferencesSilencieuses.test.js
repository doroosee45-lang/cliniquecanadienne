// AUDIT-3.4 — plusieurs contrôleurs continuaient silencieusement la création
// d'un document quand une référence fournie (patient_id, grossesse_id,
// child_id) était introuvable, au lieu de retourner une erreur explicite —
// un dossier orphelin non rattachable était créé sans que personne ne le
// sache. Et consultations.controller.js::remove laissait une référence
// orpheline sur la Prescription générée automatiquement à la clôture de la
// consultation supprimée. Ce test prouve les 4 correctifs.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-3.4 — références introuvables rejetées explicitement, plus de référence orpheline (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Pregnancy = require('../models/Pregnancy');
  const Delivery = require('../models/Delivery');
  const Child = require('../models/Child');
  const PediatricConsultation = require('../models/PediatricConsultation');
  const Consultation = require('../models/Consultation');
  const Prescription = require('../models/Prescription');
  const maternityC = require('../controllers/maternityController');
  const pediatrieC = require('../controllers/pediatrieController');
  const consultationsC = require('../controllers/consultations.controller');

  const stamp = Date.now();
  const FAKE_ID = new mongoose.Types.ObjectId();
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('maternityController.create — patient_id introuvable → 400, aucun dossier créé', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      const avant = await Pregnancy.countDocuments({});
      const { status, body } = await call(maternityC.create, { body: { patient_id: FAKE_ID, ddr: '2026-01-01' }, user });
      assert.equal(status, 400);
      assert.match(body.message, /introuvable/);
      const apres = await Pregnancy.countDocuments({});
      assert.equal(apres, avant, 'aucun dossier de grossesse ne doit être créé si patient_id est introuvable');
    });

    await t.test('maternityController.createDelivery — grossesse_id introuvable → 400, aucun accouchement créé', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      const avant = await Delivery.countDocuments({});
      const { status, body } = await call(maternityC.createDelivery, { body: { grossesse_id: FAKE_ID, type_accouchement: 'voie_basse' }, user });
      assert.equal(status, 400);
      assert.match(body.message, /introuvable/);
      const apres = await Delivery.countDocuments({});
      assert.equal(apres, avant, 'aucun accouchement ne doit être créé si grossesse_id est introuvable');
    });

    await t.test('pediatrieController.createConsultation — child_id introuvable → 400, aucune consultation créée', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      const avant = await PediatricConsultation.countDocuments({});
      const { status, body } = await call(pediatrieC.createConsultation, { body: { child_id: FAKE_ID, type: 'suivi', diagnostic: 'RAS' }, user });
      assert.equal(status, 400);
      assert.match(body.message, /introuvable/);
      const apres = await PediatricConsultation.countDocuments({});
      assert.equal(apres, avant, 'aucune consultation pédiatrique ne doit être créée si child_id est introuvable');
    });

    await t.test('consultations.controller.remove — détache la Prescription générée automatiquement au lieu de laisser une référence orpheline', async () => {
      const patient = await Patient.create({ nom: `T34-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
      const medecin = await User.create({ email: `_t34-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'T34', prenom: 'Med', role: 'medecin', statut: 'actif' });
      cleanup.push(() => User.findByIdAndDelete(medecin._id));
      const user = { _id: medecin._id, prenom: medecin.prenom, nom: medecin.nom, role: 'medecin' };

      const consult = await Consultation.create({
        patient: patient._id, medecin: medecin._id, date_consultation: new Date(),
        diagnostic: 'Test', statut: 'terminee',
      });
      const rx = await Prescription.create({
        patient: patient._id, medecin: medecin._id, consultation: consult._id,
        lignes: [{ medicament_nom: 'Test', quantite: 1 }], statut: 'active',
      });
      cleanup.push(() => Prescription.findByIdAndDelete(rx._id));
      // Patient supprimé en dernier : la Prescription ci-dessus le référence
      // encore (hook pre('findOneAndDelete') de Patient).
      cleanup.push(() => Patient.findByIdAndDelete(patient._id));

      const { status } = await call(consultationsC.remove, { params: { id: consult._id }, user });
      assert.equal(status, 200);

      const freshRx = await Prescription.findById(rx._id).lean();
      assert.ok(freshRx, 'la prescription elle-même ne doit jamais être supprimée');
      assert.equal(freshRx.consultation, undefined, 'la référence vers la consultation supprimée doit être détachée, jamais laissée orpheline');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
