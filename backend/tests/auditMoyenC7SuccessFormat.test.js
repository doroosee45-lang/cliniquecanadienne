// AUDIT-M-C7 (Groupe C, Point 7) — urgencesController.js (21 réponses),
// ambulances.controller.js (4 réponses) et chirurgieController.js (5
// réponses brutes + 2 réponses nommées sans success) étaient les seuls
// contrôleurs du projet à s'écarter du format standard {success, ...}
// utilisé partout ailleurs. Correctif purement additif (aucune clé
// existante retirée/renommée) sauf sur les 5 réponses brutes de
// chirurgieController.js, désormais enveloppées ({success, dossier|bilan|
// suivi|complication}).
//
// Ne re-teste pas la logique métier déjà couverte ailleurs (comptage,
// agrégations, populate, journalisation) — vérifie uniquement que `success`
// est bien présent et cohérent (true en cas de succès, false en cas
// d'erreur), sur au moins un cas de chaque par fonction modifiée, en
// appelant les vraies fonctions de contrôleur exportées sur une base réelle.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-M-C7 — success présent/cohérent sur urgencesController.js, ambulances.controller.js, chirurgieController.js (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Urgence = require('../models/Urgence');
  const Ambulance = require('../models/Ambulance');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const Patient = require('../models/Patient');
  const urgC = require('../controllers/urgencesController');
  const ambC = require('../controllers/ambulances.controller');
  const chirC = require('../controllers/chirurgieController');

  const stamp = Date.now();
  const created = { urgences: [], ambulances: [], dossiers: [], patients: [] };
  const fakeId = new mongoose.Types.ObjectId().toString();

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message }; } });
    return { status, body };
  };
  const user = { _id: new mongoose.Types.ObjectId() };

  try {
    // ── urgencesController.js ──────────────────────────────────────────
    await t.test('urgencesController.js — success présent sur chaque fonction modifiée', async () => {
      const u = await Urgence.create({ patient_nom: `C7-Urg-${stamp}`, niveau_triage: 'orange' });
      created.urgences.push(u);

      let r = await call(urgC.getStats, { query: {} });
      assert.equal(r.body.success, true, 'getStats');

      r = await call(urgC.getAll, { query: {} });
      assert.equal(r.body.success, true, 'getAll');

      r = await call(urgC.getOne, { params: { id: u._id.toString() } });
      assert.equal(r.body.success, true, 'getOne succès');
      r = await call(urgC.getOne, { params: { id: fakeId } });
      assert.equal(r.status, 404); assert.equal(r.body.success, false, 'getOne 404');

      r = await call(urgC.create, { body: { patient_nom: `C7-Urg-create-${stamp}`, niveau_triage: 'vert' }, user, ip: '127.0.0.1' });
      assert.equal(r.status, 201); assert.equal(r.body.success, true, 'create');
      created.urgences.push(await Urgence.findById(r.body.urgence._id));

      r = await call(urgC.update, { params: { id: u._id.toString() }, body: { motif: 'maj' }, user, ip: '127.0.0.1' });
      assert.equal(r.body.success, true, 'update succès');
      r = await call(urgC.update, { params: { id: fakeId }, body: { motif: 'maj' }, user, ip: '127.0.0.1' });
      assert.equal(r.status, 404); assert.equal(r.body.success, false, 'update 404');

      const getAddPairs = [
        ['getSoins', 'addSoin', { acte: 'Pansement' }],
        ['getPrescriptions', 'addPrescription', { designation: 'Paracétamol' }],
        ['getExamens', 'addExamen', { designation: 'NFS' }],
      ];
      for (const [getFn, addFn, payload] of getAddPairs) {
        r = await call(urgC[getFn], { params: { id: u._id.toString() } });
        assert.equal(r.body.success, true, getFn);
        r = await call(urgC[getFn], { params: { id: fakeId } });
        assert.equal(r.status, 404); assert.equal(r.body.success, false, `${getFn} 404`);

        r = await call(urgC[addFn], { params: { id: u._id.toString() }, body: payload, user, ip: '127.0.0.1' });
        assert.equal(r.status, 201); assert.equal(r.body.success, true, addFn);
        r = await call(urgC[addFn], { params: { id: fakeId }, body: payload, user, ip: '127.0.0.1' });
        assert.equal(r.status, 404); assert.equal(r.body.success, false, `${addFn} 404`);
      }

      r = await call(urgC.getTimeline, { params: { id: u._id.toString() } });
      assert.equal(r.body.success, true, 'getTimeline');
      r = await call(urgC.getTimeline, { params: { id: fakeId } });
      assert.equal(r.status, 404); assert.equal(r.body.success, false, 'getTimeline 404');
    });

    // ── ambulances.controller.js ───────────────────────────────────────
    await t.test('ambulances.controller.js — success présent sur chaque fonction modifiée', async () => {
      let r = await call(ambC.getAmbulances, {});
      assert.equal(r.body.success, true, 'getAmbulances');

      const numero = `C7-AMB-${stamp}`;
      r = await call(ambC.assignMission, { body: { numero, conducteur: 'Jean', destination: 'Hôpital régional', motif_mission: 'Transfert' }, user, ip: '127.0.0.1' });
      assert.equal(r.status, 201); assert.equal(r.body.success, true, 'assignMission');
      const amb = await Ambulance.findOne({ numero });
      created.ambulances.push(amb);

      r = await call(ambC.retourAmbulance, { params: { numero }, user, ip: '127.0.0.1' });
      assert.equal(r.body.success, true, 'retourAmbulance succès');
      r = await call(ambC.retourAmbulance, { params: { numero: `C7-AMB-inconnue-${stamp}` }, user, ip: '127.0.0.1' });
      assert.equal(r.status, 404); assert.equal(r.body.success, false, 'retourAmbulance 404');
    });

    // ── chirurgieController.js ─────────────────────────────────────────
    await t.test('chirurgieController.js — success présent, y compris sur les 5 réponses désormais enveloppées', async () => {
      const patient = await Patient.create({ nom: `C7-${stamp}`, prenom: 'Chir', date_naissance: '1980-01-01', sexe: 'M' });
      created.patients.push(patient);

      let r = await call(chirC.getDossiers, { query: {} });
      assert.equal(r.body.success, true, 'getDossiers (non-régression)');

      r = await call(chirC.getStats, {});
      assert.equal(r.body.success, true, 'getStats');

      r = await call(chirC.createDossier, { body: { patient: patient._id.toString(), motif_consultation: 'Test C7' }, user, ip: '127.0.0.1' });
      assert.equal(r.status, 201); assert.equal(r.body.success, true, 'createDossier succès (réponse désormais enveloppée)');
      assert.ok(r.body.dossier?.numero, 'createDossier doit renvoyer dossier.numero (lecture frontend Chirurgie.jsx)');
      const dossier = await DossierChirurgical.findById(r.body.dossier._id);
      created.dossiers.push(dossier);

      r = await call(chirC.createDossier, { body: { patient: fakeId, motif_consultation: 'x' }, user, ip: '127.0.0.1' });
      assert.equal(r.status, 400); assert.equal(r.body.success, false, 'createDossier 400 patient introuvable');

      r = await call(chirC.getDossierById, { params: { id: dossier._id.toString() } });
      assert.equal(r.body.success, true, 'getDossierById succès');
      r = await call(chirC.getDossierById, { params: { id: fakeId } });
      assert.equal(r.status, 404); assert.equal(r.body.success, false, 'getDossierById 404');

      r = await call(chirC.updateDossier, { params: { id: dossier._id.toString() }, body: { motif_consultation: 'maj' }, user, ip: '127.0.0.1' });
      assert.equal(r.body.success, true, 'updateDossier succès (réponse désormais enveloppée)');
      r = await call(chirC.updateDossier, { params: { id: fakeId }, body: { motif_consultation: 'maj' }, user, ip: '127.0.0.1' });
      assert.equal(r.status, 404); assert.equal(r.body.success, false, 'updateDossier 404');

      r = await call(chirC.addBilan, { params: { id: dossier._id.toString() }, body: { type: 'biologie', examen: 'NFS' }, user, ip: '127.0.0.1' });
      assert.equal(r.status, 201); assert.equal(r.body.success, true, 'addBilan succès (réponse désormais enveloppée)');
      r = await call(chirC.addBilan, { params: { id: fakeId }, body: { type: 'biologie', examen: 'NFS' }, user, ip: '127.0.0.1' });
      assert.equal(r.status, 404); assert.equal(r.body.success, false, 'addBilan 404');

      r = await call(chirC.addSuivi, { params: { id: dossier._id.toString() }, body: { date_suivi: new Date() }, user, ip: '127.0.0.1' });
      assert.equal(r.status, 201); assert.equal(r.body.success, true, 'addSuivi succès (réponse désormais enveloppée)');
      r = await call(chirC.addSuivi, { params: { id: fakeId }, body: {}, user, ip: '127.0.0.1' });
      assert.equal(r.status, 404); assert.equal(r.body.success, false, 'addSuivi 404');

      r = await call(chirC.addComplication, { params: { id: dossier._id.toString() }, body: { type_complication: 'infection' }, user, ip: '127.0.0.1' });
      assert.equal(r.status, 201); assert.equal(r.body.success, true, 'addComplication succès (réponse désormais enveloppée)');
      r = await call(chirC.addComplication, { params: { id: fakeId }, body: { type_complication: 'infection' }, user, ip: '127.0.0.1' });
      assert.equal(r.status, 404); assert.equal(r.body.success, false, 'addComplication 404');
    });
  } finally {
    for (const u of created.urgences) if (u) await Urgence.findByIdAndDelete(u._id);
    for (const a of created.ambulances) if (a) await Ambulance.findByIdAndDelete(a._id);
    for (const d of created.dossiers) if (d) await DossierChirurgical.findByIdAndDelete(d._id);
    for (const p of created.patients) if (p) await Patient.findByIdAndDelete(p._id);
    await mongoose.disconnect();
  }
});
