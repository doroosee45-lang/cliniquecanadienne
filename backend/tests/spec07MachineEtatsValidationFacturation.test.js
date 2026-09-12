// SPEC-07 (correction du 12 sept. 2026, audit indépendant) —
// laboratory.controller.js::validate, radiology.controller.js::validation
// et echographieController.js::saveRapport ne vérifiaient jamais le statut
// courant avant de valider (et facturer) : un examen encore en_attente/
// programme/planifié — jamais réellement réalisé — pouvait être validé et
// facturé directement. Ce test prouve que les trois exigent désormais
// réellement que l'acte ait été effectué (via le vrai chemin applicatif :
// saisirResultats pour le labo, saveCR/rapport pour l'imagerie, planifier +
// contenu de rapport réel pour l'échographie) avant d'accepter la
// validation, et que la facturation ne se déclenche jamais pour un acte
// jamais réalisé.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('SPEC-07 — validation/facturation refusées tant qu\'un examen n\'a pas réellement été réalisé', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Patient = require('../models/Patient');
  require('../models/User');
  const LabResult = require('../models/LabResult');
  const ImagingResult = require('../models/ImagingResult');
  const Echographie = require('../models/Echographie');
  const Invoice = require('../models/Invoice');
  const labC = require('../controllers/laboratory.controller');
  const radioC = require('../controllers/radiology.controller');
  const echoC = require('../controllers/echographieController');

  const stamp = Date.now();
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'Test', nom: 'User' };
  const patient = await Patient.create({ nom: `Spec07-${stamp}`, prenom: 'Test', sexe: 'F', date_naissance: '1990-01-01' });
  const created = { labs: [], imgs: [], echos: [] };

  try {
    await t.test('LabResult.validate() — refuse une analyse encore en_attente (jamais prélevée/testée), jamais de validation ni de facturation', async () => {
      const { body: bCreate } = await call(labC.create, { user, ip: '127.0.0.1', body: { patient: patient._id.toString() } });
      created.labs.push(bCreate.result._id);
      const { status, body } = await call(labC.validate, { params: { id: bCreate.result._id }, body: { resultats: {}, est_critique: false }, user, ip: '127.0.0.1' });
      assert.equal(status, 400);
      const fresh = await LabResult.findById(bCreate.result._id).lean();
      assert.equal(fresh.statut, 'en_attente', 'le statut ne doit jamais passer à valide sans passage réel par saisirResultats');
      assert.equal(await Invoice.countDocuments({ source_module: 'laboratoire', source_id: fresh._id }), 0);
    });

    await t.test('LabResult.validate() — accepte une fois les résultats réellement saisis (saisirResultats)', async () => {
      const { body: bCreate } = await call(labC.create, { user, ip: '127.0.0.1', body: { patient: patient._id.toString() } });
      created.labs.push(bCreate.result._id);
      await call(labC.saisirResultats, { params: { id: bCreate.result._id }, body: { resultats: { nfs: 'normal' } }, user, ip: '127.0.0.1' });
      const { status } = await call(labC.validate, { params: { id: bCreate.result._id }, body: { resultats: { nfs: 'normal' }, est_critique: false }, user, ip: '127.0.0.1' });
      assert.equal(status, 200);
    });

    await t.test('ImagingResult.validation() — refuse un examen encore programme (jamais réalisé), jamais de validation ni de facturation', async () => {
      const { body: bCreate } = await call(radioC.create, { user, ip: '127.0.0.1', body: { patient: patient._id.toString() } });
      created.imgs.push(bCreate.examen._id);
      const { status } = await call(radioC.validation, { params: { id: bCreate.examen._id }, body: { signature: 'sig' }, user, ip: '127.0.0.1' });
      assert.equal(status, 400);
      const fresh = await ImagingResult.findById(bCreate.examen._id).lean();
      assert.equal(fresh.statut, 'programme');
      assert.equal(await Invoice.countDocuments({ source_module: 'imagerie', source_id: fresh._id }), 0);
    });

    await t.test('ImagingResult.validation() — accepte une fois l\'examen réellement réalisé (saveCR)', async () => {
      const { body: bCreate } = await call(radioC.create, { user, ip: '127.0.0.1', body: { patient: patient._id.toString() } });
      created.imgs.push(bCreate.examen._id);
      await call(radioC.saveCR, { params: { id: bCreate.examen._id }, body: { compte_rendu: 'RAS' }, user, ip: '127.0.0.1' });
      const { status } = await call(radioC.validation, { params: { id: bCreate.examen._id }, body: { signature: 'sig' }, user, ip: '127.0.0.1' });
      assert.equal(status, 200);
    });

    await t.test('Echographie.saveRapport() — refuse de valider une demande encore en_attente (jamais planifiée), jamais de facturation', async () => {
      const demande = await Echographie.create({ patient: patient._id, patient_nom: patient.nom });
      created.echos.push(demande._id);
      const { status } = await call(echoC.saveRapport, { params: { id: demande._id }, body: { rapport_texte: 'RAS', conclusion: 'Normal', rapport_statut: 'valide' }, user, ip: '127.0.0.1' });
      assert.equal(status, 400);
      const fresh = await Echographie.findById(demande._id).lean();
      assert.equal(fresh.statut, 'en_attente');
      assert.equal(await Invoice.countDocuments({ source_module: 'echographie', source_id: fresh._id }), 0);
    });

    await t.test('Echographie.saveRapport() — refuse de valider sans aucun contenu réel de rapport, même planifiée', async () => {
      const demande = await Echographie.create({ patient: patient._id, patient_nom: patient.nom, statut: 'planifiee' });
      created.echos.push(demande._id);
      const { status } = await call(echoC.saveRapport, { params: { id: demande._id }, body: { rapport_statut: 'valide' }, user, ip: '127.0.0.1' });
      assert.equal(status, 400);
    });

    await t.test('Echographie.saveRapport() — accepte une fois réellement planifiée avec un contenu de rapport réel', async () => {
      const demande = await Echographie.create({ patient: patient._id, patient_nom: patient.nom, statut: 'planifiee' });
      created.echos.push(demande._id);
      const { status } = await call(echoC.saveRapport, { params: { id: demande._id }, body: { rapport_texte: 'RAS', conclusion: 'Normal', rapport_statut: 'valide' }, user, ip: '127.0.0.1' });
      assert.equal(status, 200);
    });
  } finally {
    await LabResult.deleteMany({ _id: { $in: created.labs } });
    await ImagingResult.deleteMany({ _id: { $in: created.imgs } });
    await Echographie.deleteMany({ _id: { $in: created.echos } });
    await Invoice.deleteMany({ source_id: { $in: [...created.labs, ...created.imgs, ...created.echos] } });
    await Patient.findByIdAndDelete(patient._id);
    await mongoose.disconnect();
  }
});
