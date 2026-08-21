// ADR-0005 — Workflow Urgences → Hospitalisation (Phase 4 du plan directeur,
// supersède le ticket 0018/option 2). Prouve, contre la base réelle :
//   1. decision='hospitalisation' → admission_status='preparation' (automatique) ;
//   2. décision retirée avant création réelle → admission_status='annulee' ;
//   3. création réelle de l'hospitalisation → admission_status='terminee' ;
//   4. une seconde hospitalisation active pour le même urgence_id est refusée (409) ;
//   5. une fois 'terminee', un changement ultérieur de decision ne le réécrit jamais.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('ADR-0005 — workflow Urgences → Hospitalisation (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Urgence = require('../models/Urgence');
  const Hospitalization = require('../models/Hospitalization');
  const urgencesC = require('../controllers/urgencesController');
  const hospC = require('../controllers/hospitalization.controller');

  const stamp = Date.now();
  const cleanup = [];

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    const patient = await Patient.create({ nom: `T4-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
    cleanup.push(() => Patient.findByIdAndDelete(patient._id));
    const medecin = await User.create({ email: `_t4-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'T4', prenom: 'Med', role: 'medecin', statut: 'actif' });
    cleanup.push(() => User.findByIdAndDelete(medecin._id));
    const user = { _id: medecin._id, prenom: medecin.prenom, nom: medecin.nom, role: 'medecin' };

    const urgence = await Urgence.create({ patient: patient._id, patient_nom: `${patient.prenom} ${patient.nom}` });
    cleanup.push(() => Urgence.findByIdAndDelete(urgence._id));
    assert.equal(urgence.admission_status, 'non_requise', 'valeur par défaut attendue');

    await t.test('decision → hospitalisation pose admission_status=preparation automatiquement', async () => {
      const { status } = await call(urgencesC.update, { params: { id: urgence._id }, body: { decision: 'hospitalisation' }, user });
      assert.equal(status, 200);
      const fresh = await Urgence.findById(urgence._id);
      assert.equal(fresh.admission_status, 'preparation');
    });

    await t.test('retirer la décision avant toute création réelle → admission_status=annulee', async () => {
      const { status } = await call(urgencesC.update, { params: { id: urgence._id }, body: { decision: 'retour_domicile' }, user });
      assert.equal(status, 200);
      const fresh = await Urgence.findById(urgence._id);
      assert.equal(fresh.admission_status, 'annulee');
    });

    await t.test('admission_status envoyé directement par le client est ignoré (non modifiable)', async () => {
      await call(urgencesC.update, { params: { id: urgence._id }, body: { admission_status: 'terminee' }, user });
      const fresh = await Urgence.findById(urgence._id);
      assert.notEqual(fresh.admission_status, 'terminee', 'admission_status ne doit jamais être réassignable directement par le client');
    });

    let hosp;
    await t.test('re-décider hospitalisation puis créer réellement l\'hospitalisation → admission_status=terminee', async () => {
      await call(urgencesC.update, { params: { id: urgence._id }, body: { decision: 'hospitalisation' }, user });
      const { status, body } = await call(hospC.create, {
        body: { patient: patient._id, motif_entree: 'Suite urgences', urgence_id: urgence._id },
        user,
      });
      assert.equal(status, 201, JSON.stringify(body));
      hosp = body.hospitalization;
      cleanup.push(() => Hospitalization.findByIdAndDelete(hosp._id));

      const fresh = await Urgence.findById(urgence._id);
      assert.equal(fresh.admission_status, 'terminee');
    });

    await t.test('une seconde hospitalisation active pour le même urgence_id est refusée (409)', async () => {
      const { status, body } = await call(hospC.create, {
        body: { patient: patient._id, motif_entree: 'Doublon accidentel', urgence_id: urgence._id },
        user,
      });
      assert.equal(status, 409);
      assert.match(body.message, /déjà en cours/);
    });

    await t.test('une fois terminee, un changement de decision ne réécrit plus admission_status', async () => {
      await call(urgencesC.update, { params: { id: urgence._id }, body: { decision: 'retour_domicile' }, user });
      const fresh = await Urgence.findById(urgence._id);
      assert.equal(fresh.admission_status, 'terminee', 'une hospitalisation réelle existe déjà — jamais réécrit silencieusement');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
