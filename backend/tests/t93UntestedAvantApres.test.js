// T9.5 — audit de couverture a trouvé 6 fonctions où le code avant/apres du
// T9.3 a été écrit mais jamais réellement exercé par un test : le code
// existe, mais rien ne prouve qu'il ne plante pas ou que l'instantané est
// correct. Fermé ici avant d'étendre la couverture plus largement (Finding A
// de l'audit T9.5, distinct du Finding B — modules Phase 6 pas encore
// couverts du tout).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('T9.5 — fonctions avant/apres du T9.3 jamais exercées par un test (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const AuditLog = require('../models/AuditLog');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const DossierChirurgical = require('../models/DossierChirurgical');
  const ImagingResult = require('../models/ImagingResult');
  const Echographie = require('../models/Echographie');
  const Ambulance = require('../models/Ambulance');
  const blocC = require('../controllers/blocoperatoireController');
  const radC  = require('../controllers/radiology.controller');
  const echoC = require('../controllers/echographieController');
  const ambC  = require('../controllers/ambulances.controller');

  const stamp = Date.now();
  const user = { _id: new mongoose.Types.ObjectId(), prenom: 'T95', nom: 'Test', role: 'medecin' };
  const patient = await Patient.create({ nom: `T95${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'M' });
  const medecin = await User.create({ email: `_t95-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'Med', prenom: 'T95', role: 'medecin', statut: 'actif' });

  const cleanup = [() => Patient.findByIdAndDelete(patient._id), () => User.findByIdAndDelete(medecin._id)];
  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) throw err; });
    return { status, body };
  };

  try {
    await t.test('blocoperatoireController.scheduleIntervention journalise avant/apres sans planter', async () => {
      const dossier = await DossierChirurgical.create({ numero: `CHIR-T95-${stamp}`, patient: patient._id, patient_nom: 'T95 P' });
      cleanup.push(() => DossierChirurgical.findByIdAndDelete(dossier._id));

      const { status } = await call(blocC.scheduleIntervention, { body: { dossier_id: dossier._id, salle: 'Salle B', date_intervention: '2026-10-01T09:00:00', chirurgien_id: medecin._id }, user, ip: '127.0.0.1' });
      assert.equal(status, 201);
      const log = await AuditLog.findOne({ module: 'blocoperatoire', action: 'CREATE', entite_id: dossier._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.statut, 'consultation');
      assert.equal(log.donnees_apres.statut, 'preoperatoire');
      assert.equal(log.donnees_apres.salle_prevue, 'Salle B');
    });

    await t.test('blocoperatoireController.updateIntervention journalise avant/apres sans planter', async () => {
      const dossier = await DossierChirurgical.create({ numero: `CHIR-T95b-${stamp}`, patient: patient._id, patient_nom: 'T95 P', statut: 'preoperatoire' });
      cleanup.push(() => DossierChirurgical.findByIdAndDelete(dossier._id));

      const { status } = await call(blocC.updateIntervention, { params: { id: dossier._id }, body: { statut: 'opere' }, user, ip: '127.0.0.1' });
      assert.equal(status, 200);
      const log = await AuditLog.findOne({ module: 'blocoperatoire', action: 'UPDATE', entite_id: dossier._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.statut, 'preoperatoire');
      assert.equal(log.donnees_apres.statut, 'opere');
    });

    await t.test('radiology.controller.rapport journalise avant/apres sans planter', async () => {
      const examen = await ImagingResult.create({ patient: patient._id, patient_nom: 'T95 P', statut: 'realise', type_examen: 'scanner' });
      cleanup.push(() => ImagingResult.findByIdAndDelete(examen._id));

      const { status } = await call(radC.rapport, { params: { id: examen._id }, body: { compte_rendu: 'RAS', conclusion: 'Normal' }, user, ip: '127.0.0.1' });
      assert.equal(status, 200);
      const log = await AuditLog.findOne({ module: 'radiology', action: 'RAPPORT', entite_id: examen._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.statut, 'realise');
      assert.equal(log.donnees_apres.statut, 'rapporte');
      assert.equal(log.donnees_apres.conclusion, 'Normal');
    });

    await t.test('radiology.controller.uploadImages journalise avant/apres sans planter', async () => {
      const examen = await ImagingResult.create({ patient: patient._id, patient_nom: 'T95 P', statut: 'programme', type_examen: 'radio' });
      cleanup.push(() => ImagingResult.findByIdAndDelete(examen._id));

      const { status } = await call(radC.uploadImages, {
        params: { id: examen._id },
        files: [{ filename: `t95-${stamp}.jpg`, mimetype: 'image/jpeg', size: 1024 }],
        user, ip: '127.0.0.1',
      });
      assert.equal(status, 200);
      const log = await AuditLog.findOne({ module: 'radiology', action: 'UPLOAD_IMAGES', entite_id: examen._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.images.length, 0);
      assert.equal(log.donnees_apres.images.length, 1);
    });

    await t.test('echographieController.saveRapport journalise avant/apres sans planter', async () => {
      const demande = await Echographie.create({ patient: 'T95 P', statut: 'planifiee' });
      cleanup.push(() => Echographie.findByIdAndDelete(demande._id));

      const { status } = await call(echoC.saveRapport, { params: { id: demande._id }, body: { conclusion: 'RAS', rapport_statut: 'valide' }, user, ip: '127.0.0.1' });
      assert.equal(status, 200);
      const log = await AuditLog.findOne({ module: 'echographie', action: 'UPDATE', entite_id: demande._id.toString() }).sort('-createdAt');
      assert.equal(log.donnees_avant.statut, 'planifiee');
      assert.equal(log.donnees_apres.statut, 'validee');
    });

    await t.test('ambulances.controller.assignMission journalise avant/apres — branche création ET branche mise à jour', async () => {
      const numero = `AMB-T95-${stamp}`;
      const { status: s1 } = await call(ambC.assignMission, { body: { numero, conducteur: 'Chauffeur 1', destination: 'Hôpital A', motif_mission: 'Urgence' }, user, ip: '127.0.0.1' });
      assert.equal(s1, 201);
      cleanup.push(() => Ambulance.deleteOne({ numero }));
      let log = await AuditLog.findOne({ module: 'ambulances', action: 'CREATE', message: { $regex: numero } }).sort('-createdAt');
      assert.equal(log.donnees_avant, undefined, 'nouvelle ambulance — aucun état antérieur à journaliser');
      assert.equal(log.donnees_apres.destination, 'Hôpital A');

      const { status: s2 } = await call(ambC.assignMission, { body: { numero, conducteur: 'Chauffeur 2', destination: 'Hôpital B', motif_mission: 'Transfert' }, user, ip: '127.0.0.1' });
      assert.equal(s2, 201);
      log = await AuditLog.findOne({ module: 'ambulances', action: 'CREATE', message: { $regex: 'Hôpital B' } }).sort('-createdAt');
      assert.ok(log.donnees_avant, 'ambulance déjà existante — l\'état antérieur doit être journalisé cette fois');
      assert.equal(log.donnees_avant.destination, 'Hôpital A');
      assert.equal(log.donnees_apres.destination, 'Hôpital B');
    });
  } finally {
    for (const fn of cleanup) await fn();
    await mongoose.disconnect();
  }
});
